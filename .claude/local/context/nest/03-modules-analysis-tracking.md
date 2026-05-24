---
tenant_id: "face-before-after-nest"
project: "face-before-after-nest"
module: "nest/modules-analysis-tracking"
file_path: ".claude/local/context/nest/03-modules-analysis-tracking.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  AnalysisModule orchestrates the full landmark-to-score pipeline via AnalysisOrchestratorService,
  persisting analysis_report, metric_evaluation, metric_evaluation_against_ideal, regional_score,
  and global_score rows in a single transaction. TrackingModule is a DDD stub with a TrackingListener
  that consumes photo.quality.* and analysis.completed events. IdentityModule is an empty DDD stub.
tags:
  - "nest"
  - "analysis"
  - "tracking"
  - "identity"
  - "orchestrator"
  - "scoring"
rag_keywords:
  - "AnalysisModule"
  - "AnalysisService"
  - "AnalysisOrchestratorService"
  - "IdealComparator"
  - "SeverityClassifier"
  - "RegionalScorer"
  - "GlobalScorer"
  - "ScoreBander"
  - "ReportReaderService"
  - "AnalysisReportEntity"
  - "MetricEvaluationEntity"
  - "MetricEvaluationAgainstIdealEntity"
  - "LandmarkPayloadEntity"
  - "TrackingModule"
  - "TrackingListener"
  - "IdentityModule"
  - "EvaluateRequestDto"
  - "EvaluateResponseDto"
  - "AnalyzePhotoDto"
related_modules:
  - "nest/architecture"
  - "nest/modules-diagnosis-catalog"
depends_on:
  - "nest/architecture"
---

# Modules: Analysis, Tracking, Identity

## AnalysisModule

File: `nest/src/modules/analysis/analysis.module.ts`

`AnalysisModule` is the core computation module. It receives raw MediaPipe landmarks (via the
`/v1/analysis/evaluate` endpoint) or a base64 photo (via `/v1/analysis/analyze`), runs the full
scoring pipeline, and persists results to Postgres.

**Imports:**
- `VisionModule` — provides `VisionClient` (HTTP calls to Python service)
- `PhotoQualityModule` — provides `PhotoQualityService` (Module 0 gatekeeper)
- `TypeOrmModule.forFeature([...])` — registers all analysis entities:
  `MetricRegistryVersionEntity`, `MetricDefinitionEntity`, `IdealsVersionEntity`,
  `MetricIdealEntity`, `AnalysisThresholdConfigEntity`, `SeverityCollapsePolicyEntity`,
  `AnalysisReportEntity`, `LandmarkPayloadEntity`, `MetricEvaluationEntity`,
  `MetricEvaluationAgainstIdealEntity`, `RegionMetricWeightsVersionEntity`,
  `RegionMetricWeightEntity`, `GlobalWeightsVersionEntity`, `GlobalWeightEntity`,
  `RegionalScoreEntity`, `GlobalScoreEntity`

**Controllers:** `AnalysisController`

**Providers:**
`AnalysisService`, `IdealComparator`, `SeverityClassifier`, `RegionalScorer`, `GlobalScorer`,
`ScoreBander`, `AnalysisOrchestratorService`, `ReportReaderService`

**Exported providers:**
`IdealComparator`, `SeverityClassifier`, `RegionalScorer`, `GlobalScorer`, `ScoreBander`,
`AnalysisOrchestratorService`

Note: `AnalysisService` and `ReportReaderService` are **not exported** — they are internal entry points.

## AnalysisService

File: `nest/src/modules/analysis/analysis.service.ts`

`AnalysisService` is the HTTP-facing entry point for photo-based analysis runs. It orchestrates the
quality gate and the vision pipeline, then emits domain events for downstream modules.

**Key methods:**

| Method | Signature | Description |
|---|---|---|
| `analyze` | `(payload: AnalyzePhotoDto): Promise<AnalysisResultDto>` | Runs `PhotoQualityService.validate()` (unless `skip_quality_gate=true`). Emits `photo.quality.rejected` on REJECT (throws `BadRequestException`). Calls `VisionClient.fullPipeline()`. Emits `analysis.completed`. Returns `AnalysisResultDto`. |
| `compare` | `(payload: CompareRunsDto): Promise<CompareResponseDto>` | Calls `VisionClient.compare()`. Emits `analysis.compared`. |

**Events emitted:**
- `photo.quality.rejected` — `{ session_id, grade, recommendations }`
- `photo.quality.accepted` — `{ session_id, grade }`
- `analysis.completed` — `{ session_id, run_id, mode, result }`
- `analysis.compared` — `{ run_id_before, run_id_after }`

**AnalysisResultDto interface:**
```ts
interface AnalysisResultDto {
  run_id: string;
  output_dir: string;
  photo_url?: string;
  canonical_url?: string;
  result: Record<string, unknown>;
  quality?: PhotoQualityDecisionDto;
}
```

## AnalysisOrchestratorService

File: `nest/src/modules/analysis/domain/orchestrator.service.ts` (PR-10 M1 core)

`AnalysisOrchestratorService` is the domain service that runs the full landmark-to-persisted-report cycle.
It operates on pre-computed MediaPipe landmarks supplied by the client (endpoint `POST /v1/analysis/evaluate`).

**Algorithm (6 steps):**

1. Call Python `/vision/metrics-v2` via `VisionClient` to get raw metric values (`RawMetricV2[]`).
2. Load active DB versions: `metric_registry`, `ideals`, `threshold_config`, `severity_collapse`,
   `region_metric_weights`, `global_weights`.
3. For each raw metric:
   - Create `MetricEvaluationEntity`.
   - Look up `MetricIdealEntity` for `metricId + idealsVersion`.
   - Run `IdealComparator` → `deviation_raw`, `deviation_normalized`, `direction_label`.
   - Run `SeverityClassifier` → `severity_5`, `severity_3`.
   - Create `MetricEvaluationAgainstIdealEntity` (when ideal exists).
4. Compute `RegionalScoreEntity[]` via `RegionalScorer`.
5. Compute `GlobalScoreEntity` via `GlobalScorer`.
6. Create `AnalysisReportEntity` + `LandmarkPayloadEntity`. Persist all in a **single DB transaction**.

## Analysis DTOs

### EvaluateRequestDto

File: `nest/src/modules/analysis/dto/evaluate.dto.ts`

```ts
class EvaluateRequestDto {
  landmarks: number[][];               // MediaPipe Mesh-478 N×3 pixel coords
  quality_context: QualityContextEvaluateDto;
  session_id?: string;
  yaw_deg?: number;                    // default 0.0
  pitch_deg?: number;                  // default 0.0
  image_size?: number[];
  locale?: string;                     // default 'pt-BR'
}

class QualityContextEvaluateDto {
  quality_score: number;               // [0, 1], default 1.0
  regional_penalties?: Record<string, number>;
  pose?: Record<string, number>;
}
```

### EvaluateResponseDto

```ts
interface EvaluateResponseDto {
  analysis_report_id: string;
  session_id: string | null;
  generated_at: string;
  status: string;
  quality_score: number | null;
  metric_count: number;
  metrics: MetricEvaluationResultDto[];
  metric_evaluations?: MetricEvaluationResultDto[];  // alias for frontend
  landmarks?: Array<[number, number]>;               // raw pixel landmarks (PR-31)
  regional_scores: RegionalScoreResultDto[];
  global_score: GlobalScoreResultDto;
  versions: EvaluateVersionsDto;
}
```

### MetricEvaluationResultDto

```ts
interface MetricEvaluationResultDto {
  metric_id: string;
  region: string;
  family: string;
  unit: string;
  value: number | null;
  confidence_raw: number | null;
  confidence_final: number | null;
  is_low_confidence: boolean;
  direction: string | null;
  deviation_raw: number | null;
  deviation_normalized: number | null;
  severity_5: string | null;
  severity_3: string | null;
  direction_label: Record<string, string>;
  improvement_vector_x: number | null;   // in ICU (PR-36)
  improvement_vector_y: number | null;
  anchor_landmark_index: number | null;
}
```

### AnalyzePhotoDto

File: `nest/src/modules/analysis/dto/analysis.dto.ts`

```ts
class AnalyzePhotoDto {
  image_base64: string;
  mode?: 'premium' | 'teaser';     // default 'premium'
  session_id?: string;
  filename?: string;
  skip_quality_gate?: boolean;     // default false
}
```

## Database Entities — Analysis Module

### AnalysisReportEntity

Table: `analysis_report` (partitioned by `generated_at`, monthly partitions)

Postgres-level PK: `(id, generated_at)`. TypeORM logical PK: `id` (UUID).

Key columns: `session_id`, `photo_reference`, `normalization_basis` (default `'intercanthal'`),
`pose_correction_applied`, `midline_aligned`, `quality_score`, `metric_registry_version`,
`ideals_version`, `threshold_config_version`, `severity_collapse_version`,
`region_metric_weights_version`, `global_weights_version`, `locale`, `user_context` (JSONB),
`processing_notes` (JSONB array), `disclaimer_text_snapshot`, `status`, `generated_at`, `created_at`.

Relations: `@OneToOne` to `LandmarkPayloadEntity`, `@OneToMany` to `MetricEvaluationEntity`.

**Important:** always include `generated_at` in WHERE clauses to enable partition pruning.

### Other Key Entities

| Entity | Table | Notes |
|---|---|---|
| `LandmarkPayloadEntity` | `landmark_payload` | Raw MediaPipe Mesh-478 landmarks (N×3). 1:1 with `analysis_report`. |
| `MetricEvaluationEntity` | `metric_evaluation` | One row per metric per report. Holds `metricId`, `confidenceFinal`, `value`, etc. FK to `analysis_report`. |
| `MetricEvaluationAgainstIdealEntity` | `metric_evaluation_against_ideal` | Deviation + severity per metric evaluation. Fields: `severity5`, `severity3`, `deviationRaw`, `deviationNormalized`, `directionLabel` (JSONB). FK to `metric_evaluation`. |
| `RegionalScoreEntity` | `regional_score` | Weighted score per region per report. |
| `GlobalScoreEntity` | `global_score` | Single global score per report with `band` (`no_number`/`refine`/`good`/`high`). |
| `MetricDefinitionEntity` | `metric_definition` | 66 rows. Fields: `metricId`, `version`, `family`, `region`, `unit`, `displayName` (JSONB i18n), `presentationOnly`, `requiresPixelAnalysis`, `dependencyLandmarks`, `defaultWeightInRegion`, `minConfidenceToDisplay`. |
| `MetricIdealEntity` | `metric_ideal` | 59 rows. Green/yellow range bounds, `idealCentralValue`, `directionLabelAbove/Below`. |
| `AnalysisThresholdConfigEntity` | `analysis_threshold_config` | Score bands + confidence thresholds. Versioned. |
| `SeverityCollapsePolicyEntity` | `severity_collapse_policy` | Maps 5-level severity to 3-level. Versioned. |

## Domain Services (AnalysisModule internal)

| Service | File | Responsibility |
|---|---|---|
| `IdealComparator` | `domain/ideal-comparator.ts` | Computes `deviation_raw`, `deviation_normalized`, `direction_label` given a metric value and its `MetricIdealEntity`. |
| `SeverityClassifier` | `domain/severity-classifier.ts` | Maps normalized deviation to `severity_5` and `severity_3` using the active `SeverityCollapsePolicyEntity`. Exports `DEFAULT_COLLAPSE_MAPPING`. |
| `RegionalScorer` | `domain/regional-scorer.ts` | Weighted average of metric scores within a region. Input: `RegionalScorerMetricInput[]`. Output: `RegionalScoreResult[]`. |
| `GlobalScorer` | `domain/global-scorer.ts` | Weighted average of regional scores into a 0–100 global score. |
| `ScoreBander` | `domain/score-bander.ts` | Classifies a global score into a band using `AnalysisThresholdConfigEntity`. |
| `ReportReaderService` | `domain/report-reader.service.ts` | Read-only service for loading persisted reports (not exported from module). |

## TrackingModule

File: `nest/src/modules/tracking/tracking.module.ts`

`TrackingModule` is a **DDD stub** intended to persist event bus events to storage (Postgres/Mongo)
for analytics and to track fingerprint-to-grade progression over time.

Current implementation registers a single provider `TrackingListener` that logs received events at
`debug` level with no persistence.

**Events consumed (stub):**
- `photo.quality.rejected`
- `photo.quality.accepted`
- `analysis.completed`

No entities, no repositories, no exports.

## IdentityModule

File: `nest/src/modules/identity/identity.module.ts`

`IdentityModule` is an **empty DDD stub** with no providers, controllers, imports, or exports.

Intended future scope: `SessionAggregate` (anonymous/authenticated), `SessionRepository`, JWT guards.
