"""Tests for services/metrics/forehead.py (PR-18).

Covers all 4 forehead family metrics:
  - forehead_height_ratio   (ICU, landmark-based)
  - forehead_width_ratio    (ratio, landmark-based)
  - temporal_width_ratio    (ratio, landmark-based)
  - hairline_curvature_index (requires_pixel_analysis=True — stub only)

Key invariants:
  - perfect_forehead_face → first 3 metrics at ideal, conf_raw ≥ 0.97
  - short_forehead_face   → forehead_height_ratio < green, direction = 'short_forehead'
  - hairline_curvature_index: value=0, confidence=0, direction='not_computed'
  - Pose: yaw penalises more than pitch for width metrics
          (FOREHEAD_POSE_PARAMS: yaw_weight=0.60, pitch_weight=0.40)
  - Registry wiring for all 4 ids
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
    perfect_forehead_face,
    perfect_frontal,
    short_forehead_face,
)

# All 4 metric IDs in the forehead family
_ALL_IDS = [
    "forehead_height_ratio",
    "forehead_width_ratio",
    "temporal_width_ratio",
    "hairline_curvature_index",
]
# The 3 that are computable from landmarks (excludes pixel-dep stub)
_LANDMARK_IDS = [
    "forehead_height_ratio",
    "forehead_width_ratio",
    "temporal_width_ratio",
]


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def perfect_nl():
    return normalize(perfect_forehead_face())


@pytest.fixture
def short_nl():
    return normalize(short_forehead_face())


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


@pytest.fixture
def low_quality_ctx():
    return QualityContext(quality_score=0.3)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_all_forehead_ids_registered(self):
        ids = set(list_metric_ids())
        for mid in _ALL_IDS:
            assert mid in ids, f"'{mid}' not in registry"

    def test_get_each(self):
        for mid in _ALL_IDS:
            assert get(mid) is not None

    def test_hairline_has_requires_pixel_analysis(self):
        calc = get("hairline_curvature_index")
        assert hasattr(calc, "requires_pixel_analysis")
        assert calc.requires_pixel_analysis is True

    def test_landmark_metrics_do_not_require_pixel(self):
        for mid in _LANDMARK_IDS:
            calc = get(mid)
            assert not getattr(calc, "requires_pixel_analysis", False)


# ---------------------------------------------------------------------------
# MetricValue contract
# ---------------------------------------------------------------------------

class TestContract:
    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_returns_metric_value(self, metric_id, perfect_nl, default_ctx):
        result = get(metric_id).compute(perfect_nl, default_ctx)
        assert isinstance(result, MetricValue)

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_region_is_forehead(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).region == "forehead"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_family_is_forehead(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).family == "forehead"

    @pytest.mark.parametrize("metric_id", _LANDMARK_IDS)
    def test_confidence_in_range(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", _LANDMARK_IDS)
    def test_dep_landmarks_non_empty(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 2

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_not_presentation_only(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.presentation_only is False

    def test_forehead_height_unit(self, perfect_nl, default_ctx):
        assert get("forehead_height_ratio").compute(perfect_nl, default_ctx).unit == "intercanthal_units"

    def test_forehead_width_unit(self, perfect_nl, default_ctx):
        assert get("forehead_width_ratio").compute(perfect_nl, default_ctx).unit == "ratio"

    def test_temporal_unit(self, perfect_nl, default_ctx):
        assert get("temporal_width_ratio").compute(perfect_nl, default_ctx).unit == "ratio"

    def test_hairline_unit(self, perfect_nl, default_ctx):
        assert get("hairline_curvature_index").compute(perfect_nl, default_ctx).unit == "index_0_1"


# ---------------------------------------------------------------------------
# forehead_height_ratio
# ---------------------------------------------------------------------------

class TestForeheadHeightRatio:
    def test_ideal_value(self, perfect_nl, default_ctx):
        r = get("forehead_height_ratio").compute(perfect_nl, default_ctx)
        assert abs(r.value - 1.90) < 0.02

    def test_ideal_direction_neutral(self, perfect_nl, default_ctx):
        r = get("forehead_height_ratio").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_ideal_confidence_raw_high(self, perfect_nl, default_ctx):
        r = get("forehead_height_ratio").compute(perfect_nl, default_ctx)
        assert r.confidence_raw >= 0.97

    def test_ideal_not_low_confidence(self, perfect_nl, default_ctx):
        r = get("forehead_height_ratio").compute(perfect_nl, default_ctx)
        assert not r.is_low_confidence

    def test_short_forehead_value(self, short_nl, default_ctx):
        r = get("forehead_height_ratio").compute(short_nl, default_ctx)
        assert abs(r.value - 1.40) < 0.02

    def test_short_forehead_direction(self, short_nl, default_ctx):
        r = get("forehead_height_ratio").compute(short_nl, default_ctx)
        assert r.direction == "short_forehead"

    def test_short_forehead_confidence_lower(self, short_nl, perfect_nl, default_ctx):
        r_short = get("forehead_height_ratio").compute(short_nl, default_ctx)
        r_ideal = get("forehead_height_ratio").compute(perfect_nl, default_ctx)
        assert r_short.confidence_raw < r_ideal.confidence_raw

    def test_tall_direction_on_frontal(self, frontal_nl, default_ctx):
        # perfect_frontal has crown at y=100 (200 px above eye), brow inner at y=272
        # height = (272-300)/100 - (100-300)/100 = -0.28 - (-2.0) = 1.72 ICU (near ideal)
        r = get("forehead_height_ratio").compute(frontal_nl, default_ctx)
        # 1.72 < 1.90 → 'short_forehead' (or neutral if within tolerance)
        assert r.direction in ("short_forehead", "neutral")

    def test_positive_value(self, perfect_nl, default_ctx):
        r = get("forehead_height_ratio").compute(perfect_nl, default_ctx)
        assert r.value > 0.0

    def test_dep_landmarks_correct(self, perfect_nl, default_ctx):
        from app.domain.landmarks_mesh import P_FOREHEAD_CROWN, P_BROW_LEFT_INNER, P_BROW_RIGHT_INNER
        r = get("forehead_height_ratio").compute(perfect_nl, default_ctx)
        dep = set(r.dependency_landmarks)
        assert P_FOREHEAD_CROWN in dep
        assert P_BROW_LEFT_INNER in dep
        assert P_BROW_RIGHT_INNER in dep

    def test_pitch_penalises(self, perfect_nl, default_ctx, pitch_ctx):
        r0 = get("forehead_height_ratio").compute(perfect_nl, default_ctx)
        rp = get("forehead_height_ratio").compute(perfect_nl, pitch_ctx)
        assert rp.confidence_final < r0.confidence_final

    def test_yaw_penalises(self, perfect_nl, default_ctx, yaw_ctx):
        r0 = get("forehead_height_ratio").compute(perfect_nl, default_ctx)
        ry = get("forehead_height_ratio").compute(perfect_nl, yaw_ctx)
        assert ry.confidence_final < r0.confidence_final

    def test_low_quality_propagates(self, perfect_nl, default_ctx, low_quality_ctx):
        r_high = get("forehead_height_ratio").compute(perfect_nl, default_ctx)
        r_low  = get("forehead_height_ratio").compute(perfect_nl, low_quality_ctx)
        assert r_low.confidence_final < r_high.confidence_final


# ---------------------------------------------------------------------------
# forehead_width_ratio
# ---------------------------------------------------------------------------

class TestForeheadWidthRatio:
    def test_ideal_value(self, perfect_nl, default_ctx):
        r = get("forehead_width_ratio").compute(perfect_nl, default_ctx)
        assert abs(r.value - 0.70) < 0.01

    def test_ideal_direction_neutral(self, perfect_nl, default_ctx):
        r = get("forehead_width_ratio").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_ideal_confidence_raw_high(self, perfect_nl, default_ctx):
        r = get("forehead_width_ratio").compute(perfect_nl, default_ctx)
        assert r.confidence_raw >= 0.97

    def test_ideal_not_low_confidence(self, perfect_nl, default_ctx):
        r = get("forehead_width_ratio").compute(perfect_nl, default_ctx)
        assert not r.is_low_confidence

    def test_value_positive(self, perfect_nl, default_ctx):
        r = get("forehead_width_ratio").compute(perfect_nl, default_ctx)
        assert r.value > 0.0

    def test_narrow_direction_when_biocular_small(self, short_nl, default_ctx):
        # short_forehead_face uses same width geometry as perfect → still neutral
        r = get("forehead_width_ratio").compute(short_nl, default_ctx)
        assert r.direction == "neutral"

    def test_wide_direction_when_biocular_exceeds_ideal(self, perfect_nl, default_ctx):
        # Patch: use frontal face whose biocular/bizygomatic is canonical 3.0/5.0=0.60
        r = get("forehead_width_ratio").compute(
            normalize(perfect_frontal()), default_ctx
        )
        # 3.0/5.0 = 0.60, below ideal 0.70 → narrow_forehead
        assert r.direction == "narrow_forehead"

    def test_dep_landmarks_correct(self, perfect_nl, default_ctx):
        from app.domain.landmarks_mesh import (
            P_LEFT_EYE_OUTER, P_RIGHT_EYE_OUTER,
            P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
        )
        r = get("forehead_width_ratio").compute(perfect_nl, default_ctx)
        dep = set(r.dependency_landmarks)
        for lm in (P_LEFT_EYE_OUTER, P_RIGHT_EYE_OUTER, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC):
            assert lm in dep

    def test_yaw_penalises_more_than_pitch(self, perfect_nl, yaw_ctx, pitch_ctx):
        # yaw_weight=0.60 > pitch_weight=0.40 → yaw penalty heavier
        r_yaw   = get("forehead_width_ratio").compute(perfect_nl, yaw_ctx)
        r_pitch = get("forehead_width_ratio").compute(perfect_nl, pitch_ctx)
        assert r_yaw.confidence_final < r_pitch.confidence_final

    def test_low_quality_propagates(self, perfect_nl, default_ctx, low_quality_ctx):
        r_high = get("forehead_width_ratio").compute(perfect_nl, default_ctx)
        r_low  = get("forehead_width_ratio").compute(perfect_nl, low_quality_ctx)
        assert r_low.confidence_final < r_high.confidence_final

    def test_degenerate_bizygomatic_zero(self, perfect_nl, default_ctx):
        """When bizygomatic = 0 the metric returns value=None, confidence=0."""
        import numpy as np
        from app.domain.landmarks_mesh import P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC
        from app.services.normalization import normalize
        # Collapse both zygomatic landmarks to the same point
        raw = perfect_forehead_face()
        raw[P_LEFT_ZYGOMATIC]  = [400.0, 300.0, 0.0]
        raw[P_RIGHT_ZYGOMATIC] = [400.0, 300.0, 0.0]
        nl = normalize(raw)
        r = get("forehead_width_ratio").compute(nl, default_ctx)
        assert r.value is None
        assert r.confidence_raw == 0.0
        assert r.confidence_final == 0.0
        assert r.is_low_confidence is True


# ---------------------------------------------------------------------------
# temporal_width_ratio
# ---------------------------------------------------------------------------

class TestTemporalWidthRatio:
    def test_ideal_value(self, perfect_nl, default_ctx):
        r = get("temporal_width_ratio").compute(perfect_nl, default_ctx)
        assert abs(r.value - 0.75) < 0.01

    def test_ideal_direction_neutral(self, perfect_nl, default_ctx):
        r = get("temporal_width_ratio").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_ideal_confidence_raw_high(self, perfect_nl, default_ctx):
        r = get("temporal_width_ratio").compute(perfect_nl, default_ctx)
        assert r.confidence_raw >= 0.97

    def test_ideal_not_low_confidence(self, perfect_nl, default_ctx):
        r = get("temporal_width_ratio").compute(perfect_nl, default_ctx)
        assert not r.is_low_confidence

    def test_narrow_temporal_direction_on_frontal(self, frontal_nl, default_ctx):
        # perfect_frontal: outer brow at (280,272)/(520,272), bizygomatic 500 px = 5.0 ICU
        # outer brow span = 240 px = 2.4 ICU → ratio = 2.4/5.0 = 0.48 → narrow_temporal
        r = get("temporal_width_ratio").compute(frontal_nl, default_ctx)
        assert r.direction == "narrow_temporal"

    def test_dep_landmarks_correct(self, perfect_nl, default_ctx):
        from app.domain.landmarks_mesh import (
            P_BROW_LEFT_OUTER, P_BROW_RIGHT_OUTER,
            P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
        )
        r = get("temporal_width_ratio").compute(perfect_nl, default_ctx)
        dep = set(r.dependency_landmarks)
        for lm in (P_BROW_LEFT_OUTER, P_BROW_RIGHT_OUTER, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC):
            assert lm in dep

    def test_yaw_penalises_more_than_pitch(self, perfect_nl, yaw_ctx, pitch_ctx):
        r_yaw   = get("temporal_width_ratio").compute(perfect_nl, yaw_ctx)
        r_pitch = get("temporal_width_ratio").compute(perfect_nl, pitch_ctx)
        assert r_yaw.confidence_final < r_pitch.confidence_final

    def test_low_quality_propagates(self, perfect_nl, default_ctx, low_quality_ctx):
        r_high = get("temporal_width_ratio").compute(perfect_nl, default_ctx)
        r_low  = get("temporal_width_ratio").compute(perfect_nl, low_quality_ctx)
        assert r_low.confidence_final < r_high.confidence_final

    def test_value_positive(self, perfect_nl, default_ctx):
        r = get("temporal_width_ratio").compute(perfect_nl, default_ctx)
        assert r.value > 0.0

    def test_different_from_forehead_width(self, perfect_nl, default_ctx):
        fwr = get("forehead_width_ratio").compute(perfect_nl, default_ctx).value
        twr = get("temporal_width_ratio").compute(perfect_nl, default_ctx).value
        assert abs(fwr - twr) > 0.01  # must be distinct metrics

    def test_degenerate_bizygomatic_zero(self, default_ctx):
        """When bizygomatic collapses to zero, returns value=None, confidence=0."""
        from app.domain.landmarks_mesh import P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC
        raw = perfect_forehead_face()
        raw[P_LEFT_ZYGOMATIC]  = [400.0, 300.0, 0.0]
        raw[P_RIGHT_ZYGOMATIC] = [400.0, 300.0, 0.0]
        nl = normalize(raw)
        r = get("temporal_width_ratio").compute(nl, default_ctx)
        assert r.value is None
        assert r.confidence_raw == 0.0
        assert r.confidence_final == 0.0
        assert r.is_low_confidence is True


# ---------------------------------------------------------------------------
# hairline_curvature_index (pixel-dep stub)
# ---------------------------------------------------------------------------

class TestHairlineCurvatureIndex:
    def test_stub_value_is_zero(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert r.value == 0.0

    def test_stub_confidence_is_zero(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert r.confidence_raw == 0.0
        assert r.confidence_final == 0.0

    def test_stub_is_low_confidence(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert r.is_low_confidence is True

    def test_stub_direction_not_computed(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert r.direction == "not_computed"

    def test_stub_dep_landmarks_empty(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert len(r.dependency_landmarks) == 0

    def test_stub_region_forehead(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert r.region == "forehead"

    def test_stub_family_forehead(self, perfect_nl, default_ctx):
        r = get("hairline_curvature_index").compute(perfect_nl, default_ctx)
        assert r.family == "forehead"


# ---------------------------------------------------------------------------
# Pose sensitivity comparison (yaw_weight > pitch_weight for width metrics)
# ---------------------------------------------------------------------------

class TestPoseSensitivity:
    """For width metrics (forehead_width, temporal_width), yaw dominates.
    For height metric, pitch is significant but yaw weight is also substantial.
    """

    @pytest.mark.parametrize("metric_id", ["forehead_width_ratio", "temporal_width_ratio"])
    def test_width_metrics_yaw_heavier_than_pitch(self, metric_id, perfect_nl, yaw_ctx, pitch_ctx):
        calc = get(metric_id)
        r_yaw   = calc.compute(perfect_nl, yaw_ctx)
        r_pitch = calc.compute(perfect_nl, pitch_ctx)
        assert r_yaw.confidence_final < r_pitch.confidence_final, (
            f"{metric_id}: expected yaw penalty > pitch penalty at 10° each "
            f"(yaw_weight=0.60 > pitch_weight=0.40), got "
            f"yaw_cf={r_yaw.confidence_final:.3f}, pitch_cf={r_pitch.confidence_final:.3f}"
        )

    def test_zero_pose_no_penalty(self, perfect_nl):
        ctx_zero = QualityContext(pose={"yaw": 0.0, "pitch": 0.0})
        ctx_none = QualityContext()
        for mid in _LANDMARK_IDS:
            calc = get(mid)
            r_zero = calc.compute(perfect_nl, ctx_zero)
            r_none = calc.compute(perfect_nl, ctx_none)
            assert abs(r_zero.confidence_final - r_none.confidence_final) < 1e-9
