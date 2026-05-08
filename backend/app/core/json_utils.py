"""Utilities for making numpy-tainted dicts safe for JSON serialization."""
from __future__ import annotations

from typing import Any


def sanitize_numpy(obj: Any) -> Any:
    """Recursively convert numpy scalars/arrays to native Python types."""
    try:
        import numpy as np
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.bool_):
            return bool(obj)
    except ImportError:
        pass

    if isinstance(obj, dict):
        return {k: sanitize_numpy(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [sanitize_numpy(v) for v in obj]
    return obj
