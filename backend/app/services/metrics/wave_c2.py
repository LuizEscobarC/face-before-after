"""PR-C2 Wave 2 — 10 new metric calculators (mouth/nose/jaw extensions).

Family overview:
  nose region (3 calculators):
    - nasolabial_angle_proxy        STUB (requires lateral view; pixel-dep)
    - alar_flare_index              alar width / ICD (Naini ideal 1.0)

  mouth region (5 calculators):
    - cupids_bow_definition         (philtrum_y - upper_lip_top_y) / mouth_w
    - lip_volume_ratio              upper vermilion height / lower vermilion h
    - oral_commissure_height_asym   |L_y − R_y| in ICU
    - philtrum_width_ratio          philtrum_width / mouth_width
    - smile_line_curvature          (mouth-corner-line departure) / mouth_w

  jaw region (3 calculators):
    - chin_projection_proxy            (menton.y − subnasale.y) / face_h
    - mandibular_corpus_length_ratio   gonion→menton avg / bizygomatic
    - masseteric_prominence_proxy      masseter_distance / bizygomatic

All 2D landmark-based (computable from frontal Mesh-478) EXCEPT
nasolabial_angle_proxy which requires lateral / depth and is registered
as a pixel-dep stub (DEC-10 pattern).
"""

from __future__ import annotations

from app.domain.landmarks_mesh import (
    P_LEFT_GONION,
    P_LEFT_MOUTH,
    P_LEFT_ZYGOMATIC,
    P_LOWER_LIP,
    P_LOWER_LIP_BOT,
    P_MASSETER_L,
    P_MASSETER_R,
    P_MENTON,
    P_NOSE_LEFT,
    P_NOSE_RIGHT,
    P_PHILTRUM_LEFT,
    P_PHILTRUM_RIGHT,
    P_RIGHT_GONION,
    P_RIGHT_MOUTH,
    P_RIGHT_ZYGOMATIC,
    P_SUBNASALE,
    P_UPPER_LIP,
    P_UPPER_LIP_TOP,
    P_FOREHEAD_CROWN,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.confidence_propagation import (
    JAW_POSE_PARAMS,
    LOW_CONF_THRESHOLD,
    MOUTH_POSE_PARAMS,
    NOSE_POSE_PARAMS,
    propagate,
)
from app.services.metrics.registry import register

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_NASOLAB:    tuple[int, ...] = (P_NOSE_LEFT, P_NOSE_RIGHT, P_SUBNASALE, P_UPPER_LIP_TOP)
_DEP_ALAR_FLARE: tuple[int, ...] = (P_NOSE_LEFT, P_NOSE_RIGHT)
_DEP_CUPID:      tuple[int, ...] = (P_PHILTRUM_LEFT, P_PHILTRUM_RIGHT, P_UPPER_LIP_TOP, P_LEFT_MOUTH, P_RIGHT_MOUTH)
_DEP_LIP_VOL:    tuple[int, ...] = (P_UPPER_LIP_TOP, P_UPPER_LIP, P_LOWER_LIP, P_LOWER_LIP_BOT)
_DEP_COMMISSURE: tuple[int, ...] = (P_LEFT_MOUTH, P_RIGHT_MOUTH)
_DEP_PHILTRUM:   tuple[int, ...] = (P_PHILTRUM_LEFT, P_PHILTRUM_RIGHT, P_LEFT_MOUTH, P_RIGHT_MOUTH)
_DEP_SMILE:      tuple[int, ...] = (P_LEFT_MOUTH, P_RIGHT_MOUTH, P_UPPER_LIP_TOP)
_DEP_CHIN_PROJ:  tuple[int, ...] = (P_SUBNASALE, P_MENTON, P_FOREHEAD_CROWN)
_DEP_CORPUS:     tuple[int, ...] = (P_LEFT_GONION, P_RIGHT_GONION, P_MENTON, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
_DEP_MASSETER:   tuple[int, ...] = (P_MASSETER_L, P_MASSETER_R, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)


# ---------------------------------------------------------------------------
# Ideal central values & saturation thresholds
# ---------------------------------------------------------------------------
_IDEAL_ALAR_FLARE     = 1.00   # ICU (Naini: alar base ≈ ICD)
_IDEAL_CUPID          = 0.05   # ratio (philtrum-to-bow / mouth_w; Naini moderate bow)
_IDEAL_LIP_VOL        = 0.625  # ratio (upper:lower = 1:1.6; upper/lower=0.625)
_IDEAL_COMMISSURE     = 0.0    # ICU
_IDEAL_PHILTRUM_W     = 0.30   # ratio (Naini)
_IDEAL_SMILE          = 0.08   # ratio (slight upper-lip arch above corners)
_IDEAL_CHIN_PROJ      = 0.33   # ratio (Farkas lower-third)
_IDEAL_CORPUS         = 0.25   # ratio (gonion-menton chord / bizygomatic)
_IDEAL_MASSETER       = 0.55   # ratio (masseter_dist / bizygomatic)

_MAX_DEV_ALAR_FLARE   = 0.30
_MAX_DEV_CUPID        = 0.10
_MAX_DEV_LIP_VOL      = 0.25
_MAX_DEV_COMMISSURE   = 0.07
_MAX_DEV_PHILTRUM_W   = 0.15
_MAX_DEV_SMILE        = 0.10
_MAX_DEV_CHIN_PROJ    = 0.07
_MAX_DEV_CORPUS       = 0.10
_MAX_DEV_MASSETER     = 0.15


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    return abs(float(lm.xy(a)[0]) - float(lm.xy(b)[0]))


def _vdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    return abs(float(lm.xy(a)[1]) - float(lm.xy(b)[1]))


def _dist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    ax, ay = lm.xy(a)
    bx, by = lm.xy(b)
    return float(((ax - bx) ** 2 + (ay - by) ** 2) ** 0.5)


def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)


def _direction_signed(value: float, ideal: float, tol: float, above: str, below: str) -> str:
    if abs(value - ideal) < tol:
        return "neutral"
    return above if value > ideal else below


# ---------------------------------------------------------------------------
# 11. nasolabial_angle_proxy — pixel-dep stub (DEC-10 pattern)
# ---------------------------------------------------------------------------

@register
class NasolabialAngleProxyCalculator(MetricCalculator):
    """2D proxy of the classical nasolabial angle (Ricketts ~95–105°).

    True nasolabial angle is sagittal (lateral view).  In a frontal
    Mesh-478 photo the alar→subnasale→upper-lip vectors are nearly
    collinear on the midline → the 2D angle degenerates.  Therefore this
    metric is registered as a pixel-dep stub and returns zero confidence.
    A future lateral-photo / depth-aware implementation will replace it.
    """

    metric_id              = "nasolabial_angle_proxy"
    region                 = "nose"
    family                 = "nose"
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
# 12. alar_flare_index — alar width / ICD (Naini ideal ≈ 1.0)
# ---------------------------------------------------------------------------

@register
class AlarFlareIndexCalculator(MetricCalculator):
    """Alar base width / 1.0 ICU.  Naini ideal: alar ≈ intercanthal."""

    metric_id = "alar_flare_index"
    region    = "nose"
    family    = "nose"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _hdist(lm, P_NOSE_LEFT, P_NOSE_RIGHT)
        cr = _conf_raw(v, _IDEAL_ALAR_FLARE, _MAX_DEV_ALAR_FLARE)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), NOSE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_ALAR_FLARE, 0.10, "wide_alar", "narrow_alar"),
            dependency_landmarks=_DEP_ALAR_FLARE,
        )


# ---------------------------------------------------------------------------
# 13. cupids_bow_definition — vertical depth of bow / mouth width
# ---------------------------------------------------------------------------

@register
class CupidsBowDefinitionCalculator(MetricCalculator):
    """Cupid's bow depth: |avg(philtrum_y) - upper_lip_top_y| / mouth_width.

    Higher = more pronounced (peaked) bow; ~0 = flat lip line.
    """

    metric_id = "cupids_bow_definition"
    region    = "mouth"
    family    = "mouth"
    unit      = "index_0_1"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        phil_y = (float(lm.xy(P_PHILTRUM_LEFT)[1]) + float(lm.xy(P_PHILTRUM_RIGHT)[1])) / 2.0
        bow_y  = float(lm.xy(P_UPPER_LIP_TOP)[1])
        depth  = abs(phil_y - bow_y)
        mouth_w = _hdist(lm, P_LEFT_MOUTH, P_RIGHT_MOUTH)
        v = depth / mouth_w if mouth_w > 1e-9 else 0.0
        cr = _conf_raw(v, _IDEAL_CUPID, _MAX_DEV_CUPID)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.03,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_CUPID, 0.02, "prominent_bow", "flat_bow"),
            dependency_landmarks=_DEP_CUPID,
        )


# ---------------------------------------------------------------------------
# 14. lip_volume_ratio — upper vermilion / lower vermilion (Naini 1:1.6)
# ---------------------------------------------------------------------------

@register
class LipVolumeRatioCalculator(MetricCalculator):
    """Upper vermilion height / lower vermilion height. Ideal: 0.625 (1:1.6)."""

    metric_id = "lip_volume_ratio"
    region    = "mouth"
    family    = "mouth"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        upper = _vdist(lm, P_UPPER_LIP_TOP, P_UPPER_LIP)
        lower = _vdist(lm, P_LOWER_LIP, P_LOWER_LIP_BOT)
        v = upper / lower if lower > 1e-9 else _IDEAL_LIP_VOL
        cr = _conf_raw(v, _IDEAL_LIP_VOL, _MAX_DEV_LIP_VOL)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_LIP_VOL, 0.10, "upper_dominant", "lower_dominant"),
            dependency_landmarks=_DEP_LIP_VOL,
        )


# ---------------------------------------------------------------------------
# 15. oral_commissure_height_asym — |L_y − R_y| in ICU
# ---------------------------------------------------------------------------

@register
class OralCommissureHeightAsymCalculator(MetricCalculator):
    """|left_mouth.y − right_mouth.y| in ICU. Canonical 0 (level corners)."""

    metric_id = "oral_commissure_height_asym"
    region    = "mouth"
    family    = "mouth"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _vdist(lm, P_LEFT_MOUTH, P_RIGHT_MOUTH)
        cr = _conf_raw(v, _IDEAL_COMMISSURE, _MAX_DEV_COMMISSURE)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        ly = float(lm.xy(P_LEFT_MOUTH)[1])
        ry = float(lm.xy(P_RIGHT_MOUTH)[1])
        if abs(ly - ry) < 0.02:
            direction = "neutral"
        else:
            direction = "left_corner_low" if ly > ry else "right_corner_low"
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.02,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=direction,
            dependency_landmarks=_DEP_COMMISSURE,
        )


# ---------------------------------------------------------------------------
# 16. philtrum_width_ratio — philtrum_width / mouth_width
# ---------------------------------------------------------------------------

@register
class PhiltrumWidthRatioCalculator(MetricCalculator):
    """distance(philtrum_L, philtrum_R) / mouth_width. Naini ideal: ~0.30."""

    metric_id = "philtrum_width_ratio"
    region    = "mouth"
    family    = "mouth"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        phil_w = _hdist(lm, P_PHILTRUM_LEFT, P_PHILTRUM_RIGHT)
        mouth_w = _hdist(lm, P_LEFT_MOUTH, P_RIGHT_MOUTH)
        v = phil_w / mouth_w if mouth_w > 1e-9 else _IDEAL_PHILTRUM_W
        cr = _conf_raw(v, _IDEAL_PHILTRUM_W, _MAX_DEV_PHILTRUM_W)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_PHILTRUM_W, 0.05, "wide_philtrum", "narrow_philtrum"),
            dependency_landmarks=_DEP_PHILTRUM,
        )


# ---------------------------------------------------------------------------
# 17. smile_line_curvature — vertical departure of upper-lip apex from
# corner-line, normalized by mouth width.
# ---------------------------------------------------------------------------

@register
class SmileLineCurvatureCalculator(MetricCalculator):
    """Curvature of the upper lip relative to the mouth-corner chord.

    Departure of upper_lip_top.y from the line(left_mouth → right_mouth),
    divided by mouth width.  Higher = more arched (smile-like) lip.
    """

    metric_id = "smile_line_curvature"
    region    = "mouth"
    family    = "mouth"
    unit      = "index_0_1"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        lx, ly = lm.xy(P_LEFT_MOUTH)
        rx, ry = lm.xy(P_RIGHT_MOUTH)
        ux, uy = lm.xy(P_UPPER_LIP_TOP)
        # Vertical of corner-line chord at upper-lip x
        dx = float(rx) - float(lx)
        if abs(dx) < 1e-9:
            chord_y = (float(ly) + float(ry)) / 2.0
        else:
            t = (float(ux) - float(lx)) / dx
            chord_y = float(ly) + t * (float(ry) - float(ly))
        departure = abs(chord_y - float(uy))
        mouth_w = _hdist(lm, P_LEFT_MOUTH, P_RIGHT_MOUTH)
        v = departure / mouth_w if mouth_w > 1e-9 else 0.0
        cr = _conf_raw(v, _IDEAL_SMILE, _MAX_DEV_SMILE)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.03,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_SMILE, 0.03, "arched_lip", "flat_lip"),
            dependency_landmarks=_DEP_SMILE,
        )


# ---------------------------------------------------------------------------
# 18. chin_projection_proxy — lower-third proportion (subnasale → menton)
# ---------------------------------------------------------------------------

@register
class ChinProjectionProxyCalculator(MetricCalculator):
    """Lower facial third length / total face height.

    2D proxy for chin projection: in absence of lateral view, we use the
    relative length of the lower facial third (subnasale → menton) vs.
    total face height (forehead crown → menton). Farkas ideal ≈ 0.33.
    """

    metric_id = "chin_projection_proxy"
    region    = "jaw"
    family    = "jaw"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        sub_y    = float(lm.xy(P_SUBNASALE)[1])
        ment_y   = float(lm.xy(P_MENTON)[1])
        crown_y  = float(lm.xy(P_FOREHEAD_CROWN)[1])
        total_h  = abs(ment_y - crown_y)
        lower_h  = abs(ment_y - sub_y)
        v = lower_h / total_h if total_h > 1e-9 else _IDEAL_CHIN_PROJ
        cr = _conf_raw(v, _IDEAL_CHIN_PROJ, _MAX_DEV_CHIN_PROJ)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), JAW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.03,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_CHIN_PROJ, 0.03, "long_chin", "short_chin"),
            dependency_landmarks=_DEP_CHIN_PROJ,
        )


# ---------------------------------------------------------------------------
# 19. mandibular_corpus_length_ratio — mean(gonion→menton) / bizygomatic
# ---------------------------------------------------------------------------

@register
class MandibularCorpusLengthRatioCalculator(MetricCalculator):
    """Average gonion-to-menton chord / bizygomatic width.

    Approximates mandibular corpus length relative to upper-face width.
    Farkas hint: 0.20–0.30 in normocephalic adults.
    """

    metric_id = "mandibular_corpus_length_ratio"
    region    = "jaw"
    family    = "jaw"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        l_corpus = _dist(lm, P_LEFT_GONION, P_MENTON)
        r_corpus = _dist(lm, P_RIGHT_GONION, P_MENTON)
        mean_corpus = (l_corpus + r_corpus) / 2.0
        bizyg = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        v = mean_corpus / bizyg if bizyg > 1e-9 else _IDEAL_CORPUS
        cr = _conf_raw(v, _IDEAL_CORPUS, _MAX_DEV_CORPUS)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), JAW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_CORPUS, 0.04, "long_corpus", "short_corpus"),
            dependency_landmarks=_DEP_CORPUS,
        )


# ---------------------------------------------------------------------------
# 20. masseteric_prominence_proxy — masseter_distance / bizygomatic
# ---------------------------------------------------------------------------

@register
class MasstericProminenceProxyCalculator(MetricCalculator):
    """Distance between masseter anchors / bizygomatic width.

    A higher value indicates more prominent masseter musculature
    (relative widening of the lower-mid face).  Naini hint: ~0.50–0.60.
    """

    metric_id = "masseteric_prominence_proxy"
    region    = "jaw"
    family    = "jaw"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        mass_w = _hdist(lm, P_MASSETER_L, P_MASSETER_R)
        bizyg  = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        v = mass_w / bizyg if bizyg > 1e-9 else _IDEAL_MASSETER
        cr = _conf_raw(v, _IDEAL_MASSETER, _MAX_DEV_MASSETER)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), JAW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction_signed(v, _IDEAL_MASSETER, 0.05, "wide_masseter", "narrow_masseter"),
            dependency_landmarks=_DEP_MASSETER,
        )
