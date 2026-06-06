"""Testes mínimos para face_metrics.

Constrói landmarks (478, 2) bilateralmente simétricos em torno de x=0
nas posições anatomicamente relevantes (Mesh-478) e verifica que todos os
indicadores de assimetria são ~0.
"""

from __future__ import annotations

import numpy as np
import pytest

import app.domain.face_metrics as fm
from app.domain.landmarks_mesh import (
    FACE_OVAL_MIRROR_PAIRS,
    LM_JAWLINE,
    LM_LEFT_BROW,
    LM_LEFT_EYE,
    LM_NOSE_BRIDGE,
    LM_NOSE_TIP,
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


def _symmetric_landmarks() -> np.ndarray:
    """Gera (478, 2) landmarks bilateralmente simétricos.

    Apenas posições anatomicamente referenciadas pelos cálculos recebem
    valores; as demais permanecem em (0, 0). Como face_metrics só lê pontos
    nomeados (constantes do landmarks_mesh) isso é suficiente para validar
    simetria.
    """
    lm = np.zeros((TOTAL_LANDMARKS, 2), dtype=np.float64)

    # Jawline (17 pontos, simétrico em torno do menton, índice 8 do array).
    jaw_xs = [-100, -95, -88, -78, -65, -50, -32, -15, 0, 15, 32, 50, 65, 78, 88, 95, 100]
    jaw_ys = [  20,  60, 100, 135, 165, 195, 220, 240, 250, 240, 220, 195, 165, 135, 100, 60, 20]
    for k, mesh_idx in enumerate(LM_JAWLINE):
        lm[mesh_idx] = [jaw_xs[k], jaw_ys[k]]

    # Sobrancelhas (5 pts cada, esquerda outer→inner, direita inner→outer).
    for k in range(5):
        x = -60 + k * 12
        y = -110 - (2 - abs(k - 2)) * 5
        lm[LM_LEFT_BROW[k]] = [x, y]
        # Espelha simetricamente: índice k da esquerda ↔ índice (4-k) da direita.
        lm[LM_RIGHT_BROW[4 - k]] = [-x, y]

    # Nose bridge (4 pts) e nose tip (5 pts) na linha média.
    bridge_ys = [-90, -70, -50, -30]
    for k, mesh_idx in enumerate(LM_NOSE_BRIDGE):
        lm[mesh_idx] = [0, bridge_ys[k]]
    # Nose tip / asas (mapeamento dlib 31..35 → LM_NOSE_TIP[0..4]).
    nose_tip_pts = [(-15, -20), (-7, -15), (0, -10), (7, -15), (15, -20)]
    for k, mesh_idx in enumerate(LM_NOSE_TIP):
        lm[mesh_idx] = list(nose_tip_pts[k])

    # Olhos (esq outer..inner por baixo, dir outer..inner por baixo —
    # mesma ordem dos LM_LEFT_EYE/LM_RIGHT_EYE em landmarks_mesh).
    left_eye_pts =  [(-50, -65), (-42, -70), (-28, -70), (-20, -65), (-28, -60), (-42, -60)]
    right_eye_pts = [( 50, -65), ( 42, -70), ( 28, -70), ( 20, -65), ( 28, -60), ( 42, -60)]
    for k, mesh_idx in enumerate(LM_LEFT_EYE):
        lm[mesh_idx] = list(left_eye_pts[k])
    for k, mesh_idx in enumerate(LM_RIGHT_EYE):
        lm[mesh_idx] = list(right_eye_pts[k])

    # Pontos canónicos do olho (canto medial/lateral) — sobrepõem entradas
    # acima quando o índice coincide; usamos posições explícitas.
    lm[P_LEFT_EYE_OUTER] = [-50, -65]
    lm[P_LEFT_EYE_INNER] = [-20, -65]
    lm[P_RIGHT_EYE_OUTER] = [50, -65]
    lm[P_RIGHT_EYE_INNER] = [20, -65]

    # Lábios — valores bilateralmente simétricos atribuídos DIRETAMENTE aos
    # índices MediaPipe. LM_OUTER_MOUTH/LM_INNER_MOUTH estão em ordem de contorno
    # MediaPipe (não dlib), então cada par espelho (esq, dir) é definido por
    # índice anatômico explícito (= LIP_MIRROR_PAIRS, mais o ponto inferior 375
    # sem par). Cada par é simétrico sobre x = 0.
    lip_points = {
        # contorno externo superior (esquerda / direita)
        61: (-30, 30), 291: (30, 30),
        185: (-22, 24), 409: (22, 24),
        40: (-14, 21), 270: (14, 21),
        39: (-8, 19), 269: (8, 19),
        37: (-4, 18), 267: (4, 18),
        375: (12, 40),  # ponto externo inferior direito (sem par no Marquardt)
        # contorno interno inferior (esquerda / direita)
        78: (-22, 32), 308: (22, 32),
        95: (-12, 35), 324: (12, 35),
        88: (-15, 33), 318: (15, 33),
        178: (-8, 37), 402: (8, 37),
        87: (-5, 30), 317: (5, 30),
    }
    for idx, (x, y) in lip_points.items():
        lm[idx] = [x, y]

    # Pontos da linha média dos lábios (x = 0): cupid's bow + centros internos.
    lm[P_UPPER_LIP_TOP] = [0, 18]   # idx 0  — cupid's bow centre
    lm[P_UPPER_LIP_BOT] = [0, 27]   # idx 13 — inner upper-lip centre
    lm[P_LOWER_LIP_TOP] = [0, 38]   # idx 14 — inner lower-lip centre
    lm[P_LOWER_LIP_BOT] = [0, 48]   # idx 17 — lowermost lower-lip centre

    lm[P_NOSE_TIP] = [0, -30]
    lm[P_SUBNASALE] = [0, -10]
    lm[P_NASION] = [0, -90]
    lm[P_NOSE_LEFT] = [-15, -20]
    lm[P_NOSE_RIGHT] = [15, -20]

    # P_MENTON / P_LEFT_GONION / P_RIGHT_GONION coincidem com índices dentro do
    # LM_JAWLINE — manter os valores simétricos vindos do loop acima.
    # Jawline já populou lm[P_MENTON] = (0, 250), lm[P_LEFT_GONION] = (-65, 165),
    # lm[P_RIGHT_GONION] = (65, 165) via correspondência dlib 8/4/12.

    lm[P_BROW_LEFT_INNER] = [-12, -120]
    lm[P_BROW_RIGHT_INNER] = [12, -120]
    lm[P_BROW_LEFT_OUTER] = [-60, -110]
    lm[P_BROW_RIGHT_OUTER] = [60, -110]
    lm[P_BROW_LEFT_MID] = [-36, -125]
    lm[P_BROW_RIGHT_MID] = [36, -125]

    lm[P_LEFT_ZYGOMATIC] = [-95, 60]
    lm[P_RIGHT_ZYGOMATIC] = [95, 60]
    lm[P_LEFT_CHEEK] = [-78, 135]
    lm[P_RIGHT_CHEEK] = [78, 135]

    # Espelhar o contorno facial: LM_JAWLINE só cobre o lado direito do oval,
    # então o lado esquerdo (índices em FACE_OVAL_MIRROR_PAIRS) é definido como
    # o espelho exato sobre x=0 do ponto direito já populado. Mantém as
    # FACE_OVAL_MIRROR_PAIRS do Marquardt simétricas.
    for r_idx, l_idx in FACE_OVAL_MIRROR_PAIRS:
        lm[l_idx] = [-lm[r_idx][0], lm[r_idx][1]]

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
    s = p["thirds_upper_ratio"] + p["thirds_middle_ratio"] + p["thirds_lower_ratio"]
    assert abs(s - 1.0) < 1e-6


def test_compute_all_returns_three_blocks():
    lm = _symmetric_landmarks()
    img = np.full((400, 500, 3), 128, dtype=np.uint8)
    out = fm.compute_all(img, lm, face_rect_w=300)
    for k in ("advanced", "photo_quality", "skin"):
        assert k in out, f"missing block: {k}"
    assert isinstance(out["photo_quality"]["frontal_ok"], bool)


def test_severity_for_known_keys():
    assert fm.severity_for("fwhr", 1.85) == "excelente"
    assert fm.severity_for("fwhr", 2.5) in ("acentuada", "severa")
