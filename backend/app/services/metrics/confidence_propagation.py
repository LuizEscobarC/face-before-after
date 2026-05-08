"""Confidence propagation for metric calculators (PR-5, updated PR-23).

Pipeline (PLAN_METRICS.md §5.6):
    1. confidence_raw * quality_score           (global quality gate)
    2. × regional_penalty_factor                (per-region occlusion/quality)
    3. × pose_penalty_factor                    (based on yaw/pitch)
    4. × landmark_stability_penalty (PR-23)     (only when capture_count > 1;
                                                 based on per-landmark jitter
                                                 across multi-capture frames)
    5. clip to [0, 1]

Symmetry metrics are most sensitive to yaw — if the head is turned, bilateral
comparisons are invalid.  Thirds/fifths care more about pitch (foreshortening
of vertical distances).  The ``PosePenaltyParams`` lets each metric family
tune the soft/hard thresholds and the yaw/pitch weight.

Landmark stability (step 4) is computed by
``app.services.landmark_stability.stability_factor_for_metric``.  The factor
is 1.0 when all dependency landmarks were perfectly stable across frames, and
decreases toward 0 as jitter increases.  Single-capture sessions always use
a factor of 1.0 (no penalty), preserving full backwards compatibility.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    import numpy as np  # only for type annotations — avoid circular imports

# Metrics with confidence_final below this are flagged as low-confidence.
LOW_CONF_THRESHOLD = 0.4


# ---------------------------------------------------------------------------
# Pose penalty
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class PosePenaltyParams:
    """Tunable thresholds for the piecewise-linear pose penalty.

    The penalty is 1.0 (no penalty) below *soft*, drops linearly to
    *floor* at *hard*, and stays at *floor* beyond *hard*.

    yaw_weight + pitch_weight should sum to 1.0; they define how the
    combined penalty is a weighted geometric mean of the two axis penalties.
    """

    yaw_soft_deg: float = 5.0
    yaw_hard_deg: float = 15.0
    pitch_soft_deg: float = 5.0
    pitch_hard_deg: float = 15.0
    floor: float = 0.2          # minimum multiplier at hard threshold
    yaw_weight: float = 0.7
    pitch_weight: float = 0.3


# Pre-built param sets for each metric family.
SYMMETRY_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=5.0, yaw_hard_deg=15.0,
    pitch_soft_deg=8.0, pitch_hard_deg=20.0,
    yaw_weight=0.8, pitch_weight=0.2,
)

THIRDS_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=8.0, yaw_hard_deg=20.0,
    pitch_soft_deg=5.0, pitch_hard_deg=12.0,
    yaw_weight=0.4, pitch_weight=0.6,
)

FIFTHS_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=5.0, yaw_hard_deg=12.0,
    pitch_soft_deg=8.0, pitch_hard_deg=20.0,
    yaw_weight=0.9, pitch_weight=0.1,
)

EYES_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=5.0, yaw_hard_deg=15.0,
    pitch_soft_deg=5.0, pitch_hard_deg=15.0,
    yaw_weight=0.6, pitch_weight=0.4,
)

# Jaw geometry is highly sensitive to yaw (silhouette becomes asymmetric in 2D
# when head is rotated). Pitch matters less. Floor is intentionally lower than
# eyes/symmetry because gonion landmarks on Mesh-478 are approximate (see
# landmarks_mesh.py TODOs) — small head turns already invalidate jaw width.
JAW_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=4.0, yaw_hard_deg=12.0,
    pitch_soft_deg=6.0, pitch_hard_deg=18.0,
    yaw_weight=0.8, pitch_weight=0.2,
    floor=0.15,
)

# Nose width and dorsum deviation are sensitive to yaw (alar foreshortening,
# tip displacement). Pitch matters less for X-axis ratios but affects vertical
# ratios (nose_length_to_icd) somewhat. Mid floor (~0.18).
NOSE_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=5.0, yaw_hard_deg=15.0,
    pitch_soft_deg=8.0, pitch_hard_deg=20.0,
    yaw_weight=0.7, pitch_weight=0.3,
    floor=0.18,
)

# Mouth landmarks are well-defined on Mesh-478 and central — least pose-sensitive
# of the M2 families. Yaw still affects horizontal ratios (mouth foreshortens),
# but pitch barely affects vermilion height ratios. Slightly relaxed vs nose.
MOUTH_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=6.0, yaw_hard_deg=16.0,
    pitch_soft_deg=8.0, pitch_hard_deg=20.0,
    yaw_weight=0.6, pitch_weight=0.4,
    floor=0.18,
)

# Brow landmarks (5 points per arch on Mesh-478) tolerate moderate yaw before
# the arch geometry foreshortens. Brow-height / tail-drop are also affected by
# pitch (the brow appears to rise/lower with head tilt), so pitch weight is
# slightly higher than for mouth. Floor is slightly lower than mouth because
# brow landmarks at the supraorbital ridge are stable across expressions.
BROW_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=5.0, yaw_hard_deg=15.0,
    pitch_soft_deg=8.0, pitch_hard_deg=20.0,
    yaw_weight=0.65, pitch_weight=0.35,
    floor=0.17,
)

# Cheekbone / midface metrics are highly sensitive to yaw — bizygomatic width
# collapses strongly when the head rotates (lateral projection foreshortens).
# Pitch affects midface_height_ratio (vertical distances distort with tilt)
# but less severely. Similar to jaw in sensitivity; slightly less strict on
# soft threshold because zygomatic landmarks (LM_JAWLINE[1/15]) are contour
# points and less approximate than gonion on Mesh-478. Floor matches brow.
CHEEKBONE_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=5.0, yaw_hard_deg=15.0,
    pitch_soft_deg=6.0, pitch_hard_deg=18.0,
    yaw_weight=0.75, pitch_weight=0.25,
    floor=0.17,
)

# Forehead metrics blend height (pitch-sensitive) and width (yaw-sensitive).
# Two of three active metrics are horizontal ratios (forehead_width_ratio,
# temporal_width_ratio) → yaw is the dominant error axis (weight=0.60).
# forehead_height_ratio is pitch-sensitive, but is somewhat forgiving because
# the forehead crown (Mesh-478 point 10) is a stable, high-contrast landmark.
# Slightly relaxed soft thresholds vs cheekbones since upper-face landmarks
# (brow arches, outer canthi) are less affected by lateral head rotation than
# bizygomatic contour points. Floor matches brow/cheekbone families.
FOREHEAD_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=5.0, yaw_hard_deg=15.0,
    pitch_soft_deg=6.0, pitch_hard_deg=16.0,
    yaw_weight=0.60, pitch_weight=0.40,
    floor=0.17,
)

# Global-shape metrics blend pitch-sensitive vertical ratios (face_height_to_width,
# face_shape_classification) with yaw-sensitive convexity (bizygomatic foreshortens
# with rotation). The two scored metrics split sensitivity evenly, so yaw/pitch weights
# are balanced (0.50/0.50). Soft thresholds are slightly relaxed vs forehead because
# crown-to-menton is a long baseline and tolerates moderate head tilt before the ratio
# changes significantly. Convexity also degrades gracefully under moderate yaw.
# Floor is slightly higher (0.20) than single-region families — global metrics are
# intended as summary indicators and should not drop to near-zero confidence from
# moderate pose variation.
GLOBAL_SHAPE_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=6.0, yaw_hard_deg=18.0,
    pitch_soft_deg=6.0, pitch_hard_deg=18.0,
    yaw_weight=0.50, pitch_weight=0.50,
    floor=0.20,
)

# Phi/golden-ratio metrics (PR-20) blend horizontal ratios (phi_nose_to_lip,
# phi_face_height_to_width) with vertical ratios (phi_lower_face_segments,
# phi_eye_to_mouth). Since 3 of 4 metrics have a significant vertical component,
# pitch weight is slightly higher than yaw. Thresholds are more relaxed than
# single-region families because these are presentation_only overlays — they
# should remain displayable under mild pose variation. Floor is higher (0.25)
# so the phi overlay stays visible in slightly turned photos.
PHI_POSE_PARAMS = PosePenaltyParams(
    yaw_soft_deg=8.0, yaw_hard_deg=22.0,
    pitch_soft_deg=7.0, pitch_hard_deg=20.0,
    yaw_weight=0.45, pitch_weight=0.55,
    floor=0.25,
)


def _axis_penalty(angle_deg: float, soft: float, hard: float, floor: float) -> float:
    """Piecewise linear penalty for a single rotation axis."""
    abs_a = abs(angle_deg)
    if abs_a <= soft:
        return 1.0
    if abs_a >= hard:
        return floor
    t = (abs_a - soft) / (hard - soft)
    return 1.0 - (1.0 - floor) * t


def pose_penalty(
    yaw_deg: float,
    pitch_deg: float,
    params: PosePenaltyParams | None = None,
) -> float:
    """Weighted geometric mean of yaw and pitch axis penalties.

    Returns a multiplier in [floor, 1.0].  A value of 1.0 means zero penalty.
    """
    if params is None:
        params = PosePenaltyParams()
    yaw_pen = _axis_penalty(yaw_deg, params.yaw_soft_deg, params.yaw_hard_deg, params.floor)
    pitch_pen = _axis_penalty(pitch_deg, params.pitch_soft_deg, params.pitch_hard_deg, params.floor)
    # Weighted geometric mean: P_y^w_y * P_p^w_p
    return (yaw_pen ** params.yaw_weight) * (pitch_pen ** params.pitch_weight)


# ---------------------------------------------------------------------------
# Regional penalty
# ---------------------------------------------------------------------------

def regional_penalty_factor(region: str, regional_penalties: dict[str, float]) -> float:
    """Convert a penalty fraction to a confidence multiplier.

    ``regional_penalties["symmetry"] = 0.2`` means 20% confidence reduction.
    Missing region → no penalty (factor = 1.0).
    """
    fraction = regional_penalties.get(region, 0.0)
    return max(0.0, 1.0 - float(fraction))


# ---------------------------------------------------------------------------
# Landmark stability penalty (PR-23, step 4)
# ---------------------------------------------------------------------------

def landmark_stability_penalty(
    stability_scores: list[float] | None,
    dependency_landmarks: list[int],
) -> float:
    """Stability factor in [0, 1] for a metric based on its dependency landmarks.

    Returns the mean stability score of the landmark indices consumed by the
    metric.  1.0 = all dependency landmarks were perfectly stable across
    multi-capture frames; 0.0 = all maximally unstable.

    Returns 1.0 (no penalty) when:
    - *stability_scores* is ``None`` (single-capture session — backwards compat).
    - *dependency_landmarks* is empty.
    - All dependency indices are out of range.

    Parameters
    ----------
    stability_scores : list[float] | None
        Per-landmark stability scores from
        ``LandmarkStabilityResult.to_scores_list()``.
        Pass ``None`` for single-capture sessions.
    dependency_landmarks : list[int]
        MediaPipe Mesh-478 indices consumed by the metric.
    """
    if stability_scores is None or not dependency_landmarks:
        return 1.0

    n = len(stability_scores)
    valid = [stability_scores[i] for i in dependency_landmarks if 0 <= i < n]
    if not valid:
        return 1.0

    # Use arithmetic mean: consistent with how regional_penalty_factor
    # aggregates across the region.
    return float(sum(valid) / len(valid))


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------

def propagate(
    confidence_raw: float,
    quality_score: float,
    region: str,
    regional_penalties: dict[str, float],
    yaw_deg: float = 0.0,
    pitch_deg: float = 0.0,
    pose_params: PosePenaltyParams | None = None,
    *,
    stability_scores: list[float] | None = None,
    dependency_landmarks: list[int] | None = None,
) -> float:
    """Apply the full confidence propagation pipeline.

    Steps 1–3 are always applied.  Step 4 (landmark stability) is applied
    only when *stability_scores* is not ``None`` AND *dependency_landmarks*
    is provided (i.e., when operating in multi-capture mode).

    Parameters
    ----------
    confidence_raw : float
        Initial confidence before any penalty (0–1).
    quality_score : float
        Global image quality score from the quality module (0–1).
    region : str
        Metric region key (e.g. ``"symmetry"``, ``"jaw"``).
    regional_penalties : dict[str, float]
        Per-region penalty fractions (0–1).
    yaw_deg : float
        Head yaw in degrees.
    pitch_deg : float
        Head pitch in degrees.
    pose_params : PosePenaltyParams | None
        Family-specific pose penalty configuration.  Defaults to
        ``PosePenaltyParams()`` when ``None``.
    stability_scores : list[float] | None
        Per-landmark stability scores (PR-23).  ``None`` = single-capture,
        no stability penalty applied.
    dependency_landmarks : list[int] | None
        Dependency landmark indices for step 4.  Ignored when
        *stability_scores* is ``None``.

    Returns
    -------
    float
        ``confidence_final`` clipped to [0, 1].
    """
    conf = float(confidence_raw) * float(quality_score)
    conf *= regional_penalty_factor(region, regional_penalties)
    conf *= pose_penalty(yaw_deg, pitch_deg, pose_params)
    # Step 4: landmark stability (multi-capture only; backwards compatible)
    conf *= landmark_stability_penalty(stability_scores, dependency_landmarks or [])
    return float(max(0.0, min(1.0, conf)))

