# PR-57 — RecommendationEngine: Invasiveness Ladder Rule

> **Status (2026-05-24): ✅ DONE.** Implemented in `nest/src/modules/diagnosis/recommendation-engine.service.ts` — ladder gate at line 270 (sort + ladder + top 5), helper at line 318 explicitly tagged "PR-57", re-sort at line 347 (`invasivenessLevel ASC, score DESC`), extreme-severity detection at line 199. See [STATUS_LEDGER_2026-05-24.md](./STATUS_LEDGER_2026-05-24.md). Historical document — do not re-execute.

> **Date:** 2026-05-24
> **Status:** ~~ready to execute~~ shipped
> **Recommended Execution Model:** sonnet

## Goal

Add the **invasiveness ladder rule** to `recommendation-engine.service.ts`:  
> "menor invasiveness primeiro, max 2 categorias, nunca 4b isolado"

The scoring engine (match → score → sort) is already implemented. PR-57's remaining work is a post-sort filter/reorder step applied after step 7 (top-5 cut) before step 8 (persist).

---

## Context

**File to change:** `nest/src/modules/diagnosis/recommendation-engine.service.ts` (333 lines)

**Relevant entities:**
- `RecommendationCatalogEntity.invasivenessLevel` (smallint, `CATEGORY_TO_INVASIVENESS` mirror)
- `RecommendationCatalogEntity.clinicalPathwayRequired` (boolean)
- `RecommendationCatalogEntity.category` (`RecommendationCategory`)

**`CATEGORY_TO_INVASIVENESS`** (from `recommendation.types.ts`):
```
photo: 0, posture: 1, lifestyle: 1, exercise: 2, styling: 3,
aesthetic_procedure: 4,  professional_referral: 4
```
Level 4a = `aesthetic_procedure`, level 4b = `professional_referral`

**Ladder rules (PROXIMOS_PASSOS.md + domain types):**
1. Always show the lowest available invasiveness level first.
2. At most 2 distinct categories in the output set.
3. Level 4b (`professional_referral`) only appears when `severity=extreme` on at least one matched eval **OR** `clinicalPathwayRequired=true` on the recommendation.

**Engine needs `invasivenessLevel` and `clinicalPathwayRequired` during step 7.**  
Currently the `acc` map stores `catalog: RecommendationCatalogEntity` — both fields are already on the entity.

---

## Affected files

| File | Change |
|---|---|
| `nest/src/modules/diagnosis/recommendation-engine.service.ts` | Add `_applyLadderRule()` private method; call from `findForReport()` between step 7 (sort+slice) and step 8 (delete+persist) |
| `nest/src/modules/diagnosis/recommendation-engine.service.spec.ts` _(create if absent)_ | Unit tests: no-4b-without-extreme, max-2-categories, lower-invasiveness-first |

---

## Steps

### Pre-implementation
- [ ] Confirm `RecommendationCatalogEntity` fields `invasivenessLevel` and `clinicalPathwayRequired` are loaded in the trigger query (step 2: `innerJoinAndSelect('t.recommendation', 'rec')` already loads the full catalog row ✓)
- [ ] Confirm `RecommendationMatch` interface exposes enough data for tests

### Implementation — `_applyLadderRule()`

```typescript
// Signature to add:
private _applyLadderRule(
  sorted: Array<[string, AccEntry]>,
  hasExtremeEval: boolean,
): Array<[string, AccEntry]>
```

Logic:
1. **4b gate:** if `!hasExtremeEval`, filter out entries where `catalog.category === 'professional_referral' && !catalog.clinicalPathwayRequired`
2. **Max 2 categories:** scan from highest-score to lowest; collect distinct categories up to 2; drop remaining entries that would add a 3rd category
3. **Sort by invasiveness ASC, then score DESC** within each invasiveness tier (already sorted by score, so secondary sort by invasivenessLevel ASC)
4. **Take top 5** after re-sort

`hasExtremeEval`: pass from `findForReport()` — scan `againstIdeals` for any `severity5 === 'extreme'` after step 4.

### Call site in `findForReport()`

Between step 7 and step 8:
```typescript
// Detect extreme eval (for 4b gate)
const hasExtremeEval = againstIdeals.some(ai => ai.severity5 === 'extreme');

// Apply ladder rule
const ladderFiltered = this._applyLadderRule(sorted, hasExtremeEval);
```

Then use `ladderFiltered` instead of `sorted` in steps 8–10.

### Tests (unit — no DB)
- `no professional_referral when no extreme severity and clinical_pathway_required=false`
- `professional_referral allowed when severity=extreme`
- `professional_referral allowed when clinicalPathwayRequired=true`
- `max 2 categories enforced`
- `lower invasiveness wins in ordering`

### Post-implementation
- [ ] `npm run lint` (or `eslint` — check CLAUDE.md quality gate)
- [ ] `npm run test -- recommendation-engine` — all passing
- [ ] Update `.claude/local/context/nest/` — note PR-57 ladder rule in changelog

---

## Verification

```bash
# Smoke: engine returns recs for a known report UUID
curl -s http://localhost:3000/v1/analysis/<report_id>/recommendations | jq '.[0].category'
# Expected: low-invasiveness category (not 'professional_referral') unless extreme
```

---

## Commits

```bash
git add nest/src/modules/diagnosis/recommendation-engine.service.ts
git add nest/src/modules/diagnosis/recommendation-engine.service.spec.ts
git commit -m "feat(nest): PR-57 — add invasiveness ladder rule to RecommendationEngine"
```
