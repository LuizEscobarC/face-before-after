# Plan: Overlay Auto-Review Pipeline

Build a single-command script + justfile recipe that runs the full vision
pipeline on a face photo and emits **every visualization the frontend renders**
as standalone PNGs in a single review folder, so the agent (and the user)
can iterate on overlay calculations without ever touching the React app.

The script is the **closed-loop testing rig** for the overlay autopilot:
agent edits a calculator → reruns recipe → reads PNGs via `view_image` →
diagnoses next fix.

## Strategy

Reuse the existing backend HTTP renderers as the source of truth — do NOT
re-port the TSX SVG math into Python. Three endpoints already cover ~90%:

- `POST /v1/vision/full-pipeline`    → JSON report + landmarks + trichion_source
- `POST /vision/render`              → server-renders line overlays AND heatmaps as PNG (one call per overlay_id)
- `POST /v1/vision/compose-before-ideal` → original-vs-simetrizado composer

The remaining two panels (Mapa de métricas detectadas, Proporções ideais) are
text/diagram views — render them with PIL from the JSON.

## Phases

### Phase 1 — Discovery / contract verification (parallel)
1. Read `backend/app/vision/routers/render.py` end-to-end to confirm it accepts
   all 9 overlay_ids the frontend uses (`axis_vertical`, `axis_intercanthal`,
   `grid_thirds`, `grid_fifths`, `outline_face`, `face_extents`,
   `improvement_vectors`, `heatmap_asymmetry`, `heatmap_ideal_adherence`)
   and the request shape (multipart file + landmarks JSON + overlay_id form).
2. Read `backend/app/vision/routers/compose.py` for compose-before-ideal contract
   (offsets payload + response shape).
3. Confirm `POST /v1/vision/full-pipeline` exists and the JSON response carries
   `landmarks`, `metric_evaluations` (with `improvement_vector_x/y` +
   `anchor_landmark_index`), `region_metric_evaluations`, `trichion_source`.
4. Verify which overlays in the frontend list are NOT yet in
   `SUPPORTED_OVERLAYS` server-side. Two suspect ones from the read:
   - `face_extents` — not in `_OVERLAY_STYLES` of render.py (only in TSX)
   - `improvement_vectors` — same
   These need either: (a) extending `render.py` to support them, or (b)
   client-side rendering via PIL inside the new script. Decision below.

### Phase 2 — Design `scripts/render_all_overlays.py`
CLI: `python scripts/render_all_overlays.py <image> [--api http://localhost:8000] [--out review/<stem>]`

Steps the script performs:
1. POST image to `/v1/vision/full-pipeline`, save `report.json`.
2. For each overlay_id supported by `/vision/render`, POST and save
   `<stem>_<overlay_id>.png` (one HTTP call each, sequential — keeps logs simple).
3. For `improvement_vectors` and `face_extents` (not yet in render.py), render
   PIL-side from the JSON using the same constants as `OverlayLayer.tsx` —
   small standalone functions inside the script, ~40 LoC each, mirroring the
   TSX helpers. Mark these PNGs `<stem>_<overlay_id>_clientside.png` so
   the agent knows the source.
4. POST `/v1/vision/compose-before-ideal` with offsets built from
   `metric_evaluations` (mirror `buildComposeOffsets` from PremiumResultPage.tsx
   exactly), save `<stem>_compare_original_vs_simetrizado.png`.
5. Render "Mapa de métricas detectadas" with PIL: a 2-column table with
   metric_id | display_value | ideal | severity colour-coded. Save as
   `<stem>_metrics_map.png`.
6. Render "Proporções ideais" with PIL: the canonical reference card for
   thirds/fifths/phi (static diagram + values from `report.json`). Save as
   `<stem>_ideal_proportions.png`.
7. Generate `<stem>_index.html` — a single-page contact-sheet listing every
   PNG with its label, so the user can open one file and see everything.

### Phase 3 — Justfile integration
Add a single recipe block:

- `just review <foto>` — wraps the script. Defaults output to
  `review/<basename-no-ext>/` so reruns overwrite cleanly.
- `just review-loop <foto>` — runs `just review` then prints the index.html
  path; intended as the agent's quick-iteration command.

Output folder layout (illustrative):
```
review/<stem>/
  report.json
  <stem>_axis_vertical.png
  <stem>_axis_intercanthal.png
  <stem>_grid_thirds.png
  <stem>_grid_fifths.png
  <stem>_outline_face.png
  <stem>_face_extents_clientside.png
  <stem>_improvement_vectors_clientside.png
  <stem>_heatmap_asymmetry.png
  <stem>_heatmap_ideal_adherence.png
  <stem>_compare_original_vs_simetrizado.png
  <stem>_metrics_map.png
  <stem>_ideal_proportions.png
  <stem>_index.html
```

### Phase 4 — Autopilot loop (after recipe lands)
1. Run `just review bradpitt-reference.jpg` against the dev API.
2. Open each PNG via `view_image`, run a critical-diff checklist (see Verification).
3. For each issue found, edit the calculator (backend or OverlayLayer client-side helper),
   rerun `just review`, re-inspect the affected PNG only.
4. Stop when the checklist passes OR after 5 iterations (then surface remaining
   issues to the user — avoid infinite tweaking).

Scope of fixes the autopilot may apply autonomously:
- ✅ Visual-only changes (label position, anchor, dash spacing, colour, text-anchor)
- ✅ Adding `face_extents` / `improvement_vectors` support to `render.py` if the
  client-side mirror diverges from TSX
- ❌ NO changes to metric formulas, ideals, severity thresholds, or
  `_trichion.py` — those are out of scope (already audited in
  `CALIBRATION_AUDIT_2026-05-12.md`). If the diagnosis points at a metric bug,
  the autopilot stops and surfaces it.

## Relevant files

- `backend/app/vision/routers/render.py` — server overlay PNG endpoint; may
  need extending with `face_extents` + `improvement_vectors` (mirror constants
  from TSX `OVERLAY_STYLES` + `SEVERITY_ARROW_COLORS`)
- `backend/app/vision/routers/compose.py` — original-vs-simetrizado endpoint
- `frontend/src/components/OverlayLayer.tsx` — canonical visual contract;
  client-side helpers in the script must match constants here (P_*, LM_JAWLINE,
  styles, severity colours)
- `frontend/src/pages/PremiumResultPage.tsx::buildComposeOffsets` — offsets
  shape for compose endpoint; mirror exactly
- `scripts/render_all_overlays.py` — **new** orchestrator script (single file,
  ~300–400 LoC; uses requests + Pillow only — no extra deps)
- `justfile` — append `review` + `review-loop` recipes near the existing
  `mvp-web-foto` block

## Verification

1. Run `just review bradpitt-reference.jpg` end-to-end; confirm 12 PNGs +
   `report.json` + `index.html` are produced under `review/bradpitt-reference/`.
2. Open `index.html` in a browser; visually confirm every panel has content
   and no asset is missing (broken-image check).
3. Diff-by-eye each overlay PNG against the live frontend at
   `http://localhost:5173` — must be visually equivalent (same lines, same
   labels, same severities). Acceptable diffs: anti-aliasing, font hinting.
4. Pixel sanity probes (script-side asserts in `--strict` mode):
   - `axis_vertical` line x within ±2 px of midpoint(lm[133], lm[362], lm[1])
   - `grid_thirds` ideal lines at exactly `yTop + faceH/3` and `yTop + 2*faceH/3`
   - `face_extents` rectangle corners at lm[10]/lm[152]/lm[234]/lm[454]
   - `improvement_vectors` arrow count == metrics with non-null vector + anchor
5. `just review` must be idempotent — rerunning with no code changes produces
   byte-identical PNGs (catches non-determinism in renderer).
6. After recipe is in place, complete one full autopilot iteration on
   bradpitt-reference and document the diff list in
   `local/debug-overlays.md` (append-only).

## Decisions

- **No headless-browser approach.** Playwright on the React page would be the
  ground-truth visual but adds a heavy dep, slow startup, and node/chromium
  in the loop. The backend already has the rendering infra; we use it.
- **Two overlays may be missing server-side** (`face_extents`,
  `improvement_vectors`). Render Phase 1 will confirm. Initial implementation
  uses client-side PIL helpers in the script; if the autopilot finds drift vs
  TSX, it migrates them into `render.py` so the frontend can also consume the
  PNG version when needed.
- **No new test files yet.** The whole script IS the test rig. Pytest unit
  tests for the script come only if the autopilot loop reveals a non-visual
  bug (e.g., wrong offsets shape).
- **Out of scope:** changing metric calculations, ideals, severity thresholds,
  trichion fusion logic. Those have a separate audit trail.

## Further Considerations

1. API dependency: the script requires the FastAPI dev server (`just api-dev`)
   running. Add an early TCP probe with a clear error message ("API not
   reachable at $URL — run `just api-dev` first"). **Recommendation:** keep
   it as a soft dependency; do not auto-start the server inside the recipe
   to avoid stale processes.
2. ONNX dependency for trichion: if BiSeNet model is missing locally, the
   pipeline falls back to mesh and `trichion_source: "mesh"` shows in the
   FaceExtents label. Should the script flag this in the index.html header?
   **Recommendation:** yes — surface `trichion_source` prominently so the
   autopilot doesn't chase a "bug" caused by mesh fallback.
3. Multi-photo mode: should the recipe accept a folder and produce a grid
   review across N photos? **Recommendation:** not in v1 — single-photo loop
   keeps the autopilot iteration tight. Add `just review-batch <dir>` later
   if needed.




# Plan: Overlay Auto-Review Pipeline — REVISION #2 (2026-05-12)

## Why a revision

First version of `scripts/render_all_overlays.py` ran end-to-end but the PNGs
are **visually wrong** because they show the **backend** `/vision/render`
output, which is a primitive line-drawer that pre-dates all the calibration
work the user did in `frontend/src/components/OverlayLayer.tsx`. The TSX
overlay has labels, ideal-vs-real dual lines, deviation %, severity colours,
trichion source label — the backend has **none of that**, just bare cyan/purple
lines. So the contact sheet shows what the backend draws, not what the user
sees in the browser, and concludes "ainda está errado".

Three additional data-population gaps amplify the problem:

1. **`metric_evaluations: []`** from FastAPI `/vision/full-pipeline/upload`
   — the v2 evaluator that fills `improvement_vector_x/y`,
   `anchor_landmark_index`, `severity5`, `confidence_final` runs in the **Nest
   orchestrator**, not in this Python pipeline. So `improvement_vectors`,
   composer offsets, and severity colouring are all empty.
2. **`region_metric_evaluations: []`** for the same reason →
   `heatmap_ideal_adherence` skipped entirely.
3. **`trichion_source: "mesh"`** even though BiSeNet integration shipped
   ([bisenet-hairline-integration-2026-05-12.md](.claude/local/plans/bisenet-hairline-integration-2026-05-12.md)).
   Either the ONNX model isn't downloaded in the running container, or the
   fusion-layer call isn't on the FastAPI MVP code path.

# Plan: Overlay Review Round 2 — make PNGs match the browser

Make `just review <foto>` produce PNGs that are **pixel-equivalent to what the
React `OverlayLayer.tsx` renders in the browser**, and feed every overlay
the data it needs (full `metric_evaluations`, `region_metric_evaluations`,
working BiSeNet trichion). Without this, the autopilot loop is blind: it
thinks the visualizations are broken when in fact the wrong renderer is in
use and the inputs are empty.

Two complementary moves:

A. **Replace the backend `/vision/render` calls with PIL renderers ported
   from `OverlayLayer.tsx`**, so the contact sheet shows the same overlays
   the browser does. The backend endpoint stays as-is for the Nest
   orchestrator's PNG/PDF use case — we just stop using it as the agent's
   ground truth for line overlays.

B. **Hydrate the empty fields** by running the Nest orchestrator's evaluator
   on the FastAPI report (or, fallback, calling Nest end-to-end), and by
   ensuring BiSeNet actually fires. This unblocks `improvement_vectors`,
   compose, `heatmap_ideal_adherence`, and the trichion label.

## Strategy

**Single source of visual truth = `frontend/src/components/OverlayLayer.tsx`.**
Port its render math to PIL inside the script (`scripts/_overlay_render.py`,
new file). Drop the `/vision/render` HTTP calls for line overlays. Keep
`/vision/render` only for the two heatmaps (genuinely server-only because
they need scipy/griddata + the colormap renderer). Keep `/vision/compose-before-ideal`
as-is.

**Hydrate empty data** by either (a) routing through Nest orchestrator
when available, or (b) running the v2 evaluator directly in-process from the
FastAPI report. Decision deferred to Phase 2 after a 10-minute spike.

## Phases

### Phase 1 — Diagnose the empty-data + mesh-trichion roots (parallel)
1. **Why are `metric_evaluations` empty from FastAPI MVP?** Read
   `backend/app/domain/pipeline.py` and trace whether the v2 evaluator
   (the one that produces `improvement_vector_x/y`, `severity5`,
   `confidence_final`) is invoked here at all, or only by the Nest
   orchestrator. Find the entry point name.
2. **Is BiSeNet ONNX present in the running container?**
   `docker compose exec api ls -la /app/backend/models/` — check for the
   `bisenet_face_parsing.onnx` file. If absent, the soft-fail in Dockerfile.api
   silently dropped it and the fusion always falls back to mesh.
3. **Is `fusion_layer.fuse()` being called on this code path?** Grep
   `pipeline.py` for `fusion_layer` / `virtual_landmarks` / `trichion_source`
   to confirm wiring.
4. Read `frontend/src/components/OverlayLayer.tsx` end-to-end (all overlay
   render functions: `AxisVertical`, `AxisIntercanthal`, `GridThirds`,
   `GridFifths`, `OutlineFace`, `FaceExtents`, `ImprovementVectors`).
   Capture every constant, every label string, every coordinate formula.
   This is the porting spec for Phase 3.

### Phase 2 — Decide data-hydration path
Three options, pick one based on Phase 1 findings:
- **A.** Wire the v2 evaluator into the FastAPI MVP path so
  `/vision/full-pipeline/upload` returns full `metric_evaluations` +
  `region_metric_evaluations`. Cleanest long-term but touches production code.
- **B.** Add a `--via-nest` CLI flag that calls the Nest orchestrator endpoint
  instead of FastAPI directly. Fastest if Nest already exposes a
  similar endpoint and the script can authenticate.
- **C.** Run the Python evaluator code path inline in the script (import
  `app.services.evaluator`, feed the FastAPI report). Zero impact on
  production code; risks duplicating wiring logic.
**Recommended: A** — also benefits the React app calling FastAPI directly
during dev. Confirm with the user in Refinement.

### Phase 3 — Port `OverlayLayer.tsx` to PIL
New file: `scripts/_overlay_render.py` (Python module imported by
`render_all_overlays.py`). One function per overlay, mirroring the TSX
exactly:

  - `draw_axis_vertical(img, lm)`            ← AxisVertical (cyan dashed,
        x = mean(lm[133].x, lm[362].x, lm[1].x))
  - `draw_axis_intercanthal(img, lm)`        ← AxisIntercanthal (cyan solid)
  - `draw_grid_thirds(img, lm, evals)`       ← GridThirds (purple-dashed
        ideal 1/3 + 2/3, orange-solid Sobrancelha + Subnasale, T1/T2/T3
        right-aligned labels with deviation %, severity colour by `severity5`)
  - `draw_grid_fifths(img, lm)`              ← GridFifths (white edges,
        purple-dashed ideal 1/5..4/5, orange-solid eye-corner real lines,
        per-fifth deviation in px label below)
  - `draw_outline_face(img, lm)`             ← OutlineFace (cyan
        polyline of `LM_JAWLINE` 17-pt jaw + closing forehead arc)
  - `draw_face_extents(img, lm, trichion_source)`  ← FaceExtents (white
        rectangle, "Trichion (BiSeNet)" or "(mesh)" label, "Menton" label)
  - `draw_improvement_vectors(img, lm, evals)`  ← ImprovementVectors (per-
        metric arrows, severity-coloured by `SEVERITY_ARROW_COLORS`)

Each function takes a PIL Image and returns a new PIL Image (immutable
style — easier to compose). Constants live in the module top, mirroring
TSX. **One commit per overlay function** so diff vs TSX is trivial to
audit.

### Phase 4 — Refactor `scripts/render_all_overlays.py`
- Replace `call_render(...)` with `_overlay_render.draw_*` for the 5 line
  overlays + the 2 client-side ones. Keep `call_render(...)` only for the
  two heatmaps.
- Drop the `_clientside` distinction — every line overlay is now uniformly
  PIL-rendered. PNG names stay the same.
- Add `--strict` flag: assert pixel equivalence checkpoints (e.g.
  `axis_vertical x ∈ ±2 px of mean(133,362,1)`, `face_extents corners on
  lm[10/152/234/454]`, `arrow count == metrics with vector+anchor`).
- Add `--via-nest URL` (Phase 2 option B path) if we choose it.
- `index.html` adds **TSX-vs-PIL diff badges** when run with `--diff` —
  rewrites the JSX render via Playwright snapshot for spot validation
  (deferred unless TSX-port drifts).

### Phase 5 — Hydration fix per Phase 2 decision
- If A: edit `backend/app/domain/pipeline.py` (or wherever the report dict
  is assembled) to also call the v2 evaluator and merge results into the
  returned dict. New keys: `metric_evaluations`, `region_metric_evaluations`,
  preserve all existing keys.
- BiSeNet smoke: confirm the ONNX is downloaded; if not, add a startup log
  line to FastAPI ("BiSeNet model present: yes/no") and document a manual
  download command in the contact sheet header when the model is missing.

### Phase 6 — Re-run autopilot loop
1. `just review bradpitt-reference.jpg` after Phases 3+4+5 land.
2. View the 12 PNGs. Each must:
   - Show the same lines, labels, deviations, colours as the React app at
     `localhost:5173` (visual equivalence — anti-aliasing OK).
   - For `bradpitt-reference`: `trichion_source` badge in the index header
     reads `"bisenet"` (or document why fallback is acceptable).
   - `improvement_vectors` shows N≥3 arrows (was 0).
   - `compose` PNG shows wireframe overlay (was 0 offsets).
   - `heatmap_ideal_adherence` is rendered (was skipped).
3. Three iterations max — if the React-vs-PIL diff persists after 3 fix
   rounds, escalate to user (likely a TSX-only change wasn't propagated).

Allowed autopilot edits in this round:
- ✅ Tweaks to `_overlay_render.py` constants/positions to match TSX
- ✅ Wiring the v2 evaluator into FastAPI MVP path
- ✅ Adding the BiSeNet model to the container (download script, env-var
  guarded)
- ❌ NO changes to metric formulas, ideals, severity thresholds, fusion
  threshold (0.8), `_trichion.py`. If autopilot finds a calibration bug,
  it stops and escalates.

## Relevant files

- [frontend/src/components/OverlayLayer.tsx](frontend/src/components/OverlayLayer.tsx) — **THE** visual contract. Every constant + render fn (`AxisVertical`, `AxisIntercanthal`, `GridThirds`, `GridFifths`, `OutlineFace`, `FaceExtents`, `ImprovementVectors`) gets mirrored 1:1 in PIL.
- `scripts/_overlay_render.py` — **new** PIL port, one fn per TSX overlay.
- [scripts/render_all_overlays.py](scripts/render_all_overlays.py) — refactor: stop calling `/vision/render` for lines, keep it for heatmaps only; thread `metric_evaluations` into every line overlay so labels/severity light up.
- [backend/app/domain/pipeline.py](backend/app/domain/pipeline.py) — Phase 2 decision A: wire v2 evaluator + region rollup so `/vision/full-pipeline/upload` returns full `metric_evaluations` + `region_metric_evaluations`.
- [backend/app/services/landmarks/fusion_layer.py](backend/app/services/landmarks/fusion_layer.py) + `bisenet_segmenter.py` — verify BiSeNet path actually fires; check ONNX presence in container.
- [Dockerfile.api](Dockerfile.api) — confirm ONNX download didn't soft-fail; harden if needed (mirror, retry).
- [backend/app/vision/routers/render.py](backend/app/vision/routers/render.py) — **untouched** (still serves Nest's PNG/PDF needs); we just stop relying on it for our agent ground truth.
- [justfile](justfile) — already has `review`/`review-loop`; no change needed.

## Verification

1. `docker compose exec api ls /app/backend/models/bisenet_face_parsing.onnx` returns the file. If not → ONNX download fix lands first.
2. `curl ... /vision/full-pipeline/upload | jq '.result.trichion_source, (.result.metric_evaluations|length), (.result.region_metric_evaluations|length)'` → `"bisenet"`, `≥80`, `≥6`. (Currently `"mesh"`, `0`, `0`.)
3. `just review bradpitt-reference.jpg`:
   - Index header shows `trichion: bisenet`.
   - `grid_thirds.png` shows: 2 dashed purple ideal lines, 2 solid orange real lines, "ideal 1/3" + "Sobrancelha" + "Subnasale" labels, T1/T2/T3 right-aligned with `±N%` deviation in severity colour. (Currently: 2 thin lines, no labels.)
   - `grid_fifths.png` shows white edges, 4 dashed purple ideals, 4 solid orange real, per-fifth `±Npx`. (Currently: 4 thin lines.)
   - `axis_vertical.png` line x = mean(lm[133].x, lm[362].x, lm[1].x), not just mean(lm[133].x, lm[362].x).
   - `improvement_vectors.png` arrow count > 0 (currently 0).
   - `compose_original_vs_simetrizado.png` has visible wireframe diff (currently 0 offsets).
   - `heatmap_ideal_adherence.png` exists (currently skipped).
4. `--strict` asserts pass: pixel checkpoints listed in Phase 4.
5. Idempotent re-run produces byte-identical PNGs (catches non-determinism).
6. **TSX parity spot-check (manual, one-time):** open the React app at `localhost:5173`, load the same image, screenshot one overlay (grid_thirds), eyeball-diff vs `review/.../grid_thirds.png`. Acceptable: anti-aliasing/font hinting. Reject: missing label, wrong landmark, different colour.

## Decisions

- **No headless-browser at runtime.** Playwright snapshot is reserved as a
  one-time TSX parity audit (Phase 6 step 6), not a per-run dependency.
- **Heatmaps stay server-rendered.** Porting the scipy-griddata + convex-hull
  + density-cascade logic to PIL would duplicate ~600 LoC and risk drift.
  Heatmaps work today; keep using `/vision/render` for them.
- **PIL port lives in `scripts/`, not in `backend/`.** This is autopilot
  testing infrastructure — putting it under `backend/` would invite Nest to
  consume it and freeze the contract. We want it to drift WITH the TSX.
- **No new tests yet.** The script IS the rig. Phase 5's evaluator wiring
  may need a small integration test — defer until that change is concrete.
- **Out of scope:** changing metric formulas, ideals, severity thresholds,
  fusion threshold (0.8), `_trichion.py` logic. Those have a separate audit
  ([CALIBRATION_AUDIT_2026-05-12.md](.claude/face-analysis/CALIBRATION_AUDIT_2026-05-12.md)).

## Risk register

| Risk | Mitigation |
|---|---|
| TSX-port drifts from `OverlayLayer.tsx` over time | Each PIL fn references the TSX line range in a docstring; CI lint (future) greps both files for the constants list. |
| v2 evaluator wiring breaks Nest contract | Phase 5 only ADDS keys; no removal/rename. Smoke-test Nest call after change. |
| BiSeNet ONNX URL 404s in Dockerfile | Mirror to MinIO (already noted in original BiSeNet plan, risk #1); check during Phase 1.2. |
| Autopilot visual diff is subjective | `--strict` mode pins numeric checkpoints (line x/y, label count, arrow count). Subjective bits land in the user's manual spot-check. |

## Further Considerations

1. **Hydration path A vs B vs C** — needs user input. Recommendation A
   (wire v2 evaluator into FastAPI). Surface in Refinement.
2. **Should the script auto-start the API container if down?** Currently
   probes and fails. Recommendation: keep probe-and-fail to avoid hidden
   restarts; emit `docker compose up -d api` as the suggested fix in the
   error message.
3. **Capture multiple photos in one review?** Defer (`just review-batch`
   later). Single-photo loop keeps autopilot iteration tight.
4. **Should `--diff` mode generate a side-by-side PNG (PIL vs Playwright
   snapshot) for visual delta?** Useful but heavy; defer until autopilot
   reports drift.
