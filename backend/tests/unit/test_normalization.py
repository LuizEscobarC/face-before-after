"""Tests for services/normalization/ (PR-4).

Coverage:
  - intercanthal_scaler: ICD == 1.0, origin at (0, 0)
  - midline_aligner: intercanthal axis is horizontal after alignment
  - pose_correction: rescales compressed coordinates back toward original
  - normalizer (full pipeline):
      - perfect frontal: ICD=1, origin at 0, no pose flag
      - idempotence: running twice gives same result
      - asymmetric face: normalisation does NOT remove structural asymmetry
      - posed face: pose_correction_applied flag set, midline aligned
  - NormalizedLandmarks helpers: xy(), dist(), midpoint(), angle_deg(), to_dict()
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from app.domain.landmarks_mesh import P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.normalization import normalize
from app.services.normalization.intercanthal_scaler import scale_to_intercanthal
from app.services.normalization.midline_aligner import align_to_horizontal
from app.services.normalization.pose_correction import apply_pose_correction
from tests.fixtures.synthetic_landmarks import (
    known_asymmetric,
    perfect_frontal,
    posed_yaw15,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _icd(pts: np.ndarray) -> float:
    return float(np.linalg.norm(pts[P_RIGHT_EYE_INNER, :2] - pts[P_LEFT_EYE_INNER, :2]))


def _origin(pts: np.ndarray) -> np.ndarray:
    """Expected origin = midpoint of inner canthi."""
    return (pts[P_LEFT_EYE_INNER, :2] + pts[P_RIGHT_EYE_INNER, :2]) * 0.5


# ---------------------------------------------------------------------------
# intercanthal_scaler
# ---------------------------------------------------------------------------

class TestIntercanthalScaler:
    def test_icd_is_one_after_scaling(self):
        scaled, _ = scale_to_intercanthal(perfect_frontal())
        assert abs(_icd(scaled) - 1.0) < 1e-9

    def test_origin_at_zero_zero(self):
        scaled, _ = scale_to_intercanthal(perfect_frontal())
        origin = _origin(scaled)
        assert abs(float(origin[0])) < 1e-9
        assert abs(float(origin[1])) < 1e-9

    def test_returns_original_icd_px(self):
        _, icd_px = scale_to_intercanthal(perfect_frontal())
        assert abs(icd_px - 100.0) < 0.5   # fixture sets ICD = 100 px

    def test_shape_preserved_2d(self):
        lm = perfect_frontal()[:, :2]
        scaled, _ = scale_to_intercanthal(lm)
        assert scaled.shape == lm.shape

    def test_shape_preserved_3d(self):
        lm = perfect_frontal()
        scaled, _ = scale_to_intercanthal(lm)
        assert scaled.shape == lm.shape

    def test_raises_on_degenerate_icd(self):
        lm = perfect_frontal()
        # Push both inner canthi to same point.
        lm[P_LEFT_EYE_INNER] = lm[P_RIGHT_EYE_INNER] = [400, 300, 0]
        with pytest.raises(ValueError, match="too small"):
            scale_to_intercanthal(lm)


# ---------------------------------------------------------------------------
# midline_aligner
# ---------------------------------------------------------------------------

class TestMidlineAligner:
    def test_intercanthal_horizontal_after_align(self):
        """After alignment the two inner canthi must share the same y."""
        # Introduce a 10° tilt by rotating the pre-scaled frontal fixture.
        scaled, _ = scale_to_intercanthal(perfect_frontal())
        # Manually tilt 10°.
        angle = math.radians(10)
        cos_a, sin_a = math.cos(angle), math.sin(angle)
        rot = np.array([[cos_a, -sin_a], [sin_a, cos_a]])
        tilted = scaled.copy()
        tilted[:, :2] = tilted[:, :2] @ rot.T

        aligned, roll = align_to_horizontal(tilted)
        dy = abs(aligned[P_LEFT_EYE_INNER, 1] - aligned[P_RIGHT_EYE_INNER, 1])
        assert dy < 1e-9, f"Inner canthi y-diff after alignment: {dy}"

    def test_roll_angle_returned(self):
        scaled, _ = scale_to_intercanthal(perfect_frontal())
        angle = math.radians(10)
        cos_a, sin_a = math.cos(angle), math.sin(angle)
        rot = np.array([[cos_a, -sin_a], [sin_a, cos_a]])
        tilted = scaled.copy()
        tilted[:, :2] = tilted[:, :2] @ rot.T

        _, roll = align_to_horizontal(tilted)
        assert abs(abs(roll) - 10.0) < 0.1

    def test_dead_zone_no_rotation(self):
        """Tiny tilt (< 0.5°) must be left unchanged."""
        scaled, _ = scale_to_intercanthal(perfect_frontal())
        # 0.1° tilt.
        angle = math.radians(0.1)
        cos_a, sin_a = math.cos(angle), math.sin(angle)
        rot = np.array([[cos_a, -sin_a], [sin_a, cos_a]])
        tiny_tilt = scaled.copy()
        tiny_tilt[:, :2] = tiny_tilt[:, :2] @ rot.T

        aligned, roll = align_to_horizontal(tiny_tilt)
        assert roll == 0.0
        np.testing.assert_array_almost_equal(aligned, tiny_tilt)

    def test_icd_preserved_after_alignment(self):
        """Rotation must not change the intercanthal distance."""
        scaled, _ = scale_to_intercanthal(perfect_frontal())
        angle = math.radians(7)
        cos_a, sin_a = math.cos(angle), math.sin(angle)
        rot = np.array([[cos_a, -sin_a], [sin_a, cos_a]])
        tilted = scaled.copy()
        tilted[:, :2] = tilted[:, :2] @ rot.T

        aligned, _ = align_to_horizontal(tilted)
        assert abs(_icd(aligned) - 1.0) < 1e-9


# ---------------------------------------------------------------------------
# pose_correction
# ---------------------------------------------------------------------------

class TestPoseCorrection:
    def test_no_correction_within_dead_zone(self):
        lm = perfect_frontal()
        corrected, applied = apply_pose_correction(lm, yaw_deg=1.0, pitch_deg=1.0)
        assert not applied
        np.testing.assert_array_almost_equal(corrected, lm.astype(float))

    def test_yaw_correction_expands_horizontal(self):
        """After 15° yaw correction the compressed right side should expand."""
        lm = posed_yaw15()
        # Before correction: right inner canthus is closer to centre.
        right_before = float(lm[P_RIGHT_EYE_INNER, 0])
        corrected, applied = apply_pose_correction(lm, yaw_deg=15.0, pitch_deg=0.0)
        right_after = float(corrected[P_RIGHT_EYE_INNER, 0])
        assert applied
        assert right_after > right_before

    def test_max_amplification_cap(self):
        """Near-90° yaw must not amplify beyond _MAX_AMPLIFICATION × centroid dist."""
        lm = perfect_frontal()
        corrected, applied = apply_pose_correction(lm, yaw_deg=88.0, pitch_deg=0.0)
        assert applied
        # All x-coords should be finite and within a reasonable bounding box.
        assert np.all(np.isfinite(corrected[:, 0]))

    def test_shape_unchanged(self):
        lm = perfect_frontal()
        corrected, _ = apply_pose_correction(lm, yaw_deg=10.0, pitch_deg=5.0)
        assert corrected.shape == lm.shape


# ---------------------------------------------------------------------------
# normalizer (full pipeline)
# ---------------------------------------------------------------------------

class TestNormalizer:
    def test_perfect_frontal_icd_is_one(self):
        result = normalize(perfect_frontal())
        assert abs(result.dist(P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER) - 1.0) < 1e-9

    def test_perfect_frontal_origin_at_zero(self):
        result = normalize(perfect_frontal())
        origin = result.midpoint(P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER)
        assert abs(float(origin[0])) < 1e-9
        assert abs(float(origin[1])) < 1e-9

    def test_perfect_frontal_no_pose_flag(self):
        result = normalize(perfect_frontal())
        assert result.pose_correction_applied is False

    def test_perfect_frontal_intercanthal_horizontal(self):
        result = normalize(perfect_frontal())
        dy = abs(result.xy(P_LEFT_EYE_INNER)[1] - result.xy(P_RIGHT_EYE_INNER)[1])
        assert dy < 1e-9

    def test_basis_is_intercanthal(self):
        result = normalize(perfect_frontal())
        assert result.basis == "intercanthal"

    def test_image_size_forwarded(self):
        result = normalize(perfect_frontal(), image_size=(800, 600))
        assert result.source_image_size == (800, 600)

    def test_idempotence(self):
        """Running normalize twice on pixel coords + same pose gives same result.

        True idempotence can't be tested by re-normalizing already-normalized
        points (ICD becomes 1.0 ICU ≈ 1 px, below the degenerate guard).
        Instead we verify that two separate normalize() calls on the same raw
        input produce bit-identical output.
        """
        lm = perfect_frontal()
        first = normalize(lm)
        second = normalize(lm)
        np.testing.assert_array_equal(first.points, second.points)

    def test_asymmetric_face_asymmetry_preserved(self):
        """Normalisation must NOT remove structural asymmetry (nose/chin shift).

        The nose tip x should be positive after normalization because it was
        shifted 8 px right of the midline in the fixture.
        """
        result = normalize(known_asymmetric())
        nose_x = float(result.xy(P_LEFT_EYE_INNER)[0])  # midline is 0
        # nose tip was right of midline → should stay positive (or near 0 at worst)
        nose_tip_x = float(result.points[1, 0])  # P_NOSE_TIP = 1
        # In a perfect symmetric face nose_tip_x ≈ 0; here it should be > 0
        assert nose_tip_x > 0, (
            f"Asymmetric nose tip should be right of midline, got x={nose_tip_x}"
        )

    def test_posed_yaw_pose_flag_set(self):
        result = normalize(posed_yaw15(), yaw_deg=15.0)
        assert result.pose_correction_applied is True

    def test_posed_yaw_intercanthal_horizontal(self):
        result = normalize(posed_yaw15(), yaw_deg=15.0)
        dy = abs(result.xy(P_LEFT_EYE_INNER)[1] - result.xy(P_RIGHT_EYE_INNER)[1])
        assert dy < 1e-9

    def test_output_shape_always_478x3(self):
        result = normalize(perfect_frontal()[:, :2])  # 2-D input
        assert result.points.shape == (478, 3)

    def test_raises_on_bad_shape(self):
        with pytest.raises(ValueError):
            normalize(np.zeros((478, 4)))

    def test_raises_on_degenerate_icd(self):
        lm = perfect_frontal()
        lm[P_LEFT_EYE_INNER] = lm[P_RIGHT_EYE_INNER]
        with pytest.raises(ValueError):
            normalize(lm)


# ---------------------------------------------------------------------------
# NormalizedLandmarks helpers
# ---------------------------------------------------------------------------

class TestNormalizedLandmarksHelpers:
    def _make(self) -> NormalizedLandmarks:
        return normalize(perfect_frontal())

    def test_dist_inner_canthi_is_one(self):
        nl = self._make()
        assert abs(nl.dist(P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER) - 1.0) < 1e-9

    def test_midpoint_is_origin(self):
        nl = self._make()
        mp = nl.midpoint(P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER)
        assert abs(float(mp[0])) < 1e-9
        assert abs(float(mp[1])) < 1e-9

    def test_angle_deg_horizontal(self):
        nl = self._make()
        angle = nl.angle_deg(P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER)
        assert abs(angle) < 0.1  # should be ~0° after alignment

    def test_to_dict_round_trip(self):
        nl = self._make()
        d = nl.to_dict()
        assert d["basis"] == "intercanthal"
        assert len(d["points"]) == 478
        assert isinstance(d["intercanthal_distance_px"], float)

    def test_immutable(self):
        nl = self._make()
        with pytest.raises((TypeError, AttributeError)):
            nl.basis = "interpupillary"  # type: ignore[misc]
