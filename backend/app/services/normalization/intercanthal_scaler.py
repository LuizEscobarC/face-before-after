"""Intercanthal scaler: normalise landmark coordinates to intercanthal units.

After this step every spatial distance is expressed as a fraction of the
intercanthal distance (inner canthus left ↔ inner canthus right), which equals
exactly 1.0 ICU by definition.

Why inner canthi (P_LEFT_EYE_INNER / P_RIGHT_EYE_INNER)?
  - Fixed bony anchors, minimally affected by pupil dilation, gaze direction,
    or expression changes.
  - Standard reference in Farkas cephalometric analysis.
  - Stable in the Mesh-478 layout at indices 133 (left) and 362 (right).

The origin after scaling is the midpoint of the two inner canthi, i.e. the
intercanthal segment centre lies at (0, 0). This keeps metric calculations
(differences, sums, midlines) numerically well-conditioned.
"""

from __future__ import annotations

import numpy as np

from app.domain.landmarks_mesh import P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER


# Minimum acceptable pixel distance between inner canthi. Below this the
# image is either a crop with no visible eyes or severely degraded.
_MIN_INTERCANTHAL_PX = 5.0


def scale_to_intercanthal(
    landmarks: np.ndarray,
) -> tuple[np.ndarray, float]:
    """Scale and centre *landmarks* so the intercanthal distance equals 1.0.

    Parameters
    ----------
    landmarks : np.ndarray
        Shape (N, 2) or (N, 3). Only x/y are modified.

    Returns
    -------
    scaled : np.ndarray
        Same shape. x/y in ICU with (0, 0) at the intercanthal midpoint.
        z column (if present) is preserved unchanged.
    intercanthal_distance_px : float
        Original pixel distance between inner canthi, for inverse mapping.

    Raises
    ------
    ValueError
        If inner-canthus landmarks are missing or too close together to be
        reliable (distance < ``_MIN_INTERCANTHAL_PX``).
    """
    try:
        left_inner = landmarks[P_LEFT_EYE_INNER, :2].astype(np.float64)
        right_inner = landmarks[P_RIGHT_EYE_INNER, :2].astype(np.float64)
    except IndexError as exc:
        raise ValueError(
            f"Landmark array has fewer than {max(P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER) + 1} points."
        ) from exc

    dist_px = float(np.linalg.norm(right_inner - left_inner))
    if dist_px < _MIN_INTERCANTHAL_PX:
        raise ValueError(
            f"Intercanthal distance ({dist_px:.1f} px) is too small to normalise reliably. "
            "The image may be too small or the eyes may not be visible."
        )

    origin = (left_inner + right_inner) * 0.5  # midpoint of inner canthi
    scaled = landmarks.astype(np.float64).copy()
    scaled[:, 0] = (scaled[:, 0] - origin[0]) / dist_px
    scaled[:, 1] = (scaled[:, 1] - origin[1]) / dist_px
    # z column left unchanged (raw depth, not scaled)

    return scaled, dist_px
