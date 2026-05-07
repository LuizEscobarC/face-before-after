# Rewrite Full Vision Pipeline: MediaPipe Tasks Vision (Mesh-478 native)

> **Type:** refactor
> **Module:** vision + domain (`backend/app/vision/`, `backend/app/domain/`)
> **Date:** 2026-05-07
> **Stack:** Python 3.10 · FastAPI · OpenCV · MediaPipe Tasks Vision
> **Plan:** `.claude/local/plans/rewrite-vision-mediapipe-tasks-2026-05-07.md`
> **Recommended model:** opus

---

## Context

Remove dlib entirely and rewrite every file that indexes landmarks to use **MediaPipe Tasks Vision FaceLandmarker** with `refine_landmarks=True` (Mesh-478: 468 base + 10 iris). No compat table, no fallback flag, no FaceRect mock.

**Architecture decision:** `backend/app/domain/landmarks_mesh.py` is the single source of truth for all anatomical constants. `face_metrics.py` and `face_asymmetry.py` already use symbolic constants (`LM_LEFT_EYE`, `P_NOSE_TIP`, etc.) — only imports need to change, bodies stay mostly intact.

**State going in:**
- `face_detection.py` currently has MediaPipe + subset-68 + FaceRect + USE_DLIB_FALLBACK — REPLACE completely.
- `landmark_mapping.py` exists — DELETE.
- `test_mediapipe_parity.py` exists — DELETE.
- `dlib>=19.24.0` in pyproject.toml — REMOVE.
- `mediapipe>=0.10.18`, `numpy>=1.24,<2.0`, `opencv-python-headless>=4.8.0,<4.11` already pinned.

---

## Dependency Map (verified by exploration)

### Public API callers of `face_detection.py`

| Caller | What it calls | Impact of API change |
|---|---|---|
| `routers/landmarks.py:30,70` | `detect_faces(image)`, `extract_landmarks(image, face_rect)` | `face_rect` → `FaceDetectionResult`; `.left()/.top()/.width()/.height()` → `.bbox` tuple |
| `routers/full_pipeline.py:90,92` | `detect_faces(img_bgr)`, `extract_landmarks(img_bgr, faces[0])` | Same as above; `faces[0].width()` → `faces[0].bbox[2]` |
| `tests/test_quality_evaluator.py:28,41,43` | `detect_and_extract(image)` | Returns `(landmarks(478,2), FaceDetectionResult)` instead of `(landmarks(68,2), dlib.rect)` |

### Files with hardcoded dlib-68 indices

| File | Key indices used | Strategy |
|---|---|---|
| `quality_evaluator.py` | `[5:12]`, `[36:48]`, `[48:68]`, `[48]`, `[54]`, `[57]`, `[8]`, `[27]` | Import from `landmarks_mesh` |
| `pose_estimator.py` | `_LANDMARK_INDICES = [30,8,36,45,48,54]` | Replace with `PNP_LANDMARK_INDICES` from `landmarks_mesh` |
| `face_metrics.py` | `LM_*` and `P_*` constants (lines 33–63) | Delete constants, import from `landmarks_mesh` |
| `face_asymmetry.py` | `LANDMARKS` dict, `ANATOMICAL_POINTS` dict, `PREDICTOR_PATH` | Replace dicts with imports; remove dlib class init |
| `canonical_frame.py` | `face_rect: dlib.rectangle` type hint | Change to `tuple[int,int,int,int]` (x,y,w,h) |
| `pipeline.py` | `landmarks[36:42]`, `landmarks[42:48]` (~lines 199,200,1071,1072) | `landmarks[LM_LEFT_EYE]`, `landmarks[LM_RIGHT_EYE]` |
| `face.py` | Legacy script, loads dlib at module-level — **check if imported** | Delete if unused by any router/service |

### Key anatomical mapping (dlib-68 → Mesh-478)

```python
# PnP pose solver — CRITICAL (3D model stays the same, only 2D indices change)
dlib  [30,  8,  36,  45,  48,  54]
mesh  [ 1, 152,  33, 263,  61, 291]

# Region groups
LM_LEFT_EYE   = [33, 7, 163, 144, 145, 153]   # dlib 36–41
LM_RIGHT_EYE  = [263, 249, 390, 373, 374, 380] # dlib 42–47
LM_LEFT_BROW  = [70, 63, 105, 66, 107]          # dlib 17–21
LM_RIGHT_BROW = [336, 296, 334, 293, 300]       # dlib 22–26
LM_NOSE_BRIDGE= [168, 6, 197, 195]              # dlib 27–30
LM_NOSE_TIP   = [48, 115, 220, 45, 4]           # dlib 31–35
LM_OUTER_MOUTH= [61,185,40,39,37,0,267,269,270,409,291,375] # dlib 48–59
LM_INNER_MOUTH= [78,95,88,178,87,14,317,402]    # dlib 60–67
LM_JAWLINE    = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400] # dlib 0–16
LM_LEFT_IRIS  = [468,469,470,471,472]
LM_RIGHT_IRIS = [473,474,475,476,477]

# Point constants
P_NOSE_TIP        = 1    # dlib 30
P_MENTON          = 152  # dlib 8
P_LEFT_EYE_OUTER  = 33   # dlib 36
P_RIGHT_EYE_OUTER = 263  # dlib 45
P_LEFT_EYE_INNER  = 133  # dlib 39
P_RIGHT_EYE_INNER = 362  # dlib 42
P_LEFT_MOUTH      = 61   # dlib 48
P_RIGHT_MOUTH     = 291  # dlib 54
P_UPPER_LIP       = 13   # dlib 51
P_LOWER_LIP       = 14   # dlib 57
P_LEFT_GONION     = 58   # dlib 4
P_RIGHT_GONION    = 288  # dlib 12
P_SUBNASALE       = 2    # dlib 33
P_BROW_LEFT_INNER = 107  # dlib 21
P_BROW_RIGHT_INNER= 336  # dlib 22
P_NOSE_LEFT       = 48   # dlib 31
P_NOSE_RIGHT      = 45   # dlib 35
P_UPPER_LIP_TOP   = 82   # dlib 50
P_UPPER_LIP_BOT   = 312  # dlib 62
P_LOWER_LIP_TOP   = 86   # dlib 66
P_LOWER_LIP_BOT   = 17   # dlib 58
PNP_LANDMARK_INDICES = [1, 152, 33, 263, 61, 291]
```

**⚠️ Unresolved:** `face.py` import status (check before deleting).

---

## Guardrails

- [x] No DB mutations — pure code refactor.
- [x] No multi-tenancy — not applicable.
- [x] **Backward compat BREAKS intentionally** — callers updated in same scope.
- [x] `pose_estimator._MODEL_3D` 3D coordinates stay **unchanged** — same anatomy, different 2D index.
- [x] Tests rewritten with (478,2) synthetic arrays — populate only indexed positions, rest stays (0,0).
- [x] Smile threshold `0.11` kept — mark TODO if regression found after real-photo test.

---

## Steps / Checks

### Pre-implementation
- [ ] Check if `face.py` is imported by any router or service:
  ```bash
  grep -rn "from app.domain.face import\|import face" backend/app/ backend/main.py 2>/dev/null
  ```
- [ ] Check existing pytest baseline:
  ```bash
  cd backend && python -m pytest tests/ -v --tb=no -q 2>/dev/null | tail -5
  ```

### Implementation (follow execution order from plan)

1. [ ] **Create `backend/app/domain/landmarks_mesh.py`**
   - All constants from the mapping table above
   - `TOTAL_LANDMARKS = 478`
   - Document source: MediaPipe canonical face mesh + refine_landmarks iris indices
   - Export `PNP_LANDMARK_INDICES = [1, 152, 33, 263, 61, 291]`

2. [ ] **Create `backend/tests/test_landmarks_mesh.py`** (sanity — run immediately)
   - Each `LM_*` list has correct cardinality
   - All indices in [0, 477]
   - No overlap between distinct regions
   - `PNP_LANDMARK_INDICES` has 6 elements

3. [ ] **Create `backend/app/vision/services/face_landmarker.py`**
   - `FaceDetectionResult` dataclass: `face_count`, `landmarks: np.ndarray | None` (478,2), `bbox: tuple[int,int,int,int] | None`
   - `_get_landmarker()` singleton via `@lru_cache(1)` — reads `backend/models/face_landmarker.task`
   - `detect(image_bgr) -> list[FaceDetectionResult]` sorted by area desc, max 2 faces
   - Convert MediaPipe normalized coords → pixel coords via image shape
   - `refine_landmarks=True` in options; slice to 478 pts (indices 0–477)

4. [ ] **Add model download to Dockerfiles**
   ```dockerfile
   RUN mkdir -p /app/backend/models && \
       wget -q https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task \
       -O /app/backend/models/face_landmarker.task
   ```
   Add to `Dockerfile.api` AND `Dockerfile.local.api`.

5. [ ] **Rewrite `backend/app/vision/services/face_detection.py`**
   - Remove: FaceRect, USE_DLIB_FALLBACK, landmark_mapping import, all dlib code
   - Thin facade over `face_landmarker.detect()`:
     - `detect_faces(image_bgr) -> list[FaceDetectionResult]`
     - `extract_landmarks(image_bgr, face_result: FaceDetectionResult) -> np.ndarray` → `face_result.landmarks`
     - `detect_and_extract(image_bgr) -> tuple[np.ndarray, FaceDetectionResult] | tuple[None, None]`

6. [ ] **Delete obsolete files**
   - `backend/app/vision/services/landmark_mapping.py`
   - `backend/tests/test_mediapipe_parity.py`
   - `backend/app/domain/face.py` (if step pre-impl confirms unused)

7. [ ] **Update `backend/app/vision/routers/landmarks.py`**
   - `face_rect = faces[0]` → `face_result = faces[0]`
   - `.left()/.top()/.width()/.height()` → `face_result.bbox[0/1/2/3]`
   - `FaceBbox(x=..., y=..., w=..., h=...)` from bbox tuple

8. [ ] **Update `backend/app/vision/routers/full_pipeline.py`**
   - `faces[0].width()` → `faces[0].bbox[2]`
   - `extract_landmarks(image, faces[0])` now receives `FaceDetectionResult`

9. [ ] **Update `backend/app/domain/canonical_frame.py`**
   - Remove `import dlib`
   - `face_rect: dlib.rectangle` → `face_rect: tuple[int,int,int,int]`

10. [ ] **Update `backend/app/vision/services/pose_estimator.py`**
    - `from app.domain.landmarks_mesh import PNP_LANDMARK_INDICES`
    - Replace `_LANDMARK_INDICES = [30,8,36,45,48,54]` with `PNP_LANDMARK_INDICES`
    - `_MODEL_3D` stays unchanged (same anatomy)

11. [ ] **Update `backend/app/vision/services/quality_evaluator.py`**
    - Add import: `from app.domain.landmarks_mesh import (LM_JAWLINE, LM_LEFT_EYE, LM_RIGHT_EYE, LM_OUTER_MOUTH, LM_INNER_MOUTH, P_LEFT_MOUTH, P_RIGHT_MOUTH, P_LOWER_LIP, P_MENTON, LM_NOSE_BRIDGE)`
    - Replace: `landmarks[5:12]` → `landmarks[LM_JAWLINE[5:12]]` (jaw lateral for beard)
    - Replace: `landmarks[48:68]` → `landmarks[LM_OUTER_MOUTH + LM_INNER_MOUTH]` (mouth for beard top-y)
    - Replace: `landmarks[36:48]` → `landmarks[LM_LEFT_EYE + LM_RIGHT_EYE]` (eyes for glasses)
    - Replace: `landmarks[48]` → `landmarks[P_LEFT_MOUTH]`
    - Replace: `landmarks[54]` → `landmarks[P_RIGHT_MOUTH]`
    - Replace: `landmarks[57]` → `landmarks[P_LOWER_LIP]`
    - Replace: `landmarks[8]` → `landmarks[P_MENTON]`
    - Replace: `landmarks[27]` → `landmarks[LM_NOSE_BRIDGE[0]]`

12. [ ] **Update `backend/app/domain/face_metrics.py`**
    - Delete constants block (lines 33–63)
    - Add import from `landmarks_mesh` (all `LM_*` and `P_*` names used in file)
    - Verify function bodies reference only named constants (not raw indices)

13. [ ] **Update `backend/app/domain/face_asymmetry.py`**
    - Delete `PREDICTOR_PATH`, `LANDMARKS` dict, `ANATOMICAL_POINTS` dict
    - Delete `import dlib`, `import os`
    - Add `from app.domain.landmarks_mesh import ...` (matching names or aliases)
    - `FaceAsymmetryAnalyzer.__init__` no longer loads dlib — remove `.dat` loading
    - Remove `detect_face_landmarks()` method (called dlib)

14. [ ] **Update `backend/app/domain/pipeline.py`**
    - `from app.domain.landmarks_mesh import LM_LEFT_EYE, LM_RIGHT_EYE`
    - `landmarks[36:42]` → `landmarks[LM_LEFT_EYE]`
    - `landmarks[42:48]` → `landmarks[LM_RIGHT_EYE]`
    - (lines ~199,200,1071,1072)

15. [ ] **Rewrite test helpers**
    - `tests/test_quality_evaluator.py` — `detect_and_extract` mock / helper returns `(478,2)` array
    - `tests/test_face_metrics.py` — `_symmetric_landmarks()` → build `(478,2)` with meaningful values at `LM_*` indices
    - `tests/test_face_metrics_safety.py` — `_make_landmarks()` same
    - `tests/test_simulate_canonical.py` — `np.zeros((68,2))` → `np.zeros((478,2))`

16. [ ] **Remove dlib from pyproject.toml**
    - Delete `"dlib>=19.24.0"` from `[project].dependencies`

### Post-implementation
- [ ] Run syntax check on all edited files:
  ```bash
  find backend/app -name "*.py" | xargs python -m py_compile 2>&1 | head -20
  ```
- [ ] Run tests:
  ```bash
  cd backend && python -m pytest tests/ -v 2>&1 | tail -30
  ```
- [ ] Build container (user runs manually):
  ```bash
  docker compose build api --no-cache
  docker compose up -d api
  ```
- [ ] Smoke E2E (user runs manually):
  ```bash
  curl -F "file=@<photo.jpg>" http://localhost:9015/vision/full-pipeline \
    | jq '{score:.quality_score, grade:.quality_grade}'
  docker compose exec api pip show dlib 2>&1  # expect: WARNING: Package not found
  ```

---

## Verification

**Pre-conditions:**
- `backend/models/face_landmarker.task` exists (or Dockerfiles download it).
- Container built with new `pyproject.toml` (no dlib).

**Test cases:**

```bash
# Syntax check
find backend/app -name "*.py" | xargs python -m py_compile && echo "✅ syntax OK"

# Unit tests
cd backend && python -m pytest tests/ -v

# E2E (post-build)
curl -F "file=@./sample.jpg" http://localhost:9015/vision/full-pipeline \
  | jq '{score:.quality_score, grade:.quality_grade, flags:.flags}'

# Confirm dlib gone
docker compose exec api pip show dlib 2>&1 | grep -c "not found"  # → 1
```

**Known issues & fixes:**

| Error | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: mediapipe.tasks` | Old mediapipe version | Confirm `>=0.10.18` in pyproject; rebuild |
| `FileNotFoundError: face_landmarker.task` | Model not downloaded | Add wget to Dockerfile or manually place in `backend/models/` |
| `IndexError` in quality_evaluator | LM_JAWLINE subset indexing wrong | `landmarks[LM_JAWLINE[5:12]]` needs LM_JAWLINE to have ≥12 entries (it has 17 ✅) |
| Pose estimator returns all zeros | PnP indices wrong | Verify `PNP_LANDMARK_INDICES = [1,152,33,263,61,291]` with real photo |
| Test synthetic array wrong size | Helper still (68,2) | Check every `np.zeros((68,2))` in tests |
| `dlib.rectangle` import error | canonical_frame.py not updated | Step 9 above |

---

## Commits (suggested — user runs manually)

```bash
git add \
  backend/app/domain/landmarks_mesh.py \
  backend/app/vision/services/face_landmarker.py \
  backend/app/vision/services/face_detection.py \
  backend/app/vision/services/quality_evaluator.py \
  backend/app/vision/services/pose_estimator.py \
  backend/app/domain/face_metrics.py \
  backend/app/domain/face_asymmetry.py \
  backend/app/domain/canonical_frame.py \
  backend/app/domain/pipeline.py \
  backend/app/vision/routers/landmarks.py \
  backend/app/vision/routers/full_pipeline.py \
  backend/pyproject.toml \
  backend/tests/
git rm backend/app/vision/services/landmark_mapping.py \
       backend/tests/test_mediapipe_parity.py
git commit -m ":hammer: refactor(vision): rewrite full pipeline to MediaPipe Tasks Vision Mesh-478

- Removes dlib entirely (no fallback, no compat table)
- landmarks_mesh.py as single source of anatomical constants (Mesh-478)
- FaceLandmarker(.task) replaces dlib detector + predictor
- pose_estimator PnP remapped to Mesh indices (same 3D model)
- quality_evaluator, face_metrics, face_asymmetry use landmarks_mesh constants
- Tests rewritten for (478,2) synthetic landmark arrays"
```

---

## ✅ Validation Report (Layer 6 — ReAct Reflection)

| Layer | Status | Notes |
|---|---|---|
| L1 Context Retrieval | ✅ | All key files read: face_detection.py, quality_evaluator.py, pose_estimator.py, face_metrics.py (lines 33–75), face_asymmetry.py (lines 25–90), canonical_frame.py, landmarks.py router, full_pipeline.py router |
| L2 LSP Hovering | ✅ | 1 unresolved: `face.py` import status — must check pre-impl |
| L3 Schema Pruning | ✅ | No DB schema — N/A |
| L4 Instance Sampling | ✅ | N/A for refactor |
| L5 Guardrails | ✅ | No DB writes; backward compat breaks intentionally and is scoped; smile threshold flagged as TODO |
| L6 Reflection | ✅ | All anatomical mappings documented with source; PnP 3D model noted as unchanged; test helper strategy defined |
