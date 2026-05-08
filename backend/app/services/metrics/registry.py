"""Global metric registry.

Each metrics module (symmetry.py, thirds.py, …) imports ``register`` from
``base.py`` and decorates its calculator classes.  The decorator calls
``register_class`` here, populating ``_registry``.

Nest calls ``GET /vision/capabilities`` which reads ``list_metric_ids()``
and validates against ``metric_definition`` rows in Postgres.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.services.metrics.base import MetricCalculator, QualityContext
    from app.domain.normalized_landmarks import NormalizedLandmarks
    from app.domain.metric_value import MetricValue

_registry: dict[str, type["MetricCalculator"]] = {}


def register_class(cls: type["MetricCalculator"]) -> None:
    """Store *cls* keyed by its ``metric_id``. Called by the @register decorator."""
    _registry[cls.metric_id] = cls


def register(cls: type["MetricCalculator"]) -> type["MetricCalculator"]:
    """Class decorator that registers a MetricCalculator in the global registry.

    Usage::

        @register
        class MyMetricCalculator(MetricCalculator):
            metric_id = "my_metric"
            ...
    """
    register_class(cls)
    return cls


def get(metric_id: str) -> "MetricCalculator | None":
    """Return a fresh instance of the calculator for *metric_id*, or None."""
    cls = _registry.get(metric_id)
    return cls() if cls is not None else None


def all_instances() -> dict[str, "MetricCalculator"]:
    """Return a fresh instance for every registered metric."""
    return {mid: cls() for mid, cls in _registry.items()}


def list_metric_ids() -> list[str]:
    """Sorted list of registered metric_ids — used by GET /vision/capabilities."""
    return sorted(_registry.keys())


def compute_all(
    landmarks: "NormalizedLandmarks",
    ctx: "QualityContext",
    metric_ids: list[str] | None = None,
) -> list["MetricValue"]:
    """Compute a subset (or all) metrics for the given normalized face.

    Args:
        landmarks:  Already-normalized NormalizedLandmarks object.
        ctx:        Quality context with pose/quality/penalties.
        metric_ids: If given, only compute those IDs. Unknown IDs are skipped.
                    If None, compute all registered metrics.

    Returns:
        List of MetricValue — one per successfully computed metric.
    """
    targets = metric_ids if metric_ids is not None else list_metric_ids()
    results = []
    for mid in targets:
        calc = get(mid)
        if calc is None:
            continue
        results.append(calc.compute(landmarks, ctx))
    return results
