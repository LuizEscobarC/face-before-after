"""Image decoding helpers — base64 ↔ BGR ndarray."""
from __future__ import annotations

import base64
import binascii

import cv2
import numpy as np
from fastapi import HTTPException


def decode_base64_image(image_base64: str) -> np.ndarray:
    """Decode a base64-encoded image into a BGR ndarray.

    Accepts plain base64 or data URLs (``data:image/png;base64,...``).
    """
    if not image_base64:
        raise HTTPException(status_code=400, detail="Empty image payload.")

    payload = image_base64.split(",", 1)[1] if image_base64.startswith("data:") else image_base64

    try:
        raw = base64.b64decode(payload, validate=False)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {exc}") from exc

    if not raw:
        raise HTTPException(status_code=400, detail="Decoded image is empty.")

    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode image. Use PNG/JPG/JPEG.")

    return image


def encode_image_base64(image_bgr: np.ndarray, ext: str = ".jpg") -> str:
    """Encode a BGR ndarray back into base64 (no data URL prefix)."""
    success, buf = cv2.imencode(ext, image_bgr)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to encode image.")
    return base64.b64encode(buf.tobytes()).decode("ascii")
