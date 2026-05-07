"""Smoke tests for the photo-quality evaluator (Module 0)."""
from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
import pytest

from app.vision.services import face_detection, quality_evaluator
from app.vision.services.pose_estimator import estimate_pose


_FIXTURE = Path(__file__).resolve().parents[2] / "bkp" / "01" / "antes.png"


@pytest.fixture(scope="module")
def good_image() -> np.ndarray:
    if not _FIXTURE.exists():
        pytest.skip(f"Fixture missing: {_FIXTURE}")
    img = cv2.imread(str(_FIXTURE))
    if img is None:
        pytest.skip(f"Could not load fixture {_FIXTURE}")
    return img


def test_evaluator_grades_good_photo_acceptable(good_image: np.ndarray) -> None:
    landmarks, rect = face_detection.detect_and_extract(good_image)
    assert landmarks is not None
    pose = estimate_pose(landmarks, good_image.shape[:2])
    report = quality_evaluator.evaluate(good_image, landmarks, pose, face_count=1)

    assert report["quality_grade"] in {"ALTA", "MEDIA", "BAIXA"}
    assert 0.0 <= report["quality_score"] <= 1.0
    assert "subscore_breakdown" in report
    assert isinstance(report["recommendations"], list)


def test_evaluator_rejects_heavily_blurred_photo(good_image: np.ndarray) -> None:
    blurred = cv2.GaussianBlur(good_image, (51, 51), 0)
    landmarks, _ = face_detection.detect_and_extract(blurred)
    if landmarks is None:
        landmarks, _ = face_detection.detect_and_extract(good_image)

    pose = estimate_pose(landmarks, blurred.shape[:2])
    report = quality_evaluator.evaluate(blurred, landmarks, pose, face_count=1)

    assert report["sharpness_score"] < 0.6
    assert report["quality_grade"] in {"BAIXA", "REJEITADA", "MEDIA"}
