"""Domain object representing a single metric value emitted by the Python pipeline.

Matches exactly the JSON contract from ``POST /vision/metrics-v2`` response.
The Nest side consumes this and does comparison-against-ideal + severity.
Nothing here should reference the database, YAML config, or ideals.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class MetricValue:
    """Immutable result of one atomic metric calculation.

    Fields mirror the ``POST /vision/metrics-v2`` response contract
    (PLAN_METRICS.md §10):

    metric_id            snake_case string, stable across refactors.
    region               One of the 12 canonical region labels.
    family               Metric sub-family (symmetry, thirds, fifths, …).
    unit                 Measurement unit (intercanthal_units, degrees, …).
    value                Raw numeric result (always non-negative magnitude).
    error                Propagated measurement uncertainty in the same unit.
    confidence_raw       0–1 before regional/pose penalties.
    confidence_final     0–1 after all penalties; used for displayability.
    is_low_confidence    True when confidence_final < LOW_CONF_THRESHOLD (0.4).
    direction            Semantic label describing *which way* the value deviates.
    dependency_landmarks MediaPipe Mesh-478 indices consumed by this metric.
    presentation_only    If True, the metric must NEVER enter any score aggregate
                         (phi/golden ratio etc.). Hard rule — see DEC-6.
    """

    metric_id: str
    region: str
    family: str
    unit: str
    value: float
    error: float
    confidence_raw: float
    confidence_final: float
    is_low_confidence: bool
    direction: str
    dependency_landmarks: tuple[int, ...]
    presentation_only: bool = False
    improvement_vector: tuple[float, float] | None = None

    def to_dict(self) -> dict:
        return {
            "metric_id": self.metric_id,
            "region": self.region,
            "family": self.family,
            "unit": self.unit,
            "value": self.value,
            "error": self.error,
            "confidence_raw": self.confidence_raw,
            "confidence_final": self.confidence_final,
            "is_low_confidence": self.is_low_confidence,
            "direction": self.direction,
            "dependency_landmarks": list(self.dependency_landmarks),
            "presentation_only": self.presentation_only,
            "improvement_vector": list(self.improvement_vector) if self.improvement_vector is not None else None,
        }
