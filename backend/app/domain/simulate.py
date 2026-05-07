"""Simulação antes/depois sem IA generativa.

Camada A — Simetrização: espelha a metade "melhor" do rosto sobre a outra
            usando OpenCV + blend com gradiente suave na linha média.

Camada B — Anotação de proporções ideais: sobrepõe guias visuais de
            terços, quintos, ângulo cantal ideal e razão nariz/boca.

Nenhuma dependência de IA generativa — apenas OpenCV + numpy.
"""

from __future__ import annotations

import os
from typing import TYPE_CHECKING, Any, Dict, List, Sequence, Tuple

import cv2
import numpy as np

from app.domain.landmarks_mesh import (
    LM_JAWLINE,
    P_BROW_LEFT_INNER,
    P_BROW_LEFT_MID,
    P_BROW_LEFT_OUTER,
    P_BROW_RIGHT_INNER,
    P_BROW_RIGHT_MID,
    P_BROW_RIGHT_OUTER,
    P_LEFT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_LEFT_MOUTH,
    P_MENTON,
    P_NASION,
    P_NOSE_LEFT,
    P_NOSE_RIGHT,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_MOUTH,
    P_SUBNASALE,
    TOTAL_LANDMARKS,
)

if TYPE_CHECKING:
    from app.domain.canonical_frame import CanonicalFrame


# ---------------------------------------------------------------------------
# Tipos
# ---------------------------------------------------------------------------

Point = Tuple[int, int]
Landmarks = List[Tuple[int, int]]

# Cores (BGR)
_GREEN = (0, 200, 0)
_ORANGE = (0, 140, 255)
_RED = (0, 0, 220)
_WHITE = (255, 255, 255)
_FONT = cv2.FONT_HERSHEY_SIMPLEX


# ---------------------------------------------------------------------------
# Utilitários de desenho
# ---------------------------------------------------------------------------


def _draw_dashed_line(
    img: np.ndarray,
    pt1: Point,
    pt2: Point,
    color: Tuple[int, int, int],
    thickness: int = 1,
    dash_len: int = 10,
    gap_len: int = 7,
) -> None:
    """Desenha uma linha tracejada entre pt1 e pt2."""
    x1, y1 = pt1
    x2, y2 = pt2
    dx = x2 - x1
    dy = y2 - y1
    length = max(1, int(np.hypot(dx, dy)))
    steps = length // (dash_len + gap_len)

    for i in range(steps + 1):
        t_start = i * (dash_len + gap_len) / length
        t_end = min(1.0, (i * (dash_len + gap_len) + dash_len) / length)
        sx = int(x1 + dx * t_start)
        sy = int(y1 + dy * t_start)
        ex = int(x1 + dx * t_end)
        ey = int(y1 + dy * t_end)
        cv2.line(img, (sx, sy), (ex, ey), color, thickness)


def _deviation_color(deviation_deg: float) -> Tuple[int, int, int]:
    """Cor por desvio em graus: verde ≤2°, laranja ≤5°, vermelho >5°."""
    if abs(deviation_deg) <= 2:
        return _GREEN
    if abs(deviation_deg) <= 5:
        return _ORANGE
    return _RED


def _label(
    img: np.ndarray,
    text: str,
    pos: Point,
    scale: float = 0.45,
    color: Tuple[int, int, int] = _WHITE,
    thickness: int = 1,
) -> None:
    cv2.putText(img, text, pos, _FONT, scale, (0, 0, 0), thickness + 1, cv2.LINE_AA)
    cv2.putText(img, text, pos, _FONT, scale, color, thickness, cv2.LINE_AA)


# ---------------------------------------------------------------------------
# Camada A — Simetrização
# ---------------------------------------------------------------------------


def _midline_x(lm: Landmarks) -> int:
    """Linha média estimada: média horizontal entre os dois cantos externos dos olhos."""
    return int((lm[P_LEFT_EYE_OUTER][0] + lm[P_RIGHT_EYE_OUTER][0]) / 2)


def _half_asymmetry(lm: Landmarks, midline: int, side: str) -> float:
    """Assimetria média dos landmarks da metade esq/dir da jawline em relação à linha média."""
    if side == "left":
        # Jawline points dlib 0–8 — first half + chin centre.
        points = [lm[i] for i in LM_JAWLINE[:9]]
    else:
        # Jawline points dlib 8–16 — chin centre + second half.
        points = [lm[i] for i in LM_JAWLINE[8:17]]
    if not points:
        return 0.0
    dists = [abs(p[0] - midline) for p in points]
    return float(np.mean(dists))


def symmetrize(
    image: np.ndarray,
    landmarks: Landmarks,
) -> np.ndarray:
    """Retorna imagem com o rosto simetrizado.

    Determina a metade mais simétrica (menor desvio médio da linha média),
    espelha-a horizontalmente e faz blend suave na região central.
    """
    h, w = image.shape[:2]
    midline = _midline_x(landmarks)

    asym_left = _half_asymmetry(landmarks, midline, "left")
    asym_right = _half_asymmetry(landmarks, midline, "right")

    # Metade "melhor" = menor assimetria
    mirror_from_left = asym_left <= asym_right

    # Criar imagem espelhada inteira
    flipped = cv2.flip(image, 1)

    # Criar máscara de blend com gradiente na linha média (±30px)
    blend_width = 30
    mask = np.zeros((h, w), dtype=np.float32)
    if mirror_from_left:
        # Manter lado esquerdo, espelhar para a direita
        mask[:, :midline] = 1.0
        for x in range(max(0, midline - blend_width), min(w, midline + blend_width)):
            alpha = max(0.0, 1.0 - abs(x - midline) / blend_width)
            mask[:, x] = alpha
    else:
        # Manter lado direito (flipped fica à esquerda no espelho)
        mask[:, midline:] = 1.0
        for x in range(max(0, midline - blend_width), min(w, midline + blend_width)):
            alpha = max(0.0, 1.0 - abs(x - midline) / blend_width)
            mask[:, x] = alpha

    mask_3 = np.stack([mask, mask, mask], axis=2)

    # Blend: original × mask + flipped × (1 − mask)
    orig_f = image.astype(np.float32)
    flip_f = flipped.astype(np.float32)
    blended = orig_f * mask_3 + flip_f * (1.0 - mask_3)
    return blended.astype(np.uint8)


# ---------------------------------------------------------------------------
# Camada B — Anotação de proporções ideais
# ---------------------------------------------------------------------------


def annotate_ideal_proportions(
    image: np.ndarray,
    landmarks: Landmarks,
) -> np.ndarray:
    """Retorna imagem com guias de proporções ideais sobrepostas.

    Desenha:
    - Terços horizontais (linhas tracejadas verdes)
    - Quintos verticais (linhas tracejadas verdes)
    - Ângulo cantal ideal (+5°) vs real (colorido por desvio)
    - Guia de largura ideal do nariz (70% da boca)
    """
    img = image.copy()
    h, w = img.shape[:2]

    lm = landmarks

    # ------------------------------------------------------------------
    # 1. Terços horizontais
    # ------------------------------------------------------------------
    # Aproximação: y_top_face = lm[19][1] (sobrancelha esq topo) estimado
    # y_glabella ~ média lm[21][1] e lm[22][1]
    # y_nasion ~ lm[27][1]
    # y_menton ~ lm[8][1]
    y_top = min(lm[P_BROW_LEFT_MID][1], lm[P_BROW_RIGHT_MID][1])  # topo sobrancelhas
    y_glabella = int((lm[P_BROW_LEFT_INNER][1] + lm[P_BROW_RIGHT_INNER][1]) / 2)
    y_nasion = lm[P_NASION][1]
    y_menton = lm[P_MENTON][1]

    face_h = y_menton - y_top
    y_t1 = y_top + face_h // 3
    y_t2 = y_top + 2 * face_h // 3

    for y_line in [y_t1, y_t2]:
        _draw_dashed_line(img, (0, y_line), (w, y_line), _GREEN, thickness=1)
    _label(img, "Tercos ideais", (5, y_t1 - 5), color=_GREEN)

    # ------------------------------------------------------------------
    # 2. Quintos verticais
    # ------------------------------------------------------------------
    x_left_temple = lm[LM_JAWLINE[0]][0]
    x_right_temple = lm[LM_JAWLINE[16]][0]
    face_w = x_right_temple - x_left_temple
    fifth = face_w // 5

    for i in range(1, 5):
        x_line = x_left_temple + i * fifth
        _draw_dashed_line(img, (x_line, y_top), (x_line, y_menton), _GREEN, thickness=1)
    _label(img, "Quintos ideais", (x_left_temple + 2, y_top - 8), color=_GREEN)

    # ------------------------------------------------------------------
    # 3. Ângulo cantal ideal (+5°) vs real
    # ------------------------------------------------------------------
    for eye_med_idx, eye_lat_idx, label_prefix in [
        (P_LEFT_EYE_INNER, P_LEFT_EYE_OUTER, "OE"),
        (P_RIGHT_EYE_INNER, P_RIGHT_EYE_OUTER, "OD"),
    ]:
        med = lm[eye_med_idx]
        lat = lm[eye_lat_idx]

        # Ângulo real
        dx_real = lat[0] - med[0]
        dy_real = -(lat[1] - med[1])  # positivo para cima na imagem
        angle_real = float(np.degrees(np.arctan2(dy_real, abs(dx_real) + 1e-6)))

        dev = angle_real - 5.0  # desvio em relação ao ideal de +5°
        color = _deviation_color(dev)

        # Linha real
        cv2.line(img, med, lat, color, 2, cv2.LINE_AA)

        # Linha ideal (+5° a partir do canto medial)
        eye_w = int(np.hypot(dx_real, lat[1] - med[1]))
        ideal_x = med[0] + int(eye_w * np.cos(np.radians(5.0)))
        ideal_y = med[1] - int(eye_w * np.sin(np.radians(5.0)))
        cv2.line(img, med, (ideal_x, ideal_y), _GREEN, 1, cv2.LINE_AA)

        _label(
            img,
            f"{label_prefix} {angle_real:+.1f}° (ideal+5°)",
            (med[0], med[1] - 8),
            color=color,
        )

    # ------------------------------------------------------------------
    # 4. Guia largura ideal do nariz (70% da boca)
    # ------------------------------------------------------------------
    x_alar_l = lm[P_NOSE_LEFT][0]
    x_alar_r = lm[P_NOSE_RIGHT][0]
    x_mouth_l = lm[P_LEFT_MOUTH][0]
    x_mouth_r = lm[P_RIGHT_MOUTH][0]

    mouth_w = x_mouth_r - x_mouth_l
    ideal_alar_w = int(mouth_w * 0.70)
    alar_center = (x_alar_l + x_alar_r) // 2
    ideal_alar_l = alar_center - ideal_alar_w // 2
    ideal_alar_r = alar_center + ideal_alar_w // 2

    real_alar_w = x_alar_r - x_alar_l
    alar_dev = abs(real_alar_w - ideal_alar_w)
    alar_color = _deviation_color(float(alar_dev) / max(1, mouth_w) * 20)

    y_alar = lm[P_SUBNASALE][1] + 8
    cv2.line(img, (x_alar_l, y_alar), (x_alar_r, y_alar), alar_color, 2)
    cv2.line(img, (ideal_alar_l, y_alar + 6), (ideal_alar_r, y_alar + 6), _GREEN, 1)
    _label(img, "Nariz ideal (70% boca)", (ideal_alar_l, y_alar + 18), color=_GREEN)

    return img


# ---------------------------------------------------------------------------
# Interface pública
# ---------------------------------------------------------------------------


def simulate(
    frame: "CanonicalFrame",
    output_dir: str,
) -> Dict[str, str]:
    """Gera 3 imagens de simulação a partir do frame canônico.

    Roda sobre ``frame.image`` (já cropada e alinhada) e ``frame.landmarks``
    (no mesmo sistema de coordenadas), garantindo que a simulação use a
    mesma foto que alimentou todas as outras análises do pipeline.

    Returns:
        {
            "canonical": str,
            "symmetrized": str,
            "ideal_proportions": str,
            "comparison_grid": str,
        }
    """
    img = frame.image
    landmarks_arr = frame.landmarks
    if landmarks_arr.shape[0] < TOTAL_LANDMARKS:
        raise ValueError(
            f"Esperado {TOTAL_LANDMARKS} landmarks, recebidos {landmarks_arr.shape[0]}"
        )
    landmarks: Landmarks = [tuple(map(int, pt)) for pt in landmarks_arr]

    os.makedirs(output_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(frame.source_path))[0]

    # Camada A
    img_sym = symmetrize(img, landmarks)

    # Camada B
    img_prop = annotate_ideal_proportions(img, landmarks)

    # Grid de comparação (1×3)
    h, w = img.shape[:2]
    label_h = 28
    grid_h = h + label_h
    grid = np.zeros((grid_h, w * 3, 3), dtype=np.uint8)

    # Colunas
    grid[label_h:, 0:w] = img
    grid[label_h:, w : w * 2] = img_sym
    grid[label_h:, w * 2 : w * 3] = img_prop

    # Labels de coluna
    for i, col_label in enumerate(["Original", "Simetrizado", "Proporcoes Ideais"]):
        x_center = w * i + w // 2 - len(col_label) * 4
        cv2.rectangle(grid, (w * i, 0), (w * (i + 1), label_h), (30, 30, 30), -1)
        cv2.putText(
            grid, col_label, (w * i + 8, 20),
            _FONT, 0.55, _WHITE, 1, cv2.LINE_AA,
        )

    # Salvar — inclui a foto canônica como referência (foto base usada na análise)
    path_canonical = os.path.join(output_dir, f"{base}_canonical.jpg")
    path_sym = os.path.join(output_dir, f"{base}_symmetrized.jpg")
    path_prop = os.path.join(output_dir, f"{base}_ideal_proportions.jpg")
    path_grid = os.path.join(output_dir, f"{base}_comparison_grid.jpg")

    cv2.imwrite(path_canonical, img)
    cv2.imwrite(path_sym, img_sym)
    cv2.imwrite(path_prop, img_prop)
    cv2.imwrite(path_grid, grid)

    return {
        "canonical": path_canonical,
        "symmetrized": path_sym,
        "ideal_proportions": path_prop,
        "comparison_grid": path_grid,
    }
