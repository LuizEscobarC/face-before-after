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
    P_LEFT_IRIS_BOT,
    P_LEFT_IRIS_CENTER,
    P_RIGHT_EYE_BOT,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_EYE_TOP,
    P_RIGHT_IRIS_BOT,
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
_DEP_SCLERAL_L: tuple[int, ...] = (P_LEFT_IRIS_BOT, P_LEFT_EYE_BOT)
_DEP_SCLERAL_R: tuple[int, ...] = (P_RIGHT_IRIS_BOT, P_RIGHT_EYE_BOT)
_DEP_PALPEBRAL: tuple[int, ...] = (
    P_LEFT_EYE_INNER, P_LEFT_EYE_OUTER,
    P_RIGHT_EYE_INNER, P_RIGHT_EYE_OUTER,
)

# Ideal values and confidence saturation references
_IDEAL_APERTURE   = 0.30   # height/width ratio
_IDEAL_IPD        = 2.0    # intercanthal units
_IDEAL_ICD        = 1.0    # intercanthal units (always 1.0 by normalisation)
_IDEAL_TILT       = 0.0    # degrees
_IDEAL_SCLERAL    = 0.0    # ICU — no inferior scleral show is ideal
_IDEAL_PALPEBRAL  = 2.0    # degrees — slight positive bilateral tilt (Naini 2011)

_MAX_DEV_APERTURE   = 0.30   # aperture deviation at which conf_raw → 0
_MAX_DEV_IPD        = 1.0
_MAX_DEV_ICD        = 0.20
_MAX_DEV_TILT       = 20.0   # degrees
_MAX_DEV_SCLERAL    = 0.05   # [0, 0.05] ICU before conf_raw → 0
_MAX_DEV_PALPEBRAL  = 8.0    # degrees — [−6, +10] before conf_raw → 0


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


def _scleral_direction(v: float) -> str:
    return "scleral_show" if v > 0.008 else "neutral"


def _palpebral_direction(deg: float) -> str:
    if 0.5 <= deg <= 5.0:
        return "neutral"
    return "positive_tilt" if deg > 5.0 else "negative_tilt"


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


@register
class ScleralShowLowerLeftCalculator(MetricCalculator):
    """Left inferior scleral show: gap between iris bottom and lower eyelid.

    Inferior scleral show (white below the iris in primary gaze) occurs when
    the lower eyelid is elevated above the inferior iris margin.

    In normalized ICU coords (y increases downward):
        iris_bottom_y  = lm.xy(P_LEFT_IRIS_BOT)[1]   (Mesh-478 idx 470)
        lower_lid_y    = lm.xy(P_LEFT_EYE_BOT)[1]    (Mesh-478 idx 145)

    scleral_show = max(0, iris_bottom_y − lower_lid_y)
        > 0: lower lid is above the iris bottom → visible white strip
        = 0: lid covers or meets the iris bottom (normal)

    Ideal: 0.0 ICU. Green [0, 0.015]. Yellow [0, 0.035].
    Direction: 'scleral_show' / 'neutral'.

    References: Naini (2011) §5; Farkas (1994) eyelid morphology norms.
    """

    metric_id = "scleral_show_lower_l"
    region    = "eyes"
    family    = "eyes"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        iris_bot_y  = float(lm.xy(P_LEFT_IRIS_BOT)[1])
        lower_lid_y = float(lm.xy(P_LEFT_EYE_BOT)[1])
        v  = max(0.0, iris_bot_y - lower_lid_y)
        cr = _conf_raw(v, _IDEAL_SCLERAL, _MAX_DEV_SCLERAL)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), EYES_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.005,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_scleral_direction(v),
            dependency_landmarks=_DEP_SCLERAL_L,
        )


@register
class ScleralShowLowerRightCalculator(MetricCalculator):
    """Right inferior scleral show. Mirror of ScleralShowLowerLeftCalculator.

    Uses P_RIGHT_IRIS_BOT (Mesh-478 idx 475) and P_RIGHT_EYE_BOT (idx 374).
    Ideal: 0.0 ICU. Green [0, 0.015]. Yellow [0, 0.035].
    """

    metric_id = "scleral_show_lower_r"
    region    = "eyes"
    family    = "eyes"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        iris_bot_y  = float(lm.xy(P_RIGHT_IRIS_BOT)[1])
        lower_lid_y = float(lm.xy(P_RIGHT_EYE_BOT)[1])
        v  = max(0.0, iris_bot_y - lower_lid_y)
        cr = _conf_raw(v, _IDEAL_SCLERAL, _MAX_DEV_SCLERAL)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), EYES_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.005,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_scleral_direction(v),
            dependency_landmarks=_DEP_SCLERAL_R,
        )


@register
class PalpebralFissureInclinationCalculator(MetricCalculator):
    """Bilateral palpebral fissure inclination: mean canthal tilt (both eyes).

    Distinct from per-eye canthal_tilt_l/r: this metric captures the GLOBAL
    upslant/downslant characteristic of the face, averaging both eyes to
    separate the bilateral trend from per-eye asymmetry.

    Formula: (canthal_tilt_l + canthal_tilt_r) / 2.0  [degrees]
    where each per-eye tilt = atan2(y_medial − y_lateral, |x_outer − x_inner|)
    and positive = lateral canthus is higher (upward / cat-eye slant).

    Ideal: 2.0° (Naini 2011 §5: 3–5° positive slant associated with femininity
    and youth; sex-neutral midpoint 2.0° adopted).
    Green [−1°, 5°]. Yellow [−4°, 8°].
    Direction: 'positive_tilt' (>5°) / 'negative_tilt' (<0.5°) / 'neutral'.

    References: Naini (2011) §5; Farkas (1994); Powell & Humphreys (1984).
    """

    metric_id = "palpebral_fissure_inclination"
    region    = "eyes"
    family    = "eyes"
    unit      = "degrees"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        tilt_l = _canthal_tilt_deg(lm, medial=P_LEFT_EYE_INNER, lateral=P_LEFT_EYE_OUTER)
        tilt_r = _canthal_tilt_deg(lm, medial=P_RIGHT_EYE_INNER, lateral=P_RIGHT_EYE_OUTER)
        v  = (tilt_l + tilt_r) / 2.0
        cr = _conf_raw(v, _IDEAL_PALPEBRAL, _MAX_DEV_PALPEBRAL)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), EYES_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.5,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_palpebral_direction(v),
            dependency_landmarks=_DEP_PALPEBRAL,
        )


@register
class SupratarsalFoldVisibilityCalculator(MetricCalculator):
    """Supratarsal fold (double eyelid) visibility index.

    Requires pixel-level skin-fold detection.  Mesh-478 bone/muscle landmarks
    do not capture the upper-eyelid crease (a soft-tissue feature), so this
    calculator returns a zero-confidence stub when only landmark data is
    available.  Registered so Nest can seed metric_definition and list it in
    GET /vision/capabilities; the orchestrator SKIPS compute() per DEC-10.

    Future implementation: segmentation model identifying the upper-lid crease
    will inject pixel data via QualityContext; compute() will then return a
    score ∈ [0, 1] (0 = no fold visible, 1 = prominent fold).
    """

    metric_id              = "supratarsal_fold_visibility"
    region                 = "eyes"
    family                 = "eyes"
    unit                   = "index_0_1"
    requires_pixel_analysis: bool = True  # pipeline SKIPS this (DEC-10)

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=0.0, error=0.0,
            confidence_raw=0.0, confidence_final=0.0,
            is_low_confidence=True,
            direction="not_computed",
            dependency_landmarks=(),
        )
