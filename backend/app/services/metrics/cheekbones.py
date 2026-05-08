"""Cheekbone / midface metric family (PR-17, M2 fifth family).

Five atomic cheekbone / midface metrics — all measurable on a single frontal
photo using Mesh-478 landmark contour points.

  zygomatic_width_ratio
      Bizygomatic width in Intercanthal Units (ICU).
      Formula: |P_LEFT_ZYGOMATIC.x − P_RIGHT_ZYGOMATIC.x|
      Ideal: 4.00 ICU (Farkas 1994: bizygomatic ≈ 128 mm / ICD 32 mm).
      Green ±0.30, yellow ±0.60. Direction: 'wide_cheeks' / 'narrow_cheeks'.

  malar_projection_index
      Frontal proxy for cheekbone prominence: bizygomatic / biocular width.
      Biocular = outer-canthal distance (P_LEFT_EYE_OUTER to P_RIGHT_EYE_OUTER).
      A higher ratio indicates the face widens more at cheekbone level than at
      the eye span → appearance of prominent / high cheekbones from the front.
      Formula: bizygomatic_icu / biocular_icu
      Ideal: 1.33 (canonical fixture: 4.0 ICU / 3.0 ICU; Farkas ~1.45 uses a
              different biocular baseline — 1.33 adopted for 5-fifths geometry).
      Green ±0.10, yellow ±0.20. Direction: 'prominent_cheekbones' / 'flat_cheekbones'.

  midface_height_ratio
      Vertical distance from the intercanthal line to the subnasale, in ICU.
      After intercanthal normalisation the inner-canthus midline y ≈ 0 by
      construction; subnasale is below (positive y in image coordinates).
      Formula: P_SUBNASALE.y − avg(P_LEFT_EYE_INNER.y, P_RIGHT_EYE_INNER.y)
      Ideal: 1.50 ICU (Farkas 1994: inner canthus to subnasale ≈ 48 mm / ICD 32 mm).
      Green ±0.20, yellow ±0.40. Direction: 'long_midface' / 'short_midface'.

  cheekbone_to_jaw_ratio
      Bizygomatic / bigonial width — how much wider the cheekbones are than the
      jaw. Complement to ``jaw_width_ratio`` (jaw.py; bigonial/bizygomatic = 0.80):
      cheekbone_to_jaw_ratio = bizygomatic/bigonial = 1/jaw_width_ratio.
      Both metrics are retained in their respective regions; they share the same
      geometry but frame it from opposite aesthetic perspectives.
      Ideal: 1.25 (Farkas 1994: bizygomatic ≈ 128 mm / bigonial ≈ 102 mm = 1.255).
      Green ±0.08, yellow ±0.15. Direction: 'prominent_cheekbones' / 'square_jaw'.

  submalar_hollow_index
      Frontal proxy for submalar hollowness: fraction by which the lateral face
      profile tapers from bizygomatic level to the cheek level below it.
      Formula: 1 − (bicheek_icu / bizygomatic_icu)
              where bicheek = |P_LEFT_CHEEK.x − P_RIGHT_CHEEK.x|
      0.0 = no taper (very full / round); 0.10 = slight taper (canonical
      youthful fullness); higher values → progressive submalar hollowing.
      Ideal: 0.10 (slight lateral convexity at cheek level; aesthetic literature
              broadly supports mild submalar fullness for a youthful appearance).
      Green ±0.07, yellow ±0.15. Direction: 'submalar_hollow' / 'submalar_full'.

Region: 'cheekbones'. Family: 'cheekbones'. Uses CHEEKBONE_POSE_PARAMS.
"""

from __future__ import annotations

from app.domain.landmarks_mesh import (
    P_LEFT_CHEEK,
    P_LEFT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_LEFT_GONION,
    P_LEFT_ZYGOMATIC,
    P_RIGHT_CHEEK,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_GONION,
    P_RIGHT_ZYGOMATIC,
    P_SUBNASALE,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.confidence_propagation import (
    CHEEKBONE_POSE_PARAMS,
    LOW_CONF_THRESHOLD,
    propagate,
)
from app.services.metrics.registry import register

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_ZYG_WIDTH: tuple[int, ...] = (P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
_DEP_MALAR:     tuple[int, ...] = (
    P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
    P_LEFT_EYE_OUTER, P_RIGHT_EYE_OUTER,
)
_DEP_MIDFACE:   tuple[int, ...] = (P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER, P_SUBNASALE)
_DEP_CBJ:       tuple[int, ...] = (
    P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
    P_LEFT_GONION, P_RIGHT_GONION,
)
_DEP_SUBMALAR:  tuple[int, ...] = (
    P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
    P_LEFT_CHEEK, P_RIGHT_CHEEK,
)

# ---------------------------------------------------------------------------
# Ideal central values & saturation thresholds
# ---------------------------------------------------------------------------
_IDEAL_ZYG_WIDTH  = 4.00   # ICU — Farkas 1994
_IDEAL_MALAR      = 1.33   # ratio — canonical fixture (4.0/3.0)
_IDEAL_MIDFACE    = 1.50   # ICU — Farkas 1994
_IDEAL_CBJ        = 1.25   # ratio — Farkas 1994 (bizygomatic/bigonial)
_IDEAL_SUBMALAR   = 0.10   # ratio — canonical: 10 % taper from zyg to cheek

_MAX_DEV_ZYG_WIDTH = 1.50   # [2.50, 5.50] before conf_raw → 0
_MAX_DEV_MALAR     = 0.50
_MAX_DEV_MIDFACE   = 1.00
_MAX_DEV_CBJ       = 0.40
_MAX_DEV_SUBMALAR  = 0.30


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)


def _hdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    """Horizontal distance |x_a − x_b| in normalised ICU."""
    return abs(float(lm.xy(a)[0]) - float(lm.xy(b)[0]))


def _zyg_direction(v: float) -> str:
    if abs(v - _IDEAL_ZYG_WIDTH) < 0.15:
        return "neutral"
    return "wide_cheeks" if v > _IDEAL_ZYG_WIDTH else "narrow_cheeks"


def _malar_direction(v: float) -> str:
    if abs(v - _IDEAL_MALAR) < 0.05:
        return "neutral"
    return "prominent_cheekbones" if v > _IDEAL_MALAR else "flat_cheekbones"


def _midface_direction(v: float) -> str:
    if abs(v - _IDEAL_MIDFACE) < 0.10:
        return "neutral"
    return "long_midface" if v > _IDEAL_MIDFACE else "short_midface"


def _cbj_direction(v: float) -> str:
    if abs(v - _IDEAL_CBJ) < 0.04:
        return "neutral"
    return "prominent_cheekbones" if v > _IDEAL_CBJ else "square_jaw"


def _submalar_direction(v: float) -> str:
    if abs(v - _IDEAL_SUBMALAR) < 0.035:
        return "neutral"
    return "submalar_hollow" if v > _IDEAL_SUBMALAR else "submalar_full"


# ---------------------------------------------------------------------------
# Calculators
# ---------------------------------------------------------------------------

@register
class ZygomaticWidthRatioCalculator(MetricCalculator):
    """Bizygomatic width in Intercanthal Units (ICU).

    Measures the widest lateral extent of the face at the zygomatic arch level.
    Ideal: 4.00 ICU (Farkas 1994: bizygomatic ≈ 128 mm / ICD 32 mm).
    Green ±0.30, yellow ±0.60.
    """

    metric_id = "zygomatic_width_ratio"
    region    = "cheekbones"
    family    = "cheekbones"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        cr = _conf_raw(v, _IDEAL_ZYG_WIDTH, _MAX_DEV_ZYG_WIDTH)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), CHEEKBONE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.08,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_zyg_direction(v),
            dependency_landmarks=_DEP_ZYG_WIDTH,
        )


@register
class MalarProjectionIndexCalculator(MetricCalculator):
    """Frontal proxy for cheekbone prominence: bizygomatic / biocular width.

    Ideal: 1.33 (canonical fixture: 4.0 ICU / 3.0 ICU biocular).
    Green ±0.10, yellow ±0.20.
    """

    metric_id = "malar_projection_index"
    region    = "cheekbones"
    family    = "cheekbones"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        bizygomatic = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        biocular    = _hdist(lm, P_LEFT_EYE_OUTER, P_RIGHT_EYE_OUTER)
        v = bizygomatic / biocular if biocular > 1e-9 else 0.0
        cr = _conf_raw(v, _IDEAL_MALAR, _MAX_DEV_MALAR)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), CHEEKBONE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_malar_direction(v),
            dependency_landmarks=_DEP_MALAR,
        )


@register
class MidfaceHeightRatioCalculator(MetricCalculator):
    """Midface height in ICU: vertical distance from canthal line to subnasale.

    After intercanthal normalisation the inner-canthus midline y ≈ 0;
    subnasale lies below (positive y in image coordinates).
    Ideal: 1.50 ICU (Farkas 1994: inner canthus → subnasale ≈ 48 mm / ICD 32 mm).
    Green ±0.20, yellow ±0.40.
    """

    metric_id = "midface_height_ratio"
    region    = "cheekbones"
    family    = "cheekbones"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        eye_inner_y = (
            float(lm.xy(P_LEFT_EYE_INNER)[1]) + float(lm.xy(P_RIGHT_EYE_INNER)[1])
        ) / 2.0
        subnasale_y = float(lm.xy(P_SUBNASALE)[1])
        v  = subnasale_y - eye_inner_y   # positive = subnasale below eye level
        cr = _conf_raw(v, _IDEAL_MIDFACE, _MAX_DEV_MIDFACE)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), CHEEKBONE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.06,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_midface_direction(v),
            dependency_landmarks=_DEP_MIDFACE,
        )


@register
class CheekboneToJawRatioCalculator(MetricCalculator):
    """Bizygomatic / bigonial width — cheekbone prominence relative to jaw.

    Complement to ``jaw_width_ratio`` (which is bigonial/bizygomatic = 0.80).
    Ideal: 1.25 (Farkas 1994: bizygomatic ≈ 128 mm / bigonial ≈ 102 mm = 1.255).
    Green ±0.08, yellow ±0.15.
    """

    metric_id = "cheekbone_to_jaw_ratio"
    region    = "cheekbones"
    family    = "cheekbones"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        bizygomatic = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        bigonial    = _hdist(lm, P_LEFT_GONION, P_RIGHT_GONION)
        v = bizygomatic / bigonial if bigonial > 1e-9 else 0.0
        cr = _conf_raw(v, _IDEAL_CBJ, _MAX_DEV_CBJ)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), CHEEKBONE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_cbj_direction(v),
            dependency_landmarks=_DEP_CBJ,
        )


@register
class SubmalarHollowIndexCalculator(MetricCalculator):
    """Frontal proxy for submalar hollowness: 1 − (bicheek / bizygomatic).

    Measures lateral face taper between bizygomatic level and the cheek contour
    below it. 0.0 = no taper; 0.10 = canonical slight fullness; higher = hollow.
    Ideal: 0.10 (slight lateral convexity at cheek level → youthful appearance).
    Green ±0.07, yellow ±0.15.
    """

    metric_id = "submalar_hollow_index"
    region    = "cheekbones"
    family    = "cheekbones"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        bizygomatic = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        bicheek     = _hdist(lm, P_LEFT_CHEEK, P_RIGHT_CHEEK)
        v = 1.0 - (bicheek / bizygomatic) if bizygomatic > 1e-9 else 0.0
        cr = _conf_raw(v, _IDEAL_SUBMALAR, _MAX_DEV_SUBMALAR)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), CHEEKBONE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_submalar_direction(v),
            dependency_landmarks=_DEP_SUBMALAR,
        )
