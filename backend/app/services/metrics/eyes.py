"""Eye metric family (PR-8).

Six atomic eye metrics:

  eye_aperture_ratio_l / _r
      Vertical opening / horizontal width of each eye.
      height = |y(top_lid) - y(bot_lid)|  in ICU
      width  = |x(outer_canthus) - x(inner_canthus)|  in ICU
      Ideal: 0.30 (classic almond-eye proportion). Green ±0.05.

  interpupillary_distance
      Distance between iris centres in ICU.
      Ideal: 2.0 ICU. Green ±0.2. 'wide_set' / 'close_set'.

  intercanthal_distance
      Distance between inner canthi in ICU.
      By construction always ≈ 1.0 after normalisation — sanity check.
      Ideal: 1.0. Green ±0.1.

  canthal_tilt_l / _r
      Angle (degrees) of the medial→lateral canthus axis.
      Positive = lateral (outer) canthus is superior (upward slant).
      Negative = lateral canthus inferior (downward slant).
      Ideal: 0°. Green ±1°. 'positive_tilt' / 'negative_tilt'.

Region: 'eyes'. Family: 'eyes'. Uses EYES_POSE_PARAMS.
"""

from __future__ import annotations

import math

from app.domain.landmarks_mesh import (
    P_LEFT_EYE_BOT,
    P_LEFT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_LEFT_EYE_TOP,
    P_LEFT_IRIS_CENTER,
    P_RIGHT_EYE_BOT,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_EYE_TOP,
    P_RIGHT_IRIS_CENTER,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.registry import register
from app.services.metrics.confidence_propagation import (
    LOW_CONF_THRESHOLD,
    EYES_POSE_PARAMS,
    propagate,
)

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_APERTURE_L: tuple[int, ...] = (
    P_LEFT_EYE_OUTER, P_LEFT_EYE_INNER, P_LEFT_EYE_TOP, P_LEFT_EYE_BOT,
)
_DEP_APERTURE_R: tuple[int, ...] = (
    P_RIGHT_EYE_OUTER, P_RIGHT_EYE_INNER, P_RIGHT_EYE_TOP, P_RIGHT_EYE_BOT,
)
_DEP_IPD: tuple[int, ...] = (P_LEFT_IRIS_CENTER, P_RIGHT_IRIS_CENTER)
_DEP_ICD: tuple[int, ...] = (P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER)
_DEP_TILT_L: tuple[int, ...] = (P_LEFT_EYE_INNER, P_LEFT_EYE_OUTER)
_DEP_TILT_R: tuple[int, ...] = (P_RIGHT_EYE_INNER, P_RIGHT_EYE_OUTER)

# Ideal values and confidence saturation references
_IDEAL_APERTURE = 0.30        # height/width ratio
_IDEAL_IPD      = 2.0         # intercanthal units
_IDEAL_ICD      = 1.0         # intercanthal units (always 1.0 by normalisation)
_IDEAL_TILT     = 0.0         # degrees

_MAX_DEV_APERTURE = 0.30      # aperture deviation at which conf_raw → 0
_MAX_DEV_IPD      = 1.0
_MAX_DEV_ICD      = 0.20
_MAX_DEV_TILT     = 20.0      # degrees


# ---------------------------------------------------------------------------
# Pure math helpers
# ---------------------------------------------------------------------------

def _aperture(lm: NormalizedLandmarks, outer: int, inner: int,
              top: int, bot: int) -> float:
    """Eye aperture ratio = vertical opening / horizontal width."""
    height = abs(float(lm.xy(top)[1]) - float(lm.xy(bot)[1]))
    width  = abs(float(lm.xy(outer)[0]) - float(lm.xy(inner)[0]))
    if width < 1e-9:
        return _IDEAL_APERTURE
    return height / width


def _canthal_tilt_deg(
    lm: NormalizedLandmarks,
    medial: int,
    lateral: int,
) -> float:
    """Canthal tilt in degrees. Positive = lateral canthus is superior.

    Convention (works for both eyes):
        angle = atan2(y_medial - y_lateral, |x_lateral - x_medial|)
    A positive value means the lateral canthus is higher in the image
    (lower y in image coordinates), i.e., a "cat-eye" / positive tilt.
    """
    xm, ym = lm.xy(medial)
    xl, yl = lm.xy(lateral)
    dx = abs(float(xl) - float(xm))  # always positive
    dy = float(ym) - float(yl)       # positive when lateral is higher
    return math.degrees(math.atan2(dy, dx)) if dx > 1e-9 else 0.0


def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)


def _tilt_direction(angle_deg: float) -> str:
    if abs(angle_deg) < 1.0:
        return "neutral"
    return "positive_tilt" if angle_deg > 0 else "negative_tilt"


def _aperture_direction(ratio: float) -> str:
    if abs(ratio - _IDEAL_APERTURE) < 0.05:
        return "neutral"
    return "open" if ratio > _IDEAL_APERTURE else "narrow"


def _ipd_direction(ipd: float) -> str:
    if abs(ipd - _IDEAL_IPD) < 0.2:
        return "neutral"
    return "wide_set" if ipd > _IDEAL_IPD else "close_set"


def _icd_direction(icd: float) -> str:
    if abs(icd - _IDEAL_ICD) < 0.1:
        return "neutral"
    return "dilated" if icd > _IDEAL_ICD else "compressed"


# ---------------------------------------------------------------------------
# Metric calculators
# ---------------------------------------------------------------------------

@register
class EyeApertureRatioLeftCalculator(MetricCalculator):
    """Left eye aperture ratio = vertical opening / horizontal width.

    Ideal: 0.30. 'open' when wider; 'narrow' when smaller.
    """

    metric_id = "eye_aperture_ratio_l"
    region = "eyes"
    family = "eyes"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _aperture(lm, P_LEFT_EYE_OUTER, P_LEFT_EYE_INNER, P_LEFT_EYE_TOP, P_LEFT_EYE_BOT)
        cr = _conf_raw(v, _IDEAL_APERTURE, _MAX_DEV_APERTURE)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), EYES_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_aperture_direction(v),
            dependency_landmarks=_DEP_APERTURE_L,
        )


@register
class EyeApertureRatioRightCalculator(MetricCalculator):
    """Right eye aperture ratio = vertical opening / horizontal width.

    Ideal: 0.30. Mirror of EyeApertureRatioLeftCalculator.
    """

    metric_id = "eye_aperture_ratio_r"
    region = "eyes"
    family = "eyes"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _aperture(lm, P_RIGHT_EYE_OUTER, P_RIGHT_EYE_INNER, P_RIGHT_EYE_TOP, P_RIGHT_EYE_BOT)
        cr = _conf_raw(v, _IDEAL_APERTURE, _MAX_DEV_APERTURE)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), EYES_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_aperture_direction(v),
            dependency_landmarks=_DEP_APERTURE_R,
        )


@register
class InterpupillaryDistanceCalculator(MetricCalculator):
    """Interpupillary distance (IPD) in intercanthal units.

    Measures the horizontal distance between iris centres.
    Ideal: 2.0 ICU (iris centres one eye-width from each inner canthus).
    'wide_set' when IPD > 2.2 ICU; 'close_set' when IPD < 1.8 ICU.
    """

    metric_id = "interpupillary_distance"
    region = "eyes"
    family = "eyes"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = abs(float(lm.xy(P_RIGHT_IRIS_CENTER)[0]) - float(lm.xy(P_LEFT_IRIS_CENTER)[0]))
        cr = _conf_raw(v, _IDEAL_IPD, _MAX_DEV_IPD)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), EYES_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_ipd_direction(v),
            dependency_landmarks=_DEP_IPD,
        )


@register
class IntercanthalDistanceCalculator(MetricCalculator):
    """Intercanthal distance (ICD) in intercanthal units.

    Sanity-check metric — should always be ≈ 1.0 after normalisation.
    Deviations signal a normalisation bug or extreme head pose.
    'dilated' when ICD > 1.1 ICU; 'compressed' when ICD < 0.9 ICU.
    """

    metric_id = "intercanthal_distance"
    region = "eyes"
    family = "eyes"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = abs(float(lm.xy(P_RIGHT_EYE_INNER)[0]) - float(lm.xy(P_LEFT_EYE_INNER)[0]))
        cr = _conf_raw(v, _IDEAL_ICD, _MAX_DEV_ICD)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), EYES_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.005,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_icd_direction(v),
            dependency_landmarks=_DEP_ICD,
        )


@register
class CanthalTiltLeftCalculator(MetricCalculator):
    """Left eye canthal tilt in degrees.

    Positive = lateral canthus (outer corner) is superior (upward slant).
    Negative = lateral canthus is inferior (downward slant).
    Ideal: 0°. Green ±1°.
    """

    metric_id = "canthal_tilt_l"
    region = "eyes"
    family = "eyes"
    unit = "degrees"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _canthal_tilt_deg(lm, medial=P_LEFT_EYE_INNER, lateral=P_LEFT_EYE_OUTER)
        cr = _conf_raw(v, _IDEAL_TILT, _MAX_DEV_TILT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), EYES_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.5,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_tilt_direction(v),
            dependency_landmarks=_DEP_TILT_L,
        )


@register
class CanthalTiltRightCalculator(MetricCalculator):
    """Right eye canthal tilt in degrees.

    Same convention as CanthalTiltLeftCalculator.
    """

    metric_id = "canthal_tilt_r"
    region = "eyes"
    family = "eyes"
    unit = "degrees"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _canthal_tilt_deg(lm, medial=P_RIGHT_EYE_INNER, lateral=P_RIGHT_EYE_OUTER)
        cr = _conf_raw(v, _IDEAL_TILT, _MAX_DEV_TILT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), EYES_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.5,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_tilt_direction(v),
            dependency_landmarks=_DEP_TILT_R,
        )
