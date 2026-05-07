"""Pydantic schemas for atomic metric results."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.vision.schemas.landmark_payload import RegionalPenalties


class QualityContext(BaseModel):
    quality_score: float = 1.0
    regional_penalties: RegionalPenalties = Field(default_factory=RegionalPenalties)


class MetricResult(BaseModel):
    metric_id: str
    value: Any
    error: float = 0.0
    confidence: float = 1.0
    region: str = "general"
    direction: str = "neutral"


class MetricsRequest(BaseModel):
    session_id: str | None = None
    landmarks: list[list[float]]
    image_base64: str | None = Field(
        default=None,
        description="Optional original image (base64) — needed for metrics that require pixel data (e.g. skin tone).",
    )
    quality_context: QualityContext = Field(default_factory=QualityContext)


class MetricsResponse(BaseModel):
    metrics: list[MetricResult]
    raw: dict[str, Any] | None = Field(
        default=None,
        description="Full raw block (advanced/photo_quality/skin) for debugging and backward-compat.",
    )
