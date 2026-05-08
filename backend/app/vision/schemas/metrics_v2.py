"""Pydantic schemas for POST /vision/metrics-v2."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class QualityContextV2(BaseModel):
    quality_score: float = 1.0
    regional_penalties: dict[str, float] = Field(default_factory=dict)
    pose: dict[str, float] = Field(
        default_factory=dict,
        description="Pose angles in degrees: {yaw, pitch, roll}.",
    )


class MetricsV2Request(BaseModel):
    session_id: str | None = None
    landmarks: list[list[float]] = Field(
        description="Raw pixel coordinates from MediaPipe Face Mesh (N×3)."
    )
    quality_context: QualityContextV2 = Field(default_factory=QualityContextV2)
    yaw_deg: float = Field(default=0.0, description="Yaw correction angle passed to normalizer.")
    pitch_deg: float = Field(default=0.0, description="Pitch correction angle passed to normalizer.")
    image_size: list[int] | None = Field(
        default=None,
        description="Original image [width, height] — stored for reference only.",
    )


class MetricValueSchema(BaseModel):
    """Mirror of MetricValue.to_dict() — typed for OpenAPI docs."""

    metric_id: str
    region: str
    family: str
    unit: str
    value: float | None
    error: float
    confidence_raw: float
    confidence_final: float
    is_low_confidence: bool
    direction: str
    dependency_landmarks: list[int]
    presentation_only: bool


class MetricsV2Response(BaseModel):
    session_id: str | None = None
    metrics: list[dict[str, Any]]  # MetricValue.to_dict() items
    metric_count: int
