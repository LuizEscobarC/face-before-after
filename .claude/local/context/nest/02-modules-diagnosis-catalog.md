---
tenant_id: "face-before-after-nest"
project: "face-before-after-nest"
module: "nest/modules-diagnosis-catalog"
file_path: ".claude/local/context/nest/02-modules-diagnosis-catalog.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  DiagnosisModule bundles DiagnosisService, RecommendationEngine (PR-57), RecommendationCatalogService,
  DiagnosticPriorityService, NarrativeService, PdfService and their controllers. RecommendationEngine.findForReport()
  runs the full trigger-matching and invasiveness ladder pipeline, persisting recommendation_link rows.
  CatalogModule (separate) exposes CatalogService for read-only access to metric_definition and metric_ideal tables.
tags:
  - "nest"
  - "diagnosis"
  - "catalog"
  - "recommendation"
  - "ladder-rule"
rag_keywords:
  - "DiagnosisModule"
  - "DiagnosisService"
  - "RecommendationEngine"
  - "CatalogService"
  - "AccEntry"
  - "findForReport"
  - "_applyLadderRule"
  - "recommendation_catalog"
  - "invasivenessLevel"
  - "professional_referral"
  - "clinicalPathwayRequired"
  - "priorityDefault"
  - "MetricContentEntity"
  - "GlossaryEntryDto"
related_modules:
  - "nest/architecture"
  - "nest/modules-analysis-tracking"
depends_on:
  - "nest/architecture"
used_by:
  - "nest/architecture"
---

# Modules: Diagnosis & Catalog

## DiagnosisModule

File: `nest/src/modules/diagnosis/diagnosis.module.ts`

`DiagnosisModule` is the central output module of the pipeline. It registers all diagnosis-related
providers and controllers and exports them for use by any feature that needs the full diagnosis surface.

**Imports:**
- `VisionModule` — provides `VisionClient` (used by `PdfService`)
- `OverlaysModule` — provides `MinioStorageService` + `RenderedAssetEntity` (used by `PdfService`)
- `TypeOrmModule.forFeature([...])` — owns `DiagnosticTemplateEntity`, `RecommendationCatalogVersionEntity`,
  `RecommendationCatalogEntity`, `RecommendationTriggerEntity`, `RecommendationLinkEntity`,
  `PriorityScoreAuditEntity`, `DiagnosisReportEntity` plus cross-module entities:
  `MetricEvaluationAgainstIdealEntity`, `MetricEvaluationEntity`, `AnalysisReportEntity`,
  `GlobalScoreEntity`, `MetricDefinitionEntity`

**Controllers:**
`DiagnosisController`, `DiagnosticTemplatesController`, `RecommendationCatalogController`,
`NarrativeController`, `PdfController`, `RunPdfController`

**Providers (all exported):**
`DiagnosisService`, `TemplateRendererService`, `RecommendationEngine`,
`RecommendationCatalogService`, `DiagnosticPriorityService`, `NarrativeService`, `PdfService`

## DiagnosisService

File: `nest/src/modules/diagnosis/diagnosis.service.ts`

`DiagnosisService` listens for `analysis.completed` events (via `@OnEvent`) and persists a
`DiagnosisReportEntity` keyed by `run_id`. It also provides CRUD operations over `DiagnosticTemplateEntity`
for the admin UI (PR-53).

**Key methods:**

| Method | Signature | Description |
|---|---|---|
| `handleAnalysisCompleted` | `(payload: AnalysisCompletedPayload): Promise<void>` | Event handler. Calls `_buildReport()` then upserts `diagnosis_report` row. Idempotent on `runId`. |
| `getReport` | `(runId: string): Promise<DiagnosisReportDto>` | Fetches persisted report; throws `NotFoundException` if not found. |
| `getTemplates` | `(filter?: { metricId?, size? })` | Returns `DiagnosticTemplateEntity[]` ordered by metricId/severity/size. |
| `getTemplateById` | `(id: string)` | Fetches single template or throws `NotFoundException`. |
| `getTemplateMetrics` | `()` | Returns distinct `metricId` values from the template table. |
| `updateTemplate` | `(id: string, templatePt: string)` | Patches `templatePt` on an existing template and saves. |
| `_buildReport` (private) | `(runId, result)` | Calls `_extractConcerns()`, slices top 3, builds summary string. |
| `_extractConcerns` (private) | `(result)` | Reads `photo_warnings` and `top_leverage` arrays from the Python pipeline result object; falls back to a score-based concern when `score < 6.5`. Returns `ConcernDto[]` sorted by severity DESC. |

**Entities touched:** `diagnosis_report` (write), `diagnostic_template` (read/write)

**DTOs:** `DiagnosisReportDto` (`run_id`, `top_concerns: ConcernDto[]`, `summary`, `timestamp`),
`ConcernDto` (`metric_id`, `label`, `severity: number`, `message`)

## RecommendationEngine

File: `nest/src/modules/diagnosis/recommendation-engine.service.ts` (PR-57)

`RecommendationEngine` matches metric deviation findings against active recommendation triggers,
scores them, applies the invasiveness ladder rule, and persists `recommendation_link` rows.

### RecommendationEngine.findForReport()

```
async findForReport(
  analysisReportId: string,
  analysisReportGeneratedAt: Date,
): Promise<RecommendationMatch[]>
```

**Algorithm (10 steps):**

1. Load active `recommendation_catalog_version` (returns `[]` if none exists).
2. Load all `recommendation_trigger` rows for that version via inner join with `recommendation_catalog`.
   Compute a **genericity penalty** per recommendation: `1 / log2(2 + triggerCount)`. This penalises
   "catch-all" recommendations that cover 100+ metric×severity combos (e.g. lifestyle nudges).
3. Load `metric_evaluation` rows for the report.
4. Load `metric_evaluation_against_ideal` rows for those evaluation IDs.
   Detect `hasExtremeEval = any(ai.severity5 === 'extreme')`.
5. Build `evalMap: Map<string, MetricEvaluationEntity>` for O(1) lookup.
6. **Match triggers:** for each `againstIdeal`, skip `severity='ideal'` and `confidenceFinal < 0.4` (DEC-7).
   Apply **severity downgrade fallback**: an `extreme` finding matches triggers for `strong`/`moderate`/`mild`
   with an exponential penalty `0.7^sevIdx`.
   Score per match: `severityWeight × confidenceFinal × priorityDefault × sevPenalty × genPenalty`.
   Accumulator uses OR semantics (max score, union of triggered eval IDs) keyed by `recommendationId`.
7. Sort accumulator by score DESC; call `_applyLadderRule()`.
8. Delete existing `recommendation_link` rows for this report (idempotency).
9. Persist new `recommendation_link` rows with `finalPriorityInSession = rank`.
10. Return `RecommendationMatch[]`.

**Severity weight table (PLAN_M4_NARRATIVE §2.3):**

| Label | Weight |
|---|---|
| `minimal` | 0.10 |
| `mild` | 0.30 |
| `moderate` | 0.50 |
| `strong` | 0.80 |
| `extreme` | 1.00 |
| `ideal` | 0.00 |

**`RecommendationMatch` interface:**
```ts
interface RecommendationMatch {
  recommendationId: string;
  score: number;
  rank: number;
  triggeredByMetricEvaluationIds: string[];
  requiresProfessional: boolean;
  professionalType: string | null;
  category: string;
  displayTextShortPt: string;
}
```

### AccEntry interface

`AccEntry` is exported from `recommendation-engine.service.ts` and used internally during trigger matching
and ladder filtering.

```ts
export interface AccEntry {
  score: number;
  triggeredBy: Set<string>;
  catalog: RecommendationCatalogEntity;
}
```

### RecommendationEngine._applyLadderRule()

```
private _applyLadderRule(
  sorted: Array<[string, AccEntry]>,
  hasExtremeEval: boolean,
): Array<[string, AccEntry]>
```

Applies the PR-57 invasiveness ladder rule to a pre-sorted (score DESC) list of matches:

**Gate 1 — professional_referral block:**
Drop entries where `catalog.category === 'professional_referral'` unless `hasExtremeEval === true`
OR `catalog.clinicalPathwayRequired === true`.

**Gate 2 — max 2 distinct categories:**
Scan highest-score first; admit entries from at most 2 distinct `category` values. Entries belonging
to an already-seen category are always admitted; new categories beyond the 2nd cap are dropped.

**Gate 3 — re-sort and top-5 cut:**
Sort remaining entries by `invasivenessLevel ASC`, then `score DESC`. Slice to 5 entries.

## RecommendationCatalogEntity — key fields

File: `nest/src/modules/diagnosis/infrastructure/entities/recommendation-catalog.entity.ts`

Table: `recommendation_catalog`. PK is a human-readable snake_case slug (e.g. `improve-head-posture`).

| Column | Type | Purpose |
|---|---|---|
| `category` | `recommendation_category_enum` | Rendering section in PDF + disclaimer + ladder gate. |
| `invasiveness_level` | `smallint` | 0..4 ladder level (from `CATEGORY_TO_INVASIVENESS` map). |
| `priority_default` | `smallint` | Baseline priority 1–5 used by `RecommendationEngine` scoring. |
| `requires_professional` | `boolean` | Disclaimer gate (DEC-35). |
| `professional_type` | `text` | Specialty when `requires_professional=true`. |
| `clinical_pathway_required` | `boolean` | Overrides Gate 1 block — forces inclusion even without extreme eval. |
| `effort_estimate` | `text` | Feeds `E` in PR-58 formula `(1 − E×0.5)`. |
| `risk_level` | `numeric(4,3)` | Feeds `R` in PR-58 formula `(1−R)`. |
| `evidence_level` | `evidence_level_enum` | `'strong'`, `'moderate'`, or `'anecdotal'`. |
| `requires_anecdotal_disclaimer` | `boolean` | Generated column: mirror of `evidence_level = 'anecdotal'`. |
| `animation_config` | `jsonb` | Declarative SVG animation for `<SvgFaceInstructor>` (PR-A/PR-B). `schema_version=1`, `primitives[]` required. |
| `biometric_config` | `jsonb` | Anatomical zones + verbs for biometric exercise instructor (PR-A). |
| `display_text_short_pt` | `text` | ≤120 chars card summary (DEC-31). |
| `display_text_long_pt` | `text` | Paragraph used in PDF and narrative. |

Relations: `@OneToMany` to `RecommendationTriggerEntity` and `RecommendationLinkEntity`.

## CatalogModule and CatalogService

Files: `nest/src/modules/catalog/catalog.module.ts`, `nest/src/modules/catalog/catalog.service.ts`

`CatalogModule` is a **read-only** module that serves `GET /v1/catalog/*` endpoints. It imports the
same entity repositories already used by `AnalysisModule` — no new migrations required.

`CatalogService` injects `MetricDefinitionEntity`, `MetricIdealEntity`, `MetricRegistryVersionEntity`,
`IdealsVersionEntity`, `AnalysisThresholdConfigEntity`, `SeverityCollapsePolicyEntity`,
`RegionMetricWeightsVersionEntity`, `GlobalWeightsVersionEntity`, and `MetricContentEntity`.

**Key methods:**

| Method | Returns | Description |
|---|---|---|
| `listMetrics(query: ListMetricsQuery)` | `MetricDefinitionDto[]` | Resolves active version; filters by `region`/`family`. |
| `getMetric(metricId, version?)` | `MetricWithIdealDto` | Single metric + its active ideal or `null`. |
| `listIdeals(query: ListIdealsQuery)` | `MetricIdealDto[]` | Resolves active ideals version; optional `region` filter via metric lookup. |
| `getActiveVersions()` | `ActiveVersionsDto` | Returns active + all versions across all 6 version dimensions in parallel. |
| `getScoreBands()` | `ScoreBandConfigDto \| null` | Returns active `analysis_threshold_config` bands and confidence thresholds. |
| `listRegions()` | `RegionSummaryDto[]` | Groups active metrics by region; counts `presentationOnly` and `requiresPixelAnalysis`. |
| `getGlossary(locale)` | `GlossaryResponseDto` | Joins `metric_definition` + `metric_content` (PR-66); returns keyed map with `feynman`, `descricao`, `como_medido`, `faixas`, `problemas_comuns`, `referencias`. |

Private helpers: `_resolveMetricVersion(explicit?)`, `_resolveIdealVersion(explicit?)`.

**Database literature reference** (stored in `metric_ideal.population_reference_note`):
Farkas 1994, Naini 2011, Powell & Humphreys 1984, Bashour 2006, Sarver & Jacobson 2014, Edler 2001.

**Data counts:** `metric_definition` — 66 rows; `metric_ideal` — 59 rows.

**`CatalogModule` exports:** `CatalogService`.
