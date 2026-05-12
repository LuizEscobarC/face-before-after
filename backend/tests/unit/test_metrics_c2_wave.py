"""Tests for PR-C2 Wave 2 new metric calculators (10 metrics).

Covers registration, MetricValue contract, unit, direction, and basic
numeric behaviour for all 10 C2 metrics.

Synthetic geometry (perfect_frontal): see synthetic_landmarks.py — values
target the canonical ideal of each metric:

  alar_flare_index               = 1.000  (alar width = ICD)
  cupids_bow_definition          ≈ 0.04   (5px depth / 120px mouth)
  lip_volume_ratio               ≈ 0.57   (8/14 upper:lower vermilion)
  oral_commissure_height_asym    = 0.000  (perfectly level)
  philtrum_width_ratio           = 0.300  (36/120)
  smile_line_curvature           ≈ 0.083  (10/120)
  chin_projection_proxy          = 0.350  (140/400 lower-third)
  mandibular_corpus_length_ratio ≈ 0.243  (mean corpus / bizyg)
  masseteric_prominence_proxy    = 0.520  (260/500)

  nasolabial_angle_proxy         STUB (requires_pixel_analysis=True)
"""

from __future__ import annotations

import pytest

import app.services.metrics  # noqa: F401  — trigger @register side effects
from app.domain.metric_value import MetricValue
from app.services.metrics.base import QualityContext
from app.services.metrics.confidence_propagation import LOW_CONF_THRESHOLD
from app.services.metrics.registry import get, list_metric_ids
from app.services.normalization import normalize
from tests.fixtures.synthetic_landmarks import perfect_frontal

# ---------------------------------------------------------------------------
# All 10 C2 metric IDs
# ---------------------------------------------------------------------------
_C2_IDS = [
    "nasolabial_angle_proxy",
    "alar_flare_index",
    "cupids_bow_definition",
    "lip_volume_ratio",
    "oral_commissure_height_asym",
    "philtrum_width_ratio",
    "smile_line_curvature",
    "chin_projection_proxy",
    "mandibular_corpus_length_ratio",
    "masseteric_prominence_proxy",
]

_STUB_IDS = ["nasolabial_angle_proxy"]
_LANDMARK_IDS = [m for m in _C2_IDS if m not in _STUB_IDS]

_EXPECTED_UNITS = {
    "nasolabial_angle_proxy":          "degrees",
    "alar_flare_index":                "intercanthal_units",
    "cupids_bow_definition":           "index_0_1",
    "lip_volume_ratio":                "ratio",
    "oral_commissure_height_asym":     "intercanthal_units",
    "philtrum_width_ratio":            "ratio",
    "smile_line_curvature":            "index_0_1",
    "chin_projection_proxy":           "ratio",
    "mandibular_corpus_length_ratio":  "ratio",
    "masseteric_prominence_proxy":     "ratio",
}

_EXPECTED_REGIONS = {
    "nasolabial_angle_proxy":          "nose",
    "alar_flare_index":                "nose",
    "cupids_bow_definition":           "mouth",
    "lip_volume_ratio":                "mouth",
    "oral_commissure_height_asym":     "mouth",
    "philtrum_width_ratio":            "mouth",
    "smile_line_curvature":            "mouth",
    "chin_projection_proxy":           "jaw",
    "mandibular_corpus_length_ratio":  "jaw",
    "masseteric_prominence_proxy":     "jaw",
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
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_all_c2_ids_in_registry(self):
        ids = list_metric_ids()
        for mid in _C2_IDS:
            assert mid in ids, f"'{mid}' missing from registry"

    def test_get_each_returns_non_none(self):
        for mid in _C2_IDS:
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
# MetricValue contract
# ---------------------------------------------------------------------------

class TestContract:
    @pytest.mark.parametrize("metric_id", _C2_IDS)
    def test_returns_metric_value(self, metric_id, perfect_nl, default_ctx):
        result = get(metric_id).compute(perfect_nl, default_ctx)
        assert isinstance(result, MetricValue)

    @pytest.mark.parametrize("metric_id", _C2_IDS)
    def test_correct_unit(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.unit == _EXPECTED_UNITS[metric_id]

    @pytest.mark.parametrize("metric_id", _C2_IDS)
    def test_correct_region(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.region == _EXPECTED_REGIONS[metric_id]

    @pytest.mark.parametrize("metric_id", _C2_IDS)
    def test_metric_id_preserved(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.metric_id == metric_id

    @pytest.mark.parametrize("metric_id", _C2_IDS)
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
# Behavioural — alar_flare_index
# ---------------------------------------------------------------------------

class TestAlarFlareIndex:
    def test_value_near_one_for_canonical(self, perfect_nl, default_ctx):
        r = get("alar_flare_index").compute(perfect_nl, default_ctx)
        assert abs(r.value - 1.0) < 0.05  # alar width = 1 ICD by construction

    def test_high_confidence_for_canonical(self, perfect_nl, default_ctx):
        r = get("alar_flare_index").compute(perfect_nl, default_ctx)
        assert r.confidence_raw > 0.8

    def test_direction_neutral(self, perfect_nl, default_ctx):
        r = get("alar_flare_index").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"


# ---------------------------------------------------------------------------
# Behavioural — cupids_bow_definition
# ---------------------------------------------------------------------------

class TestCupidsBowDefinition:
    def test_value_in_index_range(self, perfect_nl, default_ctx):
        r = get("cupids_bow_definition").compute(perfect_nl, default_ctx)
        assert 0.0 <= r.value < 0.5

    def test_canonical_close_to_ideal(self, perfect_nl, default_ctx):
        r = get("cupids_bow_definition").compute(perfect_nl, default_ctx)
        assert abs(r.value - 0.05) < 0.05

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("cupids_bow_definition").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "prominent_bow", "flat_bow")


# ---------------------------------------------------------------------------
# Behavioural — lip_volume_ratio
# ---------------------------------------------------------------------------

class TestLipVolumeRatio:
    def test_value_positive(self, perfect_nl, default_ctx):
        r = get("lip_volume_ratio").compute(perfect_nl, default_ctx)
        assert r.value > 0

    def test_canonical_below_one(self, perfect_nl, default_ctx):
        r = get("lip_volume_ratio").compute(perfect_nl, default_ctx)
        # Naini U:L ≈ 1:1.6 → ratio < 1
        assert r.value < 1.0

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("lip_volume_ratio").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "upper_dominant", "lower_dominant")


# ---------------------------------------------------------------------------
# Behavioural — oral_commissure_height_asym
# ---------------------------------------------------------------------------

class TestOralCommissureHeightAsym:
    def test_perfect_frontal_zero_asym(self, perfect_nl, default_ctx):
        r = get("oral_commissure_height_asym").compute(perfect_nl, default_ctx)
        assert abs(r.value) < 0.005

    def test_neutral_direction(self, perfect_nl, default_ctx):
        r = get("oral_commissure_height_asym").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"


# ---------------------------------------------------------------------------
# Behavioural — philtrum_width_ratio
# ---------------------------------------------------------------------------

class TestPhiltrumWidthRatio:
    def test_canonical_near_naini_ideal(self, perfect_nl, default_ctx):
        r = get("philtrum_width_ratio").compute(perfect_nl, default_ctx)
        assert abs(r.value - 0.30) < 0.05

    def test_direction_neutral(self, perfect_nl, default_ctx):
        r = get("philtrum_width_ratio").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"


# ---------------------------------------------------------------------------
# Behavioural — smile_line_curvature
# ---------------------------------------------------------------------------

class TestSmileLineCurvature:
    def test_value_in_index_range(self, perfect_nl, default_ctx):
        r = get("smile_line_curvature").compute(perfect_nl, default_ctx)
        assert 0.0 <= r.value < 0.5

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("smile_line_curvature").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "arched_lip", "flat_lip")


# ---------------------------------------------------------------------------
# Behavioural — chin_projection_proxy
# ---------------------------------------------------------------------------

class TestChinProjectionProxy:
    def test_canonical_lower_third(self, perfect_nl, default_ctx):
        r = get("chin_projection_proxy").compute(perfect_nl, default_ctx)
        # Lower third should be ~1/3 of total face height
        assert 0.25 < r.value < 0.45

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("chin_projection_proxy").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "long_chin", "short_chin")


# ---------------------------------------------------------------------------
# Behavioural — mandibular_corpus_length_ratio
# ---------------------------------------------------------------------------

class TestMandibularCorpusLengthRatio:
    def test_value_positive(self, perfect_nl, default_ctx):
        r = get("mandibular_corpus_length_ratio").compute(perfect_nl, default_ctx)
        assert r.value > 0

    def test_canonical_in_range(self, perfect_nl, default_ctx):
        r = get("mandibular_corpus_length_ratio").compute(perfect_nl, default_ctx)
        assert 0.15 < r.value < 0.45

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("mandibular_corpus_length_ratio").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "long_corpus", "short_corpus")


# ---------------------------------------------------------------------------
# Behavioural — masseteric_prominence_proxy
# ---------------------------------------------------------------------------

class TestMasstericProminenceProxy:
    def test_canonical_near_ideal(self, perfect_nl, default_ctx):
        r = get("masseteric_prominence_proxy").compute(perfect_nl, default_ctx)
        assert abs(r.value - 0.55) < 0.10

    def test_direction_valid(self, perfect_nl, default_ctx):
        r = get("masseteric_prominence_proxy").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "wide_masseter", "narrow_masseter")
