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
from typing import Any, Dict

import cv2

from face_asymmetry import FaceAsymmetryAnalyzer
import face_metrics as fm
from impression_layer import build_first_impression
from visual_status import build_visual_status
from top_leverage import get_top_leverage_recommendation, get_top3_actions
from evolution_path import build_evolution_path
from simulate_before_after import simulate as simulate_before_after
import recommendations as rec


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
MAX_ASYMMETRY_REFERENCE = 12.0


# ============================================================================
# CÁLCULOS DE SCORE E INSIGHTS
# ============================================================================

def asymmetry_to_score(overall_px: float) -> int:
    """Converte score de assimetria (px, menor = melhor) para score 0–100 (maior = melhor)."""
    clamped = min(overall_px, MAX_ASYMMETRY_REFERENCE)
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


def build_next_step(
    score: int,
    evolution_path: Dict[str, Any],
    top_leverage: Dict[str, Any],
) -> Dict[str, str]:
    """Gera chamada de próximo passo sem quebrar o fluxo de desejo."""
    if score >= 75:
        profile = "alto"
        message = (
            "Sua base visual já está forte. O próximo passo é manter consistência "
            "e refinar o que mais gera presença."
        )
        action = "Reanalisar em 30 dias para confirmar evolução"
        cta_text = "Quero acompanhar minha evolução"
        cta_type = "assinatura"
    elif score >= 45:
        profile = "medio"
        message = (
            "A principal alavanca já está clara. Agora o foco é validar progresso "
            "com uma rotina curta e objetiva."
        )
        action = "Executar plano de 30 dias e reanalisar"
        cta_text = "Quero o plano completo"
        cta_type = "upgrade"
    else:
        profile = "baixo"
        message = (
            "Existe potencial real para destravar rápido. O ganho vem de começar "
            "agora com a ação certa."
        )
        action = "Iniciar plano guiado com checkpoints em 7/30/90 dias"
        cta_text = "Quero começar agora"
        cta_type = "upgrade"

    urgency_hook = ""
    phase_1_actions = evolution_path.get("phase_1", {}).get("actions", [])
    if phase_1_actions:
        first_action = phase_1_actions[0].get("titulo", "")
        if first_action:
            urgency_hook = f"Comece hoje por: {first_action}."

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
    rotation_deg: float,
) -> str:
    now = datetime.now().strftime('%d/%m/%Y %H:%M')
    width = 60
    sep = '─' * width

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
        f"  % do potencial visual já aproveitado : {score}%",
        f"  Confianca da captura              : {int(round(capture_confidence * 100))}%",
        '',
        sep,
        f"  💬 DIAGNOSTICO DA PRIMEIRA IMPRESSAO",
        sep,
        f"  {first_impression.get('headline', '')}",
        '',
        f"  Sinal positivo: {first_impression.get('positive_signal', '')}",
        f"  Principal risco: {first_impression.get('main_risk', '')}",
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
        f"  🎯 MUDANCA PRINCIPAL (maior alavanca)",
        sep,
        f"  {top_leverage.get('short_action', '')}",
        '',
        f"  Por que isso importa: {top_leverage.get('why_it_matters', '')}",
        f"  Tempo esperado: {top_leverage.get('time_to_result', 'semanas')}",
        '',
        sep,
        f"  ✅ 3 ACOES PRIORIZADAS",
        sep,
    ]

    for item in top_actions:
        lines += [
            f"  {item['rank']}. {item['short_action']}",
            f"     {item['why_it_matters']}",
            f"     Tempo: {item['time_to_result']} | Tier: {item['tier']}",
            '',
        ]

    phase_1 = evolution.get("phase_1", {})
    phase_2 = evolution.get("phase_2", {})
    phase_3 = evolution.get("phase_3", {})
    lines += [
        sep,
        f"  🧭 CAMINHO CURTO DE EVOLUCAO",
        sep,
        f"  {phase_1.get('label', '0-7 dias')}: {phase_1.get('focus', '')}",
        f"  {phase_2.get('label', '7-30 dias')}: {phase_2.get('focus', '')}",
        f"  {phase_3.get('label', '30-90 dias')}: {phase_3.get('focus', '')}",
        '',
        sep,
        f"  ➜ PROXIMO PASSO",
        sep,
        f"  {next_step.get('message', '')}",
        '',
        f"  {next_step.get('urgency_hook', '')}",
        '',
        f"  [{next_step.get('cta_text', '')}]",
        '',
    ]
    lines += [
        '',
        '═' * width,
        f"  Gerado por Face Before/After MVP",
        '═' * width,
        '',
    ]

    return '\n'.join(lines)


# ============================================================================
# PIPELINE PRINCIPAL
# ============================================================================

def run(image_path: str, output_dir: str) -> dict:
    os.makedirs(output_dir, exist_ok=True)

    # 1. Carregar imagem
    img = cv2.imread(image_path)
    if img is None:
        print(f"[ERRO] Não foi possível carregar a imagem: {image_path}", file=sys.stderr)
        sys.exit(1)

    # 2. Analisar assimetria
    analyzer = FaceAsymmetryAnalyzer()
    face_rect = analyzer.detect_face(img)
    if face_rect is None:
        print("[ERRO] Nenhum rosto detectado na imagem.", file=sys.stderr)
        sys.exit(1)

    landmarks = analyzer.detect_landmarks(img, face_rect)
    aligned_img, rotation_matrix = analyzer.align_face(img, landmarks)
    aligned_landmarks = analyzer.transform_landmarks(landmarks, rotation_matrix)
    analyzer.compute_midline(aligned_landmarks)
    asymmetry_measurements = analyzer.measure_asymmetry(aligned_landmarks)
    annotated_img = analyzer.draw_annotations(aligned_img.copy(), aligned_landmarks)

    # 2b. Métricas avançadas (proporções, pele e qualidade de captura)
    advanced_bundle = fm.compute_all(
        aligned_img,
        aligned_landmarks,
        face_rect_w=face_rect.width(),
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

    # 3. Calcular score e insights
    score = asymmetry_to_score(measurements['overall_asymmetry_score'])
    tier_label, tier_description = get_score_tier(score)
    debug_top_insights = get_top_insights(measurements, top_n=3)

    # 3b. Módulos do produto de entrada
    first_impression = build_first_impression(measurements)
    visual_status_data = build_visual_status(measurements)
    top_leverage = get_top_leverage_recommendation(
        measurements,
        max_tier=1,
        capture_confidence=capture_confidence,
    )
    top3_v2 = get_top3_actions(measurements, max_tier=2)
    evolution = build_evolution_path(
        measurements,
        rec.REC_CATALOG,
        capture_confidence=capture_confidence,
    )
    next_step = build_next_step(score, evolution, top_leverage)

    # 3c. Simulação antes/depois sem IA paga (não bloqueante)
    simulation_outputs = None
    simulation_error = None
    try:
        simulation_landmarks = [tuple(map(int, pt)) for pt in landmarks]
        simulation_outputs = simulate_before_after(
            image_path=image_path,
            landmarks=simulation_landmarks,
            output_dir=output_dir,
        )
    except Exception as exc:  # pylint: disable=broad-except
        simulation_error = str(exc)

    # 4. Gerar relatório texto
    report_txt = build_shareable_report(
        image_path=image_path,
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
        rotation_deg=analyzer.rotation_angle,
    )

    # 5. Montar payload JSON
    result = {
        'input_file': image_path,
        'generated_at': datetime.now().isoformat(),
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
        'top_3_actions': [
            {
                'rank': item['rank'],
                'action': item['short_action'],
                'detail': item['why_it_matters'],
                'tier': item['tier'],
                'metric_key': item['metric_key'],
            }
            for item in top3_v2
        ],
        'measurements': measurements,
        'measurements_blocks': advanced_bundle,
        'photo_warnings': photo_quality_metrics.get('warnings', []),
        'debug_top_3_actions_px': [
            {'rank': i + 1, 'action': ins['short_name'], 'detail': ins['detail']}
            for i, ins in enumerate(debug_top_insights)
        ],
        # --- Produto de Entrada: novos campos ---
        'first_impression': first_impression,
        'visual_status': visual_status_data,
        'top_leverage': top_leverage,
        'top3_actions_v2': top3_v2,
        'evolution_path': evolution,
        'next_step': next_step,
        'simulation_paths': simulation_outputs,
        'simulation_error': simulation_error,
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
    return parser.parse_args()


if __name__ == '__main__':
    args = parse_args()
    run(args.image, args.output_dir)
