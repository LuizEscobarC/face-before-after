"""Tests for services/metrics/thirds.py (PR-6).

Covers all 4 thirds metrics:
  - upper_third_ratio
  - middle_third_ratio
  - lower_third_ratio
  - dominant_third

Key invariants verified:
  - perfect_thirds fixture → each ratio ≈ 0.333, direction 'balanced'/'neutral'
  - perfect_frontal fixture → upper-dominant (tall forehead), ratios sum to 1.0
  - MetricValue contract (all fields, units, region, family)
  - Confidence propagation (quality_score, pitch penalty stronger than yaw)
  - Registry wiring (all 4 registered)
  - to_dict() round-trip
"""

from __future__ import annotations

import pytest

import app.services.metrics  # noqa: F401 — trigger @register
from app.domain.metric_value import MetricValue
from app.services.metrics.base import QualityContext
from app.services.metrics.confidence_propagation import LOW_CONF_THRESHOLD
from app.services.metrics.registry import compute_all, get, list_metric_ids
from app.services.normalization import normalize
from tests.fixtures.synthetic_landmarks import (
    perfect_frontal,
    perfect_thirds,
    posed_yaw15,
)

_IDEAL = 1.0 / 3.0


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def frontal_nl():
    return normalize(perfect_frontal())


@pytest.fixture
def thirds_nl():
    return normalize(perfect_thirds())


@pytest.fixture
def default_ctx():
    return QualityContext()


@pytest.fixture
def pitch_ctx():
    """10° pitch — should penalise thirds more than yaw."""
    return QualityContext(pose={"yaw": 0.0, "pitch": 10.0})


@pytest.fixture
def yaw_ctx():
    """10° yaw — should penalise thirds less than pitch."""
    return QualityContext(pose={"yaw": 10.0, "pitch": 0.0})


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    EXPECTED = {
        "upper_third_ratio",
        "middle_third_ratio",
        "lower_third_ratio",
        "dominant_third",
    }

    def test_all_thirds_registered(self):
        assert self.EXPECTED <= set(list_metric_ids())

    def test_get_each(self):
        for mid in self.EXPECTED:
            assert get(mid) is not None


# ---------------------------------------------------------------------------
# MetricValue contract (all 4 metrics × perfect_thirds fixture)
# ---------------------------------------------------------------------------

_THIRDS_IDS = [
    "upper_third_ratio",
    "middle_third_ratio",
    "lower_third_ratio",
    "dominant_third",
]


class TestContract:
    @pytest.mark.parametrize("metric_id", _THIRDS_IDS)
    def test_returns_metric_value(self, metric_id, thirds_nl, default_ctx):
        assert isinstance(get(metric_id).compute(thirds_nl, default_ctx), MetricValue)

    @pytest.mark.parametrize("metric_id", _THIRDS_IDS)
    def test_region_is_symmetry(self, metric_id, thirds_nl, default_ctx):
        assert get(metric_id).compute(thirds_nl, default_ctx).region == "symmetry"

    @pytest.mark.parametrize("metric_id", _THIRDS_IDS)
    def test_family_is_thirds(self, metric_id, thirds_nl, default_ctx):
        assert get(metric_id).compute(thirds_nl, default_ctx).family == "thirds"

    @pytest.mark.parametrize("metric_id", _THIRDS_IDS)
    def test_unit_is_ratio(self, metric_id, thirds_nl, default_ctx):
        assert get(metric_id).compute(thirds_nl, default_ctx).unit == "ratio"

    @pytest.mark.parametrize("metric_id", _THIRDS_IDS)
    def test_confidence_in_range(self, metric_id, thirds_nl, default_ctx):
        r = get(metric_id).compute(thirds_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", _THIRDS_IDS)
    def test_value_positive(self, metric_id, thirds_nl, default_ctx):
        r = get(metric_id).compute(thirds_nl, default_ctx)
        assert r.value > 0.0

    @pytest.mark.parametrize("metric_id", _THIRDS_IDS)
    def test_dep_landmarks_non_empty(self, metric_id, thirds_nl, default_ctx):
        r = get(metric_id).compute(thirds_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 4


# ---------------------------------------------------------------------------
# upper_third_ratio
# ---------------------------------------------------------------------------

class TestUpperThirdRatio:
    def _c(self):
        return get("upper_third_ratio")

    def test_perfect_thirds_near_ideal(self, thirds_nl, default_ctx):
        r = self._c().compute(thirds_nl, default_ctx)
        assert abs(r.value - _IDEAL) < 0.01, f"upper={r.value}, expected ≈{_IDEAL:.4f}"

    def test_perfect_thirds_direction_neutral(self, thirds_nl, default_ctx):
        r = self._c().compute(thirds_nl, default_ctx)
        assert r.direction == "neutral"

    def test_perfect_frontal_upper_dominant(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        assert r.value > _IDEAL, f"Expected upper > 0.333 in frontal, got {r.value}"
        assert r.direction == "long"

    def test_ratio_between_zero_and_one(self, thirds_nl, default_ctx):
        r = self._c().compute(thirds_nl, default_ctx)
        assert 0.0 < r.value < 1.0


# ---------------------------------------------------------------------------
# middle_third_ratio
# ---------------------------------------------------------------------------

class TestMiddleThirdRatio:
    def _c(self):
        return get("middle_third_ratio")

    def test_perfect_thirds_near_ideal(self, thirds_nl, default_ctx):
        r = self._c().compute(thirds_nl, default_ctx)
        assert abs(r.value - _IDEAL) < 0.01, f"middle={r.value}"

    def test_perfect_thirds_direction_neutral(self, thirds_nl, default_ctx):
        r = self._c().compute(thirds_nl, default_ctx)
        assert r.direction == "neutral"

    def test_perfect_frontal_middle_short(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        assert r.direction == "short"

    def test_ratio_between_zero_and_one(self, thirds_nl, default_ctx):
        r = self._c().compute(thirds_nl, default_ctx)
        assert 0.0 < r.value < 1.0


# ---------------------------------------------------------------------------
# lower_third_ratio
# ---------------------------------------------------------------------------

class TestLowerThirdRatio:
    def _c(self):
        return get("lower_third_ratio")

    def test_perfect_thirds_near_ideal(self, thirds_nl, default_ctx):
        r = self._c().compute(thirds_nl, default_ctx)
        assert abs(r.value - _IDEAL) < 0.01, f"lower={r.value}"

    def test_perfect_thirds_direction_neutral(self, thirds_nl, default_ctx):
        r = self._c().compute(thirds_nl, default_ctx)
        assert r.direction == "neutral"

    def test_ratio_between_zero_and_one(self, thirds_nl, default_ctx):
        r = self._c().compute(thirds_nl, default_ctx)
        assert 0.0 < r.value < 1.0


# ---------------------------------------------------------------------------
# Ratios sum to 1.0
# ---------------------------------------------------------------------------

class TestRatiosSumToOne:
    def test_perfect_thirds_sum(self, thirds_nl, default_ctx):
        u = get("upper_third_ratio").compute(thirds_nl, default_ctx).value
        m = get("middle_third_ratio").compute(thirds_nl, default_ctx).value
        l = get("lower_third_ratio").compute(thirds_nl, default_ctx).value
        assert abs(u + m + l - 1.0) < 1e-9, f"u+m+l = {u+m+l}"

    def test_perfect_frontal_sum(self, frontal_nl, default_ctx):
        u = get("upper_third_ratio").compute(frontal_nl, default_ctx).value
        m = get("middle_third_ratio").compute(frontal_nl, default_ctx).value
        l = get("lower_third_ratio").compute(frontal_nl, default_ctx).value
        assert abs(u + m + l - 1.0) < 1e-9, f"u+m+l = {u+m+l}"


# ---------------------------------------------------------------------------
# dominant_third
# ---------------------------------------------------------------------------

class TestDominantThird:
    def _c(self):
        return get("dominant_third")

    def test_perfect_thirds_direction_balanced(self, thirds_nl, default_ctx):
        r = self._c().compute(thirds_nl, default_ctx)
        assert r.direction == "balanced", f"Expected 'balanced', got '{r.direction}'"

    def test_perfect_frontal_direction_middle(self, frontal_nl, default_ctx):
        """In perfect_frontal: middle=0.22 deviates 0.113 from 0.333,
        upper=0.43 deviates only 0.097 → middle is dominant."""
        r = self._c().compute(frontal_nl, default_ctx)
        assert r.direction == "middle", f"Expected 'middle' (biggest deviation), got '{r.direction}'"

    def test_value_is_dominant_ratio(self, frontal_nl, default_ctx):
        """dominant_third value should match the middle_third_ratio value
        (middle has the biggest deviation from 0.333 in perfect_frontal)."""
        r_dom = self._c().compute(frontal_nl, default_ctx)
        r_mid = get("middle_third_ratio").compute(frontal_nl, default_ctx)
        assert abs(r_dom.value - r_mid.value) < 1e-9

    def test_value_in_range(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        assert 0.0 < r.value < 1.0


# ---------------------------------------------------------------------------
# Confidence propagation
# ---------------------------------------------------------------------------

class TestConfidence:
    def test_pitch_penalises_more_than_yaw(self, thirds_nl, pitch_ctx, yaw_ctx):
        """10° pitch should reduce thirds confidence more than 10° yaw."""
        calc = get("upper_third_ratio")
        r_pitch = calc.compute(thirds_nl, pitch_ctx)
        r_yaw = calc.compute(thirds_nl, yaw_ctx)
        assert r_pitch.confidence_final < r_yaw.confidence_final, (
            f"pitch={r_pitch.confidence_final:.3f} should be < yaw={r_yaw.confidence_final:.3f}"
        )

    def test_quality_score_reduces_confidence(self, thirds_nl):
        ctx_good = QualityContext(quality_score=1.0)
        ctx_bad = QualityContext(quality_score=0.5)
        calc = get("middle_third_ratio")
        r_good = calc.compute(thirds_nl, ctx_good)
        r_bad = calc.compute(thirds_nl, ctx_bad)
        assert r_bad.confidence_final < r_good.confidence_final

    def test_zero_quality_score_yields_zero_confidence(self, thirds_nl):
        ctx = QualityContext(quality_score=0.0)
        for mid in ["upper_third_ratio", "middle_third_ratio", "lower_third_ratio"]:
            r = get(mid).compute(thirds_nl, ctx)
            assert r.confidence_final == 0.0

    def test_low_confidence_flag_consistent(self, thirds_nl):
        ctx = QualityContext(quality_score=0.2, regional_penalties={"symmetry": 0.5})
        for mid in _THIRDS_IDS:
            r = get(mid).compute(thirds_nl, ctx)
            assert r.is_low_confidence is (r.confidence_final < LOW_CONF_THRESHOLD)


# ---------------------------------------------------------------------------
# compute_all integration
# ---------------------------------------------------------------------------

class TestComputeAll:
    def test_compute_all_returns_4_thirds(self, thirds_nl, default_ctx):
        results = compute_all(thirds_nl, default_ctx, metric_ids=_THIRDS_IDS)
        assert len(results) == 4

    def test_all_results_are_metric_value(self, thirds_nl, default_ctx):
        for r in compute_all(thirds_nl, default_ctx, metric_ids=_THIRDS_IDS):
            assert isinstance(r, MetricValue)


# ---------------------------------------------------------------------------
# to_dict round-trip
# ---------------------------------------------------------------------------

class TestToDictRoundTrip:
    REQUIRED_KEYS = (
        "metric_id", "region", "family", "unit", "value", "error",
        "confidence_raw", "confidence_final", "is_low_confidence",
        "direction", "dependency_landmarks", "presentation_only",
    )

    @pytest.mark.parametrize("metric_id", _THIRDS_IDS)
    def test_all_keys_present(self, metric_id, thirds_nl, default_ctx):
        d = get(metric_id).compute(thirds_nl, default_ctx).to_dict()
        for key in self.REQUIRED_KEYS:
            assert key in d

    @pytest.mark.parametrize("metric_id", _THIRDS_IDS)
    def test_dependency_landmarks_is_list(self, metric_id, thirds_nl, default_ctx):
        d = get(metric_id).compute(thirds_nl, default_ctx).to_dict()
        assert isinstance(d["dependency_landmarks"], list)
