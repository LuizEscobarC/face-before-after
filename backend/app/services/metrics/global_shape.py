"""Global face-shape metric family (PR-19, M2 seventh family).

Four atomic global-shape metrics — two scored from frontal landmarks,
one categorical presentation-only label, one deferred pending depth data (DEC-10).

  face_height_to_width_ratio
      Total morphological face height / bizygomatic breadth.
      = (P_MENTON.y − P_FOREHEAD_CROWN.y) / |P_LEFT_ZYGOMATIC.x − P_RIGHT_ZYGOMATIC.x|
      (all in normalised ICU; y increases downward).
      Ideal: 1.35 (Farkas 1994: facial height ≈171 mm / bizygomatic ≈130 mm ≈1.315;
             Naini 2011 §2.5: aesthetic range 1.30–1.40, midpoint 1.35).
      Green ±0.10 → [1.25, 1.45]; yellow ±0.20 → [1.15, 1.55].
      Direction: 'oblong_face' (>1.45), 'round_face' (<1.25), 'neutral' (green).

  face_shape_classification   ← presentation_only=True (DEC-6)
      Categorical face-shape label combining the vertical aspect ratio with the
      jaw-taper ratio (bigonial / bizygomatic) to classify oval / round / oblong
      / square / heart.  The computed value is the same aspect ratio as
      face_height_to_width_ratio — it is NOT scored (presentation_only keeps it
      out of regional aggregation per DEC-6) but the direction label
      ("oval", "heart", …) is surfaced in the analysis output for UX.
      Uses P_LEFT_GONION / P_RIGHT_GONION for jaw-taper detection.
      Ideal: 1.35 (oval centre), for display reference only.

  total_facial_convexity
      Frontal boundary convexity index: area of the 8-point face outline polygon
      divided by the area of its convex hull, using scipy.spatial.ConvexHull.
      Boundary polygon (counterclockwise from crown):
        [P_FOREHEAD_CROWN, P_BROW_LEFT_OUTER, P_LEFT_ZYGOMATIC, P_LEFT_GONION,
         P_MENTON, P_RIGHT_GONION, P_RIGHT_ZYGOMATIC, P_BROW_RIGHT_OUTER]
      When the bizygomatic span is the widest part of the face (normal cheekbone
      development), all boundary points lie on the convex hull → ratio = 1.0.
      Values < 1.0 indicate temporal hollowing (upper-face wider than midface).
      Ideal: 0.98 (near-perfect frontal convexity).
      Green [0.94, 1.00]; yellow [0.87, 1.00].
      Direction: 'full_midface' (≥0.97), 'temporal_hollow' (<0.97), 'neutral'.

  e_line_deviation            ← requires_pixel_analysis=True (DEC-10)
      Ricketts (1954) esthetic E-line: deviation of upper/lower lips from the
      line connecting nose tip and chin tip, measured on a lateral (profile)
      view.  A frontal 2D photograph cannot provide the sagittal projection
      necessary for this measurement — the z-axis lip protrusion is invisible.
      The calculator is REGISTERED so Nest can list it in GET /vision/capabilities
      and insert its metric_definition row, but the NestJS orchestrator SKIPS
      calling compute() per DEC-10.  Returns a zero-confidence stub if invoked.

Region: 'global'. Family: 'global_shape'. Uses GLOBAL_SHAPE_POSE_PARAMS.
"""

from __future__ import annotations

import numpy as np
from scipy.spatial import ConvexHull

from app.domain.landmarks_mesh import (
    P_BROW_LEFT_OUTER,
    P_BROW_RIGHT_OUTER,
    P_FOREHEAD_CROWN,
    P_LEFT_GONION,
    P_LEFT_ZYGOMATIC,
    P_MENTON,
    P_NOSE_TIP,
    P_RIGHT_GONION,
    P_RIGHT_ZYGOMATIC,
    P_UPPER_LIP_TOP,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.confidence_propagation import (
    GLOBAL_SHAPE_POSE_PARAMS,
    LOW_CONF_THRESHOLD,
    propagate,
)
from app.services.metrics.registry import register

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_ASPECT: tuple[int, ...] = (
    P_FOREHEAD_CROWN, P_MENTON, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
)
_DEP_SHAPE: tuple[int, ...] = (
    P_FOREHEAD_CROWN, P_MENTON,
    P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
    P_LEFT_GONION, P_RIGHT_GONION,
)
_DEP_CONVEXITY: tuple[int, ...] = (
    P_FOREHEAD_CROWN, P_BROW_LEFT_OUTER, P_LEFT_ZYGOMATIC, P_LEFT_GONION,
    P_MENTON, P_RIGHT_GONION, P_RIGHT_ZYGOMATIC, P_BROW_RIGHT_OUTER,
)
_DEP_E_LINE: tuple[int, ...] = (P_NOSE_TIP, P_MENTON, P_UPPER_LIP_TOP)

# ---------------------------------------------------------------------------
# Ideal central values & saturation thresholds
# ---------------------------------------------------------------------------
_IDEAL_ASPECT     = 1.35   # Farkas 1994 / Naini 2011 — oval face archetype
_IDEAL_CONVEXITY  = 0.98   # near-perfectly convex frontal boundary
_IDEAL_E_LINE_DEV = 0.0    # upper lip on the nose-chin axis (2D proxy ideal)

_MAX_DEV_ASPECT     = 0.50  # aspect in [0.85, 1.85] before conf_raw → 0
_MAX_DEV_CONVEXITY  = 0.20  # convexity in [0.78, 1.00] before conf_raw → 0
_MAX_DEV_E_LINE_DEV = 0.08  # deviation ∈ [0, 0.08] before conf_raw → 0


# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------

def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)


def _hdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    """Horizontal distance |x_a − x_b| in normalised ICU."""
    return abs(float(lm.xy(a)[0]) - float(lm.xy(b)[0]))


def _vdist(lm: NormalizedLandmarks, top: int, bot: int) -> float:
    """Vertical distance y_bot − y_top in normalised ICU (positive if bot is below)."""
    return float(lm.xy(bot)[1]) - float(lm.xy(top)[1])


def _aspect_direction(v: float) -> str:
    if v > 1.45:
        return "oblong_face"
    if v < 1.25:
        return "round_face"
    return "neutral"


def _classify_shape(aspect: float, taper: float) -> str:
    """Classify face shape from aspect ratio and jaw-taper ratio.

    aspect   = face_height / bizygomatic_width
    taper    = bigonial / bizygomatic
    Returns one of: 'oval', 'round', 'oblong', 'square', 'heart'.

    Threshold sources:
        Farkas (1994): oval range 1.25–1.45, bigonial/bizygomatic ≈ 0.82 ± 0.08.
        Naini (2011) §2.5: round < 1.15, oblong > 1.55.
        Square: jaw ≥ 88 % of cheekbone width.
        Heart: jaw ≤ 74 % of cheekbone width (pointed-chin inverted-triangle).
    """
    if aspect < 1.10:
        return "round"
    if aspect > 1.55:
        return "oblong"
    # aspect in [1.10, 1.55] → distinguish oval / square / heart
    if taper > 0.88:
        return "square"
    if taper < 0.74:
        return "heart"
    return "oval"


def _convexity_direction(v: float) -> str:
    if v >= 0.97:
        return "full_midface"
    return "temporal_hollow"


def _e_line_deviation_2d(lm: NormalizedLandmarks) -> tuple[float, str]:
    """2D proxy for Ricketts E-line deviation (PR-C1, frontal photo).

    In a frontal photograph we cannot measure the true sagittal E-line, so we
    compute the lateral deviation of the upper-lip vermilion border from the
    nose-tip → menton vertical axis.

    For a well-aligned face, P_NOSE_TIP, P_UPPER_LIP_TOP, and P_MENTON all
    lie near the face midline (x ≈ 0). Any lateral offset of the upper lip
    from the nose-to-chin axis is a clinically relevant asymmetry indicator.

    Formula:
        axis_x_at_lip_y = tip_x + t · (menton_x − tip_x)
                where t = (lip_y − tip_y) / (menton_y − tip_y)
        deviation = |lip_x − axis_x_at_lip_y|
        direction = 'left_deviation'  if lip_x < axis_x_at_lip_y
                    'right_deviation' if lip_x > axis_x_at_lip_y
                    'neutral'         if deviation < 0.015 ICU

    Returns (absolute_deviation, direction_str).
    """
    tip_x,  tip_y  = float(lm.xy(P_NOSE_TIP)[0]),      float(lm.xy(P_NOSE_TIP)[1])
    men_x,  men_y  = float(lm.xy(P_MENTON)[0]),         float(lm.xy(P_MENTON)[1])
    lip_x,  lip_y  = float(lm.xy(P_UPPER_LIP_TOP)[0]),  float(lm.xy(P_UPPER_LIP_TOP)[1])

    dy_total = men_y - tip_y
    if abs(dy_total) < 1e-9:
        return 0.0, "neutral"

    t = (lip_y - tip_y) / dy_total
    axis_x = tip_x + t * (men_x - tip_x)
    raw_dev = lip_x - axis_x   # signed; positive = lip is to the right of axis

    abs_dev = abs(raw_dev)
    if abs_dev < 0.015:
        direction = "neutral"
    elif raw_dev < 0:
        direction = "left_deviation"
    else:
        direction = "right_deviation"
    return abs_dev, direction


def _polygon_convexity(lm: NormalizedLandmarks) -> float:
    """Compute frontal boundary convexity for the 8-point face outline.

    Boundary polygon (counterclockwise from crown):
      [crown, brow_L_outer, zyg_L, gonion_L, menton, gonion_R, zyg_R, brow_R_outer]

    Returns polygon_area / convex_hull_area ∈ (0, 1].
    Returns 0.0 on degenerate input.
    """
    pts = np.array([
        [float(lm.xy(P_FOREHEAD_CROWN)[0]),   float(lm.xy(P_FOREHEAD_CROWN)[1])],
        [float(lm.xy(P_BROW_LEFT_OUTER)[0]),  float(lm.xy(P_BROW_LEFT_OUTER)[1])],
        [float(lm.xy(P_LEFT_ZYGOMATIC)[0]),   float(lm.xy(P_LEFT_ZYGOMATIC)[1])],
        [float(lm.xy(P_LEFT_GONION)[0]),      float(lm.xy(P_LEFT_GONION)[1])],
        [float(lm.xy(P_MENTON)[0]),           float(lm.xy(P_MENTON)[1])],
        [float(lm.xy(P_RIGHT_GONION)[0]),     float(lm.xy(P_RIGHT_GONION)[1])],
        [float(lm.xy(P_RIGHT_ZYGOMATIC)[0]),  float(lm.xy(P_RIGHT_ZYGOMATIC)[1])],
        [float(lm.xy(P_BROW_RIGHT_OUTER)[0]), float(lm.xy(P_BROW_RIGHT_OUTER)[1])],
    ])

    # Convex hull area via scipy
    try:
        hull = ConvexHull(pts)
        hull_area = float(hull.volume)  # .volume returns area in 2-D
    except Exception:
        return 0.0

    if hull_area < 1e-9:
        return 0.0

    # Polygon area via Shoelace formula (order matters; pts is in polygon order)
    n = len(pts)
    area = 0.0
    for i in range(n):
        j = (i + 1) % n
        area += pts[i, 0] * pts[j, 1] - pts[j, 0] * pts[i, 1]
    polygon_area = abs(area) * 0.5

    return min(1.0, polygon_area / hull_area)


# ---------------------------------------------------------------------------
# Calculators
# ---------------------------------------------------------------------------

@register
class FaceHeightToWidthRatioCalculator(MetricCalculator):
    """Total morphological face height / bizygomatic breadth.

    Measures the vertical aspect ratio of the entire face from hairline
    (crown proxy = Mesh-478 pt 10) to chin bottom (menton = pt 152),
    normalised by the maximum bizygomatic span.

    Oval face archetype: 1.35.  Green ±0.10, yellow ±0.20.
    Sensitive to pitch (head tilt shortens/lengthens apparent face height)
    and moderately to yaw (bizygomatic foreshortens with lateral rotation).
    """

    metric_id = "face_height_to_width_ratio"
    region    = "global"
    family    = "global_shape"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        face_height   = _vdist(lm, P_FOREHEAD_CROWN, P_MENTON)
        bizygomatic   = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        if bizygomatic <= 1e-9:
            return MetricValue(
                metric_id=self.metric_id, region=self.region, family=self.family,
                unit=self.unit, value=None, error=None,
                confidence_raw=0.0, confidence_final=0.0,
                is_low_confidence=True, direction="neutral",
                dependency_landmarks=list(_DEP_ASPECT),
            )
        v  = face_height / bizygomatic
        cr = _conf_raw(v, _IDEAL_ASPECT, _MAX_DEV_ASPECT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), GLOBAL_SHAPE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_aspect_direction(v),
            dependency_landmarks=_DEP_ASPECT,
        )


@register
class FaceShapeClassificationCalculator(MetricCalculator):
    """Categorical face-shape label combining aspect ratio and jaw taper.

    This metric computes the same vertical aspect ratio as
    FaceHeightToWidthRatioCalculator, enriched with the jaw-taper ratio
    (bigonial / bizygomatic) from P_LEFT_GONION / P_RIGHT_GONION to classify
    face shape as: oval, round, oblong, square, or heart.

    The classification is encoded in the ``direction`` field.
    The numeric ``value`` is the aspect ratio (same formula as above).

    ``presentation_only = True`` (DEC-6): this metric MUST NOT enter any score
    aggregate; it is surfaced only in the analysis output as a UX shape label.
    An ideal row is included for display reference (ideal = 1.35, oval centre).

    Shape thresholds (Farkas 1994, Naini 2011):
        round   — aspect < 1.10 (wide, short face)
        oblong  — aspect > 1.55 (tall, narrow face)
        square  — taper > 0.88 (jaw nearly as wide as cheekbones)
        heart   — taper < 0.74 (narrow jaw / pointed-chin inverted triangle)
        oval    — everything else (the aesthetic archetype)
    """

    metric_id        = "face_shape_classification"
    region           = "global"
    family           = "global_shape"
    unit             = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        face_height  = _vdist(lm, P_FOREHEAD_CROWN, P_MENTON)
        bizygomatic  = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        bigonial     = _hdist(lm, P_LEFT_GONION, P_RIGHT_GONION)
        aspect       = face_height / bizygomatic if bizygomatic > 1e-9 else 0.0
        taper        = bigonial / bizygomatic if bizygomatic > 1e-9 else 0.0
        shape        = _classify_shape(aspect, taper)
        cr = _conf_raw(aspect, _IDEAL_ASPECT, _MAX_DEV_ASPECT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), GLOBAL_SHAPE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=aspect, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=shape,
            dependency_landmarks=_DEP_SHAPE,
        )


@register
class TotalFacialConvexityCalculator(MetricCalculator):
    """Frontal boundary convexity index (polygon area / convex-hull area).

    Uses an 8-point face boundary polygon:
      [crown, brow_L_outer, zyg_L, gonion_L, menton, gonion_R, zyg_R, brow_R_outer]

    When the bizygomatic span is the widest part of the face (cheekbones
    project laterally beyond the brow and jaw), all 8 boundary points lie on
    the convex hull → convexity = 1.0.

    When the temporal region hollows (brow wider than zygomatic), the midface
    dips inside the convex hull → convexity < 1.0.

    This metric captures temporal hollowing / midface fullness from a frontal
    photograph.  Note: classical "facial convexity" (Ricketts profile angle)
    requires a lateral view — that is deferred to e_line_deviation.

    Ideal: 0.98. Green [0.94, 1.00]. Yellow [0.87, 1.00].
    """

    metric_id = "total_facial_convexity"
    region    = "global"
    family    = "global_shape"
    unit      = "index_0_1"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = _polygon_convexity(lm)
        cr = _conf_raw(v, _IDEAL_CONVEXITY, _MAX_DEV_CONVEXITY)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), GLOBAL_SHAPE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.02,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_convexity_direction(v),
            dependency_landmarks=_DEP_CONVEXITY,
        )


@register
class ELineDeviationCalculator(MetricCalculator):
    """Ricketts E-line deviation — 2D frontal proxy (PR-C1).

    The classical Ricketts (1954) esthetic line requires a lateral profile
    photograph (sagittal plane).  This calculator provides a computable 2D
    frontal proxy: the lateral deviation of the upper-lip vermilion border
    (P_UPPER_LIP_TOP) from the nose-tip → menton vertical axis.

    For a well-aligned, profile-symmetric face this deviation is near zero.
    Non-zero values indicate lateral lip asymmetry or chin deviation relative
    to the nose tip — both clinically relevant in frontal evaluations.

    Formula (see _e_line_deviation_2d for full derivation):
        axis_x_at_lip_y = interpolated x of the nose-to-chin line at lip_y
        value = |lip_x − axis_x_at_lip_y| (always ≥ 0, in ICU)

    Ideal: 0.0 ICU. Green [0, 0.025]. Yellow [0, 0.05].
    Direction: 'left_deviation' / 'right_deviation' / 'neutral'.

    References: Ricketts (1954); Naini (2011) §7.4; Farkas (1994).
    Note: true sagittal E-line measurement is deferred to a multi-photo PR.
    """

    metric_id = "e_line_deviation"
    region    = "global"
    family    = "global_shape"
    unit      = "intercanthal_units"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v, direction = _e_line_deviation_2d(lm)
        cr = _conf_raw(v, _IDEAL_E_LINE_DEV, _MAX_DEV_E_LINE_DEV)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), GLOBAL_SHAPE_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.01,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=direction,
            dependency_landmarks=_DEP_E_LINE,
        )
