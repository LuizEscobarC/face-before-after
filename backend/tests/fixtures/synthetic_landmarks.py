"""Synthetic landmark fixtures for normalization tests.

Three canonical test cases, each returning a (478, 3) NumPy array:

1. ``perfect_frontal``  — idealized frontal face, eyes perfectly level,
   no roll, no yaw, no pitch. Inner canthi at (350, 300) and (450, 300)
   — intercanthal distance = 100 px.

2. ``known_asymmetric`` — same structure but with visible left/right facial
   asymmetry (nose tip and chin shifted 8 px to the right of the midline).
   Useful to verify that metric calculators detect the asymmetry even after
   normalization does NOT remove asymmetry (it only handles pose/scale/roll).

3. ``posed_yaw15``      — same as perfect_frontal but with a 15° yaw
   (turned right) baked in: right-side landmarks are horizontally
   compressed by cos(15°) ≈ 0.966.

All fixtures use pixel coordinates roughly matching a 800×600 image.
Only the anatomically relevant indices (inner/outer canthi, nose tip, menton,
gonions, mouth corners) are set to meaningful values; the remaining 470+
points are scattered in a plausible grid so array indexing never raises.
"""

from __future__ import annotations

import math

import numpy as np

from app.domain.landmarks_mesh import (
    P_LEFT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_LEFT_GONION,
    P_LEFT_MOUTH,
    P_MENTON,
    P_NOSE_TIP,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_GONION,
    P_RIGHT_MOUTH,
    TOTAL_LANDMARKS,
)


# ---------------------------------------------------------------------------
# Shared geometry constants (pixel space, 800×600 image)
# ---------------------------------------------------------------------------
_IMG_W, _IMG_H = 800, 600
_FACE_CX, _FACE_CY = 400, 300          # face centroid
_ICD_PX = 100                          # intercanthal distance in pixels
_LEFT_INNER  = (_FACE_CX - _ICD_PX / 2, _FACE_CY)      # (350, 300)
_RIGHT_INNER = (_FACE_CX + _ICD_PX / 2, _FACE_CY)       # (450, 300)
_LEFT_OUTER  = (_FACE_CX - _ICD_PX * 1.5, _FACE_CY)     # (250, 300)
_RIGHT_OUTER = (_FACE_CX + _ICD_PX * 1.5, _FACE_CY)     # (550, 300)
_NOSE_TIP_PT = (_FACE_CX, _FACE_CY + 80)                # below eye level
_MENTON_PT   = (_FACE_CX, _FACE_CY + 200)               # chin
_L_MOUTH     = (_FACE_CX - 60, _FACE_CY + 140)
_R_MOUTH     = (_FACE_CX + 60, _FACE_CY + 140)
_L_GONION    = (_FACE_CX - 120, _FACE_CY + 180)
_R_GONION    = (_FACE_CX + 120, _FACE_CY + 180)


def _base_grid() -> np.ndarray:
    """Return a (478, 3) array with all points spread in a face-shaped oval."""
    rng = np.random.default_rng(42)
    angles = np.linspace(0, 2 * math.pi, TOTAL_LANDMARKS, endpoint=False)
    rx, ry = 160.0, 220.0  # rough face bounding ellipse
    pts = np.column_stack([
        _FACE_CX + rx * np.cos(angles) + rng.normal(0, 5, TOTAL_LANDMARKS),
        _FACE_CY + ry * np.sin(angles) + rng.normal(0, 5, TOTAL_LANDMARKS),
        np.zeros(TOTAL_LANDMARKS),
    ])
    return pts


def _set_key_points(pts: np.ndarray, mapping: dict[int, tuple[float, float]]) -> np.ndarray:
    """Overwrite specific landmark indices with anatomically correct coords."""
    out = pts.copy()
    for idx, (x, y) in mapping.items():
        out[idx] = [x, y, 0.0]
    return out


def _canonical_key_points() -> dict[int, tuple[float, float]]:
    return {
        P_LEFT_EYE_INNER:  _LEFT_INNER,
        P_RIGHT_EYE_INNER: _RIGHT_INNER,
        P_LEFT_EYE_OUTER:  _LEFT_OUTER,
        P_RIGHT_EYE_OUTER: _RIGHT_OUTER,
        P_NOSE_TIP:        _NOSE_TIP_PT,
        P_MENTON:          _MENTON_PT,
        P_LEFT_MOUTH:      _L_MOUTH,
        P_RIGHT_MOUTH:     _R_MOUTH,
        P_LEFT_GONION:     _L_GONION,
        P_RIGHT_GONION:    _R_GONION,
    }


# ---------------------------------------------------------------------------
# Public fixtures
# ---------------------------------------------------------------------------

def perfect_frontal() -> np.ndarray:
    """(478, 3) — idealized frontal face, inner canthi at y=300, ICD=100 px."""
    grid = _base_grid()
    return _set_key_points(grid, _canonical_key_points())


def known_asymmetric() -> np.ndarray:
    """(478, 3) — same as perfect_frontal but nose+chin shifted 8 px right."""
    shift = 8.0
    kp = _canonical_key_points()
    kp[P_NOSE_TIP] = (_FACE_CX + shift, _FACE_CY + 80)
    kp[P_MENTON]   = (_FACE_CX + shift, _FACE_CY + 200)
    grid = _base_grid()
    return _set_key_points(grid, kp)


def posed_yaw15() -> np.ndarray:
    """(478, 3) — frontal geometry compressed for 15° yaw (turned right).

    Right-side x-coordinates are compressed toward centre by cos(15°).
    The fixture exercises pose_correction's horizontal rescaling.
    """
    cos15 = math.cos(math.radians(15))
    cx = float(_FACE_CX)

    def compress_right(x: float, y: float) -> tuple[float, float]:
        """Compress points right of centre by cos(15°)."""
        if x > cx:
            return cx + (x - cx) * cos15, y
        return x, y

    kp = _canonical_key_points()
    # Compress right-side landmarks.
    kp[P_RIGHT_EYE_INNER] = compress_right(*kp[P_RIGHT_EYE_INNER])
    kp[P_RIGHT_EYE_OUTER] = compress_right(*kp[P_RIGHT_EYE_OUTER])
    kp[P_RIGHT_MOUTH]     = compress_right(*kp[P_RIGHT_MOUTH])
    kp[P_RIGHT_GONION]    = compress_right(*kp[P_RIGHT_GONION])

    grid = _base_grid()
    return _set_key_points(grid, kp)
