---
tenant_id: "face-before-after"
project: "face-before-after"
module: "superseded/rewrite-vision-mediapipe-tasks-2026-05-07"
file_path: ".claude/plans/archive/superseded/rewrite-vision-mediapipe-tasks-2026-05-07.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Date: 2026-05-07 Model: opus Parent plan: agora-vamos-planejar-em-ethereal-thimble.md Prompt 1+2 fundido
tags:
  - "planning"
rag_keywords:
  - "archive"
  - "mediapipe"
  - "plans"
  - "rewrite"
  - "superseded"
  - "tasks"
  - "vision"
related_modules: []
depends_on: []
used_by: []
---
# Plan — Rewrite Full Vision Pipeline: MediaPipe Tasks Vision (Mesh-478 native)

**Date:** 2026-05-07
**Model:** opus
**Parent plan:** `agora-vamos-planejar-em-ethereal-thimble.md` (Prompt 1+2 fundido)

---

## Goal

Remove dlib entirely. Rewrite every file that indexes landmarks using dlib-68 indices.
Source of truth for anatomical constants: new `backend/app/domain/landmarks_mesh.py` (Mesh-478).
Detection engine: `mediapipe.tasks.vision.FaceLandmarker` loading `backend/models/face_landmarker.task`.

---

## Pre-flight (already validated)

- Arch: x86_64 ✅
- Native libs: libglib2.0-0, libsm6, libxext6 in Dockerfiles ✅
- mediapipe>=0.10.18 added, numpy<2.0 pinned, opencv<4.11 pinned ✅
- `landmark_mapping.py` and `face_detection.py` (FaceRect version) exist — will be replaced ✅

---

## Key anatomical mapping (dlib-68 → MediaPipe Mesh-478)

Used by pose_estimator PnP solver (critical: same anatomical point, different index):

| Semantic | dlib-68 | Mesh-478 |
|---|---|---|
| Nose tip | 30 | 1 |
| Chin (menton) | 8 | 152 |
| Left eye outer | 36 | 33 |
| Right eye outer | 45 | 263 |
| Left mouth corner | 48 | 61 |
| Right mouth corner | 54 | 291 |
| Left eye inner | 39 | 133 |
| Right eye inner | 42 | 362 |
| Left eye group | 36–41 | 33,7,163,144,145,153 |
| Right eye group | 42–47 | 263,249,390,373,374,380 |
| Left brow | 17–21 | 70,63,105,66,107 |
| Right brow | 22–26 | 336,296,334,293,300 |
| Nose bridge | 27–30 | 168,6,197,195 (or 9,8,168,6) |
| Nose tip region | 31–35 | 48,115,220,45,4 |
| Upper lip center | 51 | 13 |
| Lower lip center | 57 | 14 |
| Left jaw | 4 (gonion) | 58 |
| Right jaw | 12 (gonion) | 288 |
| Jawline | 0–16 | 10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400 |
| Outer mouth | 48–59 | 61,185,40,39,37,0,267,269,270,409,291,375 |
| Inner mouth | 60–67 | 78,95,88,178,87,14,317,402 |
| Brow left inner | 21 | 107 |
| Brow right inner | 22 | 336 |
| Subnasale | 33 | 2 |
| Upper lip top | 50 | 82 |
| Lower lip bot | 58 | 17 |
| Upper lip bot | 62 | 312 |
| Lower lip top | 66 | 86 |
| Left iris | — | 468,469,470,471,472 |
| Right iris | — | 473,474,475,476,477 |

---

## Files to CREATE

### 1. `backend/app/domain/landmarks_mesh.py`

Single source of anatomical constants in Mesh-478 indices:
- Region lists: `LM_LEFT_EYE`, `LM_RIGHT_EYE`, `LM_LEFT_BROW`, `LM_RIGHT_BROW`, `LM_NOSE_BRIDGE`, `LM_NOSE_TIP`, `LM_OUTER_MOUTH`, `LM_INNER_MOUTH`, `LM_JAWLINE`, `LM_LEFT_IRIS`, `LM_RIGHT_IRIS`
- Point constants: `P_NOSE_TIP=1`, `P_MENTON=152`, `P_LEFT_EYE_OUTER=33`, `P_RIGHT_EYE_OUTER=263`, `P_LEFT_EYE_INNER=133`, `P_RIGHT_EYE_INNER=362`, `P_LEFT_MOUTH=61`, `P_RIGHT_MOUTH=291`, `P_UPPER_LIP=13`, `P_LOWER_LIP=14`, `P_LEFT_GONION=58`, `P_RIGHT_GONION=288`, `P_SUBNASALE=2`, `P_BROW_LEFT_INNER=107`, `P_BROW_RIGHT_INNER=336`
- PnP anchor list: `PNP_LANDMARK_INDICES = [1, 152, 33, 263, 61, 291]`
- `TOTAL_LANDMARKS = 478`
- Document source: MediaPipe canonical face mesh + refine_landmarks iris

### 2. `backend/app/vision/services/face_landmarker.py`

Wrapper for `mediapipe.tasks.vision.FaceLandmarker`:
- Reads model from `backend/models/face_landmarker.task`
- Singleton via `@lru_cache(1)` on `_get_landmarker()`
- `detect(image_bgr) -> FaceDetectionResult` dataclass:
  - `face_count: int`
  - `landmarks: np.ndarray | None` — shape `(478, 2)` in pixel coords (x, y)
  - `bbox: tuple[int,int,int,int] | None` — (x, y, w, h) from landmarks extent
- Convert normalized coords to pixels via image shape
- `refine_landmarks=True` in options (produces 478 pts)
- Sort by face area descending, `num_faces=2`

### 3. `backend/models/face_landmarker.task`

Download from MediaPipe releases during Docker build (or bundle ~3MB in repo).
Add download step to `Dockerfile.api` and `Dockerfile.local.api`:
```
RUN wget -q https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task \
    -O /app/backend/models/face_landmarker.task
```

### 4. `backend/tests/test_landmarks_mesh.py`

Sanity tests:
- Each `LM_*` list has correct cardinality (e.g. `LM_LEFT_EYE` has 6 items).
- All indices in `[0, 477]`.
- No overlap between distinct regions (eyes, brows, mouth, jawline).
- `PNP_LANDMARK_INDICES` has exactly 6 items.

---

## Files to REWRITE (in execution order)

### 5. `backend/app/vision/services/face_detection.py`

Thin facade over `face_landmarker.py`. Public API changes:
- `detect_faces(image_bgr) -> list[FaceDetectionResult]` — returns list of results (one per face, sorted by area).
- `extract_landmarks(image_bgr, face_result: FaceDetectionResult) -> np.ndarray` — returns `face_result.landmarks` (478,2).
- `detect_and_extract(image_bgr) -> tuple[np.ndarray, FaceDetectionResult] | tuple[None, None]` — convenience.

Remove: `FaceRect`, `USE_DLIB_FALLBACK` flag, all dlib imports, `_resolve_predictor_path`.

### 6. `backend/app/vision/routers/landmarks.py`

Update callers of `detect_faces` / `extract_landmarks`:
- `face_rect = faces[0]` → `face_result = faces[0]`
- `face_rect.width() / face_rect.left()` etc. → `face_result.bbox` tuple `(x, y, w, h)`.
- `FaceBbox(x=face_result.bbox[0], y=face_result.bbox[1], w=face_result.bbox[2], h=face_result.bbox[3])`.

### 7. `backend/app/vision/routers/full_pipeline.py`

Same pattern as `landmarks.py`:
- `faces[0].width()` → `faces[0].bbox[2]` (w component).

### 8. `backend/app/domain/canonical_frame.py`

- Remove `import dlib`.
- Change `face_rect: dlib.rectangle` to `face_rect: tuple[int,int,int,int]` (x,y,w,h bbox).
- Any callers that used `frame.face_rect.width()` etc. update to tuple access.

### 9. `backend/app/vision/services/pose_estimator.py`

- Replace `_LANDMARK_INDICES = [30, 8, 36, 45, 48, 54]` with `from app.domain.landmarks_mesh import PNP_LANDMARK_INDICES`.
- `_MODEL_3D` 3D coordinates stay **exactly the same** (same anatomical points, different 2D indices — the 3D model is anatomical, not index-based).

### 10. `backend/app/vision/services/quality_evaluator.py`

Replace hardcoded index accesses with imports from `landmarks_mesh`:
- `landmarks[5:12]` (jaw lateral for beard ROI) → `landmarks[LM_JAWLINE[5:12]]` (subset of jawline)
- `landmarks[48:68]` (mouth for beard y-top) → `landmarks[LM_OUTER_MOUTH]` / `landmarks[LM_INNER_MOUTH]`
- `landmarks[36:48]` (eyes for glasses) → `landmarks[LM_LEFT_EYE + LM_RIGHT_EYE]`
- `landmarks[48]` → `landmarks[P_LEFT_MOUTH]`
- `landmarks[54]` → `landmarks[P_RIGHT_MOUTH]`
- `landmarks[57]` → `landmarks[P_LOWER_LIP]`
- `landmarks[8]` → `landmarks[P_MENTON]`
- `landmarks[27]` → `landmarks[LM_NOSE_BRIDGE[0]]`

Smile recalibration: `normalized_lift > 0.11` — keep threshold, validate empirically. The Mesh points for upper lip center (13) and lower lip center (14) are geometrically equivalent; the smile geometry should hold. Flag as TODO if regression found.

### 11. `backend/app/domain/face_metrics.py`

- Delete constants block (lines 33–63).
- Add `from app.domain.landmarks_mesh import (LM_LEFT_EYE, LM_RIGHT_EYE, LM_LEFT_BROW, LM_RIGHT_BROW, LM_NOSE_BRIDGE, LM_NOSE_TIP, LM_OUTER_MOUTH, LM_INNER_MOUTH, LM_JAWLINE, P_LEFT_EYE_OUTER, P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER, P_RIGHT_EYE_OUTER, P_NOSE_TIP, P_NOSE_LEFT, P_NOSE_RIGHT, P_SUBNASALE, P_LEFT_MOUTH, P_RIGHT_MOUTH, P_UPPER_LIP, P_LOWER_LIP, P_MENTON, P_LEFT_GONION, P_RIGHT_GONION, P_BROW_LEFT_INNER, P_BROW_RIGHT_INNER)`.
- Function bodies untouched (they already use symbolic constants).

### 12. `backend/app/domain/face_asymmetry.py`

- Delete `PREDICTOR_PATH`, `LANDMARKS` dict, `ANATOMICAL_POINTS` dict.
- Replace with `from app.domain.landmarks_mesh import ...` (same names where possible, add aliases).
- Remove `import dlib` and `import os`.
- `FaceAsymmetryAnalyzer.__init__` no longer loads dlib — becomes stateless dataclass or simple class.
- Remove `FaceAsymmetryAnalyzer.detect_face_landmarks()` method (it called dlib) — callers must pass pre-computed landmarks.

### 13. `backend/app/domain/face.py`

This is a legacy script-style file (loads `antes.png`/`depois.png` from disk with dlib). Not used by the FastAPI pipeline — `canonical_frame.py` is the actual source of truth.
- Check if any router/service imports from `face.py`. If not: **delete** it.
- If imported: strip dlib, keep only `align_and_crop()` using constants from `landmarks_mesh`.

### 14. `backend/app/domain/pipeline.py`

- Lines ~199–200 (`_auto_crop_if_far`): `landmarks[36:42]` → `landmarks[LM_LEFT_EYE]`, `landmarks[42:48]` → `landmarks[LM_RIGHT_EYE]`.
- Lines ~1071–1072 (`simulate`): same eye slices → same constants.

---

## Files to DELETE

- `backend/app/vision/services/landmark_mapping.py`
- `backend/tests/test_mediapipe_parity.py`
- `backend/app/domain/face.py` (if unused by routers)
- `shape_predictor_68_face_landmarks.dat` (if present)

---

## pyproject.toml

- Remove `dlib>=19.24.0`
- `mediapipe>=0.10.18` already added
- Pins `numpy>=1.24,<2.0` and `opencv-python-headless>=4.8.0,<4.11` already in place

---

## Tests to update

- `backend/tests/test_quality_evaluator.py` — `_make_landmarks()` / `detect_and_extract()` calls produce `(68,2)` arrays. Update helpers to produce `(478,2)` with meaningful values only at used indices.
- `backend/tests/test_face_metrics.py` — `_symmetric_landmarks()` hardcodes 68 pts. Rebuild for 478 pts.
- `backend/tests/test_face_metrics_safety.py` — `_make_landmarks()` same issue.
- `backend/tests/test_simulate_canonical.py` — `np.zeros((68,2))` → `np.zeros((478,2))`.

Strategy: helpers populate only the indices named in `landmarks_mesh.py`. Other indices remain (0,0) — functions only read named constants so they stay correct.

---

## Execution order (11 subprompts)

1. Create `landmarks_mesh.py` + `test_landmarks_mesh.py` (sanity tests).
2. Create `face_landmarker.py` + add model download to Dockerfiles.
3. Rewrite `face_detection.py` (thin facade). Delete `landmark_mapping.py` + `test_mediapipe_parity.py`.
4. Update `landmarks.py` router + `full_pipeline.py` router (FaceDetectionResult callers).
5. Update `canonical_frame.py` (remove dlib type).
6. Update `pose_estimator.py` (PNP_LANDMARK_INDICES from landmarks_mesh).
7. Update `quality_evaluator.py` (hardcoded indices → imports).
8. Update `face_metrics.py` (delete constants, add import).
9. Update `face_asymmetry.py` (constants + remove dlib class init).
10. Update `pipeline.py` + check/delete `face.py`.
11. Rewrite test helpers (68→478). Remove `dlib` from `pyproject.toml`. Run `pytest`.

---

## Verification

```bash
docker compose build api --no-cache
docker compose up -d api
docker compose exec api pytest backend/tests/ -v
curl -F "file=@./sample.jpg" http://localhost:9015/vision/full-pipeline \
  | jq '{score:.quality_score, grade:.quality_grade, metrics_count: (.metrics | length)}'
docker compose exec api pip show dlib 2>&1 | grep -c "not found"  # expect 1
```

---

## Recommended Execution Model

- **Model:** opus
- **Reason:** Large coordinated rewrite across 14+ files with shared index mapping. High regression risk in metric calculations. Requires understanding of anatomical landmark semantics, not just syntax replacement. Sonnet risks subtle index mistakes that break quality scores silently.
