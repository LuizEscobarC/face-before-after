"""Brow metric family (PR-16, M2 fourth family).

Eight atomic brow metrics — all measurable on a single frontal photo.
``brow_thickness_l`` and ``brow_thickness_r`` are marked *presentation_only*
because Mesh-478 brow landmarks lie along the brow body (not at the superior
and inferior brow-hair edges), so the vertical-span proxy captures arch
curvature rather than true tissue thickness. They appear in the overlay but
never enter the regional score (DEC-6 hard assertion, DEC-10 convention).

  brow_height_l / _r
      Vertical distance from the inner brow corner to the inner canthus of
      the same eye, in ICU (Intercanthal Units).
      Formula: (P_LEFT_EYE_INNER.y − P_BROW_LEFT_INNER.y) / ICD
      Ideal: 0.35 (Farkas 1994: ~11 mm at ICD 32 mm → 0.34; adopted 0.35).
      Green ±0.10, yellow ±0.20.
      Direction: 'high_brow' / 'low_brow' / 'neutral'.

  brow_arch_peak_l / _r
      Fractional position of the arch apex along the brow span.
      The apex is the brow landmark with the smallest y (highest in image).
      Formula: (peak.x − inner.x) / (outer.x − inner.x)
      Ideal: 0.67 (apex at ~2/3 of the way from inner to outer corner,
      above the lateral limbus — Farkas / Romo 2006 canon).
      Green ±0.10, yellow ±0.20. Direction: 'arch_medial' / 'arch_lateral'
      / 'neutral'.

  brow_thickness_l / _r   ← presentation_only=True
      Vertical span (max_y − min_y) across the 5 brow landmarks in ICU.
      This is a proxy for arch curvature / apparent brow thickness.
      Ideal: 0.20 ICU (Farkas ~7–8 mm at ICD 32 mm; arch curvature proxy).
      Green ±0.07, yellow ±0.12. Direction: 'thick_brows' / 'thin_brows'.
      These metrics NEVER enter the regional score (see DEC-6/DEC-10).

  brow_tail_drop_l
      Signed vertical offset: outer_brow.y − inner_brow.y (left side), in ICU.
      Negative = outer end is *above* the inner end (elevated / upswept tail —
      aesthetically desirable). Positive = tail droops below inner corner.
      Ideal: −0.05 (slight lift; Farkas: female ideal outer brow ~1 mm above
      inner brow; Naini 2011: upswept tail recommended for a youthful look).
      Green ±0.08, yellow ±0.15. Direction: 'tail_droops' / 'tail_lifted'
      / 'neutral'.

  interbrow_distance_ratio
      Horizontal gap between the two inner brow corners divided by ICD.
      Formula: |P_BROW_RIGHT_INNER.x − P_BROW_LEFT_INNER.x| / ICD
      Ideal: 1.0 (interbrow space equals one ICD — Farkas 1994 symmetry rule).
      Green ±0.15, yellow ±0.30.
      Direction: 'brows_wide' / 'brows_close' / 'neutral'.

Region: 'brows'. Family: 'brows'. Uses BROW_POSE_PARAMS.
"""

from __future__ import annotations

from app.domain.landmarks_mesh import (
    LM_LEFT_BROW,
    LM_RIGHT_BROW,
    P_BROW_LEFT_INNER,
    P_BROW_LEFT_OUTER,
    P_BROW_RIGHT_INNER,
    P_BROW_RIGHT_OUTER,
    P_LEFT_EYE_INNER,
    P_RIGHT_EYE_INNER,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.confidence_propagation import (
    BROW_POSE_PARAMS,
    LOW_CONF_THRESHOLD,
    propagate,
)
from app.services.metrics.registry import register

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_HEIGHT_L:   tuple[int, ...] = (P_BROW_LEFT_INNER, P_LEFT_EYE_INNER)
_DEP_HEIGHT_R:   tuple[int, ...] = (P_BROW_RIGHT_INNER, P_RIGHT_EYE_INNER)
_DEP_ARCH_L:     tuple[int, ...] = tuple(LM_LEFT_BROW)
_DEP_ARCH_R:     tuple[int, ...] = tuple(LM_RIGHT_BROW)
_DEP_THICK_L:    tuple[int, ...] = tuple(LM_LEFT_BROW)
_DEP_THICK_R:    tuple[int, ...] = tuple(LM_RIGHT_BROW)
_DEP_TAIL_L:     tuple[int, ...] = (P_BROW_LEFT_INNER, P_BROW_LEFT_OUTER)
_DEP_INTERBROW:  tuple[int, ...] = (P_BROW_LEFT_INNER, P_BROW_RIGHT_INNER)


# ---------------------------------------------------------------------------
# Ideal central values & saturation thresholds
# ---------------------------------------------------------------------------
_IDEAL_HEIGHT          = 0.35   # ICU
_IDEAL_ARCH_PEAK       = 0.67   # fraction along inner→outer span
_IDEAL_THICKNESS       = 0.20   # ICU (proxy for apparent brow thickness)
_IDEAL_TAIL_DROP       = -0.05  # ICU (slight lift; negative = outer above inner)
_IDEAL_INTERBROW       = 1.0    # ICU (one ICD gap)

_MAX_DEV_HEIGHT        = 0.20
_MAX_DEV_ARCH_PEAK     = 0.27   # 0.67 ± 0.27 → [0.40, 0.94]
_MAX_DEV_THICKNESS     = 0.20   # loose — proxy signal only
_MAX_DEV_TAIL_DROP     = 0.20
_MAX_DEV_INTERBROW     = 0.45   # 1.0 ± 0.45 → [0.55, 1.45]


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)


def _brow_height(lm: NormalizedLandmarks, brow_inner: int, eye_inner: int) -> float:
    """Vertical distance (brow inner corner → eye inner canthus), in ICU.

    Both landmarks should lie on the same vertical axis (x-similar).
    Returns a positive value when brow is above the eye (expected normal).
    """
    brow_y = float(lm.xy(brow_inner)[1])
    eye_y  = float(lm.xy(eye_inner)[1])
    return (eye_y - brow_y)  # positive = brow is above eye line


def _brow_arch_fraction(lm: NormalizedLandmarks, brow_lm_indices: list[int]) -> float:
    """Fractional position of the arch apex along the brow span.

    The apex is the brow point with the smallest y-value (highest in the image).
    Returns (apex_x − inner_x) / (outer_x − inner_x), where inner/outer are
    the first and last indices of the provided list (outer-first for LEFT,
    inner-first for RIGHT brow convention).

    For LEFT brow (LM_LEFT_BROW = [outer, ..., inner]):
        inner = brow_lm_indices[-1], outer = brow_lm_indices[0]
    For RIGHT brow (LM_RIGHT_BROW = [inner, ..., outer]):
        inner = brow_lm_indices[0], outer = brow_lm_indices[-1]
    Fraction is always (apex → inner) / (outer → inner) regardless of side.
    """
    coords = [lm.xy(i) for i in brow_lm_indices]
    # apex = lowest y value (highest in image)
    apex_idx = min(range(len(coords)), key=lambda k: coords[k][1])
    apex_x = float(coords[apex_idx][0])
    # For both brow lists the "inner" corner is the one closest to the nose;
    # for LEFT brow: index[-1] = inner, index[0] = outer
    # For RIGHT brow: index[0] = inner, index[-1] = outer
    # We must determine which end is "inner" by comparing x to midline (x=0).
    # In normalized coords: midline x = 0; inner canthus is closer to midline.
    # The inner end is whichever endpoint has the larger x-coordinate
    # (less negative for left, less positive for right; i.e., closest to 0).
    x_first = float(coords[0][0])
    x_last  = float(coords[-1][0])
    # inner endpoint = closer to midline (x=0) → smaller |x|
    if abs(x_first) < abs(x_last):
        inner_x = x_first
        outer_x = x_last
    else:
        inner_x = x_last
        outer_x = x_first
    span = outer_x - inner_x
    if abs(span) < 1e-9:
        return 0.5  # degenerate: no horizontal span
    return (apex_x - inner_x) / span


def _brow_thickness(lm: NormalizedLandmarks, brow_lm_indices: list[int]) -> float:
    """Vertical span (max_y − min_y) across all brow landmarks, in ICU.

    This proxy captures arch curvature; it correlates with visual brow
    thickness on Mesh-478 even though the points lie along the brow body
    rather than its edges. Marked *presentation_only* — not used in scoring.
    """
    ys = [float(lm.xy(i)[1]) for i in brow_lm_indices]
    return max(ys) - min(ys)


def _tail_drop(lm: NormalizedLandmarks, outer_idx: int, inner_idx: int) -> float:
    """Signed tail-drop in ICU: outer_brow.y − inner_brow.y.

    Negative = outer end is above inner end (lifted / upswept tail — ideal).
    Positive = outer end is below inner end (drooping tail).
    """
    outer_y = float(lm.xy(outer_idx)[1])
    inner_y = float(lm.xy(inner_idx)[1])
    return outer_y - inner_y


def _height_direction(value: float) -> str:
    if abs(value - _IDEAL_HEIGHT) < 0.08:
        return "neutral"
    return "high_brow" if value > _IDEAL_HEIGHT else "low_brow"


def _arch_direction(value: float) -> str:
    if abs(value - _IDEAL_ARCH_PEAK) < 0.10:
        return "neutral"
    return "arch_lateral" if value > _IDEAL_ARCH_PEAK else "arch_medial"


def _thickness_direction(value: float) -> str:
    if abs(value - _IDEAL_THICKNESS) < 0.07:
        return "neutral"
    return "thick_brows" if value > _IDEAL_THICKNESS else "thin_brows"


def _tail_direction(value: float) -> str:
    """Directions for brow tail drop (signed, ideal = −0.05)."""
    if -0.10 <= value <= 0.03:
        return "neutral"
    return "tail_droops" if value > 0.03 else "tail_lifted"


def _interbrow_direction(value: float) -> str:
    if abs(value - _IDEAL_INTERBROW) < 0.12:
        return "neutral"
    return "brows_wide" if value > _IDEAL_INTERBROW else "brows_close"


# ---------------------------------------------------------------------------
# Calculators
# ---------------------------------------------------------------------------

@register
class BrowHeightLeftCalculator(MetricCalculator):
    """Left brow height above the inner canthus.

    Measured as (inner_canthus.y − inner_brow.y) in ICU. Positive values mean
    the brow is elevated above the eye (normal range 0.25–0.45).
    Ideal: 0.35 (Farkas 1994). Green ±0.10, yellow ±0.20.
    """

    metric_id = "brow_height_l"
    region    = "brows"
    family    = "brows"
    unit      = "ICU"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = _brow_height(lm, P_BROW_LEFT_INNER, P_LEFT_EYE_INNER)
        cr = _conf_raw(v, _IDEAL_HEIGHT, _MAX_DEV_HEIGHT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        # improvement vector: brow moves up (dy<0) if low_brow, down (dy>0) if high_brow
        deviation_from_ideal = v - _IDEAL_HEIGHT
        vec_y = float(max(-0.3, min(0.3, -deviation_from_ideal)))
        brow_improvement_vector = (0.0, vec_y)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.03,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_height_direction(v),
            dependency_landmarks=_DEP_HEIGHT_L,
            improvement_vector=brow_improvement_vector,
        )


@register
class BrowHeightRightCalculator(MetricCalculator):
    """Right brow height above the inner canthus.

    Same convention as BrowHeightLeftCalculator.
    """

    metric_id = "brow_height_r"
    region    = "brows"
    family    = "brows"
    unit      = "ICU"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = _brow_height(lm, P_BROW_RIGHT_INNER, P_RIGHT_EYE_INNER)
        cr = _conf_raw(v, _IDEAL_HEIGHT, _MAX_DEV_HEIGHT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        # improvement vector: brow moves up (dy<0) if low_brow, down (dy>0) if high_brow
        deviation_from_ideal = v - _IDEAL_HEIGHT
        vec_y = float(max(-0.3, min(0.3, -deviation_from_ideal)))
        brow_improvement_vector = (0.0, vec_y)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.03,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_height_direction(v),
            dependency_landmarks=_DEP_HEIGHT_R,
            improvement_vector=brow_improvement_vector,
        )


@register
class BrowArchPeakLeftCalculator(MetricCalculator):
    """Fractional position of the left brow arch apex along the brow span.

    The apex is the brow landmark with the smallest y (highest in the image).
    Ideal: 0.67 (apex at 2/3 of the way from inner to outer corner, above
    the lateral limbus — Farkas / Romo 2006 aesthetic canon).
    Green ±0.10, yellow ±0.20.
    """

    metric_id = "brow_arch_peak_l"
    region    = "brows"
    family    = "brows"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = _brow_arch_fraction(lm, LM_LEFT_BROW)
        cr = _conf_raw(v, _IDEAL_ARCH_PEAK, _MAX_DEV_ARCH_PEAK)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_arch_direction(v),
            dependency_landmarks=_DEP_ARCH_L,
        )


@register
class BrowArchPeakRightCalculator(MetricCalculator):
    """Fractional position of the right brow arch apex along the brow span.

    Same convention as BrowArchPeakLeftCalculator.
    """

    metric_id = "brow_arch_peak_r"
    region    = "brows"
    family    = "brows"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = _brow_arch_fraction(lm, LM_RIGHT_BROW)
        cr = _conf_raw(v, _IDEAL_ARCH_PEAK, _MAX_DEV_ARCH_PEAK)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_arch_direction(v),
            dependency_landmarks=_DEP_ARCH_R,
        )


@register
class BrowThicknessLeftCalculator(MetricCalculator):
    """Left brow vertical span (proxy for apparent thickness).

    *presentation_only* — appears in overlay / report but NEVER enters the
    regional or global score (DEC-6 hard assertion). Mesh-478 brow points lie
    along the brow body, not at the hair-edge boundaries, so this measures
    arch curvature rather than true tissue thickness.
    Ideal: 0.20 ICU. Green ±0.07, yellow ±0.12.
    """

    metric_id          = "brow_thickness_l"
    region             = "brows"
    family             = "brows"
    unit               = "ICU"
    presentation_only  = True

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = _brow_thickness(lm, LM_LEFT_BROW)
        cr = _conf_raw(v, _IDEAL_THICKNESS, _MAX_DEV_THICKNESS)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_thickness_direction(v),
            dependency_landmarks=_DEP_THICK_L,
            presentation_only=True,
        )


@register
class BrowThicknessRightCalculator(MetricCalculator):
    """Right brow vertical span (proxy for apparent thickness).

    Same convention as BrowThicknessLeftCalculator. presentation_only.
    """

    metric_id          = "brow_thickness_r"
    region             = "brows"
    family             = "brows"
    unit               = "ICU"
    presentation_only  = True

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = _brow_thickness(lm, LM_RIGHT_BROW)
        cr = _conf_raw(v, _IDEAL_THICKNESS, _MAX_DEV_THICKNESS)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_thickness_direction(v),
            dependency_landmarks=_DEP_THICK_R,
            presentation_only=True,
        )


@register
class BrowTailDropLeftCalculator(MetricCalculator):
    """Left brow tail drop: signed vertical offset outer − inner brow, in ICU.

    Negative = outer end is above the inner end (elevated / upswept tail).
    Positive = outer end droops below the inner corner.
    Ideal: −0.05 (Farkas: outer brow ~1 mm above inner brow level for a
    youthful look; Naini 2011 recommends slight upswept tail). Green ±0.08.
    """

    metric_id = "brow_tail_drop_l"
    region    = "brows"
    family    = "brows"
    unit      = "ICU"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = _tail_drop(lm, P_BROW_LEFT_OUTER, P_BROW_LEFT_INNER)
        cr = _conf_raw(v, _IDEAL_TAIL_DROP, _MAX_DEV_TAIL_DROP)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.03,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_tail_direction(v),
            dependency_landmarks=_DEP_TAIL_L,
        )


@register
class InterbrowDistanceRatioCalculator(MetricCalculator):
    """Interbrow distance ratio: horizontal gap between inner brow corners / ICD.

    Formula: |P_BROW_RIGHT_INNER.x − P_BROW_LEFT_INNER.x| / ICD
    In normalized space (ICD = 1.0 ICU) this is just the raw x-distance.
    Ideal: 1.0 (interbrow gap equals one ICD — Farkas 1994 symmetry canon).
    Green ±0.15, yellow ±0.30. Direction: 'brows_wide' / 'brows_close'.
    """

    metric_id = "interbrow_distance_ratio"
    region    = "brows"
    family    = "brows"
    unit      = "ICU"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        left_x  = float(lm.xy(P_BROW_LEFT_INNER)[0])
        right_x = float(lm.xy(P_BROW_RIGHT_INNER)[0])
        v  = abs(right_x - left_x)
        cr = _conf_raw(v, _IDEAL_INTERBROW, _MAX_DEV_INTERBROW)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.03,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_interbrow_direction(v),
            dependency_landmarks=_DEP_INTERBROW,
        )
