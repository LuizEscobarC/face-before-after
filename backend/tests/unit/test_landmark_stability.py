"""Unit tests for landmark stability analysis (PR-23).

Covers:
- Single-frame: perfect stability (no variance possible).
- Multi-frame: identical frames → stability = 1.0 for all landmarks.
- Multi-frame: controlled Gaussian noise → stability decreases predictably.
- Edge cases: empty frames, degenerate ICD, inconsistent shapes.
- stability_factor_for_metric: all-stable deps, mixed-stability deps,
  unknown dep indices, empty deps.
- landmark_stability_penalty in confidence_propagation: integration.
- QualityContext: new fields, defaults, backwards compatibility.
- propagate(): step-4 (stability) applied correctly when args provided;
  old call signature (without stability args) unchanged.
- Router-level: LandmarkStabilitySchema serialisation smoke test.

Sources cited in landmark_stability.py:
- Bookstein FL (1991). Morphometric Tools for Landmark Data. CUP.
- Cootes TF et al. (1995). Active Shape Models. CVIU 61(1):38–59.
- Bulat A, Tzimiropoulos G (2017). Face Alignment, ICCV. arXiv:1703.07332.
- Google MediaPipe Face Mesh: https://github.com/google/mediapipe
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from app.domain.landmarks_mesh import (
    P_LEFT_EYE_INNER,
    P_RIGHT_EYE_INNER,
    TOTAL_LANDMARKS,
)
from app.services.landmark_stability import (
    STABILITY_SLOPE,
    LandmarkStabilityResult,
    compute_stability,
    stability_factor_for_metric,
    _estimate_icd_px,
)
from app.services.metrics.base import QualityContext
from app.services.metrics.confidence_propagation import (
    LOW_CONF_THRESHOLD,
    landmark_stability_penalty,
    propagate,
)


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

_N = TOTAL_LANDMARKS   # 478
_ICD_PX = 100.0        # convenient reference ICD for test geometry

# Minimal (N,3) pixel frame: all zeros except inner canthi placed at ICD apart
def _base_frame(icd: float = _ICD_PX) -> np.ndarray:
    """Return a (478, 3) pixel-coordinate array with a well-defined ICD."""
    pts = np.zeros((_N, 3), dtype=np.float64)
    pts[P_LEFT_EYE_INNER]  = [400.0 - icd / 2.0, 300.0, 0.0]
    pts[P_RIGHT_EYE_INNER] = [400.0 + icd / 2.0, 300.0, 0.0]
    return pts


# ---------------------------------------------------------------------------
# 1. LandmarkStabilityResult: single-frame shortcut
# ---------------------------------------------------------------------------

class TestSingleFrame:
    def test_returns_all_ones(self):
        frame = _base_frame()
        result = compute_stability([frame])
        assert result.capture_count == 1
        np.testing.assert_allclose(result.scores, np.ones(_N), atol=1e-9)

    def test_global_instability_is_zero(self):
        result = compute_stability([_base_frame()])
        assert result.global_instability_index == pytest.approx(0.0, abs=1e-9)

    def test_averaged_landmarks_equals_input(self):
        frame = _base_frame()
        result = compute_stability([frame])
        np.testing.assert_allclose(result.averaged_landmarks, frame, atol=1e-12)

    def test_icd_px_estimated(self):
        result = compute_stability([_base_frame(icd=120.0)])
        assert result.icd_px == pytest.approx(120.0, rel=1e-6)

    def test_scores_list_length(self):
        result = compute_stability([_base_frame()])
        assert len(result.to_scores_list()) == _N


# ---------------------------------------------------------------------------
# 2. Multi-frame: identical frames → perfect stability
# ---------------------------------------------------------------------------

class TestIdenticalFrames:
    def test_three_identical_frames_all_ones(self):
        frame = _base_frame()
        result = compute_stability([frame, frame.copy(), frame.copy()])
        assert result.capture_count == 3
        np.testing.assert_allclose(result.scores, np.ones(_N), atol=1e-9)

    def test_averaged_landmarks_equals_each_frame(self):
        frame = _base_frame()
        result = compute_stability([frame, frame.copy()])
        np.testing.assert_allclose(result.averaged_landmarks, frame, atol=1e-12)

    def test_global_instability_zero(self):
        frame = _base_frame()
        result = compute_stability([frame, frame.copy(), frame.copy()])
        assert result.global_instability_index == pytest.approx(0.0, abs=1e-9)


# ---------------------------------------------------------------------------
# 3. Multi-frame: controlled noise → predictable stability
# ---------------------------------------------------------------------------

class TestControlledNoise:
    def _noisy_frames(
        self, n_frames: int, lm_index: int, sigma_px: float, seed: int = 42
    ) -> list[np.ndarray]:
        """Create n_frames where landmark lm_index is perturbed by sigma_px."""
        rng = np.random.default_rng(seed)
        base = _base_frame()
        frames = []
        for _ in range(n_frames):
            f = base.copy()
            f[lm_index, 0] += rng.normal(0, sigma_px)
            f[lm_index, 1] += rng.normal(0, sigma_px)
            frames.append(f)
        return frames

    def test_large_noise_reduces_stability(self):
        """sigma = 0.15 ICD → stability should be < 0.50."""
        sigma = 0.15 * _ICD_PX   # 15 px for 100-px ICD
        frames = self._noisy_frames(20, lm_index=0, sigma_px=sigma)
        result = compute_stability(frames)
        # For lm 0 the expected stability ≈ max(0, 1 - SLOPE * sigma/ICD)
        # = max(0, 1 - 5 * 0.15) = max(0, 0.25) = 0.25
        # Allow ±0.15 tolerance due to finite-sample variance
        assert result.scores[0] < 0.50

    def test_small_noise_high_stability(self):
        """sigma = 0.02 ICD → stability should be close to 1.0."""
        sigma = 0.02 * _ICD_PX   # 2 px for 100-px ICD
        frames = self._noisy_frames(30, lm_index=5, sigma_px=sigma)
        result = compute_stability(frames)
        # Expected ≈ max(0, 1 - 5 * 0.02) = 0.90  (RMS uses both axes)
        assert result.scores[5] > 0.70

    def test_undisturbed_landmarks_remain_stable(self):
        """Landmarks not in the noise set stay at stability = 1.0."""
        frames = self._noisy_frames(10, lm_index=0, sigma_px=20.0)
        result = compute_stability(frames)
        # Landmark 1 was not touched → should be 1.0
        assert result.scores[1] == pytest.approx(1.0, abs=1e-9)

    def test_averaged_landmarks_near_mean(self):
        """Averaged coordinates should be close to the noiseless baseline."""
        frames = self._noisy_frames(100, lm_index=10, sigma_px=5.0)
        result = compute_stability(frames)
        base = _base_frame()
        # All landmarks except #10 should exactly match base
        np.testing.assert_allclose(result.averaged_landmarks[0], base[0], atol=1e-9)
        # Landmark 10 x/y should be close to base (noise averages out over 100 frames)
        np.testing.assert_allclose(
            result.averaged_landmarks[10, :2], base[10, :2], atol=2.0  # within 2 px
        )

    def test_stability_scores_in_range(self):
        """All stability scores must be in [0, 1]."""
        rng = np.random.default_rng(0)
        base = _base_frame()
        frames = [base + rng.normal(0, 8.0, base.shape) for _ in range(10)]
        result = compute_stability(frames)
        assert float(result.scores.min()) >= 0.0
        assert float(result.scores.max()) <= 1.0

    def test_global_instability_in_range(self):
        """global_instability_index must be in [0, 1]."""
        rng = np.random.default_rng(1)
        base = _base_frame()
        frames = [base + rng.normal(0, 5.0, base.shape) for _ in range(5)]
        result = compute_stability(frames)
        assert 0.0 <= result.global_instability_index <= 1.0

    def test_more_noise_lower_stability(self):
        """Higher sigma → lower per-landmark stability score (monotonic relationship)."""
        rng = np.random.default_rng(7)
        base = _base_frame()
        n_frames = 30

        # Low noise: sigma = 2 px ≈ 0.02 ICD
        low_frames = [base + rng.normal(0, 2.0, base.shape) for _ in range(n_frames)]
        low_result = compute_stability(low_frames)

        # High noise: sigma = 15 px ≈ 0.15 ICD
        rng2 = np.random.default_rng(8)
        high_frames = [base + rng2.normal(0, 15.0, base.shape) for _ in range(n_frames)]
        high_result = compute_stability(high_frames)

        # Mean stability should be higher for low-noise than high-noise
        assert low_result.scores.mean() > high_result.scores.mean()


# ---------------------------------------------------------------------------
# 4. Edge cases for compute_stability
# ---------------------------------------------------------------------------

class TestComputeStabilityEdgeCases:
    def test_empty_frames_raises(self):
        with pytest.raises(ValueError, match="frames must not be empty"):
            compute_stability([])

    def test_shape_2d_accepted(self):
        """(N, 2) frames are silently upgraded to (N, 3)."""
        frame_2d = np.zeros((_N, 2), dtype=np.float64)
        frame_2d[P_LEFT_EYE_INNER]  = [350.0, 300.0]
        frame_2d[P_RIGHT_EYE_INNER] = [450.0, 300.0]
        result = compute_stability([frame_2d, frame_2d.copy()])
        assert result.capture_count == 2
        assert result.averaged_landmarks.shape == (_N, 3)

    def test_inconsistent_shapes_raises(self):
        frame_a = _base_frame()
        frame_b = np.zeros((400, 3), dtype=np.float64)  # wrong N
        with pytest.raises(ValueError, match="same number of landmarks"):
            compute_stability([frame_a, frame_b])

    def test_wrong_shape_raises(self):
        with pytest.raises(ValueError, match="shape"):
            compute_stability([np.zeros((_N, 4))])

    def test_degenerate_icd_returns_all_ones(self):
        """When ICD < 1.0 (inner canthi coincide) → return all-ones stability."""
        frame = np.zeros((_N, 3), dtype=np.float64)
        # Leave P_LEFT_EYE_INNER and P_RIGHT_EYE_INNER at [0,0,0] → ICD = 0
        frames = [frame, frame.copy() + 0.1]
        result = compute_stability(frames)
        np.testing.assert_allclose(result.scores, np.ones(_N), atol=1e-9)


# ---------------------------------------------------------------------------
# 5. _estimate_icd_px
# ---------------------------------------------------------------------------

class TestEstimateIcdPx:
    def test_known_icd(self):
        frame = _base_frame(icd=80.0)
        assert _estimate_icd_px(frame) == pytest.approx(80.0, rel=1e-6)

    def test_too_few_landmarks(self):
        """Frame with fewer rows than canthus indices → returns 1.0."""
        small = np.zeros((10, 3), dtype=np.float64)
        result = _estimate_icd_px(small)
        assert result == pytest.approx(1.0)


# ---------------------------------------------------------------------------
# 6. stability_factor_for_metric
# ---------------------------------------------------------------------------

class TestStabilityFactorForMetric:
    def test_all_ones_returns_one(self):
        scores = [1.0] * _N
        factor = stability_factor_for_metric(scores, [0, 1, 2, 10, 100])
        assert factor == pytest.approx(1.0, abs=1e-9)

    def test_all_zeros_returns_zero(self):
        scores = [0.0] * _N
        factor = stability_factor_for_metric(scores, [0, 1, 2])
        assert factor == pytest.approx(0.0, abs=1e-9)

    def test_mixed_returns_mean(self):
        scores = [1.0] * _N
        scores[5] = 0.0   # one unstable dep landmark
        factor = stability_factor_for_metric(scores, [5, 10])
        # mean([0.0, 1.0]) = 0.5
        assert factor == pytest.approx(0.5, abs=1e-6)

    def test_empty_dep_returns_one(self):
        scores = [0.5] * _N
        factor = stability_factor_for_metric(scores, [])
        assert factor == pytest.approx(1.0, abs=1e-9)

    def test_out_of_range_indices_ignored(self):
        """Indices ≥ len(scores) are silently skipped."""
        scores = [0.8, 0.9]          # only 2 scores
        factor = stability_factor_for_metric(scores, [0, 1, 999])
        # Valid: indices 0 (0.8) and 1 (0.9) → mean = 0.85
        assert factor == pytest.approx(0.85, abs=1e-9)

    def test_all_out_of_range_returns_one(self):
        scores = [0.5, 0.5]
        factor = stability_factor_for_metric(scores, [999, 1000])
        assert factor == pytest.approx(1.0, abs=1e-9)

    def test_empty_scores_returns_one(self):
        factor = stability_factor_for_metric([], [0, 1, 2])
        assert factor == pytest.approx(1.0, abs=1e-9)

    def test_numpy_array_accepted(self):
        scores = np.array([1.0, 0.6, 0.8])
        factor = stability_factor_for_metric(scores, [0, 1, 2])
        assert factor == pytest.approx((1.0 + 0.6 + 0.8) / 3, abs=1e-9)


# ---------------------------------------------------------------------------
# 7. landmark_stability_penalty
# ---------------------------------------------------------------------------

class TestLandmarkStabilityPenalty:
    def test_none_scores_returns_one(self):
        assert landmark_stability_penalty(None, [0, 1, 2]) == pytest.approx(1.0)

    def test_empty_dep_returns_one(self):
        assert landmark_stability_penalty([1.0] * _N, []) == pytest.approx(1.0)

    def test_all_stable_returns_one(self):
        scores = [1.0] * _N
        assert landmark_stability_penalty(scores, [33, 133, 263]) == pytest.approx(1.0)

    def test_all_unstable_returns_zero(self):
        scores = [0.0] * _N
        assert landmark_stability_penalty(scores, [33, 133, 263]) == pytest.approx(0.0)

    def test_partial_instability(self):
        scores = [1.0] * _N
        scores[33]  = 0.5
        scores[133] = 0.5
        pen = landmark_stability_penalty(scores, [33, 133, 263])
        assert pen == pytest.approx((0.5 + 0.5 + 1.0) / 3, abs=1e-9)


# ---------------------------------------------------------------------------
# 8. propagate() — step-4 integration
# ---------------------------------------------------------------------------

class TestPropagateWithStability:
    def _ctx(self) -> dict:
        return dict(
            confidence_raw=1.0,
            quality_score=1.0,
            region="eyes",
            regional_penalties={},
            yaw_deg=0.0,
            pitch_deg=0.0,
        )

    def test_no_stability_args_unchanged(self):
        """Old call signature (no stability args) must produce same result."""
        result = propagate(**self._ctx())
        assert result == pytest.approx(1.0, abs=1e-9)

    def test_none_stability_scores_unchanged(self):
        result = propagate(**self._ctx(), stability_scores=None, dependency_landmarks=[33, 133])
        assert result == pytest.approx(1.0, abs=1e-9)

    def test_all_stable_no_change(self):
        scores = [1.0] * _N
        result = propagate(**self._ctx(), stability_scores=scores, dependency_landmarks=[33, 133])
        assert result == pytest.approx(1.0, abs=1e-9)

    def test_half_stability_halves_confidence(self):
        scores = [0.5] * _N
        result = propagate(**self._ctx(), stability_scores=scores, dependency_landmarks=[33, 133])
        assert result == pytest.approx(0.5, abs=1e-9)

    def test_zero_stability_zeroes_confidence(self):
        scores = [0.0] * _N
        result = propagate(**self._ctx(), stability_scores=scores, dependency_landmarks=[33, 133])
        assert result == pytest.approx(0.0, abs=1e-9)

    def test_composes_with_pose_penalty(self):
        """Stability compounds with pose penalty multiplicatively."""
        scores = [0.8] * _N
        # yaw=10°, soft=5°, hard=15° → pose_penalty ≈ 0.6 (linear interpolation)
        from app.services.metrics.confidence_propagation import (
            SYMMETRY_POSE_PARAMS,
            pose_penalty,
        )
        expected_pose = pose_penalty(10.0, 0.0, SYMMETRY_POSE_PARAMS)
        result = propagate(
            1.0, 1.0, "symmetry", {},
            yaw_deg=10.0, pitch_deg=0.0,
            pose_params=SYMMETRY_POSE_PARAMS,
            stability_scores=scores,
            dependency_landmarks=[33, 133, 263],
        )
        assert result == pytest.approx(expected_pose * 0.8, abs=1e-6)

    def test_empty_dep_no_stability_penalty(self):
        """When dependency_landmarks is [] → no stability penalty even with scores."""
        scores = [0.0] * _N
        result = propagate(**self._ctx(), stability_scores=scores, dependency_landmarks=[])
        assert result == pytest.approx(1.0, abs=1e-9)

    def test_result_clipped_to_one(self):
        """confidence_final must not exceed 1.0."""
        scores = [1.0] * _N
        result = propagate(
            2.0, 1.0, "eyes", {},  # confidence_raw > 1 (edge case)
            stability_scores=scores,
            dependency_landmarks=[33],
        )
        assert result <= 1.0


# ---------------------------------------------------------------------------
# 9. QualityContext — new fields
# ---------------------------------------------------------------------------

class TestQualityContextNewFields:
    def test_default_stability_scores_is_none(self):
        ctx = QualityContext()
        assert ctx.landmark_stability_scores is None

    def test_default_capture_count_is_one(self):
        ctx = QualityContext()
        assert ctx.capture_count == 1

    def test_accepts_stability_scores(self):
        scores = [1.0] * _N
        ctx = QualityContext(landmark_stability_scores=scores, capture_count=5)
        assert ctx.landmark_stability_scores is scores
        assert ctx.capture_count == 5

    def test_pose_accessors_unchanged(self):
        ctx = QualityContext(
            quality_score=0.9,
            pose={"yaw": 5.0, "pitch": -2.0, "roll": 1.0},
        )
        assert ctx.get_yaw() == pytest.approx(5.0)
        assert ctx.get_pitch() == pytest.approx(-2.0)
        assert ctx.get_roll() == pytest.approx(1.0)

    def test_existing_callers_backward_compat(self):
        """Old QualityContext(...) construction without stability args still works."""
        ctx = QualityContext(
            quality_score=0.85,
            regional_penalties={"jaw": 0.1},
            pose={"yaw": 3.0},
        )
        assert ctx.landmark_stability_scores is None
        assert ctx.capture_count == 1


# ---------------------------------------------------------------------------
# 10. LandmarkStabilityResult.to_scores_list
# ---------------------------------------------------------------------------

class TestToScoresList:
    def test_returns_list_of_floats(self):
        result = compute_stability([_base_frame()])
        lst = result.to_scores_list()
        assert isinstance(lst, list)
        assert all(isinstance(v, float) for v in lst)

    def test_length_matches_n(self):
        result = compute_stability([_base_frame()])
        assert len(result.to_scores_list()) == _N

    def test_json_serialisable(self):
        import json
        result = compute_stability([_base_frame()])
        json.dumps(result.to_scores_list())  # must not raise


# ---------------------------------------------------------------------------
# 11. STABILITY_SLOPE constant sanity checks
# ---------------------------------------------------------------------------

class TestStabilitySlopeCalibration:
    def test_threshold_at_20pct_icd(self):
        """Per spec: sigma = 0.20 ICD → stability = 0.0."""
        expected = max(0.0, 1.0 - STABILITY_SLOPE * 0.20)
        assert expected == pytest.approx(0.0, abs=1e-9)

    def test_at_10pct_icd_half_stability(self):
        """sigma = 0.10 ICD → stability = 0.5."""
        expected = max(0.0, 1.0 - STABILITY_SLOPE * 0.10)
        assert expected == pytest.approx(0.5, abs=1e-9)

    def test_zero_sigma_full_stability(self):
        """sigma = 0 → stability = 1.0."""
        expected = max(0.0, 1.0 - STABILITY_SLOPE * 0.0)
        assert expected == pytest.approx(1.0, abs=1e-9)
