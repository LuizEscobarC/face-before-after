"""Tests for BiSeNetSegmenter — smoke + shape + fallback.

Uses a synthetic 64×64 BGR image to avoid loading the real ONNX model.
The test patches _get_session() to return a mock session so no real model
file is needed.
"""

from __future__ import annotations

import numpy as np
import pytest


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #

@pytest.fixture
def small_bgr_image():
    """64×64 synthetic BGR image."""
    rng = np.random.default_rng(42)
    return rng.integers(0, 255, (64, 64, 3), dtype=np.uint8)


@pytest.fixture
def mock_ort_session(monkeypatch):
    """Mock ORT InferenceSession that returns a plausible hair-dominant output."""

    class _MockInput:
        name = "input"

    class _MockSession:
        def get_inputs(self):
            return [_MockInput()]

        def run(self, output_names, input_dict):
            # Return fake logits (1, 19, 512, 512) — all class 17 (hair) dominant
            logits = np.zeros((1, 19, 512, 512), dtype=np.float32)
            logits[0, 17, :, :] = 10.0  # hair class wins everywhere
            return [logits]

    session = _MockSession()

    import app.services.segmentation.bisenet_segmenter as seg_mod
    monkeypatch.setattr(seg_mod, "_SESSION", session)
    return session


# --------------------------------------------------------------------------- #
# Smoke test: shape and class validity
# --------------------------------------------------------------------------- #

def test_segment_smoke(small_bgr_image, mock_ort_session):
    """Segmenter returns correct shapes and types with a mock session."""
    from app.services.segmentation.bisenet_segmenter import BiSeNetSegmenter

    seg = BiSeNetSegmenter()
    result = seg.segment(small_bgr_image)

    h, w = small_bgr_image.shape[:2]
    assert isinstance(result, dict), "Expected dict output"
    assert "hair_mask" in result
    assert "face_mask" in result
    assert "raw_label_map" in result
    assert "elapsed_ms" in result

    assert result["hair_mask"].shape == (h, w), f"hair_mask shape mismatch: {result['hair_mask'].shape}"
    assert result["hair_mask"].dtype == bool, "hair_mask should be bool"
    assert result["raw_label_map"].dtype == np.int32, "raw_label_map should be int32"
    assert result["elapsed_ms"] >= 0.0


def test_hair_class_17_detected(small_bgr_image, mock_ort_session):
    """Mock output sets class 17 everywhere → hair_mask should be all True."""
    from app.services.segmentation.bisenet_segmenter import BiSeNetSegmenter

    seg = BiSeNetSegmenter()
    result = seg.segment(small_bgr_image)
    assert result["hair_mask"].all(), "Expected hair_mask entirely True when class 17 wins"


def test_raw_label_map_classes_in_range(small_bgr_image, mock_ort_session):
    """All label-map values must be 0–18 (19-class model)."""
    from app.services.segmentation.bisenet_segmenter import BiSeNetSegmenter

    seg = BiSeNetSegmenter()
    result = seg.segment(small_bgr_image)
    assert int(result["raw_label_map"].min()) >= 0
    assert int(result["raw_label_map"].max()) <= 18


def test_elapsed_ms_positive(small_bgr_image, mock_ort_session):
    from app.services.segmentation.bisenet_segmenter import BiSeNetSegmenter

    seg = BiSeNetSegmenter()
    result = seg.segment(small_bgr_image)
    assert result["elapsed_ms"] >= 0


# --------------------------------------------------------------------------- #
# Fallback: RuntimeError when model missing
# --------------------------------------------------------------------------- #

def test_segment_raises_runtimeerror_when_model_missing(small_bgr_image, monkeypatch):
    """When _get_session() raises RuntimeError, segment() propagates it."""
    import app.services.segmentation.bisenet_segmenter as seg_mod

    def _boom():
        raise RuntimeError("Model not found")

    monkeypatch.setattr(seg_mod, "_SESSION", None)
    monkeypatch.setattr(seg_mod, "_get_session", _boom)

    from app.services.segmentation.bisenet_segmenter import BiSeNetSegmenter

    seg = BiSeNetSegmenter()
    with pytest.raises(RuntimeError, match="Model not found"):
        seg.segment(small_bgr_image)


# --------------------------------------------------------------------------- #
# Fallback: ImportError for onnxruntime
# --------------------------------------------------------------------------- #

def test_get_session_raises_runtimeerror_on_import_error(monkeypatch):
    """_get_session() wraps ImportError in RuntimeError."""
    import app.services.segmentation.bisenet_segmenter as seg_mod
    import sys

    monkeypatch.setattr(seg_mod, "_SESSION", None)

    real_import = __builtins__.__import__ if hasattr(__builtins__, '__import__') else __import__

    def _fake_import(name, *args, **kwargs):
        if name == "onnxruntime":
            raise ImportError("No module named 'onnxruntime'")
        return real_import(name, *args, **kwargs)

    # Temporarily hide onnxruntime from sys.modules
    saved = sys.modules.pop("onnxruntime", None)
    try:
        monkeypatch.setattr("builtins.__import__", _fake_import)
        with pytest.raises(RuntimeError, match="onnxruntime"):
            seg_mod._get_session()
    finally:
        if saved is not None:
            sys.modules["onnxruntime"] = saved
        monkeypatch.undo()
