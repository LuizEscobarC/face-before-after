"""POST /vision/metrics-v2 — new atomic metrics pipeline (PR-5..8).

Accepts raw MediaPipe landmarks (pixel coordinates), normalises to
intercanthal units, then runs the full metric registry (21 metrics across
symmetry, thirds, fifths, eyes families) and returns MetricValue payloads.

This endpoint is the target of Nest's AnalysisOrchestratorService in PR-10.
"""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter

import app.services.metrics  # noqa: F401 — triggers @register for all families
from app.services.metrics.base import QualityContext
from app.services.metrics.registry import compute_all
from app.services.normalization import normalize
from app.vision.schemas.metrics_v2 import MetricsV2Request, MetricsV2Response

router = APIRouter()


@router.post("/metrics-v2", response_model=MetricsV2Response, tags=["vision"])
def get_metrics_v2(req: MetricsV2Request) -> MetricsV2Response:
    """Compute all atomic metrics from raw landmarks.

    Steps:
    1. Convert landmark list to (N, 3) numpy array.
    2. Normalise to intercanthal units (DEC-1) with optional pose correction.
    3. Build QualityContext from the request (quality_score + penalties + pose).
    4. Run the metric registry compute_all().
    5. Return serialised MetricValue list.
    """
    landmarks_np = np.asarray(req.landmarks, dtype=np.float32)

    image_size_tuple: tuple[int, int] | None = None
    if req.image_size and len(req.image_size) == 2:
        image_size_tuple = (int(req.image_size[0]), int(req.image_size[1]))

    normalised = normalize(
        landmarks_np,
        yaw_deg=req.yaw_deg,
        pitch_deg=req.pitch_deg,
        image_size=image_size_tuple,
    )

    ctx = QualityContext(
        quality_score=req.quality_context.quality_score,
        regional_penalties=req.quality_context.regional_penalties,
        pose=req.quality_context.pose,
    )

    metric_values = compute_all(normalised, ctx)
    serialised = [mv.to_dict() for mv in metric_values]

    return MetricsV2Response(
        session_id=req.session_id,
        metrics=serialised,
        metric_count=len(serialised),
    )
