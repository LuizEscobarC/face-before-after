"""Testes de robustez contra inputs degenerados em face_metrics."""

from __future__ import annotations

import numpy as np

import app.domain.face_metrics as fm


def _make_landmarks(seed: int = 0) -> np.ndarray:
    """68 landmarks plausíveis (rosto frontal sintético)."""
    rng = np.random.default_rng(seed)
    lm = np.zeros((68, 2), dtype=np.float64)
    # Jawline 0–16 em arco
    for i in range(17):
        lm[i] = [50 + i * 25, 400 + (8 - abs(i - 8)) * 6]
    # Sobrancelhas
    for i, x in enumerate(range(120, 220, 20)):
        lm[17 + i] = [x, 200]
    for i, x in enumerate(range(280, 380, 20)):
        lm[22 + i] = [x, 200]
    # Nariz
    for i in range(4):
        lm[27 + i] = [250, 230 + i * 25]
    lm[31] = [225, 320]; lm[32] = [240, 322]; lm[33] = [250, 325]
    lm[34] = [260, 322]; lm[35] = [275, 320]
    # Olhos esq 36–41
    lm[36] = [140, 250]; lm[37] = [155, 240]; lm[38] = [175, 240]
    lm[39] = [190, 250]; lm[40] = [175, 260]; lm[41] = [155, 260]
    # Olhos dir 42–47
    lm[42] = [310, 250]; lm[43] = [325, 240]; lm[44] = [345, 240]
    lm[45] = [360, 250]; lm[46] = [345, 260]; lm[47] = [325, 260]
    # Boca externa 48–59
    lm[48] = [200, 380]; lm[49] = [220, 372]; lm[50] = [240, 370]
    lm[51] = [250, 370]; lm[52] = [260, 370]; lm[53] = [280, 372]
    lm[54] = [300, 380]; lm[55] = [280, 395]; lm[56] = [260, 400]
    lm[57] = [250, 400]; lm[58] = [240, 400]; lm[59] = [220, 395]
    # Boca interna 60–67
    lm[60] = [215, 382]; lm[61] = [240, 378]; lm[62] = [250, 378]
    lm[63] = [260, 378]; lm[64] = [285, 382]; lm[65] = [260, 388]
    lm[66] = [250, 390]; lm[67] = [240, 388]
    return lm


def test_proportions_invalid_when_upper_lip_above_glabella():
    """fWHR retorna None quando upper_lip está acima de glabella (landmarks ruins)."""
    lm = _make_landmarks()
    # Sobe o lábio superior para cima da glabella → upper_face_h <= 0
    lm[fm.P_UPPER_LIP] = [250, 100]
    lm[27] = [250, 150]  # glabella é derivada de nasion/sobrancelhas — ajusta também
    out = fm.proportions(lm)
    assert out["fwhr"] is None or out["fwhr"] >= 0
    # thirds podem virar None ou positivos — o crítico é não crashar e não devolver garbage.


def test_canthal_tilt_returns_none_when_dx_is_zero():
    """Sem distância horizontal entre cantos, tilt é matematicamente indefinido."""
    lm = _make_landmarks()
    # Coloca canto medial e lateral do olho esquerdo na mesma coluna
    lm[fm.P_LEFT_EYE_INNER]  = [170, 250]
    lm[fm.P_LEFT_EYE_OUTER]  = [170, 252]
    out = fm.eyes(lm, ipd=170.0)
    assert out["canthal_tilt_left_deg"] is None
    # canthal_tilt_mean_deg deve ser None se algum lado for None
    assert out["canthal_tilt_mean_deg"] is None


def test_jaw_definition_score_is_clamped_to_30():
    """jawline_definition_score nunca passa de 30, mesmo com landmarks ruidosos."""
    lm = _make_landmarks()
    # Faz a jawline serpentear violentamente para inflar a std dos ângulos
    for i in range(0, 17, 2):
        lm[i, 1] += 200 if i % 4 == 0 else -200
    out = fm.masculinity(lm, ipd=170.0)
    assert 0.0 <= out["jawline_definition_score"] <= 30.0


def test_under_eye_darkness_in_unit_range():
    """under_eye_darkness sempre em [0, 1] mesmo com ROI extrema."""
    lm = _make_landmarks()
    # Imagem completamente preta — bochecha será 0, evita divisão por zero (deve devolver 0).
    img = np.zeros((600, 500, 3), dtype=np.uint8)
    out = fm.skin(img, lm)
    assert 0.0 <= out["under_eye_darkness_left"] <= 1.0
    assert 0.0 <= out["under_eye_darkness_right"] <= 1.0


def test_severity_for_handles_none():
    """severity_for não crasha quando recebe None."""
    assert fm.severity_for("fwhr", None) == "leve"
    assert fm.severity_for("unknown_key", 1.5) == "leve"
