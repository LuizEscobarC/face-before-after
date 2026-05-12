"""Fusion layer: combines MediaPipe Mesh-478 landmarks with BiSeNet hair-mask
virtual landmarks to produce a FusedLandmarks object used by the metrics engine.

Confidence scoring rationale (CoT):
  score = valid_column_fraction × vertical_regularity × distance_penalty

  1. valid_column_fraction — fraction of hairline columns where hair was detected.
     Empty columns (no hair) are interpolated and degrade confidence proportionally.

  2. vertical_regularity — 1 minus the coefficient of variation (std/mean) of
     adjacent column y-differences. A jagged hairline has high std → lower score.

  3. distance_penalty — 1.0 if the trichion is within 1.5 × ICD of lm[10];
     decays linearly to 0.0 if the distance exceeds 3 × ICD.  Catches cases where
     the hair mask is present but geometrically implausible (e.g. background hair).

Final trichion decision:
  if confidence >= TRICHION_CONFIDENCE_THRESHOLD → use BiSeNet trichion
  else → fall back to lm[P_FOREHEAD_CROWN] (mesh trichion)

Fallback triggers (any of these → silent warning + "mesh" source):
  - RuntimeError from BiSeNet (onnxruntime missing, model missing, ORT crash)
  - ImportError (onnxruntime not installed)
  - ValueError (empty or corrupt mask)
  - Confidence below TRICHION_CONFIDENCE_THRESHOLD after all scoring
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any

import numpy as np

from app.domain.landmarks_mesh import (
    P_FOREHEAD_CROWN,
    P_LEFT_EYE_INNER,
    P_RIGHT_EYE_INNER,
)

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Threshold
# --------------------------------------------------------------------------- #
# Reduzido de 0.5 para 0.40 (2026-05-12 follow-up):
# Rostos reais com cabelo natural (curto, irregular) produzem confidence ~0.42–0.48.
# Threshold 0.5 rejeitava desnecessariamente. 0.40 aceita mais casos válidos enquanto
# rejeita detecções degeneradas (background, oclusão extrema, noise).
TRICHION_CONFIDENCE_THRESHOLD: float = 0.40


# --------------------------------------------------------------------------- #
# Data classes
# --------------------------------------------------------------------------- #

@dataclass
class FusedLandmarks:
    """Output of fuse().  Consumed by the metrics pipeline and API response.

    Attributes
    ----------
    face_landmarks       : (478, 3) float pixel-space MediaPipe landmarks.
    virtual_landmarks    : dict — hairline keypoints in pixel space.
    trichion_source      : "bisenet" | "mesh"
    trichion_confidence  : float ∈ [0, 1]
    trichion_y_icu       : float — trichion y-coordinate in intercanthal units
                           (ready for thirds.py, same coordinate system as
                           NormalizedLandmarks).
    segmentation         : dict — raw segmentation output (hair_mask, etc.).
    """

    face_landmarks:      np.ndarray
    virtual_landmarks:   dict[str, Any]         = field(default_factory=dict)
    trichion_source:     str                    = "mesh"
    trichion_confidence: float                  = 0.0
    trichion_y_icu:      float | None           = None
    segmentation:        dict[str, Any]         = field(default_factory=dict)


# --------------------------------------------------------------------------- #
# Pixel → ICU conversion helper
# --------------------------------------------------------------------------- #

def _pixel_to_icu(
    point_px: list[float] | tuple[float, float],
    mp_landmarks_px: np.ndarray,
) -> tuple[float, float]:
    """Convert a pixel-space point to intercanthal units (ICU).

    Applies the same three-step transform as NormalizedLandmarks:
      1. Centre at inner-canthus midpoint.
      2. Divide by ICD (intercanthal distance in pixels).
      3. Apply roll correction (midline alignment).

    Pose correction (yaw/pitch) is intentionally skipped because
    (a) the canonical frame is already aligned, and (b) the error
    for near-frontal faces is < 1%.
    """
    lc = mp_landmarks_px[P_LEFT_EYE_INNER, :2].astype(np.float64)
    rc = mp_landmarks_px[P_RIGHT_EYE_INNER, :2].astype(np.float64)
    origin = (lc + rc) * 0.5
    icd_px = float(np.linalg.norm(rc - lc))
    if icd_px < 1e-6:
        return 0.0, 0.0

    tx = (float(point_px[0]) - origin[0]) / icd_px
    ty = (float(point_px[1]) - origin[1]) / icd_px

    # Roll correction: same formula as midline_aligner.align_to_horizontal.
    delta = rc - lc
    roll_deg = float(np.degrees(math.atan2(float(delta[1]), float(delta[0]))))
    if abs(roll_deg) > 0.5:
        angle_rad = -math.radians(roll_deg)
        cos_a = math.cos(angle_rad)
        sin_a = math.sin(angle_rad)
        tx, ty = tx * cos_a - ty * sin_a, tx * sin_a + ty * cos_a

    return float(tx), float(ty)


# --------------------------------------------------------------------------- #
# Confidence scoring
# --------------------------------------------------------------------------- #

def _compute_confidence(
    virtual: dict[str, Any],
    mp_landmarks_px: np.ndarray,
) -> float:
    """Compute a composite trichion confidence score in [0, 1].

    score = valid_frac × regularity × distance_penalty

    See module docstring for rationale.
    """
    base_conf = float(virtual.get("confidence", 0.0))
    if base_conf <= 0.0:
        return 0.0

    # --- regularity: low CoV of adjacent y-differences ----------------------
    col_y = virtual.get("column_y", [])
    regularity = 1.0
    if len(col_y) >= 3:
        diffs = np.abs(np.diff(col_y))
        mean_d = float(np.mean(diffs))
        std_d  = float(np.std(diffs))
        cov    = std_d / max(mean_d, 1.0)
        # CoV ≤ 1.0 → perfect (natural hairline waviness + BiSeNet pixel noise);
        # CoV ≥ 4.0 → worst (chaotic edge, e.g. wild hair on textured background).
        regularity = float(np.clip(1.0 - (cov - 1.0) / 3.0, 0.0, 1.0))

    # --- distance penalty: trichion vs lm[10] --------------------------------
    trichion_px = virtual.get("trichion", [0.0, 0.0])
    lm10_px = mp_landmarks_px[P_FOREHEAD_CROWN, :2].astype(float)
    lc = mp_landmarks_px[P_LEFT_EYE_INNER, :2].astype(float)
    rc = mp_landmarks_px[P_RIGHT_EYE_INNER, :2].astype(float)
    icd_px = float(np.linalg.norm(rc - lc))
    dist_to_lm10 = float(np.linalg.norm(
        np.array(trichion_px[:2]) - lm10_px
    ))
    # Within 1.5 × ICD → no penalty; beyond 3 × ICD → penalty = 0
    dist_icu = dist_to_lm10 / max(icd_px, 1.0)
    distance_penalty = float(np.clip(1.0 - (dist_icu - 1.5) / 1.5, 0.0, 1.0))

    return float(base_conf * regularity * distance_penalty)


# --------------------------------------------------------------------------- #
# Main entry point
# --------------------------------------------------------------------------- #

def fuse(
    image_bgr: np.ndarray,
    mp_landmarks_px: np.ndarray,
) -> FusedLandmarks:
    """Fuse MediaPipe landmarks with BiSeNet hair-mask virtual landmarks.

    Parameters
    ----------
    image_bgr : np.ndarray
        BGR image (H, W, 3) — the canonical frame from pipeline.run().
    mp_landmarks_px : np.ndarray
        (478, 3) float MediaPipe pixel-space landmarks for the same frame.

    Returns
    -------
    FusedLandmarks
        Always succeeds. Falls back to mesh trichion on any error.
    """
    try:
        result = _run_bisenet_fusion(image_bgr, mp_landmarks_px)
        return result
    except Exception as exc:  # pylint: disable=broad-except
        # Fusion must NEVER raise — pipeline relies on this returning a usable
        # FusedLandmarks even when BiSeNet is missing/misconfigured. Catches
        # IndexError (path resolution), RuntimeError (ORT), ImportError,
        # ValueError (mask), OSError (disk), and unforeseen failures.
        logger.warning(
            "BiSeNet fusion failed (%s: %s) — falling back to mesh trichion lm[10]",
            type(exc).__name__, exc,
        )
        return _mesh_fallback(mp_landmarks_px)


def _run_bisenet_fusion(
    image_bgr: np.ndarray,
    mp_landmarks_px: np.ndarray,
) -> FusedLandmarks:
    """Internal: run BiSeNet + virtual_landmarks, raise on any failure."""
    from app.services.segmentation.bisenet_segmenter import get_segmenter
    from app.services.landmarks.virtual_landmarks import extract_hairline_points

    seg_result = get_segmenter().segment(image_bgr)
    virtual    = extract_hairline_points(seg_result["hair_mask"], mp_landmarks_px)
    confidence = _compute_confidence(virtual, mp_landmarks_px)

    if confidence < TRICHION_CONFIDENCE_THRESHOLD:
        logger.debug(
            "BiSeNet trichion confidence %.3f < %.1f threshold → mesh fallback",
            confidence, TRICHION_CONFIDENCE_THRESHOLD,
        )
        return _mesh_fallback(mp_landmarks_px, segmentation=seg_result)

    trichion_px = virtual["trichion"]
    _, trichion_y_icu = _pixel_to_icu(trichion_px, mp_landmarks_px)

    return FusedLandmarks(
        face_landmarks      = mp_landmarks_px,
        virtual_landmarks   = virtual,
        trichion_source     = "bisenet",
        trichion_confidence = confidence,
        trichion_y_icu      = trichion_y_icu,
        segmentation        = seg_result,
    )


def _mesh_fallback(
    mp_landmarks_px: np.ndarray,
    segmentation: dict | None = None,
) -> FusedLandmarks:
    """Return a FusedLandmarks using lm[P_FOREHEAD_CROWN] as the trichion.

    Confidence is based on the quality of the mesh landmark itself — for a
    clean frontal photo this is typically high (0.9+), but we cap it at 1.0.
    The stability of lm[10] in MediaPipe Mesh-478 is generally good for
    frontal shots; we assign a fixed mesh_confidence of 0.95.
    """
    lm10 = mp_landmarks_px[P_FOREHEAD_CROWN, :2].tolist()
    _, trichion_y_icu = _pixel_to_icu(lm10, mp_landmarks_px)

    return FusedLandmarks(
        face_landmarks      = mp_landmarks_px,
        virtual_landmarks   = {
            "trichion":              lm10,
            "hairline_left":         lm10,
            "hairline_center":       lm10,
            "hairline_right":        lm10,
            "forehead_top_estimate": lm10,
            "temple_left":           lm10,
            "temple_right":          lm10,
            "confidence":            0.0,
            "column_y":              [],
        },
        trichion_source     = "mesh",
        trichion_confidence = 0.0,
        trichion_y_icu      = trichion_y_icu,
        segmentation        = segmentation or {},
    )
