#!/usr/bin/env python3
"""
Gera um relatório HTML autocontido (sem servidor) a partir dos dois JSONs
produzidos por face_asymmetry.py.

Embute as imagens (annotated + heatmap) em base64 e os dados em JSON, então
basta abrir o arquivo .html resultante no navegador.
"""

import argparse
import base64
import html
import json
import os
import sys
from datetime import datetime

import recommendations as rec_mod
import glossary as gloss_mod


# ---------------------------------------------------------------------------
# Métricas exibidas (label PT-BR, descrição curta, "como melhorar / o que isso
# significou se mudou", chave _px que vira _pct_ipd se disponível)
# ---------------------------------------------------------------------------
METRICS = [
    ("eye_level_difference_px",     "Desnível dos olhos",
     "Diferença de altura entre os centros oculares.",
     "Geralmente reflete inclinação postural cervical ou compensação muscular do trapézio/escalenos."),
    ("eye_horizontal_asymmetry_px", "Assimetria horizontal dos olhos",
     "Diferença na distância de cada olho à linha média.",
     "Pode indicar leve rotação craniana ou assimetria orbital — postura e exercícios oculares ajudam pouco; é estrutural."),
    ("nose_deviation_px",           "Desvio da ponta do nariz",
     "Quanto a ponta do nariz desvia da linha média.",
     "Desvios pequenos são funcionais (septo); melhora aparente vem de iluminação frontal e enquadramento simétrico."),
    ("nose_wings_asymmetry_px",     "Assimetria das asas do nariz",
     "Diferença de largura entre as narinas.",
     "Costuma ser fixa (estrutura cartilaginosa) — variação entre fotos geralmente é expressão facial."),
    ("chin_deviation_px",           "Desvio do queixo",
     "Desvio do mento em relação à linha média.",
     "Reflete simetria mandibular esquelética — melhoras costumam vir de mio-funcional, mewing consistente, ou ortodontia."),
    ("mouth_center_deviation_px",   "Desvio do centro da boca",
     "Quanto o centro do lábio superior desvia.",
     "Muito sensível à expressão. Relaxar a face antes da foto reduz drasticamente."),
    ("mouth_corners_asymmetry_px",  "Assimetria dos cantos da boca",
     "Diferença vertical/lateral entre cantos labiais.",
     "Tônus do risório e zigomático maior. Treino facial bilateral (ex.: sorriso resistido) tende a equilibrar."),
    ("jawline_mean_asymmetry_px",   "Assimetria média da mandíbula",
     "Média ao longo da linha mandibular (0–16).",
     "Hábitos mastigatórios unilaterais agravam. Mastigar dos dois lados + postura de língua no palato (mewing) ajudam a longo prazo."),
    ("jawline_max_asymmetry_px",    "Assimetria máx. da mandíbula",
     "Pico de assimetria — geralmente ângulo mandibular.",
     "Diferença de massa do masseter direito vs esquerdo. Mastigação bilateral consistente reduz em meses."),
]

SCORE_KEY_NORM = "overall_asymmetry_score_pct_ipd"
SCORE_KEY_PX   = "overall_asymmetry_score"


# Subset de métricas avançadas exibidas (chave, label, valor ideal humano,
# tupla (ideal_num, tolerancia) para severidade).
ADVANCED_DISPLAY = [
    ("fwhr",                          "fWHR (largura/altura sup.)",   "~1.85",         (1.85, 0.10)),
    ("lower_third_ratio",             "Razão do terço inferior",      "~0.56",         (0.56, 0.05)),
    ("canthal_tilt_mean_deg",         "Canthal tilt médio (°)",       "~+5°",          (5.0, 3.0)),
    ("intercanthal_to_eyewidth_ratio","Intercanthal / largura do olho","~1.0",         (1.0, 0.10)),
    ("nasal_to_mouth_width_ratio",    "Nariz / boca (largura)",       "~0.70",         (0.70, 0.10)),
    ("mouth_to_ipd_ratio",            "Boca / IPD",                   "~1.50",         (1.50, 0.20)),
    ("thirds_std_dev",                "Desvio dos 3 terços",          "0 (ideal)",     (0.0, 0.03)),
    ("fifths_std_dev",                "Desvio dos 5 quintos",         "0 (ideal)",     (0.0, 0.03)),
    ("marquardt_deviation_pct_ipd",   "Desvio bilateral global (%IPD)","0 (ideal)",    (0.0, 3.0)),
    ("jaw_width_pct_ipd",             "Largura mandibular (%IPD)",    "~155%",         (155.0, 20.0)),
    ("jawline_definition_score",      "Definição da linha mandibular","maior = +definido",(0.0, 0.0)),
    ("upper_lower_lip_ratio",         "Razão lábio sup/inf",          "~0.62",         (0.62, 0.15)),
    ("philtrum_length_pct_ipd",       "Filtro nasolabial (%IPD)",     "~22%",          (22.0, 6.0)),
    ("face_shape_label",              "Forma facial",                 "—",             None),
]


def adv_severity(ideal_tuple, value):
    if ideal_tuple is None or value is None:
        return "leve"
    ideal, tol = ideal_tuple
    if tol <= 0:
        return "leve"
    diff = abs(float(value) - ideal)
    if diff <= tol:     return "excelente"
    if diff <= tol * 2: return "leve"
    if diff <= tol * 3: return "moderada"
    if diff <= tol * 4: return "acentuada"
    return "severa"


# ---------------------------------------------------------------------------
# Guias de leitura por tipo de imagem
# ---------------------------------------------------------------------------
IMAGE_GUIDES = {
    "annotated": {
        "titulo": "Como ler esta imagem",
        "paragrafos": [
            "Os pontos coloridos são os 68 marcos anatômicos detectados pelo dlib (modelo iBUG 300-W). "
            "A linha vertical é a estimativa da linha média facial e serve de eixo de simetria.",
            "Use a linha vertical como régua: o queixo (índice 8), a ponta do nariz (30) e o centro da boca (51/57) deveriam cair sobre ela.",
        ],
        "checklist": [
            "O queixo está sobre a linha média?",
            "Os cantos externos dos olhos têm a mesma altura?",
            "As asas do nariz estão simétricas em relação ao centro?",
            "Os cantos da boca estão na mesma altura?",
        ],
    },
    "aligned": {
        "titulo": "Como ler esta imagem",
        "paragrafos": [
            "A foto foi rotacionada para que a linha entre os olhos fique perfeitamente horizontal. "
            "Isso elimina o efeito 'cabeça torta' e permite comparar lados esquerdo e direito de forma justa.",
            "Compare visualmente metade esquerda e direita imaginando uma dobra vertical no meio do rosto.",
        ],
        "checklist": [
            "A linha dos olhos parece horizontal?",
            "Há diferença visível na altura das sobrancelhas?",
            "Um lado do rosto parece mais largo que o outro?",
        ],
    },
    "heatmap": {
        "titulo": "Como ler esta imagem",
        "paragrafos": [
            "Cores quentes (vermelho/amarelo) = maior diferença entre o lado direito e o lado esquerdo espelhado.",
            "Cores frias (azul/verde) = regiões simétricas.",
            "O algoritmo espelha a metade direita e sobrepõe à esquerda; a diferença pixel-a-pixel é mapeada na escala JET do OpenCV.",
        ],
        "checklist": [
            "Há manchas vermelhas concentradas em um único lado? (assimetria localizada)",
            "O calor está distribuído uniformemente? (rosto bem alinhado, leve assimetria global)",
            "Pontos quentes no contorno externo? (pode ser apenas pose/iluminação, não estrutura)",
            "Pontos quentes em sobrancelhas/olhos? (expressão facial — relaxe e refotografe)",
        ],
    },
    "landmarks": {
        "titulo": "Como ler esta imagem",
        "paragrafos": [
            "Apenas os 68 landmarks sobre fundo neutro. Útil para ver o esqueleto da detecção sem distração da textura.",
            "Procure padrões: pontos amontoados onde deveriam estar espalhados indicam falha de detecção (cabelo, óculos, sombras).",
        ],
        "checklist": [
            "Os 17 pontos da mandíbula formam uma curva suave?",
            "Os 6 pontos de cada olho fecham corretamente?",
            "A boca tem 20 pontos formando o vermelhão dos lábios?",
        ],
    },
    "comparison": {
        "titulo": "O que comparar visualmente entre Antes e Depois",
        "paragrafos": [
            "O objetivo é detectar mudanças estruturais reais, separando-as de variações de pose, expressão e iluminação.",
        ],
        "checklist": [
            "O calor total no heatmap diminuiu globalmente?",
            "As regiões mais quentes mudaram de localização ou de intensidade?",
            "A linha média cruza pontos diferentes (deslocamento de queixo/nariz)?",
            "A simetria dos olhos/boca melhorou ou apenas a expressão mudou?",
            "Pose (yaw/pitch/roll) é parecida entre as duas fotos?",
        ],
    },
}


def render_image_with_guide(src: str, guide_key: str) -> str:
    """Renderiza <img> + <details> com o guia de leitura."""
    img = f'<img src="{src}">' if src else '<span style="color:#666">imagem indisponível</span>'
    guide = IMAGE_GUIDES.get(guide_key)
    if not guide:
        return f'<div class="imgwrap">{img}</div>'
    paras = "".join(f"<p>{html.escape(p)}</p>" for p in guide["paragrafos"])
    items = "".join(f"<li>{html.escape(i)}</li>" for i in guide["checklist"])
    return (
        f'<div class="imgwrap">{img}</div>'
        f'<details class="img-guide">'
        f'<summary>{html.escape(guide["titulo"])}</summary>'
        f'{paras}'
        f'<ul class="checklist">{items}</ul>'
        f'</details>'
    )


# ---------------------------------------------------------------------------
def b64_image(path: str) -> str:
    if not path or not os.path.exists(path):
        return ""
    with open(path, "rb") as f:
        data = base64.b64encode(f.read()).decode("ascii")
    ext = os.path.splitext(path)[1].lstrip(".").lower() or "jpg"
    if ext == "jpg":
        ext = "jpeg"
    return f"data:image/{ext};base64,{data}"


def load_report(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def find_image(report: dict, key: str) -> str:
    files = report.get("output_files", {}) or {}
    return files.get(key, "")


def pick(measurements: dict, key_px: str):
    """Returns (value, unit, normalized_bool)."""
    norm = key_px[:-3] + "_pct_ipd"
    if norm in measurements:
        return measurements[norm], "%IPD", True
    return measurements.get(key_px, 0.0), "px", False


def severity(value: float, normalized: bool) -> str:
    if normalized:
        if value < 1:   return "excelente"
        if value < 2:   return "leve"
        if value < 4:   return "moderada"
        if value < 8:   return "acentuada"
        return "severa"
    if value < 0.5: return "excelente"
    if value < 1:   return "leve"
    if value < 2:   return "moderada"
    if value < 5:   return "acentuada"
    return "severa"


# ---------------------------------------------------------------------------
# HTML / CSS / JS template
# ---------------------------------------------------------------------------
HTML_TMPL = r"""<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<title>Relatório Facial — Antes × Depois</title>
<style>
  :root {
    --bg:#0e1116; --panel:#161b22; --panel2:#1c2230; --border:#2a313c;
    --fg:#e6edf3; --muted:#8b949e;
    --green:#3fb950; --yellow:#d29922; --orange:#db6d28; --red:#f85149;
    --blue:#58a6ff;
  }
  * { box-sizing: border-box; }
  html,body { margin:0; padding:0; background:var(--bg); color:var(--fg);
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
  header { padding:24px 32px; border-bottom:1px solid var(--border);
    display:flex; justify-content:space-between; align-items:baseline; flex-wrap:wrap; gap:8px; }
  h1 { margin:0; font-size:20px; font-weight:600; letter-spacing:.3px; }
  .meta { color:var(--muted); font-size:13px; }
  main { padding:24px 32px; max-width:1280px; margin:0 auto; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  @media (max-width: 900px) { .grid-2 { grid-template-columns:1fr; } }
  .card { background:var(--panel); border:1px solid var(--border); border-radius:10px;
    padding:18px; }
  .card h2 { margin:0 0 12px; font-size:14px; font-weight:600; color:var(--muted);
    text-transform:uppercase; letter-spacing:1px; }
  .imgwrap { background:#000; border-radius:6px; overflow:hidden;
    display:flex; align-items:center; justify-content:center; min-height:200px; }
  .imgwrap img { width:100%; height:auto; display:block; }
  .label-row { display:flex; justify-content:space-between; align-items:center;
    margin-bottom:8px; }
  .tag { font-size:11px; padding:2px 8px; border-radius:999px;
    background:var(--panel2); color:var(--muted); border:1px solid var(--border); }

  .score { display:flex; align-items:baseline; gap:10px; margin-top:8px; }
  .score .v { font-size:32px; font-weight:700; }
  .score .u { color:var(--muted); font-size:13px; }

  .sev-excelente { color:var(--green); }
  .sev-leve      { color:var(--yellow); }
  .sev-moderada  { color:var(--orange); }
  .sev-acentuada { color:var(--red); }
  .sev-severa    { color:var(--red); }
  .pill { display:inline-block; padding:2px 10px; border-radius:999px;
    font-size:12px; font-weight:600; border:1px solid currentColor; }

  .summary-banner { padding:18px 22px; border-radius:10px; margin:20px 0;
    border:1px solid var(--border); }
  .summary-banner.good { background:rgba(63,185,80,.08); border-color:rgba(63,185,80,.4); }
  .summary-banner.bad  { background:rgba(248,81,73,.08);  border-color:rgba(248,81,73,.4); }
  .summary-banner.flat { background:rgba(88,166,255,.06); border-color:rgba(88,166,255,.3); }
  .summary-banner h2 { margin:0 0 4px; font-size:18px; }
  .summary-banner p { margin:0; color:var(--muted); }

  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:10px 8px; border-bottom:1px solid var(--border); }
  th { color:var(--muted); font-weight:500; font-size:12px; text-transform:uppercase;
    letter-spacing:1px; }
  td.num { text-align:right; font-variant-numeric: tabular-nums; }
  td.delta-pos { color:var(--green); }
  td.delta-neg { color:var(--red); }
  td.delta-zero { color:var(--muted); }
  .bar { height:6px; background:var(--panel2); border-radius:3px; overflow:hidden;
    margin-top:4px; }
  .bar > span { display:block; height:100%; background:var(--blue); }

  details { background:var(--panel2); border:1px solid var(--border);
    border-radius:8px; padding:10px 14px; margin:8px 0; }
  details summary { cursor:pointer; font-weight:600; }
  details p { color:var(--muted); margin:8px 0 0; font-size:14px; line-height:1.5; }

  /* Tabela avançada com colunas de larguras estáveis */
  .adv-table { width:100%; border-collapse:collapse; table-layout:fixed;
    font-variant-numeric:tabular-nums; }
  .adv-table th, .adv-table td { padding:10px 12px;
    border-bottom:1px solid var(--border); text-align:left;
    vertical-align:middle; overflow:hidden; text-overflow:ellipsis; }
  .adv-table th { background:var(--panel2); font-weight:600; font-size:.78em;
    text-transform:uppercase; letter-spacing:.04em; color:var(--muted); }
  .adv-table td.num { text-align:right; font-feature-settings:"tnum"; }
  .adv-table td.center { text-align:center; }
  .adv-table td.muted  { color:var(--muted); }
  .pill { display:inline-block; padding:3px 10px; border-radius:999px;
    font-size:12px; font-weight:600; border:1px solid currentColor;
    min-width:90px; text-align:center; }

  /* Plano de ação */
  .plan-card details { padding:14px 16px; }
  .plan-card details summary { display:flex; justify-content:space-between;
    align-items:center; gap:12px; }
  .plan-card .meta-row { color:var(--muted); font-size:13px; margin:6px 0 0; }
  .plan-card .actions { list-style:none; padding:0; margin:12px 0 0; }
  .plan-card .actions li { padding:10px 12px; border-left:3px solid var(--blue);
    background:rgba(88,166,255,.06); border-radius:4px; margin-bottom:8px; }
  .plan-card .actions .tipo { display:inline-block; font-size:11px;
    padding:2px 8px; border-radius:999px; background:var(--panel);
    color:var(--muted); margin-right:8px; text-transform:uppercase;
    letter-spacing:.04em; }
  .plan-card .refs { margin:10px 0 0; padding-left:18px; font-size:13px;
    color:var(--muted); }
  .plan-card a, .glossary a, .img-guide a { color:var(--blue);
    text-decoration:none; }
  .plan-card a:hover, .glossary a:hover { text-decoration:underline; }

  /* Glossário */
  .glossary details p { color:var(--fg); }
  .glossary .ref-list { margin:8px 0 0; padding-left:18px; font-size:13px;
    color:var(--muted); }

  /* Guias de imagem */
  .img-guide { margin-top:10px; background:rgba(88,166,255,.04);
    border-color:rgba(88,166,255,.25); }
  .img-guide summary { color:var(--blue); }
  .img-guide p { color:var(--fg); }
  .img-guide ul.checklist { margin:8px 0 0; padding-left:20px;
    color:var(--fg); font-size:14px; }
  .img-guide ul.checklist li { margin-bottom:4px; }

  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
  @media (max-width: 900px) { .two-col { grid-template-columns:1fr; } }

  footer { color:var(--muted); font-size:12px; padding:24px 32px;
    border-top:1px solid var(--border); margin-top:40px; text-align:center; }
  .legend { font-size:12px; color:var(--muted); margin-top:8px; }
  .legend span { display:inline-block; margin-right:14px; }
  .dot { display:inline-block; width:9px; height:9px; border-radius:50%;
    margin-right:5px; vertical-align:middle; }
</style>
</head>
<body>

<header>
  <h1>Relatório de Assimetria Facial — <span style="color:var(--blue)">Antes × Depois</span></h1>
  <div class="meta">Gerado em __GENERATED__</div>
</header>

<main>

  <!-- ========== Imagens lado a lado ========== -->
  <div class="grid-2">
    <div class="card">
      <div class="label-row">
        <h2>__LABEL_BEFORE__</h2>
        <span class="tag">__FILE_BEFORE__</span>
      </div>
      __IMG_BEFORE_BLOCK__
      <div class="score">
        <span class="v sev-__SEV_BEFORE__">__SCORE_BEFORE__</span>
        <span class="u">__UNIT__</span>
        <span class="pill sev-__SEV_BEFORE__">__SEV_BEFORE_LABEL__</span>
      </div>
    </div>
    <div class="card">
      <div class="label-row">
        <h2>__LABEL_AFTER__</h2>
        <span class="tag">__FILE_AFTER__</span>
      </div>
      __IMG_AFTER_BLOCK__
      <div class="score">
        <span class="v sev-__SEV_AFTER__">__SCORE_AFTER__</span>
        <span class="u">__UNIT__</span>
        <span class="pill sev-__SEV_AFTER__">__SEV_AFTER_LABEL__</span>
      </div>
    </div>
  </div>

  <!-- ========== Resumo ========== -->
  <div class="summary-banner __BANNER_CLASS__">
    <h2>__BANNER_TITLE__</h2>
    <p>__BANNER_TEXT__</p>
  </div>

  <!-- ========== Heatmaps ========== -->
  <div class="grid-2">
    <div class="card">
      <h2>Heatmap — __LABEL_BEFORE__</h2>
      __HM_BEFORE_BLOCK__
    </div>
    <div class="card">
      <h2>Heatmap — __LABEL_AFTER__</h2>
      __HM_AFTER_BLOCK__
    </div>
  </div>

  <!-- ========== Comparativo visual ========== -->
  <div class="card" style="margin-top:20px;">
    <h2>Como comparar Antes × Depois</h2>
    __COMPARISON_GUIDE__
  </div>

  <!-- ========== Tabela de métricas ========== -->
  <div class="card" style="margin-top:20px;">
    <h2>Métricas detalhadas (__UNIT__)</h2>
    <table>
      <thead>
        <tr>
          <th>Métrica</th>
          <th class="num">__LABEL_BEFORE__</th>
          <th class="num">__LABEL_AFTER__</th>
          <th class="num">Δ</th>
          <th>Severidade atual</th>
        </tr>
      </thead>
      <tbody>__ROWS__</tbody>
    </table>
    <div class="legend">
      <span><span class="dot" style="background:var(--green)"></span>Excelente</span>
      <span><span class="dot" style="background:var(--yellow)"></span>Leve</span>
      <span><span class="dot" style="background:var(--orange)"></span>Moderada</span>
      <span><span class="dot" style="background:var(--red)"></span>Acentuada / Severa</span>
    </div>
  </div>

  <!-- ========== Pontos a melhorar / como melhorou ========== -->
  <div class="two-col" style="margin-top:20px;">
    <div class="card">
      <h2>O que ainda dá para melhorar</h2>
      __TODO_LIST__
    </div>
    <div class="card">
      <h2>O que melhorou — provável explicação</h2>
      __DONE_LIST__
    </div>
  </div>

  <!-- ========== Análise avançada ========== -->
  __ADVANCED_BLOCK__

  <!-- ========== Qualidade da foto ========== -->
  __QUALITY_BLOCK__

  <!-- ========== Plano de ação ========== -->
  __PLAN_BLOCK__

  <!-- ========== Glossário ========== -->
  __GLOSSARY_BLOCK__

</main>

<footer>
  Relatório gerado por <code>build_html_report.py</code>. Métricas normalizadas pela
  distância interpupilar (IPD) sempre que disponíveis. Este material é descritivo,
  não constitui diagnóstico médico.
</footer>

</body>
</html>"""


# ---------------------------------------------------------------------------
def render_rows(m_b, m_a):
    rows = []
    for key_px, label, _desc, _hint in METRICS:
        vb, unit, norm = pick(m_b, key_px)
        va, _u, _n     = pick(m_a, key_px)
        delta = va - vb
        if vb > 1e-6:
            pct = (delta / vb) * 100
        else:
            pct = 0.0 if abs(va) < 1e-6 else 100.0
        sev = severity(va, norm)
        if delta < -0.001:
            cls = "delta-pos"; arrow = "▼"
            d_text = f"{arrow} {abs(pct):.1f}%"
        elif delta > 0.001:
            cls = "delta-neg"; arrow = "▲"
            d_text = f"{arrow} {pct:.1f}%"
        else:
            cls = "delta-zero"; d_text = "—"
        # barra proporcional (cap em 10 %IPD ou 5px)
        cap = 10.0 if norm else 5.0
        pct_bar = min(100, (va / cap) * 100)
        rows.append(
            f'<tr>'
            f'<td>{html.escape(label)}'
            f'<div class="bar"><span style="width:{pct_bar:.1f}%"></span></div></td>'
            f'<td class="num">{vb:.2f}</td>'
            f'<td class="num">{va:.2f}</td>'
            f'<td class="num {cls}">{d_text}</td>'
            f'<td><span class="pill sev-{sev}">{sev}</span></td>'
            f'</tr>'
        )
    return "\n".join(rows)


def render_lists(m_b, m_a):
    """Retorna (todo_html, done_html)."""
    todo = []  # ainda piores que limiar
    done = []  # melhoraram >5%
    for key_px, label, desc, hint in METRICS:
        vb, _u, norm = pick(m_b, key_px)
        va, _u2, _n2 = pick(m_a, key_px)
        delta_pct = ((va - vb) / vb * 100) if vb > 1e-6 else 0.0
        sev = severity(va, norm)
        # Pontos a melhorar = severidade atual moderada+ OU piorou >5%
        if sev in ("moderada", "acentuada", "severa") or delta_pct > 5:
            todo.append(
                f'<details>'
                f'<summary class="sev-{sev}">{html.escape(label)} — atual {va:.2f} ({sev})</summary>'
                f'<p><strong>O que é:</strong> {html.escape(desc)}<br>'
                f'<strong>Como atacar:</strong> {html.escape(hint)}</p>'
                f'</details>'
            )
        if delta_pct < -5:
            done.append(
                f'<details>'
                f'<summary class="sev-excelente">{html.escape(label)} — '
                f'{vb:.2f} → {va:.2f} ({delta_pct:+.1f}%)</summary>'
                f'<p><strong>Provável causa da melhora:</strong> {html.escape(hint)}</p>'
                f'</details>'
            )
    if not todo:
        todo = ['<p style="color:var(--muted)">Nenhum ponto crítico no momento. 🎯</p>']
    if not done:
        done = ['<p style="color:var(--muted)">Nenhuma melhora ≥ 5% identificada nesta comparação.</p>']
    return "\n".join(todo), "\n".join(done)


def banner(score_pct):
    if score_pct < -10:
        return ("good",
                f"Simetria facial MELHOROU ({score_pct:+.1f}%)",
                "Score geral diminuiu — face mais próxima da linha média.")
    if score_pct > 10:
        return ("bad",
                f"Assimetria AUMENTOU ({score_pct:+.1f}%)",
                "Score geral subiu — confira fatores como pose, iluminação ou expressão antes de concluir mudança estrutural.")
    return ("flat",
            f"Estável ({score_pct:+.1f}%)",
            "Variação dentro da margem de ruído (≤10%).")


def render_advanced(adv_b: dict, adv_a: dict) -> str:
    if not adv_b and not adv_a:
        return ""
    rows = []
    for key, label, ideal_str, ideal_tup in ADVANCED_DISPLAY:
        vb = adv_b.get(key)
        va = adv_a.get(key)
        if vb is None and va is None:
            continue
        def _fmt(v):
            if v is None:           return "—"
            if isinstance(v, str):  return html.escape(v)
            return f"{float(v):.2f}"
        # Forma facial é informativa — sem severidade
        if ideal_tup is None:
            sev_cell = '<td class="center muted">—</td>'
        else:
            sev = adv_severity(ideal_tup, va if isinstance(va, (int, float)) else None)
            sev_cell = f'<td class="center"><span class="pill sev-{sev}">{sev}</span></td>'
        rows.append(
            f'<tr>'
            f'<td>{html.escape(label)}</td>'
            f'<td class="num">{_fmt(vb)}</td>'
            f'<td class="num">{_fmt(va)}</td>'
            f'<td class="muted">{html.escape(ideal_str)}</td>'
            f'{sev_cell}'
            f'</tr>'
        )
    if not rows:
        return ""
    return (
        '<div class="card" style="margin-top:20px;">'
        '<h2>Análise avançada (proporções, dimorfismo, olhos, nariz, boca)</h2>'
        '<table class="adv-table">'
        '<colgroup>'
        '<col style="width:40%"><col style="width:12%"><col style="width:12%">'
        '<col style="width:18%"><col style="width:18%">'
        '</colgroup>'
        '<thead><tr>'
        '<th>Métrica</th><th class="num">Antes</th><th class="num">Depois</th>'
        '<th>Ideal</th><th class="center">Severidade</th>'
        '</tr></thead>'
        f'<tbody>{"".join(rows)}</tbody>'
        '</table>'
        '<p class="legend" style="margin-top:10px;">'
        'Severidade calculada como desvio absoluto do valor ideal de referência '
        '(Farkas, Marquardt, Naini).'
        '</p>'
        '</div>'
    )


def render_quality(pq_b: dict, pq_a: dict, label_b: str, label_a: str) -> str:
    if not pq_b and not pq_a:
        return ""
    def _block(label, pq):
        if not pq:
            return ""
        warns = pq.get("warnings") or []
        warns_html = ""
        if warns:
            warns_html = "<ul style='margin:8px 0 0 1em;color:var(--orange)'>" + \
                "".join(f"<li>{html.escape(w)}</li>" for w in warns) + "</ul>"
        return (
            f'<div class="card">'
            f'<h2>Qualidade — {html.escape(label)}</h2>'
            f'<p style="margin:0 0 6px;">'
            f'Yaw {pq.get("head_pose_yaw_deg",0):+.1f}° · '
            f'Pitch {pq.get("head_pose_pitch_deg",0):+.1f}° · '
            f'Roll {pq.get("head_pose_roll_deg",0):+.1f}°<br>'
            f'Frontalidade: '
            f'<span class="pill sev-{ "excelente" if pq.get("frontal_ok") else "moderada" }">'
            f'{ "OK" if pq.get("frontal_ok") else "fora do limite" }</span><br>'
            f'Sharpness: {pq.get("sharpness_laplacian_var",0):.0f} · '
            f'ΔE iluminação L↔R: {pq.get("lighting_asymmetry_delta_e",0):.1f} · '
            f'Face: {pq.get("face_pixel_width",0)}px<br>'
            f'Distorção focal (nariz/zigomática): '
            f'{pq.get("focal_distortion_ratio",0):.2f}'
            f'{ " ⚠️" if pq.get("focal_distortion_warning") else "" }'
            f'</p>'
            f'{warns_html}'
            f'</div>'
        )
    return (
        '<div class="grid-2" style="margin-top:20px;">'
        f'{_block(label_b, pq_b)}{_block(label_a, pq_a)}'
        '</div>'
    )


def render_action_plan(measurements_after: dict) -> str:
    """Renderiza o card 'Plano de ação' a partir de recommendations.recommend()."""
    items = rec_mod.recommend(measurements_after or {})
    if not items:
        return ""

    def _fmt_value(v):
        if v is None:           return "—"
        if isinstance(v, str):  return html.escape(v)
        return f"{float(v):.2f}"

    cards = []
    for it in items:
        sev = it["severity"]
        actions_html = ""
        if it["actions"]:
            lis = []
            for a in it["actions"]:
                fonte = a.get("fonte") or {}
                fonte_html = ""
                if fonte.get("url"):
                    fonte_html = (
                        f' <a href="{html.escape(fonte["url"])}" '
                        f'target="_blank" rel="noopener noreferrer">'
                        f'[{html.escape(fonte.get("titulo","fonte"))}]</a>'
                    )
                lis.append(
                    f'<li>'
                    f'<span class="tipo">{html.escape(a.get("tipo","-"))}</span>'
                    f'<strong>{html.escape(a.get("titulo",""))}</strong> '
                    f'<span style="color:var(--muted)">({html.escape(a.get("frequencia",""))})</span>'
                    f'<br>{html.escape(a.get("descricao",""))}{fonte_html}'
                    f'</li>'
                )
            actions_html = (
                '<ul class="actions">' + "".join(lis) + '</ul>'
            )
        else:
            if sev == "excelente":
                actions_html = (
                    '<p class="meta-row" style="margin-top:8px;">'
                    '✅ Métrica dentro do ideal — apenas manter os hábitos atuais.'
                    '</p>'
                )

        refs_html = ""
        if it["references"]:
            ref_lis = "".join(
                f'<li><a href="{html.escape(r["url"])}" target="_blank" '
                f'rel="noopener noreferrer">{html.escape(r["titulo"])}</a></li>'
                for r in it["references"]
            )
            refs_html = f'<ul class="refs">{ref_lis}</ul>'

        cards.append(
            f'<details>'
            f'<summary>'
            f'<span>{html.escape(it["metric_label"])} '
            f'<span style="color:var(--muted);font-weight:400;">'
            f'(atual {_fmt_value(it["value"])} · ideal {html.escape(it["ideal"])})</span>'
            f'</span>'
            f'<span class="pill sev-{sev}">{sev}</span>'
            f'</summary>'
            f'<p class="meta-row"><strong>O que é:</strong> {html.escape(it["what_is"])}</p>'
            f'<p class="meta-row"><strong>Como o algoritmo mediu:</strong> {html.escape(it["how_measured"])}</p>'
            f'<p class="meta-row"><strong>Por que importa:</strong> {html.escape(it["why_matters"])}</p>'
            f'{actions_html}'
            f'{refs_html}'
            f'</details>'
        )

    return (
        '<div class="card plan-card" style="margin-top:20px;">'
        '<h2>Plano de ação — o que fazer para melhorar</h2>'
        '<p class="legend" style="margin-bottom:10px;">'
        'Ordenado por severidade. Conteúdo educativo; não substitui avaliação '
        'profissional. Links abrem em nova aba.'
        '</p>'
        + "".join(cards) +
        '</div>'
    )


def render_glossary() -> str:
    """Renderiza o card 'Glossário' a partir de glossary.GLOSSARY."""
    entries = []
    for key, g in gloss_mod.GLOSSARY.items():
        problems = g.get("problemas_comuns") or []
        problems_html = ""
        if problems:
            lis = "".join(f"<li>{html.escape(p)}</li>" for p in problems)
            problems_html = (
                f'<p class="meta-row"><strong>Problemas comuns:</strong></p>'
                f'<ul class="ref-list">{lis}</ul>'
            )
        refs_html = ""
        refs = g.get("referencias") or []
        if refs:
            lis = "".join(
                f'<li><a href="{html.escape(r["url"])}" target="_blank" '
                f'rel="noopener noreferrer">{html.escape(r["titulo"])}</a></li>'
                for r in refs
            )
            refs_html = (
                f'<p class="meta-row"><strong>Referências:</strong></p>'
                f'<ul class="ref-list">{lis}</ul>'
            )
        entries.append(
            f'<details>'
            f'<summary>{html.escape(g["termo"])} '
            f'<span style="color:var(--muted);font-weight:400;font-size:.9em">'
            f'· {html.escape(g.get("unidade",""))}</span>'
            f'</summary>'
            f'<p>{html.escape(g["descricao"])}</p>'
            f'<p class="meta-row"><strong>Como medimos:</strong> {html.escape(g["como_medido"])}</p>'
            f'<p class="meta-row"><strong>Faixas típicas:</strong> {html.escape(g.get("faixas",""))}</p>'
            f'{problems_html}'
            f'{refs_html}'
            f'</details>'
        )
    return (
        '<div class="card glossary" style="margin-top:20px;">'
        '<h2>Glossário — termos, métricas e referências</h2>'
        + "".join(entries) +
        '</div>'
    )


def build(report_b: dict, report_a: dict,
          label_b: str, label_a: str, output_path: str):
    m_b = report_b.get("measurements", report_b)
    m_a = report_a.get("measurements", report_a)

    normalized = (SCORE_KEY_NORM in m_b and SCORE_KEY_NORM in m_a)
    score_key = SCORE_KEY_NORM if normalized else SCORE_KEY_PX
    unit = "%IPD" if normalized else "px"

    score_b = m_b.get(score_key, 0.0)
    score_a = m_a.get(score_key, 0.0)
    if score_b > 1e-6:
        score_pct = (score_a - score_b) / score_b * 100
    else:
        score_pct = 0.0

    sev_b = severity(score_b, normalized)
    sev_a = severity(score_a, normalized)

    img_b = b64_image(find_image(report_b, "annotated_image"))
    img_a = b64_image(find_image(report_a, "annotated_image"))
    hm_b  = b64_image(find_image(report_b, "heatmap"))
    hm_a  = b64_image(find_image(report_a, "heatmap"))

    img_tag = lambda src: f'<img src="{src}">' if src else '<span style="color:#666">imagem indisponível</span>'

    rows = render_rows(m_b, m_a)
    todo, done = render_lists(m_b, m_a)
    bclass, btitle, btext = banner(score_pct)

    adv_block = render_advanced(m_b.get("advanced") or {}, m_a.get("advanced") or {})
    qual_block = render_quality(
        m_b.get("photo_quality") or {}, m_a.get("photo_quality") or {},
        label_b, label_a,
    )
    plan_block = render_action_plan(m_a)
    glossary_block = render_glossary()

    # Guia de comparação (texto + checklist)
    cg = IMAGE_GUIDES["comparison"]
    paras = "".join(f"<p>{html.escape(p)}</p>" for p in cg["paragrafos"])
    items = "".join(f"<li>{html.escape(i)}</li>" for i in cg["checklist"])
    comparison_guide = (
        f'<div class="img-guide" style="padding:14px 16px;">'
        f'{paras}<ul class="checklist">{items}</ul></div>'
    )

    repl = {
        "__GENERATED__":      datetime.now().strftime("%d/%m/%Y %H:%M"),
        "__LABEL_BEFORE__":   html.escape(label_b),
        "__LABEL_AFTER__":    html.escape(label_a),
        "__FILE_BEFORE__":    html.escape(str(report_b.get("input_file", ""))),
        "__FILE_AFTER__":     html.escape(str(report_a.get("input_file", ""))),
        "__IMG_BEFORE_BLOCK__": render_image_with_guide(img_b, "annotated"),
        "__IMG_AFTER_BLOCK__":  render_image_with_guide(img_a, "annotated"),
        "__HM_BEFORE_BLOCK__":  render_image_with_guide(hm_b, "heatmap"),
        "__HM_AFTER_BLOCK__":   render_image_with_guide(hm_a, "heatmap"),
        "__COMPARISON_GUIDE__": comparison_guide,
        "__SCORE_BEFORE__":   f"{score_b:.2f}",
        "__SCORE_AFTER__":    f"{score_a:.2f}",
        "__UNIT__":           unit,
        "__SEV_BEFORE__":     sev_b,
        "__SEV_AFTER__":      sev_a,
        "__SEV_BEFORE_LABEL__": sev_b.title(),
        "__SEV_AFTER_LABEL__":  sev_a.title(),
        "__BANNER_CLASS__":   bclass,
        "__BANNER_TITLE__":   html.escape(btitle),
        "__BANNER_TEXT__":    html.escape(btext),
        "__ROWS__":           rows,
        "__TODO_LIST__":      todo,
        "__DONE_LIST__":      done,
        "__ADVANCED_BLOCK__": adv_block,
        "__QUALITY_BLOCK__":  qual_block,
        "__PLAN_BLOCK__":     plan_block,
        "__GLOSSARY_BLOCK__": glossary_block,
    }

    out = HTML_TMPL
    for k, v in repl.items():
        out = out.replace(k, v)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(out)
    print(f"HTML salvo em: {output_path}")


def main():
    p = argparse.ArgumentParser(description="Gera relatório HTML autocontido.")
    p.add_argument("--before", required=True, help="JSON do relatório ANTES")
    p.add_argument("--after",  required=True, help="JSON do relatório DEPOIS")
    p.add_argument("--label-before", default="ANTES")
    p.add_argument("--label-after",  default="DEPOIS")
    p.add_argument("--output", default="relatorio.html")
    args = p.parse_args()

    for path in (args.before, args.after):
        if not os.path.exists(path):
            print(f"Erro: não encontrado {path}", file=sys.stderr)
            sys.exit(1)

    rb = load_report(args.before)
    ra = load_report(args.after)
    build(rb, ra, args.label_before, args.label_after, args.output)


if __name__ == "__main__":
    main()
