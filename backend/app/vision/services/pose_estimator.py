"""Head pose estimation via OpenCV solvePnP using 6 stable Mesh-478 landmarks."""
from __future__ import annotations

import math

import cv2
import numpy as np

from app.domain.landmarks_mesh import PNP_LANDMARK_INDICES


# 3D model coordinates (mm, approx) for 6 anchor points used in pose estimation.
# Reference: Mallick, "Head Pose Estimation using OpenCV and Dlib".
# The 3D anatomy is unchanged from the dlib version — only the 2D indices below
# now point to the equivalent Mesh-478 landmarks.
_MODEL_3D = np.array(
    [
        (0.0, 0.0, 0.0),          # nose tip      (mesh 1   / dlib 30)
        (0.0, -63.6, -12.5),      # chin (menton) (mesh 152 / dlib 8)
        (-43.3, 32.7, -26.0),     # left eye outer corner  (mesh 33  / dlib 36)
        (43.3, 32.7, -26.0),      # right eye outer corner (mesh 263 / dlib 45)
        (-28.9, -28.9, -24.1),    # left mouth corner      (mesh 61  / dlib 48)
        (28.9, -28.9, -24.1),     # right mouth corner     (mesh 291 / dlib 54)
    ],
    dtype=np.float64,
)

_LANDMARK_INDICES = PNP_LANDMARK_INDICES


def estimate_pose(landmarks: np.ndarray, image_size: tuple[int, int]) -> dict[str, float]:
    """Return dict with yaw/pitch/roll in degrees.

    Falls back to zeros if solvePnP fails (e.g. degenerate landmarks).
    """
    h, w = image_size
    focal_length = float(w)
    center = (w / 2.0, h / 2.0)
    camera_matrix = np.array(
        [[focal_length, 0, center[0]], [0, focal_length, center[1]], [0, 0, 1]],
        dtype=np.float64,
    )
    dist_coeffs = np.zeros((4, 1))

    try:
        image_points = np.array(
            [(float(landmarks[i][0]), float(landmarks[i][1])) for i in _LANDMARK_INDICES],
            dtype=np.float64,
        )
    except IndexError:
        return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

    success, rotation_vector, _translation_vector = cv2.solvePnP(
        _MODEL_3D, image_points, camera_matrix, dist_coeffs, flags=cv2.SOLVEPNP_ITERATIVE
    )
    if not success:
        return {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}

    rotation_matrix, _ = cv2.Rodrigues(rotation_vector)
    projection_matrix = np.hstack([rotation_matrix, np.zeros((3, 1))])
    _, _, _, _, _, _, euler_angles = cv2.decomposeProjectionMatrix(projection_matrix)
    pitch, yaw, roll = (float(angle) for angle in euler_angles.flatten())

    # decomposeProjectionMatrix returns angles in [-180, 180]; normalize pitch.
    if pitch > 90:
        pitch -= 180
    elif pitch < -90:
        pitch += 180

    return {
        "yaw": round(yaw, 3),
        "pitch": round(pitch, 3),
        "roll": round(roll, 3),
    }


def pose_within_limits(pose: dict[str, float], yaw_max: float = 10.0, pitch_max: float = 10.0, roll_max: float = 7.0) -> bool:
    return (
        abs(pose["yaw"]) <= yaw_max
        and abs(pose["pitch"]) <= pitch_max
        and abs(pose["roll"]) <= roll_max
    )


__all__ = ["estimate_pose", "pose_within_limits"]
