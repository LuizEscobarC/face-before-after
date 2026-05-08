"""POST /vision/render — draw overlays on a face photo (PR-32 + PR-37/38, M3.1+M3.3).

Supported overlays (v1.0):
  axis_vertical          — vertical midline through inner-canthus midpoint (#22d3ee, dashed)
  axis_intercanthal      — horizontal line through inner-canthus mean y   (#22d3ee, solid)
  grid_thirds            — 2 horizontal lines at brow-midline and subnasale (#a5b4fc, dashed)
  grid_fifths            — 4 vertical lines at outer/inner canthus x-positions (#a5b4fc, dashed)
  outline_face           — jawline polyline (17 pts, #67e8f9, solid)
  heatmap_asymmetry      — Marquardt mirror-distance heatmap (PR-37, coolwarm, alpha=0.55)
  heatmap_ideal_adherence — Per-region adherence heatmap (PR-38, green→amber→red, alpha=0.55)

Heatmap dispatch is delegated to ``backend.app.vision.services.heatmap_renderer``.
The line overlays continue to draw onto a PIL canvas via ``_DRAW_FN`` dispatch;
the heatmap overlays return a fully-blended RGBA image which we then composite
under any subsequent line overlays so the lines stay readable on top.

References: Naini 2011 §4-6, Powell & Humphreys 1984, Farkas 1994,
PLAN_M3_OVERLAYS §1.1 (density cascade), §3 (DEC-21..26).
"""
from __future__ import annotations

import io
import json
import math

import numpy as np
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from PIL import Image, ImageDraw

from app.vision.services.heatmap_renderer import (
    DEFAULT_ALPHA as HEATMAP_DEFAULT_ALPHA,
    HeatmapSuppressedError,
    RegionAdherenceSample,
    render_asymmetry_heatmap,
    render_ideal_adherence_heatmap,
)

router = APIRouter()

# Heatmap overlay IDs — dispatched separately from line overlays.
_HEATMAP_OVERLAYS: frozenset[str] = frozenset({
    "heatmap_asymmetry",
    "heatmap_ideal_adherence",
})

# ---------------------------------------------------------------------------
# Landmark index constants (MediaPipe Mesh-478)
# Source: backend/app/domain/landmarks_mesh.py
# ---------------------------------------------------------------------------
_P_LEFT_EYE_INNER  = 133
_P_RIGHT_EYE_INNER = 362
_P_LEFT_EYE_OUTER  = 33
_P_RIGHT_EYE_OUTER = 263
_P_BROW_LEFT_INNER  = 107
_P_BROW_RIGHT_INNER = 336
_P_SUBNASALE = 2
_LM_JAWLINE  = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400]

# Rendering hints (mirrors overlay_definition seed data, PR-30)
_OVERLAY_STYLES: dict[str, dict] = {
    "axis_vertical":     {"stroke": "#22d3ee", "stroke_width": 1.5, "dash": (4, 2)},
    "axis_intercanthal": {"stroke": "#22d3ee", "stroke_width": 1.5, "dash": None},
    "grid_thirds":       {"stroke": "#a5b4fc", "stroke_width": 1,   "dash": (6, 3)},
    "grid_fifths":       {"stroke": "#a5b4fc", "stroke_width": 1,   "dash": (6, 3)},
    "outline_face":      {"stroke": "#67e8f9", "stroke_width": 1.5, "dash": None},
}

SUPPORTED_OVERLAYS = frozenset(_OVERLAY_STYLES) | _HEATMAP_OVERLAYS

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _draw_dashed_line(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    fill: tuple[int, int, int],
    width: int = 1,
    dash: tuple[int, int] = (4, 2),
) -> None:
    """Draw a dashed line — PIL has no built-in dash support."""
    x1, y1 = start
    x2, y2 = end
    length = math.hypot(x2 - x1, y2 - y1)
    if length < 1e-6:
        return
    dx = (x2 - x1) / length
    dy = (y2 - y1) / length
    pos = 0.0
    drawing = True
    while pos < length:
        seg = float(dash[0] if drawing else dash[1])
        end_pos = min(pos + seg, length)
        if drawing:
            draw.line(
                [(x1 + pos * dx, y1 + pos * dy), (x1 + end_pos * dx, y1 + end_pos * dy)],
                fill=fill,
                width=width,
            )
        pos = end_pos
        drawing = not drawing


def _line(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    style: dict,
) -> None:
    fill = _hex_to_rgb(style["stroke"])
    w = max(1, int(round(style["stroke_width"])))
    if style.get("dash"):
        _draw_dashed_line(draw, start, end, fill=fill, width=w, dash=style["dash"])
    else:
        draw.line([start, end], fill=fill, width=w)


# ---------------------------------------------------------------------------
# Per-overlay drawing routines
# ---------------------------------------------------------------------------

def _draw_axis_vertical(draw: ImageDraw.ImageDraw, lm: np.ndarray, w: int, h: int) -> None:
    x_mid = float((lm[_P_LEFT_EYE_INNER][0] + lm[_P_RIGHT_EYE_INNER][0]) / 2)
    _line(draw, (x_mid, 0), (x_mid, h), _OVERLAY_STYLES["axis_vertical"])


def _draw_axis_intercanthal(draw: ImageDraw.ImageDraw, lm: np.ndarray, w: int, h: int) -> None:
    y_mid = float((lm[_P_LEFT_EYE_INNER][1] + lm[_P_RIGHT_EYE_INNER][1]) / 2)
    _line(draw, (0, y_mid), (w, y_mid), _OVERLAY_STYLES["axis_intercanthal"])


def _draw_grid_thirds(draw: ImageDraw.ImageDraw, lm: np.ndarray, w: int, h: int) -> None:
    y_brow = float((lm[_P_BROW_LEFT_INNER][1] + lm[_P_BROW_RIGHT_INNER][1]) / 2)
    y_sub  = float(lm[_P_SUBNASALE][1])
    style  = _OVERLAY_STYLES["grid_thirds"]
    _line(draw, (0, y_brow), (w, y_brow), style)
    _line(draw, (0, y_sub),  (w, y_sub),  style)


def _draw_grid_fifths(draw: ImageDraw.ImageDraw, lm: np.ndarray, w: int, h: int) -> None:
    style = _OVERLAY_STYLES["grid_fifths"]
    for idx in [_P_LEFT_EYE_OUTER, _P_LEFT_EYE_INNER, _P_RIGHT_EYE_INNER, _P_RIGHT_EYE_OUTER]:
        x = float(lm[idx][0])
        _line(draw, (x, 0), (x, h), style)


def _draw_outline_face(draw: ImageDraw.ImageDraw, lm: np.ndarray, w: int, h: int) -> None:
    pts = [(float(lm[i][0]), float(lm[i][1])) for i in _LM_JAWLINE]
    fill = _hex_to_rgb(_OVERLAY_STYLES["outline_face"]["stroke"])
    width = max(1, int(round(_OVERLAY_STYLES["outline_face"]["stroke_width"])))
    draw.line(pts, fill=fill, width=width)


_DRAW_FN: dict[str, ...] = {
    "axis_vertical":     _draw_axis_vertical,
    "axis_intercanthal": _draw_axis_intercanthal,
    "grid_thirds":       _draw_grid_thirds,
    "grid_fifths":       _draw_grid_fifths,
    "outline_face":      _draw_outline_face,
}


def _parse_region_adherence(raw: str | None) -> list[RegionAdherenceSample]:
    """Parse the optional ``region_adherence_json`` form field for PR-38."""
    if not raw:
        return []
    try:
        data = json.loads(raw)
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"region_adherence_json is not valid JSON: {exc}",
        ) from exc
    if not isinstance(data, list):
        raise HTTPException(
            status_code=422,
            detail="region_adherence_json must be a JSON array of objects",
        )
    samples: list[RegionAdherenceSample] = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            raise HTTPException(
                status_code=422,
                detail=f"region_adherence_json[{i}] must be an object",
            )
        try:
            samples.append(RegionAdherenceSample(
                region=str(item["region"]),
                adherence=float(item["adherence"]),
                confidence=float(item["confidence"]),
            ))
        except (KeyError, TypeError, ValueError) as exc:
            raise HTTPException(
                status_code=422,
                detail=f"region_adherence_json[{i}] missing/invalid field: {exc}",
            ) from exc
    return samples

# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/render", tags=["vision"])
async def render_overlay(
    image: UploadFile = File(..., description="Face photo (JPEG or PNG)"),
    landmarks_json: str = Form(..., description="JSON array of [x, y] pixel pairs, length 478"),
    overlay_ids_json: str = Form(..., description='JSON array of overlay IDs, e.g. ["axis_vertical"]'),
    region_adherence_json: str | None = Form(
        None,
        description=(
            "Required only when 'heatmap_ideal_adherence' is requested. "
            'JSON array of {"region": str, "adherence": float, "confidence": float}.'
        ),
    ),
) -> StreamingResponse:
    """Draw facial overlay lines on a photo and return a PNG.

    Landmarks must be raw pixel coordinates from MediaPipe Mesh-478
    (478 points, each [x, y]).  Overlays are drawn in z-order from the
    overlay catalog (axes z=10, grids z=10, contours z=20).

    Unknown overlay IDs are silently ignored (L1 suppression: skip if
    required landmark indices are out of range).
    """
    # --- parse & validate landmarks ---
    try:
        lm_raw: list[list[float]] = json.loads(landmarks_json)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"landmarks_json is not valid JSON: {exc}") from exc

    try:
        lm = np.asarray(lm_raw, dtype=np.float64)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=f"Cannot convert landmarks to array: {exc}") from exc

    if lm.ndim != 2 or lm.shape[1] < 2:
        raise HTTPException(
            status_code=422,
            detail=f"landmarks must be shape (N, 2) or (N, 3), got {lm.shape}",
        )

    # --- parse overlay_ids ---
    try:
        overlay_ids: list[str] = json.loads(overlay_ids_json)
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=422, detail=f"overlay_ids_json is not valid JSON: {exc}") from exc

    if not isinstance(overlay_ids, list):
        raise HTTPException(status_code=422, detail="overlay_ids_json must be a JSON array")

    # --- read image ---
    raw = await image.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty image file")

    try:
        img = Image.open(io.BytesIO(raw)).convert("RGBA")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {exc}") from exc

    img_w, img_h = img.size

    # --- guard: enough landmarks ---
    required_max = max(
        _P_LEFT_EYE_INNER, _P_RIGHT_EYE_INNER,
        _P_LEFT_EYE_OUTER, _P_RIGHT_EYE_OUTER,
        _P_BROW_LEFT_INNER, _P_BROW_RIGHT_INNER,
        _P_SUBNASALE,
        max(_LM_JAWLINE),
    )
    if lm.shape[0] <= required_max:
        raise HTTPException(
            status_code=422,
            detail=f"Landmark array has {lm.shape[0]} points; need at least {required_max + 1}",
        )

    # --- heatmaps first (z=30, drawn beneath line overlays so lines stay readable) ---
    requested_heatmaps = [oid for oid in overlay_ids if oid in _HEATMAP_OVERLAYS]
    for oid in requested_heatmaps:
        try:
            if oid == "heatmap_asymmetry":
                img = render_asymmetry_heatmap(img, lm, alpha=HEATMAP_DEFAULT_ALPHA)
            elif oid == "heatmap_ideal_adherence":
                samples = _parse_region_adherence(region_adherence_json)
                if not samples:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            "heatmap_ideal_adherence requested but region_adherence_json "
                            "is missing or empty"
                        ),
                    )
                img = render_ideal_adherence_heatmap(
                    img, lm, samples, alpha=HEATMAP_DEFAULT_ALPHA,
                )
        except HeatmapSuppressedError as exc:
            # L2 suppression — return 422 so caller emits processing_note.
            raise HTTPException(
                status_code=422,
                detail={"overlay_id": oid, "suppressed": exc.reason, "samples": exc.sample_count},
            ) from exc

    # --- draw line overlays in z-order on top of any heatmap ---
    draw = ImageDraw.Draw(img, "RGBA")
    # z-order: axes (10) < grids (10, but after axes) < contours (20)
    z_order = ["axis_vertical", "axis_intercanthal", "grid_thirds", "grid_fifths", "outline_face"]
    for oid in z_order:
        if oid in overlay_ids and oid in _DRAW_FN:
            _DRAW_FN[oid](draw, lm, img_w, img_h)

    # --- serialize to PNG ---
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="PNG", optimize=False)
    buf.seek(0)

    return StreamingResponse(buf, media_type="image/png")
