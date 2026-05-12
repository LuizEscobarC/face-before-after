"""PIL port of frontend/src/components/OverlayLayer.tsx.

Single source of visual truth. Each ``draw_*`` function mirrors the
corresponding TSX component 1:1 — same constants, same labels, same
landmark indices, same severity colour table.

When the TSX changes, this file MUST change in lockstep. To keep the
two from drifting, every function carries a ``Mirrors:`` docstring
pointing at the TSX line range it ports.

The functions take a PIL ``Image`` (RGB or RGBA) and return a NEW
PIL Image with the overlay drawn onto a copy. Composition is handled
by ``render_all_overlays.py`` so the rig can stack overlays freely.

Conventions:
- ``lm`` is a ``list[list[float]]`` or ``np.ndarray``-like with shape
  (>=478, 2 or 3). Only the first two columns (x, y) are used.
- ``metric_evals`` is the list returned in the FastAPI report under
  ``result.metric_evaluations``. Optional fields (``severity_5``,
  ``anchor_landmark_index``, ``ideal``, ``deviation_normalized``) are
  treated as missing-permissible so the rig works against both the
  Python pipeline (today) and the Nest orchestrator (future) without
  branching.
"""

from __future__ import annotations

import math
from typing import Any, Iterable, Sequence

from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Landmark indices — Mirrors: OverlayLayer.tsx L21-L43.
# ---------------------------------------------------------------------------
P_NOSE_TIP            = 1
P_MENTON              = 152
P_LEFT_EYE_INNER      = 133
P_RIGHT_EYE_INNER     = 362
P_LEFT_EYE_OUTER      = 33
P_RIGHT_EYE_OUTER     = 263
P_BROW_LEFT_INNER     = 107
P_BROW_RIGHT_INNER    = 336
P_SUBNASALE           = 2
P_FOREHEAD_CROWN      = 10
P_ZYGO_IMG_RIGHT      = 454
P_ZYGO_IMG_LEFT       = 234
P_EYE_OUTER_IMG_LEFT  = 33
P_EYE_OUTER_IMG_RIGHT = 263

# 17-pt mandible polygon, OverlayLayer.tsx L46.
LM_JAWLINE: list[int] = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
    379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
    234, 127, 162, 21, 54, 103, 67, 109, 10,
]

# Forehead indices inside LM_JAWLINE — these mesh points sit on/above the
# brow line on the original MediaPipe Mesh-478 topology.  When BiSeNet
# provides a real trichion, ALL of them must be flattened to trichion_y
# (not only lm[10]) so the contour does not form an isolated horn at the
# centre while the temples stay low.
LM_FOREHEAD_RIDGE: set[int] = {
    109, 67, 103, 54, 21, 162,        # left side, scalp-to-temple
    10,                               # centre crown
    338, 297, 332, 284, 251,          # right side, scalp-to-temple
}

# ---------------------------------------------------------------------------
# Style constants — Mirrors: OverlayLayer.tsx L52-L77 (OVERLAY_STYLES,
# SEVERITY_ARROW_COLORS).  Hex strings converted to RGB tuples for PIL.
# ---------------------------------------------------------------------------
SEVERITY_ARROW_COLORS: dict[str, tuple[int, int, int]] = {
    "ideal":    (34, 197, 94),     # #22c55e
    "mild":     (34, 197, 94),     # #22c55e
    "moderate": (234, 179, 8),     # #eab308
    "strong":   (249, 115, 22),    # #f97316
    "extreme":  (239, 68, 68),     # #ef4444
}

# Strokes (RGB).  Dasharrays kept as PIL "dash pattern" pixel sequences.
_AXIS_VERTICAL_STROKE        = (34, 211, 238)   # #22d3ee
_AXIS_INTERCANTHAL_STROKE    = (34, 211, 238)   # #22d3ee
_GRID_THIRDS_STROKE          = (165, 180, 252)  # #a5b4fc
_GRID_FIFTHS_STROKE          = (165, 180, 252)  # #a5b4fc
_OUTLINE_FACE_STROKE         = (103, 232, 249)  # #67e8f9
_FACE_EXTENTS_STROKE         = (255, 255, 255)
_REAL_LINE_STROKE            = (249, 115, 22)   # #f97316 (orange — actual landmark lines)
_NEUTRAL_LABEL_GREY          = (148, 163, 184)  # #94a3b8 (severity unknown)

_AXIS_VERTICAL_DASH = (4, 2)
_GRID_DASH          = (6, 3)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _to_rgba(image: Image.Image) -> Image.Image:
    return image.convert("RGBA") if image.mode != "RGBA" else image.copy()


def _font(size: int) -> ImageFont.ImageFont:
    for name in ("DejaVuSans-Bold.ttf", "DejaVuSans.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _xy(lm: Sequence[Sequence[float]], idx: int) -> tuple[float, float]:
    """Mirrors OverlayLayer.tsx ``lm()`` (L184)."""
    if idx < 0 or idx >= len(lm):
        return (0.0, 0.0)
    p = lm[idx]
    return (float(p[0]), float(p[1]))


def _dashed_line(
    draw: ImageDraw.ImageDraw,
    p0: tuple[float, float],
    p1: tuple[float, float],
    fill: tuple[int, int, int],
    width: int,
    dash: tuple[int, int],
) -> None:
    """Approximate SVG ``stroke-dasharray="A B"`` in PIL."""
    x0, y0 = p0
    x1, y1 = p1
    total = math.hypot(x1 - x0, y1 - y0)
    if total <= 0:
        return
    on_len, off_len = float(dash[0]), float(dash[1])
    cycle = on_len + off_len
    cursor = 0.0
    while cursor < total:
        seg_end = min(cursor + on_len, total)
        t0 = cursor / total
        t1 = seg_end / total
        sx = x0 + (x1 - x0) * t0
        sy = y0 + (y1 - y0) * t0
        ex = x0 + (x1 - x0) * t1
        ey = y0 + (y1 - y0) * t1
        draw.line([(sx, sy), (ex, ey)], fill=fill, width=width)
        cursor += cycle


def _label(
    draw: ImageDraw.ImageDraw,
    xy: tuple[float, float],
    text: str,
    fill: tuple[int, int, int],
    *,
    size: int = 11,
    anchor: str = "ls",
    bold: bool = True,
) -> None:
    """Text with a 2 px black stroke — Mirrors TSX ``paintOrder: stroke``."""
    font = _font(size)
    x, y = xy
    # Stroke (8 directions, 2 px) for legibility on busy backgrounds.
    for dx in (-2, -1, 0, 1, 2):
        for dy in (-2, -1, 0, 1, 2):
            if dx == 0 and dy == 0:
                continue
            try:
                draw.text((x + dx, y + dy), text, fill=(0, 0, 0), font=font, anchor=anchor)
            except (TypeError, ValueError):
                draw.text((x + dx, y + dy), text, fill=(0, 0, 0), font=font)
    try:
        draw.text((x, y), text, fill=fill, font=font, anchor=anchor)
    except (TypeError, ValueError):
        draw.text((x, y), text, fill=fill, font=font)


def _severity_color(severity_5: Any) -> tuple[int, int, int]:
    """Mirrors ``_severityColor`` (OverlayLayer.tsx L207-L216)."""
    if not severity_5:
        return _NEUTRAL_LABEL_GREY
    return SEVERITY_ARROW_COLORS.get(str(severity_5).lower(), _NEUTRAL_LABEL_GREY)


def _metric_get(metric_evals: Iterable[dict] | None, metric_id: str) -> dict | None:
    if not metric_evals:
        return None
    for m in metric_evals:
        if m.get("metric_id") == metric_id:
            return m
    return None


def _icd_px(lm: Sequence[Sequence[float]]) -> float:
    lx, ly = _xy(lm, P_LEFT_EYE_INNER)
    rx, ry = _xy(lm, P_RIGHT_EYE_INNER)
    return math.hypot(rx - lx, ry - ly)


def derive_trichion_y_px(
    lm: Sequence[Sequence[float]],
    metric_evals: Iterable[dict] | None = None,
) -> float:
    """Return the effective hairline Y in pixel space, consistent with metric values.

    When ``upper_third_ratio`` is available we derive trichion_y algebraically
    so that visual line positions are **exactly consistent** with the displayed
    percentage labels — whether trichion comes from BiSeNet or mesh fallback.

    Derivation (all values in the same linear pixel space):
        u  = (y_brow - y_t) / (y_menton - y_t)
        →  y_t = (u * y_menton - y_brow) / (u - 1)

    Falls back to ``lm[10].y`` when the metric is absent or outside [0.05, 0.95].
    """
    m = _metric_get(metric_evals, "upper_third_ratio")
    if m and isinstance(m.get("value"), (int, float)):
        u = float(m["value"])
        if 0.05 < u < 0.95:
            y_brow = (
                _xy(lm, P_BROW_LEFT_INNER)[1] + _xy(lm, P_BROW_RIGHT_INNER)[1]
            ) / 2.0
            y_men = _xy(lm, P_MENTON)[1]
            # (u - 1) is always negative; result is correct sign.
            return (u * y_men - y_brow) / (u - 1.0)
    return _xy(lm, P_FOREHEAD_CROWN)[1]  # fallback: lm[10]


# ---------------------------------------------------------------------------
# Overlay renderers — each Mirrors a TSX component.
# ---------------------------------------------------------------------------

def draw_axis_vertical(image: Image.Image, lm: Sequence[Sequence[float]]) -> Image.Image:
    """Mirrors ``AxisVertical`` (OverlayLayer.tsx L188-L201).

    ``xMid = mean( mean(lm[133].x, lm[362].x), lm[1].x )`` — averages the
    inner-canthus midline with the nose tip x for a more anatomically
    correct vertical.
    """
    out = _to_rgba(image)
    draw = ImageDraw.Draw(out, "RGBA")
    w, h = out.size
    x_eyes = (_xy(lm, P_LEFT_EYE_INNER)[0] + _xy(lm, P_RIGHT_EYE_INNER)[0]) / 2.0
    x_nose = _xy(lm, P_NOSE_TIP)[0]
    x_mid = (x_eyes + x_nose) / 2.0
    _dashed_line(draw, (x_mid, 0), (x_mid, h), _AXIS_VERTICAL_STROKE, 2, _AXIS_VERTICAL_DASH)
    return out


def draw_axis_intercanthal(image: Image.Image, lm: Sequence[Sequence[float]]) -> Image.Image:
    """Mirrors ``AxisIntercanthal`` (OverlayLayer.tsx L203-L211)."""
    out = _to_rgba(image)
    draw = ImageDraw.Draw(out, "RGBA")
    w, _h = out.size
    y_mid = (_xy(lm, P_LEFT_EYE_INNER)[1] + _xy(lm, P_RIGHT_EYE_INNER)[1]) / 2.0
    draw.line([(0, y_mid), (w, y_mid)], fill=_AXIS_INTERCANTHAL_STROKE, width=2)
    return out


def draw_grid_thirds(
    image: Image.Image,
    lm: Sequence[Sequence[float]],
    metric_evals: Iterable[dict] | None = None,
) -> Image.Image:
    """Mirrors ``GridThirds`` (OverlayLayer.tsx L235-L320).

    Layers:
      1. Two dashed purple ideal-1/3 and 2/3 dividers (full width).
      2. Two solid orange landmark lines (Sobrancelha / Subnasale).
      3. Right-aligned T1/T2/T3 labels with deviation %, coloured by
         ``severity_5`` (falls back to grey when severity not provided).
    """
    out = _to_rgba(image)
    draw = ImageDraw.Draw(out, "RGBA")
    w, _h = out.size
    # y_top derived from upper_third_ratio metric so visual lines match the label.
    # When BiSeNet fires, this anchors at the real hairline; when mesh fallback,
    # it reduces to lm[10].y — always self-consistent with the displayed %.
    y_top   = derive_trichion_y_px(lm, metric_evals)
    y_brow  = (_xy(lm, P_BROW_LEFT_INNER)[1] + _xy(lm, P_BROW_RIGHT_INNER)[1]) / 2.0
    y_sub   = _xy(lm, P_SUBNASALE)[1]
    y_men   = _xy(lm, P_MENTON)[1]
    x_left  = _xy(lm, P_ZYGO_IMG_LEFT)[0]

    face_h = max(1.0, y_men - y_top)
    m_upper  = _metric_get(metric_evals, "upper_third_ratio")
    m_middle = _metric_get(metric_evals, "middle_third_ratio")
    m_lower  = _metric_get(metric_evals, "lower_third_ratio")

    def _pct(metric: dict | None, fallback: float) -> float:
        if metric and isinstance(metric.get("value"), (int, float)):
            return float(metric["value"]) * 100.0
        return fallback

    upper_pct  = _pct(m_upper,  ((y_brow - y_top) / face_h) * 100.0)
    middle_pct = _pct(m_middle, ((y_sub  - y_brow) / face_h) * 100.0)
    lower_pct  = _pct(m_lower,  ((y_men  - y_sub) / face_h) * 100.0)

    upper_color  = _severity_color(m_upper  and m_upper.get("severity_5"))
    middle_color = _severity_color(m_middle and m_middle.get("severity_5"))
    lower_color  = _severity_color(m_lower  and m_lower.get("severity_5"))

    y_t1 = y_top + face_h / 3.0
    y_t2 = y_top + (2.0 * face_h) / 3.0

    # 1. Ideal dividers (dashed purple) — geometry only, no burned-in text.
    _dashed_line(draw, (0, y_t1), (w, y_t1), _GRID_THIRDS_STROKE, 1, _GRID_DASH)
    _dashed_line(draw, (0, y_t2), (w, y_t2), _GRID_THIRDS_STROKE, 1, _GRID_DASH)

    # 2. Real landmark lines (solid orange) — geometry only.
    draw.line([(0, y_brow), (w, y_brow)], fill=_REAL_LINE_STROKE, width=2)
    draw.line([(0, y_sub),  (w, y_sub)],  fill=_REAL_LINE_STROKE, width=2)

    # Text labels (upper/middle/lower %, ideal-1/3, ideal-2/3, Sobrancelha,
    # Subnasale) are now emitted by build_grid_thirds_annotations() and
    # rendered as a sidebar in React.  Severity colours flow through the
    # JSON channel so the React side can mirror the visual cue.
    return out


def build_grid_thirds_annotations(
    lm: Sequence[Sequence[float]],
    metric_evals: Iterable[dict] | None = None,
) -> dict:
    """JSON-side companion of draw_grid_thirds — returns the textual annotations
    the React sidebar should render next to the image.
    """
    y_top   = derive_trichion_y_px(lm, metric_evals)
    y_brow  = (_xy(lm, P_BROW_LEFT_INNER)[1] + _xy(lm, P_BROW_RIGHT_INNER)[1]) / 2.0
    y_sub   = _xy(lm, P_SUBNASALE)[1]
    y_men   = _xy(lm, P_MENTON)[1]
    face_h  = max(1.0, y_men - y_top)
    m_upper  = _metric_get(metric_evals, "upper_third_ratio")
    m_middle = _metric_get(metric_evals, "middle_third_ratio")
    m_lower  = _metric_get(metric_evals, "lower_third_ratio")

    def _pct(metric: dict | None, fallback: float) -> float:
        if metric and isinstance(metric.get("value"), (int, float)):
            return float(metric["value"]) * 100.0
        return fallback

    def _sev(metric: dict | None) -> str | None:
        return (metric or {}).get("severity_5") if metric else None

    rows = [
        ("T1", "Terço superior",  _pct(m_upper,  ((y_brow - y_top) / face_h) * 100.0), _sev(m_upper)),
        ("T2", "Terço médio",     _pct(m_middle, ((y_sub  - y_brow) / face_h) * 100.0), _sev(m_middle)),
        ("T3", "Terço inferior",  _pct(m_lower,  ((y_men  - y_sub) / face_h) * 100.0), _sev(m_lower)),
    ]
    return {
        "ideal_pct": 33.3,
        "rows": [
            {"id": r[0], "label": r[1], "pct": round(r[2], 1),
             "deviation_pct": round(r[2] - 33.3, 1), "severity_5": r[3]}
            for r in rows
        ],
        "legend": {
            "dashed_purple": "Linhas tracejadas: terços ideais (Farkas 1/3 · 2/3)",
            "solid_orange": "Linhas laranja: marcos reais (sobrancelha e subnasale)",
        },
    }


def draw_grid_fifths(image: Image.Image, lm: Sequence[Sequence[float]]) -> Image.Image:
    """Mirrors ``GridFifths`` (OverlayLayer.tsx L322-L385)."""
    out = _to_rgba(image)
    draw = ImageDraw.Draw(out, "RGBA")
    y_top   = _xy(lm, P_FOREHEAD_CROWN)[1]
    y_men   = _xy(lm, P_MENTON)[1]
    x_face_l = _xy(lm, P_ZYGO_IMG_LEFT)[0]
    x_face_r = _xy(lm, P_ZYGO_IMG_RIGHT)[0]
    x_eye_ol = _xy(lm, P_EYE_OUTER_IMG_LEFT)[0]
    x_eye_il = _xy(lm, P_LEFT_EYE_INNER)[0]
    x_eye_ir = _xy(lm, P_RIGHT_EYE_INNER)[0]
    x_eye_or = _xy(lm, P_EYE_OUTER_IMG_RIGHT)[0]

    face_w = max(1.0, x_face_r - x_face_l)
    fifth = face_w / 5.0
    # TSX L368: yLabel = yMen - 10
    y_label = y_men - 10

    # White boundary edges (60% opacity).
    edge_color = (*_FACE_EXTENTS_STROKE, 153)
    draw.line([(x_face_l, y_top), (x_face_l, y_men)], fill=edge_color, width=1)
    draw.line([(x_face_r, y_top), (x_face_r, y_men)], fill=edge_color, width=1)

    ideals  = [x_face_l + i * fifth for i in (1, 2, 3, 4)]
    actuals = [x_eye_ol, x_eye_il, x_eye_ir, x_eye_or]
    names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]

    for x in ideals:
        _dashed_line(draw, (x, y_top), (x, y_men), _GRID_FIFTHS_STROKE, 1, _GRID_DASH)

    for x_real in actuals:
        draw.line([(x_real, y_top), (x_real, y_men)], fill=_REAL_LINE_STROKE, width=2)

    # All textual labels (OExt.E/OInt.E/OInt.D/OExt.D deviations, legend) are
    # now emitted by build_grid_fifths_annotations() for React sidebar rendering.
    return out


def build_grid_fifths_annotations(lm: Sequence[Sequence[float]]) -> dict:
    """JSON companion of draw_grid_fifths."""
    x_face_l = _xy(lm, P_ZYGO_IMG_LEFT)[0]
    x_face_r = _xy(lm, P_ZYGO_IMG_RIGHT)[0]
    x_eye_ol = _xy(lm, P_EYE_OUTER_IMG_LEFT)[0]
    x_eye_il = _xy(lm, P_LEFT_EYE_INNER)[0]
    x_eye_ir = _xy(lm, P_RIGHT_EYE_INNER)[0]
    x_eye_or = _xy(lm, P_EYE_OUTER_IMG_RIGHT)[0]
    face_w = max(1.0, x_face_r - x_face_l)
    fifth = face_w / 5.0
    ideals  = [x_face_l + i * fifth for i in (1, 2, 3, 4)]
    actuals = [x_eye_ol, x_eye_il, x_eye_ir, x_eye_or]
    names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
    return {
        "rows": [
            {"id": n, "deviation_px": round(a - i)}
            for n, a, i in zip(names, actuals, ideals)
        ],
        "legend": {
            "dashed_purple": "Tracejado roxo: divisões ideais (1/5 da largura facial)",
            "solid_orange": "Linhas laranja: posição real do canto ocular",
        },
    }


def draw_outline_face(
    image: Image.Image,
    lm: Sequence[Sequence[float]],
    metric_evals: Iterable[dict] | None = None,
) -> Image.Image:
    """Mirrors ``OutlineFace`` (OverlayLayer.tsx L387-L395).

    When metric_evals provides upper_third_ratio, overrides lm[10].y with the
    derived trichion so the contour top aligns with the hairline.
    """
    out = _to_rgba(image)
    draw = ImageDraw.Draw(out, "RGBA")
    trichion_y = derive_trichion_y_px(lm, metric_evals)
    # Build pts; flatten ALL forehead-ridge points to trichion_y so the top
    # of the polygon is a smooth horizontal band linking the temples through
    # the trichion (no isolated horn at the centre crown).
    pts = []
    for i in LM_JAWLINE:
        x, y = _xy(lm, i)
        if i in LM_FOREHEAD_RIDGE:
            y = trichion_y
        pts.append((x, y))
    draw.line(pts, fill=_OUTLINE_FACE_STROKE, width=2, joint="curve")
    return out


def draw_face_extents(
    image: Image.Image,
    lm: Sequence[Sequence[float]],
    trichion_source: str | None = "mesh",
    metric_evals: Iterable[dict] | None = None,
) -> Image.Image:
    """Mirrors ``FaceExtents`` (OverlayLayer.tsx L218-L233).

    y_top is derived from ``upper_third_ratio`` when available so the bounding
    box top is consistent with the ideal-thirds overlay.
    """
    out = _to_rgba(image)
    draw = ImageDraw.Draw(out, "RGBA")
    y_top   = derive_trichion_y_px(lm, metric_evals)
    y_men   = _xy(lm, P_MENTON)[1]
    x_left  = _xy(lm, P_ZYGO_IMG_LEFT)[0]
    x_right = _xy(lm, P_ZYGO_IMG_RIGHT)[0]
    draw.line([(x_left, y_top),    (x_right, y_top)],    fill=_FACE_EXTENTS_STROKE, width=2)
    draw.line([(x_left, y_men),    (x_right, y_men)],    fill=_FACE_EXTENTS_STROKE, width=2)
    draw.line([(x_left, y_top),    (x_left,  y_men)],    fill=_FACE_EXTENTS_STROKE, width=2)
    draw.line([(x_right, y_top),   (x_right, y_men)],    fill=_FACE_EXTENTS_STROKE, width=2)
    # Trichion / Menton labels are emitted by build_face_extents_annotations()
    # for sidebar rendering — no burned-in text.
    return out


def build_face_extents_annotations(
    lm: Sequence[Sequence[float]],
    trichion_source: str | None = "mesh",
    metric_evals: Iterable[dict] | None = None,
) -> dict:
    """JSON companion of draw_face_extents."""
    y_top = derive_trichion_y_px(lm, metric_evals)
    y_men = _xy(lm, P_MENTON)[1]
    x_left  = _xy(lm, P_ZYGO_IMG_LEFT)[0]
    x_right = _xy(lm, P_ZYGO_IMG_RIGHT)[0]
    return {
        "trichion_source": trichion_source or "mesh",
        "trichion_label": "Trichion (BiSeNet)" if trichion_source == "bisenet" else "Trichion (mesh)",
        "menton_label": "Menton",
        "face_height_px": round(y_men - y_top, 1),
        "face_width_px": round(x_right - x_left, 1),
        "legend": "Caixa branca: extensão facial Trichion → Menton (altura) · Zigomáticos (largura).",
    }


def draw_improvement_vectors(
    image: Image.Image,
    lm: Sequence[Sequence[float]],
    metric_evals: Iterable[dict] | None,
) -> tuple[Image.Image, int]:
    """Mirrors ``ImprovementVectors`` (OverlayLayer.tsx L408-L478).

    Returns ``(image, drawn_count)`` so the rig can log how many arrows
    were produced — handy for diagnosing data-population gaps.
    """
    out = _to_rgba(image)
    draw = ImageDraw.Draw(out, "RGBA")
    icd = _icd_px(lm)
    if icd < 1.0 or not metric_evals:
        return out, 0

    drawn = 0
    arrow_size = 9.0
    wing_w = 4.0
    for metric in metric_evals:
        vx = metric.get("improvement_vector_x")
        vy = metric.get("improvement_vector_y")
        if vx is None or vy is None:
            continue
        sev = metric.get("severity_5") or metric.get("severity5")
        # TSX L449: if (!severity_5 || severity_5 === "ideal") continue
        # Both null AND "ideal" are skipped — no arrow needed.
        if not sev or str(sev).lower() == "ideal":
            continue
        # TSX L452: strict — no dependency_landmarks fallback.
        anchor = metric.get("anchor_landmark_index")
        if anchor is None:
            continue
        sx, sy = _xy(lm, int(anchor))
        ex = sx + float(vx) * icd
        ey = sy + float(vy) * icd
        dx = ex - sx
        dy = ey - sy
        length = math.hypot(dx, dy)
        if length < 2.0:
            continue
        nx = dx / length
        ny = dy / length
        color = SEVERITY_ARROW_COLORS.get(
            (str(sev).lower() if sev else "moderate"),
            SEVERITY_ARROW_COLORS["moderate"],
        )
        # TSX L479: strokeWidth={2}
        draw.line([(sx, sy), (ex, ey)], fill=color, width=2)
        w1 = (ex - nx * arrow_size + ny * wing_w, ey - ny * arrow_size - nx * wing_w)
        w2 = (ex - nx * arrow_size - ny * wing_w, ey - ny * arrow_size + nx * wing_w)
        draw.polygon([(ex, ey), w1, w2], fill=color)
        drawn += 1
    return out, drawn
