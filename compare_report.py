#!/usr/bin/env python3
"""
Facial Asymmetry Comparison Report Generator

Compares two analysis reports (before/after) and generates a human-readable
formatted report showing improvements, regressions, and overall summary.
"""

import json
import os
import sys
import argparse
from datetime import datetime


# ============================================================================
# LABELS E DESCRIÇÕES HUMANAS
# ============================================================================

METRIC_LABELS = {
    'eye_level_difference_px':      ('Desnível dos olhos',        'Diferença de altura entre os centros dos olhos'),
    'eye_horizontal_asymmetry_px':  ('Assimetria horizontal dos olhos', 'Diferença de distância de cada olho à linha média'),
    'nose_deviation_px':            ('Desvio da ponta do nariz',   'O quanto a ponta do nariz desvia da linha média facial'),
    'nose_wings_asymmetry_px':      ('Assimetria das asas do nariz','Diferença de largura entre os lados das narinas'),
    'chin_deviation_px':            ('Desvio do queixo',           'O quanto o queixo desvia da linha média facial'),
    'mouth_center_deviation_px':    ('Desvio do centro da boca',   'O quanto o centro do lábio superior desvia da linha média'),
    'mouth_corners_asymmetry_px':   ('Assimetria dos cantos da boca','Diferença de posição entre canto esquerdo e direito da boca'),
    'jawline_mean_asymmetry_px':    ('Assimetria média da mandíbula','Média de assimetria ao longo de toda a linha mandibular'),
    'jawline_max_asymmetry_px':     ('Assimetria máx. da mandíbula','Ponto de maior assimetria na linha mandibular (ângulo mandibular)'),
    'overall_asymmetry_score':      ('SCORE GERAL DE ASSIMETRIA',  'Pontuação geral ponderada — quanto menor, mais simétrico'),
}

# Limiares na escala normalizada (% da distância interpupilar - IPD).
# Referência: IPD típica adulta ~63 mm; 1% ≈ 0.63 mm.
SEVERITY_THRESHOLDS_PCT_IPD = [
    (1.0,   '🟢 Excelente'),   # < 1%   IPD
    (2.0,   '🟡 Leve'),         # 1-2%
    (4.0,   '🟠 Moderada'),     # 2-4%
    (8.0,   '🔴 Acentuada'),    # 4-8%
    (999.0, '🔴 Severa'),       # > 8%
]

# Fallback (px brutos) - mantido p/ compat com relatórios antigos.
SEVERITY_THRESHOLDS_PX = [
    (0.5,   '🟢 Excelente'),
    (1.0,   '🟡 Leve'),
    (2.0,   '🟠 Moderada'),
    (5.0,   '🔴 Acentuada'),
    (999.0, '🔴 Severa'),
]

def severity_label(value: float, normalized: bool = True) -> str:
    table = SEVERITY_THRESHOLDS_PCT_IPD if normalized else SEVERITY_THRESHOLDS_PX
    for threshold, label in table:
        if value <= threshold:
            return label
    return '🔴 Severa'

def variation_arrow(delta_pct: float) -> str:
    """Retorna indicador de variação com % alinhado."""
    if delta_pct <= -20:
        return f'[MELHORA]  -{abs(delta_pct):.1f}%'
    elif delta_pct <= -5:
        return f'[leve melhora] -{abs(delta_pct):.1f}%'
    elif delta_pct <= 5:
        return f'[estavel]    {abs(delta_pct):.1f}%'
    elif delta_pct <= 20:
        return f'[leve piora]  +{delta_pct:.1f}%'
    else:
        return f'[PIORA]   +{delta_pct:.1f}%'

def variation_emoji(delta_pct: float) -> str:
    if delta_pct <= -20:  return '✅'
    elif delta_pct <= -5: return '🟡'
    elif delta_pct <= 5:  return '➡️'
    elif delta_pct <= 20: return '🟠'
    else:                 return '🔴'

def load_report(path: str) -> dict:
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def compute_delta(before: float, after: float) -> tuple:
    """Returns (absolute_delta, percent_delta)."""
    abs_delta = after - before
    if before == 0:
        pct_delta = 0.0 if after == 0 else 100.0
    else:
        pct_delta = (abs_delta / before) * 100
    return abs_delta, pct_delta

def separator(char='═', width=72):
    return char * width

def header_line(text, width=72, char='═'):
    pad = (width - len(text) - 2) // 2
    return f"{char * pad} {text} {char * (width - pad - len(text) - 2)}"


# ============================================================================
# GERAÇÃO DO RELATÓRIO
# ============================================================================

def _pick_metric(measurements: dict, key_px: str):
    """Prefer normalized (%IPD) value if present, fall back to px.

    Returns (value, unit_label, is_normalized).
    """
    norm_key = key_px[:-3] + '_pct_ipd'
    if norm_key in measurements:
        return measurements[norm_key], '%IPD', True
    return measurements.get(key_px, 0), 'px', False


def generate_report(report_before: dict, report_after: dict,
                    label_before: str = 'ANTES',
                    label_after: str = 'DEPOIS') -> str:
    m_before = report_before.get('measurements', report_before)
    m_after  = report_after.get('measurements', report_after)

    # Detecta se temos métricas normalizadas (escala em % da IPD).
    normalized = (
        'overall_asymmetry_score_pct_ipd' in m_after
        and 'overall_asymmetry_score_pct_ipd' in m_before
    )
    score_key = 'overall_asymmetry_score_pct_ipd' if normalized else 'overall_asymmetry_score'
    unit = '%IPD' if normalized else 'px'

    lines = []
    now = datetime.now().strftime('%d/%m/%Y %H:%M')

    # ── Cabeçalho ────────────────────────────────────────────────────────────
    ipd_b = m_before.get('ipd_px')
    ipd_a = m_after.get('ipd_px')
    ipd_lines = []
    if ipd_b is not None and ipd_a is not None:
        ipd_lines = [f'  IPD (referência) : A={ipd_b:.1f}px  B={ipd_a:.1f}px']

    lines += [
        '',
        separator(),
        header_line('RELATÓRIO DE ASSIMETRIA FACIAL'),
        separator(),
        f'  Gerado em : {now}',
        f'  {label_before:8s} (A) : {report_before.get("input_file", label_before)}',
        f'  {label_after:8s} (B) : {report_after.get("input_file", label_after)}',
        f'  Correção rotação A : {report_before.get("rotation_correction_degrees", "?")}°',
        f'  Correção rotação B : {report_after.get("rotation_correction_degrees", "?")}°',
        *ipd_lines,
        f'  Unidade das métricas : {unit}'
        + (' (normalizada pela distância interpupilar)' if normalized else ''),
        separator('─'),
    ]

    # ── Score geral em destaque ───────────────────────────────────────────────
    score_b = m_before.get(score_key, 0)
    score_a = m_after.get(score_key, 0)
    _, score_pct = compute_delta(score_b, score_a)

    lines += [
        '',
        f'  SCORE GERAL DE ASSIMETRIA',
        f'  {"─" * 40}',
        f'  {label_before:10s} : {score_b:6.2f} {unit}   {severity_label(score_b, normalized)}',
        f'  {label_after:10s} : {score_a:6.2f} {unit}   {severity_label(score_a, normalized)}',
        f'  Variação    : {variation_emoji(score_pct)} {variation_arrow(score_pct)}',
        '',
    ]

    if score_pct < -10:
        lines.append('  ✅ A simetria facial MELHOROU entre as duas fotos.')
    elif score_pct > 10:
        lines.append('  ⚠️  A assimetria facial AUMENTOU entre as duas fotos.')
    else:
        lines.append('  ➡️  A simetria facial permaneceu praticamente ESTÁVEL.')

    # ── Tabela detalhada ──────────────────────────────────────────────────────
    # col widths: 2 indent + 34 metric + 1 sp + 7 before + 1 sp + 7 after + 1 sp + 10 pct + 2 sp + 4 flag = 69
    col_metric = 34
    col_val    = 7
    col_pct    = 10
    sep_line   = f'  {"─"*col_metric} {"─"*col_val} {"─"*col_val} {"─"*col_pct}  {"─"*4}'

    lines += [
        '',
        separator('─'),
        f'  {"MÉTRICA (" + unit + ")":<{col_metric}} {label_before[:col_val]:>{col_val}} {label_after[:col_val]:>{col_val}} {"VARIACAO%":>{col_pct}}  +/-',
        sep_line,
    ]

    improvements = 0
    regressions  = 0

    for key, (label, _) in METRIC_LABELS.items():
        if key == 'overall_asymmetry_score':
            continue
        val_b, _u, _n = _pick_metric(m_before, key)
        val_a, _u, _n = _pick_metric(m_after, key)
        _, pct = compute_delta(val_b, val_a)

        if pct <= -5:
            improvements += 1
            pct_str = f'-{abs(pct):.1f}%'
            flag    = '[+]'
        elif pct >= 5:
            regressions += 1
            pct_str = f'+{pct:.1f}%'
            flag    = '[-]'
        else:
            pct_str = f'~{abs(pct):.1f}%'
            flag    = '[=]'

        lines.append(
            f'  {label:<{col_metric}} {val_b:>{col_val}.2f} {val_a:>{col_val}.2f} {pct_str:>{col_pct}}  {flag}'
        )

    # ── Linha do score geral ──────────────────────────────────────────────────
    _, pct = compute_delta(score_b, score_a)
    pct_str = (f'-{abs(pct):.1f}%' if pct < 0 else f'+{pct:.1f}%')
    flag = '[+]' if pct <= -5 else ('[-]' if pct >= 5 else '[=]')
    lines += [
        sep_line,
        f'  {"SCORE GERAL":<{col_metric}} {score_b:>{col_val}.2f} {score_a:>{col_val}.2f} {pct_str:>{col_pct}}  {flag}',
        separator('─'),
    ]

    # ── Resumo interpretativo ─────────────────────────────────────────────────
    total = improvements + regressions
    lines += [
        '',
        header_line('INTERPRETAÇÃO CLÍNICA', char='─'),
        '',
        f'  • Métricas que melhoraram : {improvements} de {len(METRIC_LABELS)-1}',
        f'  • Métricas que pioraram   : {regressions} de {len(METRIC_LABELS)-1}',
        '',
    ]

    # Comentários por métrica relevante.
    # Limiares duplos: (px, %IPD). O escolhido depende da unidade vigente.
    thresholds_comments = [
        ('nose_deviation_px',         (2.0, 4.0), 'desvio do nariz',    'O nariz apresenta desvio da linha média.'),
        ('chin_deviation_px',         (1.0, 2.0), 'desvio do queixo',   'O queixo desvia da linha média — pode indicar assimetria esquelética.'),
        ('mouth_center_deviation_px', (1.0, 2.0), 'desvio da boca',     'O centro da boca está desviado da linha média.'),
        ('eye_level_difference_px',   (1.0, 2.0), 'desnível dos olhos', 'Os olhos apresentam desnível vertical perceptível.'),
        ('jawline_max_asymmetry_px',  (3.0, 6.0), 'mandíbula',          'Assimetria mandibular acentuada — região do ângulo da mandíbula.'),
    ]

    findings = []
    for key, (thr_px, thr_pct), region, comment in thresholds_comments:
        val, u, _ = _pick_metric(m_after, key)
        threshold = thr_pct if normalized else thr_px
        if val > threshold:
            findings.append(f'  ⚠️  {region.upper()}: {comment} (valor atual: {val:.2f} {u})')

    if findings:
        lines.append('  Pontos de atenção na análise mais recente:')
        lines += findings
    else:
        lines.append('  ✅ Nenhum ponto de atenção relevante na análise mais recente.')

    # ── Análise avançada ─────────────────────────────────────────────────────
    adv_b = m_before.get('advanced') or {}
    adv_a = m_after.get('advanced')  or {}
    if adv_b and adv_a:
        adv_subset = [
            ('fwhr',                          'fWHR (face width/height)',     '~1.85'),
            ('lower_third_ratio',             'Razão do terço inferior',      '~0.56'),
            ('canthal_tilt_mean_deg',         'Canthal tilt médio (°)',       '~+5°'),
            ('intercanthal_to_eyewidth_ratio','Intercanthal / largura olho',  '~1.0'),
            ('nasal_to_mouth_width_ratio',    'Nariz / boca (largura)',       '~0.70'),
            ('mouth_to_ipd_ratio',            'Boca / IPD',                   '~1.50'),
            ('thirds_std_dev',                'Desvio dos 3 terços',          '0 (ideal)'),
            ('marquardt_deviation_pct_ipd',   'Desvio bilateral global %IPD', '0 (ideal)'),
            ('jawline_definition_score',      'Definição da linha mandibular','maior = mais definido'),
        ]
        lines += [
            '',
            header_line('ANÁLISE AVANÇADA', char='─'),
            '',
            f'  {"MÉTRICA":<34} {label_before[:7]:>7} {label_after[:7]:>7}    IDEAL',
            f'  {"─"*34} {"─"*7} {"─"*7}    {"─"*15}',
        ]
        for key, label, ideal in adv_subset:
            vb = adv_b.get(key)
            va = adv_a.get(key)
            if vb is None or va is None:
                continue
            lines.append(
                f'  {label:<34} {vb:>7.2f} {va:>7.2f}    {ideal}'
            )

        # Forma facial
        sb = adv_b.get('face_shape_label')
        sa = adv_a.get('face_shape_label')
        if sb and sa:
            lines += ['', f'  Forma facial : {sb} → {sa}']

    # ── Qualidade da foto / avisos ───────────────────────────────────────────
    pq_a = m_after.get('photo_quality') or {}
    pq_b = m_before.get('photo_quality') or {}
    if pq_a or pq_b:
        lines += ['', header_line('QUALIDADE DAS FOTOS', char='─'), '']
        for label_, pq in ((label_before, pq_b), (label_after, pq_a)):
            if not pq:
                continue
            lines.append(
                f'  {label_}: yaw={pq.get("head_pose_yaw_deg",0):+.1f}° '
                f'pitch={pq.get("head_pose_pitch_deg",0):+.1f}° '
                f'roll={pq.get("head_pose_roll_deg",0):+.1f}° '
                f'| sharp={pq.get("sharpness_laplacian_var",0):.0f} '
                f'| ΔE_lr={pq.get("lighting_asymmetry_delta_e",0):.1f}'
            )
            for w in (pq.get('warnings') or []):
                lines.append(f'    ⚠️  {w}')

    # ── Plano de ação ────────────────────────────────────────────────────────
    try:
        import recommendations as rec_mod
        plan = rec_mod.recommend(m_after)
    except Exception:
        plan = []
    plan = [p for p in plan if p['severity'] != 'excelente']
    if plan:
        lines += ['', header_line('PLANO DE AÇÃO', char='─'), '']
        sev_icon = {
            'leve':'🟡', 'moderada':'🟠', 'acentuada':'🔴', 'severa':'🔴',
        }
        for it in plan:
            icon = sev_icon.get(it['severity'], '·')
            val = it['value']
            val_str = (f"{float(val):.2f}" if isinstance(val, (int, float))
                       else str(val))
            lines.append(
                f"  {icon} {it['metric_label']} "
                f"(atual {val_str} | ideal {it['ideal']} | {it['severity']})"
            )
            lines.append(f"      • {it['why_matters']}")
            for a in it['actions'][:3]:
                fonte = (a.get('fonte') or {}).get('url') or ''
                lines.append(
                    f"      → [{a.get('tipo','-')}] {a.get('titulo','')} "
                    f"({a.get('frequencia','')})"
                )
                if fonte:
                    lines.append(f"         {fonte}")
            lines.append('')

    if normalized:
        sev_lines = [
            '  LEGENDA DE SEVERIDADE (% da distância interpupilar):',
            '  🟢 Excelente  = < 1%    |  🟡 Leve     = 1–2%',
            '  🟠 Moderada   = 2–4%    |  🔴 Acentuada = 4–8%   |  🔴 Severa = > 8%',
        ]
    else:
        sev_lines = [
            '  LEGENDA DE SEVERIDADE (pixels):',
            '  🟢 Excelente  = < 0.5 px   |  🟡 Leve     = 0.5–1.0 px',
            '  🟠 Moderada   = 1.0–2.0 px |  🔴 Acentuada = > 2.0 px',
        ]
    lines += [
        '',
        *sev_lines,
        '',
        '  LEGENDA DE VARIAÇÃO:',
        '  ✅ ▼  = melhora ≥ 20%  |  🟡 ▼  = melhora 5–20%',
        '  ➡️   = estável ±5%    |  🟠/🔴 ▲ = piora',
        '',
        separator(),
        '',
    ]

    return '\n'.join(lines)


# ============================================================================
# CLI
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Gera relatório comparativo de assimetria facial (antes x depois)',
    )
    parser.add_argument('--before', required=True,
                        help='Caminho para o JSON do relatório ANTES')
    parser.add_argument('--after',  required=True,
                        help='Caminho para o JSON do relatório DEPOIS')
    parser.add_argument('--label-before', default='ANTES',
                        help='Rótulo para o primeiro relatório')
    parser.add_argument('--label-after',  default='DEPOIS',
                        help='Rótulo para o segundo relatório')
    parser.add_argument('--output', default=None,
                        help='Arquivo .txt de saída (opcional; padrão: exibe no terminal)')

    args = parser.parse_args()

    for path in [args.before, args.after]:
        if not os.path.exists(path):
            print(f'Erro: arquivo não encontrado: {path}', file=sys.stderr)
            sys.exit(1)

    report_before = load_report(args.before)
    report_after  = load_report(args.after)

    report_text = generate_report(
        report_before, report_after,
        label_before=args.label_before,
        label_after=args.label_after,
    )

    print(report_text)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(report_text)
        print(f'Relatório salvo em: {args.output}')


if __name__ == '__main__':
    main()
