"""Tests for services/metrics/nose.py (PR-14).

Covers all 7 nose metrics:
  - nose_length_to_icd
  - nose_width_to_icd
  - alar_to_face_width_ratio
  - nose_to_mouth_width_ratio
  - dorsum_deviation
  - nasal_tip_deviation
  - alar_base_asymmetry

Key invariants:
  - perfect_nose_face → all metrics within green range (or at ideal)
  - deviated_nose_face → dorsum_deviation + nasal_tip_deviation rise above 0
  - All direction labels valid
  - Confidence: yaw penalises more than pitch (NOSE_POSE_PARAMS yaw_weight=0.7)
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
    deviated_nose_face,
    perfect_nose_face,
)

_ALL_IDS = [
    "nose_length_to_icd",
    "nose_width_to_icd",
    "alar_to_face_width_ratio",
    "nose_to_mouth_width_ratio",
    "dorsum_deviation",
    "nasal_tip_deviation",
    "alar_base_asymmetry",
]


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def perfect_nl():
    return normalize(perfect_nose_face())


@pytest.fixture
def deviated_nl():
    return normalize(deviated_nose_face())


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
    def test_all_nose_registered(self):
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
    def test_region_is_nose(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).region == "nose"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_family_is_nose(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).family == "nose"

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
# Canonical values on perfect_nose_face
# ---------------------------------------------------------------------------

class TestPerfectNose:
    def test_nose_length_to_icd(self, perfect_nl, default_ctx):
        r = get("nose_length_to_icd").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(1.50, abs=0.02)
        assert r.direction == "neutral"

    def test_nose_width_to_icd(self, perfect_nl, default_ctx):
        r = get("nose_width_to_icd").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(1.00, abs=0.02)
        assert r.direction == "neutral"

    def test_alar_to_face_width_ratio(self, perfect_nl, default_ctx):
        r = get("alar_to_face_width_ratio").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.20, abs=0.01)
        assert r.direction == "neutral"

    def test_nose_to_mouth_width_ratio(self, perfect_nl, default_ctx):
        r = get("nose_to_mouth_width_ratio").compute(perfect_nl, default_ctx)
        # alar=100/mouth=154 = 0.6494; ideal 0.65 (well within green ±0.08).
        assert r.value == pytest.approx(0.65, abs=0.02)
        assert r.direction == "neutral"

    def test_dorsum_deviation_zero(self, perfect_nl, default_ctx):
        r = get("dorsum_deviation").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.0, abs=0.01)
        assert r.direction == "neutral"

    def test_nasal_tip_deviation_zero(self, perfect_nl, default_ctx):
        r = get("nasal_tip_deviation").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.0, abs=0.01)
        assert r.direction == "neutral"

    def test_alar_base_asymmetry_zero(self, perfect_nl, default_ctx):
        r = get("alar_base_asymmetry").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.0, abs=0.01)
        assert r.direction == "neutral"


# ---------------------------------------------------------------------------
# Deviated fixture (tip shifted +12 px)
# ---------------------------------------------------------------------------

class TestDeviatedNose:
    def test_dorsum_deviation_increases(self, deviated_nl, default_ctx):
        r = get("dorsum_deviation").compute(deviated_nl, default_ctx)
        # tip shifted 12 px (=0.12 ICU) right vs nasion (0). Above green ±0.03.
        assert r.value > 0.05
        assert r.direction in ("deviated_left", "deviated_right")

    def test_nasal_tip_deviation_increases(self, deviated_nl, default_ctx):
        r = get("nasal_tip_deviation").compute(deviated_nl, default_ctx)
        assert r.value > 0.05
        assert r.direction in ("tip_left", "tip_right")

    def test_nose_width_unchanged(self, deviated_nl, default_ctx):
        # X-shift of nose tip preserves alar width.
        r = get("nose_width_to_icd").compute(deviated_nl, default_ctx)
        assert r.value == pytest.approx(1.00, abs=0.02)

    def test_alar_base_asymmetry_unchanged(self, deviated_nl, default_ctx):
        # Tip x-shift does not change alar y coordinates.
        r = get("alar_base_asymmetry").compute(deviated_nl, default_ctx)
        assert r.value == pytest.approx(0.0, abs=0.01)


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
        # NOSE_POSE_PARAMS: yaw_weight=0.7 vs pitch_weight=0.3 → yaw dominates.
        c_yaw = get(metric_id).compute(perfect_nl, yaw_ctx).confidence_final
        c_pitch = get(metric_id).compute(perfect_nl, pitch_ctx).confidence_final
        assert c_pitch >= c_yaw - 1e-6, (
            f"{metric_id}: pitch should not penalise more than yaw "
            f"(pitch={c_pitch}, yaw={c_yaw})"
        )

    def test_low_confidence_flag(self, perfect_nl):
        bad_ctx = QualityContext(quality_score=0.3, pose={"yaw": 20.0, "pitch": 0.0})
        r = get("nose_width_to_icd").compute(perfect_nl, bad_ctx)
        assert r.is_low_confidence is True
        assert r.confidence_final < LOW_CONF_THRESHOLD
