# Plan: Interactive Overlay Controls (Tasks 3-4-5)

**Date:** 2026-05-12  
**Status:** Ready for execution  
**Recommended Execution Model:** opus  

---

## Overview

Complete 3 interconnected overlay features to unlock interactive visual feedback in the premium analysis view:

1. **Task 3:** Fix before-ideal toggle controls (frontend state + backend validation)
2. **Task 4:** Create interactive Ideal Wireframe SVG layer
3. **Task 5:** Create interactive Metrics Map SVG layer with sidebar sync

All tasks depend on **Task 3 stability** (toggle state management + re-composition triggering).

---

## Task Decomposition

### Task 3: Before-Ideal Toggle Controls

**Goal:** Ensure frontend state changes for `showGuideLines` and `showActualWireframe` trigger image re-composition.

**Steps:**
1. Verify/create React state in `PremiumResultPage.tsx`:
   - `showGuideLines: boolean`
   - `showActualWireframe: boolean`
   - `offsets: { dx, dy }`

2. Implement `fetchCompose()` function that sends all flags to backend

3. Attach `useEffect` listener: when any flag changes AND view === "before-ideal", call `fetchCompose()`

4. Backend validation:
   - NestJS controller (`vision.controller.ts`): verify endpoint receives flags in JSON body
   - Vision client (`vision.client.ts`): forward all fields to Python backend (multipart or JSON)
   - Python endpoint: receive flags and apply overlay logic conditionally

5. Add Playwright E2E test: toggle → verify image changes

**Files to modify:**
- `frontend/src/pages/PremiumResultPage.tsx` (state + useEffect + toggle UI)
- `nest/src/modules/vision/vision.controller.ts` (DTO + endpoint)
- `nest/src/modules/vision/vision.client.ts` (forward flags)
- `backend/app/vision/services/before_ideal_composer.py` (conditional overlay application)
- `scripts/playwright-overlays-e2e.mjs` (add test)

**Verification:**
- Playwright test passes ✅
- Console logs show fetch triggered on toggle
- Image visibly changes after toggle

---

### Task 4: Ideal SVG Layer Interactive

**Goal:** Create SVG component rendering ideal proportions as cyan dashed lines + clickable points.

**Steps:**
1. Create new component `frontend/src/components/IdealWireframe.tsx`:
   - Accept props: `viewBoxWidth/Height`, `landmarks_ideal`, `onPointClick`, `selectedPoint`
   - Draw cyan dashed lines connecting key proportions (eyes, nose, mouth, jawline)
   - Render circles at each landmark (clickable)
   - Highlight selected point

2. Integrate into `PremiumResultPage.tsx`:
   - Render when `view === 'ideal'`
   - Position as absolute overlay on canonical image
   - Pass `landmarks_ideal` from result

3. Add point detail card:
   - Show on click: landmark index, coordinates, description
   - Add to sidebar or as tooltip

4. CSS styling:
   - Position SVG absolutely over image
   - Use CSS variables for colors (MVP Design System: `#22d3ee` for guides)

5. Verify TypeScript compilation

**Files to create/modify:**
- `frontend/src/components/IdealWireframe.tsx` (NEW)
- `frontend/src/pages/PremiumResultPage.tsx` (integrate + state for selected point)
- `frontend/src/styles.css` (add .overlay-stage, .ideal-point-detail classes if needed)

**Verification:**
- Build succeeds ✅
- View `view === "ideal"` → SVG renders
- Click point → highlight + card appears
- Colors match MVP Design System

---

### Task 5: Metrics SVG Map Interactive

**Goal:** Create SVG heatmap showing region-based metric adherence + sidebar synchronization.

**Steps:**
1. Create new component `frontend/src/components/MetricsMapLayer.tsx`:
   - Accept props: `viewBoxWidth/Height`, `metric_evaluations`, `region_adherence`, `onRegionClick`, `selectedRegion`
   - Define region bounds (FOREHEAD, EYES, NOSE, MOUTH, JAW)
   - Render rectangles per region, colored by `region_adherence` (green/amber/red)
   - Draw region name + metric count as text overlay

2. Adherence-to-color mapping:
   - `>= 0.9`: green (`#10b981`)
   - `0.7–0.9`: amber (`#f59e0b`)
   - `< 0.7`: red (`#ef4444`)

3. Sidebar sync (`OverlaySidebar.tsx` update):
   - List metrics by region
   - Click metric → highlight region in map
   - Click map region → highlight metrics in sidebar

4. Integrate into `PremiumResultPage.tsx`:
   - Render when `view === 'metrics'`
   - Manage `selectedRegion` state
   - Pass callbacks to sync with sidebar

5. Verify backend sends `region_adherence` in response

**Files to create/modify:**
- `frontend/src/components/MetricsMapLayer.tsx` (NEW)
- `frontend/src/components/OverlaySidebar.tsx` (add sidebar metrics list + click handlers)
- `frontend/src/pages/PremiumResultPage.tsx` (integrate + manage selectedRegion state)
- `frontend/src/styles.css` (add region/metric styling if needed)

**Verification:**
- Build succeeds ✅
- View `view === "metrics"` → heatmap renders with color gradients
- Click region → sidebar highlights matching metrics
- Hover map → color intensity increases

---

## Dependency Order

```
Task 3 (stable toggle)
    ↓
Task 4 (Ideal SVG — depends on stable render cycle)
    ↓
Task 5 (Metrics SVG — shares sidebar interaction pattern from Task 4)
```

---

## Implementation Skills Needed

1. **Context reading:** .claude/face-analysis/00-index.md, 01-architecture.md, 08-svg-overlays.md
2. **Frontend React/TS:** Component composition, state management, SVG rendering
3. **Backend validation:** NestJS DTO + Python endpoint integration
4. **E2E testing:** Playwright assertions
5. **CSS/styling:** MVP Design System color variables

---

## Verification Gates (Per Task)

### Task 3 Completion:
- [ ] `showGuideLines` and `showActualWireframe` toggles exist in UI
- [ ] Frontend sends both flags in POST body
- [ ] Backend receives and applies conditionally
- [ ] Playwright test: image regenerates on toggle ✅

### Task 4 Completion:
- [ ] `IdealWireframe.tsx` renders SVG with cyan dashed lines
- [ ] Points are clickable (highlight + detail card)
- [ ] Integrated into `view === "ideal"` flow
- [ ] TypeScript compiles ✅

### Task 5 Completion:
- [ ] `MetricsMapLayer.tsx` renders region heatmap
- [ ] Colors reflect `region_adherence` (green/amber/red)
- [ ] Sidebar syncs with map clicks (bidirectional)
- [ ] TypeScript compiles ✅

### All Tasks:
- [ ] Frontend build succeeds: `npm run build`
- [ ] E2E tests pass: `npm run test:e2e -- --grep "overlay"`
- [ ] No console errors
- [ ] Visual regression check (optional): `just pw-overlays`

---

## Recommended Execution Model

**Model: `opus`**

**Reasoning:**
- Complex multi-component integration (3 interdependent tasks)
- Requires understanding of coordinate space (viewBox vs CSS)
- Needs backend validation + frontend state management
- SVG geometry + color mapping calculations
- Sidebar bidirectional sync pattern

**Estimated tokens:** ~15k–20k (context + implementation + verification)

---

## Notes

- All SVG endpoints must use `viewBoxWidth/viewBoxHeight`, not CSS pixel dimensions (critical for coordinate correctness)
- Colors follow MVP Design System: see `CLAUDE.md` for hex values
- Backward compatibility: keep existing PNG endpoints available during SVG migration
- Session state for selected region/point must persist across sidebar interactions
- Error handling: gracefully handle missing `region_adherence` or `metric_evaluations` from backend

---

**Next:** Execute with `/auto-execute-prompt` (model: opus)
