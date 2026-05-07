"""Face detection + 68-point landmarks via dlib (reused from existing pipeline)."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import cv2
import dlib
import numpy as np


_PREDICTOR_FILENAME = "shape_predictor_68_face_landmarks.dat"


def _resolve_predictor_path() -> str:
    candidates = [
        os.environ.get("DLIB_PREDICTOR_PATH"),
        _PREDICTOR_FILENAME,
        os.path.join(os.getcwd(), _PREDICTOR_FILENAME),
        os.path.join("/app", _PREDICTOR_FILENAME),
    ]
    for path in candidates:
        if path and os.path.exists(path):
            return path
    raise FileNotFoundError(
        f"dlib predictor not found. Set DLIB_PREDICTOR_PATH or place '{_PREDICTOR_FILENAME}' in CWD."
    )


@lru_cache(maxsize=1)
def _detector() -> Any:
    return dlib.get_frontal_face_detector()


@lru_cache(maxsize=1)
def _predictor() -> Any:
    return dlib.shape_predictor(_resolve_predictor_path())


def detect_faces(image_bgr: np.ndarray) -> list[Any]:
    """Detect faces in the image. Returns list of dlib rectangles (largest first)."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    faces = list(_detector()(gray, 1))
    faces.sort(key=lambda r: r.width() * r.height(), reverse=True)
    return faces


def extract_landmarks(image_bgr: np.ndarray, face_rect: Any) -> np.ndarray:
    """Return 68x2 array of (x, y) landmarks."""
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    shape = _predictor()(gray, face_rect)
    return np.array([[p.x, p.y] for p in shape.parts()], dtype=np.float32)


def detect_and_extract(image_bgr: np.ndarray) -> tuple[np.ndarray, Any] | tuple[None, None]:
    """Convenience: detect biggest face + landmarks. Returns (None, None) if no face."""
    faces = detect_faces(image_bgr)
    if not faces:
        return None, None
    rect = faces[0]
    return extract_landmarks(image_bgr, rect), rect
