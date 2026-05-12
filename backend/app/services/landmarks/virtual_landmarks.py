"""Virtual landmark extraction from a BiSeNet hair-segmentation mask.

Algorithm:
  1. Determine the horizontal scan band using the outer-eye landmarks as
     temple proxies, extended by a small margin (0.5 × ICD on each side).
  2. For each column x in the band, find the topmost row where
     ``hair_mask[y, x] == True`` scanning downward from the top of the image.
  3. Smooth the resulting hairline profile with a Savitzky-Golay filter
     (window_length=21, polyorder=3) to remove pixel-noise jitter.
  4. Compute per-point confidence as 1 minus the fraction of empty columns
     in a 10-pixel neighbourhood.
  5. Return a dict with trichion, hairline_left/center/right,
     forehead_top_estimate, temple_left/right, and overall confidence.

Fallback: if the mask has fewer than 10% valid columns, returns
confidence=0.0 and the trichion falls back to geometric estimation
(P_FOREHEAD_CROWN) in the fusion layer.
"""

from __future__ import annotations

import logging

import numpy as np
from scipy.signal import savgol_filter  # type: ignore[import-untyped]

from app.domain.landmarks_mesh import (
    P_LEFT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
)

logger = logging.getLogger(__name__)

# Neighbourhood half-width used for per-column confidence estimation (pixels).
_CONF_WINDOW_HALF = 10

# Savitzky-Golay parameters for hairline smoothing.
_SAVGOL_WINDOW   = 21
_SAVGOL_POLYORD  = 3

# Minimum fraction of valid columns needed to trust the hairline at all.
_MIN_VALID_FRAC  = 0.10


def extract_hairline_points(
    hair_mask: np.ndarray,
    face_landmarks_px: np.ndarray,
) -> dict:
    """Extract trichion and hairline keypoints from a BiSeNet hair mask.

    Parameters
    ----------
    hair_mask : np.ndarray
        Boolean array shape (H, W).  True where BiSeNet detected hair.
    face_landmarks_px : np.ndarray
        (478, 3) float pixel-space landmarks from MediaPipe (canonical frame).

    Returns
    -------
    dict with keys:
      trichion             : [x, y] — hairline midpoint (smoothed), in pixels
      hairline_left        : [x, y]
      hairline_center      : [x, y]
      hairline_right       : [x, y]
      forehead_top_estimate: [x, y]
      temple_left          : [x, y]
      temple_right         : [x, y]
      confidence           : float ∈ [0, 1] — fraction of valid columns
      column_y             : list[float] — per-column hairline y values (smoothed)
    """
    H, W = hair_mask.shape[:2]

    # --------------------------------------------------------------------------
    # 1. Horizontal band: use outer eye corners as temple proxies
    # --------------------------------------------------------------------------
    icd_px = float(np.linalg.norm(
        face_landmarks_px[P_RIGHT_EYE_INNER, :2]
        - face_landmarks_px[P_LEFT_EYE_INNER, :2]
    ))

    # Outer eye corners define the inter-ocular span; extend by ½ ICD each side.
    x_temple_l = float(face_landmarks_px[P_LEFT_EYE_OUTER, 0]) - 0.5 * icd_px
    x_temple_r = float(face_landmarks_px[P_RIGHT_EYE_OUTER, 0]) + 0.5 * icd_px
    x0 = max(0, int(round(x_temple_l)))
    x1 = min(W - 1, int(round(x_temple_r)))

    if x1 <= x0:
        logger.warning("extract_hairline_points: degenerate scan band [%d, %d]", x0, x1)
        return _empty_result(face_landmarks_px)

    band_width = x1 - x0

    # --------------------------------------------------------------------------
    # 2. Per-column: find topmost hair pixel
    # --------------------------------------------------------------------------
    col_y: list[float | None] = []
    for x in range(x0, x1 + 1):
        col = hair_mask[:, x]
        ys = np.where(col)[0]
        col_y.append(float(ys[0]) if len(ys) > 0 else None)

    valid_mask  = np.array([v is not None for v in col_y])
    valid_count = int(valid_mask.sum())
    valid_frac  = valid_count / max(band_width, 1)

    if valid_frac < _MIN_VALID_FRAC:
        logger.debug(
            "extract_hairline_points: sparse hair mask (valid_frac=%.2f), confidence=0",
            valid_frac,
        )
        return _empty_result(face_landmarks_px)

    # Fill missing columns via linear interpolation for smoothing purposes.
    col_y_arr = np.array([v if v is not None else float("nan") for v in col_y])
    col_y_arr = _fill_nan(col_y_arr)

    # --------------------------------------------------------------------------
    # 3. Savitzky-Golay smoothing
    # --------------------------------------------------------------------------
    win = min(_SAVGOL_WINDOW, len(col_y_arr) if len(col_y_arr) % 2 == 1 else len(col_y_arr) - 1)
    win = max(win, _SAVGOL_POLYORD + 1)
    if win % 2 == 0:
        win -= 1
    smoothed = savgol_filter(col_y_arr, window_length=win, polyorder=_SAVGOL_POLYORD)

    # --------------------------------------------------------------------------
    # 4. Per-column confidence: 1 − fraction of empty neighbours
    # --------------------------------------------------------------------------
    col_conf = np.zeros(len(valid_mask), dtype=float)
    for i in range(len(valid_mask)):
        lo = max(0, i - _CONF_WINDOW_HALF)
        hi = min(len(valid_mask), i + _CONF_WINDOW_HALF + 1)
        col_conf[i] = float(valid_mask[lo:hi].mean())

    overall_confidence = float(valid_mask.mean())

    # --------------------------------------------------------------------------
    # 5. Key-point extraction
    # --------------------------------------------------------------------------
    xs  = np.arange(x0, x1 + 1, dtype=float)
    mid_i = len(xs) // 2
    q1_i  = len(xs) // 4
    q3_i  = 3 * len(xs) // 4

    # Trichion = centre of the smoothed hairline
    trichion      = [float(xs[mid_i]), float(smoothed[mid_i])]
    hairline_left  = [float(xs[0]),    float(smoothed[0])]
    hairline_center= [float(xs[mid_i]),float(smoothed[mid_i])]
    hairline_right = [float(xs[-1]),   float(smoothed[-1])]
    temple_left    = [float(x0), float(smoothed[0])]
    temple_right   = [float(x1), float(smoothed[-1])]

    # Forehead top estimate: highest (min y) smoothed hairline point
    min_y_i = int(np.argmin(smoothed))
    forehead_top = [float(xs[min_y_i]), float(smoothed[min_y_i])]

    return {
        "trichion":              trichion,
        "hairline_left":         hairline_left,
        "hairline_center":       hairline_center,
        "hairline_right":        hairline_right,
        "forehead_top_estimate": forehead_top,
        "temple_left":           temple_left,
        "temple_right":          temple_right,
        "confidence":            overall_confidence,
        "column_y":              smoothed.tolist(),
    }


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _fill_nan(arr: np.ndarray) -> np.ndarray:
    """Linear-interpolate NaN gaps in a 1-D float array."""
    nans = np.isnan(arr)
    if not nans.any():
        return arr.copy()
    xs = np.arange(len(arr))
    arr = arr.copy()
    arr[nans] = np.interp(xs[nans], xs[~nans], arr[~nans])
    return arr


def _empty_result(face_landmarks_px: np.ndarray) -> dict:
    """Return a zero-confidence result pointing to lm[10] as fallback."""
    from app.domain.landmarks_mesh import P_FOREHEAD_CROWN
    pt = face_landmarks_px[P_FOREHEAD_CROWN, :2].tolist()
    return {
        "trichion":              pt,
        "hairline_left":         pt,
        "hairline_center":       pt,
        "hairline_right":        pt,
        "forehead_top_estimate": pt,
        "temple_left":           pt,
        "temple_right":          pt,
        "confidence":            0.0,
        "column_y":              [],
    }
