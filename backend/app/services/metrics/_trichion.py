"""Central trichion helper — single source of truth for all metric calculators.

Centralises the BiSeNet trichion override logic that was previously duplicated
in thirds.py (local _get_trichion_y / _trichion_confidence_factor).  All
calculators that need a hairline y-reference now import from here.

Rationale:
  BiSeNet provides the anatomical trichion (the dermatological hairline, as
  used by Farkas 1994 and Martin–Saller in their anthropometric studies),
  whereas MediaPipe Mesh-478 point 10 (P_FOREHEAD_CROWN) is the topmost mesh
  vertex — typically 5–15 mm higher than the clinical trichion for subjects
  with visible foreheads.  Replacing lm[10] with the BiSeNet trichion corrects
  systematic forehead-height overestimation without recalibrating the ideal
  constants (which were always defined against the anatomical trichion).

  Note on x-coordinate: BiSeNet produces a horizontal hairline band —
  trichion_y_icu only.  The x-coordinate always stays from
  lm[P_FOREHEAD_CROWN] (mesh point 10) because the midline x of the mesh crown
  is a reliable proxy for the hairline midpoint in near-frontal captures.
"""

from __future__ import annotations

from app.domain.landmarks_mesh import P_FOREHEAD_CROWN
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import QualityContext

# ---------------------------------------------------------------------------
# Threshold — must stay in sync with:
#   app.services.landmarks.fusion_layer.TRICHION_CONFIDENCE_THRESHOLD
# DO NOT change this value independently.
# ---------------------------------------------------------------------------
TRICHION_CONFIDENCE_THRESHOLD: float = 0.8


def effective_trichion_y(lm: NormalizedLandmarks, ctx: QualityContext) -> float:
    """Return the effective trichion y-coordinate in ICU.

    Priority:
      1. BiSeNet virtual trichion when ctx.virtual_landmarks is present and
         trichion_confidence >= TRICHION_CONFIDENCE_THRESHOLD.
      2. Geometric fallback: lm[P_FOREHEAD_CROWN] (mesh point 10).

    The x-coordinate is always taken from lm[P_FOREHEAD_CROWN] because
    BiSeNet produces only a y-estimate (horizontal hairline band); the mesh x
    is a reliable midline proxy for near-frontal captures.
    """
    vl = getattr(ctx, "virtual_landmarks", None)
    if vl is not None:
        conf = float(vl.get("trichion_confidence", 0.0))
        if conf >= TRICHION_CONFIDENCE_THRESHOLD:
            y_icu = vl.get("trichion_y_icu")
            if y_icu is not None:
                return float(y_icu)
    return float(lm.xy(P_FOREHEAD_CROWN)[1])


def trichion_confidence_multiplier(ctx: QualityContext) -> float:
    """Return the trichion confidence multiplier for affected-metric confidence.

    Returns 1.0 when using mesh fallback (no impact on existing confidence).
    Returns trichion_confidence (∈ [TRICHION_CONFIDENCE_THRESHOLD, 1.0]) when
    the BiSeNet active path is used, propagating segmentation uncertainty
    downstream — exactly as thirds.py does for upper_third_ratio.
    """
    vl = getattr(ctx, "virtual_landmarks", None)
    if vl is not None and vl.get("trichion_source") == "bisenet":
        conf = float(vl.get("trichion_confidence", 0.0))
        if conf >= TRICHION_CONFIDENCE_THRESHOLD:
            return conf
    return 1.0
