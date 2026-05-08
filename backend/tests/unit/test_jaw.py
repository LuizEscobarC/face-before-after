"""Tests for services/metrics/jaw.py (PR-13).

Covers all 6 jaw metrics:
  - jaw_width_ratio
  - gonial_angle_l / _r
  - gonial_angle_asymmetry
  - mandibular_plane_angle
  - chin_height_ratio

Key invariants:
  - perfect_jaw_face → all metrics within green range
  - asymmetric_jaw_face → gonial_angle_asymmetry rises clearly above 0
  - All direction labels valid
  - Confidence: yaw penalises strongly (JAW_POSE_PARAMS yaw_weight=0.8)
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
    asymmetric_jaw_face,
    perfect_jaw_face,
)

_ALL_IDS = [
    "jaw_width_ratio",
    "gonial_angle_l",
    "gonial_angle_r",
    "gonial_angle_asymmetry",
    "mandibular_plane_angle",
    "chin_height_ratio",
]


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def perfect_nl():
    return normalize(perfect_jaw_face())


@pytest.fixture
def asym_nl():
    return normalize(asymmetric_jaw_face())


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
    def test_all_jaw_registered(self):
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
    def test_region_is_jaw(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).region == "jaw"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_family_is_jaw(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).family == "jaw"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_confidence_in_range(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_dep_landmarks_non_empty(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 2


# ---------------------------------------------------------------------------
# Canonical values on perfect_jaw_face
# ---------------------------------------------------------------------------

class TestPerfectJaw:
    def test_jaw_width_ratio(self, perfect_nl, default_ctx):
        r = get("jaw_width_ratio").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.80, abs=0.02)
        assert r.direction == "neutral"

    def test_gonial_angle_l(self, perfect_nl, default_ctx):
        r = get("gonial_angle_l").compute(perfect_nl, default_ctx)
        # Geometry yields ~129°; ideal 125°, green ±5° → still neutral.
        assert r.value == pytest.approx(129.0, abs=2.0)
        assert r.direction == "neutral"

    def test_gonial_angle_r(self, perfect_nl, default_ctx):
        r = get("gonial_angle_r").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(129.0, abs=2.0)
        assert r.direction == "neutral"

    def test_gonial_asymmetry_zero(self, perfect_nl, default_ctx):
        r = get("gonial_angle_asymmetry").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.0, abs=0.5)
        assert r.direction == "neutral"

    def test_mandibular_plane_angle(self, perfect_nl, default_ctx):
        r = get("mandibular_plane_angle").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(26.57, abs=1.0)
        assert r.direction == "neutral"

    def test_chin_height_ratio(self, perfect_nl, default_ctx):
        r = get("chin_height_ratio").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.50, abs=0.02)
        assert r.direction == "neutral"


# ---------------------------------------------------------------------------
# Asymmetric fixture
# ---------------------------------------------------------------------------

class TestAsymmetricJaw:
    def test_gonial_asymmetry_increases(self, asym_nl, default_ctx):
        r = get("gonial_angle_asymmetry").compute(asym_nl, default_ctx)
        # Right gonion shifted up by 30 px → noticeable asymmetry (>3°, < extreme).
        assert r.value > 3.0
        assert r.direction in ("left_dominant", "right_dominant")

    def test_jaw_width_ratio_unchanged(self, asym_nl, default_ctx):
        # Y-shift of one gonion preserves bigonial horizontal distance ⇒ ratio holds.
        r = get("jaw_width_ratio").compute(asym_nl, default_ctx)
        assert r.value == pytest.approx(0.80, abs=0.02)


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
        # JAW_POSE_PARAMS: yaw_weight=0.8 vs pitch_weight=0.2 → yaw dominates.
        c_yaw = get(metric_id).compute(perfect_nl, yaw_ctx).confidence_final
        c_pitch = get(metric_id).compute(perfect_nl, pitch_ctx).confidence_final
        assert c_pitch >= c_yaw - 1e-6, (
            f"{metric_id}: pitch should not penalise more than yaw "
            f"(pitch={c_pitch}, yaw={c_yaw})"
        )

    def test_low_confidence_flag(self, perfect_nl):
        bad_ctx = QualityContext(quality_score=0.3, pose={"yaw": 20.0, "pitch": 0.0})
        r = get("jaw_width_ratio").compute(perfect_nl, bad_ctx)
        assert r.is_low_confidence is True
        assert r.confidence_final < LOW_CONF_THRESHOLD
