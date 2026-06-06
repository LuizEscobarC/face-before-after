#!/usr/bin/env python3
"""
face_metrics.py
================

Métricas faciais avançadas calculadas a partir dos 68 landmarks dlib +
imagem alinhada (BGR). Todas as métricas espaciais são normalizadas pela
distância interpupilar (IPD) sempre que faz sentido — o que torna os
valores comparáveis entre fotos com escalas diferentes.

Saída principal: ``compute_all(image_bgr, landmarks) -> dict`` com chaves
``advanced``, ``photo_quality`` e ``skin``.

Bases / referências:
    - Farkas, L. G. (1994). Anthropometry of the Head and Face.
    - Carré, J. M., & McCormick, C. M. (2008). fWHR e percepção de dominância.
    - Marquardt, S. (Phi mask) — proporções áureas faciais.
    - Naini, F. B. (2011). Facial Aesthetics: Concepts and Clinical Diagnosis.
"""

from __future__ import annotations

import math
from typing import Dict, Any, Tuple, List

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# Constantes / índices (compatíveis com o modelo de 68 pontos dlib)
# ---------------------------------------------------------------------------
LM_LEFT_EYE        = list(range(36, 42))
LM_RIGHT_EYE       = list(range(42, 48))
LM_LEFT_BROW       = list(range(17, 22))
LM_RIGHT_BROW      = list(range(22, 27))
LM_NOSE_BRIDGE     = list(range(27, 31))
LM_NOSE_TIP        = list(range(31, 36))
LM_OUTER_MOUTH     = list(range(48, 60))
LM_INNER_MOUTH     = list(range(60, 68))
LM_JAWLINE         = list(range(0, 17))

P_LEFT_EYE_OUTER   = 36
P_LEFT_EYE_INNER   = 39
P_RIGHT_EYE_INNER  = 42
P_RIGHT_EYE_OUTER  = 45
P_NOSE_TIP         = 30
P_NOSE_LEFT        = 31
P_NOSE_RIGHT       = 35
P_SUBNASALE        = 33
P_LEFT_MOUTH       = 48
P_RIGHT_MOUTH      = 54
P_UPPER_LIP        = 51   # labiale superius
P_LOWER_LIP        = 57   # labiale inferius
P_UPPER_LIP_TOP    = 50
P_UPPER_LIP_BOT    = 62
P_LOWER_LIP_TOP    = 66
P_LOWER_LIP_BOT    = 58
P_MENTON           = 8
P_LEFT_GONION      = 4
P_RIGHT_GONION     = 12
P_BROW_LEFT_INNER  = 21
P_BROW_RIGHT_INNER = 22


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _eye_centers(lm: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
    return lm[LM_LEFT_EYE].mean(axis=0), lm[LM_RIGHT_EYE].mean(axis=0)


def _ipd(lm: np.ndarray) -> float:
    le, re = _eye_centers(lm)
    return float(np.linalg.norm(re - le))


def _glabella(lm: np.ndarray) -> np.ndarray:
    return (lm[P_BROW_LEFT_INNER] + lm[P_BROW_RIGHT_INNER]) / 2.0


def _angle_deg(p1: np.ndarray, p2: np.ndarray) -> float:
    """Ângulo do vetor p1->p2 em graus, no plano da imagem."""
    return math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0]))


def _safe_div(a: float, b: float, default: float = 0.0) -> float:
    return float(a) / float(b) if abs(b) > 1e-9 else default


def _round_dict(d: Dict[str, Any], decimals: int = 3) -> Dict[str, Any]:
    out = {}
    for k, v in d.items():
        if isinstance(v, (bool, np.bool_)):
            out[k] = bool(v)
        elif isinstance(v, (int, np.integer)):
            out[k] = int(v)
        elif isinstance(v, (float, np.floating)):
            out[k] = round(float(v), decimals)
        elif isinstance(v, dict):
            out[k] = _round_dict(v, decimals)
        else:
            out[k] = v
    return out


# ===========================================================================
# A) PROPORÇÕES CLÁSSICAS
# ===========================================================================
def proportions(lm: np.ndarray) -> Dict[str, Any]:
    """Razões neoclássicas (terços, quintos, fWHR, lower-third).

    Não temos landmark do trichion (linha do cabelo): aproximamos usando
    a glabela espelhada para cima a partir do nasion. Isso é uma
    aproximação clínica comum em fotos sem cabelo visível.
    """
    glabella   = _glabella(lm)
    subnasale  = lm[P_SUBNASALE]
    menton     = lm[P_MENTON]
    nasion     = lm[27]  # ponta superior da ponte nasal

    # Aproxima trichion: distância nasion->subnasale projetada para cima de nasion.
    mid_face_height = float(subnasale[1] - nasion[1])
    trichion_y = float(nasion[1] - mid_face_height)
    trichion = np.array([glabella[0], trichion_y])

    # Alturas dos três terços
    h_upper  = float(glabella[1] - trichion[1])      # trichion -> glabella
    h_middle = float(subnasale[1] - glabella[1])     # glabella -> subnasale
    h_lower  = float(menton[1] - subnasale[1])       # subnasale -> menton
    h_total  = h_upper + h_middle + h_lower

    r_upper  = _safe_div(h_upper,  h_total)
    r_middle = _safe_div(h_middle, h_total)
    r_lower  = _safe_div(h_lower,  h_total)
    thirds_std = float(np.std([r_upper, r_middle, r_lower]))

    # Largura facial bizigomática (~ jawline pontos 1 e 15) e bigoníaca (4,12)
    bizygomatic = float(np.linalg.norm(lm[1] - lm[15]))
    bigonial    = float(np.linalg.norm(lm[P_LEFT_GONION] - lm[P_RIGHT_GONION]))

    # Quintos: largura olho L, intercanthal, intercanthal-olho R, etc.
    eye_w_l = float(np.linalg.norm(lm[P_LEFT_EYE_OUTER]  - lm[P_LEFT_EYE_INNER]))
    eye_w_r = float(np.linalg.norm(lm[P_RIGHT_EYE_OUTER] - lm[P_RIGHT_EYE_INNER]))
    intercanthal = float(np.linalg.norm(lm[P_LEFT_EYE_INNER] - lm[P_RIGHT_EYE_INNER]))
    # Largura temporal aproximada = (bizygomatic - eye_outer..eye_outer)/2 cada lado
    outer_to_outer = float(np.linalg.norm(lm[P_LEFT_EYE_OUTER] - lm[P_RIGHT_EYE_OUTER]))
    temple_l = max(0.0, (bizygomatic - outer_to_outer) / 2.0)
    temple_r = temple_l
    fifths = [temple_l, eye_w_l, intercanthal, eye_w_r, temple_r]
    fifths_total = sum(fifths) or 1.0
    fifths_ratios = [f / fifths_total for f in fifths]
    fifths_std = float(np.std(fifths_ratios))

    # Lower-third (ideal masc. 0.55-0.57)
    glabella_to_menton = float(menton[1] - glabella[1])
    lower_third_ratio = _safe_div(h_lower, glabella_to_menton)

    # fWHR: bizygomatic / upper-face height (glabella -> upper lip)
    upper_face_h = float(lm[P_UPPER_LIP][1] - glabella[1])
    fwhr = _safe_div(bizygomatic, upper_face_h)

    return {
        "thirds_upper_ratio":  r_upper,
        "thirds_middle_ratio": r_middle,
        "thirds_lower_ratio":  r_lower,
        "thirds_std_dev":      thirds_std,
        "fifths_std_dev":      fifths_std,
        "lower_third_ratio":   lower_third_ratio,
        "fwhr":                fwhr,
        "bizygomatic_px":      bizygomatic,
        "bigonial_px":         bigonial,
    }


# ===========================================================================
# B) DIMORFISMO MASCULINO
# ===========================================================================
def masculinity(lm: np.ndarray, ipd: float) -> Dict[str, Any]:
    bizygomatic = float(np.linalg.norm(lm[1] - lm[15]))
    bigonial    = float(np.linalg.norm(lm[P_LEFT_GONION] - lm[P_RIGHT_GONION]))

    # Ângulo gonial estimado: ângulo no ponto 4 (ramus->corpo) e 12, médio.
    # Em 4: vetor p4->p2 e p4->p6 (ramus para cima e corpo para mento)
    def _gonial(idx_g: int, idx_up: int, idx_down: int) -> float:
        v1 = lm[idx_up]   - lm[idx_g]
        v2 = lm[idx_down] - lm[idx_g]
        cos = _safe_div(float(np.dot(v1, v2)),
                        float(np.linalg.norm(v1) * np.linalg.norm(v2)),
                        default=1.0)
        cos = max(-1.0, min(1.0, cos))
        return math.degrees(math.acos(cos))

    gonial_l = _gonial(P_LEFT_GONION,  2, 6)
    gonial_r = _gonial(P_RIGHT_GONION, 14, 10)

    # Projeção do mento vs lábio inferior (sagital projetada no plano frontal:
    # como não temos perfil, usamos diferença vertical menton vs lábio inferior
    # normalizada — apenas indicativo de proeminência relativa).
    chin_proj_px = float(lm[P_MENTON][1] - lm[P_LOWER_LIP][1])

    # Definição da linha mandibular: variância angular entre segmentos
    jaw = lm[LM_JAWLINE]
    angles = []
    for i in range(1, len(jaw) - 1):
        v1 = jaw[i] - jaw[i - 1]
        v2 = jaw[i + 1] - jaw[i]
        a = math.degrees(math.atan2(v2[1], v2[0]) - math.atan2(v1[1], v1[0]))
        angles.append(abs(a))
    # Normalizado em [0,1], MAIOR = MAIS DEFINIDO (std=0°→1.0, std=15°→0.0).
    # Antes retornava std em graus, inconsistente com os consumidores que tratam
    # como [0,1] (visual_status, impression, evolution_path, top_leverage e
    # _FALLBACK_IDEALS ideal=0.65) — causava saturação/inversão de scores.
    if angles:
        std_deg = float(np.std(angles))
        jaw_def_score = float(max(0.0, min(1.0, 1.0 - std_deg / 15.0)))
    else:
        jaw_def_score = 0.0

    return {
        "jaw_width_pct_ipd":             100.0 * _safe_div(bigonial, ipd),
        "bizygomatic_to_bigonial_ratio": _safe_div(bizygomatic, bigonial),
        "gonial_angle_left_deg":         gonial_l,
        "gonial_angle_right_deg":        gonial_r,
        "gonial_angle_mean_deg":         (gonial_l + gonial_r) / 2.0,
        "chin_projection_pct_ipd":       100.0 * _safe_div(chin_proj_px, ipd),
        "jawline_definition_score":      jaw_def_score,
    }


# ===========================================================================
# C) OLHOS
# ===========================================================================
def eyes(lm: np.ndarray, ipd: float) -> Dict[str, Any]:
    # Canthal tilt: ângulo da reta canto medial -> canto lateral.
    # Sinal: tilt positivo = canto lateral mais alto que medial (desejável).
    # Em coordenadas de imagem o eixo Y aumenta para baixo, então invertemos.
    # Usamos |dx| para evitar wrap-around de atan2 quando o canto lateral
    # está à esquerda do medial (olho esquerdo da imagem).
    def _tilt(inner_idx: int, outer_idx: int) -> float:
        dx = abs(float(lm[outer_idx][0] - lm[inner_idx][0]))
        dy = float(lm[outer_idx][1] - lm[inner_idx][1])
        return -math.degrees(math.atan2(dy, dx))

    tilt_l = _tilt(P_LEFT_EYE_INNER,  P_LEFT_EYE_OUTER)
    tilt_r = _tilt(P_RIGHT_EYE_INNER, P_RIGHT_EYE_OUTER)

    # EAR (eye aspect ratio) clássico (Soukupová & Čech, 2016)
    def _ear(eye_pts: np.ndarray) -> float:
        # eye_pts: 6 pontos
        a = np.linalg.norm(eye_pts[1] - eye_pts[5])
        b = np.linalg.norm(eye_pts[2] - eye_pts[4])
        c = np.linalg.norm(eye_pts[0] - eye_pts[3])
        return float((a + b) / (2.0 * c)) if c > 1e-9 else 0.0

    ear_l = _ear(lm[LM_LEFT_EYE])
    ear_r = _ear(lm[LM_RIGHT_EYE])

    intercanthal = float(np.linalg.norm(lm[P_LEFT_EYE_INNER] - lm[P_RIGHT_EYE_INNER]))
    eye_w_l = float(np.linalg.norm(lm[P_LEFT_EYE_OUTER]  - lm[P_LEFT_EYE_INNER]))
    eye_w_r = float(np.linalg.norm(lm[P_RIGHT_EYE_OUTER] - lm[P_RIGHT_EYE_INNER]))
    eye_w_mean = (eye_w_l + eye_w_r) / 2.0
    intercanthal_to_eyewidth = _safe_div(intercanthal, eye_w_mean)

    # Distância sobrancelha->pálpebra superior (centro da sobrancelha vs pálpebra sup)
    def _brow_eyelid(brow_idx: List[int], eye_idx: List[int]) -> float:
        brow_y = float(lm[brow_idx].mean(axis=0)[1])
        # pálpebra superior aproximada: média dos 2 pontos superiores do olho
        upper_eyelid_y = float(np.mean([lm[eye_idx[1]][1], lm[eye_idx[2]][1]]))
        return upper_eyelid_y - brow_y  # positivo = sobrancelha ACIMA da pálpebra

    bed_l = _brow_eyelid(LM_LEFT_BROW,  LM_LEFT_EYE)
    bed_r = _brow_eyelid(LM_RIGHT_BROW, LM_RIGHT_EYE)

    # Tilt da sobrancelha (do ponto medial ao lateral). Usamos |dx| para
    # manter o sinal consistente em ambos os lados (positivo = ponta lateral
    # mais alta que a medial).
    def _brow_tilt(medial_idx: int, lateral_idx: int) -> float:
        dx = abs(float(lm[lateral_idx][0] - lm[medial_idx][0]))
        dy = float(lm[lateral_idx][1] - lm[medial_idx][1])
        return -math.degrees(math.atan2(dy, dx))

    brow_tilt_l = _brow_tilt(21, 17)  # 21 medial, 17 lateral (esq)
    brow_tilt_r = _brow_tilt(22, 26)  # 22 medial, 26 lateral (dir)

    return {
        "canthal_tilt_left_deg":           tilt_l,
        "canthal_tilt_right_deg":          tilt_r,
        "canthal_tilt_mean_deg":           (tilt_l + tilt_r) / 2.0,
        "eye_aspect_ratio_left":           ear_l,
        "eye_aspect_ratio_right":          ear_r,
        "eye_aspect_ratio_mean":           (ear_l + ear_r) / 2.0,
        "intercanthal_to_eyewidth_ratio":  intercanthal_to_eyewidth,
        "brow_to_eyelid_left_pct_ipd":     100.0 * _safe_div(bed_l, ipd),
        "brow_to_eyelid_right_pct_ipd":    100.0 * _safe_div(bed_r, ipd),
        "brow_to_eyelid_mean_pct_ipd":     100.0 * _safe_div((bed_l + bed_r) / 2.0, ipd),
        "brow_tilt_left_deg":              brow_tilt_l,
        "brow_tilt_right_deg":             brow_tilt_r,
    }


# ===========================================================================
# D) NARIZ
# ===========================================================================
def nose(lm: np.ndarray, ipd: float) -> Dict[str, Any]:
    alar = float(np.linalg.norm(lm[P_NOSE_LEFT] - lm[P_NOSE_RIGHT]))
    mouth_w = float(np.linalg.norm(lm[P_LEFT_MOUTH] - lm[P_RIGHT_MOUTH]))
    intercanthal = float(np.linalg.norm(lm[P_LEFT_EYE_INNER] - lm[P_RIGHT_EYE_INNER]))

    # Comprimento nasal (nasion -> subnasale)
    nasion = lm[27]
    nasal_len = float(lm[P_SUBNASALE][1] - nasion[1])
    face_h = float(lm[P_MENTON][1] - _glabella(lm)[1])

    return {
        "nasal_to_mouth_width_ratio":         _safe_div(alar, mouth_w),
        "alar_intercanthal_alignment_pct":    100.0 * _safe_div(abs(alar - intercanthal), intercanthal),
        "nasal_length_pct_face_height":       100.0 * _safe_div(nasal_len, face_h),
        "alar_width_pct_ipd":                 100.0 * _safe_div(alar, ipd),
    }


# ===========================================================================
# E) BOCA / LÁBIOS
# ===========================================================================
def mouth(lm: np.ndarray, ipd: float) -> Dict[str, Any]:
    mouth_w = float(np.linalg.norm(lm[P_LEFT_MOUTH] - lm[P_RIGHT_MOUTH]))
    upper_lip_thickness = float(lm[P_UPPER_LIP_BOT][1] - lm[P_UPPER_LIP_TOP][1])
    lower_lip_thickness = float(lm[P_LOWER_LIP_BOT][1] - lm[P_LOWER_LIP_TOP][1])
    philtrum_len = float(lm[P_UPPER_LIP][1] - lm[P_SUBNASALE][1])

    return {
        "mouth_to_ipd_ratio":          _safe_div(mouth_w, ipd),
        "upper_lower_lip_ratio":       _safe_div(upper_lip_thickness, lower_lip_thickness),
        "philtrum_length_pct_ipd":     100.0 * _safe_div(philtrum_len, ipd),
        "upper_lip_thickness_pct_ipd": 100.0 * _safe_div(upper_lip_thickness, ipd),
        "lower_lip_thickness_pct_ipd": 100.0 * _safe_div(lower_lip_thickness, ipd),
    }


# ===========================================================================
# F) FORMA / GLOBAL
# ===========================================================================
def face_shape(lm: np.ndarray) -> Dict[str, Any]:
    bizygomatic = float(np.linalg.norm(lm[1] - lm[15]))
    bigonial    = float(np.linalg.norm(lm[P_LEFT_GONION] - lm[P_RIGHT_GONION]))
    face_h      = float(lm[P_MENTON][1] - _glabella(lm)[1])

    # Heurística simples (Naini, 2011, simplificada)
    h_w = _safe_div(face_h, bizygomatic)
    z_g = _safe_div(bizygomatic, bigonial)

    if h_w >= 1.5:
        label = "oblongo"
    elif h_w >= 1.3:
        label = "oval"
    elif h_w >= 1.15:
        label = "retangular" if z_g < 1.15 else "oval"
    elif h_w >= 1.0:
        label = "quadrado" if z_g < 1.15 else "diamante"
    else:
        label = "redondo"

    return {
        "face_height_to_width_ratio": h_w,
        "zygomatic_to_gonial_ratio":  z_g,
        "face_shape_label":           label,
    }


def marquardt_deviation(lm: np.ndarray, ipd: float) -> Dict[str, Any]:
    """Aproximação: desvio bilateral RMS entre cada landmark e seu espelho.

    Em vez de transportar uma máscara áurea fixa (que requer alinhamento por
    pose 3D), medimos o quanto o rosto se afasta da própria simetria
    bilateral perfeita — proxy útil e estável da "máscara áurea" de
    Marquardt para fotos frontais.
    """
    # Pares espelhados clássicos do modelo de 68 pontos
    pairs = [
        (0, 16), (1, 15), (2, 14), (3, 13), (4, 12), (5, 11), (6, 10), (7, 9),
        (17, 26), (18, 25), (19, 24), (20, 23), (21, 22),
        (36, 45), (37, 44), (38, 43), (39, 42), (40, 47), (41, 46),
        (31, 35), (32, 34),
        (48, 54), (49, 53), (50, 52), (59, 55), (58, 56), (60, 64), (61, 63), (67, 65),
    ]
    # Linha média = média entre eye_midpoint e glabela
    le, re = _eye_centers(lm)
    midline_x = float(((le[0] + re[0]) / 2.0 + _glabella(lm)[0]) / 2.0)

    sq = []
    for li, ri in pairs:
        l = lm[li]
        r = lm[ri]
        # Reflete o ponto direito para o lado esquerdo da midline
        r_mirrored = np.array([2 * midline_x - r[0], r[1]])
        sq.append(float(np.sum((l - r_mirrored) ** 2)))
    rmse_px = float(np.sqrt(np.mean(sq)))
    return {
        "marquardt_deviation_px":      rmse_px,
        "marquardt_deviation_pct_ipd": 100.0 * _safe_div(rmse_px, ipd),
    }


# ===========================================================================
# G) QUALIDADE DA FOTO
# ===========================================================================
# Modelo 3D genérico (mm) para 6 landmarks. Convenção:
#   X = direita,  Y = baixo (alinhada com a imagem),  Z = atrás do rosto.
# Manter Y crescente para baixo evita rotação de ~180° em pitch ao fazer
# solvePnP contra coordenadas de imagem.
_MODEL_3D_POINTS = np.array([
    (0.0,    0.0,    0.0),       # 30 nose tip
    (0.0,   63.6,  -12.5),       # 8  chin (abaixo do nariz)
    (-43.3, -32.7, -26.0),       # 36 left eye outer corner (acima)
    ( 43.3, -32.7, -26.0),       # 45 right eye outer corner
    (-28.9,  28.9, -24.1),       # 48 left mouth corner (abaixo)
    ( 28.9,  28.9, -24.1),       # 54 right mouth corner
], dtype=np.float64)
_MODEL_3D_INDICES = [P_NOSE_TIP, P_MENTON,
                     P_LEFT_EYE_OUTER, P_RIGHT_EYE_OUTER,
                     P_LEFT_MOUTH, P_RIGHT_MOUTH]


def head_pose(image_bgr: np.ndarray, lm: np.ndarray) -> Dict[str, Any]:
    h, w = image_bgr.shape[:2]
    focal = float(w)  # aproximação; ok para câmeras de smartphone
    center = (w / 2.0, h / 2.0)
    cam_matrix = np.array([
        [focal, 0,     center[0]],
        [0,     focal, center[1]],
        [0,     0,     1.0],
    ], dtype=np.float64)
    dist = np.zeros((4, 1))

    image_pts = np.array([lm[i] for i in _MODEL_3D_INDICES], dtype=np.float64)
    ok, rvec, _tvec = cv2.solvePnP(
        _MODEL_3D_POINTS, image_pts, cam_matrix, dist,
        flags=cv2.SOLVEPNP_ITERATIVE,
    )
    if not ok:
        return {"yaw_deg": 0.0, "pitch_deg": 0.0, "roll_deg": 0.0,
                "frontal_ok": False, "warning": "solvePnP falhou"}

    rot_mat, _ = cv2.Rodrigues(rvec)
    # Usa RQDecomp3x3 da OpenCV — retorna (pitch, yaw, roll) em graus
    # já decompostos da matriz de rotação. Convenção: rotação em torno
    # dos eixos X, Y, Z respectivamente (sistema da câmera).
    angles, _, _, _, _, _ = cv2.RQDecomp3x3(rot_mat)
    pitch_d = float(angles[0])
    yaw_d   = float(angles[1])
    roll_d  = float(angles[2])

    # Normaliza para [-180, 180] para evitar wrap-arounds esquisitos
    def _wrap(a: float) -> float:
        while a > 180.0:  a -= 360.0
        while a < -180.0: a += 360.0
        return a
    yaw_d, pitch_d, roll_d = _wrap(yaw_d), _wrap(pitch_d), _wrap(roll_d)

    # Resolve ambiguidade: se roll está perto de ±180°, a decomposição
    # escolheu a outra solução do par (yaw, π-pitch, roll±π) ↔ (-yaw, pitch, roll).
    # Reescreve para a representação com roll perto de 0.
    if abs(roll_d) > 90.0:
        roll_d  = _wrap(roll_d + 180.0)
        pitch_d = _wrap(180.0 - pitch_d)
        yaw_d   = _wrap(-yaw_d)
        # Normaliza pitch para (-180, 180]
        if pitch_d > 90.0:  pitch_d -= 180.0
        if pitch_d < -90.0: pitch_d += 180.0

    frontal = (abs(yaw_d) <= 7.0) and (abs(pitch_d) <= 7.0)
    warning = None
    if not frontal:
        warning = (
            f"Pose facial fora do limite frontal (|yaw|={abs(yaw_d):.1f}°, "
            f"|pitch|={abs(pitch_d):.1f}°). Métricas podem estar enviesadas."
        )

    return {
        "yaw_deg":    yaw_d,
        "pitch_deg":  pitch_d,
        "roll_deg":   roll_d,
        "frontal_ok": bool(frontal),
        "warning":    warning,
    }


def photo_quality(image_bgr: np.ndarray, lm: np.ndarray,
                  face_rect_w: int) -> Dict[str, Any]:
    pose = head_pose(image_bgr, lm)

    # Distorção focal: razão largura nariz / largura zigomática.
    # Em fotos com lente curta (selfie ~30 cm), nariz parece muito largo.
    alar = float(np.linalg.norm(lm[P_NOSE_LEFT] - lm[P_NOSE_RIGHT]))
    bizyg = float(np.linalg.norm(lm[1] - lm[15]))
    focal_ratio = _safe_div(alar, bizyg)
    focal_warn = focal_ratio > 0.55

    # Iluminação: comparar luminância entre hemifaces (ROI bochechas)
    delta_e = _lighting_delta_e(image_bgr, lm)

    # Sharpness: variância do laplaciano dentro do bbox da face
    x_min = int(np.min(lm[:, 0])); x_max = int(np.max(lm[:, 0]))
    y_min = int(np.min(lm[:, 1])); y_max = int(np.max(lm[:, 1]))
    x_min, y_min = max(0, x_min), max(0, y_min)
    face_crop = image_bgr[y_min:y_max, x_min:x_max]
    if face_crop.size > 0:
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        sharp = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    else:
        sharp = 0.0

    out = {
        "head_pose_yaw_deg":           pose["yaw_deg"],
        "head_pose_pitch_deg":         pose["pitch_deg"],
        "head_pose_roll_deg":          pose["roll_deg"],
        "frontal_ok":                  pose["frontal_ok"],
        "focal_distortion_ratio":      focal_ratio,
        "focal_distortion_warning":    bool(focal_warn),
        "lighting_asymmetry_delta_e":  delta_e,
        "face_pixel_width":            int(face_rect_w),
        "sharpness_laplacian_var":     sharp,
    }
    warnings = []
    if pose.get("warning"):
        warnings.append(pose["warning"])
    if focal_warn:
        warnings.append(
            f"Possível distorção por lente curta (nariz/bizigomática={focal_ratio:.2f})."
        )
    if face_rect_w < 200:
        warnings.append(f"Resolução facial baixa ({face_rect_w}px). Use foto >= 400px.")
    if sharp < 50:
        warnings.append(f"Foto pouco nítida (variância do laplaciano={sharp:.0f}).")
    out["warnings"] = warnings
    return out


# ===========================================================================
# H) PELE (ROIs simétricas em bochechas e testa)
# ===========================================================================
def _cheek_rois(lm: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Retorna 3 polígonos (bochecha esq, bochecha dir, testa)."""
    le, re = _eye_centers(lm)
    # Bochechas: triângulo entre olho, asa do nariz e ponto da mandíbula 3/13
    cheek_l = np.array([le, lm[P_NOSE_LEFT],  lm[3]],  dtype=np.int32)
    cheek_r = np.array([re, lm[P_NOSE_RIGHT], lm[13]], dtype=np.int32)
    # Testa: retângulo acima das sobrancelhas (altura = ipd*0.6)
    ipd = _ipd(lm)
    brow_y = float(min(lm[19][1], lm[24][1]))
    forehead_h = ipd * 0.6
    forehead = np.array([
        [int(lm[19][0] - ipd * 0.1), int(brow_y - forehead_h)],
        [int(lm[24][0] + ipd * 0.1), int(brow_y - forehead_h)],
        [int(lm[24][0] + ipd * 0.1), int(brow_y - ipd * 0.1)],
        [int(lm[19][0] - ipd * 0.1), int(brow_y - ipd * 0.1)],
    ], dtype=np.int32)
    return cheek_l, cheek_r, forehead


def _roi_mean_lab(image_bgr: np.ndarray, polygon: np.ndarray) -> np.ndarray:
    """Média LAB dentro do polígono (clampeado à imagem)."""
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    poly = polygon.copy()
    poly[:, 0] = np.clip(poly[:, 0], 0, w - 1)
    poly[:, 1] = np.clip(poly[:, 1], 0, h - 1)
    cv2.fillConvexPoly(mask, poly, 255)
    if cv2.countNonZero(mask) == 0:
        return np.array([0.0, 0.0, 0.0])
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB)
    mean = cv2.mean(lab, mask=mask)[:3]
    return np.array(mean, dtype=np.float64)


def _roi_std_lab(image_bgr: np.ndarray, polygon: np.ndarray) -> float:
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    poly = polygon.copy()
    poly[:, 0] = np.clip(poly[:, 0], 0, w - 1)
    poly[:, 1] = np.clip(poly[:, 1], 0, h - 1)
    cv2.fillConvexPoly(mask, poly, 255)
    if cv2.countNonZero(mask) == 0:
        return 0.0
    lab = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2LAB).astype(np.float64)
    pixels = lab[mask > 0]
    return float(np.linalg.norm(pixels.std(axis=0)))


def _lighting_delta_e(image_bgr: np.ndarray, lm: np.ndarray) -> float:
    cheek_l, cheek_r, _ = _cheek_rois(lm)
    mean_l = _roi_mean_lab(image_bgr, cheek_l)
    mean_r = _roi_mean_lab(image_bgr, cheek_r)
    return float(np.linalg.norm(mean_l - mean_r))


def skin(image_bgr: np.ndarray, lm: np.ndarray) -> Dict[str, Any]:
    cheek_l, cheek_r, forehead = _cheek_rois(lm)

    std_l = _roi_std_lab(image_bgr, cheek_l)
    std_r = _roi_std_lab(image_bgr, cheek_r)
    std_f = _roi_std_lab(image_bgr, forehead)
    delta = _lighting_delta_e(image_bgr, lm)

    # Olheiras: luminância infra-orbital vs bochecha
    def _under_eye_dark(eye_idx: List[int], cheek_poly: np.ndarray) -> float:
        # Pequena ROI logo abaixo do olho (média dos pontos inferiores 41/40 ou 47/46)
        eye = lm[eye_idx]
        bottom = eye[[4, 5]].mean(axis=0)
        offset = _ipd(lm) * 0.12
        ue_poly = np.array([
            [int(bottom[0] - offset), int(bottom[1] + offset * 0.3)],
            [int(bottom[0] + offset), int(bottom[1] + offset * 0.3)],
            [int(bottom[0] + offset), int(bottom[1] + offset * 1.1)],
            [int(bottom[0] - offset), int(bottom[1] + offset * 1.1)],
        ], dtype=np.int32)
        l_under = _roi_mean_lab(image_bgr, ue_poly)[0]
        l_cheek = _roi_mean_lab(image_bgr, cheek_poly)[0]
        # Retorna escala de escuridão [0, ~0.4]: 0 = sem olheira, >0.2 = visível.
        # Usamos 1 - ratio para que 0 = igual ao bochecha (saudável) e
        # valores positivos = mais escuro que bochecha.
        ratio = _safe_div(l_under, l_cheek, default=1.0)
        return max(0.0, 1.0 - ratio)

    ue_l = _under_eye_dark(LM_LEFT_EYE,  cheek_l)
    ue_r = _under_eye_dark(LM_RIGHT_EYE, cheek_r)

    return {
        "skin_uniformity_std_lab_left":   std_l,
        "skin_uniformity_std_lab_right":  std_r,
        "skin_uniformity_std_lab_forehead": std_f,
        "skin_lighting_delta_e_lr":       delta,
        "under_eye_darkness_left":        ue_l,
        "under_eye_darkness_right":       ue_r,
    }


# ===========================================================================
# Ideais e severidade para o subset clínico
# ===========================================================================
# (chave, ideal, tolerancia_relativa) — usado no relatório/HTML.
ADVANCED_IDEALS: Dict[str, Tuple[float, float]] = {
    "overall_asymmetry_score_pct_ipd":    (0.0,  1.0),
    "fwhr":                          (1.85, 0.10),  # 1.7–2.0
    "lower_third_ratio":             (0.56, 0.05),
    "canthal_tilt_mean_deg":         (5.0,  3.0),   # ~+5° é desejável
    "intercanthal_to_eyewidth_ratio":(1.0,  0.10),
    "nasal_to_mouth_width_ratio":    (0.70, 0.10),
    "mouth_to_ipd_ratio":            (1.50, 0.20),
    "thirds_std_dev":                (0.0,  0.03),  # ideal = 0
    "fifths_std_dev":                (0.0,  0.03),
    # Métricas usadas por visual_status.py
    "bizygomatic_to_bigonial_ratio": (1.30, 0.15),  # ~1.3 ideal (zigomático > gonial)
    "eye_aspect_ratio_mean":         (0.30, 0.04),  # abertura ocular [0.26, 0.35]
    "skin_uniformity_std_lab_left":  (0.0,  10.0),  # ideal=0, aceitável<10, ruim>25
    "skin_uniformity_std_lab_right": (0.0,  10.0),
    "under_eye_darkness_left":       (0.0,  0.05),  # ideal=0 (sem olheira), ruim>0.25
    "under_eye_darkness_right":      (0.0,  0.05),
    "marquardt_deviation_pct_ipd":   (0.0,  3.0),
    "jaw_width_pct_ipd":             (155.0, 20.0),
    "jawline_definition_score":      (0.65, 0.20),
    "upper_lower_lip_ratio":         (0.65, 0.15),
    "philtrum_length_pct_ipd":       (26.0, 4.0),
}


def severity_for(key: str, value: float) -> str:
    if key not in ADVANCED_IDEALS:
        return "leve"
    ideal, tol = ADVANCED_IDEALS[key]
    diff = abs(value - ideal)
    if diff <= tol:        return "excelente"
    if diff <= tol * 2:    return "leve"
    if diff <= tol * 3:    return "moderada"
    if diff <= tol * 4:    return "acentuada"
    return "severa"


# ===========================================================================
# Entrada pública
# ===========================================================================
def compute_all(image_bgr: np.ndarray, lm: np.ndarray,
                face_rect_w: int = 0) -> Dict[str, Any]:
    """Computa todas as métricas avançadas + qualidade da foto + pele.

    Retorna dict com chaves: ``advanced``, ``photo_quality``, ``skin``.
    Estes blocos são adicionados ao JSON final em ``measurements`` sem
    alterar nenhuma chave pré-existente.
    """
    ipd = _ipd(lm)
    if ipd <= 1e-6:
        raise ValueError("IPD inválida (olhos coincidentes).")

    advanced = {}
    advanced.update(proportions(lm))
    advanced.update(masculinity(lm, ipd))
    advanced.update(eyes(lm, ipd))
    advanced.update(nose(lm, ipd))
    advanced.update(mouth(lm, ipd))
    advanced.update(face_shape(lm))
    advanced.update(marquardt_deviation(lm, ipd))

    pq = photo_quality(image_bgr, lm, face_rect_w or int(np.max(lm[:, 0]) - np.min(lm[:, 0])))
    sk = skin(image_bgr, lm)

    return {
        "advanced":       _round_dict(advanced, 3),
        "photo_quality":  _round_dict(pq, 3),
        "skin":           _round_dict(sk, 3),
    }
