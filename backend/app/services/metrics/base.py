"""Abstract base for metric calculators + QualityContext input contract.

Every concrete calculator (symmetry.py, thirds.py, …) inherits from
MetricCalculator and declares its class-level metadata. The @register
decorator records the class in the module registry (registry.py).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import ClassVar

from app.domain.metric_value import MetricValue
from app.domain.normalized_landmarks import NormalizedLandmarks


# ---------------------------------------------------------------------------
# Input contract
# ---------------------------------------------------------------------------

@dataclass
class QualityContext:
    """Runtime quality signals forwarded from Nest alongside the landmarks.

    quality_score        Overall 0–1 quality score from the quality module.
    regional_penalties   Dict mapping region name → penalty fraction (0–1).
                         A penalty of 0.2 means that region's metrics lose
                         20% of their confidence.
    pose                 Dict with keys 'yaw', 'pitch', 'roll' in degrees.
                         Missing keys default to 0.0.
    """

    quality_score: float = 1.0
    regional_penalties: dict[str, float] = field(default_factory=dict)
    pose: dict[str, float] = field(default_factory=dict)

    def get_yaw(self) -> float:
        return float(self.pose.get("yaw", 0.0))

    def get_pitch(self) -> float:
        return float(self.pose.get("pitch", 0.0))

    def get_roll(self) -> float:
        return float(self.pose.get("roll", 0.0))


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------

class MetricCalculator(ABC):
    """One calculator per metric_id.

    Class-level attributes are the "identity card" that Nest mirrors in the
    ``metric_definition`` table (PLAN_METRICS.md §5.1).
    """

    metric_id: ClassVar[str]
    region: ClassVar[str]
    family: ClassVar[str]
    unit: ClassVar[str]
    presentation_only: ClassVar[bool] = False
    requires_pixel_analysis: ClassVar[bool] = False

    @abstractmethod
    def compute(
        self,
        landmarks: NormalizedLandmarks,
        ctx: QualityContext,
    ) -> MetricValue:
        """Compute and return the metric value for the given normalized face."""
        ...
