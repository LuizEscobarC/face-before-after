"""Sanity tests for landmarks_mesh — cardinality, range, no overlap."""
from __future__ import annotations

from app.domain import landmarks_mesh as lm


def test_total_landmarks_constant():
    assert lm.TOTAL_LANDMARKS == 478


def test_region_cardinalities():
    assert len(lm.LM_LEFT_EYE) == 6
    assert len(lm.LM_RIGHT_EYE) == 6
    assert len(lm.LM_LEFT_BROW) == 5
    assert len(lm.LM_RIGHT_BROW) == 5
    assert len(lm.LM_NOSE_BRIDGE) == 4
    assert len(lm.LM_NOSE_TIP) == 5
    assert len(lm.LM_OUTER_MOUTH) == 12
    assert len(lm.LM_INNER_MOUTH) == 8
    # Must have at least 12 entries so quality_evaluator's LM_JAWLINE[5:12] works.
    assert len(lm.LM_JAWLINE) >= 12
    assert len(lm.LM_JAWLINE) == 17  # dlib 0–16 mapping
    assert len(lm.LM_LEFT_IRIS) == 5
    assert len(lm.LM_RIGHT_IRIS) == 5


def test_indices_in_valid_range():
    all_indices = (
        lm.LM_LEFT_EYE + lm.LM_RIGHT_EYE
        + lm.LM_LEFT_BROW + lm.LM_RIGHT_BROW
        + lm.LM_NOSE_BRIDGE + lm.LM_NOSE_TIP
        + lm.LM_OUTER_MOUTH + lm.LM_INNER_MOUTH
        + lm.LM_JAWLINE
        + lm.LM_LEFT_IRIS + lm.LM_RIGHT_IRIS
    )
    for idx in all_indices:
        assert 0 <= idx < lm.TOTAL_LANDMARKS, f"index {idx} out of range"


def test_distinct_regions_no_overlap():
    # Eyes vs brows vs mouth-outer vs jawline should be disjoint.
    regions = {
        "left_eye": set(lm.LM_LEFT_EYE),
        "right_eye": set(lm.LM_RIGHT_EYE),
        "left_brow": set(lm.LM_LEFT_BROW),
        "right_brow": set(lm.LM_RIGHT_BROW),
        "outer_mouth": set(lm.LM_OUTER_MOUTH),
        "jawline": set(lm.LM_JAWLINE),
        "left_iris": set(lm.LM_LEFT_IRIS),
        "right_iris": set(lm.LM_RIGHT_IRIS),
    }
    keys = list(regions.keys())
    for i, a in enumerate(keys):
        for b in keys[i + 1:]:
            overlap = regions[a] & regions[b]
            assert not overlap, f"overlap between {a} and {b}: {overlap}"


def test_pnp_indices_cardinality():
    assert len(lm.PNP_LANDMARK_INDICES) == 6
    for idx in lm.PNP_LANDMARK_INDICES:
        assert 0 <= idx < lm.TOTAL_LANDMARKS


def test_point_constants_in_range():
    point_consts = [
        lm.P_NOSE_TIP, lm.P_MENTON, lm.P_LEFT_EYE_OUTER, lm.P_RIGHT_EYE_OUTER,
        lm.P_LEFT_EYE_INNER, lm.P_RIGHT_EYE_INNER, lm.P_LEFT_MOUTH, lm.P_RIGHT_MOUTH,
        lm.P_UPPER_LIP, lm.P_LOWER_LIP, lm.P_LEFT_GONION, lm.P_RIGHT_GONION,
        lm.P_SUBNASALE, lm.P_BROW_LEFT_INNER, lm.P_BROW_RIGHT_INNER,
        lm.P_NOSE_LEFT, lm.P_NOSE_RIGHT,
        lm.P_UPPER_LIP_TOP, lm.P_UPPER_LIP_BOT, lm.P_LOWER_LIP_TOP, lm.P_LOWER_LIP_BOT,
        lm.P_NASION,
    ]
    for p in point_consts:
        assert 0 <= p < lm.TOTAL_LANDMARKS
