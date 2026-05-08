"""Synthetic landmark fixtures for normalisation + metric tests.

Canonical test cases, each returning a (478, 3) NumPy array:

1. ``perfect_frontal``   — idealized frontal face, eyes perfectly level,
   ICD = 100 px. Thirds are NOT equal (upper-dominant).

2. ``known_asymmetric``  — same but nose + chin shifted 8 px right.

3. ``posed_yaw15``       — right-side landmarks compressed for 15° yaw.

4. ``perfect_thirds``    — frontal face where all three vertical thirds
   equal 0.333. Uses the same brow/eye geometry as perfect_frontal but
   places forehead crown and menton so thirds are balanced.

All fixtures use pixel coordinates for an 800×600 image.
"""

from __future__ import annotations

import math

import numpy as np

from app.domain.landmarks_mesh import (
    LM_LEFT_BROW,
    LM_LEFT_EYE,
    LM_RIGHT_BROW,
    LM_RIGHT_EYE,
    P_BROW_LEFT_INNER,
    P_BROW_RIGHT_INNER,
    P_FOREHEAD_CROWN,
    P_LEFT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_LEFT_GONION,
    P_LEFT_MOUTH,
    P_MENTON,
    P_NASION,
    P_NOSE_TIP,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_GONION,
    P_RIGHT_MOUTH,
    P_SUBNASALE,
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

# Midline landmarks (on x = _FACE_CX, so x = 0 after normalization)
_NASION_PT      = (_FACE_CX, _FACE_CY - 55)             # forehead / top of nose bridge
_SUBNASALE_PT   = (_FACE_CX, _FACE_CY + 60)             # philtrum base
_FOREHEAD_PT    = (_FACE_CX, _FACE_CY - 200)            # forehead crown, 200 px above eye line

# Geometry for a *balanced thirds* face.
# Brow inner y = _FACE_CY - 28 (from _LEFT_BROW_PTS / _RIGHT_BROW_PTS above).
# Middle third length = subnasale_y - brow_inner_y = 60 - (-28) = 88 px.
# Equal thirds requires: forehead crown at brow - 88, menton at subnasale + 88.
_THIRDS_BROW_Y   = _FACE_CY - 28   # y of both inner brow peaks (from _*_BROW_PTS)
_THIRDS_LENGTH   = _SUBNASALE_PT[1] - _FACE_CY - (-28)  # 60 - (-28) = 88 px per third... wait
# Middle = subnasale_y - brow_inner_y = (_FACE_CY+60) - (_FACE_CY-28) = 88
_THIRDS_SEG      = 88.0             # pixels per third when balanced
_FOREHEAD_THIRDS_PT = (_FACE_CX, _FACE_CY - 28 - _THIRDS_SEG)  # = (400, 184)
_MENTON_THIRDS_PT   = (_FACE_CX, _FACE_CY + 60 + _THIRDS_SEG)  # = (400, 448)

# Eye outline landmarks — all at y = _FACE_CY so both eyes share the same y.
# Left eye: 6 points spanning x ≈ [250, 340].  Indices: LM_LEFT_EYE = [33, 7, 163, 144, 145, 153]
_LEFT_EYE_PTS: dict[int, tuple[float, float]] = {
    LM_LEFT_EYE[0]: (250, _FACE_CY),
    LM_LEFT_EYE[1]: (265, _FACE_CY + 2),
    LM_LEFT_EYE[2]: (285, _FACE_CY + 4),
    LM_LEFT_EYE[3]: (305, _FACE_CY + 6),
    LM_LEFT_EYE[4]: (320, _FACE_CY + 4),
    LM_LEFT_EYE[5]: (335, _FACE_CY + 2),
}
# Right eye: mirror of left eye. Indices: LM_RIGHT_EYE = [263, 249, 390, 373, 374, 380]
_RIGHT_EYE_PTS: dict[int, tuple[float, float]] = {
    LM_RIGHT_EYE[0]: (550, _FACE_CY),
    LM_RIGHT_EYE[1]: (535, _FACE_CY + 2),
    LM_RIGHT_EYE[2]: (515, _FACE_CY + 4),
    LM_RIGHT_EYE[3]: (495, _FACE_CY + 6),
    LM_RIGHT_EYE[4]: (480, _FACE_CY + 4),
    LM_RIGHT_EYE[5]: (465, _FACE_CY + 2),
}

# Brow landmarks — both brow arches have their peak at the same y.
# Left brow: 5 points, peak at index 2 (y = _FACE_CY - 35). LM_LEFT_BROW = [70, 63, 105, 66, 107]
_LEFT_BROW_PTS: dict[int, tuple[float, float]] = {
    LM_LEFT_BROW[0]: (280, _FACE_CY - 28),    # outer
    LM_LEFT_BROW[1]: (300, _FACE_CY - 33),
    LM_LEFT_BROW[2]: (315, _FACE_CY - 35),    # peak
    LM_LEFT_BROW[3]: (332, _FACE_CY - 33),
    LM_LEFT_BROW[4]: (348, _FACE_CY - 28),    # inner
}
# Right brow: mirror. LM_RIGHT_BROW = [336, 296, 334, 293, 300]
_RIGHT_BROW_PTS: dict[int, tuple[float, float]] = {
    LM_RIGHT_BROW[0]: (452, _FACE_CY - 28),   # inner
    LM_RIGHT_BROW[1]: (468, _FACE_CY - 33),
    LM_RIGHT_BROW[2]: (485, _FACE_CY - 35),   # peak
    LM_RIGHT_BROW[3]: (500, _FACE_CY - 33),
    LM_RIGHT_BROW[4]: (520, _FACE_CY - 28),   # outer
}


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
    kp: dict[int, tuple[float, float]] = {
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
        # Midline points (x = _FACE_CX → x = 0 after normalization)
        P_NASION:          _NASION_PT,
        P_SUBNASALE:       _SUBNASALE_PT,
        # Forehead crown — proxy for trichion (upper thirds boundary)
        P_FOREHEAD_CROWN:  _FOREHEAD_PT,
    }
    # Eye and brow outline landmarks (symmetric in the canonical face)
    kp.update(_LEFT_EYE_PTS)
    kp.update(_RIGHT_EYE_PTS)
    kp.update(_LEFT_BROW_PTS)
    kp.update(_RIGHT_BROW_PTS)
    return kp


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
    # Compress right-side landmarks (eye inner/outer, right eye outline, right brow, mouth, gonion).
    kp[P_RIGHT_EYE_INNER] = compress_right(*kp[P_RIGHT_EYE_INNER])
    kp[P_RIGHT_EYE_OUTER] = compress_right(*kp[P_RIGHT_EYE_OUTER])
    kp[P_RIGHT_MOUTH]     = compress_right(*kp[P_RIGHT_MOUTH])
    kp[P_RIGHT_GONION]    = compress_right(*kp[P_RIGHT_GONION])
    for idx in LM_RIGHT_EYE:
        kp[idx] = compress_right(*kp[idx])
    for idx in LM_RIGHT_BROW:
        kp[idx] = compress_right(*kp[idx])

    grid = _base_grid()
    return _set_key_points(grid, kp)


def perfect_thirds() -> np.ndarray:
    """(478, 3) — face where vertical thirds are perfectly balanced (each ≈ 0.333).

    Geometry in pixel space:
      Forehead crown (P_FOREHEAD_CROWN=10): y = 184  (116 px above eye line)
      Brow inner midline:                   y = 272  ( 28 px above eye line)
      Subnasale (P_SUBNASALE=2):            y = 360  ( 60 px below eye line)
      Menton (P_MENTON=152):               y = 448  (148 px below eye line)

    Each third = 88 px, total = 264 px → upper = middle = lower = 0.333.
    Note: Menton here is at y=448 (not 500 as in perfect_frontal).
    """
    kp = _canonical_key_points()
    # Override the two vertical anchors that define thirds balance.
    kp[P_FOREHEAD_CROWN] = _FOREHEAD_THIRDS_PT   # (400, 184)
    kp[P_MENTON]         = _MENTON_THIRDS_PT     # (400, 448)
    grid = _base_grid()
    return _set_key_points(grid, kp)
