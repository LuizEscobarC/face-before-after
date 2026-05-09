"""Heatmap renderers for facial overlays — PR-37 (asymmetry) + PR-38 (ideal adherence).

This module is the **only** place where overlay heatmaps are generated. It is
isolated from the line-overlay code in ``backend/app/vision/routers/render.py``
because the implementation pitfalls are different: linework is deterministic
and pixel-exact; heatmaps are interpolated and depend on density gating to
avoid producing colored noise outside the data's support region.

Two renderers are exposed:

  * ``render_asymmetry_heatmap(image, lm)``
        Mirror-distance heatmap. Per ``MIRROR_PAIRS_*`` from
        ``backend/app/domain/landmarks_mesh.py``, computes
        ``delta = || lm_left - mirror(lm_right) ||`` in normalised intercanthal
        units (ICU), where the mirror axis is the inner-canthus midline. The
        deltas are interpolated by ``scipy.interpolate.griddata`` (cubic) over a
        regular grid restricted to the convex hull of all 478 landmarks, then
        masked outside the hull. PR-37 spec
        (PLAN_M3_OVERLAYS §2 "Sub-marco M3.3", page anchored at line ~80).

  * ``render_ideal_adherence_heatmap(image, lm, region_metric_evaluations)``
        Per-region adherence in [0..1], where ``adherence = 1 -
        clip(|deviation_normalized|, 0, 1)`` weighted by ``confidence_final``.
        The scalar of each region is projected onto **all** landmarks belonging
        to that region (regional anchor sets — see ``_REGION_ANCHOR_LANDMARKS``)
        and then interpolated identically to the asymmetry heatmap.
        PR-38 spec (PLAN_M3_OVERLAYS §2).

Hard rules (PLAN_M3_OVERLAYS §1.1, §3, §4)
------------------------------------------

1. **Density-suppression cascade L1 / L2 / L3** (DEC-21, line 134):
   - L1: an interpolation grid cell with **fewer than 3 valid input points
     within radius = 0.5 × intercanthal distance** is masked to transparent.
   - L2: if the count of valid input samples is below
     ``MIN_GLOBAL_SAMPLE_COUNT`` (=8), the renderer raises
     :class:`HeatmapSuppressedError` with reason ``"global_density_below_l2"``.
     The caller (router / Nest orchestrator) must turn this into a no-asset
     response and append a ``processing_note`` to ``analysis_report``.
   - L3 is enforced upstream (Nest ``RenderedAssetService`` filters
     non-critical overlay deps before invoking this module).

2. **Convex-hull clipping** is mandatory. ``scipy.interpolate.griddata`` with
   ``method='cubic'`` extrapolates **wildly** beyond the convex hull of the
   input points, producing colored noise on the forehead, neck, and
   background that has zero semantic meaning. We compute the hull from the
   478 mesh landmarks (not just the input samples), then mask every grid
   pixel outside it. Reference: scipy.interpolate.griddata documentation,
   "Interpolation will not extrapolate" warning —
   https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.griddata.html

3. **Colormap**: a daltonic-friendly diverging colormap (blue → white → red)
   for asymmetry (signed-magnitude) and a sequential green→yellow→red for
   adherence. Implemented in pure numpy to avoid pulling matplotlib (and its
   font cache + GUI backend overhead) into the API container. The blue/red
   choice mirrors matplotlib ``coolwarm`` per DEC-22 (PLAN_M3_OVERLAYS §3).
   The piecewise stops are documented inline.

4. **Resolution**: 512×512 max for the interpolation grid (DEC-23). The
   output PIL image is alpha-blended onto the original photo at the photo's
   native resolution; we resize the heatmap up via bilinear PIL to match.

5. **Z-order** (DEC-25): heatmap is drawn at z=30 with alpha=0.55. This
   module returns an RGBA PIL image; the caller decides whether to blend.
   Default ``alpha`` parameter is 0.55.

References
----------
  * PLAN_M3_OVERLAYS.md §1.1 (cascade), §2 (PR-37/PR-38 rows), §3 (DEC-21..26),
    §4 (armadilhas)
  * scipy.interpolate.griddata — https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.griddata.html
  * scipy.spatial.ConvexHull — https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.ConvexHull.html
  * matplotlib coolwarm reference (visual baseline only) —
    https://matplotlib.org/stable/users/explain/colors/colormaps.html
  * Daltonic-safe colormap discussion — Crameri et al. (2020), "The misuse of
    colour in science communication" — https://www.nature.com/articles/s41467-020-19160-7
  * Naini, F.B. (2011) Facial Aesthetics §2 (Marquardt mirror principle)
  * MediaPipe Mesh-478 landmark indices —
    https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable

import numpy as np
from PIL import Image
from scipy.interpolate import griddata
from scipy.spatial import ConvexHull, QhullError

from app.domain.landmarks_mesh import (
    LM_JAWLINE,
    LM_LEFT_BROW,
    LM_LEFT_EYE,
    LM_NOSE_BRIDGE,
    LM_NOSE_TIP,
    LM_OUTER_MOUTH,
    LM_RIGHT_BROW,
    LM_RIGHT_EYE,
    MIRROR_PAIRS_BROWS,
    MIRROR_PAIRS_EYES,
    MIRROR_PAIRS_JAWLINE,
    P_LEFT_EYE_INNER,
    P_RIGHT_EYE_INNER,
    TOTAL_LANDMARKS,
)

# ---------------------------------------------------------------------------
# Constants — every magic number documented + cross-referenced.
# ---------------------------------------------------------------------------

#: Maximum resolution of the interpolation grid (DEC-23, PLAN_M3_OVERLAYS §3).
GRID_RESOLUTION: int = 512

#: Density-supp L1: minimum number of valid input samples that must lie
#: within ``LOCAL_DENSITY_RADIUS_ICU × intercanthal_distance`` of a grid pixel
#: for it to render. PLAN_M3_OVERLAYS §1.1 (line 11 of cascade table) +
#: §4 anti-pattern #2.
LOCAL_DENSITY_MIN_NEIGHBORS: int = 3
LOCAL_DENSITY_RADIUS_ICU: float = 0.5

#: Density-supp L2: minimum total sample count to render *anything*. Below
#: this the renderer raises HeatmapSuppressedError. Chosen as the smallest
#: number that still gives ConvexHull a usable input (qhull needs ≥3 in 2D).
MIN_GLOBAL_SAMPLE_COUNT: int = 8

#: Default blend alpha for the heatmap layer over the source photo.
#: DEC-25 z-order: heatmaps z=30, alpha=0.55.
DEFAULT_ALPHA: float = 0.55

#: Asymmetry magnitude saturation point in ICU. Above this delta the heatmap
#: clamps to deepest red. Tuned so that 0.05 ICU (≈3 mm on a typical face)
#: is mid-saturation. Naini 2011 §2 reports clinically-noticeable asymmetry
#: starts ~2 mm interocular-normalised; we set 0.10 as the saturation ceiling.
ASYMMETRY_SATURATION_ICU: float = 0.10

#: Per-region landmark anchor sets used to project a single region-level
#: scalar (adherence ∈ [0,1]) onto interpolation samples. Keys mirror
#: ``MetricDefinition.region`` enum values from PR-2 / PR-11.
#:
#: Notes:
#:  - ``symmetry`` deliberately uses jawline + brow + eye union: it is a
#:    "global on the periphery" region whose adherence colors the entire face
#:    silhouette.
#:  - ``photo_quality`` is intentionally NOT in this map — it is global and
#:    rendering it as a regional heatmap would be misleading.
_REGION_ANCHOR_LANDMARKS: dict[str, list[int]] = {
    "eyes":        list(LM_LEFT_EYE) + list(LM_RIGHT_EYE),
    "brows":       list(LM_LEFT_BROW) + list(LM_RIGHT_BROW),
    "nose":        list(LM_NOSE_BRIDGE) + list(LM_NOSE_TIP),
    "mouth":       list(LM_OUTER_MOUTH),
    "jaw":         list(LM_JAWLINE),
    "chin":        [152, 175, 199, 200, 201],   # menton + para-menton points
    "midface":     [50, 280, 187, 411, 117, 346],
    "cheekbones":  [50, 280, 187, 411],
    "forehead":    [10, 67, 297, 332, 103],
    "global":      list(range(TOTAL_LANDMARKS)),  # rare; whole-face scalar
    "symmetry":    list(LM_JAWLINE)
                   + list(LM_LEFT_BROW) + list(LM_RIGHT_BROW)
                   + list(LM_LEFT_EYE) + list(LM_RIGHT_EYE),
}


# ---------------------------------------------------------------------------
# Public exceptions
# ---------------------------------------------------------------------------

class HeatmapSuppressedError(RuntimeError):
    """Raised when L2 density suppression triggers — caller must skip render."""

    def __init__(self, reason: str, sample_count: int):
        super().__init__(f"Heatmap suppressed: {reason} (samples={sample_count})")
        self.reason = reason
        self.sample_count = sample_count


# ---------------------------------------------------------------------------
# Public input shape for ideal-adherence
# ---------------------------------------------------------------------------

@dataclass(frozen=True, slots=True)
class RegionAdherenceSample:
    """One region's adherence scalar + confidence used by PR-38.

    ``adherence`` is 1.0 when the region's metrics are at their ideal central
    value, 0.0 when they are saturated (1× green range or beyond). It is
    derived upstream by averaging ``1 - clip(|deviation_normalized|, 0, 1)``
    across the region's metrics, weighted by ``confidence_final``.
    """

    region: str
    adherence: float       # in [0.0, 1.0]
    confidence: float      # in [0.0, 1.0]


# ---------------------------------------------------------------------------
# Internal helpers — shared between the two public renderers.
# ---------------------------------------------------------------------------

def _intercanthal_distance(lm: np.ndarray) -> float:
    """Pixel distance between inner canthi (the natural facial scale unit)."""
    p_l = lm[P_LEFT_EYE_INNER]
    p_r = lm[P_RIGHT_EYE_INNER]
    return float(math.hypot(p_r[0] - p_l[0], p_r[1] - p_l[1]))


def _face_hull_mask(lm: np.ndarray, w: int, h: int) -> np.ndarray:
    """Boolean mask shape (h, w): True inside the face convex hull.

    Uses all 478 mesh points (not just the heatmap's input samples) because
    we want to mask down to the **face**, not the data's support — those are
    different shapes. Without this, asymmetry heatmaps with deltas only at
    jawline+brows would produce a hourglass-shaped colored region with empty
    cheeks; with this, the entire face silhouette is included even where
    adjacent samples are sparse (the in-hull pixels just fall back to the
    nearest cubic interpolation, which behaves well *inside* the hull).
    """
    try:
        hull = ConvexHull(lm[:, :2])
    except QhullError as exc:
        raise HeatmapSuppressedError("convex_hull_failed", lm.shape[0]) from exc

    # Build a polygon mask via ray-casting on a numpy grid.
    # Faster than PIL.ImageDraw.polygon for the typical 512×512 grid + ~30
    # hull vertices, and avoids depending on PIL polygon fill semantics.
    poly = lm[hull.vertices, :2]  # ordered counter-clockwise by qhull
    return _point_in_polygon_mask(poly, w, h)


def _point_in_polygon_mask(poly: np.ndarray, w: int, h: int) -> np.ndarray:
    """Vectorised ray-casting: True where the integer pixel is inside ``poly``."""
    # Build the test points: all (x + 0.5, y + 0.5) integer pixel centres.
    xs = np.arange(w, dtype=np.float64) + 0.5
    ys = np.arange(h, dtype=np.float64) + 0.5
    # Crossing-number algorithm, vectorised over all pixels at once.
    n = poly.shape[0]
    inside = np.zeros((h, w), dtype=bool)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        # Edge straddles each test row?
        cond_y = ((y1 > ys) != (y2 > ys))  # shape (h,)
        # Avoid div-by-zero on horizontal edges (cond_y is False there).
        with np.errstate(divide="ignore", invalid="ignore"):
            x_cross = x1 + (ys - y1) * (x2 - x1) / np.where(y2 == y1, 1.0, y2 - y1)
        # Broadcast x_cross (h,) against xs (w,)
        crossings = (xs[None, :] < x_cross[:, None]) & cond_y[:, None]
        inside ^= crossings
    return inside


def _local_density_mask(
    sample_xy: np.ndarray,
    w: int,
    h: int,
    radius_px: float,
    min_neighbors: int,
) -> np.ndarray:
    """L1 mask: True where ≥``min_neighbors`` samples lie within ``radius_px``.

    O(n_samples × w × h) with vectorisation per sample (memory-friendly:
    avoids broadcasting an h × w × n tensor). For 30 samples × 512² grid this
    is ~8M ops — milliseconds.
    """
    xs = np.arange(w, dtype=np.float32)
    ys = np.arange(h, dtype=np.float32)
    counts = np.zeros((h, w), dtype=np.int32)
    r2 = radius_px * radius_px
    for sx, sy in sample_xy:
        dx = xs - sx
        dy = ys - sy
        d2 = (dx * dx)[None, :] + (dy * dy)[:, None]
        counts += (d2 <= r2).astype(np.int32)
    return counts >= min_neighbors


def _interpolate_grid(
    sample_xy: np.ndarray,
    sample_values: np.ndarray,
    w: int,
    h: int,
) -> np.ndarray:
    """Cubic griddata over a regular w × h grid. NaN where extrapolated.

    Raises
    ------
    HeatmapSuppressedError
        If qhull cannot triangulate (input is collinear / too few unique
        points). Caller turns this into a 422.
    """
    grid_x, grid_y = np.meshgrid(
        np.arange(w, dtype=np.float64),
        np.arange(h, dtype=np.float64),
    )
    try:
        out = griddata(
            points=sample_xy,
            values=sample_values,
            xi=(grid_x, grid_y),
            method="cubic",
            fill_value=np.nan,
        )
    except QhullError as exc:
        raise HeatmapSuppressedError(
            "qhull_triangulation_failed", sample_xy.shape[0],
        ) from exc
    return out


def _coolwarm_rgba(values: np.ndarray) -> np.ndarray:
    """Diverging colormap blue → white → red. Pure numpy.

    Input ``values`` ∈ [-1, 1] (NaN-safe, NaN → fully transparent).
    Output shape: ``(*values.shape, 4)`` uint8 RGBA.

    Stops were chosen visually to mimic matplotlib's ``coolwarm`` palette
    (DEC-22). Anchors:
        -1.0  → (59,  76, 192)   deep blue
        -0.5  → (143, 161, 240)  light blue
         0.0  → (240, 240, 240)  near-white
        +0.5  → (240, 158, 138)  light red
        +1.0  → (180,  4,  38)   deep red
    """
    return _piecewise_rgba(
        values,
        stops=[
            (-1.0, (59, 76, 192)),
            (-0.5, (143, 161, 240)),
            (0.0, (240, 240, 240)),
            (0.5, (240, 158, 138)),
            (1.0, (180, 4, 38)),
        ],
    )


def _adherence_rgba(values: np.ndarray) -> np.ndarray:
    """Sequential green → yellow → red. For PR-38 (1=ideal, 0=far).

    Input ``values`` ∈ [0, 1]. Higher = greener (better).
    """
    return _piecewise_rgba(
        values,
        stops=[
            (0.0, (180, 4, 38)),       # red (far from ideal)
            (0.5, (255, 200, 60)),     # amber
            (1.0, (60, 180, 90)),      # green (ideal)
        ],
    )


def _piecewise_rgba(
    values: np.ndarray,
    stops: list[tuple[float, tuple[int, int, int]]],
) -> np.ndarray:
    """Linear-interpolate RGB across ``stops``. NaN → alpha=0."""
    nan_mask = np.isnan(values)
    safe = np.where(nan_mask, 0.0, values)
    rgb = np.zeros((*values.shape, 3), dtype=np.float64)
    # walk stops to assign per-pixel rgb via linear segment lookup
    for i in range(len(stops) - 1):
        v0, c0 = stops[i]
        v1, c1 = stops[i + 1]
        m = (safe >= v0) & (safe <= v1)
        if not m.any():
            continue
        # avoid div0 (stops with equal v shouldn't happen but be safe)
        denom = (v1 - v0) if (v1 - v0) != 0 else 1.0
        t = ((safe[m] - v0) / denom)[:, None]  # shape (k, 1)
        c0v = np.array(c0, dtype=np.float64)[None, :]
        c1v = np.array(c1, dtype=np.float64)[None, :]
        rgb[m] = (1 - t) * c0v + t * c1v
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    alpha = np.where(nan_mask, 0, 255).astype(np.uint8)
    return np.concatenate([rgb, alpha[..., None]], axis=-1)


def _build_heatmap_image(
    sample_xy: np.ndarray,
    sample_values: np.ndarray,
    img_w: int,
    img_h: int,
    palette: str,
    icd_full_px: float,
) -> Image.Image:
    """Common pipeline: density-supp + interp + colormap + masking + upsample.

    ``palette`` ∈ {'coolwarm', 'adherence'}.
    ``icd_full_px``: intercanthal distance measured in the **input** image's
    pixel space — used to derive the L1 density-support radius. Translated
    to grid pixels by the same scale factor we apply to the samples.

    Raises HeatmapSuppressedError on L2.
    """
    n = sample_xy.shape[0]
    if n < MIN_GLOBAL_SAMPLE_COUNT:
        raise HeatmapSuppressedError("global_density_below_l2", n)

    # Work the interpolation on a downsampled grid for performance.
    grid_w = min(GRID_RESOLUTION, img_w)
    grid_h = min(GRID_RESOLUTION, img_h)
    scale_x = grid_w / img_w
    scale_y = grid_h / img_h
    # Preserve aspect ratio for distance metrics — use mean scale for ICD.
    scale_mean = 0.5 * (scale_x + scale_y)

    grid_samples = sample_xy.copy()
    grid_samples[:, 0] *= scale_x
    grid_samples[:, 1] *= scale_y

    grid_radius_px = LOCAL_DENSITY_RADIUS_ICU * icd_full_px * scale_mean

    # Interpolate.
    interp = _interpolate_grid(grid_samples, sample_values, grid_w, grid_h)

    # L1 density mask.
    density_ok = _local_density_mask(
        grid_samples, grid_w, grid_h,
        radius_px=grid_radius_px,
        min_neighbors=LOCAL_DENSITY_MIN_NEIGHBORS,
    )
    interp = np.where(density_ok, interp, np.nan)

    # Clamp to colormap range before mapping. Cubic interpolation can produce
    # values outside sample range (Runge phenomenon); clip preserves NaN.
    if palette == "coolwarm":
        interp = np.clip(interp, -1.0, 1.0)
        rgba_grid = _coolwarm_rgba(interp)
    elif palette == "adherence":
        interp = np.clip(interp, 0.0, 1.0)
        rgba_grid = _adherence_rgba(interp)
    else:  # pragma: no cover — guarded by callers
        raise ValueError(f"Unknown palette: {palette}")

    # Upsample to image resolution (PIL bilinear — heatmaps are smooth).
    heat_img = Image.fromarray(rgba_grid, mode="RGBA")
    if (grid_w, grid_h) != (img_w, img_h):
        heat_img = heat_img.resize((img_w, img_h), Image.BILINEAR)

    return heat_img


def _composite_heatmap_over_photo(
    photo: Image.Image,
    heatmap: Image.Image,
    alpha: float,
) -> Image.Image:
    """Alpha-blend ``heatmap`` over ``photo``. Returns RGBA PIL image."""
    if photo.mode != "RGBA":
        photo = photo.convert("RGBA")
    # Multiply the heatmap's alpha channel by the requested global alpha.
    arr = np.asarray(heatmap, dtype=np.uint8).copy()
    arr[..., 3] = (arr[..., 3].astype(np.float32) * alpha).astype(np.uint8)
    heatmap_scaled = Image.fromarray(arr, mode="RGBA")
    return Image.alpha_composite(photo, heatmap_scaled)


# ---------------------------------------------------------------------------
# Public renderer #1 — PR-37 — asymmetry heatmap
# ---------------------------------------------------------------------------

def render_asymmetry_heatmap(
    photo: Image.Image,
    lm: np.ndarray,
    *,
    alpha: float = DEFAULT_ALPHA,
) -> Image.Image:
    """Render a Marquardt-style mirror-asymmetry heatmap over ``photo``.

    For each (left_idx, right_idx) ∈ ``MIRROR_PAIRS_*``:

        delta_icu = || lm[left] - mirror(lm[right]) ||  /  intercanthal_distance

    where ``mirror(p) = (2 × x_axis − p.x, p.y)`` reflects ``p`` across the
    vertical inner-canthal midline. The sample is anchored at the **left-side**
    landmark position; the right-side landmark contributes its mirrored point
    as a separate sample (so paired regions get bilateral coverage).

    Color encoding: ``delta_icu / ASYMMETRY_SATURATION_ICU`` clipped to [0, 1]
    then mapped to the **positive half** of the coolwarm palette (0 → white,
    1 → deep red). Negative half is unused — asymmetry magnitude has no sign.

    Raises
    ------
    HeatmapSuppressedError
        If global sample count is below L2 threshold or convex-hull is
        degenerate (e.g. landmarks collapsed). Caller MUST emit a
        ``processing_note`` rather than rendering.
    """
    img_w, img_h = photo.size

    # Mirror axis = inner-canthal midline.
    x_axis = float((lm[P_LEFT_EYE_INNER][0] + lm[P_RIGHT_EYE_INNER][0]) / 2)
    icd_px = _intercanthal_distance(lm)
    if icd_px < 1.0:
        # Degenerate: faces with collapsed eye spacing produce nonsense.
        raise HeatmapSuppressedError("intercanthal_distance_degenerate", 0)

    pairs: list[tuple[int, int]] = (
        list(MIRROR_PAIRS_JAWLINE)
        + list(MIRROR_PAIRS_BROWS)
        + list(MIRROR_PAIRS_EYES)
    )

    sample_xy_list: list[tuple[float, float]] = []
    sample_val_list: list[float] = []

    for left_idx, right_idx in pairs:
        if left_idx >= lm.shape[0] or right_idx >= lm.shape[0]:
            continue
        p_l = lm[left_idx, :2]
        p_r = lm[right_idx, :2]
        # Mirror p_r across x_axis
        p_r_mirrored = np.array([2.0 * x_axis - p_r[0], p_r[1]])
        delta_px = float(np.linalg.norm(p_l - p_r_mirrored))
        delta_icu = delta_px / icd_px
        magnitude = min(delta_icu / ASYMMETRY_SATURATION_ICU, 1.0)
        # Sample at both anchors: gives the heatmap bilateral coverage.
        sample_xy_list.append((float(p_l[0]), float(p_l[1])))
        sample_val_list.append(magnitude)
        sample_xy_list.append((float(p_r[0]), float(p_r[1])))
        sample_val_list.append(magnitude)

    sample_xy = np.asarray(sample_xy_list, dtype=np.float64)
    sample_values = np.asarray(sample_val_list, dtype=np.float64)

    # Build heatmap (raises if below L2).
    heat = _build_heatmap_image(
        sample_xy, sample_values, img_w, img_h,
        palette="coolwarm", icd_full_px=icd_px,
    )

    # Mask outside face hull.
    hull_mask = _face_hull_mask(lm, img_w, img_h)
    heat_arr = np.asarray(heat, dtype=np.uint8).copy()
    heat_arr[..., 3] = np.where(hull_mask, heat_arr[..., 3], 0)
    heat_masked = Image.fromarray(heat_arr, mode="RGBA")

    return _composite_heatmap_over_photo(photo, heat_masked, alpha)


# ---------------------------------------------------------------------------
# Public renderer #2 — PR-38 — ideal-adherence heatmap
# ---------------------------------------------------------------------------

def render_ideal_adherence_heatmap(
    photo: Image.Image,
    lm: np.ndarray,
    region_samples: Iterable[RegionAdherenceSample],
    *,
    alpha: float = DEFAULT_ALPHA,
) -> Image.Image:
    """Render a per-region adherence heatmap.

    For each region with ``confidence ≥ 0.4`` (DEC-7 from PLAN_METRICS), we
    project the region's adherence scalar onto every landmark in
    ``_REGION_ANCHOR_LANDMARKS[region]``. Adherence is in [0, 1], higher is
    better; the colormap maps 0 → red, 1 → green (sequential, daltonic
    friendly enough since chroma differs).

    Regions below the confidence threshold are silently skipped (L3 degraded
    rendering — PLAN_M3_OVERLAYS §1.1). If ALL regions are skipped, raises
    HeatmapSuppressedError.
    """
    img_w, img_h = photo.size

    sample_xy_list: list[tuple[float, float]] = []
    sample_val_list: list[float] = []

    for sample in region_samples:
        if sample.confidence < 0.4:
            continue  # L3 degraded — skip this region's contribution
        anchors = _REGION_ANCHOR_LANDMARKS.get(sample.region)
        if anchors is None:
            continue
        for idx in anchors:
            if idx >= lm.shape[0]:
                continue
            sample_xy_list.append((float(lm[idx, 0]), float(lm[idx, 1])))
            sample_val_list.append(float(np.clip(sample.adherence, 0.0, 1.0)))

    sample_xy = np.asarray(sample_xy_list, dtype=np.float64)
    sample_values = np.asarray(sample_val_list, dtype=np.float64)

    icd_px = _intercanthal_distance(lm)
    if icd_px < 1.0:
        raise HeatmapSuppressedError("intercanthal_distance_degenerate", 0)

    heat = _build_heatmap_image(
        sample_xy, sample_values, img_w, img_h,
        palette="adherence", icd_full_px=icd_px,
    )

    # Mask outside face hull.
    hull_mask = _face_hull_mask(lm, img_w, img_h)
    heat_arr = np.asarray(heat, dtype=np.uint8).copy()
    heat_arr[..., 3] = np.where(hull_mask, heat_arr[..., 3], 0)
    heat_masked = Image.fromarray(heat_arr, mode="RGBA")

    return _composite_heatmap_over_photo(photo, heat_masked, alpha)
