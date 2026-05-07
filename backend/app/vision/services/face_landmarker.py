"""MediaPipe Tasks Vision FaceLandmarker wrapper (Mesh-478 native).

Single source of detection + landmark extraction. Returns FaceDetectionResult
with all 478 landmark points in pixel coordinates.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import cv2
import numpy as np

from app.domain.landmarks_mesh import TOTAL_LANDMARKS


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class FaceDetectionResult:
    """One detected face with full Mesh-478 landmarks and bbox."""
    face_count: int
    landmarks: np.ndarray | None  # shape (478, 2), float32, pixel coords (x, y)
    bbox: tuple[int, int, int, int] | None  # (x, y, w, h) in pixels

    # ------------------------------------------------------------------
    # dlib.rectangle-style accessors used by legacy code paths.
    # Kept minimal — preferred access is .bbox.
    # ------------------------------------------------------------------
    def left(self) -> int:
        return self.bbox[0] if self.bbox else 0

    def top(self) -> int:
        return self.bbox[1] if self.bbox else 0

    def width(self) -> int:
        return self.bbox[2] if self.bbox else 0

    def height(self) -> int:
        return self.bbox[3] if self.bbox else 0

    def right(self) -> int:
        return (self.bbox[0] + self.bbox[2]) if self.bbox else 0

    def bottom(self) -> int:
        return (self.bbox[1] + self.bbox[3]) if self.bbox else 0


# ---------------------------------------------------------------------------
# Model resolution
# ---------------------------------------------------------------------------

_MODEL_FILENAME = "face_landmarker.task"


def _resolve_model_path() -> str:
    candidates = [
        Path("/app/backend/models") / _MODEL_FILENAME,
        Path("/app/models") / _MODEL_FILENAME,
        Path(__file__).resolve().parents[3] / "models" / _MODEL_FILENAME,
        Path.cwd() / "backend" / "models" / _MODEL_FILENAME,
        Path.cwd() / "models" / _MODEL_FILENAME,
    ]
    for path in candidates:
        if path.exists():
            return str(path)
    raise FileNotFoundError(
        f"MediaPipe FaceLandmarker model '{_MODEL_FILENAME}' not found. "
        f"Looked in: {[str(p) for p in candidates]}"
    )


# ---------------------------------------------------------------------------
# FaceLandmarker singleton
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _get_landmarker() -> Any:
    """Construct the FaceLandmarker once (model load is expensive)."""
    from mediapipe.tasks import python as mp_python
    from mediapipe.tasks.python import vision as mp_vision

    base_options = mp_python.BaseOptions(model_asset_path=_resolve_model_path())
    options = mp_vision.FaceLandmarkerOptions(
        base_options=base_options,
        running_mode=mp_vision.RunningMode.IMAGE,
        num_faces=2,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
        min_tracking_confidence=0.5,
        output_face_blendshapes=False,
        output_facial_transformation_matrixes=False,
    )
    return mp_vision.FaceLandmarker.create_from_options(options)


# ---------------------------------------------------------------------------
# Detection
# ---------------------------------------------------------------------------

def detect(image_bgr: np.ndarray) -> list[FaceDetectionResult]:
    """Detect faces and extract Mesh-478 landmarks.

    Returns list sorted by face area descending, capped at 2 faces.
    """
    import mediapipe as mp

    h, w = image_bgr.shape[:2]
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

    result = _get_landmarker().detect(mp_image)
    if not result.face_landmarks:
        return []

    detections: list[FaceDetectionResult] = []
    for face_landmarks in result.face_landmarks:
        # MediaPipe returns 478 points when refine_landmarks/iris is on.
        # The Tasks API .task model includes iris by default.
        normalized_points = face_landmarks[:TOTAL_LANDMARKS]
        if len(normalized_points) < TOTAL_LANDMARKS:
            # Pad with zeros if model returned fewer points (shouldn't happen
            # with the standard face_landmarker.task, but guard anyway).
            pixel_landmarks = np.zeros((TOTAL_LANDMARKS, 2), dtype=np.float32)
            for index, point in enumerate(normalized_points):
                pixel_landmarks[index] = [point.x * w, point.y * h]
        else:
            pixel_landmarks = np.array(
                [[point.x * w, point.y * h] for point in normalized_points],
                dtype=np.float32,
            )

        x_min = int(max(0, np.min(pixel_landmarks[:, 0])))
        y_min = int(max(0, np.min(pixel_landmarks[:, 1])))
        x_max = int(min(w - 1, np.max(pixel_landmarks[:, 0])))
        y_max = int(min(h - 1, np.max(pixel_landmarks[:, 1])))
        bbox = (x_min, y_min, max(0, x_max - x_min), max(0, y_max - y_min))

        detections.append(FaceDetectionResult(
            face_count=len(result.face_landmarks),
            landmarks=pixel_landmarks,
            bbox=bbox,
        ))

    detections.sort(key=lambda d: d.bbox[2] * d.bbox[3] if d.bbox else 0, reverse=True)
    return detections[:2]


__all__ = ["FaceDetectionResult", "detect"]
