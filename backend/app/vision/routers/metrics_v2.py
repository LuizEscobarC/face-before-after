"""POST /vision/metrics-v2 — new atomic metrics pipeline (PR-5..8, updated PR-23).

Accepts raw MediaPipe landmarks (pixel coordinates), normalises to
intercanthal units, then runs the full metric registry (66 metrics across
all M2 families) and returns MetricValue payloads.

PR-23 multi-capture extension
------------------------------
When ``landmark_frames`` is provided in the request body (≥ 1 elements):
  1. ``compute_stability(frames)`` averages the frames and computes per-landmark
     stability scores in [0, 1].
  2. The *averaged* landmark array is used for normalization instead of the
     single ``landmarks`` field.
  3. Stability scores are injected into ``QualityContext.landmark_stability_scores``.
  4. After ``compute_all()``, each ``MetricValue`` has its ``confidence_final``
     post-processed using ``landmark_stability_penalty`` for its dependency
     landmarks.  ``confidence_raw`` is left untouched (it does not include the
     stability factor) so Nest can audit the original value.
  5. The full stability summary is returned in the response and should be stored
     in ``landmark_payload.landmark_stability_scores`` (JSONB) by the caller.

Single-frame mode (default, backwards compatible)
--------------------------------------------------
When ``landmark_frames`` is absent or contains exactly one frame, stability
scoring is skipped entirely.  All existing callers work unchanged.

This endpoint is the target of Nest's AnalysisOrchestratorService in PR-10.
"""
from __future__ import annotations

from dataclasses import replace as dc_replace

import numpy as np
from fastapi import APIRouter

import app.services.metrics  # noqa: F401 — triggers @register for all families
from app.services.landmark_stability import (
    LandmarkStabilityResult,
    compute_stability,
    stability_factor_for_metric,
)
from app.services.metrics.base import QualityContext
from app.services.metrics.confidence_propagation import LOW_CONF_THRESHOLD
from app.services.metrics.registry import compute_all
from app.services.normalization import normalize
from app.vision.schemas.metrics_v2 import (
    LandmarkStabilitySchema,
    MetricsV2Request,
    MetricsV2Response,
)

router = APIRouter()


@router.post("/metrics-v2", response_model=MetricsV2Response, tags=["vision"])
def get_metrics_v2(req: MetricsV2Request) -> MetricsV2Response:
    """Compute all atomic metrics from raw (or multi-frame) landmarks.

    Steps:
    1. Determine landmark source: multi-frame (averaged) vs single array.
    2. Compute stability scores when multi-frame (PR-23).
    3. Normalise landmarks to intercanthal units (DEC-1).
    4. Build QualityContext (with stability scores when available).
    5. Run the metric registry compute_all().
    6. Post-process MetricValue.confidence_final with per-metric stability
       factor (multi-capture only; single-capture is a no-op).
    7. Return serialised MetricValue list + stability summary.
    """
    # ------------------------------------------------------------------
    # Step 1 + 2: landmark source and stability
    # ------------------------------------------------------------------
    stability_result: LandmarkStabilityResult | None = None

    if req.landmark_frames and len(req.landmark_frames) > 0:
        # Multi-frame path
        stability_result = compute_stability(req.landmark_frames)
        raw_landmarks = stability_result.averaged_landmarks  # (N, 3) float64
        capture_count = stability_result.capture_count
    else:
        # Single-frame path (backwards compatible)
        raw_landmarks = np.asarray(req.landmarks, dtype=np.float32)
        capture_count = 1

    # ------------------------------------------------------------------
    # Step 3: normalise
    # ------------------------------------------------------------------
    image_size_tuple: tuple[int, int] | None = None
    if req.image_size and len(req.image_size) == 2:
        image_size_tuple = (int(req.image_size[0]), int(req.image_size[1]))

    normalised = normalize(
        raw_landmarks,
        yaw_deg=req.yaw_deg,
        pitch_deg=req.pitch_deg,
        image_size=image_size_tuple,
    )

    # ------------------------------------------------------------------
    # Step 4: build QualityContext
    # ------------------------------------------------------------------
    stability_scores_list: list[float] | None = (
        stability_result.to_scores_list() if stability_result is not None and capture_count > 1
        else None
    )

    ctx = QualityContext(
        quality_score=req.quality_context.quality_score,
        regional_penalties=req.quality_context.regional_penalties,
        pose=req.quality_context.pose,
        landmark_stability_scores=stability_scores_list,
        capture_count=capture_count,
    )

    # ------------------------------------------------------------------
    # Step 5: compute metrics
    # ------------------------------------------------------------------
    metric_values = compute_all(normalised, ctx)

    # ------------------------------------------------------------------
    # Step 6: post-process confidence_final with per-metric stability
    #         (only when multi-capture; single-capture is identity transform)
    # ------------------------------------------------------------------
    if stability_scores_list is not None:
        adjusted_metrics = []
        for mv in metric_values:
            factor = stability_factor_for_metric(
                stability_scores_list,
                list(mv.dependency_landmarks),
            )
            if factor < 1.0:
                new_cf = max(0.0, min(1.0, mv.confidence_final * factor))
                mv = dc_replace(
                    mv,
                    confidence_final=new_cf,
                    is_low_confidence=new_cf < LOW_CONF_THRESHOLD,
                )
            adjusted_metrics.append(mv)
        metric_values = adjusted_metrics

    # ------------------------------------------------------------------
    # Step 7: serialise and return
    # ------------------------------------------------------------------
    serialised = [mv.to_dict() for mv in metric_values]

    stability_schema: LandmarkStabilitySchema | None = None
    if stability_result is not None and capture_count > 1:
        stability_schema = LandmarkStabilitySchema(
            capture_count=capture_count,
            global_instability_index=stability_result.global_instability_index,
            icd_px=stability_result.icd_px,
            scores=stability_result.to_scores_list(),
        )

    return MetricsV2Response(
        session_id=req.session_id,
        metrics=serialised,
        metric_count=len(serialised),
        capture_count=capture_count,
        landmark_stability=stability_schema,
    )

