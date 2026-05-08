"""Domain object representing a successfully normalized landmark set.

All downstream metric calculators (symmetry, thirds, fifths, eyes, etc.)
receive a ``NormalizedLandmarks`` instance — never raw pixel landmarks.

Normalization contract (DEC-1):
  - Unit: intercanthal units (ICU). The intercanthal distance equals 1.0 ICU.
  - Origin: centroid of the intercanthal segment (midpoint between inner
    canthi) lies at (0, 0).
  - Orientation: the intercanthal axis is horizontal (roll = 0 after alignment).
  - Scale: invariant to photo zoom / face distance. All spatial metrics
    computed from this array are dimensionless ratios expressed in ICU.

Why intercanthal and not interpupillary?
  The intercanthal distance (inner canthus ↔ inner canthus) is measured from
  fixed bony landmarks and is far less affected by gaze direction, expression,
  or illumination than the inter-iris (pupillary) distance. It is the standard
  reference in Farkas-style cephalometric analysis.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass(frozen=True, slots=True)
class NormalizedLandmarks:
    """Immutable array of 478 landmarks in intercanthal units.

    Attributes
    ----------
    points : np.ndarray
        Shape (478, 3). x/y in intercanthal units; z is raw depth (unused by
        most 2-D metrics but preserved for future 3-D use).
    basis : str
        Normalization basis — always ``"intercanthal"`` in M1. Stored for
        auditability if the basis ever changes.
    intercanthal_distance_px : float
        Original pixel distance between inner canthi before scaling.
        Useful for inverse-mapping normalized coords back to pixels.
    pose_correction_applied : bool
        Whether yaw/pitch/roll adjustments were applied before this object
        was produced.
    midline_aligned : bool
        Whether a roll-alignment step rotated the array so the intercanthal
        axis is horizontal.
    source_image_size : tuple[int, int] | None
        (width, height) of the source image for pixel-space round-trips.
    """

    points: np.ndarray
    basis: str = "intercanthal"
    intercanthal_distance_px: float = 1.0
    pose_correction_applied: bool = False
    midline_aligned: bool = False
    source_image_size: tuple[int, int] | None = None

    def __post_init__(self) -> None:
        if self.points.ndim != 2 or self.points.shape[1] != 3:
            raise ValueError(
                f"NormalizedLandmarks.points must be shape (N, 3), got {self.points.shape}"
            )

    # ------------------------------------------------------------------
    # Convenience accessors
    # ------------------------------------------------------------------

    def xy(self, index: int) -> np.ndarray:
        """Return the (x, y) coords for landmark *index* in ICU."""
        return self.points[index, :2]

    def dist(self, a: int, b: int) -> float:
        """Euclidean distance between two landmarks in ICU."""
        return float(np.linalg.norm(self.points[a, :2] - self.points[b, :2]))

    def midpoint(self, a: int, b: int) -> np.ndarray:
        """Midpoint between two landmarks in ICU."""
        return (self.points[a, :2] + self.points[b, :2]) * 0.5

    def angle_deg(self, a: int, b: int) -> float:
        """Angle (degrees) of the vector from landmark *a* to *b* w.r.t. x-axis."""
        delta = self.points[b, :2] - self.points[a, :2]
        return float(np.degrees(np.arctan2(float(delta[1]), float(delta[0]))))

    def to_dict(self) -> dict:
        """Serialise to a JSON-safe dict (for landmark_payload persistence)."""
        return {
            "points": self.points.tolist(),
            "basis": self.basis,
            "intercanthal_distance_px": self.intercanthal_distance_px,
            "pose_correction_applied": self.pose_correction_applied,
            "midline_aligned": self.midline_aligned,
            "source_image_size": list(self.source_image_size) if self.source_image_size else None,
        }
