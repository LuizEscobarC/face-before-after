---
tenant_id: "face-before-after-frontend"
project: "face-before-after-frontend"
module: "frontend/pages"
file_path: ".claude/local/context/frontend/01-pages.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Documents all page-level React components: CapturePage (entry/upload), FreeResultPage, PremiumResultPage, CompareResultPage, and seven admin pages (AdminBlacklistPage, AdminExerciseStudioPage, AdminGlobalWeightsPage, AdminMetricIdealPage, AdminRecommendationsPage, AdminTemplatesPage, AdminThresholdPage). Routes are defined in App.tsx and wrapped with FaceCalibrationProvider.
tags:
  - "frontend"
  - "pages"
  - "routing"
rag_keywords:
  - "CapturePage"
  - "FreeResultPage"
  - "PremiumResultPage"
  - "CompareResultPage"
  - "admin pages"
  - "routes"
  - "analyzePhoto"
  - "compareRuns"
  - "validatePhotoQuality"
depends_on: ["frontend/data-flow"]
used_by: []
---

# Pages — RAG Documentation

## Route Map (App.tsx)

Routes are registered in `frontend/src/App.tsx` wrapped by `FaceCalibrationProvider`:

| Path | Component |
|---|---|
| `/` | `CapturePage` |
| `/resultado/free` | `FreeResultPage` |
| `/resultado/premium` | `PremiumResultPage` |
| `/resultado/compare` | `CompareResultPage` |
| `/admin/templates` | `AdminTemplatesPage` |
| `/admin/recommendations` | `AdminRecommendationsPage` |
| `/admin/metric-ideals` | `AdminMetricIdealPage` |
| `/admin/global-weights` | `AdminGlobalWeightsPage` |
| `/admin/blacklist` | `AdminBlacklistPage` |
| `/admin/threshold` | `AdminThresholdPage` |
| `/admin/exercise-studio` | `AdminExerciseStudioPage` |
| `*` | redirect to `/` |

---

## CapturePage

**File:** `frontend/src/pages/CapturePage.tsx`
**Route:** `/`
**Purpose:** Entry page for photo upload/webcam capture and mode selection (Free, Premium, Antes/Depois).

### State
- `mode: AnalyzeMode` — `"free" | "premium" | "compare"`, default `"free"`
- `file: File | null` — single photo for free/premium modes
- `fileBefore / fileAfter: File | null` — two photos for compare mode
- `busy: boolean` — submit in-flight
- `quality: PhotoQualityDecision | null` — result from `validatePhotoQuality`
- `validating: boolean` — quality check in-flight
- `guidelines: CaptureGuidelines` — loaded from `fetchCaptureGuidelines()`, falls back to `fallbackGuidelines`
- `error: string` — user-facing error text

### API Calls
- `fetchCaptureGuidelines()` — on mount; sets `guidelines`
- `validatePhotoQuality(file)` — called in `handlePhotoReady` after every file selection; sets `quality`
- `analyzePhoto(mode, file)` → `AnalysisResult` — on submit for free/premium
- `cropImageToFace(file, face_bbox)` — crops before calling `analyzePhoto` when quality check returns a `face_bbox`
- `compareRuns(runBefore, runAfter)` — on submit for compare mode; called after two `analyzePhoto("premium", ...)` calls

### Sub-components
- `CaptureSourceTabs` — tab widget for upload/webcam input
- `PhotoQualityCard` — renders quality decision (`quality`) with retake CTA

### Navigation
- On free submit: `navigate("/resultado/free", { state: { result } })`
- On premium submit: `navigate("/resultado/premium", { state: { result } })`
- On compare submit: `navigate("/resultado/compare", { state: { compareResult, resBefore, resAfter } })`

---

## FreeResultPage

**File:** `frontend/src/pages/FreeResultPage.tsx`
**Route:** `/resultado/free`
**Purpose:** Displays the abbreviated free-tier analysis result: global score arc, first impression headline, top leverage action, visual perception scores (dominance/attractiveness/vitality), and upgrade CTA.

### State (location.state)
- `result: AnalysisResult` — injected via React Router `location.state`; redirects if missing

### Key Renders
- `ScoreArc` (inline SVG half-circle, 0–100, colored via `colorForScore` from `useScoreBands`)
- `result.tier` / `result.tier_description` tier badge
- `result.first_impression.headline` + `positive_signal`
- `result.top_leverage` action card
- `result.visual_status` — three progress-bar rows for `dominance_score`, `attractiveness_score`, `freshness_score`
- Photo capture warnings from `result.photo_warnings` and `result.capture_recommendations`
- Annotated image at `/v1/vision/results/${run_id}/annotated` when `run_id` is present

### No API Calls at render time — all data is in location.state.

---

## PremiumResultPage

**File:** `frontend/src/pages/PremiumResultPage.tsx`
**Route:** `/resultado/premium`
**Purpose:** Full premium report with multi-view image viewer (landmarks, ideal proportions, before/after slider, overlays, before-ideal vectors), narrative findings, clinical recommendations, evolution path, and PDF download.

### State
- `result: AnalysisResult` — from `location.state`
- `glossary: Record<string, GlossaryTerm>` — fetched via `fetchGlossary()`
- `view: ViewMode` — `"landmarks" | "ideal" | "compare" | "overlays" | "before_ideal"`
- `activeOverlays: string[]` — overlay toggle state; default from `DEFAULT_OVERLAYS`
- `activeLandmarkOverlays: string[]` — default from `DEFAULT_LANDMARKS_OVERLAYS`
- `imgDims: { w, h, naturalW, naturalH } | null` — rendered vs intrinsic image size for SVG alignment
- `beforeIdealUrl: string | null` — blob URL from `POST /v1/vision/compose-before-ideal`
- `composeLoading / composeError` — loading/error for before-ideal composition
- `showGuideLines / showActualWireframe: boolean` — controls for before-ideal toggles
- `selectedRegion / selectedIdealMetric: string | null` — interactive SVG region/metric selection
- `narrative: NarrativeResponseDto | null` — from `fetchNarrative(reportId)`
- `allFindings: NarrativeFinding[] | null` — from `fetchFindings(reportId, ...)`
- `allRecommendations: NarrativeRecommendation[] | null` — from `fetchReportRecommendations(reportId, ...)`
- `reportId: string | null` — resolved by `evaluateFromLandmarks` or from `result.report_id`
- `heatmapAssetUrls: Record<string, string>` — blob URLs keyed by overlay_id
- `pdfLoading / pdfError` — PDF download state

### API Calls
- `fetchGlossary()` — on mount
- `evaluateFromLandmarks({ landmarks, quality_score })` — only when `result.report_id` is absent (legacy flow)
- `fetchNarrative(reportId)` — after reportId is resolved
- `fetchFindings(reportId, { limit: 20, minSeverity: "mild" })` — after reportId
- `fetchReportRecommendations(reportId, { limit: 20 })` — after reportId
- `POST /v1/vision/compose-before-ideal` — when `view === "before_ideal"`, sends `{ runId, landmarks, offsets, showGuideLines, showActualWireframe }`
- `POST /v1/vision/render-overlay` — when heatmap overlay activated in "overlays" view; sends `{ runId, landmarks, overlayIds, regionAdherence }`
- `POST /v1/analysis/run/${run_id}/pdf` — on PDF download button click

### Sub-components (image viewer area)
- `AsymmetryAnalysisLayer` — in "landmarks" view, overlays asymmetry SVG
- `MetricsMapLayer` — in "landmarks" view (metrics_regions toggle) and "overlays" view (heatmap_ideal_adherence active)
- `IdealProportionsLayer` — in "ideal" view
- `OverlaySidebar` — variant matches active view (grid_thirds, grid_fifths, face_extents, ideal_proportions)
- `BeforeAfterSlider` (inline) — in "compare" view; drag-to-reveal canonical vs symmetrized
- `BeforeIdealOverlay` — in "before_ideal" view; renders improvement-vector arrows over composition PNG
- `OverlayLayer` — in "overlays" view; SVG geometric overlays (thirds, fifths, face extents, improvement vectors)
- `HeatmapImageLayer` — in "overlays" view; server-rendered PNG heatmap
- `MetricExplainer` — per metric in "Perfil Facial Detalhado" section and "Métricas Completas" catalog

### Helper Functions (file-local)
- `buildComposeOffsets(evals)` — maps MetricEvaluationResult[] to improvement-vector offset array for compose API
- `buildRegionAdherence(result)` — derives region-level adherence scores from metric_evaluations when `result.region_adherence` is absent

---

## CompareResultPage

**File:** `frontend/src/pages/CompareResultPage.tsx`
**Route:** `/resultado/compare`
**Purpose:** Side-by-side comparison of two analysis runs (Antes/Depois), showing score delta, tier transition, top improvements, top regressions, full metrics table, and visual perception comparison.

### State (location.state)
- `compareResult: CompareWithConsistency` — `score_before`, `score_after`, `score_delta`, `tier_before`, `tier_after`, `improved_count`, `worsened_count`, `top_improvements`, `top_regressions`, `metrics`, `consistency_score`, `consistency_issues`, `is_comparable`
- `resBefore / resAfter: AnalysisResult` — original analysis results for visual_status comparison

### Sub-components
- `ScoreArc` (inline, labelled) — renders half-arc for both ANTES and DEPOIS scores
- `ConsistencyWarning` — shown when `compareResult.consistency_score` is present

### No API Calls at render time.

---

## AdminBlacklistPage

**File:** `frontend/src/pages/AdminBlacklistPage.tsx`
**Route:** `/admin/blacklist`
**Purpose:** CRUD interface for narrative blacklist terms (diagnostic verbs, pathology words, guarantees, medical interventions, pejoratives).

### State
- `versions: { version: string }[]` — from `fetchBlacklistVersions()`
- `items: BlacklistTerm[]` — filtered list from `fetchBlacklistTerms({ version, category })`
- `selected: BlacklistTerm | null` — currently editing
- `filterVersion / filterCategory` — active filters
- `editNotes / editCategory / newTerm / newCategory / newNotes` — form fields
- `isSaving / msg` — save state

### API Calls
- `fetchBlacklistVersions()` — on mount
- `fetchBlacklistTerms({ version?, category? })` — on filter change
- `createBlacklistTerm(payload)` — on add
- `updateBlacklistTerm(id, { notes, category })` — on save
- `deleteBlacklistTerm(id)` — on remove

### Layout: two-panel (left = filter + list, right = add form + edit form)

---

## AdminExerciseStudioPage

**File:** `frontend/src/pages/AdminExerciseStudioPage.tsx`
**Route:** `/admin/exercise-studio`
**Purpose:** Unified studio for previewing and editing exercise animation/biometric configs; three-column layout (exercise list | canvas preview | tabbed JSON editors).

### State
- `items: RecommendationCatalog[]` — filtered by `category: "exercise"` via `fetchRecommendations`
- `selected: RecommendationCatalog | null` — loaded in full via `fetchRecommendation(id)`
- `tab: "animation" | "biometric" | "hands"` — active JSON editor tab
- `styleId: StudioStyle["id"]` — visual style for preview (default `"scifi"`)
- `playing: boolean` — animation play/pause
- `showHands: boolean` — toggle hand vectors in preview
- `animationJson / biometricJson / handsJson: string` — textarea state
- `parsedAnimation / parsedBiometric / parsedHands` — memoized JSON parse results
- `previewAnimation: AnimationConfig | null` — animation + hands merged for preview
- `calibrateOpen: boolean` — face calibration modal open state
- `isSaving / saveMsg` — save state

### API Calls
- `fetchRecommendations({ category: "exercise" })` — on mount
- `fetchRecommendation(id)` — on exercise selection
- `updateRecommendation(id, { animationConfig, biometricConfig })` — on save

### Sub-components
- `ExerciseStudioPreview` — central animated SVG face preview
- `FaceCalibrationModal` — webcam-driven face baseline capture
- `EditorPanel` (inline) — monospace textarea with error display

---

## AdminGlobalWeightsPage

**File:** `frontend/src/pages/AdminGlobalWeightsPage.tsx`
**Route:** `/admin/global-weights`
**Purpose:** Edit per-region global scoring weights; shows weight sum validation (must ≈ 1.0).

### State
- `versions: { version: string }[]` — from `fetchGlobalWeightVersions()`
- `items: GlobalWeight[]` — from `fetchGlobalWeights(version)`
- `edits: Record<string, number>` — pending weight values keyed by item id
- `filterVersion` — active version filter
- `saving / msgs` — per-row save state

### API Calls
- `fetchGlobalWeightVersions()` — on mount
- `fetchGlobalWeights(version)` — on version change
- `updateGlobalWeight(id, weight)` — on per-row save

---

## AdminMetricIdealPage

**File:** `frontend/src/pages/AdminMetricIdealPage.tsx`
**Route:** `/admin/metric-ideals`
**Purpose:** View and edit per-metric ideal values, green/yellow range bands, and population reference notes.

### State
- `versions: { idealsVersion: string }[]` — from `fetchMetricIdealVersions()`
- `items: MetricIdeal[]` — from `fetchMetricIdeals({ idealsVersion?, metricId? })`
- `selected: MetricIdeal | null` — currently editing
- `form: Partial<MetricIdeal>` — edited fields: `idealCentralValue`, `greenRangeMin/Max`, `yellowRangeMin/Max`, `populationReferenceNote`
- `labelMap: Map<string, string>` — metric ID → display label from `fetchMetricLabels()`

### API Calls
- `fetchMetricIdealVersions()`, `fetchMetricLabels()` — on mount
- `fetchMetricIdeals({ idealsVersion?, metricId? })` — on filter change
- `updateMetricIdeal(id, form)` — on save

---

## AdminRecommendationsPage

**File:** `frontend/src/pages/AdminRecommendationsPage.tsx`
**Route:** `/admin/recommendations`
**Purpose:** Browse, edit, and preview diagnostic recommendation catalog entries; includes ExerciseStudioPreview for exercise recommendations.

### State
- `items: RecommendationCatalog[]` — filtered by category via `fetchRecommendations`
- `selected: RecommendationCatalog | null` — full record from `fetchRecommendation(id)`
- `animationConfig / biometricConfig / actionVectors` — JSON config fields for exercise previews
- `categories: RecommendationCategory_Option[]` — from `fetchRecommendationCategories()`

### API Calls
- `fetchRecommendationCategories()`, `fetchRecommendations({ category? })` — on mount/filter
- `fetchRecommendation(id)` — on selection
- `updateRecommendation(id, payload)` — on save

### Sub-components
- `ExerciseStudioPreview` — preview panel for exercise-type recommendations

---

## AdminTemplatesPage

**File:** `frontend/src/pages/AdminTemplatesPage.tsx`
**Route:** `/admin/templates`
**Purpose:** Browse, edit, and save diagnostic narrative templates; filter by metric and size; inline textarea editor with live placeholder preview.

### State
- `metrics: TemplateMetricOption[]` — from `fetchTemplateMetrics()`
- `templates / filteredTemplates: DiagnosticTemplate[]` — from `fetchTemplates()`
- `selectedMetric / selectedSize` — active filters
- `selectedTemplate: DiagnosticTemplate | null` — currently editing
- `editedText: string` — textarea content
- `isSaving / saveMessage` — save state

### API Calls
- `fetchTemplateMetrics()`, `fetchTemplates()` — on mount
- `updateTemplate(id, text)` — on save

---

## AdminThresholdPage

**File:** `frontend/src/pages/AdminThresholdPage.tsx`
**Route:** `/admin/threshold`
**Purpose:** View, edit, and activate threshold configuration versions (confidence thresholds, score band breakpoints, disclaimer text).

### State
- `items: ThresholdConfig[]` — from `fetchThresholdConfigs()`
- `selected: ThresholdConfig | null` — currently editing
- `form: Partial<ThresholdConfig>` — fields: `minConfidenceToDisplayMetric`, `minConfidenceToShowGlobalScore`, `scoreBandNoNumberMax`, `scoreBandRefineMax`, `scoreBandGoodMax`, `disclaimerTextSnapshot`
- `isSaving / msg`

### API Calls
- `fetchThresholdConfigs()` — on mount
- `updateThresholdConfig(version, form)` — on save
- `activateThresholdConfig(version)` — on activate (confirms via `window.confirm`)
