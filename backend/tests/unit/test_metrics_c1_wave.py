"""Tests for PR-C1 Wave 1 new metric calculators (10 metrics).

Covers registration, MetricValue contract, unit, direction, and basic
numeric behaviour for all 10 C1 metrics:

  brows region:
    - brow_tail_drop_r

  forehead region:
    - hairline_curvature_index   (promoted from pixel-dep stub)

  global region:
    - face_shape_classification  (promoted from presentation_only)
    - e_line_deviation           (promoted from pixel-dep stub)

  eyes region:
    - scleral_show_lower_l
    - scleral_show_lower_r
    - palpebral_fissure_inclination
    - supratarsal_fold_visibility  (pixel-dep stub — DEC-10)

  nose region:
    - nasal_dorsum_straightness
    - columella_show

All landmark-based metrics are tested against ``perfect_frontal()`` which
uses canonical symmetric geometry (ICD = 100 px).  Expected values are
derived from the geometry constants in synthetic_landmarks.py.
"""

from __future__ import annotations

import pytest

import app.services.metrics  # noqa: F401  — trigger @register side effects
from app.domain.landmarks_mesh import (
    P_LEFT_EYE_BOT,
    P_LEFT_IRIS_BOT,
    P_NOSE_LEFT,
    P_NOSE_RIGHT,
    P_RIGHT_EYE_BOT,
    P_RIGHT_IRIS_BOT,
    P_SUBNASALE,
)
from app.domain.metric_value import MetricValue
from app.services.metrics.base import QualityContext
from app.services.metrics.confidence_propagation import LOW_CONF_THRESHOLD
from app.services.metrics.registry import get, list_metric_ids
from app.services.normalization import normalize
from tests.fixtures.synthetic_landmarks import perfect_frontal

# ---------------------------------------------------------------------------
# All 10 C1 metric IDs
# ---------------------------------------------------------------------------
_C1_IDS = [
    "brow_tail_drop_r",
    "hairline_curvature_index",
    "face_shape_classification",
    "e_line_deviation",
    "scleral_show_lower_l",
    "scleral_show_lower_r",
    "palpebral_fissure_inclination",
    "supratarsal_fold_visibility",
    "nasal_dorsum_straightness",
    "columella_show",
]

# Landmark-based (not pixel-dep stubs)
_LANDMARK_IDS = [mid for mid in _C1_IDS if mid != "supratarsal_fold_visibility"]

# Pixel-dep stubs (requires_pixel_analysis=True)
_STUB_IDS = ["supratarsal_fold_visibility"]

# Expected units per metric_id
_EXPECTED_UNITS = {
    "brow_tail_drop_r":              "ICU",
    "hairline_curvature_index":      "index_0_1",
    "face_shape_classification":     "ratio",
    "e_line_deviation":              "intercanthal_units",
    "scleral_show_lower_l":          "intercanthal_units",
    "scleral_show_lower_r":          "intercanthal_units",
    "palpebral_fissure_inclination": "degrees",
    "supratarsal_fold_visibility":   "index_0_1",
    "nasal_dorsum_straightness":     "intercanthal_units",
    "columella_show":                "intercanthal_units",
}


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def perfect_nl():
    return normalize(perfect_frontal())


@pytest.fixture(scope="module")
def default_ctx():
    return QualityContext()


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_all_c1_ids_in_registry(self):
        ids = list_metric_ids()
        for mid in _C1_IDS:
            assert mid in ids, f"'{mid}' missing from registry"

    def test_get_each_returns_non_none(self):
        for mid in _C1_IDS:
            assert get(mid) is not None

    def test_stub_has_requires_pixel_analysis(self):
        for mid in _STUB_IDS:
            calc = get(mid)
            assert getattr(calc, "requires_pixel_analysis", False) is True

    def test_landmark_metrics_do_not_require_pixel(self):
        for mid in _LANDMARK_IDS:
            calc = get(mid)
            assert not getattr(calc, "requires_pixel_analysis", False)

    def test_landmark_metrics_not_presentation_only(self):
        for mid in _LANDMARK_IDS:
            calc = get(mid)
            assert not getattr(calc, "presentation_only", False)


# ---------------------------------------------------------------------------
# MetricValue contract (all 10)
# ---------------------------------------------------------------------------

class TestContract:
    @pytest.mark.parametrize("metric_id", _C1_IDS)
    def test_returns_metric_value(self, metric_id, perfect_nl, default_ctx):
        result = get(metric_id).compute(perfect_nl, default_ctx)
        assert isinstance(result, MetricValue)

    @pytest.mark.parametrize("metric_id", _C1_IDS)
    def test_correct_unit(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.unit == _EXPECTED_UNITS[metric_id], (
            f"{metric_id}: expected unit={_EXPECTED_UNITS[metric_id]!r}, got {r.unit!r}"
        )

    @pytest.mark.parametrize("metric_id", _C1_IDS)
    def test_metric_id_in_result(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.metric_id == metric_id

    @pytest.mark.parametrize("metric_id", _C1_IDS)
    def test_presentation_only_false(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.presentation_only is False

    @pytest.mark.parametrize("metric_id", _LANDMARK_IDS)
    def test_confidence_in_range(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", _LANDMARK_IDS)
    def test_dep_landmarks_non_empty(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 1

    @pytest.mark.parametrize("metric_id", _STUB_IDS)
    def test_stub_zero_confidence(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.confidence_raw == 0.0
        assert r.confidence_final == 0.0
        assert r.is_low_confidence is True

    @pytest.mark.parametrize("metric_id", _STUB_IDS)
    def test_stub_not_computed_direction(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.direction == "not_computed"


# ---------------------------------------------------------------------------
# brow_tail_drop_r
# ---------------------------------------------------------------------------

class TestBrowTailDropRight:
    def test_value_is_float(self, perfect_nl, default_ctx):
        r = get("brow_tail_drop_r").compute(perfect_nl, default_ctx)
        assert isinstance(r.value, float)

    def test_direction_is_valid(self, perfect_nl, default_ctx):
        r = get("brow_tail_drop_r").compute(perfect_nl, default_ctx)
        assert r.direction in ("tail_drop", "tail_lift", "neutral")

    def test_region_is_brows(self, perfect_nl, default_ctx):
        r = get("brow_tail_drop_r").compute(perfect_nl, default_ctx)
        assert r.region == "brows"


# ---------------------------------------------------------------------------
# hairline_curvature_index (promoted)
# ---------------------------------------------------------------------------

class TestHairlineCurvatureIndex:
    def test_value_in_index_range(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert 0.0 <= r.value <= 2.0  # index_0_1 but can exceed 1 near extreme arches

    def test_direction_is_valid(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "prominent_arch", "flat_arch")

    def test_confidence_positive(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert r.confidence_raw > 0.0

    def test_region_is_forehead(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert r.region == "forehead"


# ---------------------------------------------------------------------------
# face_shape_classification (promoted from presentation_only)
# ---------------------------------------------------------------------------

class TestFaceShapeClassificationC1:
    def test_direction_is_valid(self, perfect_nl, default_ctx):
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert r.direction in {"oval", "round", "oblong", "square", "heart"}

    def test_value_positive(self, perfect_nl, default_ctx):
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert r.value > 0.0

    def test_not_presentation_only(self, perfect_nl, default_ctx):
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert r.presentation_only is False

    def test_region_is_global(self, perfect_nl, default_ctx):
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert r.region == "global"


# ---------------------------------------------------------------------------
# e_line_deviation (promoted from pixel-dep stub)
# ---------------------------------------------------------------------------

class TestELineDeviationC1:
    def test_value_non_negative(self, perfect_nl, default_ctx):
        r = get("e_line_deviation").compute(perfect_nl, default_ctx)
        assert r.value >= 0.0

    def test_direction_is_valid(self, perfect_nl, default_ctx):
        r = get("e_line_deviation").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "left_deviation", "right_deviation")

    def test_symmetric_face_near_zero_or_neutral(self, perfect_nl, default_ctx):
        """Perfect symmetric frontal face: deviation should be small (< 0.1 ICU)."""
        r = get("e_line_deviation").compute(perfect_nl, default_ctx)
        # symmetric face has lip on midline → very small deviation
        assert r.value < 0.1

    def test_region_is_global(self, perfect_nl, default_ctx):
        r = get("e_line_deviation").compute(perfect_nl, default_ctx)
        assert r.region == "global"


# ---------------------------------------------------------------------------
# scleral_show_lower_l / scleral_show_lower_r
# ---------------------------------------------------------------------------

class TestScleralShowLower:
    def test_left_value_non_negative(self, perfect_nl, default_ctx):
        r = get("scleral_show_lower_l").compute(perfect_nl, default_ctx)
        assert r.value >= 0.0

    def test_right_value_non_negative(self, perfect_nl, default_ctx):
        r = get("scleral_show_lower_r").compute(perfect_nl, default_ctx)
        assert r.value >= 0.0

    def test_no_show_on_perfect(self, perfect_nl, default_ctx):
        """Iris bottom placed 3 px ABOVE lower lid → 0 scleral show (clamped)."""
        r_l = get("scleral_show_lower_l").compute(perfect_nl, default_ctx)
        r_r = get("scleral_show_lower_r").compute(perfect_nl, default_ctx)
        assert r_l.value == 0.0
        assert r_r.value == 0.0

    def test_left_direction_neutral_on_perfect(self, perfect_nl, default_ctx):
        r = get("scleral_show_lower_l").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_right_direction_neutral_on_perfect(self, perfect_nl, default_ctx):
        r = get("scleral_show_lower_r").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_scleral_show_detected_when_iris_below_lid(self, default_ctx):
        """Construct a face where iris bottom is BELOW lower lid → show > 0."""
        import numpy as np
        raw = perfect_frontal()
        # Push iris bottom 10 px below the lower lid (315 + 10 = 325)
        raw[P_LEFT_IRIS_BOT]  = [300.0, 325.0, 0.0]
        raw[P_RIGHT_IRIS_BOT] = [500.0, 325.0, 0.0]
        raw[P_LEFT_EYE_BOT]   = [300.0, 315.0, 0.0]
        raw[P_RIGHT_EYE_BOT]  = [500.0, 315.0, 0.0]
        nl = normalize(raw)
        r_l = get("scleral_show_lower_l").compute(nl, default_ctx)
        r_r = get("scleral_show_lower_r").compute(nl, default_ctx)
        assert r_l.value > 0.0
        assert r_r.value > 0.0
        assert r_l.direction == "scleral_show"
        assert r_r.direction == "scleral_show"

    def test_left_region_is_eyes(self, perfect_nl, default_ctx):
        assert get("scleral_show_lower_l").compute(perfect_nl, default_ctx).region == "eyes"

    def test_right_region_is_eyes(self, perfect_nl, default_ctx):
        assert get("scleral_show_lower_r").compute(perfect_nl, default_ctx).region == "eyes"


# ---------------------------------------------------------------------------
# palpebral_fissure_inclination
# ---------------------------------------------------------------------------

class TestPalpebralFissureInclination:
    def test_value_is_float(self, perfect_nl, default_ctx):
        r = get("palpebral_fissure_inclination").compute(perfect_nl, default_ctx)
        assert isinstance(r.value, float)

    def test_direction_is_valid(self, perfect_nl, default_ctx):
        r = get("palpebral_fissure_inclination").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "positive_tilt", "negative_tilt")

    def test_symmetric_face_has_zero_tilt(self, perfect_nl, default_ctx):
        """Perfect frontal: all eye landmarks at same y → tilt = 0°."""
        r = get("palpebral_fissure_inclination").compute(perfect_nl, default_ctx)
        assert abs(r.value) < 1.0  # nearly zero tilt

    def test_region_is_eyes(self, perfect_nl, default_ctx):
        r = get("palpebral_fissure_inclination").compute(perfect_nl, default_ctx)
        assert r.region == "eyes"

    def test_dep_landmarks_include_all_four_canthi(self, perfect_nl, default_ctx):
        from app.domain.landmarks_mesh import (
            P_LEFT_EYE_INNER, P_LEFT_EYE_OUTER,
            P_RIGHT_EYE_INNER, P_RIGHT_EYE_OUTER,
        )
        r = get("palpebral_fissure_inclination").compute(perfect_nl, default_ctx)
        for idx in (P_LEFT_EYE_INNER, P_LEFT_EYE_OUTER, P_RIGHT_EYE_INNER, P_RIGHT_EYE_OUTER):
            assert idx in r.dependency_landmarks


# ---------------------------------------------------------------------------
# supratarsal_fold_visibility (stub)
# ---------------------------------------------------------------------------

class TestSupratarsalFoldVisibility:
    def test_value_is_zero(self, perfect_nl, default_ctx):
        r = get("supratarsal_fold_visibility").compute(perfect_nl, default_ctx)
        assert r.value == 0.0

    def test_confidence_zero(self, perfect_nl, default_ctx):
        r = get("supratarsal_fold_visibility").compute(perfect_nl, default_ctx)
        assert r.confidence_raw == 0.0
        assert r.confidence_final == 0.0

    def test_region_is_eyes(self, perfect_nl, default_ctx):
        r = get("supratarsal_fold_visibility").compute(perfect_nl, default_ctx)
        assert r.region == "eyes"


# ---------------------------------------------------------------------------
# nasal_dorsum_straightness
# ---------------------------------------------------------------------------

class TestNasalDorsumStraightness:
    def test_value_non_negative(self, perfect_nl, default_ctx):
        r = get("nasal_dorsum_straightness").compute(perfect_nl, default_ctx)
        assert r.value >= 0.0

    def test_direction_is_valid(self, perfect_nl, default_ctx):
        r = get("nasal_dorsum_straightness").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "deviated_left", "deviated_right")

    def test_symmetric_face_near_zero(self, perfect_nl, default_ctx):
        """Midline bridge (all landmarks on x=0) → deviation ≈ 0."""
        r = get("nasal_dorsum_straightness").compute(perfect_nl, default_ctx)
        assert r.value < 0.05

    def test_deviation_detected_on_deviated_bridge(self, default_ctx):
        """Shift bridge points 15 px left → non-zero straightness deviation."""
        from app.domain.landmarks_mesh import LM_NOSE_BRIDGE, P_NASION, P_NOSE_TIP
        raw = perfect_frontal()
        for idx in LM_NOSE_BRIDGE[1:]:  # shift only intermediate points
            x, y, z = raw[idx]
            raw[idx] = [x - 15.0, y, z]
        nl = normalize(raw)
        r = get("nasal_dorsum_straightness").compute(nl, default_ctx)
        assert r.value > 0.01

    def test_region_is_nose(self, perfect_nl, default_ctx):
        r = get("nasal_dorsum_straightness").compute(perfect_nl, default_ctx)
        assert r.region == "nose"


# ---------------------------------------------------------------------------
# columella_show
# ---------------------------------------------------------------------------

class TestColumellaShow:
    def test_value_is_float(self, perfect_nl, default_ctx):
        r = get("columella_show").compute(perfect_nl, default_ctx)
        assert isinstance(r.value, float)

    def test_direction_is_valid(self, perfect_nl, default_ctx):
        r = get("columella_show").compute(perfect_nl, default_ctx)
        assert r.direction in ("adequate_show", "insufficient_show", "excessive_show")

    def test_region_is_nose(self, perfect_nl, default_ctx):
        r = get("columella_show").compute(perfect_nl, default_ctx)
        assert r.region == "nose"

    def test_retracted_columella_detected(self, default_ctx):
        """Place subnasale well above alar level → insufficient_show."""
        raw = perfect_frontal()
        # Move subnasale 30 px ABOVE alar baseline
        alar_y = (raw[P_NOSE_LEFT][1] + raw[P_NOSE_RIGHT][1]) / 2.0
        raw[P_SUBNASALE] = [400.0, alar_y - 30.0, 0.0]
        nl = normalize(raw)
        r = get("columella_show").compute(nl, default_ctx)
        assert r.direction == "insufficient_show"

    def test_excessive_show_detected(self, default_ctx):
        """Place subnasale well below alar level → excessive_show."""
        raw = perfect_frontal()
        alar_y = (raw[P_NOSE_LEFT][1] + raw[P_NOSE_RIGHT][1]) / 2.0
        raw[P_SUBNASALE] = [400.0, alar_y + 25.0, 0.0]
        nl = normalize(raw)
        r = get("columella_show").compute(nl, default_ctx)
        assert r.direction == "excessive_show"

    def test_dep_landmarks_include_subnasale_and_alars(self, perfect_nl, default_ctx):
        from app.domain.landmarks_mesh import P_NOSE_LEFT, P_NOSE_RIGHT, P_SUBNASALE
        r = get("columella_show").compute(perfect_nl, default_ctx)
        for idx in (P_SUBNASALE, P_NOSE_LEFT, P_NOSE_RIGHT):
            assert idx in r.dependency_landmarks
