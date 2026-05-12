"""Tests for PR-C3 Wave 3 new metric calculators (10 metrics).

Covers registration, MetricValue contract, units, directions, and basic
numeric behaviour for the 10 C3 metrics.

Synthetic geometry (perfect_frontal) — expected values:
  mentolabial_fold_proxy           = 0.400  (=ideal)
  brow_arch_peak_position_l        ≈ 0.485 (close to 0.5 ideal)
  brow_arch_peak_position_r        ≈ 0.485
  intersuperciliary_distance_ratio = 1.040
  buccal_fat_index                 ≈ 0.444 (close to 0.45 ideal)
  infraorbital_hollow_index        = 0.100
  glabella_prominence_proxy        = 0.520
  facial_index_anthropometric      = 80.000

  ogee_curve_proxy        STUB (requires_pixel_analysis=True)
  forehead_slope_proxy    STUB (requires_pixel_analysis=True)
"""

from __future__ import annotations

import pytest

import app.services.metrics  # noqa: F401  — trigger @register
from app.domain.metric_value import MetricValue
from app.services.metrics.base import QualityContext
from app.services.metrics.registry import get, list_metric_ids
from app.services.normalization import normalize
from tests.fixtures.synthetic_landmarks import perfect_frontal

_C3_IDS = [
    "mentolabial_fold_proxy",
    "brow_arch_peak_position_l",
    "brow_arch_peak_position_r",
    "intersuperciliary_distance_ratio",
    "buccal_fat_index",
    "ogee_curve_proxy",
    "infraorbital_hollow_index",
    "forehead_slope_proxy",
    "glabella_prominence_proxy",
    "facial_index_anthropometric",
]

_STUB_IDS = ["ogee_curve_proxy", "forehead_slope_proxy"]
_LANDMARK_IDS = [m for m in _C3_IDS if m not in _STUB_IDS]

_EXPECTED_UNITS = {
    "mentolabial_fold_proxy":            "intercanthal_units",
    "brow_arch_peak_position_l":         "index_0_1",
    "brow_arch_peak_position_r":         "index_0_1",
    "intersuperciliary_distance_ratio":  "ratio",
    "buccal_fat_index":                  "index_0_1",
    "ogee_curve_proxy":                  "index_0_1",
    "infraorbital_hollow_index":         "intercanthal_units",
    "forehead_slope_proxy":              "degrees",
    "glabella_prominence_proxy":         "intercanthal_units",
    "facial_index_anthropometric":       "ratio",
}

_EXPECTED_REGIONS = {
    "mentolabial_fold_proxy":            "jaw",
    "brow_arch_peak_position_l":         "brows",
    "brow_arch_peak_position_r":         "brows",
    "intersuperciliary_distance_ratio":  "brows",
    "buccal_fat_index":                  "cheekbones",
    "ogee_curve_proxy":                  "cheekbones",
    "infraorbital_hollow_index":         "cheekbones",
    "forehead_slope_proxy":              "forehead",
    "glabella_prominence_proxy":         "forehead",
    "facial_index_anthropometric":       "global",
}


@pytest.fixture(scope="module")
def perfect_nl():
    return normalize(perfect_frontal())


@pytest.fixture(scope="module")
def default_ctx():
    return QualityContext()


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_all_c3_ids_in_registry(self):
        ids = list_metric_ids()
        for mid in _C3_IDS:
            assert mid in ids, f"'{mid}' missing from registry"

    def test_get_each_returns_non_none(self):
        for mid in _C3_IDS:
            assert get(mid) is not None

    def test_stubs_have_requires_pixel_analysis(self):
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
# Contract
# ---------------------------------------------------------------------------

class TestContract:
    @pytest.mark.parametrize("metric_id", _C3_IDS)
    def test_returns_metric_value(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert isinstance(r, MetricValue)

    @pytest.mark.parametrize("metric_id", _C3_IDS)
    def test_correct_unit(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.unit == _EXPECTED_UNITS[metric_id]

    @pytest.mark.parametrize("metric_id", _C3_IDS)
    def test_correct_region(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.region == _EXPECTED_REGIONS[metric_id]

    @pytest.mark.parametrize("metric_id", _C3_IDS)
    def test_metric_id_preserved(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.metric_id == metric_id

    @pytest.mark.parametrize("metric_id", _C3_IDS)
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
        assert len(r.dependency_landmarks) >= 2

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
# Behavioural — mentolabial_fold_proxy
# ---------------------------------------------------------------------------

class TestMentolabialFoldProxy:
    def test_value_at_canonical_ideal(self, perfect_nl, default_ctx):
        r = get("mentolabial_fold_proxy").compute(perfect_nl, default_ctx)
        assert abs(r.value - 0.40) < 0.05

    def test_high_confidence(self, perfect_nl, default_ctx):
        r = get("mentolabial_fold_proxy").compute(perfect_nl, default_ctx)
        assert r.confidence_raw > 0.8

    def test_direction_neutral(self, perfect_nl, default_ctx):
        r = get("mentolabial_fold_proxy").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"


# ---------------------------------------------------------------------------
# Behavioural — brow_arch_peak_position_l/r
# ---------------------------------------------------------------------------

class TestBrowArchPeakPositionL:
    def test_value_in_unit_range(self, perfect_nl, default_ctx):
        r = get("brow_arch_peak_position_l").compute(perfect_nl, default_ctx)
        assert 0.0 <= r.value <= 1.0

    def test_canonical_near_midpoint(self, perfect_nl, default_ctx):
        r = get("brow_arch_peak_position_l").compute(perfect_nl, default_ctx)
        # Synthetic brow has peak near centre of inner-outer chord
        assert abs(r.value - 0.5) < 0.15

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("brow_arch_peak_position_l").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "outer_peak", "inner_peak")


class TestBrowArchPeakPositionR:
    def test_value_in_unit_range(self, perfect_nl, default_ctx):
        r = get("brow_arch_peak_position_r").compute(perfect_nl, default_ctx)
        assert 0.0 <= r.value <= 1.0

    def test_canonical_near_midpoint(self, perfect_nl, default_ctx):
        r = get("brow_arch_peak_position_r").compute(perfect_nl, default_ctx)
        assert abs(r.value - 0.5) < 0.15

    def test_mirrors_left_value(self, perfect_nl, default_ctx):
        l = get("brow_arch_peak_position_l").compute(perfect_nl, default_ctx)
        r = get("brow_arch_peak_position_r").compute(perfect_nl, default_ctx)
        # Symmetric synthetic geometry → both sides should match closely
        assert abs(l.value - r.value) < 0.05


# ---------------------------------------------------------------------------
# Behavioural — intersuperciliary_distance_ratio
# ---------------------------------------------------------------------------

class TestIntersuperciliaryDistanceRatio:
    def test_canonical_near_one_icd(self, perfect_nl, default_ctx):
        r = get("intersuperciliary_distance_ratio").compute(perfect_nl, default_ctx)
        # Naini ideal: brow inners ≈ 1 ICD apart; tolerate ±0.2
        assert abs(r.value - 1.0) < 0.20

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("intersuperciliary_distance_ratio").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "wide_set_brows", "close_set_brows")


# ---------------------------------------------------------------------------
# Behavioural — buccal_fat_index
# ---------------------------------------------------------------------------

class TestBuccalFatIndex:
    def test_value_in_unit_range(self, perfect_nl, default_ctx):
        r = get("buccal_fat_index").compute(perfect_nl, default_ctx)
        assert 0.0 <= r.value <= 1.0

    def test_canonical_near_ideal(self, perfect_nl, default_ctx):
        r = get("buccal_fat_index").compute(perfect_nl, default_ctx)
        assert abs(r.value - 0.45) < 0.10

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("buccal_fat_index").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "low_cheek_fat", "high_cheek_fat")


# ---------------------------------------------------------------------------
# Behavioural — infraorbital_hollow_index
# ---------------------------------------------------------------------------

class TestInfraorbitalHollowIndex:
    def test_value_non_negative(self, perfect_nl, default_ctx):
        r = get("infraorbital_hollow_index").compute(perfect_nl, default_ctx)
        assert r.value >= 0.0

    def test_canonical_in_healthy_range(self, perfect_nl, default_ctx):
        r = get("infraorbital_hollow_index").compute(perfect_nl, default_ctx)
        assert 0.0 < r.value < 0.20

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("infraorbital_hollow_index").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "deep_hollow", "shallow_hollow")


# ---------------------------------------------------------------------------
# Behavioural — glabella_prominence_proxy
# ---------------------------------------------------------------------------

class TestGlabellaProminenceProxy:
    def test_canonical_near_ideal(self, perfect_nl, default_ctx):
        r = get("glabella_prominence_proxy").compute(perfect_nl, default_ctx)
        assert abs(r.value - 0.50) < 0.10

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("glabella_prominence_proxy").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "broad_glabella", "narrow_glabella")


# ---------------------------------------------------------------------------
# Behavioural — facial_index_anthropometric
# ---------------------------------------------------------------------------

class TestFacialIndexAnthropometric:
    def test_value_positive(self, perfect_nl, default_ctx):
        r = get("facial_index_anthropometric").compute(perfect_nl, default_ctx)
        assert r.value > 0

    def test_canonical_in_realistic_range(self, perfect_nl, default_ctx):
        r = get("facial_index_anthropometric").compute(perfect_nl, default_ctx)
        # Anthropometric range covers euryprosopic to leptoprosopic
        assert 70.0 < r.value < 110.0

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("facial_index_anthropometric").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "long_face", "wide_face")
