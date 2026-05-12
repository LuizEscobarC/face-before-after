"""PR-C3 Wave 3 — 10 final metric calculators (jaw/brows/cheekbones/forehead/global).

Family overview:
  jaw region (1):
    - mentolabial_fold_proxy           (lower-lip-bot → menton vertical / ICD)

  brows region (3):
    - brow_arch_peak_position_l        (peak x along inner-outer chord)
    - brow_arch_peak_position_r        (mirror)
    - intersuperciliary_distance_ratio (inner brows distance / ICD)

  cheekbones region (3):
    - buccal_fat_index                 (cheek y vertical position 0..1)
    - ogee_curve_proxy                 STUB (requires_pixel_analysis=True)
    - infraorbital_hollow_index        (tear-trough vs lower-lid in ICU)

  forehead region (2):
    - forehead_slope_proxy             STUB (requires lateral view)
    - glabella_prominence_proxy        (avg brow-inner lateral offset / ICD)

  global (1):
    - facial_index_anthropometric      (face_h/face_w × 100; Martin index)
"""

from __future__ import annotations

from app.domain.landmarks_mesh import (
    LM_LEFT_BROW,
    LM_RIGHT_BROW,
    P_BROW_LEFT_INNER,
    P_BROW_LEFT_OUTER,
    P_BROW_RIGHT_INNER,
    P_BROW_RIGHT_OUTER,
    P_FOREHEAD_CROWN,
    P_LEFT_CHEEK,
    P_LEFT_EYE_BOT,
    P_LEFT_EYE_OUTER,
    P_LEFT_GONION,
    P_LEFT_ZYGOMATIC,
    P_LOWER_LIP_BOT,
    P_MENTON,
    P_NASION,
    P_RIGHT_CHEEK,
    P_RIGHT_EYE_BOT,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_GONION,
    P_RIGHT_ZYGOMATIC,
    P_TEAR_TROUGH_L,
    P_TEAR_TROUGH_R,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.confidence_propagation import (
    BROW_POSE_PARAMS,
    CHEEKBONE_POSE_PARAMS,
    FOREHEAD_POSE_PARAMS,
    GLOBAL_SHAPE_POSE_PARAMS,
    JAW_POSE_PARAMS,
    LOW_CONF_THRESHOLD,
    propagate,
)
from app.services.metrics.registry import register
from app.services.metrics._trichion import (
    effective_trichion_y,
    trichion_confidence_multiplier,
)

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_MENTOLAB:    tuple[int, ...] = (P_LOWER_LIP_BOT, P_MENTON)
_DEP_PEAK_L:      tuple[int, ...] = tuple(LM_LEFT_BROW)
_DEP_PEAK_R:      tuple[int, ...] = tuple(LM_RIGHT_BROW)
_DEP_INTERSUP:    tuple[int, ...] = (P_BROW_LEFT_INNER, P_BROW_RIGHT_INNER)
_DEP_BUCCAL:      tuple[int, ...] = (P_LEFT_CHEEK, P_RIGHT_CHEEK,
                                     P_LEFT_EYE_OUTER, P_RIGHT_EYE_OUTER,
                                     P_LEFT_GONION, P_RIGHT_GONION)
_DEP_INFRA:       tuple[int, ...] = (P_TEAR_TROUGH_L, P_TEAR_TROUGH_R,
                                     P_LEFT_EYE_BOT, P_RIGHT_EYE_BOT)
_DEP_GLABELLA:    tuple[int, ...] = (P_NASION, P_BROW_LEFT_INNER, P_BROW_RIGHT_INNER)
_DEP_FACE_INDEX:  tuple[int, ...] = (P_FOREHEAD_CROWN, P_MENTON,
                                     P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)

# ---------------------------------------------------------------------------
# Ideal central values & saturation thresholds
# ---------------------------------------------------------------------------
_IDEAL_MENTOLAB    = 0.40   # ICU
_IDEAL_PEAK_POS    = 0.50   # 0=inner ↔ 1=outer; centred peak as canonical
_IDEAL_INTERSUP    = 1.00   # ratio (Naini: ≈ ICD)
_IDEAL_BUCCAL      = 0.45   # 0=eye level, 1=gonion level
_IDEAL_INFRA       = 0.08   # ICU
_IDEAL_GLABELLA    = 0.50   # ICU (avg brow-inner lateral offset / ICD)
_IDEAL_FACE_INDEX  = 87.5   # Martin index (mesoprosopic centre)

_MAX_DEV_MENTOLAB   = 0.15
_MAX_DEV_PEAK       = 0.30
_MAX_DEV_INTERSUP   = 0.20
_MAX_DEV_BUCCAL     = 0.20
_MAX_DEV_INFRA      = 0.07
_MAX_DEV_GLABELLA   = 0.20
_MAX_DEV_FACE_INDEX = 12.5


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    return abs(float(lm.xy(a)[0]) - float(lm.xy(b)[0]))


def _vdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    return abs(float(lm.xy(a)[1]) - float(lm.xy(b)[1]))


def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)


def _direction_signed(value: float, ideal: float, tol: float, above: str, below: str) -> str:
    if abs(value - ideal) < tol:
        return "neutral"
    return above if value > ideal else below


def _brow_peak_position(lm: NormalizedLandmarks, brow_indices: list[int],
                        inner_idx: int, outer_idx: int) -> float:
    """Return position of arch peak (argmin y) along the inner→outer chord.

    Result in [0, 1]: 0 = peak coincides with inner brow, 1 = with outer brow.
    """
    inner_x = float(lm.xy(inner_idx)[0])
    outer_x = float(lm.xy(outer_idx)[0])
    span = outer_x - inner_x
    if abs(span) < 1e-9:
        return 0.5
    # Find the brow point with smallest y (highest on screen)
    peak_y = float("inf")
    peak_x = inner_x
    for idx in brow_indices:
        x, y = lm.xy(idx)
        yf = float(y)
        if yf < peak_y:
            peak_y = yf
            peak_x = float(x)
    pos = (peak_x - inner_x) / span
    # Clamp to [0, 1]
    return max(0.0, min(1.0, pos))


# ---------------------------------------------------------------------------
# 21. mentolabial_fold_proxy — vertical (lower-lip-bot → menton) / ICD
# ---------------------------------------------------------------------------

@register
class MentolabialFoldProxyCalculator(MetricCalculator):
    """Vertical distance from lower-lip-bot to menton / ICD.

    Frontal proxy for the mentolabial sulcus depth (true depth requires
    sagittal/lateral view).  Naini hint: ≈ 0.40 ICU in adults.
    """

    metric_id = "mentolabial_fold_proxy"
    region    = "jaw"
    family    = "jaw"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _vdist(lm, P_LOWER_LIP_BOT, P_MENTON)
        cr = _conf_raw(v, _IDEAL_MENTOLAB, _MAX_DEV_MENTOLAB)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), JAW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_MENTOLAB, 0.05, "long_lip_chin", "short_lip_chin"),
            dependency_landmarks=_DEP_MENTOLAB,
        )


# ---------------------------------------------------------------------------
# 22. brow_arch_peak_position_l — position of left arch peak (0=inner, 1=outer)
# ---------------------------------------------------------------------------

@register
class BrowArchPeakPositionLCalculator(MetricCalculator):
    """Position of the left brow arch peak along the inner-outer chord.

    0 = peak at inner brow; 1 = peak at outer brow.  Naini suggests the
    aesthetic peak sits near the lateral 2/3 (≈0.66 from inner).  We use
    a slightly relaxed midpoint ideal to accommodate brow-shape diversity.
    """

    metric_id = "brow_arch_peak_position_l"
    region    = "brows"
    family    = "brows"
    unit      = "index_0_1"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _brow_peak_position(lm, list(LM_LEFT_BROW),
                                P_BROW_LEFT_INNER, P_BROW_LEFT_OUTER)
        cr = _conf_raw(v, _IDEAL_PEAK_POS, _MAX_DEV_PEAK)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_PEAK_POS, 0.10, "outer_peak", "inner_peak"),
            dependency_landmarks=_DEP_PEAK_L,
        )


# ---------------------------------------------------------------------------
# 23. brow_arch_peak_position_r — mirror
# ---------------------------------------------------------------------------

@register
class BrowArchPeakPositionRCalculator(MetricCalculator):
    """Position of the right brow arch peak along the inner-outer chord."""

    metric_id = "brow_arch_peak_position_r"
    region    = "brows"
    family    = "brows"
    unit      = "index_0_1"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _brow_peak_position(lm, list(LM_RIGHT_BROW),
                                P_BROW_RIGHT_INNER, P_BROW_RIGHT_OUTER)
        cr = _conf_raw(v, _IDEAL_PEAK_POS, _MAX_DEV_PEAK)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_PEAK_POS, 0.10, "outer_peak", "inner_peak"),
            dependency_landmarks=_DEP_PEAK_R,
        )


# ---------------------------------------------------------------------------
# 24. intersuperciliary_distance_ratio — distance(brow inners) / ICD
# ---------------------------------------------------------------------------

@register
class IntersuperciliaryDistanceRatioCalculator(MetricCalculator):
    """Distance between inner brow heads / ICD. Naini ideal ≈ 1.0."""

    metric_id = "intersuperciliary_distance_ratio"
    region    = "brows"
    family    = "brows"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _hdist(lm, P_BROW_LEFT_INNER, P_BROW_RIGHT_INNER)
        cr = _conf_raw(v, _IDEAL_INTERSUP, _MAX_DEV_INTERSUP)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), BROW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_INTERSUP, 0.07, "wide_set_brows", "close_set_brows"),
            dependency_landmarks=_DEP_INTERSUP,
        )


# ---------------------------------------------------------------------------
# 25. buccal_fat_index — vertical position of cheek between eye_outer & gonion
# ---------------------------------------------------------------------------

@register
class BuccalFatIndexCalculator(MetricCalculator):
    """Vertical position of the cheek anchor between eye level and gonion.

    Average of left/right of (cheek.y − eye_outer.y)/(gonion.y − eye_outer.y).
    0 = cheek at eye level (high cheekbone); 1 = at gonion (filled lower face);
    Naini hint: ~0.45 (cheek between mid-face and lower-mid-face).
    """

    metric_id = "buccal_fat_index"
    region    = "cheekbones"
    family    = "cheekbones"
    unit      = "index_0_1"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        l_eye = float(lm.xy(P_LEFT_EYE_OUTER)[1])
        r_eye = float(lm.xy(P_RIGHT_EYE_OUTER)[1])
        l_chk = float(lm.xy(P_LEFT_CHEEK)[1])
        r_chk = float(lm.xy(P_RIGHT_CHEEK)[1])
        l_gon = float(lm.xy(P_LEFT_GONION)[1])
        r_gon = float(lm.xy(P_RIGHT_GONION)[1])
        l_span = l_gon - l_eye
        r_span = r_gon - r_eye
        l_pos = (l_chk - l_eye) / l_span if abs(l_span) > 1e-9 else _IDEAL_BUCCAL
        r_pos = (r_chk - r_eye) / r_span if abs(r_span) > 1e-9 else _IDEAL_BUCCAL
        v = (l_pos + r_pos) / 2.0
        cr = _conf_raw(v, _IDEAL_BUCCAL, _MAX_DEV_BUCCAL)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), CHEEKBONE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.06,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_BUCCAL, 0.07, "low_cheek_fat", "high_cheek_fat"),
            dependency_landmarks=_DEP_BUCCAL,
        )


# ---------------------------------------------------------------------------
# 26. ogee_curve_proxy — STUB (requires pixel/depth analysis of cheek profile)
# ---------------------------------------------------------------------------

@register
class OgeeCurveProxyCalculator(MetricCalculator):
    """S-shaped (ogee) cheek curvature index — requires pixel/depth analysis.

    The classic ogee curve is a sagittal/oblique-view feature.  In a flat
    Mesh-478 frontal there is no information to characterise it.  Stubbed
    via DEC-10 pattern; future implementation will use 3-quarter view.
    """

    metric_id              = "ogee_curve_proxy"
    region                 = "cheekbones"
    family                 = "cheekbones"
    unit                   = "index_0_1"
    requires_pixel_analysis: bool = True

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=0.0, error=0.0,
            confidence_raw=0.0, confidence_final=0.0,
            is_low_confidence=True,
            direction="not_computed",
            dependency_landmarks=(),
        )


# ---------------------------------------------------------------------------
# 27. infraorbital_hollow_index — avg(tear_trough.y - eye_bot.y)/ICD
# ---------------------------------------------------------------------------

@register
class InfraorbitalHollowIndexCalculator(MetricCalculator):
    """Average vertical distance from lower lid to tear-trough anchor / ICD.

    Higher = deeper infraorbital hollow ("dark circle" anatomical correlate).
    Healthy youthful range ~ 0.05–0.10 ICU. Ideal mid 0.08.
    """

    metric_id = "infraorbital_hollow_index"
    region    = "cheekbones"
    family    = "cheekbones"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        l_drop = abs(float(lm.xy(P_TEAR_TROUGH_L)[1]) - float(lm.xy(P_LEFT_EYE_BOT)[1]))
        r_drop = abs(float(lm.xy(P_TEAR_TROUGH_R)[1]) - float(lm.xy(P_RIGHT_EYE_BOT)[1]))
        v = (l_drop + r_drop) / 2.0
        cr = _conf_raw(v, _IDEAL_INFRA, _MAX_DEV_INFRA)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), CHEEKBONE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.03,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_INFRA, 0.03, "deep_hollow", "shallow_hollow"),
            dependency_landmarks=_DEP_INFRA,
        )


# ---------------------------------------------------------------------------
# 28. forehead_slope_proxy — STUB (requires lateral view)
# ---------------------------------------------------------------------------

@register
class ForeheadSlopeProxyCalculator(MetricCalculator):
    """Sagittal slope of the forehead — requires lateral view.

    Cannot be computed from a frontal Mesh-478 (no z-axis depth at the
    crown).  Registered as pixel-dep stub.
    """

    metric_id              = "forehead_slope_proxy"
    region                 = "forehead"
    family                 = "forehead"
    unit                   = "degrees"
    requires_pixel_analysis: bool = True

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=0.0, error=0.0,
            confidence_raw=0.0, confidence_final=0.0,
            is_low_confidence=True,
            direction="not_computed",
            dependency_landmarks=(),
        )


# ---------------------------------------------------------------------------
# 29. glabella_prominence_proxy — avg lateral offset of brow inners from nasion / ICD
# ---------------------------------------------------------------------------

@register
class GlabellaProminenceProxyCalculator(MetricCalculator):
    """Average lateral displacement of inner brows from the nasion midline / ICD.

    Acts as a proxy for the breadth of the glabella (broad glabella ↔
    inner brows displaced laterally).  Naini hint: ~0.50 ICU.
    """

    metric_id = "glabella_prominence_proxy"
    region    = "forehead"
    family    = "forehead"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        nas_x = float(lm.xy(P_NASION)[0])
        l_off = abs(float(lm.xy(P_BROW_LEFT_INNER)[0]) - nas_x)
        r_off = abs(float(lm.xy(P_BROW_RIGHT_INNER)[0]) - nas_x)
        v = (l_off + r_off) / 2.0
        cr = _conf_raw(v, _IDEAL_GLABELLA, _MAX_DEV_GLABELLA)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), FOREHEAD_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_GLABELLA, 0.07, "broad_glabella", "narrow_glabella"),
            dependency_landmarks=_DEP_GLABELLA,
        )


# ---------------------------------------------------------------------------
# 30. facial_index_anthropometric — Martin index = (face_h / face_w) × 100
# ---------------------------------------------------------------------------

@register
class FacialIndexAnthropometricCalculator(MetricCalculator):
    """Martin-Saller facial index: (face_height / bizygomatic_width) × 100.

    Anthropometric classification ranges:
      hypereuryprosopic <80 ; euryprosopic 80–84.9 ; mesoprosopic 85–89.9
      ; leptoprosopic 90–94.9 ; hyperleptoprosopic >95
    Mesoprosopic centre (87.5) used as canonical aesthetic ideal.
    """

    metric_id = "facial_index_anthropometric"
    region    = "global"
    family    = "global_shape"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        menton_y  = float(lm.xy(P_MENTON)[1])
        trichion_y = effective_trichion_y(lm, ctx)
        face_h = abs(menton_y - trichion_y)
        face_w = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        v = (face_h / face_w) * 100.0 if face_w > 1e-9 else _IDEAL_FACE_INDEX
        cr = _conf_raw(v, _IDEAL_FACE_INDEX, _MAX_DEV_FACE_INDEX)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), GLOBAL_SHAPE_POSE_PARAMS)
        cf = cf * trichion_confidence_multiplier(ctx)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=2.0,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_FACE_INDEX, 2.5, "long_face", "wide_face"),
            dependency_landmarks=_DEP_FACE_INDEX,
        )
