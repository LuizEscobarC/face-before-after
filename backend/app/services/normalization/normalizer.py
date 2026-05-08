"""Normalizer: orchestrates the full normalization pipeline.

Pipeline order (DEC-1, PLAN_METRICS §1.2):
  1. pose_correction   — compensate yaw/pitch foreshortening (optional: skipped
                         when pose angles are within dead zone).
  2. intercanthal_scaler — centre at inner-canthus midpoint + scale to ICU.
  3. midline_aligner   — rotate to make intercanthal axis horizontal.

Entry point: ``normalize(landmarks, pose) -> NormalizedLandmarks``

The function is pure (no I/O, no global state). Thread-safe.
"""

from __future__ import annotations

import numpy as np

from app.domain.normalized_landmarks import NormalizedLandmarks
from app.services.normalization.intercanthal_scaler import scale_to_intercanthal
from app.services.normalization.midline_aligner import align_to_horizontal
from app.services.normalization.pose_correction import apply_pose_correction


def normalize(
    landmarks: np.ndarray,
    *,
    yaw_deg: float = 0.0,
    pitch_deg: float = 0.0,
    image_size: tuple[int, int] | None = None,
) -> NormalizedLandmarks:
    """Run the full normalization pipeline.

    Parameters
    ----------
    landmarks : np.ndarray
        Shape (N, 2) or (N, 3). Raw pixel coordinates from MediaPipe.
        If shape is (N, 2) a zero z-column is appended so the output always
        has shape (N, 3).
    yaw_deg : float
        Estimated yaw from pose_estimator. 0 = frontal.
    pitch_deg : float
        Estimated pitch from pose_estimator. 0 = camera at eye level.
    image_size : tuple[int, int] | None
        (width, height) of the source image, forwarded to NormalizedLandmarks
        for pixel round-trips. Informational only; does not affect calculation.

    Returns
    -------
    NormalizedLandmarks
        Immutable domain object ready for metric calculators.

    Raises
    ------
    ValueError
        Propagated from intercanthal_scaler when the landmark array is too
        small or the intercanthal distance is degenerate.
    """
    # --- ensure (N, 3) shape --------------------------------------------------
    pts = np.array(landmarks, dtype=np.float64)
    if pts.ndim != 2 or pts.shape[1] not in (2, 3):
        raise ValueError(f"landmarks must be shape (N, 2) or (N, 3), got {pts.shape}")
    if pts.shape[1] == 2:
        pts = np.hstack([pts, np.zeros((pts.shape[0], 1), dtype=np.float64)])

    # --- step 1: pose correction (yaw + pitch) --------------------------------
    corrected, pose_applied = apply_pose_correction(pts, yaw_deg, pitch_deg)

    # --- step 2: intercanthal scaling + centring ------------------------------
    scaled, icd_px = scale_to_intercanthal(corrected)

    # --- step 3: midline alignment (roll) -------------------------------------
    aligned, _roll_corrected = align_to_horizontal(scaled)

    return NormalizedLandmarks(
        points=aligned,
        basis="intercanthal",
        intercanthal_distance_px=icd_px,
        pose_correction_applied=pose_applied,
        midline_aligned=True,
        source_image_size=image_size,
    )
