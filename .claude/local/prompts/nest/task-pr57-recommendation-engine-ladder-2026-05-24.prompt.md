# PR-57 — RecommendationEngine: Invasiveness Ladder Rule

> **Type:** feature
> **Module:** nest/diagnosis
> **Date:** 2026-05-24
> **Stack:** Node 22 · TypeScript 5 ESM · NestJS · TypeORM · Postgres
> **Quality gate:** `npm run lint && npm run test -- --testPathPattern=recommendation-engine`

---

## Context

`recommendation-engine.service.ts` (333 lines, `nest/src/modules/diagnosis/`) already implements:
- Trigger matching with severity downgrade fallback
- Genericity penalty (`1 / log2(2 + n)`)
- Scoring: `severityWeight × confidenceFinal × priorityDefault × sevPenalty × genPenalty`
- Top-5 sort by score (step 7)
- Delete+re-persist `recommendation_link` rows (steps 8–9)

**What's missing (PR-57):** the invasiveness ladder rule applied between step 7 (sort) and step 8 (persist).

**Ladder rule (PROXIMOS_PASSOS.md):**
> "menor invasiveness primeiro, max 2 categorias, nunca 4b isolado"

---

## Business Rules

### Invasiveness levels (`CATEGORY_TO_INVASIVENESS` in `recommendation.types.ts`)

| Level | Category |
|---|---|
| 0 | `photo` |
| 1 | `posture`, `lifestyle` |
| 2 | `exercise` |
| 3 | `styling` |
| 4a | `aesthetic_procedure` |
| 4b | `professional_referral` |

### Three constraints to enforce in this order:

1. **4b gate:** `professional_referral` recs are ONLY included when:
   - at least one matched `metric_evaluation_against_ideal.severity5 === 'extreme'` **OR**
   - `catalog.clinicalPathwayRequired === true` on that specific recommendation.
   Otherwise drop them from the set silently.

2. **Max 2 categories:** scan the sorted list from highest score to lowest; admit entries until 2 distinct categories have been seen; drop any entry that would introduce a 3rd distinct category.

3. **Re-sort by invasiveness ASC, then score DESC** — within each level, higher score comes first. The user sees lowest-invasiveness first.

4. **Take top 5** from the re-sorted set.

---

## Dependency Map

- `recommendation-engine.service.ts` — add `_applyLadderRule()` private method
- `RecommendationCatalogEntity` — fields `invasivenessLevel: number`, `clinicalPathwayRequired: boolean`, `category: RecommendationCategory` — all already present on entity ✓
- `MetricEvaluationAgainstIdealEntity.severity5` — already queried at step 4 ✓
- `CATEGORY_TO_INVASIVENESS` (`recommendation.types.ts:34`) — not needed directly; use `catalog.invasivenessLevel` from entity
- `AccEntry` interface (local, line ~206) — already holds `catalog: RecommendationCatalogEntity`

**No new DB queries needed.** All data is already in memory after step 4.

---

## Implementation

### 1. Detect extreme eval — add after step 4 load:

```typescript
// After loading againstIdeals (step 4):
const hasExtremeEval = againstIdeals.some((ai) => ai.severity5 === 'extreme');
```

### 2. Add `_applyLadderRule()` private method:

```typescript
private _applyLadderRule(
  sorted: Array<[string, AccEntry]>,
  hasExtremeEval: boolean,
): Array<[string, AccEntry]> {
  // Gate 1: remove 4b unless extreme eval or clinical_pathway_required
  const gated = sorted.filter(([, entry]) => {
    if (entry.catalog.category !== 'professional_referral') return true;
    return hasExtremeEval || entry.catalog.clinicalPathwayRequired;
  });

  // Gate 2: max 2 distinct categories
  const seenCategories = new Set<string>();
  const categoryFiltered = gated.filter(([, entry]) => {
    const cat = entry.catalog.category;
    if (seenCategories.has(cat)) return true; // same category as seen — admit
    if (seenCategories.size >= 2) return false; // would add 3rd — drop
    seenCategories.add(cat);
    return true;
  });

  // Gate 3: re-sort by invasiveness ASC, then score DESC
  return categoryFiltered
    .sort((a, b) => {
      const invDiff = a[1].catalog.invasivenessLevel - b[1].catalog.invasivenessLevel;
      if (invDiff !== 0) return invDiff;
      return b[1].score - a[1].score;
    })
    .slice(0, 5);
}
```

### 3. Call site — replace step 7 usage:

After line `const sorted = Array.from(acc.entries()).sort(...).slice(0, 5);`, add:

```typescript
const ladderFiltered = this._applyLadderRule(sorted, hasExtremeEval);
```

Then replace every reference to `sorted` in steps 8–10 with `ladderFiltered`.

> Note: move `hasExtremeEval` computation to BEFORE the step 7 sort (it only needs `againstIdeals` which is available after step 4).

---

## Tests — `recommendation-engine.service.spec.ts`

Create/update with these cases (mock repos, no real DB):

- `returns empty array when no triggers` (existing behavior — verify still passes)
- `no professional_referral when severity is not extreme and clinicalPathwayRequired=false`
- `professional_referral allowed when at least one eval has severity=extreme`
- `professional_referral allowed when catalog.clinicalPathwayRequired=true`
- `max 2 categories enforced — 3rd category dropped`
- `lower invasiveness sorted first regardless of score`
- `within same invasiveness level, higher score comes first`

Use `jest.fn()` mocks for all four repositories. Construct minimal `AccEntry`-like data inline.

---

## Steps / Checks

### Pre-implementation
- [ ] Read lines 1–333 of `recommendation-engine.service.ts` to confirm current step numbering
- [ ] Confirm `hasExtremeEval` scan uses correct field: `MetricEvaluationAgainstIdealEntity.severity5` (column `severity_5`)
- [ ] Confirm `AccEntry` interface is local to `findForReport()` scope (not exported)

### Implementation
- [ ] Add `hasExtremeEval` after step 4
- [ ] Add `_applyLadderRule()` method
- [ ] Replace `sorted` → `ladderFiltered` in steps 8–10
- [ ] Create `recommendation-engine.service.spec.ts` with 7 test cases

### Post-implementation
- [ ] `npm run lint`
- [ ] `npm run test -- --testPathPattern=recommendation-engine` — all passing
- [ ] Update `.claude/local/context/nest/99-changelog.md` — entry for PR-57

---

## Verification

```bash
# Lint clean
cd /home/luizescobal/study/face-before-after && npm run lint --workspace=nest

# Tests pass
cd /home/luizescobal/study/face-before-after && npm run test --workspace=nest -- --testPathPattern=recommendation-engine
```

---

## Commits

```bash
git add nest/src/modules/diagnosis/recommendation-engine.service.ts
git add nest/src/modules/diagnosis/recommendation-engine.service.spec.ts
git commit -m "feat(nest): PR-57 — invasiveness ladder rule in RecommendationEngine"
```
