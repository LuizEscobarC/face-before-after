"""Mouth/lips metric family (PR-15, M2 third family).

Seven atomic mouth metrics — all measurable on a single frontal photo. The
classical clinical metrics ``cupids_bow_definition`` and ``philtrum_width_ratio``
require reliable philtral pillar / cupid's-bow-peak landmarks that Mesh-478
does **not** expose stably (no canonical points for the philtrum columns).
They are intentionally **deferred** until PR-23 (multi-photo / refined
landmark detector). Replacements that capture similar information from
frontal-only Mesh-478 data:

  mouth_width_to_icd
      Horizontal mouth width (corner to corner) / 1.0 ICU.
      Ideal: 1.50 (Naini 2011 — mouth ≈ 1.5 × intercanthal).
      Green ±0.15, yellow ±0.30. Direction: 'wide_mouth' / 'narrow_mouth'.

  mouth_to_face_width_ratio
      Mouth width / bizygomatic width. Ideal: 0.30 (Naini — mouth ≈ 30% of
      face width). Green ±0.04, yellow ±0.08. Direction: 'wide_mouth_face'
      / 'narrow_mouth_face'.

  upper_lip_height_ratio
      Upper vermilion height / total vermilion height. Ideal: 0.40
      (Naini U:L = 1:1.6 → upper = 0.385 of total; round to 0.40).
      Green ±0.05, yellow ±0.10. Direction: 'thick_upper_lip' /
      'thin_upper_lip'.

  lower_lip_height_ratio
      Lower vermilion height / total. Ideal: 0.60 (complement of upper).
      Same green/yellow as upper. Direction: 'thick_lower_lip' /
      'thin_lower_lip'.

  vermilion_height_total
      (upper + lower vermilion) in ICU. Ideal: 0.55 (Naini ~17 mm at
      ICD ~32 mm → ~0.53; adopted 0.55). Green ±0.10, yellow ±0.20.
      Direction: 'thick_lips' / 'thin_lips'.

  lip_corner_canting
      |left_mouth.y - right_mouth.y| in ICU. Canonical 0 (lips perfectly
      level). Green ±0.03, yellow ±0.07. Direction: 'left_corner_low' /
      'right_corner_low' / 'neutral'.

  mouth_midline_deviation
      |((left_mouth.x + right_mouth.x) / 2) - midline.x| in ICU
      (midline.x = 0 after normalization). Canonical 0 (mouth centred on
      facial midline). Green ±0.03, yellow ±0.07. Direction:
      'mouth_left' / 'mouth_right' / 'neutral'. Substitute for
      ``cupids_bow_definition``.

Vermilion-height definitions:
  upper vermilion height = |P_UPPER_LIP_TOP.y - P_UPPER_LIP.y|
  lower vermilion height = |P_LOWER_LIP.y - P_LOWER_LIP_BOT.y|

Region: 'mouth'. Family: 'mouth'. Uses MOUTH_POSE_PARAMS (least pose-sensitive
of the M2 families — mouth landmarks are well-defined and central on Mesh-478).
"""

from __future__ import annotations

from app.domain.landmarks_mesh import (
    P_LEFT_MOUTH,
    P_LEFT_ZYGOMATIC,
    P_LOWER_LIP,
    P_LOWER_LIP_BOT,
    P_RIGHT_MOUTH,
    P_RIGHT_ZYGOMATIC,
    P_UPPER_LIP,
    P_UPPER_LIP_TOP,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.confidence_propagation import (
    LOW_CONF_THRESHOLD,
    MOUTH_POSE_PARAMS,
    propagate,
)
from app.services.metrics.registry import register

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_MOUTH_W_ICD:    tuple[int, ...] = (P_LEFT_MOUTH, P_RIGHT_MOUTH)
_DEP_MOUTH_W_FACE:   tuple[int, ...] = (P_LEFT_MOUTH, P_RIGHT_MOUTH, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
_DEP_UPPER_LIP_R:    tuple[int, ...] = (P_UPPER_LIP_TOP, P_UPPER_LIP, P_LOWER_LIP, P_LOWER_LIP_BOT)
_DEP_LOWER_LIP_R:    tuple[int, ...] = (P_UPPER_LIP_TOP, P_UPPER_LIP, P_LOWER_LIP, P_LOWER_LIP_BOT)
_DEP_VERMILION_TOT:  tuple[int, ...] = (P_UPPER_LIP_TOP, P_UPPER_LIP, P_LOWER_LIP, P_LOWER_LIP_BOT)
_DEP_CORNER_CANT:    tuple[int, ...] = (P_LEFT_MOUTH, P_RIGHT_MOUTH)
_DEP_MIDLINE_DEV:    tuple[int, ...] = (P_LEFT_MOUTH, P_RIGHT_MOUTH)


# ---------------------------------------------------------------------------
# Ideal central values & saturation thresholds
# ---------------------------------------------------------------------------
_IDEAL_MOUTH_W_ICD    = 1.50    # ICU (Naini)
_IDEAL_MOUTH_W_FACE   = 0.30    # ratio (Naini)
_IDEAL_UPPER_LIP_R    = 0.40    # ratio
_IDEAL_LOWER_LIP_R    = 0.60    # ratio
_IDEAL_VERMILION_TOT  = 0.55    # ICU
_IDEAL_CORNER_CANT    = 0.0     # ICU
_IDEAL_MIDLINE_DEV    = 0.0     # ICU

_MAX_DEV_MOUTH_W_ICD    = 0.60
_MAX_DEV_MOUTH_W_FACE   = 0.16
_MAX_DEV_UPPER_LIP_R    = 0.20
_MAX_DEV_LOWER_LIP_R    = 0.20
_MAX_DEV_VERMILION_TOT  = 0.40
_MAX_DEV_CORNER_CANT    = 0.15
_MAX_DEV_MIDLINE_DEV    = 0.15


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def _hdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    return abs(float(lm.xy(a)[0]) - float(lm.xy(b)[0]))


def _vdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    return abs(float(lm.xy(a)[1]) - float(lm.xy(b)[1]))


def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)


def _mouth_w_icd_direction(value: float) -> str:
    if abs(value - _IDEAL_MOUTH_W_ICD) < 0.15:
        return "neutral"
    return "wide_mouth" if value > _IDEAL_MOUTH_W_ICD else "narrow_mouth"


def _mouth_w_face_direction(value: float) -> str:
    if abs(value - _IDEAL_MOUTH_W_FACE) < 0.04:
        return "neutral"
    return "wide_mouth_face" if value > _IDEAL_MOUTH_W_FACE else "narrow_mouth_face"


def _upper_lip_direction(value: float) -> str:
    if abs(value - _IDEAL_UPPER_LIP_R) < 0.05:
        return "neutral"
    return "thick_upper_lip" if value > _IDEAL_UPPER_LIP_R else "thin_upper_lip"


def _lower_lip_direction(value: float) -> str:
    if abs(value - _IDEAL_LOWER_LIP_R) < 0.05:
        return "neutral"
    return "thick_lower_lip" if value > _IDEAL_LOWER_LIP_R else "thin_lower_lip"


def _vermilion_direction(value: float) -> str:
    if abs(value - _IDEAL_VERMILION_TOT) < 0.10:
        return "neutral"
    return "thick_lips" if value > _IDEAL_VERMILION_TOT else "thin_lips"


def _corner_cant_direction(left_y: float, right_y: float) -> str:
    diff = left_y - right_y
    if abs(diff) < 0.03:
        return "neutral"
    # higher y = lower in image (image coords)
    return "left_corner_low" if diff > 0 else "right_corner_low"


def _midline_dev_direction(center_x: float) -> str:
    if abs(center_x) < 0.03:
        return "neutral"
    # midline x = 0; positive x is image-right (subject's left side)
    return "mouth_left" if center_x > 0 else "mouth_right"


def _vermilion_components(lm: NormalizedLandmarks) -> tuple[float, float, float]:
    """Return (upper_vermilion_height, lower_vermilion_height, total) in ICU."""
    upper = _vdist(lm, P_UPPER_LIP_TOP, P_UPPER_LIP)
    lower = _vdist(lm, P_LOWER_LIP, P_LOWER_LIP_BOT)
    return upper, lower, upper + lower


# ---------------------------------------------------------------------------
# Calculators
# ---------------------------------------------------------------------------

@register
class MouthWidthToIcdCalculator(MetricCalculator):
    """Mouth corner-to-corner width in ICU. Ideal: 1.50 (Naini)."""

    metric_id = "mouth_width_to_icd"
    region = "mouth"
    family = "mouth"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _hdist(lm, P_LEFT_MOUTH, P_RIGHT_MOUTH)
        cr = _conf_raw(v, _IDEAL_MOUTH_W_ICD, _MAX_DEV_MOUTH_W_ICD)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_mouth_w_icd_direction(v),
            dependency_landmarks=_DEP_MOUTH_W_ICD,
        )


@register
class MouthToFaceWidthRatioCalculator(MetricCalculator):
    """Mouth width / bizygomatic width. Ideal: 0.30 (Naini)."""

    metric_id = "mouth_to_face_width_ratio"
    region = "mouth"
    family = "mouth"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        mouth = _hdist(lm, P_LEFT_MOUTH, P_RIGHT_MOUTH)
        bizyg = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        v = mouth / bizyg if bizyg > 1e-9 else _IDEAL_MOUTH_W_FACE
        cr = _conf_raw(v, _IDEAL_MOUTH_W_FACE, _MAX_DEV_MOUTH_W_FACE)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.03,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_mouth_w_face_direction(v),
            dependency_landmarks=_DEP_MOUTH_W_FACE,
        )


@register
class UpperLipHeightRatioCalculator(MetricCalculator):
    """Upper vermilion / total vermilion. Ideal: 0.40 (Naini U:L = 1:1.6)."""

    metric_id = "upper_lip_height_ratio"
    region = "mouth"
    family = "mouth"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        upper, _, total = _vermilion_components(lm)
        v = upper / total if total > 1e-9 else _IDEAL_UPPER_LIP_R
        cr = _conf_raw(v, _IDEAL_UPPER_LIP_R, _MAX_DEV_UPPER_LIP_R)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_upper_lip_direction(v),
            dependency_landmarks=_DEP_UPPER_LIP_R,
        )


@register
class LowerLipHeightRatioCalculator(MetricCalculator):
    """Lower vermilion / total vermilion. Ideal: 0.60."""

    metric_id = "lower_lip_height_ratio"
    region = "mouth"
    family = "mouth"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        _, lower, total = _vermilion_components(lm)
        v = lower / total if total > 1e-9 else _IDEAL_LOWER_LIP_R
        cr = _conf_raw(v, _IDEAL_LOWER_LIP_R, _MAX_DEV_LOWER_LIP_R)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_lower_lip_direction(v),
            dependency_landmarks=_DEP_LOWER_LIP_R,
        )


@register
class VermilionHeightTotalCalculator(MetricCalculator):
    """Total vermilion height (upper + lower) in ICU. Ideal: 0.55 (Naini)."""

    metric_id = "vermilion_height_total"
    region = "mouth"
    family = "mouth"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        _, _, total = _vermilion_components(lm)
        cr = _conf_raw(total, _IDEAL_VERMILION_TOT, _MAX_DEV_VERMILION_TOT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=total, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_vermilion_direction(total),
            dependency_landmarks=_DEP_VERMILION_TOT,
        )


@register
class LipCornerCantingCalculator(MetricCalculator):
    """|left_mouth.y - right_mouth.y| in ICU. Canonical 0 (level lips)."""

    metric_id = "lip_corner_canting"
    region = "mouth"
    family = "mouth"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        left_y = float(lm.xy(P_LEFT_MOUTH)[1])
        right_y = float(lm.xy(P_RIGHT_MOUTH)[1])
        v = abs(left_y - right_y)
        cr = _conf_raw(v, _IDEAL_CORNER_CANT, _MAX_DEV_CORNER_CANT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.02,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_corner_cant_direction(left_y, right_y),
            dependency_landmarks=_DEP_CORNER_CANT,
        )


@register
class MouthMidlineDeviationCalculator(MetricCalculator):
    """|mouth_center.x - midline.x| in ICU (midline = 0). Canonical 0."""

    metric_id = "mouth_midline_deviation"
    region = "mouth"
    family = "mouth"
    unit = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        left_x = float(lm.xy(P_LEFT_MOUTH)[0])
        right_x = float(lm.xy(P_RIGHT_MOUTH)[0])
        center_x = (left_x + right_x) / 2.0
        v = abs(center_x)
        cr = _conf_raw(v, _IDEAL_MIDLINE_DEV, _MAX_DEV_MIDLINE_DEV)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.02,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_midline_dev_direction(center_x),
            dependency_landmarks=_DEP_MIDLINE_DEV,
        )
