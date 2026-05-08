"""Jaw / mandibular metric family (PR-13, M2 first family).

Six atomic jaw metrics:

  jaw_width_ratio
      Bigonial width / bizygomatic width (both in ICU).
      Ideal: 0.80 — narrower jaw than zygomatic arch is the canonical
      "tapered" lower-face proportion. Source: Farkas (1994), unified-sex
      adult population. Naini (2011) suggests 0.82 (negligible diff).
      Green ±0.05, yellow ±0.10. Direction: 'wide_jaw' / 'tapered_jaw'.

  gonial_angle_l / _r
      Approximate 2D gonial angle in degrees, measured at each gonion as
      the angle between segments (zygomatic → gonion) and (gonion → menton).
      Ideal: 125° (range 120-130°). Source: classical orthodontic literature
      (Tweed, Steiner). 2D approximation is noisier than cephalometric;
      gonion landmarks on Mesh-478 are approximate (P_LEFT/RIGHT_GONION
      flagged TODO in landmarks_mesh.py) — confidence floor accordingly.
      Green ±5°, yellow ±10°. Direction: 'sharp' / 'rounded'.

  gonial_angle_asymmetry
      Absolute difference between left and right gonial angles in degrees.
      Ideal: 0°. Green ±3°, yellow ±6°. Direction: 'left_dominant' /
      'right_dominant' / 'neutral' (which side has the larger angle).

  mandibular_plane_angle
      Angle of the line gonion-midpoint → menton vs the horizontal
      (intercanthal-aligned) axis, in degrees. Cephalometric proxy.
      Ideal: 27° (Steiner). Green ±5°, yellow ±10°. Direction: 'steep' /
      'flat'.

  chin_height_ratio
      (lower_lip_bot.y → menton.y) / (subnasale.y → menton.y).
      Proportion of the lower-third occupied by the chin. Ideal: 0.50
      (Farkas — lower third subdivided ~equally between upper-lip-to-stomion
      and stomion-to-menton). Green ±0.05, yellow ±0.10. Direction:
      'long_chin' / 'short_chin'.

Region: 'jaw'. Family: 'jaw'. Uses JAW_POSE_PARAMS (yaw-sensitive).
"""

from __future__ import annotations

import math

from app.domain.landmarks_mesh import (
    P_LEFT_GONION,
    P_LEFT_ZYGOMATIC,
    P_LOWER_LIP_BOT,
    P_MENTON,
    P_RIGHT_GONION,
    P_RIGHT_ZYGOMATIC,
    P_SUBNASALE,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.confidence_propagation import (
    JAW_POSE_PARAMS,
    LOW_CONF_THRESHOLD,
    propagate,
)
from app.services.metrics.registry import register

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_JAW_WIDTH: tuple[int, ...] = (
    P_LEFT_GONION, P_RIGHT_GONION, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
)
_DEP_GONIAL_L: tuple[int, ...] = (P_LEFT_ZYGOMATIC, P_LEFT_GONION, P_MENTON)
_DEP_GONIAL_R: tuple[int, ...] = (P_RIGHT_ZYGOMATIC, P_RIGHT_GONION, P_MENTON)
_DEP_GONIAL_ASYM: tuple[int, ...] = _DEP_GONIAL_L + _DEP_GONIAL_R
_DEP_MAND_PLANE: tuple[int, ...] = (P_LEFT_GONION, P_RIGHT_GONION, P_MENTON)
_DEP_CHIN_HEIGHT: tuple[int, ...] = (P_SUBNASALE, P_LOWER_LIP_BOT, P_MENTON)

# Ideal central values
_IDEAL_JAW_WIDTH      = 0.80     # bigonial / bizygomatic
_IDEAL_GONIAL_DEG     = 125.0    # degrees
_IDEAL_GONIAL_ASYM    = 0.0      # degrees
_IDEAL_MAND_PLANE_DEG = 27.0     # degrees
_IDEAL_CHIN_HEIGHT    = 0.50     # ratio

# Saturation thresholds for confidence_raw (deviation at which conf_raw → 0)
_MAX_DEV_JAW_WIDTH      = 0.30
_MAX_DEV_GONIAL_DEG     = 30.0
_MAX_DEV_GONIAL_ASYM    = 15.0
_MAX_DEV_MAND_PLANE_DEG = 25.0
_MAX_DEV_CHIN_HEIGHT    = 0.30


# ---------------------------------------------------------------------------
# Pure math helpers
# ---------------------------------------------------------------------------

def _hdist(lm: NormalizedLandmarks, a: int, b: int) -> float:
    """Horizontal distance |x_a - x_b| in normalized units."""
    return abs(float(lm.xy(a)[0]) - float(lm.xy(b)[0]))


def _angle_at_vertex_deg(
    lm: NormalizedLandmarks,
    arm1: int,
    vertex: int,
    arm2: int,
) -> float:
    """Interior angle (degrees) at `vertex`, between segments to `arm1` and `arm2`."""
    vx, vy = (float(c) for c in lm.xy(vertex))
    a1x, a1y = (float(c) for c in lm.xy(arm1))
    a2x, a2y = (float(c) for c in lm.xy(arm2))
    u = (a1x - vx, a1y - vy)
    v = (a2x - vx, a2y - vy)
    nu = math.hypot(*u)
    nv = math.hypot(*v)
    if nu < 1e-9 or nv < 1e-9:
        return _IDEAL_GONIAL_DEG  # degenerate → return ideal so deviation=0
    cos_t = (u[0] * v[0] + u[1] * v[1]) / (nu * nv)
    cos_t = max(-1.0, min(1.0, cos_t))
    return math.degrees(math.acos(cos_t))


def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)


def _jaw_width_direction(ratio: float) -> str:
    if abs(ratio - _IDEAL_JAW_WIDTH) < 0.05:
        return "neutral"
    return "wide_jaw" if ratio > _IDEAL_JAW_WIDTH else "tapered_jaw"


def _gonial_direction(angle_deg: float) -> str:
    if abs(angle_deg - _IDEAL_GONIAL_DEG) < 5.0:
        return "neutral"
    return "rounded" if angle_deg > _IDEAL_GONIAL_DEG else "sharp"


def _gonial_asym_direction(left_deg: float, right_deg: float) -> str:
    diff = left_deg - right_deg
    if abs(diff) < 3.0:
        return "neutral"
    return "left_dominant" if diff > 0 else "right_dominant"


def _mand_plane_direction(angle_deg: float) -> str:
    if abs(angle_deg - _IDEAL_MAND_PLANE_DEG) < 5.0:
        return "neutral"
    return "steep" if angle_deg > _IDEAL_MAND_PLANE_DEG else "flat"


def _chin_height_direction(ratio: float) -> str:
    if abs(ratio - _IDEAL_CHIN_HEIGHT) < 0.05:
        return "neutral"
    return "long_chin" if ratio > _IDEAL_CHIN_HEIGHT else "short_chin"


# ---------------------------------------------------------------------------
# Metric calculators
# ---------------------------------------------------------------------------

@register
class JawWidthRatioCalculator(MetricCalculator):
    """Bigonial width / bizygomatic width.

    Ideal: 0.80 (canonical tapered lower-face). 'wide_jaw' / 'tapered_jaw'.
    """

    metric_id = "jaw_width_ratio"
    region = "jaw"
    family = "jaw"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        bigonial = _hdist(lm, P_LEFT_GONION, P_RIGHT_GONION)
        bizygomatic = _hdist(lm, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC)
        v = bigonial / bizygomatic if bizygomatic > 1e-9 else _IDEAL_JAW_WIDTH
        cr = _conf_raw(v, _IDEAL_JAW_WIDTH, _MAX_DEV_JAW_WIDTH)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), JAW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.02,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_jaw_width_direction(v),
            dependency_landmarks=_DEP_JAW_WIDTH,
        )


@register
class GonialAngleLeftCalculator(MetricCalculator):
    """Approximate left gonial angle in degrees (zygomatic → gonion → menton).

    Ideal: 125°. 'sharp' when smaller, 'rounded' when larger.
    """

    metric_id = "gonial_angle_l"
    region = "jaw"
    family = "jaw"
    unit = "degrees"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _angle_at_vertex_deg(lm, arm1=P_LEFT_ZYGOMATIC, vertex=P_LEFT_GONION, arm2=P_MENTON)
        cr = _conf_raw(v, _IDEAL_GONIAL_DEG, _MAX_DEV_GONIAL_DEG)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), JAW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=2.0,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_gonial_direction(v),
            dependency_landmarks=_DEP_GONIAL_L,
        )


@register
class GonialAngleRightCalculator(MetricCalculator):
    """Approximate right gonial angle. Mirror of GonialAngleLeftCalculator."""

    metric_id = "gonial_angle_r"
    region = "jaw"
    family = "jaw"
    unit = "degrees"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v = _angle_at_vertex_deg(lm, arm1=P_RIGHT_ZYGOMATIC, vertex=P_RIGHT_GONION, arm2=P_MENTON)
        cr = _conf_raw(v, _IDEAL_GONIAL_DEG, _MAX_DEV_GONIAL_DEG)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), JAW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=2.0,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_gonial_direction(v),
            dependency_landmarks=_DEP_GONIAL_R,
        )


@register
class GonialAngleAsymmetryCalculator(MetricCalculator):
    """Absolute difference |gonial_l - gonial_r| in degrees.

    Ideal: 0°. Direction = which side has the larger angle.
    """

    metric_id = "gonial_angle_asymmetry"
    region = "jaw"
    family = "jaw"
    unit = "degrees"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        gl = _angle_at_vertex_deg(lm, P_LEFT_ZYGOMATIC, P_LEFT_GONION, P_MENTON)
        gr = _angle_at_vertex_deg(lm, P_RIGHT_ZYGOMATIC, P_RIGHT_GONION, P_MENTON)
        v = abs(gl - gr)
        cr = _conf_raw(v, _IDEAL_GONIAL_ASYM, _MAX_DEV_GONIAL_ASYM)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), JAW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=2.0,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_gonial_asym_direction(gl, gr),
            dependency_landmarks=_DEP_GONIAL_ASYM,
        )


@register
class MandibularPlaneAngleCalculator(MetricCalculator):
    """Angle of (gonion-midpoint → menton) line vs horizontal axis, in degrees.

    Ideal: 27° (Steiner). 'steep' when larger, 'flat' when smaller.
    """

    metric_id = "mandibular_plane_angle"
    region = "jaw"
    family = "jaw"
    unit = "degrees"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        lx, ly = (float(c) for c in lm.xy(P_LEFT_GONION))
        rx, ry = (float(c) for c in lm.xy(P_RIGHT_GONION))
        mx, my = (float(c) for c in lm.xy(P_MENTON))
        # Per-side angle vs horizontal, then averaged. Avoids the degenerate
        # 90° that gonion-midpoint→menton would yield for any symmetric face
        # (where mid_x == menton_x). Cephalometric mandibular plane is
        # canonically measured per side anyway.
        def _side_angle(gx: float, gy: float) -> float:
            dx = abs(mx - gx)
            dy = abs(my - gy)
            return math.degrees(math.atan2(dy, dx)) if dx > 1e-9 else 90.0
        v = (_side_angle(lx, ly) + _side_angle(rx, ry)) / 2.0
        cr = _conf_raw(v, _IDEAL_MAND_PLANE_DEG, _MAX_DEV_MAND_PLANE_DEG)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), JAW_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=2.0,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_mand_plane_direction(v),
            dependency_landmarks=_DEP_MAND_PLANE,
        )


@register
class ChinHeightRatioCalculator(MetricCalculator):
    """(lower_lip_bot.y → menton.y) / (subnasale.y → menton.y).

    Proportion of lower-third occupied by chin. Ideal: 0.50 (Farkas).
    'long_chin' when larger, 'short_chin' when smaller.
    """

    metric_id = "chin_height_ratio"
    region = "jaw"
    family = "jaw"
    unit = "ratio"

    _IV_SCALE = 0.8

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        sn_y = float(lm.xy(P_SUBNASALE)[1])
        ll_y = float(lm.xy(P_LOWER_LIP_BOT)[1])
        mn_y = float(lm.xy(P_MENTON)[1])
        lower_third = abs(mn_y - sn_y)
        chin_seg = abs(mn_y - ll_y)
        v = chin_seg / lower_third if lower_third > 1e-9 else _IDEAL_CHIN_HEIGHT
        cr = _conf_raw(v, _IDEAL_CHIN_HEIGHT, _MAX_DEV_CHIN_HEIGHT)
        cf = propagate(cr, ctx.quality_score, self.region, ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(), JAW_POSE_PARAMS)
        # improvement vector: menton moves up (dy<0) if long chin, down (dy>0) if short chin
        deviation = v - _IDEAL_CHIN_HEIGHT
        vec_y = float(max(-0.3, min(0.3, -deviation * self._IV_SCALE)))
        chin_improvement_vector = (0.0, vec_y)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.02,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_chin_height_direction(v),
            dependency_landmarks=_DEP_CHIN_HEIGHT,
            improvement_vector=chin_improvement_vector,
        )
