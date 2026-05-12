"""Forehead metric family (PR-18, M2 sixth family).

Four atomic forehead metrics — three measurable on a single frontal photo
using Mesh-478 landmarks, one deferred pending pixel analysis (DEC-10).

  forehead_height_ratio
      Absolute forehead height in Intercanthal Units (ICU).
      = avg(P_BROW_LEFT_INNER.y, P_BROW_RIGHT_INNER.y) − P_FOREHEAD_CROWN.y
      In normalized ICU coords y increases downward; crown has negative y
      (above eye line), so the subtraction always yields a positive height.
      Ideal: 1.90 ICU (Farkas 1994: trichion→glabella ≈ 60 mm / ICD 32 mm
             = 1.875; rounded to 1.90 as unified-sex canonical target).
      Green ±0.30, yellow ±0.60.  Direction: 'tall_forehead' / 'short_forehead'.

  forehead_width_ratio
      Biocular width / bizygomatic width — how open the upper face is at eye
      level relative to its maximum cheekbone span.
      Formula: |P_LEFT_EYE_OUTER.x − P_RIGHT_EYE_OUTER.x|
               / |P_LEFT_ZYGOMATIC.x − P_RIGHT_ZYGOMATIC.x|
      Ideal: 0.70 (Farkas 1994: outer-canthal breadth ≈ 90 mm / bizygomatic
             ≈ 128 mm = 0.703; Naini 2011 §4.3 corroborates the same range).
      Green ±0.07, yellow ±0.13.  Direction: 'wide_forehead' / 'narrow_forehead'.

  temporal_width_ratio
      Lateral brow arch span / bizygomatic width — outer brow endpoints
      (dlib-17/26 equivalents in Mesh-478) serve as the closest available
      proxy for the temporal crest (biofrontal landmark).
      Formula: |P_BROW_LEFT_OUTER.x − P_BROW_RIGHT_OUTER.x|
               / |P_LEFT_ZYGOMATIC.x − P_RIGHT_ZYGOMATIC.x|
      Farkas biofrontal/bizygomatic ≈ 0.86 (110 mm / 128 mm); outer brow
      endpoints lie slightly medial to the temporal crest, so the
      empirical ideal for this proxy is lower (0.75).
      Green ±0.07, yellow ±0.13.  Direction: 'wide_temporal' / 'narrow_temporal'.

  hairline_curvature_index  ← requires_pixel_analysis=True (DEC-10)
      Index describing the curvature of the frontal hairline contour.
      Requires pixel-level hair/skin segmentation unavailable from Mesh-478
      landmarks alone.  The calculator is REGISTERED so Nest can list it in
      GET /vision/capabilities and insert its metric_definition row, but the
      NestJS orchestrator SKIPS calling compute() per DEC-10 unless explicit
      pixel data is provided.  Returns a zero-confidence stub when invoked
      without pixel data to prevent silent downstream errors.

Region: 'forehead'. Family: 'forehead'. Uses FOREHEAD_POSE_PARAMS.
"""

from __future__ import annotations

from app.domain.landmarks_mesh import (
    P_BROW_LEFT_INNER,
    P_BROW_LEFT_OUTER,
    P_BROW_RIGHT_INNER,
    P_BROW_RIGHT_OUTER,
    P_FOREHEAD_CROWN,
    P_LEFT_EYE_OUTER,
    P_LEFT_ZYGOMATIC,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_ZYGOMATIC,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.confidence_propagation import (
    FOREHEAD_POSE_PARAMS,
    LOW_CONF_THRESHOLD,
    propagate,
)
from app.services.metrics.registry import register

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_HEIGHT:   tuple[int, ...] = (P_FOREHEAD_CROWN, P_BROW_LEFT_INNER, P_BROW_RIGHT_INNER)
_DEP_WIDTH:    tuple[int, ...] = (P_LEFT_EYE_OUTER, P_RIGHT_EYE_OUTER,
                                   P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
_DEP_TEMPORAL: tuple[int, ...] = (P_BROW_LEFT_OUTER, P_BROW_RIGHT_OUTER,
                                   P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
_DEP_CURVATURE: tuple[int, ...] = (P_FOREHEAD_CROWN, P_BROW_LEFT_OUTER, P_BROW_RIGHT_OUTER)

# ---------------------------------------------------------------------------
# Ideal central values & saturation thresholds
# ---------------------------------------------------------------------------
_IDEAL_HEIGHT   = 1.90   # ICU — Farkas 1994: trichion→glabella ≈ 60 mm / ICD 32 mm
_IDEAL_WIDTH    = 0.70   # ratio — Farkas outer-canthal / bizygomatic (90/128)
_IDEAL_TEMPORAL = 0.75   # ratio — outer brow proxy for temporal crest (96/128)
_IDEAL_CURVATURE = 0.48  # sagitta/chord — Farkas 1994: moderate forehead arch (proxy)

_MAX_DEV_HEIGHT   = 1.00   # [0.90, 2.90] before conf_raw → 0
_MAX_DEV_WIDTH    = 0.30   # [0.40, 1.00]
_MAX_DEV_TEMPORAL = 0.30   # [0.45, 1.05]
_MAX_DEV_CURVATURE = 0.35  # [0.13, 0.83] before conf_raw → 0


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)


def _hdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    """Horizontal distance |x_a − x_b| in normalized ICU."""
    return abs(float(lm.xy(a)[0]) - float(lm.xy(b)[0]))


def _height_direction(v: float) -> str:
    if abs(v - _IDEAL_HEIGHT) < 0.15:
        return "neutral"
    return "tall_forehead" if v > _IDEAL_HEIGHT else "short_forehead"


def _width_direction(v: float) -> str:
    if abs(v - _IDEAL_WIDTH) < 0.035:
        return "neutral"
    return "wide_forehead" if v > _IDEAL_WIDTH else "narrow_forehead"


def _temporal_direction(v: float) -> str:
    if abs(v - _IDEAL_TEMPORAL) < 0.035:
        return "neutral"
    return "wide_temporal" if v > _IDEAL_TEMPORAL else "narrow_temporal"


def _curvature_direction(v: float) -> str:
    if abs(v - _IDEAL_CURVATURE) < 0.08:
        return "neutral"
    return "prominent_arch" if v > _IDEAL_CURVATURE else "flat_arch"


def _hairline_curvature(lm: NormalizedLandmarks) -> float:
    """Sagitta-based curvature index of the brow-crown-brow arc.

    Computes the ratio of the arc sagitta (crown height above the outer-brow
    chord midpoint) to the outer-brow chord length. This is a landmark-based
    proxy for the overall roundness of the upper forehead boundary.

    In normalized ICU coords (y increases downward, crown has smaller y):
        chord_midpoint_y = avg(brow_l.y, brow_r.y)
        sagitta          = chord_midpoint_y − crown.y   (always > 0)
        chord_length     = |brow_r.x − brow_l.x|
        curvature_index  = sagitta / chord_length

    High value (> 0.58) → prominent / round hairline arch.
    Low value  (< 0.38) → flat or pointed forehead top.
    """
    crown_x  = float(lm.xy(P_FOREHEAD_CROWN)[0])  # noqa: F841 (kept for symmetry)
    crown_y  = float(lm.xy(P_FOREHEAD_CROWN)[1])
    brow_l_x = float(lm.xy(P_BROW_LEFT_OUTER)[0])
    brow_l_y = float(lm.xy(P_BROW_LEFT_OUTER)[1])
    brow_r_x = float(lm.xy(P_BROW_RIGHT_OUTER)[0])
    brow_r_y = float(lm.xy(P_BROW_RIGHT_OUTER)[1])
    chord_midpoint_y = (brow_l_y + brow_r_y) / 2.0
    sagitta          = chord_midpoint_y - crown_y   # positive: crown is above chord
    chord_length     = abs(brow_r_x - brow_l_x)
    if chord_length < 1e-9:
        return _IDEAL_CURVATURE  # degenerate
    return sagitta / chord_length


# ---------------------------------------------------------------------------
# Calculators
# ---------------------------------------------------------------------------

@register
class ForeheadHeightRatioCalculator(MetricCalculator):
    """Absolute forehead height in Intercanthal Units (ICU).

    Measures the vertical span from the forehead crown (trichion proxy,
    Mesh-478 point 10) to the inner-brow midpoint (glabella proxy).
    Unlike ``upper_third_ratio`` (a proportion of total face height),
    this metric is an absolute ICU measurement, making it independent of
    chin height and useful as a standalone forehead morphology descriptor.
    Ideal: 1.90 ICU. Green ±0.30, yellow ±0.60.
    """

    metric_id = "forehead_height_ratio"
    region    = "forehead"
    family    = "forehead"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        crown_y = float(lm.xy(P_FOREHEAD_CROWN)[1])
        brow_y  = (float(lm.xy(P_BROW_LEFT_INNER)[1]) +
                   float(lm.xy(P_BROW_RIGHT_INNER)[1])) / 2.0
        # In normalized ICU: y↓ → crown_y < brow_y → height is brow_y - crown_y.
        v  = brow_y - crown_y
        cr = _conf_raw(v, _IDEAL_HEIGHT, _MAX_DEV_HEIGHT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), FOREHEAD_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.08,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_height_direction(v),
            dependency_landmarks=_DEP_HEIGHT,
        )


@register
class ForeheadWidthRatioCalculator(MetricCalculator):
    """Biocular width / bizygomatic width.

    Measures how open the upper face is at eye level relative to the
    maximum cheekbone span.  A higher ratio indicates a wider
    upper-face relative to mid-face width (oval-to-inverted-triangle shape).
    Ideal: 0.70 (Farkas outer-canthal ≈ 90 mm / bizygomatic ≈ 128 mm = 0.703).
    Green ±0.07, yellow ±0.13.
    """

    metric_id = "forehead_width_ratio"
    region    = "forehead"
    family    = "forehead"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        biocular    = _hdist(lm, P_LEFT_EYE_OUTER, P_RIGHT_EYE_OUTER)
        bizygomatic = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        if bizygomatic <= 1e-9:
            return MetricValue(
                metric_id=self.metric_id, region=self.region, family=self.family,
                unit=self.unit, value=None, error=None,
                confidence_raw=0.0, confidence_final=0.0,
                is_low_confidence=True, direction="neutral",
                dependency_landmarks=list(_DEP_WIDTH),
            )
        v  = biocular / bizygomatic
        cr = _conf_raw(v, _IDEAL_WIDTH, _MAX_DEV_WIDTH)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), FOREHEAD_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_width_direction(v),
            dependency_landmarks=_DEP_WIDTH,
        )


@register
class TemporalWidthRatioCalculator(MetricCalculator):
    """Lateral brow arch span / bizygomatic width (temporal crest proxy).

    Outer brow arch endpoints (P_BROW_LEFT_OUTER = Mesh-478 idx 70 / dlib-17;
    P_BROW_RIGHT_OUTER = idx 300 / dlib-26) are the closest available
    Mesh-478 landmarks to the temporal crest (biofrontal measurement in
    Farkas), sitting slightly medial to the true temporal hairline.
    A higher ratio signals a wider upper face at temporal level relative
    to cheekbone width — associated with an oval/heart face shape.
    Ideal: 0.75. Green ±0.07, yellow ±0.13.
    """

    metric_id = "temporal_width_ratio"
    region    = "forehead"
    family    = "forehead"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        outer_brow  = _hdist(lm, P_BROW_LEFT_OUTER, P_BROW_RIGHT_OUTER)
        bizygomatic = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        if bizygomatic <= 1e-9:
            return MetricValue(
                metric_id=self.metric_id, region=self.region, family=self.family,
                unit=self.unit, value=None, error=None,
                confidence_raw=0.0, confidence_final=0.0,
                is_low_confidence=True, direction="neutral",
                dependency_landmarks=list(_DEP_TEMPORAL),
            )
        v  = outer_brow / bizygomatic
        cr = _conf_raw(v, _IDEAL_TEMPORAL, _MAX_DEV_TEMPORAL)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), FOREHEAD_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.04,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_temporal_direction(v),
            dependency_landmarks=_DEP_TEMPORAL,
        )


@register
class HairlineCurvatureIndexCalculator(MetricCalculator):
    """Curvature index of the forehead crown arc (PR-C1 landmark-based proxy).

    Measures the sagitta-to-chord ratio of the arc formed by
    P_BROW_LEFT_OUTER → P_FOREHEAD_CROWN → P_BROW_RIGHT_OUTER.

    This is a landmark-based proxy for the general roundness of the upper
    forehead boundary.  It replaces the pixel-level hair/skin segmentation
    approach (DEC-10 stub) with a computable Mesh-478 measurement.

    Formula: sagitta / chord_length
        sagitta      = avg(brow_outer_L.y, brow_outer_R.y) - crown.y
        chord_length = |brow_outer_R.x - brow_outer_L.x|

    Ideal: 0.48 (moderate arch; Farkas 1994-aligned oval forehead proxy).
    Green ±0.10 → [0.38, 0.58].  Yellow ±0.20 → [0.28, 0.68].
    Direction: 'prominent_arch' (> 0.56) / 'flat_arch' (< 0.40) / 'neutral'.

    References: Farkas (1994), Naini (2011) §4.
    """

    metric_id = "hairline_curvature_index"
    region    = "forehead"
    family    = "forehead"
    unit      = "index_0_1"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = _hairline_curvature(lm)
        cr = _conf_raw(v, _IDEAL_CURVATURE, _MAX_DEV_CURVATURE)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), FOREHEAD_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.03,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_curvature_direction(v),
            dependency_landmarks=_DEP_CURVATURE,
        )
