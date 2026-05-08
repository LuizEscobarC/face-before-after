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
    P_LEFT_CHEEK,
    P_LEFT_EYE_BOT,
    P_LEFT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_LEFT_EYE_TOP,
    P_LEFT_GONION,
    P_LEFT_IRIS_CENTER,
    P_LEFT_MOUTH,
    P_LEFT_ZYGOMATIC,
    P_LOWER_LIP,
    P_LOWER_LIP_BOT,
    P_MENTON,
    P_NASION,
    P_NOSE_LEFT,
    P_NOSE_RIGHT,
    P_NOSE_TIP,
    P_RIGHT_EYE_BOT,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_EYE_TOP,
    P_RIGHT_GONION,
    P_RIGHT_IRIS_CENTER,
    P_RIGHT_MOUTH,
    P_RIGHT_CHEEK,
    P_RIGHT_ZYGOMATIC,
    P_SUBNASALE,
    P_UPPER_LIP,
    P_UPPER_LIP_TOP,
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

# Bizygomatic anchors — face left/right boundary for horizontal-fifths calculation.
# Placed at eye level (y = _FACE_CY) so x-only math applies cleanly.
# Distance from eye outer-canthus = 1 × ICD_PX → face width = 5 × ICD = 500 px.
# Each fifth = 100 px = 1.0 ICU → all five fifths ratio = 0.20 (canonical ideal).
_L_ZYGOMATIC = (_FACE_CX - _ICD_PX * 2.5, _FACE_CY)   # = (150, 300)
_R_ZYGOMATIC = (_FACE_CX + _ICD_PX * 2.5, _FACE_CY)   # = (650, 300)

# Eyelid top/bot midpoints and iris centres (eyes family, PR-8).
# Eye width (outer→inner) = 100 px = 1.0 ICU; height = 30 px = 0.30 ICU.
# Aperture ratio = 0.30 / 1.0 = 0.30 for perfect_frontal.
# Iris centres at horizontal midpoints of each eye → IPD = 200 px = 2.0 ICU.
_EYE_H_HALF  = 15   # half of vertical eye opening (px)
_L_EYE_CX    = (_LEFT_OUTER[0] + _LEFT_INNER[0]) / 2    # = 300 (left eye centre x)
_R_EYE_CX    = (_RIGHT_INNER[0] + _RIGHT_OUTER[0]) / 2  # = 500 (right eye centre x)
_EYE_APERTURE_PTS: dict[int, tuple[float, float]] = {
    P_LEFT_EYE_TOP:        (_L_EYE_CX, _FACE_CY - _EYE_H_HALF),   # (300, 285)
    P_LEFT_EYE_BOT:        (_L_EYE_CX, _FACE_CY + _EYE_H_HALF),   # (300, 315) overrides LM_LEFT_EYE[4]
    P_RIGHT_EYE_TOP:       (_R_EYE_CX, _FACE_CY - _EYE_H_HALF),   # (500, 285)
    P_RIGHT_EYE_BOT:       (_R_EYE_CX, _FACE_CY + _EYE_H_HALF),   # (500, 315) overrides LM_RIGHT_EYE[4]
    P_LEFT_IRIS_CENTER:    (_L_EYE_CX, _FACE_CY),                   # (300, 300)
    P_RIGHT_IRIS_CENTER:   (_R_EYE_CX, _FACE_CY),                   # (500, 300)
}

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
        # Bizygomatic anchors — face horizontal boundary for fifths calculation
        P_LEFT_ZYGOMATIC:  _L_ZYGOMATIC,
        P_RIGHT_ZYGOMATIC: _R_ZYGOMATIC,
    }
    # Eye and brow outline landmarks (symmetric in the canonical face)
    kp.update(_LEFT_EYE_PTS)
    kp.update(_RIGHT_EYE_PTS)
    kp.update(_LEFT_BROW_PTS)
    kp.update(_RIGHT_BROW_PTS)
    # Eyelid top/bot and iris centres applied LAST to override any conflicting
    # eye-outline entries (e.g., P_LEFT_EYE_BOT=145 = LM_LEFT_EYE[4]).
    kp.update(_EYE_APERTURE_PTS)
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


# ---------------------------------------------------------------------------
# Jaw fixture (PR-13)
# ---------------------------------------------------------------------------
# Canonical jaw geometry. After normalisation (intercanthal scale = 1.0):
#   bizygomatic = 4.0 ICU (zygomatics at x = 200, 600)
#   bigonial    = 3.2 ICU (gonions at x = 240, 560) → jaw_width_ratio = 0.80 ✓
#   menton at (400, 560) → mandibular_plane_angle = atan(80/160) ≈ 26.57° ✓
#   gonial angle at each gonion (zygomatic-gonion-menton) ≈ 129° (within green ±5° of 125°)
#   gonial asymmetry = 0° ✓
#   chin_height_ratio = (560-460) / (560-360) = 0.50 ✓ (lower_lip_bot at y=460)
_JAW_ZYG_L     = (200.0, _FACE_CY)         # (200, 300)
_JAW_ZYG_R     = (600.0, _FACE_CY)         # (600, 300)
_JAW_GONION_L  = (240.0, 480.0)
_JAW_GONION_R  = (560.0, 480.0)
_JAW_MENTON    = (_FACE_CX, 560.0)         # (400, 560)
_JAW_LOWER_LIP_BOT = (_FACE_CX, 460.0)     # (400, 460)


def perfect_jaw_face() -> np.ndarray:
    """(478, 3) — face with canonical jaw geometry.

    All six jaw metrics fall within their green range (close to ideal):
      jaw_width_ratio        ≈ 0.80 (ideal)
      gonial_angle_l/r       ≈ 129° (ideal 125°, |dev|=4 ≤ green ±5)
      gonial_angle_asymmetry ≈ 0° (ideal)
      mandibular_plane_angle ≈ 26.57° (ideal 27°)
      chin_height_ratio      ≈ 0.50 (ideal)
    """
    kp = _canonical_key_points()
    kp[P_LEFT_ZYGOMATIC]  = _JAW_ZYG_L
    kp[P_RIGHT_ZYGOMATIC] = _JAW_ZYG_R
    kp[P_LEFT_GONION]     = _JAW_GONION_L
    kp[P_RIGHT_GONION]    = _JAW_GONION_R
    kp[P_MENTON]          = _JAW_MENTON
    kp[P_LOWER_LIP_BOT]   = _JAW_LOWER_LIP_BOT
    grid = _base_grid()
    return _set_key_points(grid, kp)


def asymmetric_jaw_face() -> np.ndarray:
    """(478, 3) — jaw fixture with deliberate L/R gonial asymmetry.

    Right gonion shifted up by 30 px, leaving left side the canonical geometry.
    Yields gonial_angle_asymmetry > 8° (yellow range).
    """
    kp = _canonical_key_points()
    kp[P_LEFT_ZYGOMATIC]  = _JAW_ZYG_L
    kp[P_RIGHT_ZYGOMATIC] = _JAW_ZYG_R
    kp[P_LEFT_GONION]     = _JAW_GONION_L
    kp[P_RIGHT_GONION]    = (_JAW_GONION_R[0], _JAW_GONION_R[1] - 30.0)
    kp[P_MENTON]          = _JAW_MENTON
    kp[P_LOWER_LIP_BOT]   = _JAW_LOWER_LIP_BOT
    grid = _base_grid()
    return _set_key_points(grid, kp)


# ---------------------------------------------------------------------------
# Nose fixture (PR-14)
# ---------------------------------------------------------------------------
# Canonical nose geometry (after normalisation to ICU = 1.0):
#   nose_length_to_icd     = (subnasale.y - nasion.y) / 1.0 = 1.5 ICU
#   nose_width_to_icd      = alar_width / 1.0 = 1.0 ICU
#   alar_to_face_width     = 1.0 / 5.0 = 0.20 (bizygomatic = 5 ICU = 500 px)
#   nose_to_mouth_width    = alar / mouth = 100 / 154 ≈ 0.65
#   dorsum_deviation       = |nasion.x - tip.x| = 0
#   nasal_tip_deviation    = |tip.x - midline.x| = 0
#   alar_base_asymmetry    = |alar_l.y - alar_r.y| = 0
#
# Pixel layout (ICD = 100 px, _FACE_CX=400, _FACE_CY=300):
_NOSE_NASION       = (_FACE_CX, _FACE_CY - 75)            # (400, 225)
_NOSE_SUBNASALE    = (_FACE_CX, _FACE_CY + 75)            # (400, 375) → length=150 px
_NOSE_TIP_PT_NOSE  = (_FACE_CX, _FACE_CY + 30)            # (400, 330)  midway, on midline
_NOSE_ALAR_L       = (_FACE_CX - 50, _FACE_CY + 45)       # (350, 345)
_NOSE_ALAR_R       = (_FACE_CX + 50, _FACE_CY + 45)       # (450, 345)
_NOSE_MOUTH_L      = (_FACE_CX - 77, _FACE_CY + 140)      # (323, 440)  width=154 px
_NOSE_MOUTH_R      = (_FACE_CX + 77, _FACE_CY + 140)      # (477, 440)
# Bizygomatic anchors already at (_FACE_CX ± 250, _FACE_CY) = (150,300)/(650,300) = 5 ICU.


def perfect_nose_face() -> np.ndarray:
    """(478, 3) — face with canonical nose geometry.

    All seven nose metrics fall within their green range:
      nose_length_to_icd          = 1.50 (ideal)
      nose_width_to_icd           = 1.00 (ideal)
      alar_to_face_width_ratio    = 0.20 (ideal)
      nose_to_mouth_width_ratio   ≈ 0.649 (ideal 0.65)
      dorsum_deviation            = 0.00 (ideal)
      nasal_tip_deviation         = 0.00 (ideal)
      alar_base_asymmetry         = 0.00 (ideal)
    """
    kp = _canonical_key_points()
    kp[P_NASION]       = _NOSE_NASION
    kp[P_SUBNASALE]    = _NOSE_SUBNASALE
    kp[P_NOSE_TIP]     = _NOSE_TIP_PT_NOSE
    kp[P_NOSE_LEFT]    = _NOSE_ALAR_L
    kp[P_NOSE_RIGHT]   = _NOSE_ALAR_R
    kp[P_LEFT_MOUTH]   = _NOSE_MOUTH_L
    kp[P_RIGHT_MOUTH]  = _NOSE_MOUTH_R
    grid = _base_grid()
    return _set_key_points(grid, kp)


def deviated_nose_face() -> np.ndarray:
    """(478, 3) — nose fixture with deliberate dorsum + tip deviation.

    Nose tip shifted +12 px to the right (image), creating both a non-zero
    dorsum_deviation (nasion vs tip) and nasal_tip_deviation (tip vs midline).
    Yields ~0.12 ICU deviation (yellow range for both).
    """
    kp = _canonical_key_points()
    kp[P_NASION]       = _NOSE_NASION
    kp[P_SUBNASALE]    = _NOSE_SUBNASALE
    kp[P_NOSE_TIP]     = (_FACE_CX + 12, _FACE_CY + 30)
    kp[P_NOSE_LEFT]    = _NOSE_ALAR_L
    kp[P_NOSE_RIGHT]   = _NOSE_ALAR_R
    kp[P_LEFT_MOUTH]   = _NOSE_MOUTH_L
    kp[P_RIGHT_MOUTH]  = _NOSE_MOUTH_R
    grid = _base_grid()
    return _set_key_points(grid, kp)


# ---------------------------------------------------------------------------
# Mouth fixture (PR-15)
# ---------------------------------------------------------------------------
# Canonical mouth geometry (after normalisation to ICU = 1.0):
#   mouth_width_to_icd        = 150 / 100 = 1.50 ICU
#   mouth_to_face_width_ratio = 150 / 500 = 0.30
#   upper_lip_height_ratio    = 22 / 55 = 0.40
#   lower_lip_height_ratio    = 33 / 55 = 0.60
#   vermilion_height_total    = 55 / 100 = 0.55 ICU
#   lip_corner_canting        = 0
#   mouth_midline_deviation   = 0
#
# Pixel layout (ICD = 100 px, _FACE_CX=400, _FACE_CY=300):
#   stomion line (where lips meet) at y = _FACE_CY + 152 = 452
#   upper vermilion top         at y = _FACE_CY + 130 = 430  (height 22 px)
#   lower vermilion bottom      at y = _FACE_CY + 185 = 485  (height 33 px)
_MOUTH_LEFT_PT       = (_FACE_CX - 75, _FACE_CY + 152)   # (325, 452)
_MOUTH_RIGHT_PT      = (_FACE_CX + 75, _FACE_CY + 152)   # (475, 452) → width 150
_MOUTH_UPPER_LIP_TOP = (_FACE_CX,      _FACE_CY + 130)   # P_UPPER_LIP_TOP=82
_MOUTH_UPPER_LIP     = (_FACE_CX,      _FACE_CY + 152)   # P_UPPER_LIP=13 (stomion)
_MOUTH_LOWER_LIP     = (_FACE_CX,      _FACE_CY + 152)   # P_LOWER_LIP=14 (stomion, touching)
_MOUTH_LOWER_LIP_BOT = (_FACE_CX,      _FACE_CY + 185)   # P_LOWER_LIP_BOT=17


def perfect_mouth_face() -> np.ndarray:
    """(478, 3) — face with canonical mouth geometry.

    All seven mouth metrics fall within their green range:
      mouth_width_to_icd        = 1.50 (ideal)
      mouth_to_face_width_ratio = 0.30 (ideal)
      upper_lip_height_ratio    = 0.40 (ideal)
      lower_lip_height_ratio    = 0.60 (ideal)
      vermilion_height_total    = 0.55 (ideal)
      lip_corner_canting        = 0.00 (ideal)
      mouth_midline_deviation   = 0.00 (ideal)
    """
    kp = _canonical_key_points()
    kp[P_LEFT_MOUTH]      = _MOUTH_LEFT_PT
    kp[P_RIGHT_MOUTH]     = _MOUTH_RIGHT_PT
    kp[P_UPPER_LIP_TOP]   = _MOUTH_UPPER_LIP_TOP
    kp[P_UPPER_LIP]       = _MOUTH_UPPER_LIP
    kp[P_LOWER_LIP]       = _MOUTH_LOWER_LIP
    kp[P_LOWER_LIP_BOT]   = _MOUTH_LOWER_LIP_BOT
    grid = _base_grid()
    return _set_key_points(grid, kp)


def deviated_mouth_face() -> np.ndarray:
    """(478, 3) — mouth fixture with deliberate corner canting + midline shift.

    Left mouth corner shifted +12 px down (image coords) → corner_canting = 0.12 ICU
    (yellow). Both corners also shifted +10 px right → midline_deviation = 0.10 ICU
    (yellow).
    """
    kp = _canonical_key_points()
    kp[P_LEFT_MOUTH]      = (_FACE_CX - 75 + 10, _FACE_CY + 152 + 12)
    kp[P_RIGHT_MOUTH]     = (_FACE_CX + 75 + 10, _FACE_CY + 152)
    kp[P_UPPER_LIP_TOP]   = _MOUTH_UPPER_LIP_TOP
    kp[P_UPPER_LIP]       = _MOUTH_UPPER_LIP
    kp[P_LOWER_LIP]       = _MOUTH_LOWER_LIP
    kp[P_LOWER_LIP_BOT]   = _MOUTH_LOWER_LIP_BOT
    grid = _base_grid()
    return _set_key_points(grid, kp)


# ---------------------------------------------------------------------------
# Brow fixtures (PR-16)
# ---------------------------------------------------------------------------
# Canonical brow geometry (after normalisation to ICU = 1.0):
#   brow_height_l/r           = (300-265) / 100 = 0.35 ICU
#   brow_arch_peak_l/r        = 0.67 (apex 67% from inner to outer)
#   brow_thickness_l/r        = (265-245) / 100 = 0.20 ICU
#   brow_tail_drop_l          = (260-265) / 100 = -0.05 ICU (outer above inner)
#   interbrow_distance_ratio  = (450-350) / 100 = 1.0 ICU
#
# Left brow: LM_LEFT_BROW = [outer(0), ..., ..., ..., inner(4)] = [70, 63, 105, 66, 107]
#   [0]=70  outer : (250, 260)  — tail, slightly above inner (y=260 < 265)
#   [1]=63  arch  : (283, 245)  — arch peak (highest: min y across brow)
#   [2]=105 mid   : (315, 250)
#   [3]=66        : (333, 258)
#   [4]=107 inner : (350, 265)  — inner corner, 35 px above eye level (300)
#
# Right brow: LM_RIGHT_BROW = [inner(0), ..., ..., ..., outer(4)] = [336, 296, 334, 293, 300]
#   [0]=336 inner : (450, 265)
#   [1]=296       : (467, 258)
#   [2]=334 mid   : (485, 250)
#   [3]=293 arch  : (517, 245)  — arch peak (min y)
#   [4]=300 outer : (550, 260)  — tail, slightly above inner
#
# Inner brow gap = 450-350 = 100 px = 1.0 ICU  →  interbrow_distance_ratio = 1.0
_BROW_L_OUTER  = (250.0, 260.0)   # LM_LEFT_BROW[0]=70   tail, elevated
_BROW_L_ARCH   = (283.0, 245.0)   # LM_LEFT_BROW[1]=63   peak (highest point)
_BROW_L_MID    = (315.0, 250.0)   # LM_LEFT_BROW[2]=105  mid
_BROW_L_3      = (333.0, 258.0)   # LM_LEFT_BROW[3]=66
_BROW_L_INNER  = (350.0, 265.0)   # LM_LEFT_BROW[4]=107  inner corner

_BROW_R_INNER  = (450.0, 265.0)   # LM_RIGHT_BROW[0]=336 inner corner
_BROW_R_3      = (467.0, 258.0)   # LM_RIGHT_BROW[1]=296
_BROW_R_MID    = (485.0, 250.0)   # LM_RIGHT_BROW[2]=334 mid
_BROW_R_ARCH   = (517.0, 245.0)   # LM_RIGHT_BROW[3]=293 peak (highest point)
_BROW_R_OUTER  = (550.0, 260.0)   # LM_RIGHT_BROW[4]=300 tail, elevated

_CANONICAL_BROW_PTS: dict[int, tuple[float, float]] = {
    LM_LEFT_BROW[0]: _BROW_L_OUTER,
    LM_LEFT_BROW[1]: _BROW_L_ARCH,
    LM_LEFT_BROW[2]: _BROW_L_MID,
    LM_LEFT_BROW[3]: _BROW_L_3,
    LM_LEFT_BROW[4]: _BROW_L_INNER,
    LM_RIGHT_BROW[0]: _BROW_R_INNER,
    LM_RIGHT_BROW[1]: _BROW_R_3,
    LM_RIGHT_BROW[2]: _BROW_R_MID,
    LM_RIGHT_BROW[3]: _BROW_R_ARCH,
    LM_RIGHT_BROW[4]: _BROW_R_OUTER,
}


def perfect_brow_face() -> np.ndarray:
    """(478, 3) — face with canonical brow geometry.

    All eight brow metrics fall within their green range:
      brow_height_l/r           = 0.35 (ideal)
      brow_arch_peak_l/r        = 0.67 (ideal)
      brow_thickness_l/r        ≈ 0.20 (ideal; presentation_only)
      brow_tail_drop_l          = -0.05 (ideal; slightly lifted outer)
      interbrow_distance_ratio  = 1.00 (ideal)
    """
    kp = _canonical_key_points()
    kp.update(_CANONICAL_BROW_PTS)
    grid = _base_grid()
    return _set_key_points(grid, kp)


def drooping_brow_face() -> np.ndarray:
    """(478, 3) — brow fixture with deliberate left-side tail droop.

    Left outer brow lowered by 20 px (from y=260 to y=280), making
    brow_tail_drop_l = +0.15 ICU (drooping = positive, outer below inner).
    All other brow metrics remain at canonical values.
    """
    kp = _canonical_key_points()
    kp.update(_CANONICAL_BROW_PTS)
    # Override only the left outer brow (tail) to create droop
    kp[LM_LEFT_BROW[0]] = (_BROW_L_OUTER[0], _BROW_L_OUTER[1] + 20.0)  # (250, 280)
    grid = _base_grid()
    return _set_key_points(grid, kp)


# ---------------------------------------------------------------------------
# Cheekbone / midface fixtures (PR-17)
# ---------------------------------------------------------------------------
# Canonical cheekbone geometry. After normalisation (ICD = 100 px → 1.0 ICU):
#   P_LEFT_ZYGOMATIC  (338) at (200, 300) → x = −2.0 ICU
#   P_RIGHT_ZYGOMATIC (378) at (600, 300) → x = +2.0 ICU → bizygomatic = 4.0 ICU
#   P_LEFT_GONION     (58)  at (240, 480) → x = −1.6 ICU
#   P_RIGHT_GONION    (288) at (560, 480) → x = +1.6 ICU → bigonial    = 3.2 ICU
#   P_LEFT_EYE_OUTER  (33)  kept at (250, 300) via canonical kp → biocular = 3.0 ICU
#   P_SUBNASALE       (2)   at (400, 450) → y = +1.5 ICU (midface height)
#   P_LEFT_CHEEK      (332) at (220, 400) → x = −1.8 ICU
#   P_RIGHT_CHEEK     (365) at (580, 400) → x = +1.8 ICU → bicheek     = 3.6 ICU
#
# Metric values (ideal in brackets):
#   zygomatic_width_ratio   = 4.0 ICU  [4.00]
#   malar_projection_index  = 4.0/3.0 ≈ 1.333  [1.33]
#   midface_height_ratio    = 1.5 ICU  [1.50]
#   cheekbone_to_jaw_ratio  = 4.0/3.2 = 1.25   [1.25]
#   submalar_hollow_index   = 1−(3.6/4.0) = 0.10  [0.10]

_CHEEK_ZYG_L     = (200.0, _FACE_CY)        # bizygomatic = 400 px = 4.0 ICU total
_CHEEK_ZYG_R     = (600.0, _FACE_CY)
_CHEEK_GON_L     = (240.0, 480.0)           # bigonial = 320 px = 3.2 ICU
_CHEEK_GON_R     = (560.0, 480.0)
_CHEEK_SUBNASALE = (_FACE_CX, 450.0)        # midface height = 150 px = 1.5 ICU
_CHEEK_CHEEK_L   = (220.0, 400.0)           # bicheek = 360 px = 3.6 ICU
_CHEEK_CHEEK_R   = (580.0, 400.0)


def perfect_cheekbone_face() -> np.ndarray:
    """(478, 3) — face with canonical cheekbone / midface geometry.

    All five cheekbone metrics fall at or very near ideal:
      zygomatic_width_ratio   ≈ 4.00 ICU   (ideal 4.00)
      malar_projection_index  ≈ 1.333       (ideal 1.33, conf_raw > 0.99)
      midface_height_ratio    ≈ 1.50 ICU   (ideal 1.50)
      cheekbone_to_jaw_ratio  ≈ 1.25        (ideal 1.25)
      submalar_hollow_index   ≈ 0.10        (ideal 0.10)
    """
    kp = _canonical_key_points()
    kp[P_LEFT_ZYGOMATIC]  = _CHEEK_ZYG_L
    kp[P_RIGHT_ZYGOMATIC] = _CHEEK_ZYG_R
    kp[P_LEFT_GONION]     = _CHEEK_GON_L
    kp[P_RIGHT_GONION]    = _CHEEK_GON_R
    kp[P_SUBNASALE]       = _CHEEK_SUBNASALE
    kp[P_LEFT_CHEEK]      = _CHEEK_CHEEK_L
    kp[P_RIGHT_CHEEK]     = _CHEEK_CHEEK_R
    grid = _base_grid()
    return _set_key_points(grid, kp)


def square_jaw_cheekbone_face() -> np.ndarray:
    """(478, 3) — cheekbone fixture with a wide jaw (square-jaw phenotype).

    Gonions moved outward so bigonial ≈ bizygomatic:
      P_LEFT_GONION  at (160, 480) → x = −2.4 ICU
      P_RIGHT_GONION at (640, 480) → x = +2.4 ICU → bigonial = 4.8 ICU
      cheekbone_to_jaw_ratio = 4.0 / 4.8 ≈ 0.833 → 'square_jaw' direction
    All other metrics remain at canonical values.
    """
    kp = _canonical_key_points()
    kp[P_LEFT_ZYGOMATIC]  = _CHEEK_ZYG_L
    kp[P_RIGHT_ZYGOMATIC] = _CHEEK_ZYG_R
    kp[P_LEFT_GONION]     = (160.0, 480.0)
    kp[P_RIGHT_GONION]    = (640.0, 480.0)
    kp[P_SUBNASALE]       = _CHEEK_SUBNASALE
    kp[P_LEFT_CHEEK]      = _CHEEK_CHEEK_L
    kp[P_RIGHT_CHEEK]     = _CHEEK_CHEEK_R
    grid = _base_grid()
    return _set_key_points(grid, kp)
