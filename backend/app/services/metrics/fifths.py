"""Horizontal fifths metric family (PR-7).

Classical facial fifths divide the face width into five equal vertical bands:

  Fifth 1:  left face edge  → left outer canthus        (left temple)
  Fifth 2:  left outer canthus → left inner canthus     (left eye width)
  Fifth 3:  left inner canthus → right inner canthus    (intercanthal = 1.0 ICU)
  Fifth 4:  right inner canthus → right outer canthus   (right eye width)
  Fifth 5:  right outer canthus → right face edge       (right temple)

Ideal canonical: 0.20 each (PLAN_METRICS §5.3).  Green ±0.02.

Sixth metric:
  ``intercanthal_to_eye_width_ratio`` — ICD / avg eye width.
  Ideal: 1.0 (equals-eye-width rule).

Landmarks:
  - P_LEFT_ZYGOMATIC  (LM_JAWLINE[1] = 338): outer cheek / bizygomatic left
  - P_LEFT_EYE_OUTER  (33): left outer canthus
  - P_LEFT_EYE_INNER  (133): left inner canthus
  - P_RIGHT_EYE_INNER (362): right inner canthus
  - P_RIGHT_EYE_OUTER (263): right outer canthus
  - P_RIGHT_ZYGOMATIC (LM_JAWLINE[15] = 378): outer cheek / bizygomatic right

Sensitivity to pose: fifths are horizontal distances → yaw (head rotation) is
the dominant error axis. Pitch barely affects horizontal proportions.
Uses FIFTHS_POSE_PARAMS (yaw_weight=0.9, pitch_weight=0.1).
"""

from __future__ import annotations

from app.domain.landmarks_mesh import (
    P_LEFT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_LEFT_ZYGOMATIC,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_ZYGOMATIC,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.registry import register
from app.services.metrics.confidence_propagation import (
    LOW_CONF_THRESHOLD,
    FIFTHS_POSE_PARAMS,
    propagate,
)

# ---------------------------------------------------------------------------
# Landmark dependency tuples
# ---------------------------------------------------------------------------
_FIFTHS_DEP_LM: tuple[int, ...] = (
    P_LEFT_ZYGOMATIC,
    P_LEFT_EYE_OUTER,
    P_LEFT_EYE_INNER,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_ZYGOMATIC,
)
_EYE_WIDTH_DEP_LM: tuple[int, ...] = (
    P_LEFT_EYE_OUTER,
    P_LEFT_EYE_INNER,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
)

# Ideal canonical values
_IDEAL_FIFTH: float = 0.20          # each of the five fifths
_IDEAL_ICD_EYE: float = 1.0        # intercanthal / eye_width
_MAX_DEV_FIFTH: float = 0.40       # deviation at which conf_raw → 0
_MAX_DEV_ICD_EYE: float = 1.0


# ---------------------------------------------------------------------------
# Pure math helpers
# ---------------------------------------------------------------------------

def _fifths_geometry(lm: NormalizedLandmarks) -> tuple[list[float], float]:
    """Return ([f1, f2, f3, f4, f5], total_width) in intercanthal units.

    Returns ([0.20]*5, 0.0) for degenerate (zero-width) faces.
    """
    x_fl = float(lm.xy(P_LEFT_ZYGOMATIC)[0])    # face left edge
    x_lo = float(lm.xy(P_LEFT_EYE_OUTER)[0])    # left outer canthus
    x_li = float(lm.xy(P_LEFT_EYE_INNER)[0])    # left inner canthus
    x_ri = float(lm.xy(P_RIGHT_EYE_INNER)[0])   # right inner canthus
    x_ro = float(lm.xy(P_RIGHT_EYE_OUTER)[0])   # right outer canthus
    x_fr = float(lm.xy(P_RIGHT_ZYGOMATIC)[0])   # face right edge

    total = x_fr - x_fl
    if abs(total) < 1e-9:
        return [_IDEAL_FIFTH] * 5, 0.0

    ratios = [
        (x_lo - x_fl) / total,   # fifth 1: left temple
        (x_li - x_lo) / total,   # fifth 2: left eye width
        (x_ri - x_li) / total,   # fifth 3: intercanthal
        (x_ro - x_ri) / total,   # fifth 4: right eye width
        (x_fr - x_ro) / total,   # fifth 5: right temple
    ]
    return [float(r) for r in ratios], float(total)


def _icd_to_eye_width(lm: NormalizedLandmarks) -> float:
    """ICD / average eye width in intercanthal units."""
    icd = float(lm.xy(P_RIGHT_EYE_INNER)[0]) - float(lm.xy(P_LEFT_EYE_INNER)[0])
    left_w  = abs(float(lm.xy(P_LEFT_EYE_INNER)[0])  - float(lm.xy(P_LEFT_EYE_OUTER)[0]))
    right_w = abs(float(lm.xy(P_RIGHT_EYE_OUTER)[0]) - float(lm.xy(P_RIGHT_EYE_INNER)[0]))
    avg_w = (left_w + right_w) / 2.0
    if avg_w < 1e-9:
        return _IDEAL_ICD_EYE
    return icd / avg_w


def _fifth_confidence(ratio: float) -> float:
    """confidence_raw for a single fifth ratio."""
    return max(0.0, 1.0 - abs(ratio - _IDEAL_FIFTH) / _MAX_DEV_FIFTH)


def _fifth_direction(ratio: float) -> str:
    """Semantic label relative to ideal 0.20."""
    if abs(ratio - _IDEAL_FIFTH) < 0.01:
        return "neutral"
    return "wide" if ratio > _IDEAL_FIFTH else "narrow"


def _icd_eye_direction(ratio: float) -> str:
    """Semantic label for intercanthal_to_eye_width_ratio."""
    if abs(ratio - _IDEAL_ICD_EYE) < 0.05:
        return "neutral"
    return "wide_set" if ratio > _IDEAL_ICD_EYE else "close_set"


# ---------------------------------------------------------------------------
# Metric calculators
# ---------------------------------------------------------------------------

@register
class FifthOneRatioCalculator(MetricCalculator):
    """Ratio of left temple (face edge → left outer canthus) to face width.

    Ideal: 0.20. 'wide' = large left temple; 'narrow' = cramped left temple.
    """

    metric_id = "fifth_1_ratio"
    region = "symmetry"
    family = "fifths"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        ratios, _ = _fifths_geometry(lm)
        v = ratios[0]
        conf_raw = _fifth_confidence(v)
        conf_final = propagate(
            conf_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=FIFTHS_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=conf_raw, confidence_final=conf_final,
            is_low_confidence=conf_final < LOW_CONF_THRESHOLD,
            direction=_fifth_direction(v),
            dependency_landmarks=_FIFTHS_DEP_LM,
        )


@register
class FifthTwoRatioCalculator(MetricCalculator):
    """Ratio of left eye width (left outer → left inner canthus) to face width.

    Ideal: 0.20. 'wide' = large eye opening; 'narrow' = small eye.
    """

    metric_id = "fifth_2_ratio"
    region = "symmetry"
    family = "fifths"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        ratios, _ = _fifths_geometry(lm)
        v = ratios[1]
        conf_raw = _fifth_confidence(v)
        conf_final = propagate(
            conf_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=FIFTHS_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=conf_raw, confidence_final=conf_final,
            is_low_confidence=conf_final < LOW_CONF_THRESHOLD,
            direction=_fifth_direction(v),
            dependency_landmarks=_FIFTHS_DEP_LM,
        )


@register
class FifthThreeRatioCalculator(MetricCalculator):
    """Ratio of intercanthal distance to face width.

    Fifth 3 equals 1.0 ICU / total_face_width_in_ICU.
    Ideal: 0.20. 'wide' = hypertelorism (wide-set eyes).
    """

    metric_id = "fifth_3_ratio"
    region = "symmetry"
    family = "fifths"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        ratios, _ = _fifths_geometry(lm)
        v = ratios[2]
        conf_raw = _fifth_confidence(v)
        conf_final = propagate(
            conf_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=FIFTHS_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=conf_raw, confidence_final=conf_final,
            is_low_confidence=conf_final < LOW_CONF_THRESHOLD,
            direction=_fifth_direction(v),
            dependency_landmarks=_FIFTHS_DEP_LM,
        )


@register
class FifthFourRatioCalculator(MetricCalculator):
    """Ratio of right eye width (right inner → right outer canthus) to face width.

    Ideal: 0.20. Mirror of fifth_2_ratio.
    """

    metric_id = "fifth_4_ratio"
    region = "symmetry"
    family = "fifths"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        ratios, _ = _fifths_geometry(lm)
        v = ratios[3]
        conf_raw = _fifth_confidence(v)
        conf_final = propagate(
            conf_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=FIFTHS_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=conf_raw, confidence_final=conf_final,
            is_low_confidence=conf_final < LOW_CONF_THRESHOLD,
            direction=_fifth_direction(v),
            dependency_landmarks=_FIFTHS_DEP_LM,
        )


@register
class FifthFiveRatioCalculator(MetricCalculator):
    """Ratio of right temple (right outer canthus → face edge) to face width.

    Ideal: 0.20. Mirror of fifth_1_ratio.
    """

    metric_id = "fifth_5_ratio"
    region = "symmetry"
    family = "fifths"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        ratios, _ = _fifths_geometry(lm)
        v = ratios[4]
        conf_raw = _fifth_confidence(v)
        conf_final = propagate(
            conf_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=FIFTHS_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=conf_raw, confidence_final=conf_final,
            is_low_confidence=conf_final < LOW_CONF_THRESHOLD,
            direction=_fifth_direction(v),
            dependency_landmarks=_FIFTHS_DEP_LM,
        )


@register
class IntercanthalToEyeWidthRatioCalculator(MetricCalculator):
    """Ratio of intercanthal distance to the average horizontal eye width.

    ICD = distance between inner canthi (= 1.0 ICU by construction).
    Eye width = distance between outer and inner canthus of each eye.

    Ideal: 1.0 (ICD equals eye width — the classic "three-I" rule).
    'wide_set' when ICD > eye width; 'close_set' when ICD < eye width.
    """

    metric_id = "intercanthal_to_eye_width_ratio"
    region = "symmetry"
    family = "fifths"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _icd_to_eye_width(lm)
        conf_raw = max(0.0, 1.0 - abs(v - _IDEAL_ICD_EYE) / _MAX_DEV_ICD_EYE)
        conf_final = propagate(
            conf_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=FIFTHS_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=conf_raw, confidence_final=conf_final,
            is_low_confidence=conf_final < LOW_CONF_THRESHOLD,
            direction=_icd_eye_direction(v),
            dependency_landmarks=_EYE_WIDTH_DEP_LM,
        )
