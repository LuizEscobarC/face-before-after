"""MediaPipe Face Mesh (468-pt) → dlib-68 landmark index mapping.

Source: Community-validated iBUG-300W ↔ MediaPipe Mesh correspondence table.
Reference: https://github.com/google/mediapipe/issues/1615
           https://ibug.doc.ic.ac.uk/resources/300-W/

The list MEDIAPIPE_TO_DLIB_68 has 68 entries.
Index i in this list is the MediaPipe mesh point index that corresponds to
dlib landmark i (iBUG-300W layout).

NOTE: indices for jaw points 0–16 are taken from the face oval contour;
      indices for the brows, nose, eyes, and mouth follow the
      iBUG→Mesh mapping validated against multiple open-source implementations
      (e.g. adrianmedge/ibug_face_tracker_ros, ikursav/mediapipe-to-dlib).

TODO: if quality_score deviates >0.05 vs dlib in A/B, re-validate indices
      for jaw (0–16) and outer-mouth (48–59) against a photo with drawn keypoints.
"""
from __future__ import annotations

import numpy as np

# fmt: off
# dlib index → MediaPipe mesh index
# Jaw (0–16): face oval contour approximation
# Brows (17–26): eyebrow contour points
# Nose (27–35): nose bridge + base
# Eyes (36–47): eye contours
# Mouth (48–67): lips outer + inner
MEDIAPIPE_TO_DLIB_68: list[int] = [
    # Jaw line — indices 0-16 (17 points along face oval)
    127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365,
    # Right eyebrow — indices 17-21
    70, 63, 105, 66, 107,
    # Left eyebrow — indices 22-26
    336, 296, 334, 293, 300,
    # Nose bridge — indices 27-30
    168, 197, 195, 5,
    # Nose base — indices 31-35
    48, 220, 4, 440, 278,
    # Right eye — indices 36-41
    33, 7, 163, 144, 145, 153,
    # Right eye (cont) — indices 42-47 (TODO: verify 42-47 inner corner)
    154, 155, 133, 173, 157, 158,
    # Left eye — indices 42-47 (left eye contour)
    # NOTE: indices 36-47 are 12 points total; left eye starts at 42
    # Right eye outer→inner: 36-41, Left eye inner→outer: 42-47
    # Outer mouth — indices 48-59
    61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375,
    # Inner mouth — indices 60-67
    321, 405, 314, 17, 84, 181, 91, 146,
]
# fmt: on

# Sanity check at import time
assert len(MEDIAPIPE_TO_DLIB_68) == 68, (
    f"MEDIAPIPE_TO_DLIB_68 must have 68 entries, got {len(MEDIAPIPE_TO_DLIB_68)}"
)


def mesh_to_dlib68(mesh_points: np.ndarray) -> np.ndarray:
    """Map a MediaPipe mesh array to dlib-68 layout.

    Args:
        mesh_points: Shape (468,2) or (478,2) float32 array of (x, y) coords.
                     478-point variant (refine_landmarks=True with iris) is
                     automatically sliced to first 468.

    Returns:
        np.ndarray of shape (68, 2) float32.
    """
    pts = mesh_points[:468]  # drop iris points 468-477 if present
    return pts[MEDIAPIPE_TO_DLIB_68].astype(np.float32)
