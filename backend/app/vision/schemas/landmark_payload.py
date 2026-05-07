"""Pydantic schemas for vision-service contracts."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PoseAngles(BaseModel):
    yaw: float
    pitch: float
    roll: float


class QualityFlags(BaseModel):
    beard: bool = False
    beard_density: float = 0.0
    glasses: bool = False
    smile: bool = False
    hair_covering: bool = False


class RegionalPenalties(BaseModel):
    jaw: float = 0.0
    eye: float = 0.0
    nose: float = 0.0
    brow: float = 0.0
    mouth: float = 0.0


class SubscoreBreakdown(BaseModel):
    face_ok: float
    pose_score: float
    sharpness_score: float
    lighting_score: float
    occlusion_score: float
    expression_score: float


QualityGrade = Literal["ALTA", "MEDIA", "BAIXA", "REJEITADA"]
ProcessingMode = Literal["CLIENT_SIDE", "SERVER_FALLBACK"]


class LandmarkPayload(BaseModel):
    """Output of /vision/landmarks — also the contract the client would send."""

    session_id: str
    landmarks: list[list[float]] = Field(..., description="2D landmarks (Nx2).")
    pose: PoseAngles
    quality_score: float
    quality_grade: QualityGrade
    flags: QualityFlags
    regional_penalties: RegionalPenalties
    recommendations: list[str] = Field(default_factory=list)
    fingerprint: str
    fingerprint_parts: list[str] = Field(default_factory=list)
    processing_mode: ProcessingMode = "SERVER_FALLBACK"
    sharpness_score: float = 0.0
    lighting_asymmetry: float = 0.0
    subscore_breakdown: SubscoreBreakdown | None = None


class LandmarkRequest(BaseModel):
    image_base64: str
    session_id: str | None = None
