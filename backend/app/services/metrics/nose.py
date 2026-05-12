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

import math

from app.domain.landmarks_mesh import (
    LM_NOSE_BRIDGE,
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
_DEP_DORSUM_STRAIGHT: tuple[int, ...] = tuple(LM_NOSE_BRIDGE) + (P_NOSE_TIP,)
_DEP_COLUMELLA:      tuple[int, ...] = (P_SUBNASALE, P_NOSE_LEFT, P_NOSE_RIGHT)


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
_IDEAL_DORSUM_STRAIGHT = 0.0    # ICU — perfectly straight bridge
_IDEAL_COLUMELLA      = 0.05    # ICU — ~2 mm show at normal ICD 30 mm

_MAX_DEV_NOSE_LENGTH    = 0.60
_MAX_DEV_NOSE_WIDTH     = 0.40
_MAX_DEV_ALAR_TO_FACE   = 0.12
_MAX_DEV_NOSE_TO_MOUTH  = 0.30
_MAX_DEV_DORSUM_DEV     = 0.15
_MAX_DEV_TIP_DEV        = 0.15
_MAX_DEV_ALAR_ASYM      = 0.15
_MAX_DEV_DORSUM_STRAIGHT = 0.07  # [0, 0.07] before conf_raw → 0
_MAX_DEV_COLUMELLA      = 0.15   # [-0.10, +0.20] range


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


def _nasal_dorsum_deviation(lm: "NormalizedLandmarks") -> tuple[float, str]:
    """Max perpendicular deviation of nose bridge from nasion→tip line.

    Bridge intermediate landmarks: LM_NOSE_BRIDGE[1:] = [6, 197, 195].
    The signed perpendicular from each bridge point to the nasion-tip line
    indicates left/right deviation (positive = image-right).

    Returns (max_abs_deviation_icu, direction).
    """
    nasion = lm.xy(P_NASION)
    tip    = lm.xy(P_NOSE_TIP)
    nx, ny = float(nasion[0]), float(nasion[1])
    tx, ty = float(tip[0]),    float(tip[1])
    dx, dy = tx - nx, ty - ny
    length = math.hypot(dx, dy)
    if length < 1e-9:
        return 0.0, "neutral"

    ux, uy = dx / length, dy / length  # unit vector nasion→tip

    max_dev = 0.0
    max_signed = 0.0
    for idx in LM_NOSE_BRIDGE[1:]:  # skip idx 0 = nasion itself
        px, py = float(lm.xy(idx)[0]), float(lm.xy(idx)[1])
        ex, ey = px - nx, py - ny
        # signed perpendicular = cross product (2-D z component)
        signed = ex * uy - ey * ux
        if abs(signed) > abs(max_dev):
            max_dev   = abs(signed)
            max_signed = signed

    direction = (
        "deviated_left"  if max_signed >  0.01 else
        "deviated_right" if max_signed < -0.01 else
        "neutral"
    )
    return max_dev, direction


def _columella_show(lm: "NormalizedLandmarks") -> tuple[float, str]:
    """Columella show = subnasale.y − avg(alar_l.y, alar_r.y) in ICU.

    Positive = subnasale is below alar bases → columella visible (normal).
    Negative = subnasale is above alar bases → retracted columella.

    Returns (value, direction).
    """
    sub_y   = float(lm.xy(P_SUBNASALE)[1])
    alar_y  = (float(lm.xy(P_NOSE_LEFT)[1]) + float(lm.xy(P_NOSE_RIGHT)[1])) / 2.0
    v = sub_y - alar_y

    if v < -0.03:
        direction = "insufficient_show"
    elif v > 0.13:
        direction = "excessive_show"
    else:
        direction = "adequate_show"
    return v, direction


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


@register
class NasalDorsumStraightnessCalculator(MetricCalculator):
    """Nasal dorsum straightness: max perpendicular deviation of the bridge.

    Measures how much the nasal bridge deviates from a straight nasion-to-tip
    line.  Intermediate bridge landmarks (Mesh-478: 6, 197, 195) are assessed
    for perpendicular distance from the nasion (168) → nose tip (1) vector.

    Formula: see _nasal_dorsum_deviation() helper.
    Value = max |perpendicular distance| in ICU across bridge points [6,197,195].
    Ideal: 0.0. Green [0, 0.025]. Yellow [0, 0.05].
    Direction: 'deviated_left' / 'deviated_right' / 'neutral'.

    References: Naini (2011) §6 nasal bone projection; Farkas (1994) nasal
    aesthetics; Rohrich & Muzaffar (2003) nasal deviation classification.
    """

    metric_id = "nasal_dorsum_straightness"
    region    = "nose"
    family    = "nose"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v, direction = _nasal_dorsum_deviation(lm)
        cr = _conf_raw(v, _IDEAL_DORSUM_STRAIGHT, _MAX_DEV_DORSUM_STRAIGHT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), NOSE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=direction,
            dependency_landmarks=_DEP_DORSUM_STRAIGHT,
        )


@register
class ColumellaShowCalculator(MetricCalculator):
    """Columella show: vertical distance subnasale → alar base level.

    Quantifies how much of the columella (the tissue between the nostrils) is
    visible in frontal view, expressed in ICU.

    Formula: columella_show = subnasale.y − avg(alar_left.y, alar_right.y)
    (y increases downward in image coordinates)
        > 0  = subnasale is below alar bases → columella visible (normal)
        ≈ 0  = flush (minimal show)
        < 0  = retracted columella (subnasale above alar rim)

    Ideal: 0.05 ICU (~1.5 mm at ICD=32 mm, consistent with Naini §6 "1–2 mm").
    Green [−0.03, 0.13]. Yellow [−0.08, 0.18].
    Direction: 'adequate_show' / 'insufficient_show' / 'excessive_show'.

    References: Naini (2011) §6; Farkas (1994) nasal base morphology;
    Guyuron (2012) columella anatomy.
    """

    metric_id = "columella_show"
    region    = "nose"
    family    = "nose"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v, direction = _columella_show(lm)
        cr = _conf_raw(v, _IDEAL_COLUMELLA, _MAX_DEV_COLUMELLA)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), NOSE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=direction,
            dependency_landmarks=_DEP_COLUMELLA,
        )

