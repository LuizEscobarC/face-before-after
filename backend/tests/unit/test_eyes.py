"""Tests for services/metrics/eyes.py (PR-8).

Covers all 6 eye metrics:
  - eye_aperture_ratio_l / _r
  - interpupillary_distance
  - intercanthal_distance
  - canthal_tilt_l / _r

Key invariants:
  - perfect_frontal → aperture ≈ 0.30, IPD ≈ 2.0, ICD ≈ 1.0, tilts ≈ 0°
  - All direction labels valid
  - Confidence: both yaw and pitch penalise (EYES_POSE_PARAMS is balanced)
  - to_dict() round-trip includes all required keys
  - Registry wiring
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
)

_IDEAL_APERTURE = 0.30
_IDEAL_IPD      = 2.0
_IDEAL_ICD      = 1.0
_IDEAL_TILT     = 0.0

_APERTURE_IDS = ["eye_aperture_ratio_l", "eye_aperture_ratio_r"]
_ALL_IDS = [
    "eye_aperture_ratio_l",
    "eye_aperture_ratio_r",
    "interpupillary_distance",
    "intercanthal_distance",
    "canthal_tilt_l",
    "canthal_tilt_r",
]


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
def default_ctx():
    return QualityContext()


@pytest.fixture
def yaw_ctx():
    return QualityContext(pose={"yaw": 10.0, "pitch": 0.0})


@pytest.fixture
def pitch_ctx():
    return QualityContext(pose={"yaw": 0.0, "pitch": 10.0})


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_all_eyes_registered(self):
        ids = set(list_metric_ids())
        for mid in _ALL_IDS:
            assert mid in ids, f"'{mid}' not in registry"

    def test_get_each(self):
        for mid in _ALL_IDS:
            assert get(mid) is not None


# ---------------------------------------------------------------------------
# MetricValue contract
# ---------------------------------------------------------------------------

class TestContract:
    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_returns_metric_value(self, metric_id, frontal_nl, default_ctx):
        assert isinstance(get(metric_id).compute(frontal_nl, default_ctx), MetricValue)

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_region_is_eyes(self, metric_id, frontal_nl, default_ctx):
        assert get(metric_id).compute(frontal_nl, default_ctx).region == "eyes"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_family_is_eyes(self, metric_id, frontal_nl, default_ctx):
        assert get(metric_id).compute(frontal_nl, default_ctx).family == "eyes"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_confidence_in_range(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_dep_landmarks_non_empty(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 2


# ---------------------------------------------------------------------------
# eye_aperture_ratio_l / _r
# ---------------------------------------------------------------------------

class TestEyeApertureRatio:
    @pytest.mark.parametrize("metric_id", _APERTURE_IDS)
    def test_perfect_frontal_near_ideal(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert abs(r.value - _IDEAL_APERTURE) < 0.005, (
            f"{metric_id}: expected ≈{_IDEAL_APERTURE}, got {r.value:.4f}"
        )

    @pytest.mark.parametrize("metric_id", _APERTURE_IDS)
    def test_perfect_frontal_direction_neutral(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert r.direction == "neutral"

    @pytest.mark.parametrize("metric_id", _APERTURE_IDS)
    def test_unit_is_ratio(self, metric_id, frontal_nl, default_ctx):
        assert get(metric_id).compute(frontal_nl, default_ctx).unit == "ratio"

    @pytest.mark.parametrize("metric_id", _APERTURE_IDS)
    def test_value_positive(self, metric_id, frontal_nl, default_ctx):
        assert get(metric_id).compute(frontal_nl, default_ctx).value > 0.0

    def test_symmetric_left_equals_right(self, frontal_nl, default_ctx):
        l = get("eye_aperture_ratio_l").compute(frontal_nl, default_ctx).value
        r = get("eye_aperture_ratio_r").compute(frontal_nl, default_ctx).value
        assert abs(l - r) < 1e-9, f"Expected l==r for perfect_frontal, got l={l} r={r}"


# ---------------------------------------------------------------------------
# interpupillary_distance
# ---------------------------------------------------------------------------

class TestIPD:
    def _c(self):
        return get("interpupillary_distance")

    def test_perfect_frontal_near_ideal(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        assert abs(r.value - _IDEAL_IPD) < 0.01, f"Expected ≈2.0 ICU, got {r.value:.4f}"

    def test_perfect_frontal_direction_neutral(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        assert r.direction == "neutral"

    def test_unit_is_intercanthal_units(self, frontal_nl, default_ctx):
        assert self._c().compute(frontal_nl, default_ctx).unit == "intercanthal_units"

    def test_value_positive(self, frontal_nl, default_ctx):
        assert self._c().compute(frontal_nl, default_ctx).value > 0.0


# ---------------------------------------------------------------------------
# intercanthal_distance (sanity check)
# ---------------------------------------------------------------------------

class TestICD:
    def _c(self):
        return get("intercanthal_distance")

    def test_perfect_frontal_is_one(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        assert abs(r.value - _IDEAL_ICD) < 0.01, f"Expected ≈1.0 ICU, got {r.value:.4f}"

    def test_perfect_frontal_direction_neutral(self, frontal_nl, default_ctx):
        assert self._c().compute(frontal_nl, default_ctx).direction == "neutral"

    def test_unit_is_intercanthal_units(self, frontal_nl, default_ctx):
        assert self._c().compute(frontal_nl, default_ctx).unit == "intercanthal_units"

    def test_high_confidence_for_normal_face(self, frontal_nl, default_ctx):
        r = self._c().compute(frontal_nl, default_ctx)
        assert r.confidence_raw > 0.9, f"ICD sanity check should have high conf, got {r.confidence_raw:.3f}"


# ---------------------------------------------------------------------------
# canthal_tilt_l / _r
# ---------------------------------------------------------------------------

class TestCanthalTilt:
    @pytest.mark.parametrize("metric_id", ["canthal_tilt_l", "canthal_tilt_r"])
    def test_perfect_frontal_near_zero(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert abs(r.value) < 0.5, f"{metric_id}: expected ≈0°, got {r.value:.3f}°"

    @pytest.mark.parametrize("metric_id", ["canthal_tilt_l", "canthal_tilt_r"])
    def test_perfect_frontal_direction_neutral(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert r.direction == "neutral"

    @pytest.mark.parametrize("metric_id", ["canthal_tilt_l", "canthal_tilt_r"])
    def test_unit_is_degrees(self, metric_id, frontal_nl, default_ctx):
        assert get(metric_id).compute(frontal_nl, default_ctx).unit == "degrees"

    @pytest.mark.parametrize("metric_id", ["canthal_tilt_l", "canthal_tilt_r"])
    def test_direction_valid(self, metric_id, frontal_nl, default_ctx):
        r = get(metric_id).compute(frontal_nl, default_ctx)
        assert r.direction in {"neutral", "positive_tilt", "negative_tilt"}


# ---------------------------------------------------------------------------
# Confidence propagation
# ---------------------------------------------------------------------------

class TestConfidence:
    def test_quality_score_reduces_confidence(self, frontal_nl):
        ctx_good = QualityContext(quality_score=1.0)
        ctx_bad  = QualityContext(quality_score=0.5)
        calc = get("interpupillary_distance")
        assert calc.compute(frontal_nl, ctx_bad).confidence_final < \
               calc.compute(frontal_nl, ctx_good).confidence_final

    def test_zero_quality_score_yields_zero_confidence(self, frontal_nl):
        ctx = QualityContext(quality_score=0.0)
        for mid in _ALL_IDS:
            r = get(mid).compute(frontal_nl, ctx)
            assert r.confidence_final == 0.0, f"{mid}: expected 0.0, got {r.confidence_final}"

    def test_low_confidence_flag_consistent(self, frontal_nl):
        ctx = QualityContext(quality_score=0.2, regional_penalties={"eyes": 0.5})
        for mid in _ALL_IDS:
            r = get(mid).compute(frontal_nl, ctx)
            assert r.is_low_confidence is (r.confidence_final < LOW_CONF_THRESHOLD)

    def test_yaw_reduces_confidence(self, frontal_nl, yaw_ctx, default_ctx):
        """10° yaw should reduce eye metrics confidence (EYES_POSE_PARAMS yaw_weight=0.6)."""
        r_yaw     = get("eye_aperture_ratio_l").compute(frontal_nl, yaw_ctx)
        r_default = get("eye_aperture_ratio_l").compute(frontal_nl, default_ctx)
        assert r_yaw.confidence_final < r_default.confidence_final

    def test_pitch_reduces_confidence(self, frontal_nl, pitch_ctx, default_ctx):
        """10° pitch should reduce eye metrics confidence (EYES_POSE_PARAMS pitch_weight=0.4)."""
        r_pitch   = get("eye_aperture_ratio_l").compute(frontal_nl, pitch_ctx)
        r_default = get("eye_aperture_ratio_l").compute(frontal_nl, default_ctx)
        assert r_pitch.confidence_final < r_default.confidence_final


# ---------------------------------------------------------------------------
# compute_all integration
# ---------------------------------------------------------------------------

class TestComputeAll:
    def test_compute_all_returns_6_eyes(self, frontal_nl, default_ctx):
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
