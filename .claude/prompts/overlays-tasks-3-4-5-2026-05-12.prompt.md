---
title: "Task 3-5: Interactive Overlay Controls — Before-Ideal Toggle, Ideal SVG, Metrics Map"
date: 2026-05-12
module: frontend + nest + backend
type: feature
slug: overlays-tasks-3-4-5
recommended_model: opus
---

# Task 3-5: Interactive Overlay Controls

**Phase:** M3 Overlays  
**Status:** In progress — Phase C, D, E (from plan)  
**Blocking:** All subsequent overlay UX work  

---

## USER REQUEST SUMMARY

Implement 3 interconnected features to complete the interactive overlay stack:

1. **Task 3:** Fix before-ideal toggle controls — frontend state + backend passthrough
2. **Task 4:** Create interactive Ideal Wireframe SVG layer (cyan dashed lines, clickable points)
3. **Task 5:** Create interactive Metrics Map SVG layer (region-based heatmap + sidebar sync)

All tasks depend on **stable toggle behavior** (Task 3) before SVG layers can be tested.

---

## CONTEXT INJECTION: Face Analysis Architecture

### Stack

```
Frontend (React/TS Vite) → NestJS API → Python backend
                              ↓
                        PostgreSQL :9019 (face_analysis)
```

### Key Endpoints

| Endpoint | Purpose | Request | Response |
|----------|---------|---------|----------|
| `POST /v1/vision/compose-before-ideal` | Generate before-ideal comparison image | `{ landmarks_before, landmarks_ideal, offsets, showGuideLines, showActualWireframe }` | `{ composed_image: base64, overlay_annotations: JSON }` |
| `POST /v1/vision/render-overlay` | Render SVG overlays on canonical image | `{ metric_evaluations, region_adherence, view }` | `{ heatmap_image: base64 }` |
| `GET /v1/vision/results/{runId}/*` | Fetch cached result images | — | `image/jpeg` |

### SVG Coordinate System

**Critical:** All SVG overlays operate in **viewBox space** (natural pixels), not CSS render space.

```tsx
// Canonical image: 1200×800 px natural size
// CSS display: 600×400 px (scaled 50%)
// SVG viewBox: "0 0 1200 800" (natural coordinates)

// CORRECT endpoint usage:
<svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} width="100%" height="100%">
  <line x1={xCoord} y1={0} x2={xCoord} y2={viewBoxHeight} />  // Use viewBox dims
</svg>
```

**All line/polygon endpoints MUST use viewBox dimensions**, not CSS pixel dimensions.

### Landmark Indices (MediaPipe-478)

Key indices for overlay layer calculations:

| Reference | Landmark | Index |
|-----------|----------|-------|
| Eye outer left | P_EYE_OUTER_IMG_LEFT | 33 |
| Eye inner left | P_LEFT_EYE_INNER | 133 |
| Eye inner right | P_RIGHT_EYE_INNER | 362 |
| Eye outer right | P_EYE_OUTER_IMG_RIGHT | 263 |
| Zygomatic left | P_ZYGO_IMG_LEFT | 234 |
| Zygomatic right | P_ZYGO_IMG_RIGHT | 454 |
| Nasion (bridge of nose) | P_NOSE_BRIDGE | 6 |
| Nose tip | P_NOSE_TIP | 4 |
| Lips: outer left | P_LIP_LEFT | 61 |
| Lips: outer right | P_LIP_RIGHT | 291 |

### Data Flow: Before-Ideal Composition

```
PremiumResultPage (React state)
  ├─ showGuideLines: boolean
  ├─ showActualWireframe: boolean
  └─ offsets: { dx, dy } (user adjustment)
          │
          ▼
fetchCompose() ──► POST /v1/vision/compose-before-ideal
          │
          ├─► NestJS vision.controller ──► FormData multipart
          │       │
          │       └──► vision.client ──► Python backend
          │
          └─► backend/app/vision/services/before_ideal_composer.py
                  │
                  ├─ Draw before image (canonical + wireframe)
                  ├─ Draw ideal image (landmarks_ideal + wireframe)
                  ├─ Apply overlays (showGuideLines, showActualWireframe)
                  └─ Compose side-by-side or offset
          │
          ▼
Response: { composed_image: base64, overlay_annotations: JSON }
          │
          ▼
PremiumResultPage renders in <OverlayLayer>
```

### Data Flow: Metrics Map Layer

```
Metrics Result (backend computed)
  ├─ metric_evaluations: [{ metric_id, value, confidence, direction, region }]
  └─ region_adherence: { region_id: adherence_scalar }
          │
          ▼
PremiumResultPage receives via API
          │
          ├─► MetricsMapLayer.tsx (new component)
          │   ├─ Renders heatmap regions (color by region_adherence)
          │   ├─ Overlay metric labels (color by severity)
          │   └─ Clickable regions (highlight on click)
          │
          └─► OverlaySidebar.tsx
              ├─ Mirrors selection state
              └─ Show metric details on click
```

---

## IMPLEMENTATION GUIDE

### Task 3: Fix Before-Ideal Toggle Controls

**Objective:** Ensure frontend state changes (`showGuideLines`, `showActualWireframe`) trigger image re-composition.

#### Frontend (PremiumResultPage.tsx)

1. **Verify existing state exists:**
   ```tsx
   const [showGuideLines, setShowGuideLines] = useState(true);
   const [showActualWireframe, setShowActualWireframe] = useState(true);
   const [offsets, setOffsets] = useState({ dx: 0, dy: 0 });
   ```

2. **Create fetchCompose() function** (if not present):
   ```tsx
   const fetchCompose = useCallback(async () => {
     if (!result?.landmarks_before || !result?.landmarks_ideal) return;
     
     const response = await fetch(`/v1/vision/compose-before-ideal`, {
       method: 'POST',
       body: JSON.stringify({
         landmarks_before: result.landmarks_before,
         landmarks_ideal: result.landmarks_ideal,
         offsets,
         showGuideLines,
         showActualWireframe,
       }),
       headers: { 'Content-Type': 'application/json' },
     });
     
     const data = await response.json();
     setComposedImage(data.composed_image);
     setOverlayAnnotations(data.overlay_annotations);
   }, [result, offsets, showGuideLines, showActualWireframe]);
   ```

3. **Trigger on state change:**
   ```tsx
   useEffect(() => {
     if (view === 'before-ideal') {
       fetchCompose();
     }
   }, [showGuideLines, showActualWireframe, offsets, view, fetchCompose]);
   ```

4. **Verify toggles exist in JSX:**
   ```tsx
   <label>
     <input 
       type="checkbox" 
       checked={showGuideLines} 
       onChange={(e) => setShowGuideLines(e.target.checked)} 
     />
     Show Guide Lines
   </label>
   <label>
     <input 
       type="checkbox" 
       checked={showActualWireframe} 
       onChange={(e) => setShowActualWireframe(e.target.checked)} 
     />
     Show Actual Wireframe
   </label>
   ```

#### Backend Validation (NestJS → Python)

1. **NestJS controller (nest/src/modules/vision/vision.controller.ts):**
   ```typescript
   @Post('compose-before-ideal')
   async composeBeforeIdeal(@Body() body: {
     landmarks_before: number[][];
     landmarks_ideal: number[][];
     offsets: { dx: number; dy: number };
     showGuideLines: boolean;
     showActualWireframe: boolean;
   }) {
     // Forward to Python backend (multipart or JSON)
     return this.visionClient.composeBeforeIdeal(body);
   }
   ```

2. **Vision client (nest/src/modules/vision/vision.client.ts):**
   - Ensure `composBeforeIdeal()` forwards **all fields** to Python (including flags)
   - Check multipart encoding if using FormData

3. **Python endpoint (backend/app/vision/routers/compose.py or services/before_ideal_composer.py):**
   ```python
   @router.post('/compose-before-ideal')
   def compose_before_ideal(
       landmarks_before: list,
       landmarks_ideal: list,
       offsets: dict,
       showGuideLines: bool = True,
       showActualWireframe: bool = True,
   ):
       # Render before image
       if showActualWireframe:
           draw_wireframe(before_canvas, landmarks_before)
       if showGuideLines:
           draw_guide_lines(before_canvas)
       
       # Similar for ideal image
       # Return composed result
       return {
           'composed_image': base64_image,
           'overlay_annotations': {...}
       }
   ```

#### Testing (Playwright)

Add E2E check in `scripts/playwright-overlays-e2e.mjs`:
```javascript
test('Toggle showGuideLines and showActualWireframe regenerates image', async ({ page }) => {
  // Navigate to before-ideal view
  await page.locator('[data-testid="toggle-guidelines"]').click();
  await page.waitForTimeout(500);
  
  // Capture image after first toggle
  const screenshot1 = await page.locator('[data-testid="composed-image"]').screenshot();
  
  // Toggle again
  await page.locator('[data-testid="toggle-wireframe"]').click();
  await page.waitForTimeout(500);
  
  // Verify image changed
  const screenshot2 = await page.locator('[data-testid="composed-image"]').screenshot();
  expect(screenshot1).not.toEqual(screenshot2);
});
```

---

### Task 4: Ideal SVG Layer Interactive

**Objective:** Create a new React component that renders SVG wireframe of ideal proportions, overlaid on the canonical image.

#### Frontend: Create IdealWireframe.tsx

```tsx
// frontend/src/components/IdealWireframe.tsx

import React, { useMemo } from 'react';

interface IdealWireframeProps {
  viewBoxWidth: number;
  viewBoxHeight: number;
  landmarks_ideal: number[][];
  onPointClick?: (landmarkIndex: number, name: string) => void;
  selectedPoint?: number | null;
}

export const IdealWireframe: React.FC<IdealWireframeProps> = ({
  viewBoxWidth,
  viewBoxHeight,
  landmarks_ideal,
  onPointClick,
  selectedPoint,
}) => {
  const keyLines = useMemo(() => {
    // Draw cyan dashed lines connecting ideal proportions
    // Example: connect eyes, nose, mouth, jawline in sequence
    
    const [leftEyeOuter, leftEyeInner, rightEyeInner, rightEyeOuter] = [33, 133, 362, 263]
      .map(idx => landmarks_ideal[idx] || [0, 0]);
    
    const [noseTip, nasion] = [4, 6].map(idx => landmarks_ideal[idx] || [0, 0]);
    const [lipLeft, lipRight] = [61, 291].map(idx => landmarks_ideal[idx] || [0, 0]);
    
    return [
      // Eyes line (horizontal)
      { p1: leftEyeOuter, p2: rightEyeOuter, label: 'Eye Line' },
      // Vertical centerline
      { p1: nasion, p2: noseTip, label: 'Nasion-Tip' },
      // Lips line
      { p1: lipLeft, p2: lipRight, label: 'Lip Line' },
    ];
  }, [landmarks_ideal]);

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto' }}
    >
      {/* Dashed guide lines */}
      {keyLines.map((line, i) => (
        <line
          key={`line-${i}`}
          x1={line.p1[0]}
          y1={line.p1[1]}
          x2={line.p2[0]}
          y2={line.p2[1]}
          stroke="#22d3ee"
          strokeWidth={2}
          strokeDasharray="4,4"
          opacity={0.7}
        />
      ))}

      {/* Clickable points */}
      {landmarks_ideal.map((pt, idx) => (
        <circle
          key={`pt-${idx}`}
          cx={pt[0]}
          cy={pt[1]}
          r={4}
          fill={selectedPoint === idx ? '#22d3ee' : 'transparent'}
          stroke="#22d3ee"
          strokeWidth={1}
          opacity={0.5}
          style={{ cursor: 'pointer' }}
          onClick={() => onPointClick?.(idx, `LM_${idx}`)}
        />
      ))}
    </svg>
  );
};
```

#### Integration in PremiumResultPage.tsx

```tsx
{view === 'ideal' && (
  <div className="overlay-stage" style={{ position: 'relative' }}>
    <img src={canonicalImage} alt="Canonical" />
    <IdealWireframe
      viewBoxWidth={viewBoxWidth}
      viewBoxHeight={viewBoxHeight}
      landmarks_ideal={result.landmarks_ideal}
      onPointClick={(idx, name) => {
        setSelectedIdealPoint(idx);
        setPointDetail(name);
      }}
      selectedPoint={selectedIdealPoint}
    />
  </div>
)}
```

#### Card Explicador

When user clicks a point:
```tsx
{selectedIdealPoint !== null && (
  <card className="ideal-point-detail">
    <h4>Ideal Landmark #{selectedIdealPoint}</h4>
    <p>Position: ({landmarks_ideal[selectedIdealPoint][0].toFixed(1)}, {landmarks_ideal[selectedIdealPoint][1].toFixed(1)})</p>
    <p>Description: {getLandmarkDescription(selectedIdealPoint)}</p>
  </card>
)}
```

---

### Task 5: Metrics SVG Map Interactive

**Objective:** Create MetricsMapLayer.tsx that renders region-based heatmap + sidebar sync.

#### Frontend: Create MetricsMapLayer.tsx

```tsx
// frontend/src/components/MetricsMapLayer.tsx

import React, { useMemo } from 'react';

interface MetricsMapLayerProps {
  viewBoxWidth: number;
  viewBoxHeight: number;
  metric_evaluations: Array<{
    metric_id: string;
    value: number;
    confidence: number;
    direction: string;
    region?: string; // e.g., 'FOREHEAD', 'EYES', 'NOSE', 'MOUTH', 'JAW'
  }>;
  region_adherence: Record<string, number>; // { FOREHEAD: 0.85, EYES: 0.92, ... }
  onRegionClick?: (region: string) => void;
  selectedRegion?: string | null;
}

interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const REGION_BOUNDS: Record<string, RegionBounds> = {
  FOREHEAD: { x: 200, y: 50, width: 800, height: 200 },
  EYES: { x: 300, y: 200, width: 600, height: 150 },
  NOSE: { x: 400, y: 320, width: 400, height: 150 },
  MOUTH: { x: 350, y: 470, width: 500, height: 120 },
  JAW: { x: 200, y: 550, width: 800, height: 150 },
};

const adherenceToColor = (adherence: number): string => {
  if (adherence >= 0.9) return '#10b981';  // Green
  if (adherence >= 0.7) return '#f59e0b';  // Amber
  return '#ef4444';  // Red
};

export const MetricsMapLayer: React.FC<MetricsMapLayerProps> = ({
  viewBoxWidth,
  viewBoxHeight,
  metric_evaluations,
  region_adherence,
  onRegionClick,
  selectedRegion,
}) => {
  const regionMetricCount = useMemo(() => {
    const count: Record<string, number> = {};
    metric_evaluations.forEach(m => {
      if (m.region) {
        count[m.region] = (count[m.region] || 0) + 1;
      }
    });
    return count;
  }, [metric_evaluations]);

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      width="100%"
      height="100%"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'auto' }}
    >
      {Object.entries(REGION_BOUNDS).map(([region, bounds]) => {
        const adherence = region_adherence[region] ?? 0.5;
        const color = adherenceToColor(adherence);
        const isSelected = selectedRegion === region;

        return (
          <g key={`region-${region}`}>
            <rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              fill={color}
              opacity={isSelected ? 0.4 : 0.15}
              stroke={color}
              strokeWidth={isSelected ? 3 : 1}
              rx={4}
              style={{ cursor: 'pointer' }}
              onClick={() => onRegionClick?.(region)}
            />
            <text
              x={bounds.x + bounds.width / 2}
              y={bounds.y + bounds.height / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={color}
              fontSize={14}
              fontWeight="bold"
              opacity={0.8}
              pointerEvents="none"
            >
              {region} ({regionMetricCount[region] ?? 0})
            </text>
          </g>
        );
      })}
    </svg>
  );
};
```

#### Sidebar Sync (OverlaySidebar.tsx update)

```tsx
// In OverlaySidebar.tsx

{activeTab === 'metrics' && (
  <div className="metrics-list">
    {metric_evaluations.map((metric, i) => (
      <div
        key={i}
        className={`metric-item ${selectedRegion === metric.region ? 'selected' : ''}`}
        onClick={() => onRegionSelect?.(metric.region)}
      >
        <strong>{metric.metric_id}</strong>
        <span className="value">{metric.value.toFixed(2)}</span>
        <span className="confidence">{(metric.confidence * 100).toFixed(0)}%</span>
      </div>
    ))}
  </div>
)}
```

#### PremiumResultPage Integration

```tsx
{view === 'metrics' && (
  <div className="overlay-stage" style={{ position: 'relative' }}>
    <img src={canonicalImage} alt="Canonical" />
    <MetricsMapLayer
      viewBoxWidth={viewBoxWidth}
      viewBoxHeight={viewBoxHeight}
      metric_evaluations={result.metric_evaluations}
      region_adherence={result.region_adherence}
      onRegionClick={(region) => {
        setSelectedRegion(region);
        // Notify sidebar to highlight matching metrics
      }}
      selectedRegion={selectedRegion}
    />
  </div>
)}
```

---

## VERIFICATION CHECKLIST

- [ ] **Task 3:**
  - [ ] `showGuideLines` and `showActualWireframe` state exists in PremiumResultPage
  - [ ] `fetchCompose()` is called when either flag changes
  - [ ] Backend receives flags in POST body (check NestJS → Python passthrough)
  - [ ] Playwright test confirms image regeneration on toggle

- [ ] **Task 4:**
  - [ ] `IdealWireframe.tsx` created and exports component
  - [ ] SVG viewBox uses natural dims (not CSS pixels)
  - [ ] Dashed lines render cyan (#22d3ee)
  - [ ] Points are clickable (highlight + card)
  - [ ] Integrated into PremiumResultPage when `view === 'ideal'`

- [ ] **Task 5:**
  - [ ] `MetricsMapLayer.tsx` created and exports component
  - [ ] Region rectangles render with color based on `region_adherence`
  - [ ] Click region → highlight in sidebar
  - [ ] Sidebar rows clickable → highlight region on map
  - [ ] Integrated into PremiumResultPage when `view === 'metrics'`

- [ ] **All Tasks:**
  - [ ] TypeScript compiles (`npm run build`)
  - [ ] No console errors (DevTools)
  - [ ] E2E tests pass (`npm run test:e2e`)
  - [ ] CSS styling follows MVP Design System (see CLAUDE.md)

---

## QUALITY GATES (Post-implementation)

1. **TypeScript check:**
   ```bash
   cd frontend && npm run build
   ```

2. **Playwright E2E:**
   ```bash
   npm run test:e2e -- --grep "overlay"
   ```

3. **Visual regression (optional):**
   ```bash
   just pw-overlays PW_IMAGE=rosto_exemplo.jpg
   ```

4. **API validation:**
   - POST `/v1/vision/compose-before-ideal` returns 200 with image + annotations
   - POST `/v1/vision/render-overlay` includes `region_adherence` in response

---

## NOTES

- **Coordinate system:** Always use `viewBoxWidth/viewBoxHeight` for SVG endpoints, not CSS pixels.
- **Colors:** Follow MVP Design System (CLAUDE.md):
  - Ideal guides: `#22d3ee` (cyan)
  - Heatmap good: `#10b981` (green)
  - Heatmap warning: `#f59e0b` (amber)
  - Heatmap critical: `#ef4444` (red)
- **Backward compatibility:** Keep existing PNG endpoints available during migration to SVG layers.
- **Session state:** Track selected region/point in PremiumResultPage, sync to sidebar.

---

**Execution Model:** `opus` (complex multi-component integration)  
**Estimated Effort:** 3-4 hours (tasks 3+4+5 in sequence, with testing)
