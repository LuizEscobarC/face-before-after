"""Before/Ideal vector composer — PR-41 (M3.4, Opus required).

This module renders a **side-by-side composition** of:

  * Left pane  — the original photo (untouched).
  * Right pane — the original photo with two overlaid wireframes:
      - the *actual* landmark wireframe (subtle gray, solid),
      - the *ideal* landmark wireframe (cyan ``#22d3ee``, dashed 4/2 per DEC-26),
        where each ``IdealLandmarkOffset`` shifts the relevant landmark by
        ``(dx_icu, dy_icu)`` units (intercanthal units → pixels via the live
        ICD = ‖lm[362] − lm[133]‖ in pixels).

**No warp.** Pixel data is never resampled or distorted (DEC-15, PLAN_METRICS
§2). Showing a "morphed" face creates a strong implicit promise of cosmetic
outcome that this product explicitly refuses to make. The vetorial wireframe
keeps the comparison anchored on geometry while leaving the photo intact.

The wireframes drawn cover the canonical anatomic outlines defined in
``app.domain.landmarks_mesh``:

  * jawline (17 pts polyline)
  * left/right brow (5 pts each)
  * left/right eye (6 pts each, closed)
  * outer mouth (12 pts, closed)
  * nose bridge (4 pts polyline)

These are the same outlines a sketch artist would use; they cover all
regions for which PR-34 emits ``improvement_vector`` (midline, chin,
brows) plus surrounding anatomy so the ideal silhouette is legible even
when only one or two landmarks shift.

Hard rules
----------

1. **Magnitude cap** — each ``dx_icu`` / ``dy_icu`` is clipped to ``±0.3``
   ICU. Mirrors the cap used by ``MetricCalculator.improvement_vector``
   (PR-34, see ``backend/app/services/metrics/symmetry.py`` etc.). Rationale:
   above 30 % of intercanthal distance the "ideal" silhouette stops being
   anatomically plausible and the comparison becomes misleading.

2. **Degenerate ICD guard** — if ICD < 1 px, raise
   :class:`BeforeIdealComposeError` with reason
   ``"intercanthal_distance_degenerate"``. The caller (router/Nest) MUST
   convert this into an HTTP 422 + ``processing_note``.

3. **Landmark count guard** — array must contain at least ``MIN_LANDMARKS``
   (478) points; otherwise raise.

4. **Z-order on right pane** (consistent with DEC-25):
        photo (z=0) → guide lines (z=10) → actual wireframe (z=20)
        → ideal wireframe (z=40)
   Heatmaps are not produced here (separate module).

5. **Pixel ownership** — left pane is the input image **byte-identical**.
   The composer NEVER writes onto the left pane. This is part of the
   "no implicit warp promise" contract: the user can always look at the
   left pane and see the photo exactly as captured.

Public API
----------

    compose_before_ideal(image, landmarks, offsets, *, …) -> Image.Image

References
----------
  * PLAN_M3_OVERLAYS.md §2 "Sub-marco M3.4", §3 (DEC-15, DEC-26)
  * PLAN_METRICS.md §2 (DEC-15: vector first, warp later)
  * Naini, F.B. (2011) *Facial Aesthetics: Concepts and Clinical Diagnosis* —
    Chapter 4 (vertical/horizontal proportions), Chapter 6 (mid-sagittal axis)
  * Powell, N. & Humphreys, B. (1984) *Proportions of the Aesthetic Face*
  * Farkas, L.G. (1994) *Anthropometry of the Head and Face*
  * MediaPipe Face Mesh-478 indices —
    https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md
  * Pillow PIL.ImageDraw.line / polygon —
    https://pillow.readthedocs.io/en/stable/reference/ImageDraw.html
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable

import numpy as np
from PIL import Image, ImageDraw

from app.domain.landmarks_mesh import (
    LM_JAWLINE,
    LM_LEFT_BROW,
    LM_LEFT_EYE,
    LM_NOSE_BRIDGE,
    LM_OUTER_MOUTH,
    LM_RIGHT_BROW,
    LM_RIGHT_EYE,
    P_LEFT_EYE_INNER,
    P_RIGHT_EYE_INNER,
    TOTAL_LANDMARKS,
)

# ---------------------------------------------------------------------------
# Constants — exposed for tests
# ---------------------------------------------------------------------------

#: Maximum |offset| in intercanthal units. Mirrors PR-34 calculator caps.
OFFSET_MAGNITUDE_CAP_ICU: float = 0.3

#: Minimum ICD (px) below which the composition is considered degenerate.
MIN_ICD_PX: float = 1.0

#: Minimum landmark count for the composer (MediaPipe Mesh-478).
MIN_LANDMARKS: int = TOTAL_LANDMARKS  # 478

#: Width (px) of the white separator gutter between the two panes.
DEFAULT_GUTTER_PX: int = 8

#: Cyan accent for the ideal wireframe (DEC-26, palette --accent2).
IDEAL_STROKE_RGB: tuple[int, int, int] = (0x22, 0xd3, 0xee)
IDEAL_STROKE_WIDTH: int = 2
IDEAL_DASH: tuple[int, int] = (4, 2)

#: Subtle gray for the actual wireframe (drawn beneath the ideal cyan).
ACTUAL_STROKE_RGBA: tuple[int, int, int, int] = (220, 220, 220, 160)
ACTUAL_STROKE_WIDTH: int = 1

#: Faint cyan for guide lines (vertical midline + horizontal intercanthal).
GUIDE_STROKE_RGBA: tuple[int, int, int, int] = (0x22, 0xd3, 0xee, 90)
GUIDE_STROKE_WIDTH: int = 1
GUIDE_DASH: tuple[int, int] = (6, 4)

#: Color used for the gutter (separator) between the panes.
GUTTER_RGB: tuple[int, int, int] = (10, 10, 18)


# ---------------------------------------------------------------------------
# Public dataclasses & errors
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class IdealLandmarkOffset:
    """A per-landmark displacement toward the ideal, in ICU.

    Attributes:
        landmark_index: MediaPipe Mesh-478 index (0..477).
        dx_icu: horizontal offset, positive = right of the photo.
        dy_icu: vertical offset, positive = down (PIL coords).
        metric_id: traceability tag (e.g. ``"midline_deviation"``); not drawn,
            but appears in error messages and logs.
    """

    landmark_index: int
    dx_icu: float
    dy_icu: float
    metric_id: str = ""


class BeforeIdealComposeError(ValueError):
    """Raised when the composition cannot be produced.

    Attributes:
        reason: short machine-readable code (``"intercanthal_distance_degenerate"``,
            ``"insufficient_landmarks"``, ``"invalid_landmark_index"``).
    """

    def __init__(self, reason: str, message: str) -> None:
        super().__init__(message)
        self.reason = reason


# ---------------------------------------------------------------------------
# Wireframe definition — closed polylines describe outlined regions; open
# polylines (None as last entry) describe arc lines.  We list them here so
# the routine that draws actual / ideal lines is one walk through the same
# structure for both wireframes — guarantees identical topology.
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class _Polyline:
    indices: tuple[int, ...]
    closed: bool


_WIREFRAME: tuple[_Polyline, ...] = (
    _Polyline(tuple(LM_JAWLINE), closed=False),
    _Polyline(tuple(LM_LEFT_BROW), closed=False),
    _Polyline(tuple(LM_RIGHT_BROW), closed=False),
    _Polyline(tuple(LM_LEFT_EYE), closed=True),
    _Polyline(tuple(LM_RIGHT_EYE), closed=True),
    _Polyline(tuple(LM_OUTER_MOUTH), closed=True),
    _Polyline(tuple(LM_NOSE_BRIDGE), closed=False),
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _intercanthal_distance(lm: np.ndarray) -> float:
    """Euclidean ICD in pixels between landmarks 133 and 362."""
    dx = float(lm[P_RIGHT_EYE_INNER, 0] - lm[P_LEFT_EYE_INNER, 0])
    dy = float(lm[P_RIGHT_EYE_INNER, 1] - lm[P_LEFT_EYE_INNER, 1])
    return math.hypot(dx, dy)


def _clip_offset_pair(dx: float, dy: float) -> tuple[float, float]:
    """Clamp an (dx, dy) vector to euclidean magnitude cap (DEC-26)."""
    norm = math.hypot(dx, dy)
    if norm > OFFSET_MAGNITUDE_CAP_ICU:
        scale = OFFSET_MAGNITUDE_CAP_ICU / norm
        return dx * scale, dy * scale
    return dx, dy


def _apply_offsets(
    lm: np.ndarray,
    offsets: Iterable[IdealLandmarkOffset],
    icd_px: float,
) -> np.ndarray:
    """Return a fresh ``lm_ideal`` with offsets baked in (ICU → px)."""
    lm_ideal = lm.copy()
    for off in offsets:
        idx = int(off.landmark_index)
        if idx < 0 or idx >= lm.shape[0]:
            raise BeforeIdealComposeError(
                reason="invalid_landmark_index",
                message=(
                    f"IdealLandmarkOffset(metric_id={off.metric_id!r}) references "
                    f"landmark_index={idx}, but only {lm.shape[0]} landmarks were provided."
                ),
            )
        dx_icu, dy_icu = _clip_offset_pair(off.dx_icu, off.dy_icu)
        dx_px = dx_icu * icd_px
        dy_px = dy_icu * icd_px
        lm_ideal[idx, 0] = lm[idx, 0] + dx_px
        lm_ideal[idx, 1] = lm[idx, 1] + dy_px
    return lm_ideal


def _draw_dashed_line(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    fill: tuple[int, int, int] | tuple[int, int, int, int],
    width: int,
    dash: tuple[int, int],
) -> None:
    """Dashed line — PIL has no built-in dashing."""
    x1, y1 = start
    x2, y2 = end
    length = math.hypot(x2 - x1, y2 - y1)
    if length < 1e-6:
        return
    ux = (x2 - x1) / length
    uy = (y2 - y1) / length
    pos = 0.0
    drawing = True
    on_seg, off_seg = float(dash[0]), float(dash[1])
    while pos < length:
        seg = on_seg if drawing else off_seg
        end_pos = min(pos + seg, length)
        if drawing:
            draw.line(
                [(x1 + pos * ux, y1 + pos * uy),
                 (x1 + end_pos * ux, y1 + end_pos * uy)],
                fill=fill,
                width=width,
            )
        pos = end_pos
        drawing = not drawing


def _draw_polyline(
    draw: ImageDraw.ImageDraw,
    lm: np.ndarray,
    poly: _Polyline,
    fill: tuple[int, int, int] | tuple[int, int, int, int],
    width: int,
    dash: tuple[int, int] | None,
    offset_xy: tuple[float, float] = (0.0, 0.0),
) -> None:
    """Draw a polyline through the lm[indices] points, optionally dashed/closed."""
    ox, oy = offset_xy
    pts: list[tuple[float, float]] = [
        (float(lm[i, 0]) + ox, float(lm[i, 1]) + oy) for i in poly.indices
    ]
    if poly.closed:
        pts.append(pts[0])
    if dash is None:
        # PIL's `line` accepts a list of points; each consecutive pair becomes
        # one segment (good for solid polylines).
        draw.line(pts, fill=fill, width=width)
    else:
        for a, b in zip(pts[:-1], pts[1:]):
            _draw_dashed_line(draw, a, b, fill=fill, width=width, dash=dash)


def _draw_guide_lines(
    draw: ImageDraw.ImageDraw,
    lm: np.ndarray,
    pane_w: int,
    pane_h: int,
    offset_xy: tuple[float, float],
) -> None:
    """Draw the optional cyan-faint vertical midline + horizontal intercanthal."""
    ox, oy = offset_xy
    x_mid = float((lm[P_LEFT_EYE_INNER, 0] + lm[P_RIGHT_EYE_INNER, 0]) / 2) + ox
    y_mid = float((lm[P_LEFT_EYE_INNER, 1] + lm[P_RIGHT_EYE_INNER, 1]) / 2) + oy
    # vertical midline — full pane height
    _draw_dashed_line(
        draw,
        (x_mid, oy),
        (x_mid, oy + pane_h),
        fill=GUIDE_STROKE_RGBA,
        width=GUIDE_STROKE_WIDTH,
        dash=GUIDE_DASH,
    )
    # horizontal intercanthal — full pane width
    _draw_dashed_line(
        draw,
        (ox, y_mid),
        (ox + pane_w, y_mid),
        fill=GUIDE_STROKE_RGBA,
        width=GUIDE_STROKE_WIDTH,
        dash=GUIDE_DASH,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compose_before_ideal(
    image: Image.Image,
    landmarks: np.ndarray,
    offsets: Iterable[IdealLandmarkOffset] = (),
    *,
    show_actual_wireframe: bool = True,
    show_guide_lines: bool = True,
    gutter_px: int = DEFAULT_GUTTER_PX,
) -> Image.Image:
    """Return a side-by-side RGBA composition (before | ideal).

    Args:
        image: source photo (any mode; will be converted to RGBA).
        landmarks: shape (N, 2) or (N, 3) of pixel coordinates from MediaPipe
            Mesh-478. Only the first two columns are used.
        offsets: iterable of :class:`IdealLandmarkOffset` describing the per-
            landmark displacement (in ICU) of the *ideal* silhouette
            relative to the actual landmarks. Empty iterable = "no proposed
            improvement"; the right pane then shows the actual wireframe in
            both gray (solid) and cyan (dashed) — useful for tooling /
            UI scaffolding without prescribing change.
        show_actual_wireframe: if False, the gray actual-wireframe layer is
            skipped on the right pane. Cyan ideal lines remain.
        show_guide_lines: if True, draws the faint cyan vertical midline
            and horizontal intercanthal line on the right pane.
        gutter_px: width of the dark gutter between the two panes.

    Returns:
        A new ``PIL.Image.Image`` in RGBA mode with size
        ``(2 * pane_w + gutter_px, pane_h)`` where ``pane_w`` and ``pane_h``
        match the original image.

    Raises:
        BeforeIdealComposeError: if landmarks count is below
            :data:`MIN_LANDMARKS`, ICD is below :data:`MIN_ICD_PX`, or any
            offset references an out-of-range landmark index.
    """
    # --- Input guards -----------------------------------------------------
    lm = np.asarray(landmarks, dtype=np.float64)
    if lm.ndim != 2 or lm.shape[1] < 2:
        raise BeforeIdealComposeError(
            reason="invalid_landmark_shape",
            message=f"landmarks must be (N, 2) or (N, 3); got shape {lm.shape}",
        )
    if lm.shape[0] < MIN_LANDMARKS:
        raise BeforeIdealComposeError(
            reason="insufficient_landmarks",
            message=(
                f"BeforeIdealComposer needs {MIN_LANDMARKS} landmarks "
                f"(MediaPipe Mesh-478); got {lm.shape[0]}."
            ),
        )

    icd_px = _intercanthal_distance(lm)
    if icd_px < MIN_ICD_PX:
        raise BeforeIdealComposeError(
            reason="intercanthal_distance_degenerate",
            message=(
                f"Intercanthal distance is {icd_px:.4f} px — below MIN_ICD_PX="
                f"{MIN_ICD_PX} px. Cannot scale ICU offsets to pixels."
            ),
        )

    # --- Apply offsets to a fresh landmark array -------------------------
    lm_ideal = _apply_offsets(lm, offsets, icd_px)

    # --- Build canvas ----------------------------------------------------
    base = image.convert("RGBA")
    pane_w, pane_h = base.size
    canvas_w = 2 * pane_w + gutter_px
    canvas = Image.new("RGBA", (canvas_w, pane_h), GUTTER_RGB + (255,))

    # Left pane = original photo, byte-identical.
    canvas.paste(base, (0, 0))

    # Right pane = original photo (we paste it again so the wireframes have
    # context); we then draw onto an overlay surface for proper alpha
    # blending of the gray/cyan strokes.
    canvas.paste(base, (pane_w + gutter_px, 0))

    # Overlay layer (full canvas) — drawn into and alpha-composited at the end
    # so dashed cyan lines blend with the photo instead of overwriting pixels.
    overlay = Image.new("RGBA", (canvas_w, pane_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    right_offset_xy = (float(pane_w + gutter_px), 0.0)

    # z=10 — guide lines (drawn first so wireframes sit on top)
    if show_guide_lines:
        _draw_guide_lines(draw, lm, pane_w, pane_h, right_offset_xy)

    # z=20 — actual wireframe (gray, solid) on right pane only.
    if show_actual_wireframe:
        for poly in _WIREFRAME:
            _draw_polyline(
                draw,
                lm,
                poly,
                fill=ACTUAL_STROKE_RGBA,
                width=ACTUAL_STROKE_WIDTH,
                dash=None,
                offset_xy=right_offset_xy,
            )

    # z=40 — ideal wireframe (cyan, dashed) on right pane only.
    for poly in _WIREFRAME:
        _draw_polyline(
            draw,
            lm_ideal,
            poly,
            fill=IDEAL_STROKE_RGB,
            width=IDEAL_STROKE_WIDTH,
            dash=IDEAL_DASH,
            offset_xy=right_offset_xy,
        )

    # Composite overlay onto canvas.
    out = Image.alpha_composite(canvas, overlay)
    return out


__all__ = [
    "BeforeIdealComposeError",
    "DEFAULT_GUTTER_PX",
    "GUIDE_DASH",
    "GUIDE_STROKE_RGBA",
    "IDEAL_DASH",
    "IDEAL_STROKE_RGB",
    "IDEAL_STROKE_WIDTH",
    "IdealLandmarkOffset",
    "MIN_ICD_PX",
    "MIN_LANDMARKS",
    "OFFSET_MAGNITUDE_CAP_ICU",
    "compose_before_ideal",
]
