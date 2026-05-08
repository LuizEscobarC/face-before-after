"""Phi/golden-ratio metric family (PR-20, M2 eighth family).

Four **presentation-only** metrics that quantify how closely key facial
proportions approach the golden ratio φ = (1 + √5) / 2 ≈ 1.6180339887.

These metrics are DECORATIVE OVERLAYS (presentation_only=True, DEC-6).
They are registered so NestJS can display them in the phi/golden overlay
but they are NEVER included in regional_score or global_score calculations.
The NestJS ``RegionalScorer`` and ``GlobalScorer`` reject them by assertion.

Metrics
-------
phi_face_height_to_width
    Morphological face height / bizygomatic width vs φ.
    Reuses the same geometry as ``face_height_to_width_ratio`` but compared
    against the golden ratio reference (φ ≈ 1.618) instead of the canonical
    anthropometric ideal (1.35 per Farkas 1994).
    Landmarks: P_FOREHEAD_CROWN (10), P_MENTON (152),
               P_LEFT_ZYGOMATIC (338), P_RIGHT_ZYGOMATIC (378).
    Unit: ratio.

    Sources
    ~~~~~~~
    - Marquardt SR (2002). Beauty Analysis — Phi Mask methodology.
      URL: https://www.beautyanalysis.com
    - Livio M (2002). *The Golden Ratio: The Story of Phi, the World's Most
      Astonishing Number*. Broadway Books. ISBN 0-7679-0816-X.
    Caveat: φ ≈ 1.618 is NOT the anthropometric population mean for facial
    height-to-width (Farkas 1994 reports 1.30–1.40 for adults); this metric
    serves as an aesthetic historical reference overlay only.

phi_lower_face_segments
    (labiale inferius – subnasale) / (menton – labiale inferius) vs φ.
    Per Ricketts (1982) the ideally proportioned lower face divides at
    the lower lip in golden-ratio segments: the sublabial+lip segment
    should be ≈ φ × the chin segment.
    Landmarks: P_SUBNASALE (2), P_LOWER_LIP (14), P_MENTON (152).
    Unit: ratio.

    Sources
    ~~~~~~~
    - Ricketts RM (1982). "The biologic significance of the divine proportion
      and Fibonacci series." *Am J Orthod.* 81(5):351–370.
      DOI: 10.1016/0002-9416(82)90073-2
    - Marquardt SR (2002). Phi Mask — lower face vertical proportions.
      URL: https://www.beautyanalysis.com
    Caveat: Farkas (1994) reports sublabial:chin ≈ 1.2–1.5 in Western adults;
    φ (1.618) is an idealized aesthetic reference, not the statistical mean.
    Significant ethnic and age variation (Naini 2011, §2.5).

phi_eye_to_mouth
    (iris midpoint y → mouth commissure y) / (mouth commissure y → menton y) vs φ.
    The classic vertical phi application: the lower two-thirds of the face
    (iris line to chin) divides at the mouth line in golden ratio.
    Landmarks: P_LEFT_IRIS_CENTER (468), P_RIGHT_IRIS_CENTER (473),
               P_LEFT_MOUTH (61), P_RIGHT_MOUTH (291), P_MENTON (152).
    Unit: ratio.

    Sources
    ~~~~~~~
    - Marquardt SR (2002). Phi Mask — vertical segment ratios (phi grid).
      URL: https://www.beautyanalysis.com
    - Edler RJ (2001). "Background considerations to facial aesthetics."
      *J Orthod.* 28(2):159–168. DOI: 10.1093/ortho/28.2.159
    Caveat: No peer-reviewed population study confirms eye-to-mouth:mouth-to-
    chin = φ across ethnic groups; large variation documented in Naini (2011)
    §2.4 (range 1.2–1.9 across populations).

phi_nose_to_lip
    Horizontal: mouth commissure width / alar base width vs φ.
    In Marquardt's phi mask the mouth is ≈ φ times wider than the nose
    in the ideally proportioned face.
    Landmarks: P_LEFT_MOUTH (61), P_RIGHT_MOUTH (291),
               P_NOSE_LEFT (48), P_NOSE_RIGHT (45).
    Unit: ratio.

    Sources
    ~~~~~~~
    - Marquardt SR (2002). Phi Mask — horizontal facial proportions.
      URL: https://www.beautyanalysis.com
    - Livio M (2002). *The Golden Ratio*. Broadway Books. ISBN 0-7679-0816-X.
    - Edler RJ (2001). "Background considerations to facial aesthetics."
      *J Orthod.* 28(2):159–168. DOI: 10.1093/ortho/28.2.159
    Caveat: Farkas (1994) mouth:alar ratio ≈ 1.47 (not 1.618); Naini (2011)
    reports a range of 1.4–1.6. φ is the decorative upper reference.

Region: 'global'. Family: 'phi'. Uses PHI_POSE_PARAMS.
All metrics: presentation_only=True, requires_pixel_analysis=False.
"""

from __future__ import annotations

import math

from app.domain.landmarks_mesh import (
    P_FOREHEAD_CROWN,
    P_LEFT_IRIS_CENTER,
    P_LEFT_MOUTH,
    P_LEFT_ZYGOMATIC,
    P_LOWER_LIP,
    P_MENTON,
    P_NOSE_LEFT,
    P_NOSE_RIGHT,
    P_RIGHT_IRIS_CENTER,
    P_RIGHT_MOUTH,
    P_RIGHT_ZYGOMATIC,
    P_SUBNASALE,
)
from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.metrics.base import MetricCalculator, QualityContext
from app.services.metrics.confidence_propagation import (
    LOW_CONF_THRESHOLD,
    PHI_POSE_PARAMS,
    propagate,
)
from app.services.metrics.registry import register

# ---------------------------------------------------------------------------
# Golden ratio constant
# ---------------------------------------------------------------------------
_PHI: float = (1.0 + math.sqrt(5.0)) / 2.0  # 1.6180339887…

# Tolerance for 'phi_proportionate' direction: 5% deviation from φ.
_PHI_TOLERANCE: float = _PHI * 0.05          # ≈ 0.0809

# ---------------------------------------------------------------------------
# Dependency landmark tuples
# ---------------------------------------------------------------------------
_DEP_HEIGHT_WIDTH: tuple[int, ...] = (
    P_FOREHEAD_CROWN, P_MENTON, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
)
_DEP_LOWER_SEGMENTS: tuple[int, ...] = (
    P_SUBNASALE, P_LOWER_LIP, P_MENTON,
)
_DEP_EYE_MOUTH: tuple[int, ...] = (
    P_LEFT_IRIS_CENTER, P_RIGHT_IRIS_CENTER,
    P_LEFT_MOUTH, P_RIGHT_MOUTH, P_MENTON,
)
_DEP_NOSE_LIP: tuple[int, ...] = (
    P_LEFT_MOUTH, P_RIGHT_MOUTH, P_NOSE_LEFT, P_NOSE_RIGHT,
)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _phi_direction(value: float) -> str:
    """Map a ratio value to a direction label relative to φ."""
    if value > _PHI + _PHI_TOLERANCE:
        return "above_phi"
    if value < _PHI - _PHI_TOLERANCE:
        return "below_phi"
    return "phi_proportionate"


def _null_mv(metric_id: str, region: str, unit: str,
             dep: tuple[int, ...]) -> MetricValue:
    """Return a zero-confidence stub for degenerate geometry."""
    return MetricValue(
        metric_id=metric_id,
        region=region,
        family="phi",
        unit=unit,
        value=None,
        error=None,
        confidence_raw=0.0,
        confidence_final=0.0,
        is_low_confidence=True,
        direction="neutral",
        dependency_landmarks=list(dep),
        presentation_only=True,
    )


# ---------------------------------------------------------------------------
# 1. phi_face_height_to_width
# ---------------------------------------------------------------------------

@register
class PhiFaceHeightToWidthCalculator(MetricCalculator):
    """Face height / bizygomatic width vs φ (presentation_only).

    Reuses the same geometry as ``face_height_to_width_ratio`` from the
    global_shape family but evaluated against the golden-ratio reference
    (φ ≈ 1.618) rather than the population anthropometric ideal (1.35).

    Sources:
    - Marquardt SR (2002). Phi Mask. https://www.beautyanalysis.com
    - Livio M (2002). The Golden Ratio. Broadway Books. ISBN 0-7679-0816-X.
    """

    metric_id: str = "phi_face_height_to_width"
    region: str = "global"
    family: str = "phi"
    unit: str = "ratio"
    presentation_only: bool = True
    requires_pixel_analysis: bool = False

    def compute(
        self,
        lm: NormalizedLandmarks,
        quality: QualityContext,
    ) -> MetricValue:
        crown_y  = float(lm.xy(P_FOREHEAD_CROWN)[1])
        menton_y = float(lm.xy(P_MENTON)[1])
        zyg_l_x  = float(lm.xy(P_LEFT_ZYGOMATIC)[0])
        zyg_r_x  = float(lm.xy(P_RIGHT_ZYGOMATIC)[0])

        bizygomatic = abs(zyg_r_x - zyg_l_x)
        if bizygomatic < 1e-6:
            return _null_mv(
                self.metric_id, self.region, self.unit, _DEP_HEIGHT_WIDTH
            )

        face_height = menton_y - crown_y
        if face_height <= 0.0:
            return _null_mv(
                self.metric_id, self.region, self.unit, _DEP_HEIGHT_WIDTH
            )

        value = face_height / bizygomatic

        cr = 1.0  # presentation_only: no ideal deviation penalty
        cf = propagate(
            cr,
            quality.quality_score,
            self.region,
            quality.regional_penalties,
            quality.get_yaw(),
            quality.get_pitch(),
            PHI_POSE_PARAMS,
        )

        return MetricValue(
            metric_id=self.metric_id,
            region=self.region,
            family=self.family,
            unit=self.unit,
            value=value,
            error=None,
            confidence_raw=cr,
            confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_phi_direction(value),
            dependency_landmarks=list(_DEP_HEIGHT_WIDTH),
            presentation_only=True,
        )


# ---------------------------------------------------------------------------
# 2. phi_lower_face_segments
# ---------------------------------------------------------------------------

@register
class PhiLowerFaceSegmentsCalculator(MetricCalculator):
    """(Subnasale → labiale inferius) / (labiale inferius → menton) vs φ.

    Per Ricketts (1982) the ideally proportioned lower face divides at the
    lower vermilion border in golden-ratio segments.  This metric quantifies
    that division for the phi overlay.

    Sources:
    - Ricketts RM (1982). Am J Orthod 81(5):351–370.
      DOI: 10.1016/0002-9416(82)90073-2
    - Marquardt SR (2002). Phi Mask. https://www.beautyanalysis.com
    """

    metric_id: str = "phi_lower_face_segments"
    region: str = "global"
    family: str = "phi"
    unit: str = "ratio"
    presentation_only: bool = True
    requires_pixel_analysis: bool = False

    def compute(
        self,
        lm: NormalizedLandmarks,
        quality: QualityContext,
    ) -> MetricValue:
        subnasale_y = float(lm.xy(P_SUBNASALE)[1])
        lower_lip_y = float(lm.xy(P_LOWER_LIP)[1])
        menton_y    = float(lm.xy(P_MENTON)[1])

        # denominator: labiale inferius → menton
        denom = menton_y - lower_lip_y
        if abs(denom) < 1e-6:
            return _null_mv(
                self.metric_id, self.region, self.unit, _DEP_LOWER_SEGMENTS
            )

        # numerator: subnasale → labiale inferius
        numer = lower_lip_y - subnasale_y
        if numer <= 0.0:
            # subnasale below lower_lip is anatomically impossible — degenerate
            return _null_mv(
                self.metric_id, self.region, self.unit, _DEP_LOWER_SEGMENTS
            )

        value = numer / denom

        cr = 1.0  # presentation_only: no ideal deviation penalty
        cf = propagate(
            cr,
            quality.quality_score,
            self.region,
            quality.regional_penalties,
            quality.get_yaw(),
            quality.get_pitch(),
            PHI_POSE_PARAMS,
        )

        return MetricValue(
            metric_id=self.metric_id,
            region=self.region,
            family=self.family,
            unit=self.unit,
            value=value,
            error=None,
            confidence_raw=cr,
            confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_phi_direction(value),
            dependency_landmarks=list(_DEP_LOWER_SEGMENTS),
            presentation_only=True,
        )


# ---------------------------------------------------------------------------
# 3. phi_eye_to_mouth
# ---------------------------------------------------------------------------

@register
class PhiEyeToMouthCalculator(MetricCalculator):
    """(Iris midpoint → mouth commissure) / (mouth commissure → menton) vs φ.

    The iris midpoint y is averaged across both eyes; mouth commissure y is
    averaged across both corners.  In a phi-proportionate face this ratio
    equals φ ≈ 1.618.

    Sources:
    - Marquardt SR (2002). Phi Mask vertical grid. https://www.beautyanalysis.com
    - Edler RJ (2001). J Orthod 28(2):159–168. DOI: 10.1093/ortho/28.2.159
    """

    metric_id: str = "phi_eye_to_mouth"
    region: str = "global"
    family: str = "phi"
    unit: str = "ratio"
    presentation_only: bool = True
    requires_pixel_analysis: bool = False

    def compute(
        self,
        lm: NormalizedLandmarks,
        quality: QualityContext,
    ) -> MetricValue:
        iris_y   = (float(lm.xy(P_LEFT_IRIS_CENTER)[1])
                    + float(lm.xy(P_RIGHT_IRIS_CENTER)[1])) / 2.0
        mouth_y  = (float(lm.xy(P_LEFT_MOUTH)[1])
                    + float(lm.xy(P_RIGHT_MOUTH)[1])) / 2.0
        menton_y = float(lm.xy(P_MENTON)[1])

        # denominator: mouth → menton
        denom = menton_y - mouth_y
        if abs(denom) < 1e-6:
            return _null_mv(
                self.metric_id, self.region, self.unit, _DEP_EYE_MOUTH
            )

        # numerator: iris → mouth (must be positive: mouth is below iris)
        numer = mouth_y - iris_y
        if numer <= 0.0:
            return _null_mv(
                self.metric_id, self.region, self.unit, _DEP_EYE_MOUTH
            )

        value = numer / denom

        cr = 1.0  # presentation_only: no ideal deviation penalty
        cf = propagate(
            cr,
            quality.quality_score,
            self.region,
            quality.regional_penalties,
            quality.get_yaw(),
            quality.get_pitch(),
            PHI_POSE_PARAMS,
        )

        return MetricValue(
            metric_id=self.metric_id,
            region=self.region,
            family=self.family,
            unit=self.unit,
            value=value,
            error=None,
            confidence_raw=cr,
            confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_phi_direction(value),
            dependency_landmarks=list(_DEP_EYE_MOUTH),
            presentation_only=True,
        )


# ---------------------------------------------------------------------------
# 4. phi_nose_to_lip
# ---------------------------------------------------------------------------

@register
class PhiNoseToLipCalculator(MetricCalculator):
    """Mouth commissure width / alar base width vs φ.

    In Marquardt's phi mask, the mouth is ≈ φ times wider than the nose
    in the ideally proportioned face.  This horizontal ratio quantifies
    that relationship for the phi overlay.

    Sources:
    - Marquardt SR (2002). Phi Mask horizontal proportions.
      https://www.beautyanalysis.com
    - Livio M (2002). The Golden Ratio. Broadway Books. ISBN 0-7679-0816-X.
    - Edler RJ (2001). J Orthod 28(2):159–168. DOI: 10.1093/ortho/28.2.159
    """

    metric_id: str = "phi_nose_to_lip"
    region: str = "global"
    family: str = "phi"
    unit: str = "ratio"
    presentation_only: bool = True
    requires_pixel_analysis: bool = False

    def compute(
        self,
        lm: NormalizedLandmarks,
        quality: QualityContext,
    ) -> MetricValue:
        mouth_l_x = float(lm.xy(P_LEFT_MOUTH)[0])
        mouth_r_x = float(lm.xy(P_RIGHT_MOUTH)[0])
        nose_l_x  = float(lm.xy(P_NOSE_LEFT)[0])
        nose_r_x  = float(lm.xy(P_NOSE_RIGHT)[0])

        mouth_width = abs(mouth_r_x - mouth_l_x)
        nose_width  = abs(nose_r_x - nose_l_x)

        if nose_width < 1e-6:
            return _null_mv(
                self.metric_id, self.region, self.unit, _DEP_NOSE_LIP
            )

        value = mouth_width / nose_width

        cr = 1.0  # presentation_only: no ideal deviation penalty
        cf = propagate(
            cr,
            quality.quality_score,
            self.region,
            quality.regional_penalties,
            quality.get_yaw(),
            quality.get_pitch(),
            PHI_POSE_PARAMS,
        )

        return MetricValue(
            metric_id=self.metric_id,
            region=self.region,
            family=self.family,
            unit=self.unit,
            value=value,
            error=None,
            confidence_raw=cr,
            confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_phi_direction(value),
            dependency_landmarks=list(_DEP_NOSE_LIP),
            presentation_only=True,
        )
