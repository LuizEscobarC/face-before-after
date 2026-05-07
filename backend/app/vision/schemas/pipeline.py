"""Schemas for full pipeline (transition) and compare endpoints."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class FullPipelineRequest(BaseModel):
    image_base64: str
    mode: str = "premium"
    session_id: str | None = None
    filename: str | None = None


class CompareRequest(BaseModel):
    run_id_before: str
    run_id_after: str


class CaptureGuidelines(BaseModel):
    title: str
    distance_meters: str
    zoom: str
    tips: list[str]


class FullPipelineResponse(BaseModel):
    """Loose wrapper — keeps the raw MVP pipeline output for transition compat."""

    run_id: str
    output_dir: str
    photo_url: str | None = None
    result: dict[str, Any]
