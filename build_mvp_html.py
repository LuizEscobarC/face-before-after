#!/usr/bin/env python3
"""
Gera relatório HTML MVP — visual premium, autocontido (sem servidor).
Imagens embutidas em base64.

Uso:
    python build_mvp_html.py resultado_mvp/depois_mvp_report.json
    python build_mvp_html.py resultado_mvp/depois_mvp_report.json -o relatorio_mvp.html
"""

import argparse
import base64
import html
import json
import os
import sys
from pathlib import Path


# ──────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────

def _img_b64(path: str) -> str | None:
    """Converte imagem para data URI base64, retorna None se não existir."""
    if not path:
        return None
    p = Path(path)
    if not p.exists():
        return None
    ext = p.suffix.lower().lstrip(".")
    mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png"}.get(ext, "jpeg")
    with open(p, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    return f"data:image/{mime};base64,{b64}"


def _score_color(score: int) -> str:
    if score >= 80:
        return "#22d3ee"   # cyan
    if score >= 60:
        return "#a78bfa"   # purple
    return "#fb923c"        # orange


def _tier_emoji(tier: str) -> str:
    t = tier.lower()
    if "muito" in t:
        return "🏆"
    if "boa" in t or "good" in t:
        return "✨"
    if "moderada" in t:
        return "⚡"
    return "🔍"


def _action_icon(rank: int) -> str:
    return ["🥇", "🥈", "🥉"][rank - 1] if rank <= 3 else "▸"


def _phase_icon(phase_key: str) -> str:
    icons = {"phase_1": "⚡", "phase_2": "🎯", "phase_3": "🏅"}
    return icons.get(phase_key, "▸")


# ──────────────────────────────────────────────────────────────
# Build HTML
# ──────────────────────────────────────────────────────────────

def build_html(data: dict) -> str:
    analysis_mode = data.get("analysis_mode", "premium")
    is_premium = analysis_mode == "premium"

    score = data.get("score", 0)
    tier = data.get("tier", "")
    tier_desc = data.get("tier_description", "")
    benchmark_msg = data.get("benchmark_message", "")
    score_ctx = data.get("score_context", "")

    fi = data.get("first_impression", {})
    headline = fi.get("headline", "")
    positive_signal = fi.get("positive_signal", "")
    top_leverage = data.get("top_leverage", {})
    premium_metrics_catalog = data.get("premium_metrics_catalog", [])

    vs = data.get("visual_status", {})
    dominance = vs.get("dominance_score", 0)
    attractiveness = vs.get("attractiveness_score", 0)
    freshness = vs.get("freshness_score", 0)
    narrative = vs.get("narrative", "")

    actions = data.get("top3_actions_v2", [])

    ep = data.get("evolution_path", {})
    phases = [
        ("phase_1", ep.get("phase_1", {})),
        ("phase_2", ep.get("phase_2", {})),
        ("phase_3", ep.get("phase_3", {})),
    ]

    ns = data.get("next_step", {})
    cta_text = ns.get("cta_text", "Começar agora")
    urgency = ns.get("urgency_hook", "")
    ns_msg = ns.get("message", "")

    # Simulações
    sim = data.get("simulation_paths") or {}
    sim_sym = _img_b64(sim.get("symmetrized"))
    sim_ideal = _img_b64(sim.get("ideal_proportions"))
    sim_grid = _img_b64(sim.get("comparison_grid"))

    # Foto anotada MVP
    annotated_path = data.get("annotated_image_path", "")
    if annotated_path:
      annotated_b64 = _img_b64(annotated_path)
    else:
      input_path = data.get("input_file", "")
      if input_path:
        stem = Path(input_path).stem
        ann_path = f"resultado_mvp/{stem}_mvp_annotated.jpg"
        annotated_b64 = _img_b64(ann_path)
      else:
        annotated_b64 = None

    score_col = _score_color(score)

    # Métricas de percepção (barras 0–10)
    perception_metrics = []
    if is_premium:
      perception_metrics = [
        ("Dominância", dominance),
        ("Atratividade", attractiveness),
        ("Vitalidade", freshness),
      ]

    # ── Score arc SVG (semicírculo) ──────────────────────────
    # range 0–100, arco de 180°
    angle = score * 1.8  # graus (0–180)
    import math
    rad = math.radians(180 - angle)
    cx, cy, r = 100, 100, 80
    x_end = cx + r * math.cos(math.radians(180 - angle))
    y_end = cy - r * math.sin(math.radians(180 - angle))
    large = 1 if angle > 180 else 0

    score_arc_svg = f"""
    <svg viewBox="0 0 200 110" class="score-arc">
      <defs>
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#6366f1"/>
          <stop offset="100%" stop-color="{score_col}"/>
        </linearGradient>
      </defs>
      <!-- track -->
      <path d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14" stroke-linecap="round"/>
      <!-- fill -->
      <path d="M 20 100 A 80 80 0 {large} 1 {x_end:.2f} {y_end:.2f}"
            fill="none" stroke="url(#arcGrad)" stroke-width="14" stroke-linecap="round"/>
      <text x="100" y="90" text-anchor="middle"
            font-size="38" font-weight="800" fill="{score_col}" font-family="system-ui">{score}</text>
      <text x="100" y="108" text-anchor="middle"
            font-size="10" fill="rgba(255,255,255,0.55)" font-family="system-ui">/ 100</text>
    </svg>
    """

    # ── Barras de percepção ──────────────────────────────────
    def bar_html(label, value, max_val=10):
        pct = min(value / max_val * 100, 100)
        col = "#22d3ee" if pct >= 65 else "#a78bfa" if pct >= 40 else "#fb923c"
        return f"""
        <div class="bar-row">
          <span class="bar-label">{label}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:{pct:.1f}%;background:{col}"></div>
          </div>
          <span class="bar-val">{value:.1f}</span>
        </div>"""

    bars_html = "".join(bar_html(l, v) for l, v in perception_metrics)

    # ── Ações ────────────────────────────────────────────────
    def action_card(a):
        rank = a.get("rank", 0)
        ico = _action_icon(rank)
        title = a.get("short_action", "")
        why = a.get("why_it_matters", "")
        time = a.get("time_to_result", "")
        return f"""
        <div class="action-card">
          <div class="action-rank">{ico}</div>
          <div class="action-body">
            <div class="action-title">{title}</div>
            <div class="action-why">{why}</div>
            {f'<div class="action-time">⏱ Resultado: {time}</div>' if time else ''}
          </div>
        </div>"""

    actions_html = "".join(action_card(a) for a in actions)

    # ── Fases de evolução ────────────────────────────────────
    def phase_card(key, ph):
        if not ph:
            return ""
        ico = _phase_icon(key)
        label = ph.get("label", "")
        focus = ph.get("focus", "")
        phase_actions = ph.get("actions", [])
        reanalysis = ph.get("reanalysis_label", "")
        conf_label = ph.get("confidence_label", "")
        action_items = "".join(
            f'<li>{a.get("titulo", "")} <span class="phase-freq">({a.get("frequencia", "")})</span></li>'
            for a in phase_actions
        )
        return f"""
        <div class="phase-card">
          <div class="phase-header">
            <span class="phase-icon">{ico}</span>
            <div>
              <div class="phase-label">{label}</div>
              <div class="phase-focus">{focus}</div>
            </div>
          </div>
          {f'<ul class="phase-actions">{action_items}</ul>' if action_items else ''}
          <div class="phase-meta">
            {f'Reanálise {reanalysis}' if reanalysis else ''}
            {f' · Confiança: <strong>{conf_label}</strong>' if conf_label else ''}
          </div>
        </div>"""

    phases_html = "".join(phase_card(k, ph) for k, ph in phases)

    # ── Simulações ───────────────────────────────────────────
    sim_section = ""
    sim_items = [
        (sim_sym,   "Simetria simulada"),
        (sim_ideal, "Proporções ideais"),
        (sim_grid,  "Comparativo"),
    ]
    valid_sims = [(src, lbl) for src, lbl in sim_items if src]
    if valid_sims:
        sim_cards = "".join(
            f'<figure class="sim-card">'
            f'<img src="{src}" alt="{lbl}" loading="lazy"/>'
            f'<figcaption>{lbl}</figcaption>'
            f'</figure>'
            for src, lbl in valid_sims
        )
        sim_section = f"""
        <section class="section">
          <h2 class="section-title">🖼 Simulação Visual</h2>
          <p class="section-sub">Veja como pequenos ajustes transformam a percepção de presença.</p>
          <div class="sim-grid">{sim_cards}</div>
        </section>"""

    # ── Foto anotada ─────────────────────────────────────────
    annotated_section = ""
    if annotated_b64:
        annotated_section = f"""
        <div class="annotated-wrap">
          <img src="{annotated_b64}" alt="Análise facial" class="annotated-img"/>
          <p class="annotated-caption">Mapa de métricas detectadas</p>
        </div>"""

    def _render_metrics_catalog(catalog):
        if not catalog:
            return ""

        sev_class = {
            "excelente": "sev-excelente",
            "leve": "sev-leve",
            "moderada": "sev-moderada",
            "acentuada": "sev-acentuada",
            "severa": "sev-severa",
            "informativa": "sev-info",
        }

        groups = []
        for idx, category in enumerate(catalog):
            rows = []
            for metric in category.get("metrics", []):
                severity = str(metric.get("severity", "informativa"))
                severity_css = sev_class.get(severity, "sev-info")
                label = html.escape(str(metric.get("label", "")))
                value = html.escape(str(metric.get("display_value", "—")))
                unit = html.escape(str(metric.get("unit", "")))
                ideal = html.escape(str(metric.get("ideal", "")))
                metric_class = html.escape(str(metric.get("metric_class", "")))
                rows.append(
                    f"<tr>"
                    f"<td>{label}</td>"
                    f"<td>{value}</td>"
                    f"<td>{unit or '—'}</td>"
                    f"<td>{ideal or '—'}</td>"
                    f"<td><span class='sev-pill {severity_css}'>{html.escape(severity)}</span></td>"
                    f"<td>{metric_class}</td>"
                    f"</tr>"
                )

            count = int(category.get("count", len(rows)))
            title = html.escape(str(category.get("title", "Categoria")))
            open_attr = " open" if idx == 0 else ""
            groups.append(
                f"<details class='metric-group'{open_attr}>"
                f"<summary>{title} <span class='metric-count'>{count} métricas</span></summary>"
                f"<div class='metric-table-wrap'>"
                f"<table class='metric-table'>"
                f"<thead><tr><th>Métrica</th><th>Valor</th><th>Unidade</th><th>Ideal</th><th>Severidade</th><th>Classe</th></tr></thead>"
                f"<tbody>{''.join(rows)}</tbody>"
                f"</table>"
                f"</div>"
                f"</details>"
            )

        return (
            "<section class='section'>"
            "<h2 class='section-title'>📚 Métricas Completas (Premium)</h2>"
            "<p class='section-sub'>Todas as métricas calculadas para este rosto, organizadas por categoria.</p>"
            f"{''.join(groups)}"
            "</section>"
        )

    first_impression_section = f"""
    <section class="section">
      <h2 class="section-title">👁 Primeira Impressão</h2>
      <p class="section-sub">O que a percepção externa capta nos primeiros segundos.</p>

      <div class="headline-box">
        <div class="headline-text">{headline}</div>
        {f'<div class="positive-signal">✅ {positive_signal}</div>' if positive_signal and positive_signal not in headline else ''}
      </div>

      {annotated_section}
    </section>"""

    teaser_leverage_section = ""
    perception_section = ""
    actions_section = ""
    evolution_section = ""
    teaser_unlock_section = ""
    metrics_catalog_section = ""

    if is_premium:
        perception_section = f"""
        <section class="section">
          <h2 class="section-title">📈 Percepção Visual</h2>
          <p class="section-sub">Métricas de impacto percebido (escala 0–10).</p>
          {bars_html}
          {f'<p class="narrative">"{narrative}"</p>' if narrative else ''}
        </section>"""

        actions_section = f"""
        <section class="section">
          <h2 class="section-title">✨ Seus Refinamentos de Alto Impacto</h2>
          <p class="section-sub">Ações ordenadas por impacto × facilidade de execução.</p>
          <div class="actions-header">3 refinamentos identificados</div>
          {actions_html if actions_html else '<p style="color:var(--muted);font-size:14px">Nenhuma ação disponível.</p>'}
        </section>"""

        evolution_section = f"""
        <section class="section">
          <h2 class="section-title">🗺 Caminho de Evolução</h2>
          <p class="section-sub">Plano em fases, do mais imediato ao mais estrutural.</p>
          {phases_html}
        </section>"""
        metrics_catalog_section = _render_metrics_catalog(premium_metrics_catalog)
    else:
        sim_section = ""
        teaser_leverage_section = f"""
        <section class="section">
          <h2 class="section-title">🎯 Sua Maior Alavanca Agora</h2>
          <p class="section-sub">Seu relatório gratuito mostra o primeiro passo com maior retorno visual.</p>
          <div class="action-card">
            <div class="action-rank">🔥</div>
            <div class="action-body">
              <div class="action-title">{top_leverage.get('short_action', 'Melhorar captura e postura')}</div>
              <div class="action-why">{top_leverage.get('why_it_matters', 'A versão premium mostra o mapa completo de métricas e prioridades personalizadas.')}</div>
              {f'<div class="action-time">⏱ Resultado: {top_leverage.get("time_to_result")}</div>' if top_leverage.get('time_to_result') else ''}
            </div>
          </div>
        </section>"""

        teaser_unlock_section = """
        <section class="section">
          <h2 class="section-title">🔒 O Que Você Desbloqueia no Premium</h2>
          <ul class="unlock-list">
            <li>Todas as métricas avançadas por categoria</li>
            <li>Simulação visual completa (simetria e proporções)</li>
            <li>Top 3 refinamentos priorizados por impacto</li>
            <li>Plano em 3 fases com checkpoints de evolução</li>
          </ul>
        </section>"""

    # ──────────────────────────────────────────────────────────
    # CSS + HTML final
    # ──────────────────────────────────────────────────────────
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Face Before/After — Sua Análise</title>
<style>
  /* ── Reset & base ───────────────────────────────────── */
  *{{box-sizing:border-box;margin:0;padding:0}}
  :root{{
    --bg:#0a0a12;
    --surface:#13131f;
    --surface2:#1c1c2e;
    --border:rgba(255,255,255,0.07);
    --text:#e2e8f0;
    --muted:#94a3b8;
    --accent:#6366f1;
    --accent2:#22d3ee;
    --radius:16px;
    --shadow:0 8px 40px rgba(0,0,0,0.6);
  }}
  body{{
    background:var(--bg);
    color:var(--text);
    font-family:'Segoe UI',system-ui,sans-serif;
    line-height:1.6;
    min-height:100vh;
  }}

  /* ── Layout ─────────────────────────────────────────── */
  .page{{max-width:760px;margin:0 auto;padding:0 20px 60px}}

  /* ── Hero ───────────────────────────────────────────── */
  .hero{{
    background:linear-gradient(145deg,#0f0f2a 0%,#1a0a2e 60%,#0a1a2e 100%);
    border-bottom:1px solid var(--border);
    padding:56px 20px 40px;
    text-align:center;
    position:relative;
    overflow:hidden;
  }}
  .hero::before{{
    content:"";
    position:absolute;inset:0;
    background:radial-gradient(ellipse 70% 60% at 50% 0%,rgba(99,102,241,0.18) 0%,transparent 70%);
    pointer-events:none;
  }}
  .hero-badge{{
    display:inline-block;
    background:rgba(99,102,241,0.18);
    border:1px solid rgba(99,102,241,0.4);
    color:#a5b4fc;
    font-size:11px;
    font-weight:700;
    letter-spacing:.12em;
    text-transform:uppercase;
    padding:4px 14px;
    border-radius:99px;
    margin-bottom:20px;
  }}
  .hero-title{{
    font-size:clamp(22px,5vw,34px);
    font-weight:800;
    line-height:1.2;
    max-width:560px;
    margin:0 auto 12px;
    background:linear-gradient(135deg,#e2e8f0 30%,#a78bfa);
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
  }}
  .hero-sub{{
    color:var(--muted);
    font-size:15px;
    max-width:480px;
    margin:0 auto 32px;
  }}

  /* ── Score ──────────────────────────────────────────── */
  .score-wrap{{
    display:flex;
    flex-direction:column;
    align-items:center;
    gap:8px;
    margin-bottom:20px;
  }}
  .score-arc{{width:200px;height:110px}}
  .tier-badge{{
    display:inline-flex;align-items:center;gap:6px;
    background:rgba(34,211,238,0.12);
    border:1px solid rgba(34,211,238,0.3);
    color:#67e8f9;
    font-size:13px;font-weight:700;
    padding:5px 16px;border-radius:99px;
  }}
  .tier-desc{{color:var(--muted);font-size:13px;max-width:380px;text-align:center}}

  /* ── Seções ─────────────────────────────────────────── */
  .section{{
    background:var(--surface);
    border:1px solid var(--border);
    border-radius:var(--radius);
    padding:28px 24px;
    margin-top:20px;
    box-shadow:var(--shadow);
  }}
  .section-title{{
    font-size:17px;font-weight:700;
    margin-bottom:6px;
    display:flex;align-items:center;gap:8px;
  }}
  .section-sub{{color:var(--muted);font-size:13px;margin-bottom:20px}}

  /* ── Headline insight ───────────────────────────────── */
  .headline-box{{
    background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(34,211,238,0.06));
    border:1px solid rgba(99,102,241,0.25);
    border-radius:12px;
    padding:20px 22px;
    margin-top:16px;
  }}
  .headline-text{{
    font-size:17px;font-weight:600;line-height:1.5;
    background:linear-gradient(135deg,#e2e8f0,#a5b4fc);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  }}
  .positive-signal{{
    color:var(--muted);font-size:13px;margin-top:10px;
  }}

  /* ── Barras de percepção ────────────────────────────── */
  .bar-row{{
    display:flex;align-items:center;gap:12px;margin-bottom:12px;
  }}
  .bar-label{{font-size:13px;min-width:90px;color:var(--muted)}}
  .bar-track{{
    flex:1;height:6px;background:rgba(255,255,255,0.07);
    border-radius:99px;overflow:hidden;
  }}
  .bar-fill{{height:100%;border-radius:99px;transition:width .6s ease}}
  .bar-val{{font-size:13px;font-weight:700;min-width:28px;text-align:right}}
  .narrative{{
    color:var(--muted);font-size:14px;margin-top:16px;
    padding-top:16px;border-top:1px solid var(--border);
    font-style:italic;
  }}

  /* ── Benchmark strip ────────────────────────────────── */
  .benchmark-strip{{
    background:linear-gradient(90deg,rgba(34,211,238,0.08),rgba(99,102,241,0.08));
    border:1px solid rgba(34,211,238,0.2);
    border-radius:10px;
    padding:14px 18px;
    margin-top:20px;
    display:flex;align-items:flex-start;gap:12px;
  }}
  .benchmark-icon{{font-size:20px;flex-shrink:0;margin-top:1px}}
  .benchmark-text{{font-size:14px;color:#e2e8f0}}
  .benchmark-ctx{{font-size:12px;color:var(--muted);margin-top:3px}}

  /* ── Foto anotada ───────────────────────────────────── */
  .annotated-wrap{{
    text-align:center;margin-top:20px;
  }}
  .annotated-img{{
    max-width:260px;border-radius:12px;
    border:1px solid var(--border);
    box-shadow:0 4px 20px rgba(0,0,0,0.5);
  }}
  .annotated-caption{{
    font-size:11px;color:var(--muted);margin-top:6px;
  }}

  /* ── Action cards ───────────────────────────────────── */
  .actions-header{{
    font-size:11px;font-weight:700;letter-spacing:.1em;
    text-transform:uppercase;color:#a78bfa;margin-bottom:14px;
  }}
  .action-card{{
    display:flex;gap:14px;align-items:flex-start;
    background:var(--surface2);
    border:1px solid var(--border);
    border-radius:12px;
    padding:16px 18px;
    margin-bottom:10px;
  }}
  .action-rank{{font-size:22px;flex-shrink:0;line-height:1}}
  .action-body{{flex:1}}
  .action-title{{font-size:15px;font-weight:700;margin-bottom:4px}}
  .action-why{{font-size:13px;color:var(--muted);line-height:1.5}}
  .action-time{{
    font-size:11px;color:#67e8f9;
    margin-top:6px;font-weight:600;
  }}

  /* ── Fases ──────────────────────────────────────────── */
  .phase-card{{
    background:var(--surface2);
    border:1px solid var(--border);
    border-radius:12px;
    padding:18px 20px;
    margin-bottom:12px;
  }}
  .phase-header{{display:flex;gap:12px;align-items:flex-start;margin-bottom:12px}}
  .phase-icon{{font-size:22px;flex-shrink:0;line-height:1}}
  .phase-label{{font-size:12px;font-weight:700;color:#a78bfa;text-transform:uppercase;letter-spacing:.06em}}
  .phase-focus{{font-size:14px;font-weight:600;margin-top:3px}}
  .phase-actions{{
    padding-left:20px;margin-bottom:10px;
    font-size:13px;color:var(--muted);
  }}
  .phase-actions li{{margin-bottom:5px}}
  .phase-freq{{color:#6366f1;font-size:12px}}
  .phase-meta{{font-size:11px;color:var(--muted)}}

  /* ── Simulações ─────────────────────────────────────── */
  .sim-grid{{
    display:grid;
    grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
    gap:12px;
    margin-top:16px;
  }}
  .sim-card{{
    background:var(--surface2);
    border:1px solid var(--border);
    border-radius:12px;
    overflow:hidden;
    text-align:center;
  }}
  .sim-card img{{
    width:100%;display:block;
    aspect-ratio:1/1;object-fit:cover;
  }}
  .sim-card figcaption{{
    font-size:11px;color:var(--muted);
    padding:8px 10px;
  }}

  /* ── Teaser unlock ─────────────────────────────────── */
  .unlock-list{{
    list-style:none;
    display:grid;
    gap:10px;
    font-size:14px;
    color:var(--muted);
  }}
  .unlock-list li{{
    padding:10px 12px;
    border:1px solid var(--border);
    border-radius:10px;
    background:var(--surface2);
  }}

  /* ── Catálogo de métricas ─────────────────────────── */
  .metric-group{{
    margin-bottom:10px;
    border:1px solid var(--border);
    border-radius:10px;
    background:var(--surface2);
    overflow:hidden;
  }}
  .metric-group summary{{
    list-style:none;
    cursor:pointer;
    font-size:13px;
    font-weight:700;
    padding:12px 14px;
    display:flex;
    justify-content:space-between;
    align-items:center;
  }}
  .metric-group summary::-webkit-details-marker{{display:none}}
  .metric-count{{
    color:var(--muted);
    font-size:11px;
    font-weight:600;
  }}
  .metric-table-wrap{{
    overflow:auto;
    border-top:1px solid var(--border);
  }}
  .metric-table{{
    width:100%;
    border-collapse:collapse;
    min-width:720px;
    font-size:12px;
  }}
  .metric-table th,
  .metric-table td{{
    text-align:left;
    padding:8px 10px;
    border-bottom:1px solid rgba(255,255,255,0.05);
    vertical-align:top;
  }}
  .metric-table th{{
    color:#cbd5e1;
    font-size:11px;
    text-transform:uppercase;
    letter-spacing:.03em;
  }}
  .sev-pill{{
    display:inline-block;
    padding:3px 8px;
    border-radius:999px;
    font-size:10px;
    font-weight:700;
    text-transform:uppercase;
    letter-spacing:.03em;
  }}
  .sev-excelente{{background:rgba(16,185,129,.2); color:#6ee7b7; border:1px solid rgba(16,185,129,.35)}}
  .sev-leve{{background:rgba(34,211,238,.2); color:#67e8f9; border:1px solid rgba(34,211,238,.35)}}
  .sev-moderada{{background:rgba(168,85,247,.2); color:#d8b4fe; border:1px solid rgba(168,85,247,.35)}}
  .sev-acentuada{{background:rgba(249,115,22,.2); color:#fdba74; border:1px solid rgba(249,115,22,.35)}}
  .sev-severa{{background:rgba(239,68,68,.2); color:#fda4af; border:1px solid rgba(239,68,68,.35)}}
  .sev-info{{background:rgba(148,163,184,.2); color:#cbd5e1; border:1px solid rgba(148,163,184,.35)}}

  /* ── CTA section ────────────────────────────────────── */
  .cta-section{{
    background:linear-gradient(135deg,#1a0a2e 0%,#0f1a2e 100%);
    border:1px solid rgba(99,102,241,0.3);
    border-radius:var(--radius);
    padding:36px 28px;
    margin-top:20px;
    text-align:center;
    box-shadow:0 0 60px rgba(99,102,241,0.12);
  }}
  .urgency{{
    font-size:15px;color:var(--muted);margin-bottom:12px;
  }}
  .ns-msg{{
    font-size:17px;font-weight:700;margin-bottom:24px;
    background:linear-gradient(135deg,#e2e8f0,#a78bfa);
    -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  }}
  .cta-btn{{
    display:inline-block;
    background:linear-gradient(135deg,#6366f1,#a78bfa);
    color:#fff;font-weight:800;font-size:16px;
    padding:16px 40px;
    border-radius:99px;
    text-decoration:none;
    box-shadow:0 8px 32px rgba(99,102,241,0.45);
    transition:transform .15s,box-shadow .15s;
    cursor:pointer;border:none;
  }}
  .cta-btn:hover{{
    transform:translateY(-2px);
    box-shadow:0 12px 40px rgba(99,102,241,0.6);
  }}

  /* ── Footer ─────────────────────────────────────────── */
  .footer{{
    text-align:center;font-size:11px;color:rgba(255,255,255,0.2);
    margin-top:40px;padding:20px;
  }}

  /* ── Responsive ─────────────────────────────────────── */
  @media(max-width:480px){{
    .hero{{padding:40px 16px 30px}}
    .section{{padding:20px 16px}}
    .action-card{{flex-direction:column;gap:8px}}
  }}
</style>
</head>
<body>

<!-- ── HERO ─────────────────────────────────────────────────── -->
<div class="hero">
  <div class="page">
    <div class="hero-badge">Face Before/After · Análise de Presença Visual</div>
    <h1 class="hero-title">Sua análise facial está pronta</h1>
    <p class="hero-sub">Veja o que os outros percebem — e o que é possível melhorar.</p>

    <div class="score-wrap">
      {score_arc_svg}
      <div class="tier-badge">{_tier_emoji(tier)} {tier}</div>
      <div class="tier-desc">{tier_desc}</div>
    </div>
  </div>
</div>

<!-- ── CONTEÚDO ──────────────────────────────────────────────── -->
<div class="page">

  <!-- Benchmark -->
  <div class="benchmark-strip" style="margin-top:20px">
    <div class="benchmark-icon">📊</div>
    <div>
      <div class="benchmark-text">{benchmark_msg}</div>
      <div class="benchmark-ctx">{score_ctx}</div>
    </div>
  </div>

  {first_impression_section}
  {teaser_leverage_section}
  {perception_section}
  {actions_section}
  {sim_section}
  {evolution_section}
  {metrics_catalog_section}
  {teaser_unlock_section}

  <!-- CTA -->
  <div class="cta-section">
    <div class="urgency">{urgency}</div>
    <div class="ns-msg">{ns_msg}</div>
    <button class="cta-btn">{cta_text}</button>
  </div>

</div>

<!-- ── FOOTER ────────────────────────────────────────────────── -->
<div class="footer">
  Face Before/After — Análise de Presença Visual
</div>

</body>
</html>"""


# ──────────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Gera HTML premium a partir do relatório MVP JSON")
    parser.add_argument("json_file", help="Caminho para o arquivo *_mvp_report.json")
    parser.add_argument("-o", "--output", default=None,
                        help="Arquivo HTML de saída (padrão: mesmo nome .html)")
    args = parser.parse_args()

    json_path = Path(args.json_file)
    if not json_path.exists():
        print(f"Erro: arquivo não encontrado: {json_path}", file=sys.stderr)
        sys.exit(1)

    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    out_path = Path(args.output) if args.output else json_path.with_suffix(".html")

    html = build_html(data)
    out_path.write_text(html, encoding="utf-8")
    print(f"✓ HTML gerado → {out_path}")


if __name__ == "__main__":
    main()
