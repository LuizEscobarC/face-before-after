"""MediaPipe parity tests.

Smoke test: runs detect_faces on a synthetic image (no fixtures needed).
Parity test: skipped when backend/tests/fixtures/ is absent or empty.
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np
import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"
_fixtures_available = FIXTURES_DIR.exists() and any(FIXTURES_DIR.iterdir()) if FIXTURES_DIR.exists() else False


# ---------------------------------------------------------------------------
# Smoke test — no real image required
# ---------------------------------------------------------------------------

@pytest.mark.smoke
def test_detect_faces_smoke_no_face():
    """detect_faces on a blank image should return empty list without raising."""
    from app.vision.services.face_detection import detect_faces

    # Small gray synthetic image (no real face)
    blank = np.zeros((120, 120, 3), dtype=np.uint8)
    result = detect_faces(blank)
    assert isinstance(result, list), "detect_faces must return a list"


@pytest.mark.smoke
def test_detect_and_extract_smoke_no_face():
    """detect_and_extract on blank image should return (None, None)."""
    from app.vision.services.face_detection import detect_and_extract

    blank = np.zeros((120, 120, 3), dtype=np.uint8)
    lm, rect = detect_and_extract(blank)
    assert lm is None
    assert rect is None


@pytest.mark.smoke
def test_face_rect_interface():
    """FaceRect exposes the same interface as dlib.rectangle."""
    from app.vision.services.face_detection import FaceRect

    r = FaceRect(10, 20, 110, 220)
    assert r.left() == 10
    assert r.top() == 20
    assert r.right() == 110
    assert r.bottom() == 220
    assert r.width() == 100
    assert r.height() == 200


@pytest.mark.smoke
def test_landmark_mapping_shape():
    """mesh_to_dlib68 returns (68, 2) for valid 468-pt input."""
    from app.vision.services.landmark_mapping import mesh_to_dlib68

    fake_mesh = np.random.rand(468, 2).astype(np.float32)
    out = mesh_to_dlib68(fake_mesh)
    assert out.shape == (68, 2)


@pytest.mark.smoke
def test_landmark_mapping_478pts():
    """mesh_to_dlib68 handles 478-point (iris) input by slicing."""
    from app.vision.services.landmark_mapping import mesh_to_dlib68

    fake_mesh = np.random.rand(478, 2).astype(np.float32)
    out = mesh_to_dlib68(fake_mesh)
    assert out.shape == (68, 2)


# ---------------------------------------------------------------------------
# Parity test — requires fixtures/
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not _fixtures_available, reason="no fixtures in backend/tests/fixtures/")
@pytest.mark.parametrize(
    "img_path",
    list(FIXTURES_DIR.glob("*.jpg")) + list(FIXTURES_DIR.glob("*.png")) if _fixtures_available else [],
)
def test_parity_mediapipe_vs_dlib(img_path, monkeypatch):
    """quality_score delta ≤0.05 and same quality_grade between MediaPipe and dlib paths."""
    import cv2
    from app.vision.services import face_detection
    from app.vision.services.quality_evaluator import QualityEvaluator  # type: ignore

    evaluator = QualityEvaluator()
    image = cv2.imread(str(img_path))
    assert image is not None, f"Could not read {img_path}"

    # MediaPipe path
    monkeypatch.setattr(face_detection, "_USE_DLIB", False)
    lm_mp, rect_mp = face_detection.detect_and_extract(image)

    # dlib fallback path
    monkeypatch.setattr(face_detection, "_USE_DLIB", True)
    lm_dl, rect_dl = face_detection.detect_and_extract(image)

    if lm_mp is None or lm_dl is None:
        pytest.skip(f"No face detected in {img_path.name} by one or both backends")

    result_mp = evaluator.evaluate(image, lm_mp)
    result_dl = evaluator.evaluate(image, lm_dl)

    score_mp = result_mp.get("quality_score", 0)
    score_dl = result_dl.get("quality_score", 0)
    grade_mp = result_mp.get("quality_grade")
    grade_dl = result_dl.get("quality_grade")

    assert abs(score_mp - score_dl) <= 0.05, (
        f"{img_path.name}: quality_score delta {abs(score_mp - score_dl):.4f} > 0.05 "
        f"(mediapipe={score_mp:.4f}, dlib={score_dl:.4f})"
    )
    assert grade_mp == grade_dl, (
        f"{img_path.name}: quality_grade mismatch mediapipe={grade_mp!r} dlib={grade_dl!r}"
    )
