"""Midline aligner: rotate landmarks so the intercanthal axis is horizontal.

After pose_correction and intercanthal scaling the intercanthal segment may
still be slightly tilted (residual roll, natural head tilt). This step rotates
the entire point cloud about the origin (intercanthal midpoint = 0, 0) so the
two inner canthi share the same y-coordinate — i.e. the intercanthal axis
becomes perfectly horizontal.

Why rotate around the intercanthal midpoint?
  Because the scaler already placed it at (0, 0). Rotating around origin
  leaves the reference segment horizontal with minimal displacement.

Output:
  The rotation is a 2-D rigid rotation (no scale change, no shear). The
  z column is not affected. The function returns the rotated array and
  the roll angle in degrees that was corrected.
"""

from __future__ import annotations

import math

import numpy as np

from app.domain.landmarks_mesh import P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER


# Roll corrections below this threshold (degrees) are treated as zero.
# Avoids unnecessary floating-point rotation for perfectly aligned faces.
_DEAD_ZONE_DEG = 0.5


def align_to_horizontal(
    landmarks: np.ndarray,
) -> tuple[np.ndarray, float]:
    """Rotate *landmarks* so the intercanthal segment is horizontal.

    The function assumes the array has already been centred at the
    intercanthal midpoint (i.e. ``intercanthal_scaler.scale_to_intercanthal``
    has run). If called on un-centred arrays the rotation is still
    mathematically correct but will be applied about whatever origin the
    caller chose.

    Parameters
    ----------
    landmarks : np.ndarray
        Shape (N, 2) or (N, 3). x/y in any consistent unit.

    Returns
    -------
    rotated : np.ndarray
        Same shape, x/y rotated. z preserved.
    roll_corrected_deg : float
        The counter-clockwise rotation applied (positive = face was tilted
        clockwise, so we corrected it counter-clockwise). Zero if within
        the dead zone.
    """
    left_inner = landmarks[P_LEFT_EYE_INNER, :2].astype(np.float64)
    right_inner = landmarks[P_RIGHT_EYE_INNER, :2].astype(np.float64)

    # Vector from left inner to right inner canthus.
    delta = right_inner - left_inner
    roll_deg = float(np.degrees(np.arctan2(float(delta[1]), float(delta[0]))))

    if abs(roll_deg) <= _DEAD_ZONE_DEG:
        return landmarks.astype(np.float64).copy(), 0.0

    # Build 2-D rotation matrix to cancel the tilt.
    angle_rad = -math.radians(roll_deg)
    cos_a = math.cos(angle_rad)
    sin_a = math.sin(angle_rad)
    rot = np.array([[cos_a, -sin_a], [sin_a, cos_a]], dtype=np.float64)

    rotated = landmarks.astype(np.float64).copy()
    rotated[:, :2] = rotated[:, :2] @ rot.T  # row-vector convention

    return rotated, roll_deg
