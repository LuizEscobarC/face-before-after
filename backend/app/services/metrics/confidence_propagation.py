"""Confidence propagation for metric calculators (PR-5).

Pipeline (PLAN_METRICS.md §5.6):
    1. confidence_raw * quality_score         (global quality gate)
    2. × regional_penalty_factor              (per-region occlusion/quality)
    3. × pose_penalty_factor                  (based on yaw/pitch)
    4. clip to [0, 1]

Symmetry metrics are most sensitive to yaw — if the head is turned, bilateral
comparisons are invalid.  Thirds/fifths care more about pitch (foreshortening
of vertical distances).  The ``PosePenaltyParams`` lets each metric family
tune the soft/hard thresholds and the yaw/pitch weight.
"""

from __future__ import annotations

from dataclasses import dataclass

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
) -> float:
    """Apply the full confidence propagation pipeline.

    Returns ``confidence_final`` clipped to [0, 1].
    """
    conf = float(confidence_raw) * float(quality_score)
    conf *= regional_penalty_factor(region, regional_penalties)
    conf *= pose_penalty(yaw_deg, pitch_deg, pose_params)
    return float(max(0.0, min(1.0, conf)))
