"""Pose correction: adjust 2-D landmark coordinates for head yaw/pitch/roll.

The MediaPipe FaceLandmarker returns 2-D image coordinates (x, y in pixels)
plus a raw depth value z. For a head with non-zero pose angles, lateral
landmarks appear compressed (foreshortening). This module applies a first-
order affine correction to partially compensate for that compression before
normalisation.

Limitations (accepted for M1):
  - This is a heuristic 2-D projection correction, not a true 3-D inverse
    perspective transform. It removes the dominant linear component but
    leaves residual nonlinear distortion that grows with yaw > 15°.
  - Pitch correction adjusts vertical spread; yaw adjusts horizontal spread.
  - Roll is handled separately in ``midline_aligner.py`` (rotation step).
  - Landmarks that are anatomically occluded at extreme angles are NOT
    discarded here; upstream confidence propagation handles that.

Design:
  For yaw θ (head turned left/right): the visible half of the face is
  compressed by cos(θ). We rescale x-coordinates relative to the face
  centroid by 1/cos(θ) to restore approximate symmetric width.
  For pitch φ (head tilted up/down): same logic applied to y-coordinates.
  Both corrections are capped so they never amplify by more than 2× (guards
  against near-90° inputs that would otherwise produce degenerate results).
"""

from __future__ import annotations

import math

import numpy as np


# Maximum amplification allowed per axis. Protects against degenerate pose
# angles approaching ±90° (cos→0 → 1/cos→∞).
_MAX_AMPLIFICATION = 2.0

# Angles below this threshold (degrees) are treated as zero — avoids
# accumulating floating-point noise from small natural tilts.
_DEAD_ZONE_DEG = 3.0


def apply_pose_correction(
    landmarks: np.ndarray,
    yaw_deg: float,
    pitch_deg: float,
) -> tuple[np.ndarray, bool]:
    """Return a pose-corrected copy of *landmarks* and a boolean indicating
    whether any correction was actually applied.

    Parameters
    ----------
    landmarks : np.ndarray
        Shape (N, 2) or (N, 3). Only x/y columns are modified; z is preserved.
    yaw_deg : float
        Estimated yaw in degrees (positive = face turned right).
    pitch_deg : float
        Estimated pitch in degrees (positive = face tilted up).

    Returns
    -------
    corrected : np.ndarray
        Same shape as *landmarks* with adjusted x/y.
    applied : bool
        True if at least one axis correction exceeded the dead zone.
    """
    corrected = landmarks.astype(np.float64).copy()
    applied = False

    # Face centroid (mean of all points) — corrections are relative to it.
    centroid = corrected[:, :2].mean(axis=0)

    # Yaw correction (horizontal foreshortening).
    if abs(yaw_deg) > _DEAD_ZONE_DEG:
        cos_yaw = math.cos(math.radians(yaw_deg))
        scale_x = min(1.0 / max(abs(cos_yaw), 1e-6), _MAX_AMPLIFICATION)
        corrected[:, 0] = centroid[0] + (corrected[:, 0] - centroid[0]) * scale_x
        applied = True

    # Pitch correction (vertical foreshortening).
    if abs(pitch_deg) > _DEAD_ZONE_DEG:
        cos_pitch = math.cos(math.radians(pitch_deg))
        scale_y = min(1.0 / max(abs(cos_pitch), 1e-6), _MAX_AMPLIFICATION)
        corrected[:, 1] = centroid[1] + (corrected[:, 1] - centroid[1]) * scale_y
        applied = True

    return corrected, applied
