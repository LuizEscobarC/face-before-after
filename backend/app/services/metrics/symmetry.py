"""Symmetry metric family — 5 metrics (PR-5).

All operate on ``NormalizedLandmarks`` (basis="intercanthal", ICD=1.0 ICU).
After normalization:
- x = 0  is the vertical midline (inner-canthus midpoint)
- x > 0  is the right side of the face (from subject's perspective, left on photo)
- y = 0  is the intercanthal horizontal
- y > 0  is below the eye line (larger values = chin direction)

Metric identities (PLAN_METRICS.md §5.3):
    midline_deviation       mean |x| of 4 midline anatomical points
    eye_height_asymmetry    |mean_y(left_eye) − mean_y(right_eye)|
    brow_height_asymmetry   |peak_y(left_brow) − peak_y(right_brow)|
    lip_canting_angle       angle of mouth-corner axis vs horizontal (degrees)
    global_asymmetry_index  weighted composite of the 4 above (index_0_1)
"""

from __future__ import annotations

import math

import numpy as np

from app.domain.landmarks_mesh import (
    LM_LEFT_BROW,
    LM_LEFT_EYE,
    LM_RIGHT_BROW,
    LM_RIGHT_EYE,
    P_LEFT_MOUTH,
    P_MENTON,
    P_NASION,
    P_NOSE_TIP,
    P_RIGHT_MOUTH,
    P_SUBNASALE,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.registry import register
from app.services.metrics.confidence_propagation import (
    LOW_CONF_THRESHOLD,
    SYMMETRY_POSE_PARAMS,
    propagate,
)

# ---------------------------------------------------------------------------
# Midline anatomical reference points (x ≈ 0 after normalization)
# ---------------------------------------------------------------------------
_MIDLINE_POINTS: tuple[int, ...] = (P_NASION, P_NOSE_TIP, P_SUBNASALE, P_MENTON)

# Reference severity scales — values at which each component = 1.0 normalized
_MIDLINE_SCALE_ICU: float = 0.15   # 0.15 ICU = severe midline deviation
_EYE_SCALE_ICU: float = 0.10       # 0.10 ICU = severe eye height difference
_BROW_SCALE_ICU: float = 0.12      # 0.12 ICU = severe brow height difference
_LIP_SCALE_DEG: float = 5.0        # 5° = severe lip canting


# ---------------------------------------------------------------------------
# Pure math helpers — no MetricValue created, used by ≥1 calculator
# ---------------------------------------------------------------------------

def _midline_components(lm: NormalizedLandmarks) -> tuple[float, float, float]:
    """Return (value, error, mean_signed_x) for midline_deviation."""
    xs = np.array([lm.xy(i)[0] for i in _MIDLINE_POINTS], dtype=float)
    abs_xs = np.abs(xs)
    return float(np.mean(abs_xs)), float(np.std(abs_xs)), float(np.mean(xs))


def _eye_height_components(lm: NormalizedLandmarks) -> tuple[float, float, float]:
    """Return (value, error, left_y − right_y) for eye_height_asymmetry."""
    left_y = float(np.mean([lm.xy(i)[1] for i in LM_LEFT_EYE]))
    right_y = float(np.mean([lm.xy(i)[1] for i in LM_RIGHT_EYE]))
    diff = left_y - right_y
    return abs(diff), 0.003, diff


def _brow_height_components(lm: NormalizedLandmarks) -> tuple[float, float, float]:
    """Return (value, error, left_peak_y − right_peak_y) for brow_height_asymmetry.

    Brow "peak" = the landmark with the minimum y (highest position in the image).
    In normalized coords y-down, minimum y = highest position.
    """
    left_peak_y = float(min(lm.xy(i)[1] for i in LM_LEFT_BROW))
    right_peak_y = float(min(lm.xy(i)[1] for i in LM_RIGHT_BROW))
    diff = left_peak_y - right_peak_y
    return abs(diff), 0.005, diff


def _lip_canting_components(lm: NormalizedLandmarks) -> tuple[float, float, float]:
    """Return (abs_angle_deg, error_deg, signed_angle_deg) for lip_canting_angle.

    Positive angle → right corner is lower than left corner → 'left_higher'.
    Negative angle → left corner is lower → 'right_higher'.
    """
    left_xy = lm.xy(P_LEFT_MOUTH)
    right_xy = lm.xy(P_RIGHT_MOUTH)
    dx = float(right_xy[0] - left_xy[0])
    dy = float(right_xy[1] - left_xy[1])
    signed_deg = math.degrees(math.atan2(dy, dx))
    return abs(signed_deg), 0.3, signed_deg


# ---------------------------------------------------------------------------
# Metric calculators
# ---------------------------------------------------------------------------

@register
class MidlineDeviationCalculator(MetricCalculator):
    """Mean absolute x-deviation of 4 midline landmarks from x=0.

    Points: nasion (168), nose tip (1), subnasale (2), menton (152).
    Unit: intercanthal_units (ICD = 1.0).
    """

    metric_id = "midline_deviation"
    region = "symmetry"
    family = "symmetry"
    unit = "intercanthal_units"
    _DEP_LM: tuple[int, ...] = _MIDLINE_POINTS

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        value, error, mean_x = _midline_components(lm)
        # Confidence saturates when deviation reaches 0.5 ICU (extreme).
        confidence_raw = max(0.0, 1.0 - value / 0.5)
        direction = (
            "neutral"
            if value < 0.01
            else ("right_deviation" if mean_x > 0 else "left_deviation")
        )
        confidence_final = propagate(
            confidence_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=SYMMETRY_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=value, error=error,
            confidence_raw=confidence_raw, confidence_final=confidence_final,
            is_low_confidence=confidence_final < LOW_CONF_THRESHOLD,
            direction=direction,
            dependency_landmarks=self._DEP_LM,
            presentation_only=self.presentation_only,
        )


@register
class EyeHeightAsymmetryCalculator(MetricCalculator):
    """Absolute difference in vertical position between left and right eye centres.

    Eye centre = mean y of the 6 outline landmarks per eye.
    Unit: intercanthal_units.
    """

    metric_id = "eye_height_asymmetry"
    region = "symmetry"
    family = "symmetry"
    unit = "intercanthal_units"
    _DEP_LM: tuple[int, ...] = tuple(set(LM_LEFT_EYE + LM_RIGHT_EYE))

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        value, error, diff = _eye_height_components(lm)
        confidence_raw = max(0.0, 1.0 - value / 0.3)
        direction = (
            "neutral"
            if value < 0.005
            else ("left_higher" if diff < 0 else "right_higher")
        )
        confidence_final = propagate(
            confidence_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=SYMMETRY_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=value, error=error,
            confidence_raw=confidence_raw, confidence_final=confidence_final,
            is_low_confidence=confidence_final < LOW_CONF_THRESHOLD,
            direction=direction,
            dependency_landmarks=self._DEP_LM,
            presentation_only=False,
        )


@register
class BrowHeightAsymmetryCalculator(MetricCalculator):
    """Absolute difference in peak height between left and right brows.

    Peak = landmark with minimum y (highest anatomical position).
    Unit: intercanthal_units.
    """

    metric_id = "brow_height_asymmetry"
    region = "symmetry"
    family = "symmetry"
    unit = "intercanthal_units"
    _DEP_LM: tuple[int, ...] = tuple(set(LM_LEFT_BROW + LM_RIGHT_BROW))

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        value, error, diff = _brow_height_components(lm)
        confidence_raw = max(0.0, 1.0 - value / 0.4)
        direction = (
            "neutral"
            if value < 0.005
            else ("left_higher" if diff < 0 else "right_higher")
        )
        confidence_final = propagate(
            confidence_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=SYMMETRY_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=value, error=error,
            confidence_raw=confidence_raw, confidence_final=confidence_final,
            is_low_confidence=confidence_final < LOW_CONF_THRESHOLD,
            direction=direction,
            dependency_landmarks=self._DEP_LM,
            presentation_only=False,
        )


@register
class LipCantingAngleCalculator(MetricCalculator):
    """Angle of the mouth-corner axis relative to horizontal (degrees).

    Positive angle = right corner lower than left = 'left_higher'.
    Negative angle = left corner lower = 'right_higher'.
    Value is always the absolute angle; sign encoded in *direction*.
    Unit: degrees.
    """

    metric_id = "lip_canting_angle"
    region = "symmetry"
    family = "symmetry"
    unit = "degrees"
    _DEP_LM: tuple[int, ...] = (P_LEFT_MOUTH, P_RIGHT_MOUTH)

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        value, error, signed_deg = _lip_canting_components(lm)
        confidence_raw = max(0.0, 1.0 - value / 30.0)
        direction = (
            "neutral"
            if value < 0.5
            else ("left_higher" if signed_deg > 0 else "right_higher")
        )
        confidence_final = propagate(
            confidence_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=SYMMETRY_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=value, error=error,
            confidence_raw=confidence_raw, confidence_final=confidence_final,
            is_low_confidence=confidence_final < LOW_CONF_THRESHOLD,
            direction=direction,
            dependency_landmarks=self._DEP_LM,
            presentation_only=False,
        )


@register
class GlobalAsymmetryIndexCalculator(MetricCalculator):
    """Weighted composite asymmetry index ∈ [0, 1].

    Combines the 4 other symmetry metrics after normalizing each to a
    reference severity scale.  0 = perfectly symmetric, 1 = extreme.

    Weights (subject to calibration):
        midline_deviation    0.30
        eye_height_asymmetry 0.25
        brow_height_asymmetry 0.25
        lip_canting_angle    0.20
    """

    metric_id = "global_asymmetry_index"
    region = "symmetry"
    family = "symmetry"
    unit = "index_0_1"
    _DEP_LM: tuple[int, ...] = tuple(sorted(set(
        list(_MIDLINE_POINTS)
        + LM_LEFT_EYE + LM_RIGHT_EYE
        + LM_LEFT_BROW + LM_RIGHT_BROW
        + [P_LEFT_MOUTH, P_RIGHT_MOUTH]
    )))
    _WEIGHTS = (0.30, 0.25, 0.25, 0.20)

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        # Re-compute raw component values (avoid MetricValue overhead).
        midline_v, midline_e, _ = _midline_components(lm)
        eye_v, eye_e, _        = _eye_height_components(lm)
        brow_v, brow_e, _      = _brow_height_components(lm)
        lip_v, lip_e, _        = _lip_canting_components(lm)

        # Normalise each component to its reference scale.
        norms = (
            midline_v / _MIDLINE_SCALE_ICU,
            eye_v     / _EYE_SCALE_ICU,
            brow_v    / _BROW_SCALE_ICU,
            lip_v     / _LIP_SCALE_DEG,
        )
        errors_n = (
            midline_e / _MIDLINE_SCALE_ICU,
            eye_e     / _EYE_SCALE_ICU,
            brow_e    / _BROW_SCALE_ICU,
            lip_e     / _LIP_SCALE_DEG,
        )

        w = self._WEIGHTS
        value = float(min(1.0, sum(wi * ni for wi, ni in zip(w, norms))))
        error = float(sum(wi * ei for wi, ei in zip(w, errors_n)))

        # Confidence = weighted mean of per-component confidence_raw values.
        comp_confs_raw = (
            max(0.0, 1.0 - midline_v / 0.5),
            max(0.0, 1.0 - eye_v / 0.3),
            max(0.0, 1.0 - brow_v / 0.4),
            max(0.0, 1.0 - lip_v / 30.0),
        )
        confidence_raw = float(sum(wi * ci for wi, ci in zip(w, comp_confs_raw)))
        confidence_final = propagate(
            confidence_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=SYMMETRY_POSE_PARAMS,
        )

        direction = "neutral" if value < 0.1 else "asymmetric"

        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=value, error=error,
            confidence_raw=confidence_raw, confidence_final=confidence_final,
            is_low_confidence=confidence_final < LOW_CONF_THRESHOLD,
            direction=direction,
            dependency_landmarks=self._DEP_LM,
            presentation_only=False,
        )
