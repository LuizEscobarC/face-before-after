"""Tests for services/metrics/brows.py (PR-16).

Covers all 8 brow metrics:
  - brow_height_l / brow_height_r
  - brow_arch_peak_l / brow_arch_peak_r
  - brow_thickness_l / brow_thickness_r  (presentation_only)
  - brow_tail_drop_l
  - interbrow_distance_ratio

Key invariants:
  - perfect_brow_face → all metrics at or near ideal
  - drooping_brow_face → brow_tail_drop_l > 0 (positive = drooping outer)
  - brow_thickness_l/r → presentation_only=True on MetricValue
  - Confidence: yaw penalises more than pitch (BROW_POSE_PARAMS yaw_weight=0.65)
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
    drooping_brow_face,
    perfect_brow_face,
    perfect_frontal,
)

_ALL_IDS = [
    "brow_height_l",
    "brow_height_r",
    "brow_arch_peak_l",
    "brow_arch_peak_r",
    "brow_thickness_l",
    "brow_thickness_r",
    "brow_tail_drop_l",
    "interbrow_distance_ratio",
]

_PRESENTATION_ONLY_IDS = {"brow_thickness_l", "brow_thickness_r"}
_SCORED_IDS = [mid for mid in _ALL_IDS if mid not in _PRESENTATION_ONLY_IDS]


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def perfect_nl():
    return normalize(perfect_brow_face())


@pytest.fixture
def drooping_nl():
    return normalize(drooping_brow_face())


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
    def test_all_brow_ids_registered(self):
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
    def test_region_is_brows(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).region == "brows"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_family_is_brows(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).family == "brows"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_confidence_in_range(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_dep_landmarks_non_empty(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 1

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_direction_is_string(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert isinstance(r.direction, str)
        assert len(r.direction) > 0

    @pytest.mark.parametrize("metric_id", list(_PRESENTATION_ONLY_IDS))
    def test_presentation_only_flag_on_metric_value(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.presentation_only is True, (
            f"{metric_id} must set presentation_only=True on MetricValue (DEC-6)"
        )

    @pytest.mark.parametrize("metric_id", _SCORED_IDS)
    def test_non_presentation_only_flag(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.presentation_only is False, (
            f"{metric_id} must not set presentation_only=True"
        )

    @pytest.mark.parametrize("metric_id", list(_PRESENTATION_ONLY_IDS))
    def test_presentation_only_class_attribute(self, metric_id):
        calc = get(metric_id)
        assert calc.presentation_only is True, (
            f"{metric_id}: class attribute presentation_only must be True (DEC-10)"
        )


# ---------------------------------------------------------------------------
# Canonical values on perfect_brow_face
# ---------------------------------------------------------------------------

class TestPerfectBrows:
    """Verify that perfect_brow_face() yields the expected ideal values.

    Geometry (pixel space, ICD=100px, origin at inner canthi midpoint y=300):
      - inner brows at y=265 → brow_height = (300-265)/100 = 0.35 ICU
      - arch peak at 67% from inner to outer → brow_arch_peak = 0.67
      - brow vertical span = (265-245)/100 = 0.20 ICU (thickness proxy)
      - outer brow at y=260 < inner at y=265 → tail_drop = (260-265)/100 = -0.05
      - interbrow gap = (450-350)/100 = 1.0 ICU
    """

    def test_brow_height_l(self, perfect_nl, default_ctx):
        r = get("brow_height_l").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.35, abs=0.01)
        assert r.direction == "neutral"

    def test_brow_height_r(self, perfect_nl, default_ctx):
        r = get("brow_height_r").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.35, abs=0.01)
        assert r.direction == "neutral"

    def test_brow_arch_peak_l(self, perfect_nl, default_ctx):
        r = get("brow_arch_peak_l").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.67, abs=0.02)
        assert r.direction == "neutral"

    def test_brow_arch_peak_r(self, perfect_nl, default_ctx):
        r = get("brow_arch_peak_r").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.67, abs=0.02)
        assert r.direction == "neutral"

    def test_brow_thickness_l(self, perfect_nl, default_ctx):
        r = get("brow_thickness_l").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.20, abs=0.02)

    def test_brow_thickness_r(self, perfect_nl, default_ctx):
        r = get("brow_thickness_r").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(0.20, abs=0.02)

    def test_brow_tail_drop_l(self, perfect_nl, default_ctx):
        r = get("brow_tail_drop_l").compute(perfect_nl, default_ctx)
        # outer_y - inner_y = -0.05 ICU (outer above inner = elevated)
        assert r.value == pytest.approx(-0.05, abs=0.01)
        assert r.direction == "neutral"

    def test_interbrow_distance_ratio(self, perfect_nl, default_ctx):
        r = get("interbrow_distance_ratio").compute(perfect_nl, default_ctx)
        assert r.value == pytest.approx(1.0, abs=0.01)
        assert r.direction == "neutral"

    def test_height_lr_symmetric(self, perfect_nl, default_ctx):
        l = get("brow_height_l").compute(perfect_nl, default_ctx).value
        r = get("brow_height_r").compute(perfect_nl, default_ctx).value
        assert l == pytest.approx(r, abs=0.005)

    def test_arch_lr_symmetric(self, perfect_nl, default_ctx):
        l = get("brow_arch_peak_l").compute(perfect_nl, default_ctx).value
        r = get("brow_arch_peak_r").compute(perfect_nl, default_ctx).value
        assert l == pytest.approx(r, abs=0.01)

    def test_thickness_lr_symmetric(self, perfect_nl, default_ctx):
        l = get("brow_thickness_l").compute(perfect_nl, default_ctx).value
        r = get("brow_thickness_r").compute(perfect_nl, default_ctx).value
        assert l == pytest.approx(r, abs=0.01)

    @pytest.mark.parametrize("metric_id", _SCORED_IDS)
    def test_high_confidence_on_perfect(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.confidence_final >= 0.7, (
            f"{metric_id}: expected high confidence on ideal fixture, "
            f"got {r.confidence_final:.3f}"
        )


# ---------------------------------------------------------------------------
# Drooping brow fixture
# ---------------------------------------------------------------------------

class TestDroopingBrow:
    """Left outer brow lowered by 20 px → tail_drop_l = +0.15 ICU."""

    def test_tail_drop_increases(self, drooping_nl, default_ctx):
        r = get("brow_tail_drop_l").compute(drooping_nl, default_ctx)
        # 20 px droop = 0.20 ICU step, so drop > 0 (positive = drooping)
        assert r.value > 0.05
        assert r.direction == "tail_droops"

    def test_tail_drop_value(self, drooping_nl, default_ctx):
        r = get("brow_tail_drop_l").compute(drooping_nl, default_ctx)
        # (280-265)/100 = +0.15 ICU
        assert r.value == pytest.approx(0.15, abs=0.01)

    def test_tail_drop_reduces_confidence(self, drooping_nl, perfect_nl, default_ctx):
        c_perfect = get("brow_tail_drop_l").compute(perfect_nl, default_ctx).confidence_raw
        c_droop = get("brow_tail_drop_l").compute(drooping_nl, default_ctx).confidence_raw
        assert c_droop < c_perfect

    def test_height_unaffected_by_tail_change(self, drooping_nl, perfect_nl, default_ctx):
        # brow_height uses inner brow point; outer is unchanged for right side.
        h_r_perf = get("brow_height_r").compute(perfect_nl, default_ctx).value
        h_r_drop = get("brow_height_r").compute(drooping_nl, default_ctx).value
        assert h_r_perf == pytest.approx(h_r_drop, abs=0.005)

    def test_interbrow_unaffected(self, drooping_nl, perfect_nl, default_ctx):
        ib_perf = get("interbrow_distance_ratio").compute(perfect_nl, default_ctx).value
        ib_drop = get("interbrow_distance_ratio").compute(drooping_nl, default_ctx).value
        assert ib_perf == pytest.approx(ib_drop, abs=0.005)


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
    def test_pitch_penalises(self, metric_id, perfect_nl, default_ctx, pitch_ctx):
        c0 = get(metric_id).compute(perfect_nl, default_ctx).confidence_final
        c1 = get(metric_id).compute(perfect_nl, pitch_ctx).confidence_final
        assert c1 < c0, f"{metric_id}: pitch 10° did not reduce confidence"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_yaw_penalises_more_than_pitch(self, metric_id, perfect_nl, yaw_ctx, pitch_ctx):
        # BROW_POSE_PARAMS: yaw_weight=0.65 > pitch_weight=0.35 → yaw dominates.
        c_yaw   = get(metric_id).compute(perfect_nl, yaw_ctx).confidence_final
        c_pitch = get(metric_id).compute(perfect_nl, pitch_ctx).confidence_final
        assert c_pitch >= c_yaw - 1e-6, (
            f"{metric_id}: pitch should not penalise more than yaw "
            f"(pitch={c_pitch:.4f}, yaw={c_yaw:.4f})"
        )

    def test_low_confidence_flag(self, perfect_nl):
        bad_ctx = QualityContext(quality_score=0.3, pose={"yaw": 20.0, "pitch": 0.0})
        r = get("brow_height_l").compute(perfect_nl, bad_ctx)
        assert r.is_low_confidence is True
        assert r.confidence_final < LOW_CONF_THRESHOLD

    def test_frontal_gives_reasonable_confidence(self, frontal_nl, default_ctx):
        # The default perfect_frontal fixture has brow_height ≈ 0.28 (not ideal 0.35),
        # so confidence_raw < 1 but should not be zero.
        r = get("brow_height_l").compute(frontal_nl, default_ctx)
        assert r.confidence_raw > 0.0
        assert r.confidence_final > 0.0
