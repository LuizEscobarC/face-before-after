"""Metrics service package.

Import this package to populate the registry with all metric families.
Each sub-module uses the @register decorator to register its calculators.

Usage::

    import app.services.metrics  # triggers all @register decorators
    from app.services.metrics.registry import compute_all, list_metric_ids
"""

from app.services.metrics import symmetry as _symmetry  # noqa: F401 — triggers @register
from app.services.metrics import thirds as _thirds      # noqa: F401 — triggers @register
from app.services.metrics import fifths as _fifths      # noqa: F401 — triggers @register
from app.services.metrics import eyes as _eyes          # noqa: F401 — triggers @register
from app.services.metrics import jaw as _jaw            # noqa: F401 — triggers @register
from app.services.metrics import nose as _nose          # noqa: F401 — triggers @register
from app.services.metrics import mouth as _mouth        # noqa: F401 — triggers @register
from app.services.metrics import brows as _brows        # noqa: F401 — triggers @register
from app.services.metrics import cheekbones as _cheekbones  # noqa: F401 — triggers @register
from app.services.metrics import forehead as _forehead  # noqa: F401 — triggers @register

__all__ = ["symmetry", "thirds", "fifths", "eyes", "jaw", "nose", "mouth", "brows", "cheekbones", "forehead"]
