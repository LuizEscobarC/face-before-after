"""Face detection + 68-point landmarks.

Default path: MediaPipe Face Mesh (468 pts) mapped to dlib-68 layout via
landmark_mapping.MEDIAPIPE_TO_DLIB_68.

Fallback path (env USE_DLIB_FALLBACK=true): original dlib implementation,
kept for A/B comparison.

Public API (unchanged):
    detect_faces(image_bgr)            -> list[FaceRect]
    extract_landmarks(image_bgr, rect) -> np.ndarray (68, 2)
    detect_and_extract(image_bgr)      -> (np.ndarray, FaceRect) | (None, None)
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

import cv2
import numpy as np


_USE_DLIB = os.environ.get("USE_DLIB_FALLBACK", "").lower() in ("true", "1", "yes")
_PREDICTOR_FILENAME = "shape_predictor_68_face_landmarks.dat"


# ---------------------------------------------------------------------------
# FaceRect — drop-in replacement for dlib.rectangle
# ---------------------------------------------------------------------------

class FaceRect:
    """Bounding box that mirrors the dlib.rectangle interface used by callers."""

    def __init__(self, x1: int, y1: int, x2: int, y2: int) -> None:
        self._x1 = int(x1)
        self._y1 = int(y1)
        self._x2 = int(x2)
        self._y2 = int(y2)

    def left(self) -> int:
        return self._x1

    def top(self) -> int:
        return self._y1

    def right(self) -> int:
        return self._x2

    def bottom(self) -> int:
        return self._y2

    def width(self) -> int:
        return self._x2 - self._x1

    def height(self) -> int:
        return self._y2 - self._y1

    def __repr__(self) -> str:
        return f"FaceRect(left={self._x1}, top={self._y1}, right={self._x2}, bottom={self._y2})"


# ---------------------------------------------------------------------------
# MediaPipe path (default)
# ---------------------------------------------------------------------------

@lru_cache(maxsize=1)
def _face_mesh() -> Any:
    """Singleton FaceMesh instance (expensive to construct)."""
    import mediapipe as mp  # lazy import
    return mp.solutions.face_mesh.FaceMesh(
        static_image_mode=True,
        refine_landmarks=True,
        max_num_faces=2,
        min_detection_confidence=0.5,
    )


def _run_mesh(image_bgr: np.ndarray):
    """Run MediaPipe FaceMesh on a BGR image. Returns mp Results."""
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    return _face_mesh().process(rgb)


def _detect_mediapipe(image_bgr: np.ndarray) -> list[FaceRect]:
    """Detect faces via MediaPipe, return FaceRect list sorted by area desc."""
    h, w = image_bgr.shape[:2]
    results = _run_mesh(image_bgr)
    if not results.multi_face_landmarks:
        return []
    rects: list[FaceRect] = []
    for face_lm in results.multi_face_landmarks:
        xs = [lm.x * w for lm in face_lm.landmark[:468]]
        ys = [lm.y * h for lm in face_lm.landmark[:468]]
        rects.append(FaceRect(min(xs), min(ys), max(xs), max(ys)))
    rects.sort(key=lambda r: r.width() * r.height(), reverse=True)
    return rects


def _extract_mediapipe(image_bgr: np.ndarray, face_rect: Any) -> np.ndarray:
    """Extract 68 landmarks for the given face using MediaPipe."""
    from app.vision.services.landmark_mapping import mesh_to_dlib68  # lazy import

    h, w = image_bgr.shape[:2]
    results = _run_mesh(image_bgr)
    if not results.multi_face_landmarks:
        raise ValueError("No face detected by MediaPipe during landmark extraction.")

    # Choose the face whose bbox centre is closest to face_rect centre
    rect_cx = (face_rect.left() + face_rect.right()) / 2
    rect_cy = (face_rect.top() + face_rect.bottom()) / 2

    best_lm = None
    best_dist = float("inf")
    for face_lm in results.multi_face_landmarks:
        pts = face_lm.landmark[:468]
        cx = sum(lm.x * w for lm in pts) / 468
        cy = sum(lm.y * h for lm in pts) / 468
        dist = (cx - rect_cx) ** 2 + (cy - rect_cy) ** 2
        if dist < best_dist:
            best_dist = dist
            best_lm = face_lm

    assert best_lm is not None
    mesh = np.array(
        [[lm.x * w, lm.y * h] for lm in best_lm.landmark],
        dtype=np.float32,
    )
    return mesh_to_dlib68(mesh)


# ---------------------------------------------------------------------------
# dlib fallback path
# ---------------------------------------------------------------------------

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
def _dlib_detector() -> Any:
    import dlib  # lazy import
    return dlib.get_frontal_face_detector()


@lru_cache(maxsize=1)
def _dlib_predictor() -> Any:
    import dlib  # lazy import
    return dlib.shape_predictor(_resolve_predictor_path())


def _detect_dlib(image_bgr: np.ndarray) -> list[FaceRect]:
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    raw_faces = list(_dlib_detector()(gray, 1))
    raw_faces.sort(key=lambda r: r.width() * r.height(), reverse=True)
    return [FaceRect(r.left(), r.top(), r.right(), r.bottom()) for r in raw_faces]


def _extract_dlib(image_bgr: np.ndarray, face_rect: Any) -> np.ndarray:
    import dlib  # lazy import
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    # Accept both FaceRect and native dlib.rectangle
    if isinstance(face_rect, FaceRect):
        drect = dlib.rectangle(face_rect.left(), face_rect.top(), face_rect.right(), face_rect.bottom())
    else:
        drect = face_rect
    shape = _dlib_predictor()(gray, drect)
    return np.array([[p.x, p.y] for p in shape.parts()], dtype=np.float32)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def detect_faces(image_bgr: np.ndarray) -> list[FaceRect]:
    """Detect faces in the image. Returns list of FaceRect (largest first)."""
    if _USE_DLIB:
        return _detect_dlib(image_bgr)
    return _detect_mediapipe(image_bgr)


def extract_landmarks(image_bgr: np.ndarray, face_rect: Any) -> np.ndarray:
    """Return 68x2 array of (x, y) landmarks for the given face rect."""
    if _USE_DLIB:
        return _extract_dlib(image_bgr, face_rect)
    return _extract_mediapipe(image_bgr, face_rect)


def detect_and_extract(
    image_bgr: np.ndarray,
) -> tuple[np.ndarray, FaceRect] | tuple[None, None]:
    """Detect biggest face and extract its landmarks.

    Returns (landmarks_68x2, FaceRect) or (None, None) if no face found.
    """
    faces = detect_faces(image_bgr)
    if not faces:
        return None, None
    rect = faces[0]
    return extract_landmarks(image_bgr, rect), rect
