"""Face detection facade — Mesh-478 (MediaPipe Tasks Vision).

Thin wrapper over face_landmarker. Returns FaceDetectionResult with full
(478, 2) landmark arrays in pixel coordinates.

Public API:
    detect_faces(image_bgr)              -> list[FaceDetectionResult]
    extract_landmarks(image_bgr, result) -> np.ndarray  (478, 2)
    detect_and_extract(image_bgr)        -> (np.ndarray, FaceDetectionResult) | (None, None)
"""

from __future__ import annotations

import numpy as np

from app.vision.services.face_landmarker import FaceDetectionResult, detect


def detect_faces(image_bgr: np.ndarray) -> list[FaceDetectionResult]:
    """Detect faces (largest first, max 2)."""
    return detect(image_bgr)


def extract_landmarks(image_bgr: np.ndarray, face_result: FaceDetectionResult) -> np.ndarray:
    """Return the (478, 2) landmark array from a FaceDetectionResult.

    The image_bgr argument is kept for API compatibility but unused — the
    landmarks are already populated when detection ran.
    """
    if face_result is None or face_result.landmarks is None:
        raise ValueError("FaceDetectionResult has no landmarks.")
    return face_result.landmarks


def detect_and_extract(
    image_bgr: np.ndarray,
) -> tuple[np.ndarray, FaceDetectionResult] | tuple[None, None]:
    """Detect biggest face and return (landmarks_478x2, FaceDetectionResult).

    Returns (None, None) if no face is found.
    """
    faces = detect_faces(image_bgr)
    if not faces:
        return None, None
    result = faces[0]
    return result.landmarks, result


__all__ = [
    "FaceDetectionResult",
    "detect_faces",
    "extract_landmarks",
    "detect_and_extract",
]
