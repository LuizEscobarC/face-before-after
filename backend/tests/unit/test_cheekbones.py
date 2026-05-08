"""Tests for services/metrics/cheekbones.py (PR-17).

Covers all 5 cheekbone / midface metrics:
  - zygomatic_width_ratio
  - malar_projection_index
  - midface_height_ratio
  - cheekbone_to_jaw_ratio
  - submalar_hollow_index

Key invariants:
  - perfect_cheekbone_face → all metrics at or near ideal, conf_raw > 0.97
  - square_jaw_cheekbone_face → cheekbone_to_jaw_ratio < 1.0, direction = 'square_jaw'
  - All 5 metrics are non-presentation_only (no DEC-6 exception in this family)
  - Confidence: yaw penalises more than pitch (CHEEKBONE_POSE_PARAMS yaw_weight=0.75)
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
    perfect_cheekbone_face,
    perfect_frontal,
    square_jaw_cheekbone_face,
)

_ALL_IDS = [
    "zygomatic_width_ratio",
    "malar_projection_index",
    "midface_height_ratio",
    "cheekbone_to_jaw_ratio",
    "submalar_hollow_index",
]


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def perfect_nl():
    return normalize(perfect_cheekbone_face())


@pytest.fixture
def square_jaw_nl():
    return normalize(square_jaw_cheekbone_face())


@pytest.fixture
def frontal_nl():
    return normalize(perfect_frontal())


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
    def test_all_cheekbone_ids_registered(self):
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
    def test_region_is_cheekbones(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).region == "cheekbones"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_family_is_cheekbones(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).family == "cheekbones"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_confidence_in_range(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_dep_landmarks_non_empty(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 2

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_direction_is_string(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert isinstance(r.direction, str)
        assert len(r.direction) > 0

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_not_presentation_only(self, metric_id, perfect_nl, default_ctx):
        """All cheekbone metrics enter the regional score (no DEC-6 exception)."""
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.presentation_only is False, (
            f"{metric_id} must not be presentation_only (no exception in cheekbones family)"
        )

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_class_not_presentation_only(self, metric_id):
        calc = get(metric_id)
        assert calc.presentation_only is False


# ---------------------------------------------------------------------------
# Canonical values on perfect_cheekbone_face
# ---------------------------------------------------------------------------

class TestPerfectCheekbones:
    """Verify that perfect_cheekbone_face() yields the expected ideal values.

    Pixel geometry (ICD=100 px, origin at inner canthi midpoint):
      P_LEFT_ZYGOMATIC  at (200, 300) → x = −2.0 ICU
      P_RIGHT_ZYGOMATIC at (600, 300) → x = +2.0 ICU → bizygomatic = 4.0 ICU
      P_LEFT_GONION     at (240, 480) → bigonial = 3.2 ICU → CBJ = 1.25
      P_LEFT_EYE_OUTER  at (250, 300) → biocular = 3.0 ICU → malar = 1.333
      P_SUBNASALE       at (400, 450) → y=+1.5 ICU → midface_height = 1.50
      P_LEFT_CHEEK      at (220, 400) → bicheek = 3.6 ICU → submalar = 0.10
    """

    def test_zygomatic_width_ratio_value(self, perfect_nl, default_ctx):
        r = get("zygomatic_width_ratio").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(4.00, abs=0.02)

    def test_zygomatic_width_ratio_direction_neutral(self, perfect_nl, default_ctx):
        r = get("zygomatic_width_ratio").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_zygomatic_width_ratio_high_confidence(self, perfect_nl, default_ctx):
        r = get("zygomatic_width_ratio").compute(perfect_nl, default_ctx)
        assert r.confidence_raw == pytest.approx(1.0, abs=0.02)
        assert not r.is_low_confidence

    def test_malar_projection_index_value(self, perfect_nl, default_ctx):
        r = get("malar_projection_index").compute(perfect_nl, default_ctx)
        # bizygomatic=4.0 / biocular=3.0 = 1.333; ideal=1.33 → conf_raw > 0.99
        assert r.value == pytest.approx(1.333, abs=0.01)

    def test_malar_projection_index_direction_neutral(self, perfect_nl, default_ctx):
        r = get("malar_projection_index").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_malar_projection_index_high_confidence(self, perfect_nl, default_ctx):
        r = get("malar_projection_index").compute(perfect_nl, default_ctx)
        assert r.confidence_raw > 0.99
        assert not r.is_low_confidence

    def test_midface_height_ratio_value(self, perfect_nl, default_ctx):
        r = get("midface_height_ratio").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(1.50, abs=0.02)

    def test_midface_height_ratio_direction_neutral(self, perfect_nl, default_ctx):
        r = get("midface_height_ratio").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_midface_height_ratio_high_confidence(self, perfect_nl, default_ctx):
        r = get("midface_height_ratio").compute(perfect_nl, default_ctx)
        assert r.confidence_raw == pytest.approx(1.0, abs=0.02)
        assert not r.is_low_confidence

    def test_cheekbone_to_jaw_ratio_value(self, perfect_nl, default_ctx):
        r = get("cheekbone_to_jaw_ratio").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(1.25, abs=0.01)

    def test_cheekbone_to_jaw_ratio_direction_neutral(self, perfect_nl, default_ctx):
        r = get("cheekbone_to_jaw_ratio").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_cheekbone_to_jaw_ratio_high_confidence(self, perfect_nl, default_ctx):
        r = get("cheekbone_to_jaw_ratio").compute(perfect_nl, default_ctx)
        assert r.confidence_raw == pytest.approx(1.0, abs=0.02)
        assert not r.is_low_confidence

    def test_submalar_hollow_index_value(self, perfect_nl, default_ctx):
        r = get("submalar_hollow_index").compute(perfect_nl, default_ctx)
        # bicheek=3.6 ICU / bizyg=4.0 ICU → hollow = 1 − 0.90 = 0.10
        assert r.value == pytest.approx(0.10, abs=0.01)

    def test_submalar_hollow_index_direction_neutral(self, perfect_nl, default_ctx):
        r = get("submalar_hollow_index").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_submalar_hollow_index_high_confidence(self, perfect_nl, default_ctx):
        r = get("submalar_hollow_index").compute(perfect_nl, default_ctx)
        assert r.confidence_raw == pytest.approx(1.0, abs=0.02)
        assert not r.is_low_confidence


# ---------------------------------------------------------------------------
# Square-jaw deviated fixture
# ---------------------------------------------------------------------------

class TestSquareJawFace:
    """square_jaw_cheekbone_face: gonions at x=±2.4 ICU → bigonial=4.8 ICU.

    cheekbone_to_jaw_ratio = 4.0/4.8 ≈ 0.833 → clearly below ideal (square_jaw).
    zygomatic_width_ratio unchanged (4.0 ICU).
    """

    def test_cbj_below_ideal(self, square_jaw_nl, default_ctx):
        r = get("cheekbone_to_jaw_ratio").compute(square_jaw_nl, default_ctx)
        assert r.value == pytest.approx(0.833, abs=0.02)

    def test_cbj_direction_square_jaw(self, square_jaw_nl, default_ctx):
        r = get("cheekbone_to_jaw_ratio").compute(square_jaw_nl, default_ctx)
        assert r.direction == "square_jaw"

    def test_cbj_low_confidence_raw(self, square_jaw_nl, default_ctx):
        """Wide jaw → large deviation from ideal 1.25 → lower confidence_raw."""
        r = get("cheekbone_to_jaw_ratio").compute(square_jaw_nl, default_ctx)
        # |0.833 - 1.25| / 0.40 = 1.042 → conf_raw = max(0, 1 − 1.042) = 0
        assert r.confidence_raw == pytest.approx(0.0, abs=0.05)

    def test_zyg_width_unchanged(self, square_jaw_nl, default_ctx):
        """Gonion change should not affect zygomatic_width_ratio."""
        r = get("zygomatic_width_ratio").compute(square_jaw_nl, default_ctx)
        assert r.value == pytest.approx(4.00, abs=0.02)


# ---------------------------------------------------------------------------
# Confidence: pose sensitivity (CHEEKBONE_POSE_PARAMS yaw_weight=0.75)
# ---------------------------------------------------------------------------

class TestConfidence:
    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_yaw10_reduces_confidence(self, metric_id, perfect_nl, default_ctx, yaw_ctx):
        r_no_pose = get(metric_id).compute(perfect_nl, default_ctx)
        r_yaw     = get(metric_id).compute(perfect_nl, yaw_ctx)
        assert r_yaw.confidence_final < r_no_pose.confidence_final, (
            f"{metric_id}: 10° yaw should reduce confidence_final"
        )

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_pitch10_reduces_confidence(self, metric_id, perfect_nl, default_ctx, pitch_ctx):
        r_no_pose = get(metric_id).compute(perfect_nl, default_ctx)
        r_pitch   = get(metric_id).compute(perfect_nl, pitch_ctx)
        assert r_pitch.confidence_final < r_no_pose.confidence_final, (
            f"{metric_id}: 10° pitch should reduce confidence_final"
        )

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_yaw_penalises_more_than_pitch(self, metric_id, perfect_nl, yaw_ctx, pitch_ctx):
        """CHEEKBONE_POSE_PARAMS: yaw_weight=0.75 > pitch_weight=0.25."""
        r_yaw   = get(metric_id).compute(perfect_nl, yaw_ctx)
        r_pitch = get(metric_id).compute(perfect_nl, pitch_ctx)
        assert r_yaw.confidence_final < r_pitch.confidence_final, (
            f"{metric_id}: yaw penalty should be stronger than pitch penalty"
        )

    def test_quality_score_propagates(self, perfect_nl):
        low_quality_ctx = QualityContext(quality_score=0.3)
        r = get("zygomatic_width_ratio").compute(perfect_nl, low_quality_ctx)
        assert r.confidence_final < 0.5

    def test_perfect_face_not_low_confidence(self, perfect_nl, default_ctx):
        for mid in _ALL_IDS:
            r = get(mid).compute(perfect_nl, default_ctx)
            assert not r.is_low_confidence, (
                f"{mid}: perfect fixture should not be flagged as low confidence"
            )

    def test_hard_yaw_triggers_low_confidence(self, perfect_nl):
        hard_yaw_ctx = QualityContext(pose={"yaw": 20.0, "pitch": 0.0})
        for mid in _ALL_IDS:
            r = get(mid).compute(perfect_nl, hard_yaw_ctx)
            assert r.confidence_final < LOW_CONF_THRESHOLD, (
                f"{mid}: 20° yaw (beyond hard threshold 15°) should give "
                f"confidence_final < {LOW_CONF_THRESHOLD}"
            )
