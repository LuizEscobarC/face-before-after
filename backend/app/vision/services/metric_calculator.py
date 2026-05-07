"""Wraps ``app.domain.face_metrics.compute_all`` into ``MetricResult[]``.

Output region/direction are inferred from metric_id heuristics so we avoid
forking the existing calculation code.
"""
from __future__ import annotations

from typing import Any

import numpy as np

import app.domain.face_metrics as face_metrics
from app.vision.schemas.metric_result import MetricResult, QualityContext


_REGION_HINTS: list[tuple[tuple[str, ...], str]] = [
    (("eye", "canthal", "ipd", "interpupillary", "brow"), "eyes"),
    (("nose", "nasal", "alar"), "nose"),
    (("mouth", "lip", "smile"), "mouth"),
    (("jaw", "gonial", "menton", "chin", "bigonial", "fwhr"), "jaw"),
    (("cheek", "zygomatic", "bizygomatic"), "cheek"),
    (("skin", "under_eye", "uniformity", "darkness"), "skin"),
    (("light", "exposure", "blur", "frontal_ok"), "photo"),
]


def _infer_region(metric_id: str) -> str:
    metric_id_lower = metric_id.lower()
    for keys, region in _REGION_HINTS:
        if any(k in metric_id_lower for k in keys):
            return region
    return "general"


def _infer_direction(metric_id: str, value: Any) -> str:
    metric_id_lower = metric_id.lower()
    if "left" in metric_id_lower:
        return "left"
    if "right" in metric_id_lower:
        return "right"
    if isinstance(value, (int, float)):
        if "asymmetry" in metric_id_lower or "deviation" in metric_id_lower:
            if value == 0:
                return "neutral"
            return "asymmetric"
    return "neutral"


def _flatten(prefix: str, block: dict[str, Any]) -> list[tuple[str, Any]]:
    out: list[tuple[str, Any]] = []
    for key, value in block.items():
        full = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            out.extend(_flatten(full, value))
        else:
            out.append((full, value))
    return out


def _confidence(quality_context: QualityContext, region: str) -> float:
    base = float(quality_context.quality_score)
    penalties = quality_context.regional_penalties.model_dump()
    region_pen = float(penalties.get(region, 0.0))
    return round(max(0.0, min(1.0, base * (1.0 - region_pen))), 4)


def compute_metrics(
    image_bgr: np.ndarray | None,
    landmarks: np.ndarray,
    quality_context: QualityContext,
) -> tuple[list[MetricResult], dict[str, Any]]:
    """Run the existing pipeline metric calculator and normalize to ``MetricResult[]``."""
    # face_metrics.compute_all expects an image for skin/photo blocks. When the
    # client only sent landmarks, fall back to a tiny black placeholder so the
    # advanced/structural block (purely landmark-based) still runs.
    if image_bgr is None:
        h = int(np.max(landmarks[:, 1]) + 50)
        w = int(np.max(landmarks[:, 0]) + 50)
        image_bgr = np.zeros((max(h, 64), max(w, 64), 3), dtype=np.uint8)

    raw = face_metrics.compute_all(image_bgr, landmarks)
    pipeline_output = raw

    results: list[MetricResult] = []
    for block_name in ("advanced", "photo_quality", "skin"):
        block = pipeline_output.get(block_name) or {}
        for metric_id, value in _flatten("", block):
            region = _infer_region(metric_id)
            results.append(
                MetricResult(
                    metric_id=metric_id,
                    value=value,
                    error=0.0,
                    confidence=_confidence(quality_context, region),
                    region=region,
                    direction=_infer_direction(metric_id, value),
                )
            )

    return results, pipeline_output
