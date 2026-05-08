"""Nose metric family (PR-14, M2 second family).

Seven atomic nose metrics — all measurable on a single frontal photo. The
classical clinical metrics ``nasal_tip_projection`` and ``nasolabial_angle``
require a lateral profile (sagittal plane), so they are intentionally
**deferred** until the multi-photo PR (PR-23). Replacements that capture
similar clinical information from frontal-only data:

  nose_length_to_icd
      Vertical distance subnasale.y - nasion.y in intercanthal units (ICU).
      Ideal: 1.5 (Farkas: nasal length ~50 mm vs ICD ~32 mm → ~1.56).
      Naini (2011) reports 1.45-1.65 unified-sex. Adopted 1.5 for v1.0.
      Green ±0.15 ICU, yellow ±0.30. Direction: 'long_nose' / 'short_nose'.

  nose_width_to_icd
      Horizontal alar width / 1.0 ICU. Ideal: 1.0 ("rule of fifths" — alar
      base ≈ central fifth ≈ ICD). Source: Farkas, classical neoclassical
      cannons. Green ±0.10, yellow ±0.20. Direction: 'wide_nose' / 'narrow_nose'.

  alar_to_face_width_ratio
      Alar width / bizygomatic width. Ideal: 0.20 (one fifth).
      Source: rule of fifths. Green ±0.03, yellow ±0.06.
      Direction: 'prominent_alars' / 'pinched_alars'.

  nose_to_mouth_width_ratio
      Alar width / mouth width. Ideal: 0.65 (Naini — alar < mouth typically).
      Green ±0.08, yellow ±0.15. Direction: 'wide_relative_nose' /
      'narrow_relative_nose'.

  dorsum_deviation
      |nasion.x - nose_tip.x| in ICU. Ideal: 0 (canonical — nose bridge
      perfectly vertical). Green ±0.03, yellow ±0.07. Direction:
      'deviated_left' / 'deviated_right' / 'neutral' (sign of nose_tip - nasion).

  nasal_tip_deviation
      |nose_tip.x| in ICU (midline = 0 after normalization). Ideal: 0.
      Green ±0.03, yellow ±0.07. Direction: 'tip_left' / 'tip_right' / 'neutral'.

  alar_base_asymmetry
      |alar_l.y - alar_r.y| in ICU. Ideal: 0. Green ±0.03, yellow ±0.07.
      Direction: 'left_alar_low' / 'right_alar_low' / 'neutral'.

Region: 'nose'. Family: 'nose'. Uses NOSE_POSE_PARAMS (yaw-sensitive but less
than jaw — nose landmarks on Mesh-478 are well-defined).
"""

from __future__ import annotations

from app.domain.landmarks_mesh import (
    P_LEFT_MOUTH,
    P_LEFT_ZYGOMATIC,
    P_NASION,
    P_NOSE_LEFT,
    P_NOSE_RIGHT,
    P_NOSE_TIP,
    P_RIGHT_MOUTH,
    P_RIGHT_ZYGOMATIC,
    P_SUBNASALE,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.confidence_propagation import (
    LOW_CONF_THRESHOLD,
    NOSE_POSE_PARAMS,
    propagate,
)
from app.services.metrics.registry import register

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_NOSE_LENGTH:    tuple[int, ...] = (P_NASION, P_SUBNASALE)
_DEP_NOSE_WIDTH:     tuple[int, ...] = (P_NOSE_LEFT, P_NOSE_RIGHT)
_DEP_ALAR_TO_FACE:   tuple[int, ...] = (P_NOSE_LEFT, P_NOSE_RIGHT, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
_DEP_NOSE_TO_MOUTH:  tuple[int, ...] = (P_NOSE_LEFT, P_NOSE_RIGHT, P_LEFT_MOUTH, P_RIGHT_MOUTH)
_DEP_DORSUM_DEV:     tuple[int, ...] = (P_NASION, P_NOSE_TIP)
_DEP_TIP_DEV:        tuple[int, ...] = (P_NOSE_TIP,)
_DEP_ALAR_ASYM:      tuple[int, ...] = (P_NOSE_LEFT, P_NOSE_RIGHT)


# ---------------------------------------------------------------------------
# Ideal central values & saturation thresholds
# ---------------------------------------------------------------------------
_IDEAL_NOSE_LENGTH    = 1.5     # ICU
_IDEAL_NOSE_WIDTH     = 1.0     # ICU
_IDEAL_ALAR_TO_FACE   = 0.20    # ratio
_IDEAL_NOSE_TO_MOUTH  = 0.65    # ratio
_IDEAL_DORSUM_DEV     = 0.0     # ICU
_IDEAL_TIP_DEV        = 0.0     # ICU
_IDEAL_ALAR_ASYM      = 0.0     # ICU

_MAX_DEV_NOSE_LENGTH    = 0.60
_MAX_DEV_NOSE_WIDTH     = 0.40
_MAX_DEV_ALAR_TO_FACE   = 0.12
_MAX_DEV_NOSE_TO_MOUTH  = 0.30
_MAX_DEV_DORSUM_DEV     = 0.15
_MAX_DEV_TIP_DEV        = 0.15
_MAX_DEV_ALAR_ASYM      = 0.15


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def _hdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    return abs(float(lm.xy(a)[0]) - float(lm.xy(b)[0]))


def _vdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    return abs(float(lm.xy(a)[1]) - float(lm.xy(b)[1]))


def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)


def _length_direction(value: float) -> str:
    if abs(value - _IDEAL_NOSE_LENGTH) < 0.15:
        return "neutral"
    return "long_nose" if value > _IDEAL_NOSE_LENGTH else "short_nose"


def _width_direction(value: float) -> str:
    if abs(value - _IDEAL_NOSE_WIDTH) < 0.10:
        return "neutral"
    return "wide_nose" if value > _IDEAL_NOSE_WIDTH else "narrow_nose"


def _alar_to_face_direction(value: float) -> str:
    if abs(value - _IDEAL_ALAR_TO_FACE) < 0.03:
        return "neutral"
    return "prominent_alars" if value > _IDEAL_ALAR_TO_FACE else "pinched_alars"


def _nose_to_mouth_direction(value: float) -> str:
    if abs(value - _IDEAL_NOSE_TO_MOUTH) < 0.08:
        return "neutral"
    return "wide_relative_nose" if value > _IDEAL_NOSE_TO_MOUTH else "narrow_relative_nose"


def _dorsum_direction(nasion_x: float, tip_x: float) -> str:
    diff = tip_x - nasion_x
    if abs(diff) < 0.03:
        return "neutral"
    # midline x = 0; positive x is image-right (subject's left side)
    return "deviated_left" if diff > 0 else "deviated_right"


def _tip_direction(tip_x: float) -> str:
    if abs(tip_x) < 0.03:
        return "neutral"
    return "tip_left" if tip_x > 0 else "tip_right"


def _alar_asym_direction(alar_l_y: float, alar_r_y: float) -> str:
    diff = alar_l_y - alar_r_y
    if abs(diff) < 0.03:
        return "neutral"
    # higher y = lower in image (image coords)
    return "left_alar_low" if diff > 0 else "right_alar_low"


# ---------------------------------------------------------------------------
# Calculators
# ---------------------------------------------------------------------------

@register
class NoseLengthToIcdCalculator(MetricCalculator):
    """Nasion → subnasale vertical distance in ICU. Ideal: 1.5."""

    metric_id = "nose_length_to_icd"
    region = "nose"
    family = "nose"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _vdist(lm, P_SUBNASALE, P_NASION)
        cr = _conf_raw(v, _IDEAL_NOSE_LENGTH, _MAX_DEV_NOSE_LENGTH)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), NOSE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_length_direction(v),
            dependency_landmarks=_DEP_NOSE_LENGTH,
        )


@register
class NoseWidthToIcdCalculator(MetricCalculator):
    """Alar width in ICU. Ideal: 1.0 (rule of fifths)."""

    metric_id = "nose_width_to_icd"
    region = "nose"
    family = "nose"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _hdist(lm, P_NOSE_LEFT, P_NOSE_RIGHT)
        cr = _conf_raw(v, _IDEAL_NOSE_WIDTH, _MAX_DEV_NOSE_WIDTH)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), NOSE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_width_direction(v),
            dependency_landmarks=_DEP_NOSE_WIDTH,
        )


@register
class AlarToFaceWidthRatioCalculator(MetricCalculator):
    """Alar width / bizygomatic width. Ideal: 0.20 (rule of fifths)."""

    metric_id = "alar_to_face_width_ratio"
    region = "nose"
    family = "nose"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        alar = _hdist(lm, P_NOSE_LEFT, P_NOSE_RIGHT)
        bizyg = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        v = alar / bizyg if bizyg > 1e-9 else _IDEAL_ALAR_TO_FACE
        cr = _conf_raw(v, _IDEAL_ALAR_TO_FACE, _MAX_DEV_ALAR_TO_FACE)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), NOSE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.02,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_alar_to_face_direction(v),
            dependency_landmarks=_DEP_ALAR_TO_FACE,
        )


@register
class NoseToMouthWidthRatioCalculator(MetricCalculator):
    """Alar width / mouth width. Ideal: 0.65 (Naini)."""

    metric_id = "nose_to_mouth_width_ratio"
    region = "nose"
    family = "nose"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        alar = _hdist(lm, P_NOSE_LEFT, P_NOSE_RIGHT)
        mouth = _hdist(lm, P_LEFT_MOUTH, P_RIGHT_MOUTH)
        v = alar / mouth if mouth > 1e-9 else _IDEAL_NOSE_TO_MOUTH
        cr = _conf_raw(v, _IDEAL_NOSE_TO_MOUTH, _MAX_DEV_NOSE_TO_MOUTH)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), NOSE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_nose_to_mouth_direction(v),
            dependency_landmarks=_DEP_NOSE_TO_MOUTH,
        )


@register
class DorsumDeviationCalculator(MetricCalculator):
    """|nasion.x - nose_tip.x| in ICU. Canonical 0 (vertical bridge)."""

    metric_id = "dorsum_deviation"
    region = "nose"
    family = "nose"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        nasion_x = float(lm.xy(P_NASION)[0])
        tip_x = float(lm.xy(P_NOSE_TIP)[0])
        v = abs(nasion_x - tip_x)
        cr = _conf_raw(v, _IDEAL_DORSUM_DEV, _MAX_DEV_DORSUM_DEV)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), NOSE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.02,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_dorsum_direction(nasion_x, tip_x),
            dependency_landmarks=_DEP_DORSUM_DEV,
        )


@register
class NasalTipDeviationCalculator(MetricCalculator):
    """|nose_tip.x| in ICU (midline = 0 after normalization). Canonical 0."""

    metric_id = "nasal_tip_deviation"
    region = "nose"
    family = "nose"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        tip_x = float(lm.xy(P_NOSE_TIP)[0])
        v = abs(tip_x)
        cr = _conf_raw(v, _IDEAL_TIP_DEV, _MAX_DEV_TIP_DEV)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), NOSE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.02,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_tip_direction(tip_x),
            dependency_landmarks=_DEP_TIP_DEV,
        )


@register
class AlarBaseAsymmetryCalculator(MetricCalculator):
    """|alar_left.y - alar_right.y| in ICU. Canonical 0."""

    metric_id = "alar_base_asymmetry"
    region = "nose"
    family = "nose"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        alar_l_y = float(lm.xy(P_NOSE_LEFT)[1])
        alar_r_y = float(lm.xy(P_NOSE_RIGHT)[1])
        v = abs(alar_l_y - alar_r_y)
        cr = _conf_raw(v, _IDEAL_ALAR_ASYM, _MAX_DEV_ALAR_ASYM)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), NOSE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.02,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_alar_asym_direction(alar_l_y, alar_r_y),
            dependency_landmarks=_DEP_ALAR_ASYM,
        )
