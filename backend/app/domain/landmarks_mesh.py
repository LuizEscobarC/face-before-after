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
LM_OUTER_MOUTH = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375]  # MediaPipe upper-outer-lip contour (L→R), NOT dlib order
LM_INNER_MOUTH = [78, 95, 88, 178, 87, 14, 317, 402]   # MediaPipe lower-inner-lip contour (L→centre), NOT dlib order
# 17 entries — must stay >=12 so quality_evaluator's LM_JAWLINE[5:12] slice is valid.
LM_JAWLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400]  # dlib 0–16
LM_LEFT_IRIS = [468, 469, 470, 471, 472]
LM_RIGHT_IRIS = [473, 474, 475, 476, 477]

# Bilateral lip mirror pairs (left ↔ right) in MediaPipe Mesh-478 index space.
# Single source of truth for bilateral-asymmetry calculations (marquardt /
# asymmetry heatmap). Midline points (0, 13, 14, 17) are intentionally excluded.
# NOTE: do NOT derive these by positional arithmetic on LM_OUTER_MOUTH /
# LM_INNER_MOUTH — those lists are MediaPipe contour order, so e.g. LM_OUTER_MOUTH[5]
# is the cupid's-bow CENTRE (idx 0), not a right-side point.
LIP_MIRROR_PAIRS = (
    # upper outer lip
    (61, 291), (185, 409), (40, 270), (39, 269), (37, 267),
    # lower inner lip
    (78, 308), (95, 324), (88, 318), (178, 402), (87, 317),
)

# Bilateral face-oval (jawline silhouette) mirror pairs (right ↔ left) in
# MediaPipe Mesh-478 index space. CRITICAL: LM_JAWLINE is the crown + the RIGHT
# half of the face oval only (every x >= midline), so positional arithmetic such
# as zip(LM_JAWLINE[:8], reversed(LM_JAWLINE[9:])) pairs right-side points with
# OTHER right-side points → garbage bilateral asymmetry on real faces. These
# explicit pairs are verified against the canonical FaceMesh (x_r + x_l ≈ 100,
# y_r ≈ y_l). Midline points (10 crown, 152 menton) are excluded.
FACE_OVAL_MIRROR_PAIRS = (
    (338, 109), (297, 67), (332, 103), (284, 54), (251, 21),
    (389, 162), (356, 127), (454, 234), (323, 93), (361, 132),
    (288, 58), (397, 172), (365, 136), (379, 150), (378, 149),
)


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
P_NOSE_LEFT = 48          # dlib 31 (left alar — lateral nostril wing, x≈220 in canonical face)
P_NOSE_RIGHT = 278        # dlib 35 (right alar — mirror of 48; corrected from 45 which is mid-bridge, PR-fix-2026-05-12)
# Lip vertical anchors — corrected to match MediaPipe FaceMesh-478 canonical
# topology after empirical inspection (PR-fix-2026-05-12):
#   - p0  = cupid's bow centre (topmost point of upper-lip vermilion)
#   - p13 = lower edge of upper-lip vermilion (inner mouth opening, top side)
#   - p14 = upper edge of lower-lip vermilion (inner mouth opening, bottom side)
#   - p17 = lowest visible point of lower lip (just above the mentolabial fold)
# Previous values (82/312/86/17) all clustered at y ≈ 479 px in a real photo —
# they were near-horizontal cluster around the mouth slit, NOT vertical anchors.
# That made upper_lip_height ≈ 0.02 ICU (essentially zero) and skewed
# upper_lip_height_ratio, lower_lip_height_ratio, lip_volume_ratio,
# vermilion_height_total, cupids_bow_definition, mentolabial_fold_proxy by
# >>500% deviation.
P_UPPER_LIP_TOP = 0       # cupid's bow centre (topmost upper-lip vermilion)
P_UPPER_LIP_BOT = 13      # mouth-slit upper edge (lower border of upper vermilion)
P_LOWER_LIP_TOP = 14      # mouth-slit lower edge (upper border of lower vermilion)
P_LOWER_LIP_BOT = 17      # lowermost lower-lip vermilion (above mentolabial fold)

# Eyelid midpoints and iris centres — used by eye-aperture and IPD metrics.
# Top/bot points are the vertical midpoints of the palpebral fissure at the
# horizontal centre of each eye (roughly where a slit-lamp would measure).
P_LEFT_EYE_TOP    = 159   # upper eyelid midpoint, left eye (Mesh-478)
P_RIGHT_EYE_TOP   = 386   # upper eyelid midpoint, right eye
P_LEFT_EYE_BOT    = 145   # lower eyelid midpoint, left  (= LM_LEFT_EYE[4])
P_RIGHT_EYE_BOT   = 374   # lower eyelid midpoint, right (= LM_RIGHT_EYE[4])
P_LEFT_IRIS_CENTER  = 468  # iris centre, left  (= LM_LEFT_IRIS[0])
P_RIGHT_IRIS_CENTER = 473  # iris centre, right (= LM_RIGHT_IRIS[0])
P_LEFT_IRIS_BOT     = 470  # left iris inferior edge  (= LM_LEFT_IRIS[2])
P_RIGHT_IRIS_BOT    = 475  # right iris inferior edge (= LM_RIGHT_IRIS[2])

# ---------------------------------------------------------------------------
# Wave C2/C3 — additional anatomical anchors (Mesh-478)
# ---------------------------------------------------------------------------
# Philtrum ridges — vertical crests flanking the philtrum (above upper lip).
# Used by cupids_bow_definition + philtrum_width_ratio (Wave C2).
P_PHILTRUM_LEFT  = 37     # upper-lip vermilion border, just left of midline
P_PHILTRUM_RIGHT = 267    # upper-lip vermilion border, just right of midline

# Masseter prominence proxies — lateral cheek points level with the mandibular
# angle. Used by masseteric_prominence_proxy (Wave C2).
P_MASSETER_L = 132        # left cheek lateral, ~masseter origin
P_MASSETER_R = 361        # right cheek lateral, ~masseter origin

# Tear-trough proxies — infraorbital hollow midpoints below each eye.
# Used by infraorbital_hollow_index (Wave C3).
P_TEAR_TROUGH_L = 228     # below left lower lid, on tear-trough line
P_TEAR_TROUGH_R = 448     # below right lower lid, on tear-trough line


# ---------------------------------------------------------------------------
# Aliases for legacy raw-index access patterns scattered through the codebase.
# These provide names for points that were referenced by raw dlib index (e.g.
# `lm[27]` = nose bridge top, `lm[1]`, `lm[15]` = bizygomatic anchors, etc.).
# ---------------------------------------------------------------------------
P_NASION = LM_NOSE_BRIDGE[0]                  # dlib 27 — top of nose bridge

# Bizygomatic anchors — outermost cheek points (maxima of facial width).
# In MediaPipe FaceMesh-478, points 234 (left) and 454 (right) are the
# canonical lateralmost facial contour landmarks, at the height of the
# zygomatic arch / cheekbone widest point. Empirically: distance between
# them divided by ICD gives ~4.3 ICU for an oval face — matches Farkas.
# Previously this was derived from LM_JAWLINE[1]/[15] (indices 338/378),
# which point to forehead/jaw-near-chin instead — produced bizygomatic
# values 10x too small and aspect ratios of 13+ instead of ~1.35.
P_LEFT_ZYGOMATIC = 234
P_RIGHT_ZYGOMATIC = 454

# Cheek anchors used in face_metrics skin ROIs — midpoint of cheek area,
# below zygomatic and above gonion. Points 50 (left) / 280 (right) are
# the cheek-prominence centroids in FaceMesh-478.
P_LEFT_CHEEK = 50
P_RIGHT_CHEEK = 280

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
# Jawline mirror pairs use the verified face-oval table — NOT positional
# arithmetic on LM_JAWLINE (which is one-sided: crown + right half only).
MIRROR_PAIRS_JAWLINE = list(FACE_OVAL_MIRROR_PAIRS)
MIRROR_PAIRS_BROWS = list(zip(LM_LEFT_BROW, list(reversed(LM_RIGHT_BROW))))
MIRROR_PAIRS_EYES = list(zip(LM_LEFT_EYE, LM_RIGHT_EYE))


__all__ = [
    "TOTAL_LANDMARKS",
    "LM_LEFT_EYE", "LM_RIGHT_EYE", "LM_LEFT_BROW", "LM_RIGHT_BROW",
    "LM_NOSE_BRIDGE", "LM_NOSE_TIP", "LM_OUTER_MOUTH", "LM_INNER_MOUTH",
    "LM_JAWLINE", "LM_LEFT_IRIS", "LM_RIGHT_IRIS", "LIP_MIRROR_PAIRS", "FACE_OVAL_MIRROR_PAIRS",
    "P_LEFT_EYE_TOP", "P_RIGHT_EYE_TOP", "P_LEFT_EYE_BOT", "P_RIGHT_EYE_BOT",
    "P_LEFT_IRIS_CENTER", "P_RIGHT_IRIS_CENTER",
    "P_LEFT_IRIS_BOT", "P_RIGHT_IRIS_BOT",
    "P_FOREHEAD_CROWN",
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
    "P_PHILTRUM_LEFT", "P_PHILTRUM_RIGHT",
    "P_MASSETER_L", "P_MASSETER_R",
    "P_TEAR_TROUGH_L", "P_TEAR_TROUGH_R",
    "PNP_LANDMARK_INDICES",
    "MIRROR_PAIRS_JAWLINE", "MIRROR_PAIRS_BROWS", "MIRROR_PAIRS_EYES",
]
