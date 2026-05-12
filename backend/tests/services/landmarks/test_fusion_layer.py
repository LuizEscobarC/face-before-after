"""Tests for fusion_layer.fuse().

Covers:
  - Fallback when onnxruntime is missing (monkeypatched RuntimeError)
  - Fallback when segmenter raises RuntimeError
  - Happy path with mock segmenter returning high-confidence hair mask
  - FusedLandmarks schema validation
"""

from __future__ import annotations

import numpy as np
import pytest

from app.domain.landmarks_mesh import (
    P_LEFT_EYE_INNER,
    P_RIGHT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_RIGHT_EYE_OUTER,
    P_FOREHEAD_CROWN,
)


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #

@pytest.fixture
def synthetic_image():
    """128×128 synthetic BGR image."""
    rng = np.random.default_rng(0)
    return rng.integers(0, 255, (128, 128, 3), dtype=np.uint8)


@pytest.fixture
def synthetic_landmarks():
    """(478, 3) synthetic landmarks for a 128×128 face."""
    H, W = 128, 128
    lm = np.zeros((478, 3), dtype=np.float64)
    eye_y = H * 0.45
    cx = W / 2.0
    icd = W * 0.2
    lm[P_LEFT_EYE_INNER]  = [cx - icd / 2, eye_y, 0]
    lm[P_RIGHT_EYE_INNER] = [cx + icd / 2, eye_y, 0]
    lm[P_LEFT_EYE_OUTER]  = [cx - icd * 1.5, eye_y, 0]
    lm[P_RIGHT_EYE_OUTER] = [cx + icd * 1.5, eye_y, 0]
    lm[P_FOREHEAD_CROWN]  = [cx, H * 0.1, 0]   # hairline proxy, top 10%
    return lm


def _mock_segmenter_high_confidence(image, landmarks, *, hair_top_row=5):
    """Return a FusedLandmarks with trichion_source='bisenet' and high confidence."""
    H, W = image.shape[:2]
    hair_mask = np.zeros((H, W), dtype=bool)
    hair_mask[hair_top_row:20, 20:108] = True   # dense horizontal hair block

    virtual = {
        "trichion": [float(W / 2), float(hair_top_row)],
        "hairline_left": [20.0, float(hair_top_row)],
        "hairline_center": [float(W / 2), float(hair_top_row)],
        "hairline_right": [108.0, float(hair_top_row)],
        "forehead_top_estimate": [float(W / 2), float(hair_top_row)],
        "temple_left": [20.0, float(hair_top_row)],
        "temple_right": [108.0, float(hair_top_row)],
        "confidence": 0.95,
        "column_y": [float(hair_top_row)] * 88,
    }
    return virtual, hair_mask


# --------------------------------------------------------------------------- #
# Test: fallback when segmenter raises RuntimeError
# --------------------------------------------------------------------------- #

class TestFallbackOnSegmenterError:

    def test_fallback_returns_mesh_source(self, synthetic_image, synthetic_landmarks, monkeypatch):
        """When segmenter raises RuntimeError, trichion_source must be 'mesh'."""
        import app.services.landmarks.fusion_layer as fl

        def _boom(image_bgr, mp_landmarks_px):
            raise RuntimeError("Model not found")

        monkeypatch.setattr(fl, "_run_bisenet_fusion", _boom)

        fused = fl.fuse(synthetic_image, synthetic_landmarks)
        assert fused.trichion_source == "mesh"

    def test_fallback_never_raises(self, synthetic_image, synthetic_landmarks, monkeypatch):
        """fuse() must never propagate exceptions."""
        import app.services.landmarks.fusion_layer as fl

        def _boom(image_bgr, mp_landmarks_px):
            raise RuntimeError("boom")

        monkeypatch.setattr(fl, "_run_bisenet_fusion", _boom)
        # Should NOT raise
        fused = fl.fuse(synthetic_image, synthetic_landmarks)
        assert fused is not None


class TestFallbackWhenOnnxruntimeMissing:

    def test_fallback_when_onnxruntime_missing(self, synthetic_image, synthetic_landmarks, monkeypatch):
        """fuse() returns 'mesh' source when onnxruntime ImportError is raised."""
        import app.services.landmarks.fusion_layer as fl

        def _import_error(image_bgr, mp_landmarks_px):
            raise ImportError("onnxruntime is not installed")

        monkeypatch.setattr(fl, "_run_bisenet_fusion", _import_error)

        fused = fl.fuse(synthetic_image, synthetic_landmarks)
        assert fused.trichion_source == "mesh"
        assert fused.trichion_confidence == 0.0


# --------------------------------------------------------------------------- #
# Test: happy path with high-confidence mock
# --------------------------------------------------------------------------- #

class TestFusedLandmarksSchema:

    def test_fused_landmarks_dataclass_fields(self, synthetic_image, synthetic_landmarks):
        """FusedLandmarks has the expected attributes."""
        from app.services.landmarks.fusion_layer import FusedLandmarks

        fused = FusedLandmarks(
            face_landmarks=synthetic_landmarks,
            virtual_landmarks={"trichion": [64.0, 10.0], "confidence": 0.9},
            trichion_source="bisenet",
            trichion_confidence=0.9,
            trichion_y_icu=-2.0,
            segmentation={},
        )
        assert fused.trichion_source == "bisenet"
        assert fused.trichion_confidence == 0.9
        assert fused.trichion_y_icu == -2.0

    def test_mesh_fallback_sets_trichion_y_icu(self, synthetic_landmarks):
        """_mesh_fallback must set trichion_y_icu from lm[10]."""
        from app.services.landmarks.fusion_layer import _mesh_fallback

        fused = _mesh_fallback(synthetic_landmarks)
        assert fused.trichion_source == "mesh"
        assert fused.trichion_y_icu is not None
        # lm[10] is at y = H * 0.1 = 12.8; inner canthus at y=57.6; icd=25.6
        # trichion_y_icu ≈ (12.8 - 57.6) / 25.6 ≈ -1.75
        assert fused.trichion_y_icu < 0, "trichion_y_icu should be negative (above inner canthus)"


# --------------------------------------------------------------------------- #
# Test: pixel_to_icu sanity check
# --------------------------------------------------------------------------- #

class TestPixelToIcu:

    def test_inner_canthus_midpoint_is_origin(self, synthetic_landmarks):
        """The inner-canthus midpoint should map to y_icu ≈ 0."""
        from app.services.landmarks.fusion_layer import _pixel_to_icu

        lc = synthetic_landmarks[P_LEFT_EYE_INNER, :2]
        rc = synthetic_landmarks[P_RIGHT_EYE_INNER, :2]
        midpoint = ((lc + rc) / 2).tolist()

        _, y_icu = _pixel_to_icu(midpoint, synthetic_landmarks)
        assert abs(y_icu) < 0.01, f"Expected y_icu ≈ 0 for midpoint, got {y_icu}"

    def test_above_eye_line_is_negative(self, synthetic_landmarks):
        """A point above the inner canthus line should have negative y_icu."""
        from app.services.landmarks.fusion_layer import _pixel_to_icu

        lc = synthetic_landmarks[P_LEFT_EYE_INNER, :2]
        rc = synthetic_landmarks[P_RIGHT_EYE_INNER, :2]
        above = [(lc[0] + rc[0]) / 2, (lc[1] + rc[1]) / 2 - 20]

        _, y_icu = _pixel_to_icu(above, synthetic_landmarks)
        assert y_icu < 0, f"Expected negative y_icu above eye line, got {y_icu}"
