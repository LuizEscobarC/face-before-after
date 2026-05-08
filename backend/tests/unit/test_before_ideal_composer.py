"""Tests for app.vision.services.before_ideal_composer (PR-41, M3.4).

Coverage targets per PLAN_M3_OVERLAYS §2 PR-41 + DEC-15/DEC-26:

- Output canvas dimensions: width = 2*W + gutter, height = H, mode RGBA.
- Left pane is byte-identical to the input photo (no warp promise).
- Empty offsets list → ideal silhouette overlays actual silhouette
  (idempotent baseline; cyan dashes overlap gray solid lines).
- Single offset shifts the relevant landmark in the ideal wireframe only;
  actual wireframe untouched.
- Magnitude cap: |dx_icu| > 0.3 is clipped to ±0.3.
- Degenerate ICD raises BeforeIdealComposeError with the documented reason.
- Insufficient landmark count raises BeforeIdealComposeError.
- Out-of-range landmark_index in offset raises BeforeIdealComposeError.
- show_actual_wireframe=False removes gray pixels from the right pane.
- show_guide_lines=True renders the cyan vertical midline on the right pane.
"""
from __future__ import annotations

import numpy as np
import pytest
from PIL import Image

from app.vision.services.before_ideal_composer import (
    DEFAULT_GUTTER_PX,
    IDEAL_STROKE_RGB,
    MIN_LANDMARKS,
    OFFSET_MAGNITUDE_CAP_ICU,
    BeforeIdealComposeError,
    IdealLandmarkOffset,
    compose_before_ideal,
)
from tests.fixtures.synthetic_landmarks import perfect_frontal


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_W, _H = 800, 600


def _photo() -> Image.Image:
    """Plain dark photo at the canonical size used by perfect_frontal()."""
    return Image.new("RGB", (_W, _H), (16, 16, 24))


def _rgba(img: Image.Image) -> np.ndarray:
    return np.asarray(img.convert("RGBA"))


def _has_color(arr: np.ndarray, rgb: tuple[int, int, int], *, tol: int = 4) -> bool:
    """Return True if any pixel in ``arr`` matches ``rgb`` within ``tol``."""
    r, g, b = rgb
    diff = (
        np.abs(arr[..., 0].astype(int) - r)
        + np.abs(arr[..., 1].astype(int) - g)
        + np.abs(arr[..., 2].astype(int) - b)
    )
    return bool((diff <= 3 * tol).any())


# ---------------------------------------------------------------------------
# 1. Canvas dimensions + left pane is byte-identical
# ---------------------------------------------------------------------------


def test_output_dimensions_and_mode() -> None:
    out = compose_before_ideal(_photo(), perfect_frontal())
    assert out.mode == "RGBA"
    assert out.size == (2 * _W + DEFAULT_GUTTER_PX, _H)


def test_left_pane_byte_identical_to_input_photo() -> None:
    src = _photo()
    out = compose_before_ideal(src, perfect_frontal())
    left = _rgba(out)[:, :_W, :3]
    src_arr = np.asarray(src.convert("RGBA"))[..., :3]
    assert np.array_equal(left, src_arr), (
        "Left pane must be the original photo unchanged (no warp promise)."
    )


# ---------------------------------------------------------------------------
# 2. Empty offsets vs single offset
# ---------------------------------------------------------------------------


def test_empty_offsets_renders_cyan_on_right_pane() -> None:
    out = compose_before_ideal(_photo(), perfect_frontal(), offsets=[])
    right = _rgba(out)[:, _W + DEFAULT_GUTTER_PX:, :3]
    # Cyan pixels must be present (the ideal wireframe is drawn even with no
    # offsets — same as actual but in cyan dashed).
    assert _has_color(right, IDEAL_STROKE_RGB), (
        "Right pane must contain cyan ideal-wireframe pixels even with empty offsets."
    )


def test_single_offset_shifts_only_ideal_wireframe() -> None:
    """Apply a large dy_icu offset to a wireframe landmark and check pixels move."""
    lm = perfect_frontal()
    base_out = compose_before_ideal(_photo(), lm, offsets=[])
    shifted_out = compose_before_ideal(
        _photo(),
        lm,
        offsets=[IdealLandmarkOffset(
            landmark_index=33,  # LM_LEFT_EYE[0] — outer left eye corner (in wireframe)
            dx_icu=0.0,
            dy_icu=0.25,
            metric_id="eye_height_asymmetry",
        )],
    )
    base_arr = _rgba(base_out)
    shifted_arr = _rgba(shifted_out)
    # Left panes must be identical (offset only affects the right pane).
    assert np.array_equal(base_arr[:, :_W, :], shifted_arr[:, :_W, :]), (
        "Offset must not affect the left (actual) pane."
    )
    # Right panes must differ — the ideal cyan moved.
    right_base = base_arr[:, _W + DEFAULT_GUTTER_PX:, :3]
    right_shifted = shifted_arr[:, _W + DEFAULT_GUTTER_PX:, :3]
    assert not np.array_equal(right_base, right_shifted), (
        "Right pane must change when an offset is applied to the ideal wireframe."
    )


# ---------------------------------------------------------------------------
# 3. Magnitude cap
# ---------------------------------------------------------------------------


def test_offset_magnitude_cap() -> None:
    """|dy_icu| > cap is clipped — output equals output at the cap."""
    lm = perfect_frontal()
    capped = compose_before_ideal(
        _photo(), lm,
        offsets=[IdealLandmarkOffset(33, 0.0, OFFSET_MAGNITUDE_CAP_ICU, "test")],
    )
    over_cap = compose_before_ideal(
        _photo(), lm,
        offsets=[IdealLandmarkOffset(33, 0.0, 99.0, "test")],
    )
    assert np.array_equal(_rgba(capped), _rgba(over_cap)), (
        "Offsets above the magnitude cap must be clipped."
    )


# ---------------------------------------------------------------------------
# 4. Error conditions
# ---------------------------------------------------------------------------


def test_degenerate_icd_raises() -> None:
    lm = perfect_frontal()
    lm[133] = lm[362]   # collapse inner canthi → ICD = 0
    with pytest.raises(BeforeIdealComposeError) as exc_info:
        compose_before_ideal(_photo(), lm)
    assert exc_info.value.reason == "intercanthal_distance_degenerate"


def test_insufficient_landmarks_raises() -> None:
    lm = perfect_frontal()[:100, :]   # only 100 points
    with pytest.raises(BeforeIdealComposeError) as exc_info:
        compose_before_ideal(_photo(), lm)
    assert exc_info.value.reason == "insufficient_landmarks"


def test_invalid_landmark_index_in_offset_raises() -> None:
    lm = perfect_frontal()
    with pytest.raises(BeforeIdealComposeError) as exc_info:
        compose_before_ideal(
            _photo(), lm,
            offsets=[IdealLandmarkOffset(MIN_LANDMARKS + 5, 0.1, 0.0, "bad")],
        )
    assert exc_info.value.reason == "invalid_landmark_index"


# ---------------------------------------------------------------------------
# 5. Toggles
# ---------------------------------------------------------------------------


def test_show_actual_wireframe_false_drops_gray_layer() -> None:
    """Without the actual wireframe, the right pane must differ (gray pixels gone)."""
    lm = perfect_frontal()
    with_gray = compose_before_ideal(_photo(), lm, show_actual_wireframe=True)
    without_gray = compose_before_ideal(_photo(), lm, show_actual_wireframe=False)
    right_with = _rgba(with_gray)[:, _W + DEFAULT_GUTTER_PX:, :3]
    right_without = _rgba(without_gray)[:, _W + DEFAULT_GUTTER_PX:, :3]
    # The two right panes must differ (gray actual-wireframe pixels added).
    assert not np.array_equal(right_with, right_without), (
        "show_actual_wireframe=True must add visible gray pixels to the right pane."
    )
    # The without version should still contain cyan ideal pixels.
    assert _has_color(right_without, IDEAL_STROKE_RGB)


def test_show_guide_lines_true_draws_cyan_midline() -> None:
    """When guide lines are on, the right pane must contain cyan column at midline."""
    lm = perfect_frontal()
    with_guides = compose_before_ideal(
        _photo(), lm, show_actual_wireframe=False, show_guide_lines=True,
    )
    no_guides = compose_before_ideal(
        _photo(), lm, show_actual_wireframe=False, show_guide_lines=False,
    )
    # The midline column in right pane should differ between the two outputs
    # (guide lines paint extra cyan pixels on it).
    right_off_x = _W + DEFAULT_GUTTER_PX
    midline_x = right_off_x + int(round((lm[133, 0] + lm[362, 0]) / 2))
    col_with = _rgba(with_guides)[:, midline_x, :3]
    col_no = _rgba(no_guides)[:, midline_x, :3]
    assert not np.array_equal(col_with, col_no), (
        "Guide-line midline must change pixel values along that column."
    )
