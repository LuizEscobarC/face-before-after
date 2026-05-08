"""Tests for services/metrics/fifths.py (PR-7).

Covers all 6 fifths metrics:
  - fifth_1_ratio through fifth_5_ratio
  - intercanthal_to_eye_width_ratio

Key invariants verified:
  - perfect_frontal fixture → each ratio ≈ 0.20 (equal fifths), all neutral
  - five ratios sum to 1.0
  - intercanthal_to_eye_width_ratio ≈ 1.0 for perfect_frontal
  - MetricValue contract (all fields, units, region, family)
  - Confidence: yaw penalises more than pitch (FIFTHS_POSE_PARAMS)
  - Registry wiring (all 6 registered)
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
    known_asymmetric,
    perfect_frontal,
    posed_yaw15,
)

_IDEAL_FIFTH = 0.20
_IDEAL_ICD_EYE = 1.0
_FIFTH_IDS = [
    "fifth_1_ratio",
    "fifth_2_ratio",
    "fifth_3_ratio",
    "fifth_4_ratio",
    "fifth_5_ratio",
]
_ALL_IDS = _FIFTH_IDS + ["intercanthal_to_eye_width_ratio"]


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def frontal_nl():
    return normalize(perfect_frontal())


@pytest.fixture
def asym_nl():
    return normalize(known_asymmetric())


@pytest.fixture
def yaw15_nl():
    return normalize(posed_yaw15())


@pytest.fixture
def default_ctx():
    return QualityContext()


@pytest.fixture
def yaw_ctx():
    """10° yaw — principal threat to fifths (horizontal compression)."""
    return QualityContext(pose={"yaw": 10.0, "pitch": 0.0})


@pytest.fixture
def pitch_ctx():
    """10° pitch — minimal threat to horizontal proportions."""
    return QualityContext(pose={"yaw": 0.0, "pitch": 10.0})


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_all_fifths_registered(self):
        ids = set(list_metric_ids())
        for mid in _ALL_IDS:
            assert mid in ids, f"'{mid}' not in registry"

    def test_get_each(self):
        for mid in _ALL_IDS:
            assert get(mid) is not None


# ---------------------------------------------------------------------------
# MetricValue contract (all 6 metrics × perfect_frontal fixture)
# ---------------------------------------------------------------------------

class TestContract:
    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_returns_metric_value(self, metric_id, frontal_nl, default_ctx):
        assert isinstance(get(metric_id).compute(frontal_nl, default_ctx), MetricValue)

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_region_is_symmetry(self, metric_id, frontal_nl, default_ctx):
        assert get(metric_id).compute(frontal_nl, default_ctx).region == "symmetry"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_family_is_fifths(self, metric_id, frontal_nl, default_ctx):
        assert get(metric_id).compute(frontal_nl, default_ctx).family == "fifths"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_unit_is_ratio(self, metric_id, frontal_nl, default_ctx):
        assert get(metric_id).compute(frontal_nl, default_ctx).unit == "ratio"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_confidence_in_range(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_value_positive(self, metric_id, frontal_nl, default_ctx):
        assert get(metric_id).compute(frontal_nl, default_ctx).value > 0.0

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_dep_landmarks_non_empty(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 4


# ---------------------------------------------------------------------------
# Fifth ratio individual tests
# ---------------------------------------------------------------------------

class TestFifthRatios:
    @pytest.mark.parametrize("metric_id", _FIFTH_IDS)
    def test_perfect_frontal_near_ideal(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert abs(r.value - _IDEAL_FIFTH) < 0.005, (
            f"{metric_id}: expected ≈{_IDEAL_FIFTH}, got {r.value:.4f}"
        )

    @pytest.mark.parametrize("metric_id", _FIFTH_IDS)
    def test_perfect_frontal_direction_neutral(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert r.direction == "neutral", (
            f"{metric_id}: expected 'neutral', got '{r.direction}'"
        )

    @pytest.mark.parametrize("metric_id", _FIFTH_IDS)
    def test_ratio_between_zero_and_one(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert 0.0 < r.value < 1.0


# ---------------------------------------------------------------------------
# Five ratios sum to 1.0
# ---------------------------------------------------------------------------

class TestFifthsSum:
    def test_perfect_frontal_sum_to_one(self, frontal_nl, default_ctx):
        total = sum(
            get(mid).compute(frontal_nl, default_ctx).value
            for mid in _FIFTH_IDS
        )
        assert abs(total - 1.0) < 1e-9, f"f1+…+f5 = {total}"

    def test_asymmetric_sum_to_one(self, asym_nl, default_ctx):
        total = sum(
            get(mid).compute(asym_nl, default_ctx).value
            for mid in _FIFTH_IDS
        )
        assert abs(total - 1.0) < 1e-9, f"f1+…+f5 = {total}"


# ---------------------------------------------------------------------------
# intercanthal_to_eye_width_ratio
# ---------------------------------------------------------------------------

class TestIntercanthalToEyeWidth:
    def _c(self):
        return get("intercanthal_to_eye_width_ratio")

    def test_perfect_frontal_near_one(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        assert abs(r.value - _IDEAL_ICD_EYE) < 0.005, (
            f"Expected ≈1.0, got {r.value:.4f}"
        )

    def test_perfect_frontal_direction_neutral(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        assert r.direction == "neutral"

    def test_dep_landmarks_are_canthus_only(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        # Should use 4 canthus landmarks, NOT the zygomatic anchors
        assert len(r.dependency_landmarks) == 4

    def test_value_positive(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        assert r.value > 0.0


# ---------------------------------------------------------------------------
# Direction labels
# ---------------------------------------------------------------------------

class TestDirectionLabels:
    @pytest.mark.parametrize("metric_id", _FIFTH_IDS)
    def test_direction_is_valid_label(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert r.direction in {"neutral", "wide", "narrow"}

    def test_icd_eye_direction_valid(self, frontal_nl, default_ctx):
        r = get("intercanthal_to_eye_width_ratio").compute(frontal_nl, default_ctx)
        assert r.direction in {"neutral", "wide_set", "close_set"}


# ---------------------------------------------------------------------------
# Confidence propagation
# ---------------------------------------------------------------------------

class TestConfidence:
    def test_yaw_penalises_more_than_pitch(self, frontal_nl, yaw_ctx, pitch_ctx):
        """10° yaw must reduce confidence more than 10° pitch (FIFTHS_POSE_PARAMS)."""
        calc = get("fifth_3_ratio")
        r_yaw   = calc.compute(frontal_nl, yaw_ctx)
        r_pitch = calc.compute(frontal_nl, pitch_ctx)
        assert r_yaw.confidence_final < r_pitch.confidence_final, (
            f"yaw={r_yaw.confidence_final:.3f} should be < pitch={r_pitch.confidence_final:.3f}"
        )

    def test_quality_score_reduces_confidence(self, frontal_nl):
        ctx_good = QualityContext(quality_score=1.0)
        ctx_bad  = QualityContext(quality_score=0.5)
        calc = get("fifth_3_ratio")
        r_good = calc.compute(frontal_nl, ctx_good)
        r_bad  = calc.compute(frontal_nl, ctx_bad)
        assert r_bad.confidence_final < r_good.confidence_final

    def test_zero_quality_score_yields_zero_confidence(self, frontal_nl):
        ctx = QualityContext(quality_score=0.0)
        for mid in _ALL_IDS:
            r = get(mid).compute(frontal_nl, ctx)
            assert r.confidence_final == 0.0, f"{mid}: expected 0.0, got {r.confidence_final}"

    def test_low_confidence_flag_consistent(self, frontal_nl):
        ctx = QualityContext(quality_score=0.2, regional_penalties={"symmetry": 0.5})
        for mid in _ALL_IDS:
            r = get(mid).compute(frontal_nl, ctx)
            assert r.is_low_confidence is (r.confidence_final < LOW_CONF_THRESHOLD)

    def test_high_yaw_triggers_low_confidence(self, frontal_nl):
        """30° yaw is beyond hard threshold → fifth confidence should drop hard."""
        ctx = QualityContext(pose={"yaw": 30.0, "pitch": 0.0})
        r = get("fifth_3_ratio").compute(frontal_nl, ctx)
        assert r.confidence_final < 0.5


# ---------------------------------------------------------------------------
# compute_all integration
# ---------------------------------------------------------------------------

class TestComputeAll:
    def test_compute_all_returns_6_fifths(self, frontal_nl, default_ctx):
        results = compute_all(frontal_nl, default_ctx, metric_ids=_ALL_IDS)
        assert len(results) == 6

    def test_all_results_are_metric_value(self, frontal_nl, default_ctx):
        for r in compute_all(frontal_nl, default_ctx, metric_ids=_ALL_IDS):
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

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_all_keys_present(self, metric_id, frontal_nl, default_ctx):
        d = get(metric_id).compute(frontal_nl, default_ctx).to_dict()
        for key in self.REQUIRED_KEYS:
            assert key in d, f"key '{key}' missing in {metric_id}.to_dict()"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_dependency_landmarks_is_list(self, metric_id, frontal_nl, default_ctx):
        d = get(metric_id).compute(frontal_nl, default_ctx).to_dict()
        assert isinstance(d["dependency_landmarks"], list)

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_presentation_only_is_false(self, metric_id, frontal_nl, default_ctx):
        d = get(metric_id).compute(frontal_nl, default_ctx).to_dict()
        assert d["presentation_only"] is False
