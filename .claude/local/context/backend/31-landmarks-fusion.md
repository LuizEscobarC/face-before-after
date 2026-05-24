---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/landmarks-fusion"
file_path: ".claude/local/context/backend/31-landmarks-fusion.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  fusion_layer.py exposes fuse(image_bgr, mp_landmarks_px) which runs BiSeNetSegmenter,
  calls extract_hairline_points() from virtual_landmarks.py, computes a composite
  confidence score, and returns a FusedLandmarks dataclass — or falls back to mesh
  trichion (lm[10]) on any error. _trichion.py provides effective_trichion_y() and
  trichion_confidence_multiplier() as the single source of truth for all metric
  calculators that need a hairline y-reference.
tags:
  - "backend"
  - "landmarks"
  - "fusion"
  - "bisenet"
  - "trichion"
  - "hairline"
  - "virtual-landmarks"
rag_keywords:
  - "FusedLandmarks"
  - "fuse"
  - "extract_hairline_points"
  - "TRICHION_CONFIDENCE_THRESHOLD"
  - "effective_trichion_y"
  - "trichion_confidence_multiplier"
  - "_compute_confidence"
  - "_pixel_to_icu"
  - "_mesh_fallback"
  - "_run_bisenet_fusion"
  - "trichion_y_icu"
  - "trichion_source"
  - "virtual_landmarks"
  - "column_y"
  - "savgol_filter"
  - "_SAVGOL_WINDOW"
  - "_MIN_VALID_FRAC"
  - "P_FOREHEAD_CROWN"
related_modules:
  - "backend/trichion-bisenet"
  - "backend/vision-primitives"
  - "backend/bisenet-segmenter"
  - "backend/pipeline"
  - "backend/calc-normalization"
depends_on:
  - "backend/trichion-bisenet"
  - "backend/vision-primitives"
used_by:
  - "backend/pipeline"
  - "backend/calc-normalization"
---

# FusedLandmarks dataclass (fusion_layer.py)

**Source:** `backend/app/services/landmarks/fusion_layer.py`

```python
@dataclass
class FusedLandmarks:
    face_landmarks:      np.ndarray          # (478, 3) float, pixel-space MediaPipe
    virtual_landmarks:   dict[str, Any]      # hairline keypoints in pixel space
    trichion_source:     str        = "mesh" # "bisenet" | "mesh"
    trichion_confidence: float      = 0.0   # composite score ∈ [0, 1]
    trichion_y_icu:      float|None = None  # y in intercanthal units
    segmentation:        dict[str, Any]      # raw BiSeNet output
```

`virtual_landmarks` keys (from `extract_hairline_points()`):
`trichion`, `hairline_left`, `hairline_center`, `hairline_right`,
`forehead_top_estimate`, `temple_left`, `temple_right`, `confidence`, `column_y`.

All coordinate values are `[x, y]` pixel pairs.  `column_y` is a `list[float]` of
Savitzky-Golay smoothed per-column hairline y positions across the scan band.

Consumed by the metrics pipeline as `ctx.virtual_landmarks` in `QualityContext`.

---

# fuse() — main entry point (fusion_layer.py)

**Source:** `backend/app/services/landmarks/fusion_layer.py`

```python
def fuse(
    image_bgr: np.ndarray,       # BGR (H, W, 3)
    mp_landmarks_px: np.ndarray, # (478, 3) float, pixel-space
) -> FusedLandmarks:
```

Always succeeds; wraps `_run_bisenet_fusion()` in a broad `except Exception` and
calls `_mesh_fallback()` on any failure (RuntimeError from ORT, ImportError,
ValueError from empty mask, OSError, etc.).

**Happy path** (`_run_bisenet_fusion`):
1. Calls `get_segmenter().segment(image_bgr)` → `seg_result` dict.
2. Calls `extract_hairline_points(seg_result["hair_mask"], mp_landmarks_px)` → `virtual`.
3. Calls `_compute_confidence(virtual, mp_landmarks_px)` → `confidence` float.
4. If `confidence < TRICHION_CONFIDENCE_THRESHOLD` → returns `_mesh_fallback(mp_landmarks_px, segmentation=seg_result)`.
5. Converts `virtual["trichion"]` pixel coords to ICU via `_pixel_to_icu()` → `trichion_y_icu`.
6. Returns `FusedLandmarks(trichion_source="bisenet", …)`.

**Mesh fallback** (`_mesh_fallback`):
Uses `mp_landmarks_px[P_FOREHEAD_CROWN, :2]` as trichion pixel coords, converts to ICU,
returns `FusedLandmarks(trichion_source="mesh", trichion_confidence=0.0, …)`.
All `virtual_landmarks` keys point to the same `lm10` coordinates.
Fixed mesh confidence is implicitly `0.0` (not 0.95 — the docstring mentions 0.95 as
aspirational but the code assigns `0.0`).

---

# Confidence scoring — _compute_confidence() (fusion_layer.py)

**Source:** `backend/app/services/landmarks/fusion_layer.py`

```
score = valid_frac × regularity × distance_penalty
```

**valid_frac** (`base_conf`): taken directly from `virtual["confidence"]`, which is
`valid_mask.mean()` in `extract_hairline_points()` — the fraction of scan-band columns
where hair was detected.

**regularity**: derived from CoV (coefficient of variation) of adjacent `column_y` diffs.
Formula: `clip(1.0 - (cov - 1.0) / 3.0, 0.0, 1.0)`.  CoV ≤ 1.0 → perfect (natural
hairline waviness); CoV ≥ 4.0 → 0.0 (chaotic edge). Requires ≥ 3 column_y values.

**distance_penalty**: Euclidean distance from `virtual["trichion"]` to `mp_landmarks_px[P_FOREHEAD_CROWN]`
divided by ICD_px → `dist_icu`. Within 1.5 ICU → no penalty (1.0); beyond 3 ICU → 0.0.
Formula: `clip(1.0 - (dist_icu - 1.5) / 1.5, 0.0, 1.0)`.

---

# extract_hairline_points() — virtual landmarks (virtual_landmarks.py)

**Source:** `backend/app/services/landmarks/virtual_landmarks.py`

```python
def extract_hairline_points(
    hair_mask: np.ndarray,         # bool (H, W)
    face_landmarks_px: np.ndarray, # (478, 3) float pixel-space
) -> dict:
```

**Algorithm (5 steps):**

1. **Scan band**: outer-eye corners (`P_LEFT_EYE_OUTER`, `P_RIGHT_EYE_OUTER`) ± 0.5 ICD.
   Result: `x0`–`x1` columns.

2. **Per-column hairline y**: scan each column upward from eye level (`y_eye_top`).
   Hairline = largest y (lowest position in image) where `hair_mask` is True in
   `[:y_scan_start+1, x]`. Columns with no hair → `None`.

3. **Validity check**: `valid_frac = valid_count / band_width`. If `< _MIN_VALID_FRAC`
   (0.10) → returns `_empty_result(face_landmarks_px)` (confidence = 0.0).

4. **NaN fill + Savitzky-Golay smoothing**: missing columns filled by `np.interp`;
   then `savgol_filter(window=21, polyorder=3)`. Window is clamped to odd and ≥ polyorder+1.

5. **Keypoint extraction**: trichion = center of smoothed hairline (`xs[mid_i]`);
   hairline_left/center/right at positions 0, mid, end;
   temple_left/right at band boundaries;
   forehead_top_estimate = `argmin(smoothed)` (highest / smallest-y point).

Constants: `_CONF_WINDOW_HALF = 10`, `_SAVGOL_WINDOW = 21`, `_SAVGOL_POLYORD = 3`,
`_MIN_VALID_FRAC = 0.10`.

Overall `confidence = valid_mask.mean()` (fraction of columns with detected hair).

---

# effective_trichion_y() and TRICHION_CONFIDENCE_THRESHOLD (_trichion.py)

**Source:** `backend/app/services/metrics/_trichion.py`

```python
TRICHION_CONFIDENCE_THRESHOLD: float = 0.40

def effective_trichion_y(lm: NormalizedLandmarks, ctx: QualityContext) -> float:
def trichion_confidence_multiplier(ctx: QualityContext) -> float:
```

This module is the **single source of truth** for all calculators that need a
hairline y-reference. Previously the logic was duplicated in thirds.py.

**`effective_trichion_y()`** priority:
1. BiSeNet: if `ctx.virtual_landmarks` is present and
   `virtual_landmarks["trichion_confidence"] >= TRICHION_CONFIDENCE_THRESHOLD` →
   return `float(virtual_landmarks["trichion_y_icu"])`.
2. Geometric fallback: `float(lm.xy(P_FOREHEAD_CROWN)[1])`.

Note: x-coordinate is always from `lm[P_FOREHEAD_CROWN]` because BiSeNet produces
only a y-estimate; mesh x is the reliable midline proxy.

**`trichion_confidence_multiplier()`**: returns the `trichion_confidence` float when
BiSeNet active path (`trichion_source == "bisenet"` and confidence ≥ threshold),
otherwise 1.0. Used by thirds.py to propagate segmentation uncertainty into
`confidence_final` of upper_third_ratio and related metrics.

`TRICHION_CONFIDENCE_THRESHOLD` is **intentionally duplicated** from
`fusion_layer.TRICHION_CONFIDENCE_THRESHOLD` (both = 0.40); the comment says
"DO NOT change independently". It was reduced from 0.50 → 0.40 on 2026-05-12
to accept real short/irregular-hair faces that produced confidence ~0.42–0.48.
