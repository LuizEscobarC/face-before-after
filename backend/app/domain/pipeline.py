#!/usr/bin/env python3
"""
MVP Pipeline — Produto de Entrada (Pay-per-use)

Recebe uma foto, roda análise de assimetria facial e gera:
  - Score de simetria (0–100, quanto maior melhor)
  - % do potencial visual já aproveitado
  - Insight principal: a única mudança com maior alavanca
  - 3 ações priorizadas por impacto
  - Relatório compartilhável em TXT e JSON

Uso:
  python mvp_pipeline.py foto.jpg
  python mvp_pipeline.py foto.jpg --output-dir resultado_mvp/
"""

import argparse
import json
import os
import sys
from datetime import datetime
from typing import Any, Dict, List

import cv2
import numpy as np

from app.domain.canonical_frame import CanonicalFrame
from app.domain.face_asymmetry import FaceAsymmetryAnalyzer
from app.domain.landmarks_mesh import LM_LEFT_EYE, LM_RIGHT_EYE
import app.domain.face_metrics as fm
from app.domain.layers.impression import build_first_impression
from app.domain.layers.visual_status import build_visual_status
from app.domain.layers.top_leverage import get_top_leverage_recommendation, get_top3_actions
from app.domain.layers.evolution_path import build_evolution_path
from app.domain.simulate import simulate as simulate_before_after
import app.domain.layers.recommendations as rec


# ============================================================================
# CONFIGURAÇÃO DE MÉTRICAS E LIMITES
# ============================================================================

# Peso de cada métrica na geração do insight principal
METRIC_WEIGHTS = {
    'nose_deviation_px':           2.0,
    'chin_deviation_px':           1.5,
    'mouth_center_deviation_px':   1.5,
    'jawline_mean_asymmetry_px':   1.2,
    'eye_level_difference_px':     1.0,
    'eye_horizontal_asymmetry_px': 1.0,
    'mouth_corners_asymmetry_px':  1.0,
    'nose_wings_asymmetry_px':     0.8,
}

# Recomendações associadas a cada métrica
METRIC_RECOMMENDATIONS = {
    'nose_deviation_px': (
        "Alinhamento da postura ao tirar fotos",
        "O desvio da ponta do nariz é amplificado por inclinação da cabeça. "
        "Fotografar com o queixo ligeiramente para baixo e a câmera na altura dos olhos "
        "reduz esse efeito visivelmente."
    ),
    'chin_deviation_px': (
        "Posicionamento do queixo na foto",
        "O queixo desviado da linha central é um dos fatores que mais reduz a "
        "percepção de simetria. Praticar posicionamento frontal neutro "
        "aumenta o impacto visual imediatamente."
    ),
    'mouth_center_deviation_px': (
        "Expressão e relaxamento labial",
        "O centro do lábio superior desvia quando há tensão assimétrica nos músculos "
        "faciais. Expressão neutra ou sorriso leve e simétrico é a mudança de maior "
        "alavanca nesse ponto."
    ),
    'jawline_mean_asymmetry_px': (
        "Ângulo facial na foto",
        "A assimetria da mandíbula é visualmente reduzida quando o ângulo da câmera "
        "é frontal e levemente acima do queixo. Evitar ângulos laterais em fotos de perfil."
    ),
    'eye_level_difference_px': (
        "Correção da inclinação da cabeça",
        "O desnível entre os olhos é majoritariamente causado por inclinação da cabeça. "
        "Manter a cabeça reta e os ombros paralelos reduz esse efeito sem nenhum esforço físico."
    ),
    'eye_horizontal_asymmetry_px': (
        "Posicionamento simétrico dos olhos na câmera",
        "A assimetria horizontal dos olhos aparece mais em fotos com iluminação lateral "
        "ou câmera fora do eixo central. Centralizar a câmera e usar luz frontal resolve "
        "grande parte desse ponto."
    ),
    'mouth_corners_asymmetry_px': (
        "Sorriso e expressão equilibrada",
        "Os cantos da boca em alturas diferentes reduzem a percepção de simetria. "
        "Um sorriso leve, consciente e equilibrado é a mudança mais rápida de implementar."
    ),
    'nose_wings_asymmetry_px': (
        "Iluminação frontal e simétrica",
        "A assimetria das asas do nariz é amplificada por iluminação lateral. "
        "Luz frontal difusa, como luz natural de frente, minimiza esse efeito visualmente."
    ),
}

# Faixas de score para classificação
SCORE_TIERS = [
    (90, "Excelente", "Sua simetria facial está no nível de quem é percebido como muito atraente em fotos."),
    (75, "Muito boa", "Você já tem uma base forte. Pequenos ajustes aumentam ainda mais sua presença."),
    (60, "Boa",       "Há espaço claro para crescer. A melhora principal muda como você é percebido."),
    (45, "Regular",   "Existe oportunidade visível. Com a mudança certa, o ganho é imediato."),
    (0,  "Baixa",     "Há potencial real a ser desbloqueado. O ajuste principal faz grande diferença."),
]

# Score máximo de assimetria esperado para calibrar o inverso (em px, empiricamente)
MAX_ASYMMETRY_REFERENCE = 15.0  # % IPD — referência: > 15% = assimetria severa

_LABEL_OVERRIDES = {
    "overall_asymmetry_score": "Score global de assimetria",
    "overall_asymmetry_score_pct_ipd": "Score global (% IPD)",
    "jawline_definition_score": "Definição da linha mandibular",
    "canthal_tilt_mean_deg": "Canthal tilt médio",
    "fwhr": "fWHR",
    "face_shape_label": "Formato facial",
    "frontal_ok": "Captura frontal dentro do limite",
    "lighting_asymmetry_delta_e": "Assimetria de iluminação (ΔE)",
    "skin_uniformity_std_lab_left": "Uniformidade da pele (esquerda)",
    "skin_uniformity_std_lab_right": "Uniformidade da pele (direita)",
    "under_eye_darkness_left": "Olheira (esquerda)",
    "under_eye_darkness_right": "Olheira (direita)",
}

_STRUCTURAL_HINTS = (
    "gonial",
    "jaw_width",
    "bizygomatic",
    "bigonial",
    "fwhr",
    "face_shape",
    "zygomatic_to_gonial",
)

AUTO_CROP_MIN_EYE_RATIO = 0.23
AUTO_CROP_TARGET_EYE_RATIO = 0.33
AUTO_CROP_EYE_LINE_Y_RATIO = 0.38
AUTO_CROP_RATIO_W = 3.0
AUTO_CROP_RATIO_H = 4.0


def resolve_input_image_path(image_path: str) -> str:
    """Resolve caminho de imagem aceitando PNG/JPG/JPEG mesmo sem extensão."""
    if os.path.exists(image_path):
        return image_path

    root, ext = os.path.splitext(image_path)
    if ext:
        for candidate_ext in (".png", ".jpg", ".jpeg", ".PNG", ".JPG", ".JPEG"):
            candidate = f"{root}{candidate_ext}"
            if os.path.exists(candidate):
                return candidate
        return image_path

    for candidate_ext in (".png", ".jpg", ".jpeg", ".PNG", ".JPG", ".JPEG"):
        candidate = f"{root}{candidate_ext}"
        if os.path.exists(candidate):
            return candidate

    return image_path


def _enforce_aspect_ratio(image: np.ndarray, ratio_w: float, ratio_h: float) -> np.ndarray:
    """Recorta centralmente para manter proporção desejada (ex.: 3x4)."""
    h, w = image.shape[:2]
    if h <= 0 or w <= 0:
        return image

    target_ratio = ratio_w / ratio_h
    current_ratio = w / float(h)

    if abs(current_ratio - target_ratio) < 1e-3:
        return image

    if current_ratio > target_ratio:
        new_w = int(round(h * target_ratio))
        if new_w <= 0 or new_w > w:
            return image
        x0 = max(0, (w - new_w) // 2)
        return image[:, x0:x0 + new_w]

    new_h = int(round(w / target_ratio))
    if new_h <= 0 or new_h > h:
        return image
    y0 = max(0, (h - new_h) // 2)
    return image[y0:y0 + new_h, :]


def maybe_auto_crop_3x4(image: np.ndarray, landmarks: np.ndarray) -> tuple[np.ndarray, Dict[str, Any]]:
    """Aplica auto-corte 3x4 quando o rosto está muito distante no quadro.

    Usa distância entre os olhos como proxy de escala do rosto.
    """
    h, w = image.shape[:2]
    left_eye = landmarks[LM_LEFT_EYE].mean(axis=0)
    right_eye = landmarks[LM_RIGHT_EYE].mean(axis=0)
    eye_distance = float(np.linalg.norm(right_eye - left_eye))

    if eye_distance <= 1.0:
        return image, {
            "applied": False,
            "reason": "eye-distance-invalid",
            "eye_ratio_before": 0.0,
            "target_ratio": "3:4",
        }

    eye_ratio = eye_distance / float(max(w, 1))
    # Decisão aprovada: sempre força crop para enquadramento canônico — mesmo
    # quando o rosto já está bem enquadrado. Garante que TODOS os pipelines
    # rodem sobre uma imagem com escala/posição comparáveis entre runs.
    crop_w = eye_distance / AUTO_CROP_TARGET_EYE_RATIO
    crop_h = crop_w * (AUTO_CROP_RATIO_H / AUTO_CROP_RATIO_W)
    eye_center = (left_eye + right_eye) / 2.0

    x1 = int(round(eye_center[0] - crop_w / 2.0))
    y1 = int(round(eye_center[1] - crop_h * AUTO_CROP_EYE_LINE_Y_RATIO))
    x2 = int(round(x1 + crop_w))
    y2 = int(round(y1 + crop_h))

    # Clampa por deslocamento para manter caixa inteira dentro da imagem
    if x1 < 0:
        x2 -= x1
        x1 = 0
    if y1 < 0:
        y2 -= y1
        y1 = 0
    if x2 > w:
        shift = x2 - w
        x1 = max(0, x1 - shift)
        x2 = w
    if y2 > h:
        shift = y2 - h
        y1 = max(0, y1 - shift)
        y2 = h

    if x2 <= x1 or y2 <= y1:
        return image, {
            "applied": False,
            "reason": "crop-invalid-bounds",
            "eye_ratio_before": round(eye_ratio, 3),
            "target_ratio": "3:4",
        }

    cropped = image[y1:y2, x1:x2].copy()
    if cropped.size == 0:
        return image, {
            "applied": False,
            "reason": "crop-empty",
            "eye_ratio_before": round(eye_ratio, 3),
            "target_ratio": "3:4",
        }

    cropped = _enforce_aspect_ratio(cropped, AUTO_CROP_RATIO_W, AUTO_CROP_RATIO_H)
    eye_ratio_after = eye_distance / float(max(cropped.shape[1], 1))

    return cropped, {
        "applied": True,
        "reason": "face-far-auto-cropped",
        "eye_ratio_before": round(eye_ratio, 3),
        "eye_ratio_after": round(eye_ratio_after, 3),
        "target_ratio": "3:4",
        "crop_bbox": [int(x1), int(y1), int(x2), int(y2)],
    }


def _metric_label(key: str) -> str:
    if key in _LABEL_OVERRIDES:
        return _LABEL_OVERRIDES[key]
    return key.replace("_", " ").strip().capitalize()


def _metric_unit(key: str, value: Any) -> str:
    if isinstance(value, bool):
        return "boolean"
    if key.endswith("_deg"):
        return "°"
    if key.endswith("_px"):
        return "px"
    if key.endswith("_pct_ipd") or key.endswith("_pct_face_height") or key.endswith("_pct"):
        return "%"
    if key.endswith("_ratio"):
        return "razão"
    if key in {"score", "dominance_score", "attractiveness_score", "freshness_score"}:
        return "0-10"
    return ""


def _display_value(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, bool):
        return "sim" if value else "não"
    if isinstance(value, (int, float)):
        return f"{float(value):.3f}".rstrip("0").rstrip(".")
    return str(value)


def _metric_class(key: str, source_block: str) -> str:
    if source_block == "photo_quality":
        return "captura"
    if source_block == "skin":
        return "mutável"
    if any(token in key for token in _STRUCTURAL_HINTS):
        return "estrutural"
    if source_block == "derived":
        return "derivada"
    return "mutável"


def _ideal_string(key: str) -> str:
    ideal_dict = getattr(fm, "ADVANCED_IDEALS", {})
    if key not in ideal_dict:
        return ""
    ideal, tol = ideal_dict[key]
    return f"{ideal:g} ± {tol:g}"


def build_premium_metrics_catalog(
    measurements: Dict[str, Any],
    measurements_blocks: Dict[str, Any],
    score: int,
    capture_confidence: float,
    visual_status_data: Dict[str, Any],
    top_leverage: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Monta catálogo completo de métricas para o relatório premium."""
    blocks = measurements_blocks or {}
    advanced_keys = set((blocks.get("advanced") or {}).keys())
    skin_keys = set((blocks.get("skin") or {}).keys())
    capture_keys = set((blocks.get("photo_quality") or {}).keys())

    buckets = {
        "asymmetry": {
            "slug": "asymmetry",
            "title": "Assimetria e Simetria",
            "metrics": [],
        },
        "advanced": {
            "slug": "advanced",
            "title": "Proporções e Estrutura",
            "metrics": [],
        },
        "skin": {
            "slug": "skin",
            "title": "Pele e Olheiras",
            "metrics": [],
        },
        "capture": {
            "slug": "capture",
            "title": "Qualidade da Captura",
            "metrics": [],
        },
        "derived": {
            "slug": "derived",
            "title": "Percepção e Produto",
            "metrics": [],
        },
    }

    for key in sorted(measurements.keys()):
        value = measurements.get(key)
        if key in skin_keys:
            bucket_key = "skin"
            source = "skin"
        elif key in capture_keys:
            bucket_key = "capture"
            source = "photo_quality"
        elif key in advanced_keys:
            bucket_key = "advanced"
            source = "advanced"
        else:
            bucket_key = "asymmetry"
            source = "asymmetry"

        ideal = _ideal_string(key)
        severity = "informativa"
        if ideal and isinstance(value, (int, float)):
            severity = fm.severity_for(key, float(value))

        buckets[bucket_key]["metrics"].append({
            "key": key,
            "label": _metric_label(key),
            "value": value,
            "display_value": _display_value(value),
            "unit": _metric_unit(key, value),
            "ideal": ideal,
            "severity": severity,
            "metric_class": _metric_class(key, source),
            "source_block": source,
        })

    derived = [
        ("score", "Score final", score, "0-100"),
        ("capture_confidence", "Confiança da captura", capture_confidence, "0-1"),
        (
            "dominance_score",
            "Dominância percebida",
            visual_status_data.get("dominance_score"),
            "0-10",
        ),
        (
            "attractiveness_score",
            "Atratividade percebida",
            visual_status_data.get("attractiveness_score"),
            "0-10",
        ),
        (
            "freshness_score",
            "Vitalidade percebida",
            visual_status_data.get("freshness_score"),
            "0-10",
        ),
        (
            "top_leverage_confidence",
            "Confiança da principal alavanca",
            (top_leverage or {}).get("confidence_score"),
            "0-1",
        ),
    ]

    for key, label, value, unit in derived:
        if value is None:
            continue
        buckets["derived"]["metrics"].append({
            "key": key,
            "label": label,
            "value": value,
            "display_value": _display_value(value),
            "unit": unit,
            "ideal": "",
            "severity": "informativa",
            "metric_class": _metric_class(key, "derived"),
            "source_block": "derived",
        })

    output = []
    for key in ("asymmetry", "advanced", "skin", "capture", "derived"):
        bucket = buckets[key]
        metrics = bucket["metrics"]
        if not metrics:
            continue
        metrics.sort(key=lambda item: item["label"])
        output.append({
            "slug": bucket["slug"],
            "title": bucket["title"],
            "count": len(metrics),
            "metrics": metrics,
        })

    return output


# ============================================================================
# CÁLCULOS DE SCORE E INSIGHTS
# ============================================================================

def asymmetry_to_score(overall_pct_ipd: float | None) -> int:
    """Converte assimetria (% IPD, menor = melhor) para score 0–100 (maior = melhor).

    Aceita None (medição inválida) e devolve 0 — sinaliza ausência de dado
    válido no payload sem crashar o pipeline.
    """
    if overall_pct_ipd is None:
        return 0
    clamped = min(overall_pct_ipd, MAX_ASYMMETRY_REFERENCE)
    score = int(round((1.0 - clamped / MAX_ASYMMETRY_REFERENCE) * 100))
    return max(0, min(100, score))


def get_score_tier(score: int) -> tuple:
    for threshold, label, description in SCORE_TIERS:
        if score >= threshold:
            return label, description
    return SCORE_TIERS[-1][1], SCORE_TIERS[-1][2]


def get_top_insights(measurements: dict, top_n: int = 3) -> list:
    """Retorna as métricas mais impactantes ordenadas por peso × valor.

    Mantido para diagnóstico interno/debug. A priorização oficial do produto
    usa top_leverage + top3_actions_v2.
    """
    scored = []
    for metric, weight in METRIC_WEIGHTS.items():
        value = measurements.get(metric, 0.0)
        impact = value * weight
        short_name, detail = METRIC_RECOMMENDATIONS.get(metric, (metric, ""))
        scored.append({
            'metric': metric,
            'value_px': value,
            'impact': round(impact, 2),
            'short_name': short_name,
            'detail': detail,
        })
    scored.sort(key=lambda x: x['impact'], reverse=True)
    return scored[:top_n]


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def compute_capture_confidence(photo_quality: Dict[str, Any]) -> float:
    """Estima confiança da captura [0, 1] a partir da qualidade da foto.

    Combina frontalidade, nitidez, iluminação e distorção de lente para
    controlar o quanto as recomendações devem ser interpretadas como confiáveis.
    """
    frontal_score = 1.0 if photo_quality.get("frontal_ok", False) else 0.35

    sharpness = float(photo_quality.get("sharpness_laplacian_var", 0.0))
    sharpness_score = _clamp01((sharpness - 40.0) / 140.0)

    lighting_delta = float(photo_quality.get("lighting_asymmetry_delta_e", 99.0))
    lighting_score = _clamp01((22.0 - lighting_delta) / 16.0)

    focal_warn = bool(photo_quality.get("focal_distortion_warning", False))
    focal_score = 0.55 if focal_warn else 1.0

    confidence = (
        frontal_score * 0.45
        + sharpness_score * 0.25
        + lighting_score * 0.20
        + focal_score * 0.10
    )
    return round(_clamp01(confidence), 3)


def build_capture_recommendations(photo_quality: Dict[str, Any]) -> list:
    """Gera orientações de captura em linguagem de benefício a partir da qualidade da foto.

    Cada item: {"area": str, "tip": str}
    Retorna lista vazia quando a foto está dentro dos parâmetros ideais.
    """
    tips = []

    frontal_ok = bool(photo_quality.get("frontal_ok", True))
    yaw = abs(float(photo_quality.get("head_pose_yaw_deg", 0.0)))
    pitch = abs(float(photo_quality.get("head_pose_pitch_deg", 0.0)))

    if not frontal_ok:
        if pitch > 7.0:
            direction = "para baixo" if float(photo_quality.get("head_pose_pitch_deg", 0.0)) > 0 else "para cima"
            tips.append({
                "area": "enquadramento",
                "tip": (
                    f"Incline levemente a cabeça {direction} — o ângulo vertical atual "
                    f"({pitch:.0f}°) reduz a precisão da análise e da simulação."
                ),
            })
        if yaw > 7.0:
            direction = "esquerda" if float(photo_quality.get("head_pose_yaw_deg", 0.0)) > 0 else "direita"
            tips.append({
                "area": "enquadramento",
                "tip": (
                    f"Gire levemente a cabeça para a {direction} até ficar frontal — "
                    f"o desvio lateral ({yaw:.0f}°) distorce as medidas de simetria."
                ),
            })

    lighting_delta = float(photo_quality.get("lighting_asymmetry_delta_e", 0.0))
    if lighting_delta > 12.0:
        tips.append({
            "area": "iluminação",
            "tip": (
                "Use luz frontal e difusa (ex.: janela na sua frente) — "
                "a iluminação atual está mais forte de um lado, o que afeta "
                "a leitura de pele e simetria."
            ),
        })

    sharpness = float(photo_quality.get("sharpness_laplacian_var", 999.0))
    if sharpness < 80.0:
        tips.append({
            "area": "nitidez",
            "tip": (
                "Apoie o celular ou segure firme ao tirar a foto — "
                "a imagem está com movimento ou foco insuficiente, "
                "o que reduz a precisão da análise."
            ),
        })

    focal_warn = bool(photo_quality.get("focal_distortion_warning", False))
    if focal_warn:
        tips.append({
            "area": "distância",
            "tip": (
                "Aumente a distância da câmera para pelo menos 50 cm — "
                "fotos muito próximas (selfie) distorcem as proporções do nariz "
                "e alteram os resultados de proporção."
            ),
        })

    face_w = int(photo_quality.get("face_pixel_width", 999))
    if face_w < 200:
        tips.append({
            "area": "resolução",
            "tip": (
                "Use uma foto com o rosto mais próximo ou em resolução maior — "
                "o rosto está pequeno na imagem, o que limita a precisão das medições."
            ),
        })

    return tips


def _get_score_context(score: int, tier: str) -> dict:
    """Retorna benchmark_message e score_context hardcoded por tier."""
    if score >= 90:
        return {
            "benchmark_message": "Resultado excepcional — harmonia facial acima de 95% das análises.",
            "score_context": "Sua análise está entre os 5% com maior harmonia facial.",
        }
    if score >= 80:
        return {
            "benchmark_message": "Você já está acima da média — e os ajustes certos ampliam ainda mais o impacto.",
            "score_context": "Resultado entre os 20% melhores que analisamos.",
        }
    if score >= 60:
        return {
            "benchmark_message": "Base sólida. Dois ajustes específicos mudam o jogo completamente.",
            "score_context": "Resultado acima de 55% dos rostos analisados.",
        }
    return {
        "benchmark_message": "O diagnóstico revelou oportunidades concretas — cada ponto tem ação clara.",
        "score_context": "Análise com múltiplos pontos de melhoria — situação comum e reversível.",
    }


def build_next_step(
    score: int,
    evolution_path: Dict[str, Any],
    top_leverage: Dict[str, Any],
) -> Dict[str, str]:
    """Gera chamada de próximo passo sem quebrar o fluxo de desejo."""
    if score >= 80:
        profile = "alto"
        message = (
            "Seu ativo visual já está acima da média. O próximo passo é ver o antes/depois e refinar."
        )
        action = "Visualizar simulação antes/depois + reanálise em 30 dias"
        cta_text = "Ver minha simulação antes/depois"
        cta_type = "simulacao"
    elif score >= 60:
        profile = "medio"
        message = (
            "A mudança principal está identificada. Sete dias já são suficientes para notar a diferença."
        )
        action = "Análise completa com simulação visual e plano de 30 dias"
        cta_text = "Começar o plano de 7 dias"
        cta_type = "plano_7d"
    else:
        profile = "baixo"
        message = (
            "Existe potencial real. O ajuste principal é acessível e começa hoje."
        )
        action = "Análise completa com acompanhamento de 3 meses e checkpoints"
        cta_text = "Quero entender meus 3 pontos de melhoria"
        cta_type = "detalhamento"

    if profile == "alto":
        urgency_hook = "Você já tem a base. A simulação mostra exatamente o que muda."
    else:
        urgency_hook = ""
        phase_1_actions = evolution_path.get("phase_1", {}).get("actions", [])
        if phase_1_actions:
            first_action = phase_1_actions[0].get("titulo", "")
            if first_action:
                urgency_hook = f"Você pode começar com \u2018{first_action}\u2019 ainda hoje."

        leverage_text = top_leverage.get("short_action", "")
        if leverage_text and not urgency_hook:
            urgency_hook = f"Sua maior alavanca agora é: {leverage_text}."

    return {
        "profile": profile,
        "message": message,
        "action": action,
        "cta_text": cta_text,
        "cta_type": cta_type,
        "urgency_hook": urgency_hook,
    }


# ============================================================================
# GERAÇÃO DO RELATÓRIO COMPARTILHÁVEL
# ============================================================================


def _capture_confidence_label(confidence: float) -> str:
    if confidence >= 0.80:
        return "boa"
    if confidence >= 0.60:
        return "aceitável — resultados confiáveis"
    return "limitada — recomendamos nova foto"


def build_shareable_report(
    image_path: str,
    score: int,
    tier_label: str,
    tier_description: str,
    first_impression: Dict[str, Any],
    visual_status_data: Dict[str, Any],
    top_leverage: Dict[str, Any],
    top_actions: list,
    evolution: Dict[str, Any],
    next_step: Dict[str, Any],
    capture_confidence: float,
    capture_recommendations: list,
    rotation_deg: float,
    simulation_paths: dict = None,
    simulation_error: str = None,
    benchmark_message: str = "",
    score_context: str = "",
    key_metric_insight: str = "",
    analysis_mode: str = "premium",
    premium_metrics_catalog: list = None,
    auto_crop_data: Dict[str, Any] = None,
) -> str:
    now = datetime.now().strftime('%d/%m/%Y %H:%M')
    width = 60
    sep = '─' * width

    if analysis_mode == "teaser":
        lines = [
            "",
            "═" * width,
            "  ANÁLISE GRATUITA — TEASER",
            f"  {now}",
            "═" * width,
            "",
            f"  📸 Foto analisada : {os.path.basename(image_path)}",
            "",
            sep,
            "  SCORE DE SIMETRIA FACIAL",
            sep,
            f"  {score} / 100  —  {tier_label}",
            f"  {tier_description}",
            "",
            f"  Confiança da captura : {int(round(capture_confidence * 100))}%  ({_capture_confidence_label(capture_confidence)})",
        ]

        if auto_crop_data:
            crop_status = "aplicado" if auto_crop_data.get("applied") else "não necessário"
            lines.insert(7, f"  ✂️ Enquadramento 3x4 automático : {crop_status}")

        if score_context:
            lines.append(f"  Contexto: {score_context}")
        if benchmark_message:
            lines += ["", f"  {benchmark_message}"]
        if key_metric_insight:
            lines += ["", f"  🔍 {key_metric_insight}"]

        lines += [
            "",
            sep,
            "  PRIMEIRA IMPRESSÃO",
            sep,
            f"  {first_impression.get('headline', '')}",
            "",
        ]

        if top_leverage:
            lines += [
                sep,
                "  SUA MAIOR ALAVANCA AGORA",
                sep,
                f"  {top_leverage.get('short_action', '')}",
                f"  {top_leverage.get('why_it_matters', '')}",
                "",
            ]

        lines += [
            sep,
            "  PROXIMO PASSO",
            sep,
            f"  {next_step.get('message', '')}",
            "",
            f"  {next_step.get('urgency_hook', '')}",
            "",
            f"  [{next_step.get('cta_text', 'Desbloquear análise premium completa')}]",
            "",
            "  🔒 Premium desbloqueia:",
            "  - Todas as métricas avançadas e comparativos",
            "  - Simulação visual completa",
            "  - Plano em 3 fases com prioridades",
            "",
            "═" * width,
            "  Face Before/After — Análise de Presença Visual",
            "═" * width,
            "",
        ]
        return "\n".join(lines)

    lines = [
        '',
        '═' * width,
        f"  ANÁLISE DE PRESENÇA VISUAL FACIAL",
        f"  {now}",
        '═' * width,
        '',
        f"  📸 Foto analisada : {os.path.basename(image_path)}",
        f"  🔄 Correção de rotação aplicada : {rotation_deg:.1f}°",
        '',
        sep,
        f"  SCORE DE SIMETRIA FACIAL",
        sep,
        f"  {score} / 100  —  {tier_label}",
        f"  {tier_description}",
        '',
        f"  Confiança da captura : {int(round(capture_confidence * 100))}%  ({_capture_confidence_label(capture_confidence)})",
    ]

    if auto_crop_data:
        crop_status = "aplicado" if auto_crop_data.get("applied") else "não necessário"
        lines.insert(8, f"  ✂️ Enquadramento 3x4 automático : {crop_status}")

    if score_context:
        lines.append(f"  Contexto: {score_context}")
    if benchmark_message:
        lines += ['', f"  {benchmark_message}"]
    if key_metric_insight:
        lines += ['', f"  🔍 {key_metric_insight}"]

    lines += [
        '',
        sep,
        f"  💬 DIAGNOSTICO DA PRIMEIRA IMPRESSAO",
        sep,
        f"  {first_impression.get('headline', '')}",
        '',
        '',
        sep,
        f"  📈 LEITURA DE STATUS VISUAL",
        sep,
        f"  Dominancia    : {visual_status_data.get('dominance_score', 0):.1f}/10",
        f"  Atratividade  : {visual_status_data.get('attractiveness_score', 0):.1f}/10",
        f"  Cuidado/Frescor: {visual_status_data.get('freshness_score', 0):.1f}/10",
        '',
        f"  {visual_status_data.get('narrative', '')}",
        '',
        sep,
        f"  🎯 ALAVANCA PRINCIPAL",
        sep,
    ]

    if evolution.get("skin_alert"):
        lines += [
            f"  Estrutural  : {top_leverage.get('short_action', '')}",
            f"  Hábito urgente: SPF 30+ diariamente + hidratante noturno",
            '',
            f"  Por que importa: {top_leverage.get('why_it_matters', '')}",
            f"  Tempo estrutural: {top_leverage.get('time_to_result', 'semanas')}",
            '',
        ]
    else:
        lines += [
            f"  {top_leverage.get('short_action', '')}",
            '',
            f"  Por que isso importa: {top_leverage.get('why_it_matters', '')}",
            f"  Tempo esperado: {top_leverage.get('time_to_result', 'semanas')}",
            '',
        ]

    # Aviso de captura ANTES das 3 ações quando confiança baixa
    if capture_recommendations and capture_confidence < 0.60:
        lines += [
            sep,
            f"  ⚠️  ANTES DE AGIR, MELHORE A CAPTURA:",
            sep,
        ]
        for tip in capture_recommendations:
            lines += [
                f"  [{tip['area'].upper()}] {tip['tip']}",
                '',
            ]
        lines += [
            "  Uma foto em melhores condições pode mudar completamente as recomendações.",
            '',
        ]

    actions_header = "✨ 3 REFINAMENTOS DE ALTO IMPACTO" if score >= 80 else "✅ 3 ACOES PRIORIZADAS"
    lines += [
        sep,
        f"  {actions_header}",
        sep,
    ]

    for item in top_actions:
        lines += [
            f"  {item['rank']}. {item['short_action']}",
            f"     {item['why_it_matters']}",
            f"     Tempo: {item['time_to_result']}",
            '',
        ]

    phase_1 = evolution.get("phase_1", {})
    phase_2 = evolution.get("phase_2", {})
    phase_3 = evolution.get("phase_3", {})
    ph1_conf = phase_1.get("confidence_label", "")
    ph2_conf = phase_2.get("confidence_label", "")
    ph3_conf = phase_3.get("confidence_label", "")

    lines += [
        sep,
        f"  🧭 CAMINHO CURTO DE EVOLUCAO",
        sep,
        f"  {phase_1.get('label', '0-7 dias')} [{ph1_conf}]: {phase_1.get('focus', '')}",
        f"  {phase_2.get('label', '7-30 dias')} [{ph2_conf}]: {phase_2.get('focus', '')}",
        f"  {phase_3.get('label', '30-90 dias')} [{ph3_conf}]: {phase_3.get('focus', '')}",
        '',
    ]

    if ph3_conf == "desafiador" or evolution.get("skin_alert", False):
        _alert_parts = []
        if ph3_conf == "desafiador":
            _alert_parts.append("a fase de 3 meses provavelmente requer acompanhamento profissional")
        if evolution.get("skin_alert", False):
            _alert_parts.append("pele e olheiras estão no nível de maior impacto visual — a 1ª ação da semana já trata isso")
        lines += [
            f"  ⚠️  {'; '.join(_alert_parts).capitalize()}.",
            '',
        ]

    if simulation_paths:
        lines += [
            sep,
            f"  📸 VISUALIZACOES GERADAS",
            sep,
            f"  → {os.path.basename(simulation_paths.get('symmetrized', ''))}",
            f"     Como você ficaria com a assimetria zerada",
            '',
            f"  → {os.path.basename(simulation_paths.get('ideal_proportions', ''))}",
            f"     Proporções ideais sobrepostas — referência dos ajustes possíveis",
            '',
            f"  → {os.path.basename(simulation_paths.get('comparison_grid', ''))}",
            f"     Grade comparativa: atual vs. projeção lado a lado",
            '',
        ]
    elif simulation_error:
        lines += [
            '',
            f"  (simulação visual não gerada: {simulation_error})",
            '',
        ]

    if premium_metrics_catalog:
        lines += [
            sep,
            "  📚 CATALOGO PREMIUM DE METRICAS",
            sep,
        ]
        for category in premium_metrics_catalog:
            lines.append(
                f"  {category.get('title', 'Categoria')}: {category.get('count', 0)} métricas"
            )
        lines += [
            "",
            "  (Veja o HTML premium para detalhes completos de cada métrica)",
            "",
        ]

    # Quando simulação já foi exibida acima, mudar CTA para evitar contradição
    _cta_display = next_step.get('cta_text', '')
    if simulation_paths and next_step.get('cta_type') == 'simulacao':
        _cta_display = "Começar meu plano de refinamento — reanálise em 30 dias"

    lines += [
        sep,
        f"  ➜ PROXIMO PASSO",
        sep,
        f"  {next_step.get('message', '')}",
        '',
        f"  {next_step.get('urgency_hook', '')}",
        '',
        f"  [{_cta_display}]",
        '',
    ]

    # Aviso de captura no final quando confiança OK (posição discreta)
    if capture_recommendations and capture_confidence >= 0.60:
        lines += [
            sep,
            f"  📷 PARA MELHORAR A PROXIMA ANALISE",
            sep,
        ]
        for tip in capture_recommendations:
            lines += [
                f"  [{tip['area'].upper()}] {tip['tip']}",
                '',
            ]

    lines += [
        '',
        '═' * width,
        f"  Face Before/After — Análise de Presença Visual",
        '═' * width,
        '',
    ]

    return '\n'.join(lines)


# ============================================================================
# PIPELINE PRINCIPAL
# ============================================================================

def run(image_path: str, output_dir: str, mode: str = "premium") -> dict:
    os.makedirs(output_dir, exist_ok=True)
    analysis_mode = str(mode or "premium").strip().lower()
    if analysis_mode not in {"teaser", "premium"}:
        print(f"[ERRO] Modo inválido: {mode}. Use teaser ou premium.", file=sys.stderr)
        sys.exit(1)

    resolved_image_path = resolve_input_image_path(image_path)

    # 1. Carregar imagem
    original_img = cv2.imread(resolved_image_path)
    if original_img is None:
        print(
            f"[ERRO] Não foi possível carregar a imagem: {image_path} (resolvido: {resolved_image_path})",
            file=sys.stderr,
        )
        sys.exit(1)

    # 2. Pré-processar enquadramento — sempre crop+align para canonicalizar.
    analyzer = FaceAsymmetryAnalyzer()
    original_face_rect = analyzer.detect_face(original_img)
    if original_face_rect is None:
        print("[ERRO] Nenhum rosto detectado na imagem.", file=sys.stderr)
        sys.exit(1)

    original_landmarks = analyzer.detect_landmarks(original_img, original_face_rect)

    # 2a. Crop 3x4 sempre (decisão aprovada). Re-detecta face no recorte.
    cropped_img, auto_crop_data = maybe_auto_crop_3x4(original_img, original_landmarks)
    if auto_crop_data.get("applied"):
        recropped_face = analyzer.detect_face(cropped_img)
        if recropped_face is None:
            # Detecção falhou no crop — fallback para original (caso degenerado).
            cropped_img = original_img
            cropped_face = original_face_rect
            cropped_landmarks = original_landmarks
            auto_crop_data = {
                **auto_crop_data,
                "applied": False,
                "reason": "crop-fallback-no-face",
            }
        else:
            cropped_face = recropped_face
            cropped_landmarks = analyzer.detect_landmarks(cropped_img, cropped_face)
    else:
        cropped_face = original_face_rect
        cropped_landmarks = original_landmarks

    # 2b. Alinha (rotação Frankfort) — gera a imagem CANÔNICA usada por TUDO.
    aligned_img, rotation_matrix = analyzer.align_face(cropped_img, cropped_landmarks)
    aligned_landmarks = analyzer.transform_landmarks(cropped_landmarks, rotation_matrix)

    # Re-detecta face_rect no espaço alinhado para que face_pixel_width esteja
    # correto no mesmo sistema de coordenadas dos landmarks.
    aligned_face_rect = analyzer.detect_face(aligned_img) or cropped_face

    # 2c. Constrói o frame canônico — única fonte de verdade daqui para frente.
    ipd_px = float(np.linalg.norm(
        aligned_landmarks[LM_RIGHT_EYE].mean(axis=0)
        - aligned_landmarks[LM_LEFT_EYE].mean(axis=0)
    ))
    # Convert FaceDetectionResult bbox (or fall back to landmarks extent) to (x,y,w,h).
    if aligned_face_rect is not None and getattr(aligned_face_rect, "bbox", None):
        face_rect_tuple = tuple(int(v) for v in aligned_face_rect.bbox)
    else:
        x_min = int(np.min(aligned_landmarks[:, 0]))
        y_min = int(np.min(aligned_landmarks[:, 1]))
        x_max = int(np.max(aligned_landmarks[:, 0]))
        y_max = int(np.max(aligned_landmarks[:, 1]))
        face_rect_tuple = (x_min, y_min, max(0, x_max - x_min), max(0, y_max - y_min))
    canonical = CanonicalFrame(
        image=aligned_img,
        landmarks=aligned_landmarks,
        ipd_px=ipd_px,
        face_rect=face_rect_tuple,
        source_path=resolved_image_path,
        crop_metadata=auto_crop_data,
    )

    analyzer.compute_midline(canonical.landmarks)
    asymmetry_measurements = analyzer.measure_asymmetry(canonical.landmarks)
    annotated_img = analyzer.draw_annotations(canonical.image.copy(), canonical.landmarks)

    # 2d. Métricas avançadas — TODAS sobre o frame canônico.
    # face_rect_w usa a largura do bbox da face no espaço canônico (Issue 1.3).
    advanced_bundle = fm.compute_all(
        canonical.image,
        canonical.landmarks,
        face_rect_w=canonical.face_width,
    )
    advanced_metrics = advanced_bundle.get("advanced", {})
    skin_metrics = advanced_bundle.get("skin", {})
    photo_quality_metrics = advanced_bundle.get("photo_quality", {})

    # Merge flat para alimentar os módulos de produto sem fallback excessivo
    measurements = {
        **asymmetry_measurements,
        **advanced_metrics,
        **skin_metrics,
        **photo_quality_metrics,
    }
    capture_confidence = compute_capture_confidence(photo_quality_metrics)
    capture_recommendations = build_capture_recommendations(photo_quality_metrics)
    rec_plan = rec.recommend(measurements) if analysis_mode == "premium" else []

    # 3. Calcular score e insights
    score = asymmetry_to_score(measurements.get('overall_asymmetry_score_pct_ipd'))
    tier_label, tier_description = get_score_tier(score)
    score_context_data = _get_score_context(score, tier_label)
    debug_top_insights = get_top_insights(measurements, top_n=3)

    # 3b. Módulos do produto
    first_impression = build_first_impression(measurements)
    top_leverage = get_top_leverage_recommendation(
        measurements,
        max_tier=1,
        capture_confidence=capture_confidence,
    )
    if analysis_mode == "premium":
        visual_status_data = build_visual_status(measurements)
        top3_v2 = get_top3_actions(measurements, max_tier=2)
        evolution = build_evolution_path(
            measurements,
            rec.REC_CATALOG,
            capture_confidence=capture_confidence,
        )

        # Injetar SPF nas 3 ações priorizadas quando skin_alert ativo
        if evolution.get("skin_alert"):
            _spf_short = "SPF 30+ diariamente + hidratante noturno"
            _already = any(a.get("short_action") == _spf_short for a in top3_v2)
            if not _already:
                _spf_item = {
                    "rank": 1,
                    "metric_key": "skin_spf_protocol",
                    "short_action": _spf_short,
                    "why_it_matters": (
                        "SPF diário é o hábito de maior retorno para uniformidade de tom"
                        " — efeito visual em semanas, custo mínimo."
                    ),
                    "time_to_result": "semanas",
                    "tier": 0,
                }
                top3_v2 = [_spf_item] + top3_v2[:2]
                for _i, _item in enumerate(top3_v2, 1):
                    _item["rank"] = _i

        # Filtrar ações de captura/foto dos refinamentos (já estão no bloco de captura)
        _CAPTURE_TITLES = {"reposicionar foto", "sorriso natural ao fotografar"}
        top3_v2 = [
            a for a in top3_v2
            if a.get("short_action", "").lower().strip() not in _CAPTURE_TITLES
        ]
        # Renumérar após filtro
        for _i, _item in enumerate(top3_v2[:3], 1):
            _item["rank"] = _i
        top3_v2 = top3_v2[:3]

        next_step = build_next_step(score, evolution, top_leverage)
    else:
        visual_status_data = {}
        top3_v2 = []
        evolution = {}
        next_step = {
            "profile": "teaser",
            "message": "Esse é seu diagnóstico gratuito. O relatório premium mostra o mapa completo de métricas e prioridades.",
            "action": "Desbloquear análise premium completa",
            "cta_text": "Desbloquear análise premium completa",
            "cta_type": "upgrade_premium",
            "urgency_hook": "No premium você recebe simulação visual, plano em 3 fases e todas as métricas avançadas.",
        }

    # Insight numérico único deste rosto
    _asym_pct = measurements.get('overall_asymmetry_score_pct_ipd')
    _canthal = measurements.get('canthal_tilt_mean_deg')
    if _asym_pct is not None:
        _asym_label = "baixa" if _asym_pct < 2.0 else ("moderada" if _asym_pct < 4.0 else "elevada")
        key_metric_insight = (
            f"Assimetria medida: {_asym_pct:.1f}% do IPD ({_asym_label})"
            f" — limiar invisível a olho nu é < 2%"
        )
    elif _canthal is not None:
        key_metric_insight = f"Ângulo canthal: {_canthal:.1f}° — referência juvenil é +3° a +8°"
    else:
        key_metric_insight = ""

    # 3c. Simulação antes/depois sobre o frame canônico (mesma imagem que
    # alimentou todas as outras análises — sem desencontro de coordenadas).
    simulation_outputs = None
    simulation_error = None
    if analysis_mode == "premium":
        try:
            simulation_outputs = simulate_before_after(
                frame=canonical,
                output_dir=output_dir,
            )
        except Exception as exc:  # pylint: disable=broad-except
            simulation_error = str(exc)

    premium_metrics_catalog = []
    if analysis_mode == "premium":
        premium_metrics_catalog = build_premium_metrics_catalog(
            measurements=measurements,
            measurements_blocks=advanced_bundle,
            score=score,
            capture_confidence=capture_confidence,
            visual_status_data=visual_status_data,
            top_leverage=top_leverage,
        )

    # 4. Gerar relatório texto
    report_txt = build_shareable_report(
        image_path=resolved_image_path,
        score=score,
        tier_label=tier_label,
        tier_description=tier_description,
        first_impression=first_impression,
        visual_status_data=visual_status_data,
        top_leverage=top_leverage,
        top_actions=top3_v2,
        evolution=evolution,
        next_step=next_step,
        capture_confidence=capture_confidence,
        capture_recommendations=capture_recommendations,
        rotation_deg=analyzer.rotation_angle,
        simulation_paths=simulation_outputs,
        simulation_error=simulation_error,
        benchmark_message=score_context_data["benchmark_message"],
        score_context=score_context_data["score_context"],
        key_metric_insight=key_metric_insight,
        analysis_mode=analysis_mode,
        premium_metrics_catalog=premium_metrics_catalog,
        auto_crop_data=auto_crop_data,
    )

    # 5. Montar payload JSON
    result = {
        'analysis_mode': analysis_mode,
        'access_tier': 'paid-one-shot' if analysis_mode == 'premium' else 'free-teaser',
        'input_file': resolved_image_path,
        'generated_at': datetime.now().isoformat(),
        'auto_crop': auto_crop_data,
        'rotation_correction_degrees': round(analyzer.rotation_angle, 2),
        'score': score,
        'tier': tier_label,
        'tier_description': tier_description,
        'capture_confidence': capture_confidence,
        'main_insight': {
            'metric_key': top_leverage.get('metric_key'),
            'short_name': top_leverage.get('short_action'),
            'detail': top_leverage.get('why_it_matters'),
        } if top_leverage else {},
        'measurements': measurements,
        'measurements_blocks': advanced_bundle,
        'photo_warnings': photo_quality_metrics.get('warnings', []),
        'capture_recommendations': capture_recommendations,
        # --- Produto de Entrada: hierarquia oficial de priorizacao ---
        'first_impression': first_impression,
        'visual_status': visual_status_data,
        'top_leverage': top_leverage,
        'top3_actions_v2': top3_v2,
        # --- Debug interno (nao exibir ao usuario final) ---
        'debug_top_3_actions': [
            {
                'rank': item['rank'],
                'action': item['short_action'],
                'detail': item['why_it_matters'],
                'tier': item['tier'],
                'metric_key': item['metric_key'],
            }
            for item in top3_v2
        ],
        'debug_top_3_actions_px': [
            {'rank': i + 1, 'action': ins['short_name'], 'detail': ins['detail']}
            for i, ins in enumerate(debug_top_insights)
        ],
        'evolution_path': evolution,
        'next_step': next_step,
        'simulation_paths': simulation_outputs,
        'simulation_error': simulation_error,
        'premium_metrics_catalog': premium_metrics_catalog,
        'recommendations': rec_plan,
        'benchmark_message': score_context_data['benchmark_message'],
        'score_context': score_context_data['score_context'],
    }

    # 6. Salvar outputs
    base = os.path.splitext(os.path.basename(image_path))[0]
    json_path = os.path.join(output_dir, f"{base}_mvp_report.json")
    txt_path  = os.path.join(output_dir, f"{base}_mvp_report.txt")
    img_path  = os.path.join(output_dir, f"{base}_mvp_annotated.jpg")

    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    with open(txt_path, 'w', encoding='utf-8') as f:
        f.write(report_txt)

    cv2.imwrite(img_path, annotated_img)
    result['annotated_image_path'] = img_path

    # 7. Imprimir relatório
    print(report_txt)
    print(f"\n  Arquivos salvos em: {output_dir}")
    print(f"  JSON  : {json_path}")
    print(f"  TXT   : {txt_path}")
    print(f"  Imagem: {img_path}")

    return result


# ============================================================================
# ENTRY POINT
# ============================================================================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='MVP Pipeline — Análise de Presença Visual Facial (Pay-per-use)'
    )
    parser.add_argument('image', help='Caminho para a foto frontal (JPG ou PNG)')
    parser.add_argument(
        '--output-dir', '-o',
        default='resultado_mvp',
        help='Diretório de saída para relatórios e imagem anotada (padrão: resultado_mvp/)'
    )
    parser.add_argument(
        '--mode',
        default='premium',
        choices=['teaser', 'premium'],
        help='Modo de saída: teaser (grátis) ou premium (pago). Padrão: premium'
    )
    return parser.parse_args()


if __name__ == '__main__':
    args = parse_args()
    run(args.image, args.output_dir, mode=args.mode)
