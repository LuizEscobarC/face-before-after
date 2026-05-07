"""POST /vision/metrics — atomic facial metrics from landmarks."""
from __future__ import annotations

import numpy as np
from fastapi import APIRouter

from app.vision.schemas.metric_result import MetricsRequest, MetricsResponse
from app.vision.services.image_codec import decode_base64_image
from app.vision.services.metric_calculator import compute_metrics

router = APIRouter()


@router.post("/metrics", response_model=MetricsResponse)
def get_metrics(req: MetricsRequest) -> MetricsResponse:
    landmarks = np.asarray(req.landmarks, dtype=np.float32)
    image_bgr = decode_base64_image(req.image_base64) if req.image_base64 else None
    metrics, raw = compute_metrics(image_bgr, landmarks, req.quality_context)
    return MetricsResponse(metrics=metrics, raw=raw)
