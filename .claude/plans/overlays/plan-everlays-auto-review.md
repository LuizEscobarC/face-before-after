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
