"""Tests for services/metrics/global_shape.py (PR-19, updated PR-C1).

Covers all 4 global-shape family metrics:
  - face_height_to_width_ratio  (ratio, scored)
  - face_shape_classification   (ratio, scored — PR-C1 promotion, categorical label)
  - total_facial_convexity      (index_0_1, scored, uses scipy ConvexHull)
  - e_line_deviation            (intercanthal_units, scored — PR-C1 frontal proxy)

Key invariants:
  - perfect_global_shape_face  → face_height_to_width_ratio = 1.35, shape = 'oval',
                                  convexity = 1.0, conf_raw ≥ 0.97
  - round_face                 → aspect = 0.75, direction 'round_face', shape 'round'
  - temporal_hollow_face       → convexity < 1.0, direction 'temporal_hollow'
  - face_shape_classification  → presentation_only = False (PR-C1 promotion)
  - e_line_deviation           → real value, unit='intercanthal_units' (PR-C1)
  - Pose: GLOBAL_SHAPE_POSE_PARAMS is balanced (yaw_weight = pitch_weight = 0.50,
          soft = 6°, hard = 18°)
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
    perfect_frontal,
    perfect_global_shape_face,
    round_face,
    temporal_hollow_face,
)

# All 4 metric IDs in the global_shape family
_ALL_IDS = [
    "face_height_to_width_ratio",
    "face_shape_classification",
    "total_facial_convexity",
    "e_line_deviation",
]
# IDs that are landmark-based (all 4 after PR-C1 promotions)
_LANDMARK_IDS = [
    "face_height_to_width_ratio",
    "face_shape_classification",
    "total_facial_convexity",
    "e_line_deviation",
]
# IDs that are scored (all 4 after PR-C1 promotions)
_SCORED_IDS = [
    "face_height_to_width_ratio",
    "face_shape_classification",
    "total_facial_convexity",
    "e_line_deviation",
]


# ---------------------------------------------------------------------------
# Pytest fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def perfect_nl():
    return normalize(perfect_global_shape_face())


@pytest.fixture
def round_nl():
    return normalize(round_face())


@pytest.fixture
def hollow_nl():
    return normalize(temporal_hollow_face())


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
def hard_yaw_ctx():
    return QualityContext(pose={"yaw": 20.0, "pitch": 0.0})


@pytest.fixture
def low_quality_ctx():
    return QualityContext(quality_score=0.3)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_all_global_shape_ids_registered(self):
        ids = set(list_metric_ids())
        for mid in _ALL_IDS:
            assert mid in ids, f"'{mid}' not in registry"

    def test_get_each(self):
        for mid in _ALL_IDS:
            assert get(mid) is not None

    def test_e_line_does_not_require_pixel_analysis(self):
        # PR-C1: e_line_deviation promoted to frontal 2D proxy
        calc = get("e_line_deviation")
        assert not getattr(calc, "requires_pixel_analysis", False)

    def test_landmark_metrics_do_not_require_pixel(self):
        for mid in _LANDMARK_IDS:
            calc = get(mid)
            assert not getattr(calc, "requires_pixel_analysis", False)

    def test_face_shape_classification_not_presentation_only(self):
        # PR-C1: face_shape_classification promoted to scored metric
        calc = get("face_shape_classification")
        assert not getattr(calc, "presentation_only", False)

    def test_scored_metrics_not_presentation_only(self):
        for mid in _SCORED_IDS:
            calc = get(mid)
            assert not getattr(calc, "presentation_only", False)


# ---------------------------------------------------------------------------
# MetricValue contract
# ---------------------------------------------------------------------------

class TestContract:
    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_returns_metric_value(self, metric_id, perfect_nl, default_ctx):
        result = get(metric_id).compute(perfect_nl, default_ctx)
        assert isinstance(result, MetricValue)

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_region_is_global(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).region == "global"

    @pytest.mark.parametrize("metric_id", _ALL_IDS)
    def test_family_is_global_shape(self, metric_id, perfect_nl, default_ctx):
        assert get(metric_id).compute(perfect_nl, default_ctx).family == "global_shape"

    @pytest.mark.parametrize("metric_id", _LANDMARK_IDS)
    def test_confidence_in_range(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert 0.0 <= r.confidence_raw <= 1.0
        assert 0.0 <= r.confidence_final <= 1.0

    @pytest.mark.parametrize("metric_id", _LANDMARK_IDS)
    def test_dep_landmarks_non_empty(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 2

    def test_face_height_to_width_unit(self, perfect_nl, default_ctx):
        assert get("face_height_to_width_ratio").compute(perfect_nl, default_ctx).unit == "ratio"

    def test_face_shape_classification_unit(self, perfect_nl, default_ctx):
        assert get("face_shape_classification").compute(perfect_nl, default_ctx).unit == "ratio"

    def test_total_facial_convexity_unit(self, perfect_nl, default_ctx):
        assert get("total_facial_convexity").compute(perfect_nl, default_ctx).unit == "index_0_1"

    def test_e_line_deviation_unit(self, perfect_nl, default_ctx):
        assert get("e_line_deviation").compute(perfect_nl, default_ctx).unit == "intercanthal_units"

    def test_face_shape_classification_not_presentation_only_in_result(self, perfect_nl, default_ctx):
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert r.presentation_only is False

    @pytest.mark.parametrize("metric_id", _SCORED_IDS)
    def test_scored_metrics_not_presentation_only_in_result(self, metric_id, perfect_nl, default_ctx):
        r = get(metric_id).compute(perfect_nl, default_ctx)
        assert r.presentation_only is False


# ---------------------------------------------------------------------------
# face_height_to_width_ratio
# ---------------------------------------------------------------------------

class TestFaceHeightToWidthRatio:
    def test_ideal_value(self, perfect_nl, default_ctx):
        r = get("face_height_to_width_ratio").compute(perfect_nl, default_ctx)
        assert abs(r.value - 1.35) < 0.02

    def test_ideal_direction_neutral(self, perfect_nl, default_ctx):
        r = get("face_height_to_width_ratio").compute(perfect_nl, default_ctx)
        assert r.direction == "neutral"

    def test_ideal_confidence_raw_high(self, perfect_nl, default_ctx):
        r = get("face_height_to_width_ratio").compute(perfect_nl, default_ctx)
        assert r.confidence_raw >= 0.97

    def test_ideal_not_low_confidence(self, perfect_nl, default_ctx):
        r = get("face_height_to_width_ratio").compute(perfect_nl, default_ctx)
        assert not r.is_low_confidence

    def test_round_face_value(self, round_nl, default_ctx):
        r = get("face_height_to_width_ratio").compute(round_nl, default_ctx)
        assert abs(r.value - 0.75) < 0.02

    def test_round_face_direction(self, round_nl, default_ctx):
        r = get("face_height_to_width_ratio").compute(round_nl, default_ctx)
        assert r.direction == "round_face"

    def test_round_face_confidence_lower_than_ideal(self, round_nl, perfect_nl, default_ctx):
        r_round = get("face_height_to_width_ratio").compute(round_nl, default_ctx)
        r_ideal = get("face_height_to_width_ratio").compute(perfect_nl, default_ctx)
        assert r_round.confidence_raw < r_ideal.confidence_raw

    def test_value_is_positive(self, perfect_nl, default_ctx):
        r = get("face_height_to_width_ratio").compute(perfect_nl, default_ctx)
        assert r.value > 0.0

    def test_yaw_penalises_confidence(self, perfect_nl, default_ctx, yaw_ctx):
        r_front = get("face_height_to_width_ratio").compute(perfect_nl, default_ctx)
        r_yaw   = get("face_height_to_width_ratio").compute(perfect_nl, yaw_ctx)
        assert r_yaw.confidence_final < r_front.confidence_final

    def test_pitch_penalises_confidence(self, perfect_nl, default_ctx, pitch_ctx):
        r_front = get("face_height_to_width_ratio").compute(perfect_nl, default_ctx)
        r_pitch = get("face_height_to_width_ratio").compute(perfect_nl, pitch_ctx)
        assert r_pitch.confidence_final < r_front.confidence_final

    def test_hard_yaw_gives_very_low_confidence(self, perfect_nl, hard_yaw_ctx):
        r = get("face_height_to_width_ratio").compute(perfect_nl, hard_yaw_ctx)
        assert r.confidence_final < 0.5

    def test_low_quality_penalises(self, perfect_nl, low_quality_ctx):
        r = get("face_height_to_width_ratio").compute(perfect_nl, low_quality_ctx)
        assert r.confidence_final < 0.5

    def test_yaw_and_pitch_penalty_balanced(self, perfect_nl, yaw_ctx, pitch_ctx):
        """GLOBAL_SHAPE_POSE_PARAMS has balanced yaw/pitch weights (0.50/0.50)."""
        r_yaw   = get("face_height_to_width_ratio").compute(perfect_nl, yaw_ctx)
        r_pitch = get("face_height_to_width_ratio").compute(perfect_nl, pitch_ctx)
        # At 10° both axes, equal penalty (yaw_weight == pitch_weight = 0.50)
        assert abs(r_yaw.confidence_final - r_pitch.confidence_final) < 0.05

    def test_oblong_direction_on_frontal(self, frontal_nl, default_ctx):
        # canonical frontal: crown y=100, menton y=500, zyg x=[150,650]
        # face_height=(500-100)/100=4.0, bizygomatic=500/100=5.0 → ratio=0.80 → round_face
        r = get("face_height_to_width_ratio").compute(frontal_nl, default_ctx)
        assert r.direction == "round_face"


# ---------------------------------------------------------------------------
# face_shape_classification
# ---------------------------------------------------------------------------

class TestFaceShapeClassification:
    def test_oval_direction_for_perfect_face(self, perfect_nl, default_ctx):
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert r.direction == "oval"

    def test_round_direction_for_round_face(self, round_nl, default_ctx):
        r = get("face_shape_classification").compute(round_nl, default_ctx)
        assert r.direction == "round"

    def test_value_equals_aspect_ratio(self, perfect_nl, default_ctx):
        """face_shape_classification value = same aspect ratio as face_height_to_width."""
        r_shape  = get("face_shape_classification").compute(perfect_nl, default_ctx)
        r_aspect = get("face_height_to_width_ratio").compute(perfect_nl, default_ctx)
        assert abs(r_shape.value - r_aspect.value) < 1e-9

    def test_ideal_value(self, perfect_nl, default_ctx):
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert abs(r.value - 1.35) < 0.02

    def test_not_presentation_only_in_result(self, perfect_nl, default_ctx):
        # PR-C1: face_shape_classification promoted to scored metric
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert r.presentation_only is False

    def test_confidence_raw_high_for_ideal(self, perfect_nl, default_ctx):
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert r.confidence_raw >= 0.97

    def test_direction_type_is_valid(self, perfect_nl, default_ctx):
        valid = {"oval", "round", "oblong", "square", "heart"}
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert r.direction in valid

    def test_dep_includes_gonion(self, perfect_nl, default_ctx):
        from app.domain.landmarks_mesh import P_LEFT_GONION, P_RIGHT_GONION
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert P_LEFT_GONION in r.dependency_landmarks
        assert P_RIGHT_GONION in r.dependency_landmarks


# ---------------------------------------------------------------------------
# total_facial_convexity
# ---------------------------------------------------------------------------

class TestTotalFacialConvexity:
    def test_perfect_face_convexity_is_one(self, perfect_nl, default_ctx):
        r = get("total_facial_convexity").compute(perfect_nl, default_ctx)
        assert abs(r.value - 1.0) < 0.01

    def test_perfect_face_direction(self, perfect_nl, default_ctx):
        r = get("total_facial_convexity").compute(perfect_nl, default_ctx)
        assert r.direction == "full_midface"

    def test_round_face_convexity_is_one(self, round_nl, default_ctx):
        """Round face also has zyg wider than brow_outer → convexity = 1.0."""
        r = get("total_facial_convexity").compute(round_nl, default_ctx)
        assert abs(r.value - 1.0) < 0.01

    def test_temporal_hollow_convexity_below_one(self, hollow_nl, default_ctx):
        r = get("total_facial_convexity").compute(hollow_nl, default_ctx)
        assert r.value < 1.0

    def test_temporal_hollow_direction(self, hollow_nl, default_ctx):
        r = get("total_facial_convexity").compute(hollow_nl, default_ctx)
        assert r.direction == "temporal_hollow"

    def test_temporal_hollow_confidence_lower(self, hollow_nl, perfect_nl, default_ctx):
        r_hollow  = get("total_facial_convexity").compute(hollow_nl, default_ctx)
        r_perfect = get("total_facial_convexity").compute(perfect_nl, default_ctx)
        assert r_hollow.confidence_raw < r_perfect.confidence_raw

    def test_convexity_in_range(self, perfect_nl, default_ctx):
        r = get("total_facial_convexity").compute(perfect_nl, default_ctx)
        assert 0.0 < r.value <= 1.0

    def test_ideal_confidence_raw_high(self, perfect_nl, default_ctx):
        r = get("total_facial_convexity").compute(perfect_nl, default_ctx)
        assert r.confidence_raw >= 0.89

    def test_yaw_penalises_confidence(self, perfect_nl, default_ctx, yaw_ctx):
        r_front = get("total_facial_convexity").compute(perfect_nl, default_ctx)
        r_yaw   = get("total_facial_convexity").compute(perfect_nl, yaw_ctx)
        assert r_yaw.confidence_final < r_front.confidence_final

    def test_value_never_exceeds_one(self, hollow_nl, perfect_nl, round_nl, default_ctx):
        for nl in (hollow_nl, perfect_nl, round_nl):
            r = get("total_facial_convexity").compute(nl, default_ctx)
            assert r.value <= 1.0 + 1e-9

    def test_dep_landmarks_are_boundary_points(self, perfect_nl, default_ctx):
        from app.domain.landmarks_mesh import (
            P_BROW_LEFT_OUTER, P_BROW_RIGHT_OUTER,
            P_FOREHEAD_CROWN, P_MENTON,
            P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
        )
        r = get("total_facial_convexity").compute(perfect_nl, default_ctx)
        for idx in (P_FOREHEAD_CROWN, P_MENTON, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC,
                    P_BROW_LEFT_OUTER, P_BROW_RIGHT_OUTER):
            assert idx in r.dependency_landmarks


# ---------------------------------------------------------------------------
# e_line_deviation (PR-C1: frontal 2D proxy, real implementation)
# ---------------------------------------------------------------------------

class TestELineDeviation:
    def test_value_non_negative(self, perfect_nl, default_ctx):
        r = get("e_line_deviation").compute(perfect_nl, default_ctx)
        assert r.value >= 0.0

    def test_confidence_positive(self, perfect_nl, default_ctx):
        r = get("e_line_deviation").compute(perfect_nl, default_ctx)
        assert r.confidence_raw >= 0.0
        assert r.confidence_final >= 0.0

    def test_not_presentation_only(self, perfect_nl, default_ctx):
        r = get("e_line_deviation").compute(perfect_nl, default_ctx)
        assert r.presentation_only is False

    def test_direction_is_valid(self, perfect_nl, default_ctx):
        r = get("e_line_deviation").compute(perfect_nl, default_ctx)
        assert r.direction in ("neutral", "left_deviation", "right_deviation")

    def test_unit_is_icu(self, perfect_nl, default_ctx):
        r = get("e_line_deviation").compute(perfect_nl, default_ctx)
        assert r.unit == "intercanthal_units"

    def test_dep_landmarks_non_empty(self, perfect_nl, default_ctx):
        r = get("e_line_deviation").compute(perfect_nl, default_ctx)
        assert len(r.dependency_landmarks) >= 2


# ---------------------------------------------------------------------------
# Pose-sensitivity cross-checks
# ---------------------------------------------------------------------------

class TestPoseSensitivity:
    """GLOBAL_SHAPE_POSE_PARAMS: yaw_soft=6, yaw_hard=18, pitch_soft=6, pitch_hard=18.
    yaw_weight = pitch_weight = 0.50 (balanced for vertical+horizontal metrics).
    """

    def test_within_soft_threshold_no_penalty(self, perfect_nl):
        ctx_small_yaw = QualityContext(pose={"yaw": 4.0, "pitch": 0.0})
        r_no_pose = get("face_height_to_width_ratio").compute(perfect_nl, QualityContext())
        r_small   = get("face_height_to_width_ratio").compute(perfect_nl, ctx_small_yaw)
        # Yaw < soft threshold (6°) → very small or no pose penalty
        assert abs(r_small.confidence_final - r_no_pose.confidence_final) < 0.05

    def test_beyond_hard_threshold_severe_penalty(self, perfect_nl):
        ctx_hard_yaw = QualityContext(pose={"yaw": 22.0, "pitch": 0.0})
        r_front = get("face_height_to_width_ratio").compute(perfect_nl, QualityContext())
        r_hard  = get("face_height_to_width_ratio").compute(perfect_nl, ctx_hard_yaw)
        # Yaw > hard threshold (18°) → confidence at floor
        assert r_hard.confidence_final < r_front.confidence_final * 0.5

    def test_yaw_and_pitch_equal_penalty_at_same_angle(self, perfect_nl):
        """yaw_weight == pitch_weight → same angle gives same penalty magnitude."""
        ctx_yaw   = QualityContext(pose={"yaw": 12.0, "pitch": 0.0})
        ctx_pitch = QualityContext(pose={"yaw": 0.0, "pitch": 12.0})
        r_yaw   = get("face_height_to_width_ratio").compute(perfect_nl, ctx_yaw)
        r_pitch = get("face_height_to_width_ratio").compute(perfect_nl, ctx_pitch)
        # Equal weights → expect near-equal confidence_final (within floating point)
        assert abs(r_yaw.confidence_final - r_pitch.confidence_final) < 0.02


# ---------------------------------------------------------------------------
# Shape-classification thresholds
# ---------------------------------------------------------------------------

class TestShapeClassificationThresholds:
    """Directly test _classify_shape() via the calculator by constructing
    synthetic NormalizedLandmarks through fixtures / by verifying directions."""

    def test_oval_detection(self, perfect_nl, default_ctx):
        r = get("face_shape_classification").compute(perfect_nl, default_ctx)
        assert r.direction == "oval"  # aspect=1.35, taper=0.80 → oval

    def test_round_detection(self, round_nl, default_ctx):
        r = get("face_shape_classification").compute(round_nl, default_ctx)
        assert r.direction == "round"  # aspect=0.75 < 1.10 → round

    def test_frontal_canonical_shape(self, frontal_nl, default_ctx):
        """Canonical face: aspect ≈ 0.80, taper ≈ 0.48 → round (aspect < 1.10)."""
        r = get("face_shape_classification").compute(frontal_nl, default_ctx)
        assert r.direction == "round"
