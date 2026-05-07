"""Canonical frame: cropped + aligned image with matching landmarks.

This is the SINGLE source of truth for downstream analysis. After construction,
every module (asymmetry, metrics, skin, simulation, annotations) operates on
``frame.image`` and ``frame.landmarks`` — never the original on disk.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict

import dlib
import numpy as np


@dataclass
class CanonicalFrame:
    image: np.ndarray
    landmarks: np.ndarray
    ipd_px: float
    face_rect: dlib.rectangle
    source_path: str
    crop_metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def width(self) -> int:
        return int(self.image.shape[1])

    @property
    def height(self) -> int:
        return int(self.image.shape[0])
