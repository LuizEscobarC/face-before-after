"""Vertical thirds metric family (PR-6).

Classical facial thirds divide the face into three equal vertical segments:

  Upper third:  trichion (P_FOREHEAD_CROWN=10 or BiSeNet virtual) → inner-brow midline
  Middle third: inner-brow midline → subnasale (P_SUBNASALE=2)
  Lower third:  subnasale → menton (P_MENTON=152)

Ideal canónico: 0.333 each.  Green ±0.02, Yellow ±0.05 (PLAN_METRICS §5.3).

BiSeNet integration (Phase 5 — 2026-05-12):
  When QualityContext.virtual_landmarks is set AND trichion_confidence ≥ 0.8,
  the upper-third boundary uses the BiSeNet-derived trichion_y_icu instead of
  lm[P_FOREHEAD_CROWN].  The middle and lower thirds are unaffected.
  confidence_final for upper-third metrics is multiplied by trichion_confidence
  to propagate the segmentation uncertainty downstream.

Geometry note (NormalizedLandmarks, basis=intercanthal):
  - Inner canthus midpoint = origin (y=0).
  - y increases **downward** (image convention preserved after normalization).
  - All y values are in intercanthal units (ICD = 1.0 ICU).

Sensitivity to pose: thirds are vertical distances → pitch (camera angle
above/below) causes foreshortening and is the dominant error axis.
Yaw has much less effect. Uses THIRDS_POSE_PARAMS accordingly.
"""

from __future__ import annotations

import numpy as np

from app.domain.landmarks_mesh import (
    P_BROW_LEFT_INNER,
    P_BROW_RIGHT_INNER,
    P_FOREHEAD_CROWN,
    P_MENTON,
    P_SUBNASALE,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.registry import register
from app.services.metrics.confidence_propagation import (
    LOW_CONF_THRESHOLD,
    THIRDS_POSE_PARAMS,
    propagate,
)

# ---------------------------------------------------------------------------
# Landmark dependency for all thirds metrics
# ---------------------------------------------------------------------------
_THIRDS_DEP_LM: tuple[int, ...] = (
    P_FOREHEAD_CROWN,
    P_BROW_LEFT_INNER,
    P_BROW_RIGHT_INNER,
    P_SUBNASALE,
    P_MENTON,
)

# Ideal canonical value (PLAN_METRICS §5.3)
_IDEAL: float = 1.0 / 3.0   # 0.3333…

# Reference deviation for confidence saturation (extreme = 0.5)
_MAX_DEVIATION: float = 0.5


# ---------------------------------------------------------------------------
# BiSeNet trichion helper
# ---------------------------------------------------------------------------

def _get_trichion_y(lm: NormalizedLandmarks, ctx: QualityContext) -> float:
    """Return the trichion y-coordinate in ICU.

    Priority:
      1. BiSeNet virtual trichion when confidence ≥ TRICHION_CONFIDENCE_THRESHOLD.
      2. Geometric fallback: lm[P_FOREHEAD_CROWN] (mesh point, same as before).
    """
    vl = getattr(ctx, "virtual_landmarks", None)
    if vl is not None:
        conf = float(vl.get("trichion_confidence", 0.0))
        if conf >= 0.8:  # TRICHION_CONFIDENCE_THRESHOLD from fusion_layer
            y_icu = vl.get("trichion_y_icu")
            if y_icu is not None:
                return float(y_icu)
    return float(lm.xy(P_FOREHEAD_CROWN)[1])


def _trichion_confidence_factor(ctx: QualityContext) -> float:
    """Return the trichion confidence multiplier for upper-third confidence.

    Returns 1.0 when using mesh fallback (no impact on existing confidence).
    Returns trichion_confidence when using BiSeNet (propagates uncertainty).
    """
    vl = getattr(ctx, "virtual_landmarks", None)
    if vl is not None and vl.get("trichion_source") == "bisenet":
        return float(vl.get("trichion_confidence", 1.0))
    return 1.0


# ---------------------------------------------------------------------------
# Pure math helpers
# ---------------------------------------------------------------------------

def _thirds_geometry(
    lm: NormalizedLandmarks,
    trichion_y_override: float | None = None,
) -> tuple[float, float, float, float]:
    """Return (upper, middle, lower, total_height) as ratio tuples.

    All values in intercanthal units.  Ratios sum to 1.0 when total > 0.

    Parameters
    ----------
    trichion_y_override : float | None
        When provided, replaces lm[P_FOREHEAD_CROWN] as the upper hairline
        boundary. Used when BiSeNet confidence ≥ 0.8.

    Returns (0.333, 0.333, 0.333, 0.0) when forehead and menton are
    co-located (degenerate face — guard against division by zero).
    """
    if trichion_y_override is not None:
        forehead_y = trichion_y_override
    else:
        forehead_y = float(lm.xy(P_FOREHEAD_CROWN)[1])

    brow_y     = float(
        (lm.xy(P_BROW_LEFT_INNER)[1] + lm.xy(P_BROW_RIGHT_INNER)[1]) / 2
    )
    sub_y    = float(lm.xy(P_SUBNASALE)[1])
    menton_y = float(lm.xy(P_MENTON)[1])

    total = menton_y - forehead_y
    if abs(total) < 1e-9:
        return _IDEAL, _IDEAL, _IDEAL, 0.0

    upper  = (brow_y - forehead_y)   / total
    middle = (sub_y  - brow_y)       / total
    lower  = (menton_y - sub_y)      / total
    return float(upper), float(middle), float(lower), float(total)


def _ratio_confidence(ratio: float) -> float:
    """confidence_raw for a single ratio metric."""
    return max(0.0, 1.0 - abs(ratio - _IDEAL) / _MAX_DEVIATION)


def _ratio_direction(ratio: float) -> str:
    """Semantic label relative to the ideal 0.333."""
    if abs(ratio - _IDEAL) < 0.01:
        return "neutral"
    return "long" if ratio > _IDEAL else "short"


# ---------------------------------------------------------------------------
# Metric calculators
# ---------------------------------------------------------------------------

@register
class UpperThirdRatioCalculator(MetricCalculator):
    """Ratio of upper face (forehead crown → inner-brow midline) to total height.

    Ideal: 0.333. 'long' = tall forehead; 'short' = low hairline/heavy brow.
    """

    metric_id = "upper_third_ratio"
    region = "symmetry"
    family = "thirds"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        trichion_y = _get_trichion_y(lm, ctx)
        upper, _, _, _ = _thirds_geometry(lm, trichion_y_override=trichion_y)
        conf_raw = _ratio_confidence(upper)
        conf_final = propagate(
            conf_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=THIRDS_POSE_PARAMS,
        )
        # Propagate BiSeNet segmentation uncertainty into confidence
        conf_final = conf_final * _trichion_confidence_factor(ctx)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=upper, error=0.01,
            confidence_raw=conf_raw, confidence_final=conf_final,
            is_low_confidence=conf_final < LOW_CONF_THRESHOLD,
            direction=_ratio_direction(upper),
            dependency_landmarks=_THIRDS_DEP_LM,
        )


@register
class MiddleThirdRatioCalculator(MetricCalculator):
    """Ratio of middle face (inner-brow midline → subnasale) to total height.

    Ideal: 0.333. 'long' = long nose/mid-face; 'short' = short mid-face.
    """

    metric_id = "middle_third_ratio"
    region = "symmetry"
    family = "thirds"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        trichion_y = _get_trichion_y(lm, ctx)
        _, middle, _, _ = _thirds_geometry(lm, trichion_y_override=trichion_y)
        conf_raw = _ratio_confidence(middle)
        conf_final = propagate(
            conf_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=THIRDS_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=middle, error=0.01,
            confidence_raw=conf_raw, confidence_final=conf_final,
            is_low_confidence=conf_final < LOW_CONF_THRESHOLD,
            direction=_ratio_direction(middle),
            dependency_landmarks=_THIRDS_DEP_LM,
        )


@register
class LowerThirdRatioCalculator(MetricCalculator):
    """Ratio of lower face (subnasale → menton) to total height.

    Ideal: 0.333. 'long' = long chin; 'short' = recessed chin.
    """

    metric_id = "lower_third_ratio"
    region = "symmetry"
    family = "thirds"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        trichion_y = _get_trichion_y(lm, ctx)
        _, _, lower, _ = _thirds_geometry(lm, trichion_y_override=trichion_y)
        conf_raw = _ratio_confidence(lower)
        conf_final = propagate(
            conf_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=THIRDS_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=lower, error=0.01,
            confidence_raw=conf_raw, confidence_final=conf_final,
            is_low_confidence=conf_final < LOW_CONF_THRESHOLD,
            direction=_ratio_direction(lower),
            dependency_landmarks=_THIRDS_DEP_LM,
        )


@register
class DominantThirdCalculator(MetricCalculator):
    """Dominant vertical third — the one furthest from the 0.333 ideal.

    value:     The ratio of the dominant third (e.g. 0.43 for upper).
    direction: 'upper' | 'middle' | 'lower' | 'balanced' (all within ±0.02).
    unit:      ratio.

    This metric is NEVER used in score aggregation because it is categorical.
    Use the three individual *_ratio metrics for scoring.
    """

    metric_id = "dominant_third"
    region = "symmetry"
    family = "thirds"
    unit = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        trichion_y = _get_trichion_y(lm, ctx)
        upper, middle, lower, _ = _thirds_geometry(lm, trichion_y_override=trichion_y)
        deviations = {
            "upper":  abs(upper  - _IDEAL),
            "middle": abs(middle - _IDEAL),
            "lower":  abs(lower  - _IDEAL),
        }
        dominant_name = max(deviations, key=deviations.__getitem__)
        dominant_value = {"upper": upper, "middle": middle, "lower": lower}[dominant_name]

        max_dev = deviations[dominant_name]
        direction = "balanced" if max_dev < 0.02 else dominant_name

        conf_raw = max(0.0, 1.0 - max_dev / _MAX_DEVIATION)
        conf_final = propagate(
            conf_raw, ctx.quality_score, self.region,
            ctx.regional_penalties,
            yaw_deg=ctx.get_yaw(), pitch_deg=ctx.get_pitch(),
            pose_params=THIRDS_POSE_PARAMS,
        )
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=dominant_value, error=0.01,
            confidence_raw=conf_raw, confidence_final=conf_final,
            is_low_confidence=conf_final < LOW_CONF_THRESHOLD,
            direction=direction,
            dependency_landmarks=_THIRDS_DEP_LM,
        )
