"""Tests for services/metrics/mouth.py (PR-15).

Covers all 7 mouth metrics:
  - mouth_width_to_icd
  - mouth_to_face_width_ratio
  - upper_lip_height_ratio
  - lower_lip_height_ratio
  - vermilion_height_total
  - lip_corner_canting
  - mouth_midline_deviation

Key invariants:
  - perfect_mouth_face → all metrics within green range (or at ideal)
  - deviated_mouth_face → corner canting + midline shift rise above 0
  - All direction labels valid
  - Confidence: yaw penalises more than pitch (MOUTH_POSE_PARAMS yaw_weight=0.6)
  - Registry wiring
"""

from __future__ import annotations

import pytest

import app.services.metrics  # noqa: F401 — trigger @register
from app.domain.metric_value import MetricValue
from app.services.metrics.base import QualityContext
from app.services.metrics.confidence_propagation import LOW_CONF_THRESHOLD
from app.services.metrics.registry import get, list_metric_ids
from app.services.normalization import normalize
from tests.fixtures.synthetic_landmarks import (
    deviated_mouth_face,
    perfect_mouth_face,
)

_ALL_IDS = [
    "mouth_width_to_icd",
    "mouth_to_face_width_ratio",
    "upper_lip_height_ratio",
    "lower_lip_height_ratio",
    "vermilion_height_total",
    "lip_corner_canting",
    "mouth_midline_deviation",
]


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def perfect_nl():
    return normalize(perfect_mouth_face())


@pytest.fixture
def deviated_nl():
    return normalize(deviated_mouth_face())


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
    def test_all_mouth_registered(self):
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
    def test_returns_metric_value(self, metric_id, perfect_nl, default_ctx):
        assert isinstance(get(metric_id).compute(perfect_nl, default_ctx), MetricValue)

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_region_is_mouth(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).region == "mouth"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_family_is_mouth(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).family == "mouth"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_confidence_in_range(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_dep_landmarks_non_empty(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 1


# ---------------------------------------------------------------------------
# Canonical values on perfect_mouth_face
# ---------------------------------------------------------------------------

class TestPerfectMouth:
    def test_mouth_width_to_icd(self, perfect_nl, default_ctx):
        r = get("mouth_width_to_icd").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(1.50, abs=0.02)
        assert r.direction == "neutral"

    def test_mouth_to_face_width_ratio(self, perfect_nl, default_ctx):
        r = get("mouth_to_face_width_ratio").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.30, abs=0.01)
        assert r.direction == "neutral"

    def test_upper_lip_height_ratio(self, perfect_nl, default_ctx):
        r = get("upper_lip_height_ratio").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.40, abs=0.02)
        assert r.direction == "neutral"

    def test_lower_lip_height_ratio(self, perfect_nl, default_ctx):
        r = get("lower_lip_height_ratio").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.60, abs=0.02)
        assert r.direction == "neutral"

    def test_vermilion_height_total(self, perfect_nl, default_ctx):
        r = get("vermilion_height_total").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.55, abs=0.02)
        assert r.direction == "neutral"

    def test_lip_corner_canting_zero(self, perfect_nl, default_ctx):
        r = get("lip_corner_canting").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.0, abs=0.01)
        assert r.direction == "neutral"

    def test_mouth_midline_deviation_zero(self, perfect_nl, default_ctx):
        r = get("mouth_midline_deviation").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.0, abs=0.01)
        assert r.direction == "neutral"

    def test_upper_plus_lower_equals_one(self, perfect_nl, default_ctx):
        u = get("upper_lip_height_ratio").compute(perfect_nl, default_ctx).value
        l = get("lower_lip_height_ratio").compute(perfect_nl, default_ctx).value
        assert u + l == pytest.approx(1.0, abs=1e-6)


# ---------------------------------------------------------------------------
# Deviated fixture (left corner +12 px down, both corners +10 px right)
# ---------------------------------------------------------------------------

class TestDeviatedMouth:
    def test_lip_corner_canting_increases(self, deviated_nl, default_ctx):
        r = get("lip_corner_canting").compute(deviated_nl, default_ctx)
        # 12 px = 0.12 ICU. Above green ±0.03.
        assert r.value > 0.05
        assert r.direction in ("left_corner_low", "right_corner_low")

    def test_mouth_midline_deviation_increases(self, deviated_nl, default_ctx):
        r = get("mouth_midline_deviation").compute(deviated_nl, default_ctx)
        # 10 px = 0.10 ICU. Above green ±0.03.
        assert r.value > 0.05
        assert r.direction in ("mouth_left", "mouth_right")

    def test_vermilion_height_unchanged(self, deviated_nl, default_ctx):
        # Mid-line lip points unchanged → vermilion height unchanged.
        r = get("vermilion_height_total").compute(deviated_nl, default_ctx)
        assert r.value == pytest.approx(0.55, abs=0.02)

    def test_upper_lip_ratio_unchanged(self, deviated_nl, default_ctx):
        r = get("upper_lip_height_ratio").compute(deviated_nl, default_ctx)
        assert r.value == pytest.approx(0.40, abs=0.02)


# ---------------------------------------------------------------------------
# Confidence propagation
# ---------------------------------------------------------------------------

class TestConfidence:
    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_yaw_penalises(self, metric_id, perfect_nl, default_ctx, yaw_ctx):
        c0 = get(metric_id).compute(perfect_nl, default_ctx).confidence_final
        c1 = get(metric_id).compute(perfect_nl, yaw_ctx).confidence_final
        assert c1 < c0, f"{metric_id}: yaw 10° did not reduce confidence"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_pitch_penalises_less_than_yaw(self, metric_id, perfect_nl, yaw_ctx, pitch_ctx):
        # MOUTH_POSE_PARAMS: yaw_weight=0.6 vs pitch_weight=0.4 → yaw dominates.
        c_yaw = get(metric_id).compute(perfect_nl, yaw_ctx).confidence_final
        c_pitch = get(metric_id).compute(perfect_nl, pitch_ctx).confidence_final
        assert c_pitch >= c_yaw - 1e-6, (
            f"{metric_id}: pitch should not penalise more than yaw "
            f"(pitch={c_pitch}, yaw={c_yaw})"
        )

    def test_low_confidence_flag(self, perfect_nl):
        bad_ctx = QualityContext(quality_score=0.3, pose={"yaw": 20.0, "pitch": 0.0})
        r = get("mouth_width_to_icd").compute(perfect_nl, bad_ctx)
        assert r.is_low_confidence is True
        assert r.confidence_final < LOW_CONF_THRESHOLD
