"""Tests for virtual_landmarks.extract_hairline_points.

Uses synthetic boolean masks to validate trichion position, confidence,
and fallback behaviour without needing a real image or model.
"""

from __future__ import annotations

import numpy as np
import pytest


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _make_synthetic_landmarks(img_w: int = 512, img_h: int = 512) -> np.ndarray:
    """Return a (478, 3) landmark array suitable for a face centred in the image.

    Inner canthi placed at eye-level (y = img_h * 0.4).
    Outer eye corners placed wider (ICD = img_w * 0.15).
    """
    from app.domain.landmarks_mesh import (
        P_LEFT_EYE_INNER,
        P_RIGHT_EYE_INNER,
        P_LEFT_EYE_OUTER,
        P_RIGHT_EYE_OUTER,
    )

    lm = np.zeros((478, 3), dtype=np.float64)
    eye_y = img_h * 0.4
    icd = img_w * 0.15
    cx = img_w / 2.0

    lm[P_LEFT_EYE_INNER]  = [cx - icd / 2, eye_y, 0]
    lm[P_RIGHT_EYE_INNER] = [cx + icd / 2, eye_y, 0]
    lm[P_LEFT_EYE_OUTER]  = [cx - icd * 1.5, eye_y, 0]
    lm[P_RIGHT_EYE_OUTER] = [cx + icd * 1.5, eye_y, 0]
    return lm


def _rect_hair_mask(h: int, w: int, top: int, bottom: int, left: int, right: int) -> np.ndarray:
    """Boolean mask with hair in a rectangle [top:bottom, left:right]."""
    mask = np.zeros((h, w), dtype=bool)
    mask[top:bottom, left:right] = True
    return mask


# --------------------------------------------------------------------------- #
# Tests
# --------------------------------------------------------------------------- #

class TestExtractHairlinePoints:

    def test_rect_mask_trichion_at_top(self):
        """Rectangular hair block above eyes → trichion y ≈ bottom of the block.

        Algorithm scans from eye level upward and finds the LARGEST y (lowest
        position) where hair is detected — i.e., the hairline is the BOTTOM edge
        of the hair region, not the top. This design avoids picking the top of
        spiky hair / hair buns, which would be above the anatomical hairline.
        """
        from app.services.landmarks.virtual_landmarks import extract_hairline_points

        H, W = 256, 256
        hair_top = 30
        hair_bottom = 100
        mask = _rect_hair_mask(H, W, top=hair_top, bottom=hair_bottom, left=60, right=196)
        lm = _make_synthetic_landmarks(W, H)

        result = extract_hairline_points(mask, lm)

        assert "trichion" in result
        trichion_y = result["trichion"][1]
        # Trichion is the BOTTOM edge of hair (highest y value), not the top
        assert abs(trichion_y - hair_bottom) < 5, (
            f"Expected trichion y ≈ {hair_bottom} (bottom of hair), got {trichion_y:.1f}"
        )

    def test_rect_mask_confidence_high(self):
        """Dense hair mask → confidence should be high (> 0.5)."""
        from app.services.landmarks.virtual_landmarks import extract_hairline_points

        H, W = 256, 256
        mask = _rect_hair_mask(H, W, top=20, bottom=80, left=40, right=216)
        lm = _make_synthetic_landmarks(W, H)

        result = extract_hairline_points(mask, lm)
        assert result["confidence"] > 0.5, f"confidence={result['confidence']:.2f}"

    def test_empty_mask_returns_zero_confidence(self):
        """Empty hair mask → confidence = 0 and fallback to lm[10]."""
        from app.services.landmarks.virtual_landmarks import extract_hairline_points

        H, W = 256, 256
        mask = np.zeros((H, W), dtype=bool)
        lm = _make_synthetic_landmarks(W, H)

        result = extract_hairline_points(mask, lm)
        assert result["confidence"] == 0.0

    def test_result_keys_present(self):
        """All expected keys are returned."""
        from app.services.landmarks.virtual_landmarks import extract_hairline_points

        H, W = 256, 256
        mask = _rect_hair_mask(H, W, 20, 80, 40, 216)
        lm = _make_synthetic_landmarks(W, H)
        result = extract_hairline_points(mask, lm)

        for key in (
            "trichion", "hairline_left", "hairline_center", "hairline_right",
            "forehead_top_estimate", "temple_left", "temple_right",
            "confidence", "column_y",
        ):
            assert key in result, f"Missing key: {key}"

    def test_trichion_is_xy_pair(self):
        """Trichion must be a 2-element list."""
        from app.services.landmarks.virtual_landmarks import extract_hairline_points

        H, W = 256, 256
        mask = _rect_hair_mask(H, W, 20, 80, 40, 216)
        lm = _make_synthetic_landmarks(W, H)
        result = extract_hairline_points(mask, lm)
        assert len(result["trichion"]) == 2

    def test_sparse_mask_low_confidence(self):
        """Very sparse mask (< 10% columns filled) → low/zero confidence."""
        from app.services.landmarks.virtual_landmarks import extract_hairline_points

        H, W = 256, 256
        mask = np.zeros((H, W), dtype=bool)
        # Only 3 columns with hair — very sparse
        mask[10, 100] = True
        mask[10, 102] = True
        mask[10, 104] = True
        lm = _make_synthetic_landmarks(W, H)
        result = extract_hairline_points(mask, lm)
        assert result["confidence"] < 0.5
