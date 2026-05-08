"""Unit tests for the phi/golden-ratio metric family (PR-20).

All four metrics are presentation_only=True (DEC-6 hard rule):
  - phi_face_height_to_width
  - phi_lower_face_segments
  - phi_eye_to_mouth
  - phi_nose_to_lip

No metric_ideal rows, no region_metric_weight rows.
Tests cover: registry, contract, value computation, direction
classification, degenerate geometry, pose sensitivity, and
presentation_only enforcement.

Golden ratio: φ = (1 + √5) / 2 ≈ 1.6180339887
All tolerance checks use ±0.012 (< 0.75% relative error) to account
for integer rounding of fixture pixel coordinates.
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from app.domain.landmarks_mesh import (
    P_FOREHEAD_CROWN,
    P_LEFT_EYE_INNER,
    P_LEFT_IRIS_CENTER,
    P_LEFT_MOUTH,
    P_LEFT_ZYGOMATIC,
    P_LOWER_LIP,
    P_MENTON,
    P_NOSE_LEFT,
    P_NOSE_RIGHT,
    P_RIGHT_EYE_INNER,
    P_RIGHT_IRIS_CENTER,
    P_RIGHT_MOUTH,
    P_RIGHT_ZYGOMATIC,
    P_SUBNASALE,
    TOTAL_LANDMARKS,
)
import app.services.metrics.phi_golden  # noqa: F401 — triggers @register
from app.services.metrics.base import QualityContext
from app.services.metrics.confidence_propagation import PHI_POSE_PARAMS
from app.services.metrics.phi_golden import (
    PhiEyeToMouthCalculator,
    PhiFaceHeightToWidthCalculator,
    PhiLowerFaceSegmentsCalculator,
    PhiNoseToLipCalculator,
    _PHI,
    _PHI_TOLERANCE,
    _phi_direction,
)
from app.services.metrics.registry import get, list_metric_ids
from app.services.normalization import normalize
from tests.fixtures.synthetic_landmarks import (
    perfect_phi_face,
    wide_face_non_phi,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_PHI_METRIC_IDS = frozenset({
    "phi_face_height_to_width",
    "phi_lower_face_segments",
    "phi_eye_to_mouth",
    "phi_nose_to_lip",
})


def _quality(
    quality_score: float = 0.95,
    yaw: float = 0.0,
    pitch: float = 0.0,
) -> QualityContext:
    return QualityContext(
        quality_score=quality_score,
        regional_penalties={},
        pose={"yaw": yaw, "pitch": pitch, "roll": 0.0},
    )


def _norm(raw: np.ndarray):
    """Normalize a raw (478, 3) pixel array into NormalizedLandmarks."""
    return normalize(raw)


def _norm_from_map(overrides: dict[int, tuple[float, float]]):
    """Build NormalizedLandmarks from a landmark override map.

    All un-specified landmarks default to the face centroid (400, 300, 0).
    Inner canthi at (350,300) and (450,300) → ICD=100px.
    """
    pts = np.zeros((TOTAL_LANDMARKS, 3), dtype=float)
    pts[:, 0] = 400.0
    pts[:, 1] = 300.0
    # Inner canthi for ICD=100 px normalization
    pts[P_LEFT_EYE_INNER]  = [350.0, 300.0, 0.0]
    pts[P_RIGHT_EYE_INNER] = [450.0, 300.0, 0.0]
    for idx, (x, y) in overrides.items():
        pts[idx] = [x, y, 0.0]
    return normalize(pts)


# ---------------------------------------------------------------------------
# Golden ratio constant
# ---------------------------------------------------------------------------

class TestPhiConstant:
    def test_phi_value(self) -> None:
        assert abs(_PHI - 1.6180339887) < 1e-7

    def test_phi_tolerance_five_percent(self) -> None:
        assert abs(_PHI_TOLERANCE - _PHI * 0.05) < 1e-9

    def test_phi_pose_params_imported(self) -> None:
        assert PHI_POSE_PARAMS is not None
        assert PHI_POSE_PARAMS.floor == pytest.approx(0.25)
        assert PHI_POSE_PARAMS.yaw_soft_deg == pytest.approx(8.0)
        assert PHI_POSE_PARAMS.yaw_hard_deg == pytest.approx(22.0)
        assert PHI_POSE_PARAMS.pitch_soft_deg == pytest.approx(7.0)
        assert PHI_POSE_PARAMS.pitch_hard_deg == pytest.approx(20.0)
        assert PHI_POSE_PARAMS.yaw_weight == pytest.approx(0.45)
        assert PHI_POSE_PARAMS.pitch_weight == pytest.approx(0.55)


# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

class TestRegistry:
    def test_all_four_registered(self) -> None:
        registered = set(list_metric_ids())
        assert _PHI_METRIC_IDS.issubset(registered)

    def test_no_extra_phi_ids(self) -> None:
        phi_ids = {m for m in list_metric_ids() if m.startswith("phi_")}
        assert phi_ids == _PHI_METRIC_IDS

    def test_calculators_instantiable(self) -> None:
        for calc_cls in (
            PhiFaceHeightToWidthCalculator,
            PhiLowerFaceSegmentsCalculator,
            PhiEyeToMouthCalculator,
            PhiNoseToLipCalculator,
        ):
            obj = calc_cls()
            assert obj.metric_id in _PHI_METRIC_IDS

    def test_get_each_not_none(self) -> None:
        for mid in _PHI_METRIC_IDS:
            assert get(mid) is not None


# ---------------------------------------------------------------------------
# Contract: presentation_only, region, family, unit
# ---------------------------------------------------------------------------

class TestContract:
    _CALCS = [
        PhiFaceHeightToWidthCalculator(),
        PhiLowerFaceSegmentsCalculator(),
        PhiEyeToMouthCalculator(),
        PhiNoseToLipCalculator(),
    ]

    @pytest.mark.parametrize("calc", _CALCS, ids=["hw", "lower", "eye_mouth", "nose_lip"])
    def test_presentation_only_true(self, calc) -> None:
        assert calc.presentation_only is True

    @pytest.mark.parametrize("calc", _CALCS, ids=["hw", "lower", "eye_mouth", "nose_lip"])
    def test_region_global(self, calc) -> None:
        assert calc.region == "global"

    @pytest.mark.parametrize("calc", _CALCS, ids=["hw", "lower", "eye_mouth", "nose_lip"])
    def test_family_phi(self, calc) -> None:
        assert calc.family == "phi"

    @pytest.mark.parametrize("calc", _CALCS, ids=["hw", "lower", "eye_mouth", "nose_lip"])
    def test_unit_ratio(self, calc) -> None:
        assert calc.unit == "ratio"

    @pytest.mark.parametrize("calc", _CALCS, ids=["hw", "lower", "eye_mouth", "nose_lip"])
    def test_requires_pixel_analysis_false(self, calc) -> None:
        assert calc.requires_pixel_analysis is False


# ---------------------------------------------------------------------------
# phi_face_height_to_width
# ---------------------------------------------------------------------------

class TestPhiFaceHeightToWidth:
    _CALC = PhiFaceHeightToWidthCalculator()

    def test_value_near_phi_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is not None
        assert abs(mv.value - _PHI) < 0.012

    def test_direction_phi_proportionate_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "phi_proportionate"

    def test_direction_below_phi_in_wide_face(self) -> None:
        lm = _norm(wide_face_non_phi())
        mv = self._CALC.compute(lm, _quality())
        # face_height/bizygomatic = 3.0/4.0 = 0.75 << φ
        assert mv.value is not None
        assert mv.value < _PHI - _PHI_TOLERANCE
        assert mv.direction == "below_phi"

    def test_direction_above_phi_elongated_face(self) -> None:
        # crown y=-100px, menton y=700 → height=800px, bizygomatic=400 → ratio=2.0 > φ
        lm = _norm_from_map({
            P_FOREHEAD_CROWN: (400.0, -100.0),
            P_MENTON:         (400.0,  700.0),
            P_LEFT_ZYGOMATIC: (200.0,  300.0),
            P_RIGHT_ZYGOMATIC:(600.0,  300.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "above_phi"

    def test_zero_bizygomatic_returns_null(self) -> None:
        lm = _norm_from_map({
            P_FOREHEAD_CROWN: (400.0, 100.0),
            P_MENTON:         (400.0, 700.0),
            P_LEFT_ZYGOMATIC: (400.0, 300.0),   # same x as right → width=0
            P_RIGHT_ZYGOMATIC:(400.0, 300.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is None
        assert mv.confidence_final == 0.0
        assert mv.is_low_confidence is True

    def test_menton_above_crown_returns_null(self) -> None:
        lm = _norm_from_map({
            P_FOREHEAD_CROWN: (400.0, 700.0),   # crown below menton
            P_MENTON:         (400.0, 100.0),   # menton above crown
            P_LEFT_ZYGOMATIC: (200.0, 300.0),
            P_RIGHT_ZYGOMATIC:(600.0, 300.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is None

    def test_presentation_only_in_output(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.presentation_only is True

    def test_confidence_high_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.confidence_final > 0.85

    def test_pose_yaw_penalizes_confidence(self) -> None:
        lm = _norm(perfect_phi_face())
        mv_frontal = self._CALC.compute(lm, _quality(yaw=0.0))
        mv_turned  = self._CALC.compute(lm, _quality(yaw=25.0))
        assert mv_turned.confidence_final < mv_frontal.confidence_final

    def test_pose_extreme_yaw_hits_floor(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality(yaw=30.0))
        # yaw=30 > hard=22 → yaw_pen=floor=0.25; pitch=0 → pitch_pen=1.0
        # combined = 0.25^0.45 * 1.0^0.55 ≈ 0.536; cf ≈ 0.536 * 0.95 ≈ 0.509
        assert mv.confidence_final == pytest.approx(0.25 ** 0.45 * 0.95, abs=0.05)

    def test_dependency_landmarks_include_key_points(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        deps = set(mv.dependency_landmarks)
        for lm_idx in [P_FOREHEAD_CROWN, P_MENTON, P_LEFT_ZYGOMATIC, P_RIGHT_ZYGOMATIC]:
            assert lm_idx in deps


# ---------------------------------------------------------------------------
# phi_lower_face_segments
# ---------------------------------------------------------------------------

class TestPhiLowerFaceSegments:
    _CALC = PhiLowerFaceSegmentsCalculator()

    def test_value_near_phi_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is not None
        assert abs(mv.value - _PHI) < 0.012

    def test_direction_phi_proportionate_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "phi_proportionate"

    def test_direction_above_phi_long_upper_sublabial(self) -> None:
        # upper >> lower → ratio >> φ
        lm = _norm_from_map({
            P_SUBNASALE:  (400.0, 400.0),
            P_LOWER_LIP:  (400.0, 680.0),
            P_MENTON:     (400.0, 730.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "above_phi"

    def test_direction_below_phi_short_upper_sublabial(self) -> None:
        # upper << lower → ratio << φ
        lm = _norm_from_map({
            P_SUBNASALE:  (400.0, 400.0),
            P_LOWER_LIP:  (400.0, 450.0),
            P_MENTON:     (400.0, 730.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "below_phi"

    def test_zero_denominator_returns_null(self) -> None:
        lm = _norm_from_map({
            P_SUBNASALE:  (400.0, 400.0),
            P_LOWER_LIP:  (400.0, 600.0),
            P_MENTON:     (400.0, 600.0),   # same y → denom=0
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is None
        assert mv.confidence_final == 0.0

    def test_inverted_geometry_returns_null(self) -> None:
        lm = _norm_from_map({
            P_SUBNASALE:  (400.0, 600.0),   # below lower_lip
            P_LOWER_LIP:  (400.0, 400.0),   # above subnasale → numer<=0
            P_MENTON:     (400.0, 700.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is None

    def test_dependency_landmarks_include_key_points(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        deps = set(mv.dependency_landmarks)
        assert P_SUBNASALE in deps
        assert P_LOWER_LIP in deps
        assert P_MENTON in deps

    def test_presentation_only_in_output(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.presentation_only is True

    def test_confidence_high_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.confidence_final > 0.85

    def test_pose_pitch_penalizes_confidence(self) -> None:
        lm = _norm(perfect_phi_face())
        mv_frontal = self._CALC.compute(lm, _quality(pitch=0.0))
        mv_tilted  = self._CALC.compute(lm, _quality(pitch=25.0))
        assert mv_tilted.confidence_final < mv_frontal.confidence_final


# ---------------------------------------------------------------------------
# phi_eye_to_mouth
# ---------------------------------------------------------------------------

class TestPhiEyeToMouth:
    _CALC = PhiEyeToMouthCalculator()

    def test_value_near_phi_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is not None
        assert abs(mv.value - _PHI) < 0.012

    def test_direction_phi_proportionate_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "phi_proportionate"

    def test_direction_above_phi_long_eye_to_mouth(self) -> None:
        lm = _norm_from_map({
            P_LEFT_IRIS_CENTER:  (300.0, 300.0),
            P_RIGHT_IRIS_CENTER: (500.0, 300.0),
            P_LEFT_MOUTH:        (350.0, 680.0),
            P_RIGHT_MOUTH:       (450.0, 680.0),
            P_MENTON:            (400.0, 730.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "above_phi"

    def test_direction_below_phi_short_eye_to_mouth(self) -> None:
        lm = _norm_from_map({
            P_LEFT_IRIS_CENTER:  (300.0, 300.0),
            P_RIGHT_IRIS_CENTER: (500.0, 300.0),
            P_LEFT_MOUTH:        (350.0, 360.0),
            P_RIGHT_MOUTH:       (450.0, 360.0),
            P_MENTON:            (400.0, 730.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "below_phi"

    def test_zero_denominator_returns_null(self) -> None:
        lm = _norm_from_map({
            P_LEFT_IRIS_CENTER:  (300.0, 300.0),
            P_RIGHT_IRIS_CENTER: (500.0, 300.0),
            P_LEFT_MOUTH:        (350.0, 600.0),
            P_RIGHT_MOUTH:       (450.0, 600.0),
            P_MENTON:            (400.0, 600.0),   # same y as mouth
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is None
        assert mv.confidence_final == 0.0

    def test_inverted_geometry_returns_null(self) -> None:
        lm = _norm_from_map({
            P_LEFT_IRIS_CENTER:  (300.0, 500.0),   # iris below mouth
            P_RIGHT_IRIS_CENTER: (500.0, 500.0),
            P_LEFT_MOUTH:        (350.0, 350.0),
            P_RIGHT_MOUTH:       (450.0, 350.0),
            P_MENTON:            (400.0, 700.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is None

    def test_dependency_landmarks_include_key_points(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        deps = set(mv.dependency_landmarks)
        assert P_LEFT_IRIS_CENTER in deps
        assert P_RIGHT_IRIS_CENTER in deps
        assert P_LEFT_MOUTH in deps
        assert P_RIGHT_MOUTH in deps
        assert P_MENTON in deps

    def test_presentation_only_in_output(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.presentation_only is True

    def test_confidence_high_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.confidence_final > 0.85


# ---------------------------------------------------------------------------
# phi_nose_to_lip
# ---------------------------------------------------------------------------

class TestPhiNoseToLip:
    _CALC = PhiNoseToLipCalculator()

    def test_value_near_phi_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is not None
        assert abs(mv.value - _PHI) < 0.012

    def test_direction_phi_proportionate_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "phi_proportionate"

    def test_direction_above_phi_wide_mouth(self) -> None:
        lm = _norm_from_map({
            P_LEFT_MOUTH:   (250.0, 450.0),
            P_RIGHT_MOUTH:  (550.0, 450.0),
            P_NOSE_LEFT:    (350.0, 380.0),
            P_NOSE_RIGHT:   (450.0, 380.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "above_phi"

    def test_direction_below_phi_narrow_mouth(self) -> None:
        lm = _norm_from_map({
            P_LEFT_MOUTH:   (350.0, 450.0),
            P_RIGHT_MOUTH:  (450.0, 450.0),
            P_NOSE_LEFT:    (350.0, 380.0),
            P_NOSE_RIGHT:   (450.0, 380.0),
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.direction == "below_phi"

    def test_zero_nose_width_returns_null(self) -> None:
        lm = _norm_from_map({
            P_LEFT_MOUTH:   (325.0, 450.0),
            P_RIGHT_MOUTH:  (475.0, 450.0),
            P_NOSE_LEFT:    (400.0, 380.0),
            P_NOSE_RIGHT:   (400.0, 380.0),   # same x → width=0
        })
        mv = self._CALC.compute(lm, _quality())
        assert mv.value is None
        assert mv.confidence_final == 0.0

    def test_symmetrical_nose_and_mouth(self) -> None:
        # abs() used for widths → swapping L/R should give same value
        lm1 = _norm_from_map({
            P_LEFT_MOUTH:   (325.0, 450.0),
            P_RIGHT_MOUTH:  (475.0, 450.0),
            P_NOSE_LEFT:    (353.64, 380.0),
            P_NOSE_RIGHT:   (446.36, 380.0),
        })
        lm2 = _norm_from_map({
            P_LEFT_MOUTH:   (475.0, 450.0),   # swapped
            P_RIGHT_MOUTH:  (325.0, 450.0),
            P_NOSE_LEFT:    (446.36, 380.0),
            P_NOSE_RIGHT:   (353.64, 380.0),
        })
        mv1 = self._CALC.compute(lm1, _quality())
        mv2 = self._CALC.compute(lm2, _quality())
        assert mv1.value is not None
        assert mv1.value == pytest.approx(mv2.value, abs=1e-5)

    def test_dependency_landmarks_include_key_points(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        deps = set(mv.dependency_landmarks)
        assert P_LEFT_MOUTH in deps
        assert P_RIGHT_MOUTH in deps
        assert P_NOSE_LEFT in deps
        assert P_NOSE_RIGHT in deps

    def test_presentation_only_in_output(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.presentation_only is True

    def test_confidence_high_in_perfect_fixture(self) -> None:
        lm = _norm(perfect_phi_face())
        mv = self._CALC.compute(lm, _quality())
        assert mv.confidence_final > 0.85


# ---------------------------------------------------------------------------
# Pose sensitivity (shared across all four metrics)
# ---------------------------------------------------------------------------

class TestPoseSensitivity:
    _ALL_CALCS = [
        PhiFaceHeightToWidthCalculator(),
        PhiLowerFaceSegmentsCalculator(),
        PhiEyeToMouthCalculator(),
        PhiNoseToLipCalculator(),
    ]
    _IDS = ["height_width", "lower_segments", "eye_mouth", "nose_lip"]

    @pytest.mark.parametrize("calc", _ALL_CALCS, ids=_IDS)
    def test_frontal_confidence_higher_than_yawed(self, calc) -> None:
        lm = _norm(perfect_phi_face())
        mv_frontal = calc.compute(lm, _quality(yaw=0.0))
        mv_yawed   = calc.compute(lm, _quality(yaw=15.0))
        if mv_frontal.value is not None:
            assert mv_frontal.confidence_final > mv_yawed.confidence_final

    @pytest.mark.parametrize("calc", _ALL_CALCS, ids=_IDS)
    def test_soft_yaw_minimal_penalty(self, calc) -> None:
        lm = _norm(perfect_phi_face())
        mv_frontal = calc.compute(lm, _quality(yaw=0.0))
        mv_soft    = calc.compute(lm, _quality(yaw=7.0))
        if mv_frontal.value is not None:
            assert mv_soft.confidence_final > 0.90 * mv_frontal.confidence_final

    @pytest.mark.parametrize("calc", _ALL_CALCS, ids=_IDS)
    def test_hard_yaw_reaches_floor(self, calc) -> None:
        lm = _norm(perfect_phi_face())
        mv = calc.compute(lm, _quality(yaw=25.0))
        if mv.value is not None:
            # yaw=25 > hard=22 → yaw_pen=floor=0.25; pitch=0 → pitch_pen=1.0
            # combined = 0.25^0.45 * 1.0^0.55 ≈ 0.536; cf ≈ 0.509 — well below frontal
            assert mv.confidence_final <= 0.60

    @pytest.mark.parametrize("calc", _ALL_CALCS, ids=_IDS)
    def test_low_quality_score_propagates(self, calc) -> None:
        lm = _norm(perfect_phi_face())
        mv_hq = calc.compute(lm, _quality(quality_score=0.95))
        mv_lq = calc.compute(lm, _quality(quality_score=0.40))
        if mv_hq.value is not None:
            assert mv_lq.confidence_final < mv_hq.confidence_final


# ---------------------------------------------------------------------------
# DEC-6 enforcement — presentation_only=True for all phi metrics
# ---------------------------------------------------------------------------

class TestDec6Enforcement:
    def test_no_phi_metric_has_presentation_only_false(self) -> None:
        for calc_cls in (
            PhiFaceHeightToWidthCalculator,
            PhiLowerFaceSegmentsCalculator,
            PhiEyeToMouthCalculator,
            PhiNoseToLipCalculator,
        ):
            assert calc_cls().presentation_only is True, (
                f"{calc_cls.__name__} must be presentation_only=True (DEC-6)"
            )

    def test_metric_value_carries_presentation_only_flag(self) -> None:
        lm = _norm(perfect_phi_face())
        q = _quality()
        for calc_cls in (
            PhiFaceHeightToWidthCalculator,
            PhiLowerFaceSegmentsCalculator,
            PhiEyeToMouthCalculator,
            PhiNoseToLipCalculator,
        ):
            mv = calc_cls().compute(lm, q)
            assert mv.presentation_only is True, (
                f"{calc_cls.__name__}: MetricValue.presentation_only must be True"
            )


# ---------------------------------------------------------------------------
# Direction threshold boundaries
# ---------------------------------------------------------------------------

class TestDirectionThresholds:
    def test_exactly_phi_is_phi_proportionate(self) -> None:
        assert _phi_direction(_PHI) == "phi_proportionate"

    def test_just_above_tolerance_is_above_phi(self) -> None:
        just_above = _PHI + _PHI_TOLERANCE + 0.001
        assert _phi_direction(just_above) == "above_phi"

    def test_just_below_tolerance_is_below_phi(self) -> None:
        just_below = _PHI - _PHI_TOLERANCE - 0.001
        assert _phi_direction(just_below) == "below_phi"

    def test_upper_tolerance_boundary_is_phi_proportionate(self) -> None:
        at_boundary = _PHI + _PHI_TOLERANCE - 0.0001
        assert _phi_direction(at_boundary) == "phi_proportionate"

    def test_lower_tolerance_boundary_is_phi_proportionate(self) -> None:
        at_boundary = _PHI - _PHI_TOLERANCE + 0.0001
        assert _phi_direction(at_boundary) == "phi_proportionate"

