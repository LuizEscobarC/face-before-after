"""Testes mínimos para face_metrics.

Constrói um conjunto de 68 landmarks perfeitamente simétrico em torno de
x=0 e verifica que todos os indicadores de assimetria são ~0.
"""

from __future__ import annotations

import numpy as np
import pytest

import app.domain.face_metrics as fm


def _symmetric_landmarks() -> np.ndarray:
    """Gera 68 landmarks bilateralmente simétricos em torno de x=0.

    Não é anatomicamente perfeito — só garante simetria perfeita por par.
    """
    lm = np.zeros((68, 2), dtype=np.float64)

    # Mandíbula 0..16 (16 simétrico de 0)
    jaw_xs = [-100, -95, -88, -78, -65, -50, -32, -15, 0, 15, 32, 50, 65, 78, 88, 95, 100]
    jaw_ys = [  20,  60, 100, 135, 165, 195, 220, 240, 250, 240, 220, 195, 165, 135, 100, 60, 20]
    for i in range(17):
        lm[i] = [jaw_xs[i], jaw_ys[i]]

    # Sobrancelhas 17..21 (esq), 22..26 (dir)
    for k in range(5):
        x = -60 + k * 12     # -60,-48,-36,-24,-12
        y = -110 - (2 - abs(k - 2)) * 5
        lm[17 + k] = [x, y]
        lm[26 - k] = [-x, y]

    # Nariz: 27 (raiz) ate 30 (ponta) na linha media
    for k, y in enumerate([-90, -70, -50, -30]):
        lm[27 + k] = [0, y]
    # 31..35 base do nariz
    lm[31] = [-15, -20]; lm[35] = [15, -20]
    lm[32] = [-7,  -15]; lm[34] = [7, -15]
    lm[33] = [0, -10]

    # Olhos 36..41 (esq), 42..47 (dir)
    # esquerdo: outer(36)=(-50,-65), inner(39)=(-20,-65)
    lm[36] = [-50, -65]; lm[39] = [-20, -65]
    lm[37] = [-42, -70]; lm[38] = [-28, -70]
    lm[41] = [-42, -60]; lm[40] = [-28, -60]
    # direito: espelhado
    lm[45] = [ 50, -65]; lm[42] = [ 20, -65]
    lm[44] = [ 42, -70]; lm[43] = [ 28, -70]
    lm[46] = [ 42, -60]; lm[47] = [ 28, -60]

    # Boca 48..67
    lm[48] = [-30, 30]; lm[54] = [30, 30]
    lm[49] = [-15, 25]; lm[53] = [15, 25]
    lm[50] = [-5,  22]; lm[52] = [5,  22]
    lm[51] = [0, 20]
    lm[57] = [0, 45]
    lm[58] = [-5,  43]; lm[56] = [5, 43]
    lm[59] = [-15, 38]; lm[55] = [15, 38]
    lm[60] = [-25, 32]; lm[64] = [25, 32]
    lm[61] = [-10, 28]; lm[63] = [10, 28]
    lm[62] = [0, 27]
    lm[67] = [-10, 38]; lm[65] = [10, 38]
    lm[66] = [0, 40]

    # Trasladar para coords positivas
    lm[:, 0] += 250
    lm[:, 1] += 200
    return lm


def test_marquardt_zero_for_symmetric_face():
    lm = _symmetric_landmarks()
    ipd = fm._ipd(lm)
    assert ipd > 0
    out = fm.marquardt_deviation(lm, ipd)
    assert out["marquardt_deviation_pct_ipd"] < 0.5, out


def test_eye_canthal_tilt_pair_symmetric():
    """Em rosto simétrico, tilt esq/dir devem ter mesmo módulo."""
    lm = _symmetric_landmarks()
    ipd = fm._ipd(lm)
    e = fm.eyes(lm, ipd)
    assert abs(e["canthal_tilt_left_deg"] - e["canthal_tilt_right_deg"]) < 0.1, e
    # EAR esq/dir devem ser quase iguais
    assert abs(e["eye_aspect_ratio_left"] - e["eye_aspect_ratio_right"]) < 1e-6


def test_proportions_runs_without_error():
    lm = _symmetric_landmarks()
    p = fm.proportions(lm)
    # As 3 razões devem somar ~1
    s = p["thirds_upper_ratio"] + p["thirds_middle_ratio"] + p["thirds_lower_ratio"]
    assert abs(s - 1.0) < 1e-6


def test_compute_all_returns_three_blocks():
    lm = _symmetric_landmarks()
    img = np.full((400, 500, 3), 128, dtype=np.uint8)  # imagem cinza neutra
    out = fm.compute_all(img, lm, face_rect_w=300)
    for k in ("advanced", "photo_quality", "skin"):
        assert k in out, f"missing block: {k}"
    # Não deve quebrar com landmarks degenerados na frontalidade
    assert isinstance(out["photo_quality"]["frontal_ok"], bool)


def test_severity_for_known_keys():
    # fwhr ideal 1.85 ± 0.10 -> 1.85 deve dar excelente, 2.5 deve dar severa
    assert fm.severity_for("fwhr", 1.85) == "excelente"
    assert fm.severity_for("fwhr", 2.5)  in ("acentuada", "severa")
