"""POST /vision/compose-before-ideal — vector before/ideal composer (PR-41, M3.4).

This endpoint exposes :func:`app.vision.services.before_ideal_composer.compose_before_ideal`
over multipart/form-data. It is **separate** from ``/vision/render`` because the
output dimensions differ (composer returns a 2×-wide canvas) and the input
contract carries a different payload (per-landmark ICU offsets vs overlay IDs).

Multipart fields:
  * ``image``       — face photo (JPEG or PNG).
  * ``landmarks_json`` — JSON array, length ≥478, each item is ``[x, y]`` in
    photo-pixel coordinates from MediaPipe Mesh-478.
  * ``offsets_json`` — JSON array, may be empty. Each item is an object:
    ``{"landmark_index": int, "dx_icu": float, "dy_icu": float, "metric_id": str}``.
    ``metric_id`` is optional (defaults to empty).
  * ``show_actual_wireframe`` (form, default ``"true"``) — ``"true"|"false"``.
  * ``show_guide_lines``      (form, default ``"true"``) — ``"true"|"false"``.

Response: ``image/png``, double-width canvas, RGBA flattened to RGB.

References: PLAN_M3_OVERLAYS §2 PR-41, DEC-15, DEC-26.
"""
from __future__ import annotations

import io
import json

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image

from app.vision.services.before_ideal_composer import (
    BeforeIdealComposeError,
    IdealLandmarkOffset,
    compose_before_ideal,
)

router = APIRouter()


def _parse_bool_form(raw: str | None, *, default: bool, field_name: str) -> bool:
    """Parse a small set of truthy/falsey strings; reject anything else."""
    if raw is None:
        return default
    norm = raw.strip().lower()
    if norm in {"true", "1", "yes", "on"}:
        return True
    if norm in {"false", "0", "no", "off"}:
        return False
    raise HTTPException(
        status_code=422,
        detail=f"Form field {field_name!r} must be true/false; got {raw!r}",
    )


def _parse_offsets(raw: str) -> list[IdealLandmarkOffset]:
    """Parse the ``offsets_json`` form field."""
    try:
        data = json.loads(raw)
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"offsets_json is not valid JSON: {exc}",
        ) from exc
    if not isinstance(data, list):
        raise HTTPException(
            status_code=422,
            detail="offsets_json must be a JSON array (possibly empty)",
        )
    out: list[IdealLandmarkOffset] = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            raise HTTPException(
                status_code=422,
                detail=f"offsets_json[{i}] must be an object",
            )
        try:
            out.append(IdealLandmarkOffset(
                landmark_index=int(item["landmark_index"]),
                dx_icu=float(item["dx_icu"]),
                dy_icu=float(item["dy_icu"]),
                metric_id=str(item.get("metric_id", "") or ""),
            ))
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=422,
                detail=f"offsets_json[{i}] missing/invalid field: {exc}",
            ) from exc
    return out


@router.post("/compose-before-ideal", tags=["vision"])
async def compose_before_ideal_endpoint(
    image: UploadFile = File(..., description="Face photo (JPEG or PNG)"),
    landmarks_json: str = Form(..., description="JSON array of [x, y] pixel pairs, length ≥478"),
    offsets_json: str = Form(
        "[]",
        description=(
            "JSON array of {landmark_index, dx_icu, dy_icu, metric_id?} entries. "
            "Empty array = render the actual wireframe with no proposed change."
        ),
    ),
    show_actual_wireframe: str | None = Form(
        None, description='"true" (default) or "false"',
    ),
    show_guide_lines: str | None = Form(
        None, description='"true" (default) or "false"',
    ),
) -> StreamingResponse:
    """Render a side-by-side before/ideal vector composition and return PNG."""
    # --- parse landmarks ---
    try:
        lm_raw = json.loads(landmarks_json)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"landmarks_json is not valid JSON: {exc}") from exc
    try:
        lm = np.asarray(lm_raw, dtype=np.float64)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Cannot convert landmarks to array: {exc}") from exc
    if lm.ndim != 2 or lm.shape[1] < 2:
        raise HTTPException(
            status_code=422,
            detail=f"landmarks must be shape (N, 2) or (N, 3); got {lm.shape}",
        )

    # --- parse offsets ---
    offsets = _parse_offsets(offsets_json)

    # --- parse booleans ---
    show_actual = _parse_bool_form(
        show_actual_wireframe, default=True, field_name="show_actual_wireframe",
    )
    show_guides = _parse_bool_form(
        show_guide_lines, default=True, field_name="show_guide_lines",
    )

    # --- read image ---
    raw_bytes = await image.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty image file")
    try:
        img = Image.open(io.BytesIO(raw_bytes)).convert("RGBA")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {exc}") from exc

    # --- compose ---
    try:
        composed = compose_before_ideal(
            img,
            lm,
            offsets,
            show_actual_wireframe=show_actual,
            show_guide_lines=show_guides,
        )
    except BeforeIdealComposeError as exc:
        raise HTTPException(
            status_code=422,
            detail={"reason": exc.reason, "message": str(exc)},
        ) from exc

    buf = io.BytesIO()
    composed.convert("RGB").save(buf, format="PNG", optimize=False)
    buf.seek(0)
    return StreamingResponse(buf, media_type="image/png")
