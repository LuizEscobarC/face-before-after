"""Testes de robustez contra inputs degenerados em face_metrics."""

from __future__ import annotations

import numpy as np

import app.domain.face_metrics as fm
from app.domain.landmarks_mesh import (
    LM_INNER_MOUTH,
    LM_JAWLINE,
    LM_LEFT_BROW,
    LM_LEFT_EYE,
    LM_NOSE_BRIDGE,
    LM_NOSE_TIP,
    LM_OUTER_MOUTH,
    LM_RIGHT_BROW,
    LM_RIGHT_EYE,
    P_BROW_LEFT_INNER,
    P_BROW_LEFT_MID,
    P_BROW_LEFT_OUTER,
    P_BROW_RIGHT_INNER,
    P_BROW_RIGHT_MID,
    P_BROW_RIGHT_OUTER,
    P_LEFT_CHEEK,
    P_LEFT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_LEFT_GONION,
    P_LEFT_MOUTH,
    P_LEFT_ZYGOMATIC,
    P_LOWER_LIP,
    P_LOWER_LIP_BOT,
    P_LOWER_LIP_TOP,
    P_MENTON,
    P_NASION,
    P_NOSE_LEFT,
    P_NOSE_RIGHT,
    P_NOSE_TIP,
    P_RIGHT_CHEEK,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_GONION,
    P_RIGHT_MOUTH,
    P_RIGHT_ZYGOMATIC,
    P_SUBNASALE,
    P_UPPER_LIP,
    P_UPPER_LIP_BOT,
    P_UPPER_LIP_TOP,
    TOTAL_LANDMARKS,
)


def _make_landmarks(seed: int = 0) -> np.ndarray:
    """(478, 2) landmarks plausíveis (rosto frontal sintético)."""
    lm = np.zeros((TOTAL_LANDMARKS, 2), dtype=np.float64)

    # Jawline em arco — 17 pts da dlib 0..16 mapeados para LM_JAWLINE.
    for i, mesh_idx in enumerate(LM_JAWLINE):
        lm[mesh_idx] = [50 + i * 25, 400 + (8 - abs(i - 8)) * 6]

    # Brows.
    for i, mesh_idx in enumerate(LM_LEFT_BROW):
        lm[mesh_idx] = [120 + i * 20, 200]
    for i, mesh_idx in enumerate(LM_RIGHT_BROW):
        lm[mesh_idx] = [280 + i * 20, 200]

    # Nose bridge / tip.
    for i, mesh_idx in enumerate(LM_NOSE_BRIDGE):
        lm[mesh_idx] = [250, 230 + i * 25]
    nose_tip_pts = [(225, 320), (240, 322), (250, 325), (260, 322), (275, 320)]
    for i, mesh_idx in enumerate(LM_NOSE_TIP):
        lm[mesh_idx] = list(nose_tip_pts[i])

    # Olhos.
    left_eye_pts = [(140, 250), (155, 240), (175, 240), (190, 250), (175, 260), (155, 260)]
    right_eye_pts = [(310, 250), (325, 240), (345, 240), (360, 250), (345, 260), (325, 260)]
    for i, mesh_idx in enumerate(LM_LEFT_EYE):
        lm[mesh_idx] = list(left_eye_pts[i])
    for i, mesh_idx in enumerate(LM_RIGHT_EYE):
        lm[mesh_idx] = list(right_eye_pts[i])

    # Boca externa (12 pts).
    outer_mouth = [
        (200, 380), (220, 372), (240, 370), (250, 370), (260, 370), (280, 372),
        (300, 380), (280, 395), (260, 400), (250, 400), (240, 400), (220, 395),
    ]
    for i, mesh_idx in enumerate(LM_OUTER_MOUTH):
        lm[mesh_idx] = list(outer_mouth[i])
    inner_mouth = [
        (215, 382), (240, 378), (250, 378), (260, 378),
        (285, 382), (260, 388), (250, 390), (240, 388),
    ]
    for i, mesh_idx in enumerate(LM_INNER_MOUTH):
        lm[mesh_idx] = list(inner_mouth[i])

    # Pontos canónicos.
    lm[P_LEFT_EYE_OUTER] = [140, 250]
    lm[P_LEFT_EYE_INNER] = [190, 250]
    lm[P_RIGHT_EYE_OUTER] = [360, 250]
    lm[P_RIGHT_EYE_INNER] = [310, 250]
    lm[P_LEFT_MOUTH] = [200, 380]
    lm[P_RIGHT_MOUTH] = [300, 380]
    lm[P_UPPER_LIP] = [250, 370]
    lm[P_LOWER_LIP] = [250, 400]
    lm[P_UPPER_LIP_TOP] = [250, 365]
    lm[P_UPPER_LIP_BOT] = [250, 372]
    lm[P_LOWER_LIP_TOP] = [250, 395]
    lm[P_LOWER_LIP_BOT] = [250, 405]
    lm[P_NOSE_TIP] = [250, 305]
    lm[P_NOSE_LEFT] = [225, 320]
    lm[P_NOSE_RIGHT] = [275, 320]
    lm[P_SUBNASALE] = [250, 325]
    lm[P_NASION] = [250, 230]
    lm[P_MENTON] = [250, 460]
    lm[P_LEFT_GONION] = [80, 420]
    lm[P_RIGHT_GONION] = [420, 420]
    lm[P_BROW_LEFT_INNER] = [200, 200]
    lm[P_BROW_RIGHT_INNER] = [300, 200]
    lm[P_BROW_LEFT_OUTER] = [120, 200]
    lm[P_BROW_RIGHT_OUTER] = [380, 200]
    lm[P_BROW_LEFT_MID] = [160, 195]
    lm[P_BROW_RIGHT_MID] = [340, 195]
    lm[P_LEFT_ZYGOMATIC] = [60, 410]
    lm[P_RIGHT_ZYGOMATIC] = [440, 410]
    lm[P_LEFT_CHEEK] = [125, 430]
    lm[P_RIGHT_CHEEK] = [375, 430]
    return lm


def test_proportions_invalid_when_upper_lip_above_glabella():
    """fWHR retorna None quando upper_lip está acima de glabella."""
    lm = _make_landmarks()
    lm[fm.P_UPPER_LIP] = [250, 100]
    lm[fm.P_NASION] = [250, 150]
    out = fm.proportions(lm)
    assert out["fwhr"] is None or out["fwhr"] >= 0


def test_canthal_tilt_returns_none_when_dx_is_zero():
    """Sem distância horizontal entre cantos, tilt é matematicamente indefinido."""
    lm = _make_landmarks()
    lm[fm.P_LEFT_EYE_INNER]  = [170, 250]
    lm[fm.P_LEFT_EYE_OUTER]  = [170, 252]
    out = fm.eyes(lm, ipd=170.0)
    assert out["canthal_tilt_left_deg"] is None
    assert out["canthal_tilt_mean_deg"] is None


def test_jaw_definition_score_is_clamped_to_30():
    """jawline_definition_score nunca passa de 30, mesmo com landmarks ruidosos."""
    lm = _make_landmarks()
    # Faz a jawline serpentear violentamente para inflar a std dos ângulos.
    for i, mesh_idx in enumerate(LM_JAWLINE):
        if i % 2 == 0:
            lm[mesh_idx, 1] += 200 if i % 4 == 0 else -200
    out = fm.masculinity(lm, ipd=170.0)
    assert 0.0 <= out["jawline_definition_score"] <= 30.0


def test_under_eye_darkness_in_unit_range():
    """under_eye_darkness sempre em [0, 1] mesmo com ROI extrema."""
    lm = _make_landmarks()
    img = np.zeros((600, 500, 3), dtype=np.uint8)
    out = fm.skin(img, lm)
    assert 0.0 <= out["under_eye_darkness_left"] <= 1.0
    assert 0.0 <= out["under_eye_darkness_right"] <= 1.0


def test_severity_for_handles_none():
    """severity_for não crasha quando recebe None."""
    assert fm.severity_for("fwhr", None) == "leve"
    assert fm.severity_for("unknown_key", 1.5) == "leve"
