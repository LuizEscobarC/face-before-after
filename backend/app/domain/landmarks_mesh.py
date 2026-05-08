"""Single source of truth for anatomical landmark indices.

Uses MediaPipe Tasks Vision FaceLandmarker Mesh-478 layout
(468 base mesh + 10 iris from refine_landmarks=True).

Source: MediaPipe canonical face mesh + iris refinement indices
documented at https://developers.google.com/mediapipe/solutions/vision/face_landmarker.

All region lists / point constants below are the Mesh-478 equivalents of
the legacy dlib-68 anatomical points used throughout the pipeline.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Cardinality
# ---------------------------------------------------------------------------
TOTAL_LANDMARKS = 478


# ---------------------------------------------------------------------------
# Region lists (Mesh-478 indices)
# ---------------------------------------------------------------------------
LM_LEFT_EYE = [33, 7, 163, 144, 145, 153]              # dlib 36–41
LM_RIGHT_EYE = [263, 249, 390, 373, 374, 380]          # dlib 42–47
LM_LEFT_BROW = [70, 63, 105, 66, 107]                  # dlib 17–21
LM_RIGHT_BROW = [336, 296, 334, 293, 300]              # dlib 22–26
LM_NOSE_BRIDGE = [168, 6, 197, 195]                    # dlib 27–30
LM_NOSE_TIP = [48, 115, 220, 45, 4]                    # dlib 31–35
LM_OUTER_MOUTH = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375]  # dlib 48–59
LM_INNER_MOUTH = [78, 95, 88, 178, 87, 14, 317, 402]   # dlib 60–67
# 17 entries — must stay >=12 so quality_evaluator's LM_JAWLINE[5:12] slice is valid.
LM_JAWLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400]  # dlib 0–16
LM_LEFT_IRIS = [468, 469, 470, 471, 472]
LM_RIGHT_IRIS = [473, 474, 475, 476, 477]


# ---------------------------------------------------------------------------
# Point constants (Mesh-478 indices)
# ---------------------------------------------------------------------------
P_NOSE_TIP = 1            # dlib 30
P_MENTON = 152            # dlib 8 (chin bottom)
P_LEFT_EYE_OUTER = 33     # dlib 36
P_RIGHT_EYE_OUTER = 263   # dlib 45
P_LEFT_EYE_INNER = 133    # dlib 39
P_RIGHT_EYE_INNER = 362   # dlib 42
P_LEFT_MOUTH = 61         # dlib 48
P_RIGHT_MOUTH = 291       # dlib 54
P_UPPER_LIP = 13          # dlib 51 (labiale superius)
P_LOWER_LIP = 14          # dlib 57 (labiale inferius)
P_LEFT_GONION = 58        # dlib 4 (TODO: verify with real photo — gonion is approximate on Mesh-478)
P_RIGHT_GONION = 288      # dlib 12 (TODO: verify with real photo)
P_SUBNASALE = 2           # dlib 33
P_BROW_LEFT_INNER = 107   # dlib 21
P_BROW_RIGHT_INNER = 336  # dlib 22
P_NOSE_LEFT = 48          # dlib 31 (left alar)
P_NOSE_RIGHT = 45         # dlib 35 (right alar) — NOTE: 45 also appears in LM_NOSE_TIP, anatomically the right alar
P_UPPER_LIP_TOP = 82      # dlib 50
P_UPPER_LIP_BOT = 312     # dlib 62
P_LOWER_LIP_TOP = 86      # dlib 66
P_LOWER_LIP_BOT = 17      # dlib 58


# ---------------------------------------------------------------------------
# Aliases for legacy raw-index access patterns scattered through the codebase.
# These provide names for points that were referenced by raw dlib index (e.g.
# `lm[27]` = nose bridge top, `lm[1]`, `lm[15]` = bizygomatic anchors, etc.).
# ---------------------------------------------------------------------------
P_NASION = LM_NOSE_BRIDGE[0]                  # dlib 27 — top of nose bridge

# Bizygomatic anchors (dlib 1, 15) — outer cheek points on the jawline.
# In Mesh-478 the jawline indices LM_JAWLINE map dlib 0..16 → these positions.
P_LEFT_ZYGOMATIC = LM_JAWLINE[1]              # dlib 1
P_RIGHT_ZYGOMATIC = LM_JAWLINE[15]            # dlib 15

# Cheek anchors used in face_metrics skin ROIs (dlib 3, 13).
P_LEFT_CHEEK = LM_JAWLINE[3]                  # dlib 3
P_RIGHT_CHEEK = LM_JAWLINE[13]                # dlib 13

# Brow tilt anchors (dlib 17 outer-left, 21 inner-left, 22 inner-right, 26 outer-right).
P_BROW_LEFT_OUTER = LM_LEFT_BROW[0]           # dlib 17
P_BROW_RIGHT_OUTER = LM_RIGHT_BROW[-1]        # dlib 26

# Brow inner anchors (used as thirds upper/middle boundary).
# These are the innermost brow landmarks closest to the nose bridge.
P_BROW_LEFT_INNER = LM_LEFT_BROW[4]           # dlib 21 — left inner brow (idx 107)
P_BROW_RIGHT_INNER = LM_RIGHT_BROW[0]         # dlib 22 — right inner brow (idx 336)

# Forehead crown — Mesh-478 point 10, top-center of the forehead.
# Used as a proxy for the trichion (hairline) in vertical-thirds calculation.
P_FOREHEAD_CROWN = 10

# Jaw mid-pair anchors used in masculinity gonial-angle helpers
# (dlib 2, 6 around left gonion 4; dlib 14, 10 around right gonion 12).
P_JAW_LEFT_2 = LM_JAWLINE[2]                  # dlib 2
P_JAW_LEFT_6 = LM_JAWLINE[6]                  # dlib 6
P_JAW_RIGHT_14 = LM_JAWLINE[14]               # dlib 14
P_JAW_RIGHT_10 = LM_JAWLINE[10]               # dlib 10

# Brow inner-eyelid pair anchors (dlib 19, 24) — used for forehead/skin ROIs.
P_BROW_LEFT_MID = LM_LEFT_BROW[2]             # dlib 19 — middle of left brow
P_BROW_RIGHT_MID = LM_RIGHT_BROW[2]           # dlib 24 — middle of right brow


# ---------------------------------------------------------------------------
# PnP solver — 6 stable anchor points used by pose_estimator.
# Order matches pose_estimator._MODEL_3D (anatomy unchanged, only indices change).
# ---------------------------------------------------------------------------
PNP_LANDMARK_INDICES = [P_NOSE_TIP, P_MENTON, P_LEFT_EYE_OUTER,
                        P_RIGHT_EYE_OUTER, P_LEFT_MOUTH, P_RIGHT_MOUTH]


# ---------------------------------------------------------------------------
# Mirror pairs (left ↔ right) for symmetry / Marquardt deviation.
# Built from the region lists so they auto-stay consistent.
# ---------------------------------------------------------------------------
MIRROR_PAIRS_JAWLINE = list(zip(LM_JAWLINE[:8], list(reversed(LM_JAWLINE[9:]))))  # 8 pairs around menton (idx 8)
MIRROR_PAIRS_BROWS = list(zip(LM_LEFT_BROW, list(reversed(LM_RIGHT_BROW))))
MIRROR_PAIRS_EYES = list(zip(LM_LEFT_EYE, LM_RIGHT_EYE))


__all__ = [
    "TOTAL_LANDMARKS",
    "LM_LEFT_EYE", "LM_RIGHT_EYE", "LM_LEFT_BROW", "LM_RIGHT_BROW",
    "LM_NOSE_BRIDGE", "LM_NOSE_TIP", "LM_OUTER_MOUTH", "LM_INNER_MOUTH",
    "LM_JAWLINE", "LM_LEFT_IRIS", "LM_RIGHT_IRIS",
    "P_NOSE_TIP", "P_MENTON", "P_LEFT_EYE_OUTER", "P_RIGHT_EYE_OUTER",
    "P_LEFT_EYE_INNER", "P_RIGHT_EYE_INNER",
    "P_LEFT_MOUTH", "P_RIGHT_MOUTH", "P_UPPER_LIP", "P_LOWER_LIP",
    "P_LEFT_GONION", "P_RIGHT_GONION", "P_SUBNASALE",
    "P_BROW_LEFT_INNER", "P_BROW_RIGHT_INNER",
    "P_NOSE_LEFT", "P_NOSE_RIGHT",
    "P_UPPER_LIP_TOP", "P_UPPER_LIP_BOT", "P_LOWER_LIP_TOP", "P_LOWER_LIP_BOT",
    "P_NASION", "P_LEFT_ZYGOMATIC", "P_RIGHT_ZYGOMATIC",
    "P_LEFT_CHEEK", "P_RIGHT_CHEEK",
    "P_BROW_LEFT_OUTER", "P_BROW_RIGHT_OUTER",
    "P_JAW_LEFT_2", "P_JAW_LEFT_6", "P_JAW_RIGHT_14", "P_JAW_RIGHT_10",
    "P_BROW_LEFT_MID", "P_BROW_RIGHT_MID",
    "PNP_LANDMARK_INDICES",
    "MIRROR_PAIRS_JAWLINE", "MIRROR_PAIRS_BROWS", "MIRROR_PAIRS_EYES",
]
