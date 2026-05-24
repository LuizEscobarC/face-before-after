---
tenant_id: "face-before-after-frontend"
project: "face-before-after-frontend"
module: "frontend/ui-components"
file_path: ".claude/local/context/frontend/03-ui-components.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Documents seven reusable UI components: MetricExplainer (expandable metric detail with glossary), PhotoQualityCard (photo validation result with subscores), PoseIndicator (yaw/pitch/roll badges), SubscoreBar (labeled progress bar), FlagChips (beard/glasses/smile chips), CaptureSourceTabs (upload/webcam switcher with real-time MediaPipe feedback), and ConsistencyWarning (alert for before/after photo consistency issues).
tags:
  - "frontend"
  - "ui-components"
  - "capture"
  - "quality"
depends_on: ["frontend/data-flow"]
used_by: []
---

# UI Components — RAG Documentation

## MetricExplainer

**File:** `frontend/src/components/MetricExplainer.tsx`
**Purpose:** Expandable `<details>` accordion showing a facial metric's value, severity, and three-layer educational content from the glossary.

### Props
```ts
metricKey: string           // e.g. "fwhr", "canthal_tilt_mean_deg"
label: string               // display label, e.g. "Razão facial (fWHR)"
value: string               // formatted numeric string, e.g. "1.82"
unit?: string               // e.g. "razão", "°"
ideal?: string              // e.g. "~1.85"
severity?: string           // free-text: "leve", "excelente", "moderada", etc.
glossary?: Record<string, GlossaryTerm>  // keyed by metric_id
```

### What it renders
A `<details class="metric-explainer">` with:
- **Summary row:** label, value+unit, severity pill (CSS class via `severityClass(severity)`: `sev-excelente`, `sev-leve`, `sev-moderada`, `sev-acentuada`, `sev-severa`, `sev-info`), toggle arrow
- **Body:** up to three nested `<details>` layers (only rendered when glossary term exists):
  1. `glossary[metricKey].feynman` — "Em palavras simples" (open by default)
  2. `glossary[metricKey].como_medido` + `ideal` — "Como medimos"
  3. `glossary[metricKey].faixas` + `problemas_comuns[]` + `referencias[]` — "Faixas e problemas comuns"
- Falls back to a muted "sem explicação detalhada" message when no glossary term exists.

### When it's used
- `PremiumResultPage` — "Perfil Facial Detalhado" section (9 measurements from `result.measurements`)
- `PremiumResultPage` — "Métricas Completas" catalog via `MetricsCategory` sub-component
- `PremiumResultPage` — "Glossário" section (iterates all glossary entries)

---

## PhotoQualityCard

**File:** `frontend/src/components/PhotoQualityCard.tsx`
**Purpose:** Card component displaying the result of the photo quality validation gate (`PhotoQualityDecision`) before analysis submission.

### Props
```ts
decision: PhotoQualityDecision  // from api.validatePhotoQuality
onContinue?: () => void         // shown only when decision !== "REJECT"
onRetake?: () => void           // always shown when provided
```

### `PhotoQualityDecision` fields used
- `decision: "ACCEPT" | "WARN" | "REJECT"` — determines palette color
- `grade: "ALTA" | "MEDIA" | "BAIXA" | "REJEITADA"` — shown in heading
- `quality_score: number` (0–1) — multiplied by 100 for conic-gradient ring
- `recommendations: string[]` — improvement tips list
- `subscore_breakdown.pose_score / sharpness_score / lighting_score / occlusion_score / expression_score` — each rendered as `SubscoreBar`
- `pose: { yaw, pitch, roll }` — rendered as `PoseIndicator`
- `flags: { beard?, beard_density?, glasses?, smile? }` — rendered as `FlagChips`

### What it renders
- Decision badge (pill with color from `COLORS` map: cyan=ACCEPT, amber=WARN, red=REJECT)
- Title: `GRADE_LABEL[grade]` + score `/100`
- Conic-gradient circle showing score %
- Improvement recommendations list (when non-empty)
- Grid of 5 `SubscoreBar` components (Pose, Nitidez, Iluminação, Oclusão, Expressão)
- `PoseIndicator` for yaw/pitch/roll
- `FlagChips` for detected facial features
- Footer: "Refazer captura" button (always) and "Continuar análise" button (when ACCEPT or WARN)

### When it's used
`CapturePage` — shown after `validatePhotoQuality` resolves in the capture panel.

---

## PoseIndicator

**File:** `frontend/src/components/PoseIndicator.tsx`
**Purpose:** Renders three color-coded pill badges for head pose angles (yaw, pitch, roll).

### Props
```ts
pose: { yaw: number; pitch: number; roll: number }  // degrees
```

### What it renders
Three inline pills inside a surface2 card:
- Each shows axis label (`Yaw`, `Pitch`, `Roll`) + signed degree value, e.g. `Yaw +3.5°`
- Color from `axisColor(value, limit)`:
  - `abs ≤ 40% of limit` → `var(--accent2)` (cyan, good)
  - `abs ≤ 75% of limit` → `#fcd34d` (amber, warn)
  - `else` → `#fca5a5` (red, bad)
- Axis limits: `yaw=20°`, `pitch=20°`, `roll=15°`

### When it's used
Inside `PhotoQualityCard` as part of the per-capture quality breakdown.

---

## SubscoreBar

**File:** `frontend/src/components/SubscoreBar.tsx`
**Purpose:** Labeled horizontal progress bar for a 0–1 subscore value.

### Props
```ts
label: string    // e.g. "Pose", "Nitidez", "Iluminação"
value?: number   // 0–1; defaults to 0 if undefined
```

### What it renders
A surface2 card with:
- Header row: uppercase label (muted) + numeric value (0–100 integer, bold)
- Progress bar at 6px height using `barColor(value)`:
  - `≥0.75` → `BAR_COLORS.good`: fg=`var(--accent2)`, bg=`rgba(34,211,238,0.15)`
  - `≥0.45` → `BAR_COLORS.warn`: fg=`#fcd34d`, bg=`rgba(252,211,77,0.12)`
  - else → `BAR_COLORS.bad`: fg=`#fca5a5`, bg=`rgba(252,165,165,0.12)`
- Bar fill animates via `transition: width 0.4s ease`

### When it's used
Inside `PhotoQualityCard` — five instances for pose, sharpness, lighting, occlusion, expression subscores.

---

## FlagChips

**File:** `frontend/src/components/FlagChips.tsx`
**Purpose:** Renders one pill chip per detected facial attribute flag.

### Props
```ts
flags: {
  beard?: boolean
  beard_density?: number  // 0–1; shown as % when beard is true
  glasses?: boolean
  smile?: boolean
}
```

### What it renders
A flex-wrap container with colored pill spans for each active flag:
- Beard: violet (`#a78bfa`), shows density % when `beard_density` is present
- Glasses: `var(--accent2)` (cyan)
- Smile: `#fcd34d` (amber)

Returns `null` when no flags are active.

### When it's used
Inside `PhotoQualityCard` to surface face-attribute detections that may affect analysis reliability.

---

## CaptureSourceTabs

**File:** `frontend/src/components/CaptureSourceTabs.tsx`
**Purpose:** Tab widget that switches between file upload and live webcam capture; includes real-time MediaPipe pose feedback during webcam session.

### Props
```ts
onPhotoReady: (file: File, previewUrl: string) => void  // emitted when photo is ready
busy?: boolean       // disables all interactions during submit
currentFile?: File | null  // controls preview image display
```

### State
- `activeTab: "upload" | "webcam"` — active tab
- `stream: MediaStream | null` — camera stream
- `cameraOn: boolean` — camera is active
- `cameraError / uploadError: string` — error messages
- `previewUrl: string` — object URL of selected/captured file
- `feedback: RealtimeFeedback | null` — live pose detection result
- `clientProcessing: boolean` — MediaPipe processing in-flight

### Key behaviors

**Upload tab:** `<input type="file" accept="image/png,image/jpeg" capture="user">` — on change calls `validateAndEmit(file)` which checks MIME type then calls `onPhotoReady(file, url)`.

**Webcam tab:**
- Opens `navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", 1280×720 } })` via `openCamera()`
- Maps `MediaError.name` to user-friendly strings via `describeMediaError`
- Real-time feedback loop: runs every 5 animation frames, reads `videoRef` into an offscreen canvas, calls `processorRef.current.validateRealtimeFeedback(imageData)` → `RealtimeFeedback`; status indicator dot shown (cyan=OK, red=not OK)
- `captureFromCamera()`: draws video to canvas (non-mirrored for correct anatomical orientation), creates JPEG `File`; if `ClientPhotoProcessor` is ready, runs `runMediaPipe(imageData)` and calls `submitLandmarkPayload(payload)` before emitting `onPhotoReady`
- `closeCamera()`: stops all media stream tracks

**Client-side MediaPipe initialization:**
- On webcam tab open: `DeviceCapabilityDetector.shouldFallback()` → if false, `ClientPhotoProcessor.create()` initializes the processor
- On tab change / unmount: processor is disposed

### Webcam UI
- SVG guide overlay showing 3:4 face frame with eye-level guide line
- Feedback ring indicator (top-right of video)
- "Capturar" and "Fechar câmera" action buttons
- Preview `<figure>` shown below tabs when `currentFile` is set

### When it's used
`CapturePage` — in the upload/webcam panel for free and premium modes (not compare mode).

---

## ConsistencyWarning

**File:** `frontend/src/components/ConsistencyWarning.tsx`
**Purpose:** Alert banner surfacing photo consistency issues in before/after comparisons.

### Props
```ts
consistency_score: number     // 0–1
consistency_issues: string[]  // list of issue strings
is_comparable: boolean        // false → red, true → yellow
```

### What it renders
A `role="alert"` div with:
- Title: `"Consistência parcial (N%) — comparação válida, mas com ressalvas"` (yellow, `is_comparable=true`) or `"Baixa consistência (N%) — condições muito diferentes entre as fotos"` (red, `is_comparable=false`)
- Unordered list of `consistency_issues` in muted text

Returns `null` when `is_comparable=true` AND `consistency_issues` is empty — i.e. suppressed for clean comparisons.

### When it's used
`CompareResultPage` — shown when `compareResult.consistency_score` is present, above the improvements/regressions sections.
