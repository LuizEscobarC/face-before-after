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
from typing import Optional

import cv2

from face_asymmetry import FaceAsymmetryAnalyzer
from impression_layer import build_first_impression
from visual_status import build_visual_status
from top_leverage import get_top_leverage_recommendation, get_top3_actions
from evolution_path import build_evolution_path
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
    """Retorna as métricas mais impactantes ordenadas por peso × valor."""
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


# ============================================================================
# GERAÇÃO DO RELATÓRIO COMPARTILHÁVEL
# ============================================================================

def build_shareable_report(
    image_path: str,
    score: int,
    tier_label: str,
    tier_description: str,
    top_insights: list,
    measurements: dict,
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
        '',
        sep,
        f"  🎯 MUDANÇA PRINCIPAL (maior alavanca)",
        sep,
    ]

    if top_insights:
        main = top_insights[0]
        lines += [
            f"  {main['short_name']}",
            f"",
            f"  {main['detail']}",
            '',
        ]

    # Injetar first_impression e visual_status se disponíveis
    # (passados via kwargs opcionais — fallback silencioso se ausentes)
    first_imp = locals().get('first_impression_txt')
    if first_imp:
        lines += [
            sep,
            f"  💬 PRIMEIRA IMPRESSAO",
            sep,
            f"  {first_imp}",
            '',
        ]

    lines += [
        sep,
        f"  ✅ 3 AÇÕES PRIORIZADAS POR IMPACTO",
        sep,
    ]

    for i, insight in enumerate(top_insights, 1):
        lines.append(f"  {i}. {insight['short_name']}")
        lines.append(f"     {insight['detail']}")
        lines.append('')

    lines += [
        sep,
        f"  📊 MEDIÇÕES DETALHADAS",
        sep,
        f"  {'Métrica':<38} {'Valor (px)':>10}",
        f"  {'─'*38} {'─'*10}",
    ]

    labels = {
        'eye_level_difference_px':      'Desnível dos olhos',
        'eye_horizontal_asymmetry_px':  'Assimetria horizontal dos olhos',
        'nose_deviation_px':            'Desvio da ponta do nariz',
        'nose_wings_asymmetry_px':      'Assimetria das asas do nariz',
        'chin_deviation_px':            'Desvio do queixo',
        'mouth_center_deviation_px':    'Desvio do centro da boca',
        'mouth_corners_asymmetry_px':   'Assimetria dos cantos da boca',
        'jawline_mean_asymmetry_px':    'Assimetria média da mandíbula',
        'jawline_max_asymmetry_px':     'Assimetria máx. da mandíbula',
        'overall_asymmetry_score':      'SCORE GERAL DE ASSIMETRIA (px)',
    }

    for key, label in labels.items():
        val = measurements.get(key, 0.0)
        lines.append(f"  {label:<38} {val:>10.2f}")

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
    measurements = analyzer.measure_asymmetry(aligned_landmarks)
    annotated_img = analyzer.draw_annotations(aligned_img.copy(), aligned_landmarks)

    # 3. Calcular score e insights
    score = asymmetry_to_score(measurements['overall_asymmetry_score'])
    tier_label, tier_description = get_score_tier(score)
    top_insights = get_top_insights(measurements, top_n=3)

    # 3b. Módulos do produto de entrada
    first_impression = build_first_impression(measurements)
    visual_status_data = build_visual_status(measurements)
    top_leverage = get_top_leverage_recommendation(measurements, max_tier=1)
    top3_v2 = get_top3_actions(measurements, max_tier=2)
    evolution = build_evolution_path(measurements, rec.REC_CATALOG)

    # 4. Gerar relatório texto
    report_txt = build_shareable_report(
        image_path=image_path,
        score=score,
        tier_label=tier_label,
        tier_description=tier_description,
        top_insights=top_insights,
        measurements=measurements,
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
        'main_insight': {
            'short_name': top_insights[0]['short_name'],
            'detail': top_insights[0]['detail'],
        } if top_insights else {},
        'top_3_actions': [
            {'rank': i + 1, 'action': ins['short_name'], 'detail': ins['detail']}
            for i, ins in enumerate(top_insights)
        ],
        'measurements': measurements,
        # --- Produto de Entrada: novos campos ---
        'first_impression': first_impression,
        'visual_status': visual_status_data,
        'top_leverage': top_leverage,
        'top3_actions_v2': top3_v2,
        'evolution_path': evolution,
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
