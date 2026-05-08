"""Pydantic schemas for POST /vision/metrics-v2 (updated PR-23)."""
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
        description=(
            "Raw pixel coordinates from MediaPipe Face Mesh (N×3). "
            "Used as-is when landmark_frames is absent. When landmark_frames "
            "is provided this field is ignored."
        )
    )
    landmark_frames: list[list[list[float]]] | None = Field(
        default=None,
        description=(
            "Multi-capture frames for PR-23 stability analysis. "
            "Each element is a full set of N×3 pixel landmarks from one "
            "capture frame. Provide 2+ frames for stability computation. "
            "When present, the averaged landmarks are used for normalization "
            "and per-landmark stability scores penalise confidence. "
            "When absent or empty, single-capture mode is used."
        ),
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


class LandmarkStabilitySchema(BaseModel):
    """Summary of multi-capture landmark stability (PR-23)."""

    capture_count: int
    global_instability_index: float = Field(
        description=(
            "Mean instability across all landmarks (1 − mean_stability). "
            "0.0 = all stable, 1.0 = all maximally unstable."
        )
    )
    icd_px: float = Field(
        description="Intercanthal distance in pixels used as normalisation reference."
    )
    scores: list[float] = Field(
        description="Per-landmark stability scores in [0,1], length = N landmarks."
    )


class MetricsV2Response(BaseModel):
    session_id: str | None = None
    metrics: list[dict[str, Any]]  # MetricValue.to_dict() items
    metric_count: int
    capture_count: int = Field(
        default=1,
        description="Number of landmark frames used (1 = single-capture).",
    )
    landmark_stability: LandmarkStabilitySchema | None = Field(
        default=None,
        description=(
            "Landmark stability summary. Present only when capture_count > 1. "
            "Stored in landmark_payload.landmark_stability_scores in the DB."
        ),
    )

