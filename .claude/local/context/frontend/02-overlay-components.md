---
tenant_id: "face-before-after-frontend"
project: "face-before-after-frontend"
module: "frontend/overlay-components"
file_path: ".claude/local/context/frontend/02-overlay-components.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Documents all SVG overlay components used in PremiumResultPage: AsymmetryAnalysisLayer, BeforeIdealOverlay, IdealProportionsLayer, MetricsMapLayer, OverlayLayer (with HeatmapImageLayer and toggle bars), and OverlaySidebar. All components render as absolutely-positioned SVG or img elements over a face photo; landmark coordinates are in MediaPipe Mesh-478 natural-image pixel space.
tags:
  - "frontend"
  - "overlay"
  - "svg"
  - "landmarks"
depends_on: ["frontend/overlay-system", "frontend/data-flow"]
used_by: []
---

# Overlay Components — RAG Documentation

## AsymmetryAnalysisLayer

**File:** `frontend/src/components/AsymmetryAnalysisLayer.tsx`
**Purpose:** SVG overlay rendering facial asymmetry reference lines and deviation annotations over the canonical face image.

### Props Interface (`AsymmetryAnalysisLayerProps`)
```ts
viewBoxWidth: number           // natural image width (px)
viewBoxHeight: number          // natural image height (px)
landmarks?: Array<[number, number]>  // MediaPipe Mesh-478 raw pixel coords
data: AsymmetryAnalysisData    // backend-computed asymmetry data
selectedPoint?: string | null  // label of selected deviation point
onSelectPoint?: (label: string) => void
activeOverlays?: string[]      // subset toggle keys
```

### `AsymmetryAnalysisData` structure
- `frankfort_horizontal: { y, eye_left: {x,y}, eye_right: {x,y} }` — Frankfort plane y-coordinate
- `facial_midline: { x_top, y_top, x_bottom, y_bottom }` — facial symmetry midline
- `deviations: Array<{ label, landmark_idx, x, y, midline_x, deviation_px }>` — per-landmark asymmetry
- `overall_asymmetry_score?: number | null` — raw pixel score
- `overall_asymmetry_score_pct_ipd?: number | null` — score as % of interpupillary distance

### What it renders (SVG, `zIndex: 18`)
Controlled by `activeOverlays` subset keys:
- `"asymmetry_points"` — green dots at each landmark, red lines + dots for each deviation with label
- `"asymmetry_frankfort"` — yellow dashed horizontal line + eye anchor dots labeled "Frankfort Horizontal"
- `"asymmetry_midline"` — blue vertical midline labeled "Facial Midline"
- `"asymmetry_scores"` — top-left summary box with raw score and % IPD

Stroke and font sizes scale proportionally with `viewBoxWidth`.

### Key event handlers
- `onClick` on each deviation `<g>` calls `onSelectPoint(label)` — selected point renders at larger radius and thicker stroke.

### Connection to overlay system
Rendered in `PremiumResultPage` "landmarks" view when `result.overlay_annotations.asymmetry_analysis` is present; `activeOverlays` comes from `activeLandmarkOverlays` state toggled via `LandmarkToggleBar`.

---

## BeforeIdealOverlay

**File:** `frontend/src/components/BeforeIdealOverlay.tsx`
**Purpose:** Renders per-metric improvement vectors as colored SVG arrows over the before-ideal composition image (PR-43, M3.4).

### Props Interface (`BeforeIdealOverlayProps`)
```ts
landmarks: Array<[number, number]>     // MediaPipe Mesh-478, must have ≥ 478 entries
imageWidth: number                     // rendered (CSS) width — SVG element size
imageHeight: number                    // rendered (CSS) height
viewBoxWidth?: number                  // natural image width for viewBox (defaults to imageWidth)
viewBoxHeight?: number                 // natural image height
metricEvaluations?: MetricEvaluationResult[]
```

### What it renders (SVG, `pointerEvents: none`)
For each `MetricEvaluationResult` with a non-null `anchor_landmark_index`, non-null `improvement_vector_x/y`, and `severity_5 !== "ideal"`:
- Arrow from `landmarks[anchor_landmark_index]` pointing to `(sx + dx_icu * icdPx, sy + dy_icu * icdPx)`
- Color determined by `severity_5`: `mild=#22c55e`, `moderate=#eab308`, `strong=#f97316`, `extreme=#ef4444`
- Arrowhead: triangle polygon computed from unit direction vector (ARROW_SIZE=9px, WING_W=4px)

ICU (Intercanthal Unit) vectors are scaled by the pixel distance between landmarks 133 (left eye inner, `P_LEFT_EYE_INNER`) and 362 (right eye inner, `P_RIGHT_EYE_INNER`).

Returns `null` when `landmarks.length < 478` or no metric evaluations supplied.

### Connection to overlay system
Rendered in `PremiumResultPage` "before_ideal" view on top of the composition PNG fetched from `POST /v1/vision/compose-before-ideal`. The background PNG already contains guide lines; this overlay adds the interactive improvement arrows on top.

---

## IdealProportionsLayer

**File:** `frontend/src/components/IdealProportionsLayer.tsx`
**Purpose:** Interactive SVG overlay showing colored zone rectangles for ideal facial proportion metrics (forehead, upper/middle/lower thirds) with severity-coded borders.

### Props Interface (`IdealProportionsLayerProps`)
```ts
viewBoxWidth: number
viewBoxHeight: number
landmarks: Array<[number, number]>   // MediaPipe Mesh-478
rows: IdealRow[]                     // { metric_id?, value?, severity_5?, direction? }[]
overlay_zones?: { zones: BackendZone[] } | null  // backend-computed zone rects (preferred)
selectedMetricId?: string | null
onSelectMetric?: (metricId: string) => void
```

### What it renders (SVG, `zIndex: 18`)
Four zone rectangles keyed by `metricId`:
- `forehead_height_ratio` — "Testa"
- `upper_third_ratio` — "Terco superior"
- `middle_third_ratio` — "Terco medio"
- `lower_third_ratio` — "Terco inferior"

Each rectangle:
- Stroke color from `SEVERITY_STROKE`: `ideal/mild=#22c55e`, `moderate=#eab308`, `strong=#f97316`, `extreme=#ef4444`
- Selected: solid border + translucent fill; unselected: dashed border
- Label text above the rectangle

### Zone geometry priority
1. `overlay_zones.zones` from backend (absolute pixel rects `{x, y, w, h}`)
2. Fallback: `createAnatomicalZones(landmarks, vbW, vbH)` — derives zones from landmark indices: `P_SUBNASALE=2`, `P_MENTON=152`, `P_BROW_LEFT_INNER=107`, `P_BROW_RIGHT_INNER=336`, `P_ZYGO_LEFT=234`, `P_ZYGO_RIGHT=454`, and `LM_FOREHEAD_RIDGE` array

Returns `null` if no zone geometry can be derived.

### Connection to overlay system
Rendered in `PremiumResultPage` "ideal" view when `result.overlay_annotations.ideal_proportions` is present. `onSelectMetric` updates `selectedIdealMetric` state in the page, which also controls `OverlaySidebar` highlighting.

---

## MetricsMapLayer

**File:** `frontend/src/components/MetricsMapLayer.tsx`
**Purpose:** Interactive SVG heatmap of facial regions colored by metric adherence (0–100%); supports click-to-select and active-metric filtering.

### Props Interface (`MetricsMapLayerProps`)
```ts
viewBoxWidth: number
viewBoxHeight: number
metric_evaluations: MetricEvaluationResult[]
region_adherence: RegionAdherence[] | Record<string, number>  // normalized; both array and object forms supported
overlay_metrics_map?: { regions: MetricsMapRegion[] }  // backend-computed bounds (preferred)
onRegionClick?: (region: string) => void
selectedRegion?: string | null
selectedMetrics?: string[] | null  // when set, dims regions with no matching metrics
```

### What it renders (SVG, `zIndex: 25`)
For each region present in `adherence_map`:
- Translucent colored `<rect>` over region bounds; opacity scales with adherence
- `REGION_LABEL` text: FOREHEAD="Testa", EYES="Olhos", NOSE="Nariz", MOUTH="Boca", JAW="Mandíbula", CHEEKBONES="Maçãs do rosto", SYMMETRY="Simetria", BROWS="Sobrancelhas", GLOBAL="Global"
- Metric count sub-label; adherence % label when selected
- Color: `≥0.9 → #10b981 (green)`, `0.7–0.9 → #f59e0b (amber)`, `<0.7 → #ef4444 (red)`
- Legend box in top-right corner

### Region bounds priority
1. `overlay_metrics_map.regions[].bounds` from backend
2. `REGION_BOUNDS_FALLBACK` — hardcoded rects calibrated for 1200×800 canonical image space

### Key state (internal via `useMemo`)
- `adherenceMap` — normalized region key → adherence value (keys uppercased)
- `metricsByRegion` — count of metrics per region
- `metricIdsByRegion` — Set of metric_ids per region (for `selectedMetrics` filter)

### Connection to overlay system
Rendered in `PremiumResultPage` in two positions:
1. "landmarks" view — always when `activeLandmarkOverlays.includes("metrics_regions")` and metric evaluations exist
2. "overlays" view — only when `activeOverlays.includes("heatmap_ideal_adherence")`

---

## OverlayLayer

**File:** `frontend/src/components/OverlayLayer.tsx`
**Purpose:** SVG geometric overlay renderer for the "overlays" view. Draws facial reference lines (axis, thirds, fifths, face extents, face contour) and improvement-vector arrows over a face photo using MediaPipe Mesh-478 landmark coordinates.

### Props Interface (`OverlayLayerProps`)
```ts
landmarks: Array<[number, number]>   // MediaPipe Mesh-478
imageWidth: number                   // rendered (CSS) width — SVG element size
imageHeight: number                  // rendered (CSS) height
viewBoxWidth?: number                // natural width for SVG viewBox (landmark space)
viewBoxHeight?: number               // natural height
activeOverlays: string[]             // overlay IDs to render
metricEvaluations?: MetricEvaluationResult[]  // for improvement_vectors
trichion_source?: "bisenet" | "mesh" // labels the FaceExtents trichion point
```

### Overlay IDs and what each renders
| ID | Renders |
|---|---|
| `axis_vertical` | Vertical line nose_tip → menton (cyan dashed) |
| `axis_intercanthal` | Horizontal line between inner eye canthi (cyan solid) |
| `grid_thirds` | Three horizontal dashed lines dividing forehead/mid/lower thirds (indigo dashed) |
| `grid_fifths` | Five vertical dashed lines dividing face width (indigo dashed) |
| `outline_face` | Closed polygon from `LM_JAWLINE` (37 landmark indices) forming the face contour |
| `face_extents` | Bounding box from trichion (lm[10] or BiSeNet) to menton, bizygomatic width |
| `improvement_vectors` | Per-metric colored arrows from `anchor_landmark_index` along improvement vector |
| `heatmap_asymmetry` / `heatmap_ideal_adherence` | No SVG — these are rendered by `HeatmapImageLayer` |

### Exported constants
- `DEFAULT_OVERLAYS` — `["axis_vertical", "axis_intercanthal", "outline_face", "face_extents", "grid_thirds", "improvement_vectors"]`
- `DEFAULT_LANDMARKS_OVERLAYS` — (defined in same file, used by LandmarkToggleBar)

### HeatmapImageLayer (exported from same file)

**Props:** `imageWidth`, `imageHeight`, `activeOverlays`, `heatmapAssetUrls: Record<string, string>`

Renders the first active heatmap overlay ID as an absolutely-positioned `<img>` element. The PNG URL is a blob URL created from `POST /v1/vision/render-overlay`. `zIndex` in the component is absolute (z=30 per DEC-25), sitting below SVG lines.

### OverlayToggleBar and LandmarkToggleBar (exported from same file)
Toggle buttons for overlay IDs. `OverlayToggleBar` renders all overlay IDs from `OVERLAY_LABELS`; `LandmarkToggleBar` renders the landmark-specific overlays. Both call an `onToggle(id)` callback.

### Connection to overlay system
Rendered in `PremiumResultPage` "overlays" view inside an `overlay-media` div alongside `HeatmapImageLayer` and `MetricsMapLayer`. Sidebar (`OverlaySidebar`) renders alongside for textual data.

---

## OverlaySidebar

**File:** `frontend/src/components/OverlaySidebar.tsx`
**Purpose:** Text panel rendered beside SVG overlays providing data tables and labels that replace text formerly burned into PNG exports.

### Props Interface
```ts
variant: "grid_thirds" | "grid_fifths" | "face_extents" | "ideal_proportions" | "metrics_map"
data: NonNullable<AnalysisResult["overlay_annotations"]>
selectedKey?: string | null
onSelectKey?: (key: string) => void
regionAdherence?: Array<{ region: string; adherence: number; confidence: number }>
metricEvaluations?: MetricEvaluationResult[]
```

### What each variant renders

**`grid_thirds`** — reads `data.grid_thirds.rows` (each row: `id`, `label`, `pct`, `deviation_pct`, `severity_5`); rows color-coded by severity (`SEVERITY_BG/FG`). Footer shows ideal % reference (Farkas 1994).

**`grid_fifths`** — reads `data.grid_fifths.rows` (each row: `id`, `deviation_px`); shows signed pixel deviation per fifth column.

**`face_extents`** — reads `data.face_extents`: `trichion_label`, `menton_label`, `face_height_px`, `face_width_px`, optional `legend`.

**`ideal_proportions`** — reads `data.ideal_proportions` (array of `{ metric_id?, value?, severity_5?, direction? }`); each row clickable, maps metric_id to `IDEAL_PROPORTION_LABELS` (`forehead_height_ratio`, `lower_third_ratio`, `middle_third_ratio`, `upper_third_ratio`). Selected row highlighted with colored border.

**`metrics_map`** — renders region rows from `regionAdherence` sorted by `REGION_ORDER`; adherence % and confidence shown per row; sub-rows show individual `MetricEvaluationResult` entries with `deviation_normalized` in σ units. All rows clickable for cross-selection with `MetricsMapLayer`.

### Connection to overlay system
Rendered by `PremiumResultPage` in the `overlay-sidebars` div alongside the image area. For `ideal_proportions`, `selectedKey` and `onSelectKey` sync with `selectedIdealMetric` state to cross-highlight `IdealProportionsLayer`. For `metrics_map`, `selectedKey` syncs with `selectedRegion` to cross-highlight `MetricsMapLayer`.
