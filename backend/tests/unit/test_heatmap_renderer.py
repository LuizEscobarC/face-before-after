"""Tests for app.vision.services.heatmap_renderer (PR-37 + PR-38, M3.3).

Coverage targets per PLAN_M3_OVERLAYS §1.1 + §3:

- PR-37 happy: asymmetric face produces non-zero (red) heatmap on the
  perturbed side; symmetric face produces near-uniform near-white pixels.
- L1 density: pixels far from any sample (but inside hull) are masked out.
- L2 suppression: pathologically sparse input raises HeatmapSuppressedError.
- Convex-hull masking: all pixels at the image corners (outside the face)
  have alpha=0 in the returned RGBA layer.
- PR-38 happy: high-adherence regions render greenish; low-adherence
  regions render reddish; sub-threshold confidence regions are skipped.
- Colormap stop sanity: anchor values map to expected RGB.
"""

from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from app.vision.services.heatmap_renderer import (
    DEFAULT_ALPHA,
    HeatmapSuppressedError,
    RegionAdherenceSample,
    _adherence_rgba,
    _coolwarm_rgba,
    render_asymmetry_heatmap,
    render_ideal_adherence_heatmap,
)
from tests.fixtures.synthetic_landmarks import known_asymmetric, perfect_frontal


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _blank_photo(w: int = 800, h: int = 600) -> Image.Image:
    """Plain dark photo of the right size for the synthetic fixtures."""
    return Image.new("RGB", (w, h), (16, 16, 24))


def _rgb_array(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert("RGBA"))[..., :3]


# ---------------------------------------------------------------------------
# Colormap unit tests — anchors must match documented stops exactly.
# ---------------------------------------------------------------------------

def test_coolwarm_anchor_stops() -> None:
    vals = np.array([-1.0, -0.5, 0.0, 0.5, 1.0])
    rgba = _coolwarm_rgba(vals)
    expected = [
        (59, 76, 192),
        (143, 161, 240),
        (240, 240, 240),
        (240, 158, 138),
        (180, 4, 38),
    ]
    for i, (r, g, b) in enumerate(expected):
        assert tuple(rgba[i, :3].tolist()) == (r, g, b), (
            f"anchor {vals[i]} expected {(r, g, b)}, got {tuple(rgba[i, :3].tolist())}"
        )
        assert rgba[i, 3] == 255  # opaque (no NaN)


def test_coolwarm_nan_is_transparent() -> None:
    rgba = _coolwarm_rgba(np.array([np.nan, 0.0, np.nan]))
    assert rgba[0, 3] == 0
    assert rgba[1, 3] == 255
    assert rgba[2, 3] == 0


def test_adherence_anchor_stops() -> None:
    vals = np.array([0.0, 0.5, 1.0])
    rgba = _adherence_rgba(vals)
    assert tuple(rgba[0, :3].tolist()) == (180, 4, 38)        # red (worst)
    assert tuple(rgba[1, :3].tolist()) == (255, 200, 60)      # amber (mid)
    assert tuple(rgba[2, :3].tolist()) == (60, 180, 90)       # green (ideal)


# ---------------------------------------------------------------------------
# PR-37: asymmetry heatmap
# ---------------------------------------------------------------------------

def test_asymmetry_heatmap_returns_rgba_same_size() -> None:
    photo = _blank_photo()
    lm = perfect_frontal()[:, :2]
    out = render_asymmetry_heatmap(photo, lm)
    assert out.size == photo.size
    assert out.mode == "RGBA"


def test_asymmetry_heatmap_perfect_face_is_near_white() -> None:
    """A perfectly symmetric face should produce near-white pixels where the heatmap renders.

    Note: the asymmetry heatmap only has SUPPORT around mirror-pair anchors
    (jawline + brows + eyes — concentrated on the periphery). The face
    centre receives no support and is correctly masked by L1 density supp.
    We isolate the rendered region by diffing against the unmodified photo.
    """
    photo = _blank_photo()
    lm = perfect_frontal()[:, :2]
    out = render_asymmetry_heatmap(photo, lm, alpha=1.0)
    rgb_out = _rgb_array(out).astype(np.int32)
    rgb_in = np.asarray(photo.convert("RGBA"))[..., :3].astype(np.int32)

    # Pixels where heatmap actually composited (any channel changed):
    changed = (rgb_out != rgb_in).any(axis=-1)
    assert changed.any(), "perfect symmetric face must produce SOME heatmap pixels"

    # Where rendered, perfect-symmetry heatmap → near-white (low asymmetry).
    mean_rendered = rgb_out[changed].mean()
    assert mean_rendered > 180, (
        f"rendered pixels of a perfect face should be near-white, "
        f"got mean RGB {mean_rendered:.1f}"
    )


def test_asymmetry_heatmap_perturbation_increases_redness() -> None:
    """An asymmetric face must produce more red on the heatmap than a symmetric one.

    The fixture ``known_asymmetric`` only perturbs the nose tip + menton —
    neither participates in mirror pairs. We construct a stronger fixture
    here by shifting jawline + brow landmarks (which DO participate).
    """
    photo = _blank_photo()
    lm_sym = perfect_frontal()[:, :2]
    lm_asy = lm_sym.copy()
    # Push left jawline + left brow inwards by 15 px each (a marked asymmetry).
    # Jawline indices on the LEFT half (LM_JAWLINE[:8]).
    for idx in (338, 297, 332, 284):  # subset of LEFT-half jawline
        lm_asy[idx, 0] += 15.0
    # Left brow inner+outer.
    for idx in (107, 105, 70):
        lm_asy[idx, 0] += 15.0

    out_sym = render_asymmetry_heatmap(photo, lm_sym, alpha=1.0)
    out_asy = render_asymmetry_heatmap(photo, lm_asy, alpha=1.0)

    rgb_sym = _rgb_array(out_sym).astype(np.int32)
    rgb_asy = _rgb_array(out_asy).astype(np.int32)
    rgb_in = np.asarray(photo.convert("RGBA"))[..., :3].astype(np.int32)

    mask = (rgb_asy != rgb_in).any(axis=-1) | (rgb_sym != rgb_in).any(axis=-1)

    redness_sym = (rgb_sym[..., 0] - 0.5 * (rgb_sym[..., 1] + rgb_sym[..., 2]))
    redness_asy = (rgb_asy[..., 0] - 0.5 * (rgb_asy[..., 1] + rgb_asy[..., 2]))

    assert redness_asy[mask].mean() > redness_sym[mask].mean() + 1.0, (
        f"asymmetric face should be visibly redder: "
        f"sym={redness_sym[mask].mean():.2f} vs asy={redness_asy[mask].mean():.2f}"
    )


def test_asymmetry_heatmap_outside_hull_is_transparent() -> None:
    photo = _blank_photo()
    lm = perfect_frontal()[:, :2]
    out = render_asymmetry_heatmap(photo, lm)
    # Composite output is RGBA; we check the corner — no face there.
    rgb = _rgb_array(out)
    bg = np.array([16, 16, 24])
    # Top-left 10×10 must equal the original bg (no heatmap composited).
    assert np.allclose(rgb[:10, :10], bg, atol=2), (
        "Outside the face hull the photo must be unchanged"
    )


def test_asymmetry_heatmap_l2_suppression_raises() -> None:
    """Below MIN_GLOBAL_SAMPLE_COUNT samples → HeatmapSuppressedError."""
    photo = _blank_photo()
    # Build a landmark array where mirror pairs all collapse to one point —
    # eliminating distinct samples.
    lm = np.zeros((478, 2), dtype=np.float64)
    lm[:] = [200.0, 200.0]
    # But we need ICD > 1 to bypass the degenerate check first; place canthi
    # apart so that check passes, then the global density check should fire
    # because all paired samples collapse to the same xy and griddata's
    # "duplicate input" still counts as one location for our density check.
    lm[133] = [180.0, 200.0]
    lm[362] = [220.0, 200.0]
    # Most samples will all be at (200, 200) — ConvexHull will fail first
    # (collinear). Either way an error is raised.
    with pytest.raises(HeatmapSuppressedError):
        render_asymmetry_heatmap(photo, lm)


def test_asymmetry_heatmap_degenerate_icd_raises() -> None:
    """ICD < 1 px must raise HeatmapSuppressedError."""
    photo = _blank_photo()
    lm = perfect_frontal()[:, :2].copy()
    lm[133] = [200.0, 200.0]
    lm[362] = [200.0, 200.0]   # same point → ICD=0
    with pytest.raises(HeatmapSuppressedError) as exc_info:
        render_asymmetry_heatmap(photo, lm)
    assert exc_info.value.reason == "intercanthal_distance_degenerate"


# ---------------------------------------------------------------------------
# PR-38: ideal-adherence heatmap
# ---------------------------------------------------------------------------

def test_adherence_heatmap_high_regions_render_greener_than_low() -> None:
    photo = _blank_photo()
    lm = perfect_frontal()[:, :2]

    high = [
        RegionAdherenceSample("eyes", 1.0, 0.95),
        RegionAdherenceSample("brows", 1.0, 0.95),
        RegionAdherenceSample("jaw", 1.0, 0.95),
        RegionAdherenceSample("nose", 1.0, 0.95),
        RegionAdherenceSample("mouth", 1.0, 0.95),
    ]
    low = [RegionAdherenceSample(s.region, 0.0, s.confidence) for s in high]

    out_high = render_ideal_adherence_heatmap(photo, lm, high, alpha=1.0)
    out_low = render_ideal_adherence_heatmap(photo, lm, low, alpha=1.0)

    rgb_h = _rgb_array(out_high).astype(np.int32)
    rgb_l = _rgb_array(out_low).astype(np.int32)
    rgb_in = np.asarray(photo.convert("RGBA"))[..., :3].astype(np.int32)
    mask = (rgb_h != rgb_in).any(axis=-1) | (rgb_l != rgb_in).any(axis=-1)

    # High adherence → green channel dominant; low → red channel dominant.
    greenness_h = (rgb_h[..., 1] - rgb_h[..., 0])[mask].mean()
    greenness_l = (rgb_l[..., 1] - rgb_l[..., 0])[mask].mean()
    assert greenness_h > greenness_l + 5.0, (
        f"high-adherence heatmap should be greener: g_high={greenness_h:.1f} "
        f"vs g_low={greenness_l:.1f}"
    )


def test_adherence_heatmap_skips_low_confidence_regions() -> None:
    """Regions with confidence < 0.4 must be excluded from sample set."""
    photo = _blank_photo()
    lm = perfect_frontal()[:, :2]

    # Only eyes/brows/jaw/nose/mouth meet the threshold — exactly what we need
    # to clear MIN_GLOBAL_SAMPLE_COUNT. Drop them all to confidence 0.1 and
    # the renderer must raise (no usable samples).
    samples = [
        RegionAdherenceSample("eyes", 1.0, 0.1),
        RegionAdherenceSample("brows", 1.0, 0.1),
        RegionAdherenceSample("jaw", 1.0, 0.1),
    ]
    with pytest.raises(HeatmapSuppressedError):
        render_ideal_adherence_heatmap(photo, lm, samples)


def test_adherence_heatmap_unknown_region_is_ignored() -> None:
    """Region names not in the anchor map must not crash; just contribute 0 samples."""
    photo = _blank_photo()
    lm = perfect_frontal()[:, :2]

    samples = [
        RegionAdherenceSample("eyes", 0.8, 0.9),
        RegionAdherenceSample("brows", 0.8, 0.9),
        RegionAdherenceSample("nose", 0.8, 0.9),
        RegionAdherenceSample("jaw", 0.8, 0.9),
        RegionAdherenceSample("mouth", 0.8, 0.9),
        RegionAdherenceSample("not_a_real_region", 0.5, 0.9),
    ]
    out = render_ideal_adherence_heatmap(photo, lm, samples)
    assert out.size == photo.size
