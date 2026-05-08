"""Per-landmark stability analysis for multi-capture sessions (PR-23).

When a client captures N > 1 frames of landmarks from the same face position,
this module computes how consistent (stable) each landmark was across frames.
Unstable landmarks — those that jitter across captures — reduce the confidence
of metrics that depend on them.

Algorithm
---------
For each landmark i across F frames of pixel coordinates (x_i^f, y_i^f):
    1. Compute the per-axis standard deviation:
           std_x_i = std([x_i^f for f in frames])
           std_y_i = std([y_i^f for f in frames])
    2. RMS displacement (in pixels):
           sigma_i = sqrt((std_x_i^2 + std_y_i^2) / 2)
    3. Normalise by the intercanthal distance (ICD) in the first frame:
           sigma_icu_i = sigma_i / icd_px
    4. Piecewise-linear stability score in [0, 1]:
           stability_i = max(0.0, 1.0 − STABILITY_SLOPE × sigma_icu_i)
       where STABILITY_SLOPE = 5.0, so:
           - sigma = 0.00 ICD → stability 1.00 (zero jitter)
           - sigma = 0.10 ICD → stability 0.50
           - sigma ≥ 0.20 ICD → stability 0.00 (fully unreliable)
       A standard deviation of 0.10 ICU ≈ 10 px for a 100-px ICD face,
       which corresponds to localisation jitter of ± ~14 px — well above what
       a well-lit, stable capture should produce.

Single-frame shortcut
---------------------
When only one frame is provided, all stability scores are 1.0 and no penalty
is applied downstream. This preserves full backwards compatibility.

Sources
-------
- Bookstein FL (1991). *Morphometric Tools for Landmark Data: Geometry and
  Biology*. Cambridge University Press.
  → foundational treatment of landmark variance & reliability.
- Cootes TF, Taylor CJ, Cooper DH, Graham J (1995). "Active Shape Models —
  Their Training and Application." *Comput Vis Image Underst* 61(1):38–59.
  DOI: 10.1006/cviu.1995.1004
  → statistical shape model: defines 'point distribution models' whose
    eigenvalues characterise expected landmark variance.
- Bulat A, Tzimiropoulos G (2017). "How far are we from solving the 2D & 3D
  Face Alignment problem?" ICCV 2017. arXiv:1703.07332.
  → reports ~2–3 px NME (normalised mean error) for state-of-the-art
    alignment methods; used as calibration baseline for STABILITY_SLOPE.
- Google MediaPipe Face Mesh model:
  https://github.com/google/mediapipe/blob/master/docs/solutions/face_mesh.md
  → 478-landmark topology; inner canthus indices 133 (left) / 362 (right).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from app.domain.landmarks_mesh import P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER, TOTAL_LANDMARKS

# ---------------------------------------------------------------------------
# Calibration constant
# ---------------------------------------------------------------------------

#: Slope of the piecewise-linear stability curve.
#: stability = max(0, 1 - STABILITY_SLOPE * (sigma / icd)).
#: At 5.0, full instability is reached at sigma = 0.20 ICD.
STABILITY_SLOPE: float = 5.0


# ---------------------------------------------------------------------------
# Domain object
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class LandmarkStabilityResult:
    """Outcome of multi-frame landmark stability analysis.

    Attributes
    ----------
    scores : np.ndarray
        Shape ``(N,)`` float array.  Each element is in [0, 1]:
        1.0 = landmark was perfectly stable across all frames;
        0.0 = landmark was maximally unstable (jitter ≥ 0.20 ICD).
    global_instability_index : float
        Mean *instability* across all landmarks: ``1 − mean(scores)``.
        0.0 = all landmarks stable; 1.0 = all maximally unstable.
        Convenient threshold: values > 0.1 suggest the session quality
        may compromise metric reliability.
    averaged_landmarks : np.ndarray
        Shape ``(N, 3)``.  Mean landmark position in pixel coords across
        all frames.  This is the array that should be fed to the
        normalization pipeline in place of a single-capture array.
    capture_count : int
        Number of input frames used to compute the result.
    icd_px : float
        Intercanthal distance (pixels) estimated from the *first* frame.
        Used as the normalisation reference; stored for auditing.
    """

    scores: np.ndarray              # (N,) in [0, 1]
    global_instability_index: float  # 1 − mean(scores)
    averaged_landmarks: np.ndarray  # (N, 3)
    capture_count: int
    icd_px: float

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def to_scores_list(self) -> list[float]:
        """JSON-serialisable list of stability scores."""
        return [float(s) for s in self.scores]


# ---------------------------------------------------------------------------
# Core computation
# ---------------------------------------------------------------------------

def compute_stability(frames: list[np.ndarray]) -> LandmarkStabilityResult:
    """Compute per-landmark stability from multiple capture frames.

    Parameters
    ----------
    frames : list of np.ndarray
        Each element is shape ``(N, 2)`` or ``(N, 3)`` in pixel coords.
        All frames must have the same ``N`` (number of landmarks).
        If only one frame is provided, the result is all-ones (no penalty).

    Returns
    -------
    LandmarkStabilityResult

    Raises
    ------
    ValueError
        If *frames* is empty, or frames have inconsistent shapes.
    """
    if not frames:
        raise ValueError("frames must not be empty")

    # Normalise to (N, 3)
    normalised: list[np.ndarray] = []
    for f in frames:
        arr = np.array(f, dtype=np.float64)
        if arr.ndim != 2 or arr.shape[1] not in (2, 3):
            raise ValueError(
                f"Each frame must be shape (N, 2) or (N, 3), got {arr.shape}"
            )
        if arr.shape[1] == 2:
            arr = np.hstack([arr, np.zeros((arr.shape[0], 1), dtype=np.float64)])
        normalised.append(arr)

    n_landmarks = normalised[0].shape[0]
    for i, arr in enumerate(normalised):
        if arr.shape[0] != n_landmarks:
            raise ValueError(
                f"All frames must have the same number of landmarks. "
                f"Frame 0 has {n_landmarks}, frame {i} has {arr.shape[0]}."
            )

    # Averaged landmark positions (pixel coords)
    stacked = np.stack(normalised, axis=0)  # (F, N, 3)
    averaged = stacked.mean(axis=0)          # (N, 3)

    # Single-frame shortcut: perfect stability, no jitter possible
    if len(frames) == 1:
        return LandmarkStabilityResult(
            scores=np.ones(n_landmarks, dtype=np.float64),
            global_instability_index=0.0,
            averaged_landmarks=averaged,
            capture_count=1,
            icd_px=_estimate_icd_px(normalised[0]),
        )

    # Estimate ICD from the first frame for normalisation
    icd_px = _estimate_icd_px(normalised[0])
    if icd_px < 1.0:
        # Degenerate case: inner canthi too close (sub-pixel) — return 1.0 scores
        return LandmarkStabilityResult(
            scores=np.ones(n_landmarks, dtype=np.float64),
            global_instability_index=0.0,
            averaged_landmarks=averaged,
            capture_count=len(frames),
            icd_px=1.0,
        )

    # Per-landmark RMS displacement (px), then normalise by ICD
    # var over x and y axes: shape (N,) each
    var_x = stacked[:, :, 0].var(axis=0)  # (N,)
    var_y = stacked[:, :, 1].var(axis=0)  # (N,)
    # RMS displacement = sqrt of mean variance across axes
    sigma = np.sqrt((var_x + var_y) / 2.0)   # (N,) in px
    sigma_icu = sigma / icd_px               # normalised to ICD units

    # Piecewise-linear stability: 1 at sigma=0, 0 at sigma=1/SLOPE
    scores = np.clip(1.0 - STABILITY_SLOPE * sigma_icu, 0.0, 1.0)

    global_instability = float(1.0 - scores.mean())

    return LandmarkStabilityResult(
        scores=scores,
        global_instability_index=global_instability,
        averaged_landmarks=averaged,
        capture_count=len(frames),
        icd_px=float(icd_px),
    )


# ---------------------------------------------------------------------------
# Per-metric stability factor
# ---------------------------------------------------------------------------

def stability_factor_for_metric(
    stability_scores: np.ndarray | list[float],
    dependency_landmarks: list[int],
) -> float:
    """Stability factor in [0, 1] for a specific metric.

    The factor is the mean stability of the metric's dependency landmarks.
    A metric whose landmarks were all perfectly stable gets factor 1.0;
    if all its landmarks were maximally unstable the factor is 0.0.

    Parameters
    ----------
    stability_scores : array-like, shape (N,)
        Per-landmark stability scores from ``LandmarkStabilityResult.scores``.
    dependency_landmarks : list[int]
        MediaPipe Mesh-478 indices consumed by the metric.  Out-of-range
        indices are silently ignored.

    Returns
    -------
    float
        Factor in [0, 1].  Returns 1.0 when *dependency_landmarks* is empty
        or *stability_scores* is empty.
    """
    if not dependency_landmarks:
        return 1.0

    arr = np.asarray(stability_scores, dtype=np.float64)
    if arr.size == 0:
        return 1.0

    valid_scores = [
        arr[i] for i in dependency_landmarks
        if 0 <= i < arr.size
    ]
    if not valid_scores:
        return 1.0

    return float(np.mean(valid_scores))


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _estimate_icd_px(frame: np.ndarray) -> float:
    """Estimate the intercanthal distance in pixels from a raw landmark frame."""
    if frame.shape[0] <= max(P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER):
        return 1.0
    left = frame[P_LEFT_EYE_INNER, :2]
    right = frame[P_RIGHT_EYE_INNER, :2]
    return float(np.linalg.norm(right - left))
