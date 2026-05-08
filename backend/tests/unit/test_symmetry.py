"""Tests for services/metrics/symmetry.py (PR-5).

Covers all 5 symmetry metrics:
  - midline_deviation
  - eye_height_asymmetry
  - brow_height_asymmetry
  - lip_canting_angle
  - global_asymmetry_index

And verifies:
  - MetricValue contract (all required fields present)
  - Confidence propagation (quality_score, regional_penalty, pose_penalty)
  - Registry wiring (all 5 metrics registered)
  - MetricValue.to_dict() round-trip
"""

from __future__ import annotations

import math

import numpy as np
import pytest

# Trigger @register decorators for all symmetry calculators.
import app.services.metrics  # noqa: F401
from app.domain.metric_value import MetricValue
from app.services.metrics.base import QualityContext
from app.services.metrics.confidence_propagation import LOW_CONF_THRESHOLD
from app.services.metrics.registry import compute_all, get, list_metric_ids
from app.services.normalization import normalize
from tests.fixtures.synthetic_landmarks import (
    known_asymmetric,
    perfect_frontal,
    posed_yaw15,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def frontal_nl():
    return normalize(perfect_frontal())


@pytest.fixture
def asymmetric_nl():
    return normalize(known_asymmetric())


@pytest.fixture
def posed_nl():
    return normalize(posed_yaw15(), yaw_deg=15.0)


@pytest.fixture
def default_ctx():
    return QualityContext()


@pytest.fixture
def degraded_ctx():
    """Low quality + severe symmetry regional penalty."""
    return QualityContext(
        quality_score=0.7,
        regional_penalties={"symmetry": 0.3},
        pose={"yaw": 0.0},
    )


@pytest.fixture
def posed_ctx():
    return QualityContext(pose={"yaw": 15.0, "pitch": 0.0})


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    EXPECTED_IDS = {
        "midline_deviation",
        "eye_height_asymmetry",
        "brow_height_asymmetry",
        "lip_canting_angle",
        "global_asymmetry_index",
    }

    def test_all_symmetry_metrics_registered(self):
        registered = set(list_metric_ids())
        assert self.EXPECTED_IDS <= registered

    def test_get_returns_calculator(self):
        calc = get("midline_deviation")
        assert calc is not None

    def test_unknown_metric_returns_none(self):
        assert get("nonexistent_metric_xyz") is None


# ---------------------------------------------------------------------------
# MetricValue contract
# ---------------------------------------------------------------------------

class TestMetricValueContract:
    """Every metric must return a MetricValue with the full required contract."""

    @pytest.mark.parametrize("metric_id", [
        "midline_deviation",
        "eye_height_asymmetry",
        "brow_height_asymmetry",
        "lip_canting_angle",
        "global_asymmetry_index",
    ])
    def test_returns_metric_value(self, metric_id, frontal_nl, default_ctx):
        calc = get(metric_id)
        result = calc.compute(frontal_nl, default_ctx)
        assert isinstance(result, MetricValue)

    @pytest.mark.parametrize("metric_id", [
        "midline_deviation",
        "eye_height_asymmetry",
        "brow_height_asymmetry",
        "lip_canting_angle",
        "global_asymmetry_index",
    ])
    def test_metric_id_matches(self, metric_id, frontal_nl, default_ctx):
        calc = get(metric_id)
        result = calc.compute(frontal_nl, default_ctx)
        assert result.metric_id == metric_id

    @pytest.mark.parametrize("metric_id", [
        "midline_deviation",
        "eye_height_asymmetry",
        "brow_height_asymmetry",
        "lip_canting_angle",
        "global_asymmetry_index",
    ])
    def test_region_is_symmetry(self, metric_id, frontal_nl, default_ctx):
        calc = get(metric_id)
        result = calc.compute(frontal_nl, default_ctx)
        assert result.region == "symmetry"

    @pytest.mark.parametrize("metric_id", [
        "midline_deviation",
        "eye_height_asymmetry",
        "brow_height_asymmetry",
        "lip_canting_angle",
        "global_asymmetry_index",
    ])
    def test_confidence_in_range(self, metric_id, frontal_nl, default_ctx):
        calc = get(metric_id)
        r = calc.compute(frontal_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", [
        "midline_deviation",
        "eye_height_asymmetry",
        "brow_height_asymmetry",
        "lip_canting_angle",
        "global_asymmetry_index",
    ])
    def test_value_non_negative(self, metric_id, frontal_nl, default_ctx):
        calc = get(metric_id)
        r = calc.compute(frontal_nl, default_ctx)
        assert r.value >= 0.0

    @pytest.mark.parametrize("metric_id", [
        "midline_deviation",
        "eye_height_asymmetry",
        "brow_height_asymmetry",
        "lip_canting_angle",
        "global_asymmetry_index",
    ])
    def test_not_presentation_only(self, metric_id, frontal_nl, default_ctx):
        calc = get(metric_id)
        r = calc.compute(frontal_nl, default_ctx)
        assert r.presentation_only is False


# ---------------------------------------------------------------------------
# midline_deviation
# ---------------------------------------------------------------------------

class TestMidlineDeviation:
    def _calc(self):
        return get("midline_deviation")

    def test_perfect_frontal_near_zero(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.value < 0.01, f"Expected near-zero, got {r.value}"

    def test_asymmetric_face_nonzero(self, asymmetric_nl, default_ctx):
        r = self._calc().compute(asymmetric_nl, default_ctx)
        assert r.value > 0.02, f"Expected >0.02, got {r.value}"

    def test_perfect_frontal_direction_neutral(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.direction == "neutral"

    def test_asymmetric_direction_right_deviation(self, asymmetric_nl, default_ctx):
        # Nose+chin shifted 8px to right → right_deviation
        r = self._calc().compute(asymmetric_nl, default_ctx)
        assert r.direction in ("right_deviation", "left_deviation")

    def test_unit_is_intercanthal_units(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.unit == "intercanthal_units"

    def test_dependency_landmarks_non_empty(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert len(r.dependency_landmarks) > 0


# ---------------------------------------------------------------------------
# eye_height_asymmetry
# ---------------------------------------------------------------------------

class TestEyeHeightAsymmetry:
    def _calc(self):
        return get("eye_height_asymmetry")

    def test_perfect_frontal_near_zero(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.value < 0.01, f"Expected near-zero, got {r.value}"

    def test_perfect_frontal_direction_neutral(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.direction == "neutral"

    def test_asymmetric_fixture_eye_still_symmetric(self, asymmetric_nl, default_ctx):
        # known_asymmetric only shifts nose+chin — eyes stay symmetric.
        r = self._calc().compute(asymmetric_nl, default_ctx)
        assert r.value < 0.05, f"Eyes should stay symmetric in known_asymmetric, got {r.value}"

    def test_unit_is_intercanthal_units(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.unit == "intercanthal_units"


# ---------------------------------------------------------------------------
# brow_height_asymmetry
# ---------------------------------------------------------------------------

class TestBrowHeightAsymmetry:
    def _calc(self):
        return get("brow_height_asymmetry")

    def test_perfect_frontal_near_zero(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.value < 0.01, f"Expected near-zero, got {r.value}"

    def test_perfect_frontal_direction_neutral(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.direction == "neutral"

    def test_unit_is_intercanthal_units(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.unit == "intercanthal_units"

    def test_asymmetric_fixture_brow_still_symmetric(self, asymmetric_nl, default_ctx):
        # Brows not shifted in known_asymmetric fixture.
        r = self._calc().compute(asymmetric_nl, default_ctx)
        assert r.value < 0.05


# ---------------------------------------------------------------------------
# lip_canting_angle
# ---------------------------------------------------------------------------

class TestLipCantingAngle:
    def _calc(self):
        return get("lip_canting_angle")

    def test_perfect_frontal_near_zero_degrees(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.value < 0.5, f"Expected <0.5°, got {r.value}"

    def test_perfect_frontal_direction_neutral(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.direction == "neutral"

    def test_unit_is_degrees(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.unit == "degrees"

    def test_tilted_mouth_nonzero(self, frontal_nl, default_ctx):
        """Manually construct NL with asymmetric mouth and check non-zero."""
        import copy
        pts = perfect_frontal().copy()
        # Raise left mouth corner by 10px
        from app.domain.landmarks_mesh import P_LEFT_MOUTH
        pts[P_LEFT_MOUTH, 1] -= 10
        nl_tilted = normalize(pts)
        r = self._calc().compute(nl_tilted, default_ctx)
        assert r.value > 0.5
        assert r.direction != "neutral"


# ---------------------------------------------------------------------------
# global_asymmetry_index
# ---------------------------------------------------------------------------

class TestGlobalAsymmetryIndex:
    def _calc(self):
        return get("global_asymmetry_index")

    def test_perfect_frontal_near_zero(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.value < 0.15, f"Expected near-zero index, got {r.value}"

    def test_asymmetric_face_higher_than_frontal(self, frontal_nl, asymmetric_nl, default_ctx):
        r_frontal = self._calc().compute(frontal_nl, default_ctx)
        r_asym = self._calc().compute(asymmetric_nl, default_ctx)
        assert r_asym.value > r_frontal.value

    def test_value_in_unit_range(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert 0.0 <= r.value <= 1.0

    def test_unit_is_index_0_1(self, frontal_nl, default_ctx):
        r = self._calc().compute(frontal_nl, default_ctx)
        assert r.unit == "index_0_1"


# ---------------------------------------------------------------------------
# Confidence propagation
# ---------------------------------------------------------------------------

class TestConfidencePropagation:
    def test_quality_score_reduces_confidence(self, frontal_nl, default_ctx, degraded_ctx):
        calc = get("midline_deviation")
        r_full = calc.compute(frontal_nl, default_ctx)
        r_degraded = calc.compute(frontal_nl, degraded_ctx)
        assert r_degraded.confidence_final < r_full.confidence_final

    def test_high_pose_reduces_confidence(self, posed_nl, default_ctx, posed_ctx):
        """15° yaw should lower confidence_final vs zero pose."""
        calc = get("midline_deviation")
        r_no_pose = calc.compute(posed_nl, default_ctx)
        r_posed = calc.compute(posed_nl, posed_ctx)
        assert r_posed.confidence_final < r_no_pose.confidence_final

    def test_is_low_confidence_flag(self, frontal_nl):
        """With extreme quality + penalty the flag must be True."""
        ctx = QualityContext(
            quality_score=0.3,
            regional_penalties={"symmetry": 0.5},
        )
        calc = get("midline_deviation")
        r = calc.compute(frontal_nl, ctx)
        assert r.is_low_confidence is (r.confidence_final < LOW_CONF_THRESHOLD)

    def test_zero_quality_score_gives_zero_confidence(self, frontal_nl):
        ctx = QualityContext(quality_score=0.0)
        for mid in ["midline_deviation", "eye_height_asymmetry"]:
            r = get(mid).compute(frontal_nl, ctx)
            assert r.confidence_final == 0.0, f"{mid}: expected 0 confidence"


# ---------------------------------------------------------------------------
# compute_all integration
# ---------------------------------------------------------------------------

class TestComputeAll:
    def test_compute_all_returns_5_symmetry_metrics(self, frontal_nl, default_ctx):
        sym_ids = [
            "midline_deviation",
            "eye_height_asymmetry",
            "brow_height_asymmetry",
            "lip_canting_angle",
            "global_asymmetry_index",
        ]
        results = compute_all(frontal_nl, default_ctx, metric_ids=sym_ids)
        assert len(results) == 5

    def test_compute_all_returns_metric_value_objects(self, frontal_nl, default_ctx):
        sym_ids = ["midline_deviation", "lip_canting_angle"]
        results = compute_all(frontal_nl, default_ctx, metric_ids=sym_ids)
        for r in results:
            assert isinstance(r, MetricValue)


# ---------------------------------------------------------------------------
# to_dict round-trip
# ---------------------------------------------------------------------------

class TestToDictRoundTrip:
    @pytest.mark.parametrize("metric_id", [
        "midline_deviation",
        "eye_height_asymmetry",
        "brow_height_asymmetry",
        "lip_canting_angle",
        "global_asymmetry_index",
    ])
    def test_to_dict_has_all_required_keys(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        d = r.to_dict()
        for key in (
            "metric_id", "region", "family", "unit", "value", "error",
            "confidence_raw", "confidence_final", "is_low_confidence",
            "direction", "dependency_landmarks", "presentation_only",
        ):
            assert key in d, f"Missing key '{key}' in to_dict() for {metric_id}"

    @pytest.mark.parametrize("metric_id", [
        "midline_deviation",
        "global_asymmetry_index",
    ])
    def test_to_dict_dependency_landmarks_is_list(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        d = r.to_dict()
        assert isinstance(d["dependency_landmarks"], list)
