import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchGlossary } from "../api";
import { MetricExplainer } from "../components/MetricExplainer";
import { feynmanFor } from "../data/feynman";
import type { AnalysisResult, GlossaryTerm, PremiumMetricCategory } from "../types";

type LocationState = { result?: AnalysisResult };

const RANK_EMOJI = ["🥇", "🥈", "🥉"];
const PHASE_ICON = ["⚡", "🎯", "🏅"];
const TIER_LABEL: Record<number, string> = { 0: "Grátis", 1: "Essential", 2: "Premium" };

function severityClass(severity: string): string {
  const key = severity.toLowerCase();
  if (key.includes("excel")) return "sev-pill sev-excelente";
  if (key.includes("leve")) return "sev-pill sev-leve";
  if (key.includes("moder")) return "sev-pill sev-moderada";
  if (key.includes("acent")) return "sev-pill sev-acentuada";
  if (key.includes("sever")) return "sev-pill sev-severa";
  return "sev-pill sev-info";
}

function scoreColor(score: number): string {
  return score >= 60 ? "#22d3ee" : "#a78bfa";
}

function ScoreArc({ score }: { score: number }) {
  const r = 80;
  const cx = 100;
  const cy = 100;
  const angle = score * 1.8;
  const rad = ((180 - angle) * Math.PI) / 180;
  const ex = cx + r * Math.cos(rad);
  const ey = cy - r * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;
  const color = scoreColor(score);

  return (
    <svg viewBox="0 0 200 110" className="score-arc">
      <defs>
        <linearGradient id="arcGradP" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
      <path
        d="M 20 100 A 80 80 0 0 1 180 100"
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {score > 0 && (
        <path
          d={`M 20 100 A 80 80 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`}
          fill="none"
          stroke="url(#arcGradP)"
          strokeWidth="14"
          strokeLinecap="round"
        />
      )}
      <text x={cx} y={90} textAnchor="middle" fontSize="38" fontWeight="800" fill={color} fontFamily="system-ui">
        {score}
      </text>
      <text x={cx} y={108} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.55)" fontFamily="system-ui">
        / 100
      </text>
    </svg>
  );
}

function BarRow({ label, value }: { label: string; value: number | undefined }) {
  const pct = ((value ?? 0) / 10) * 100;
  const val = value?.toFixed(1) ?? "—";
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="bar-val">{val}</div>
    </div>
  );
}

function MetricsCategory({
  category,
  glossary,
}: {
  category: PremiumMetricCategory;
  glossary: Record<string, GlossaryTerm>;
}) {
  return (
    <details className="metric-group">
      <summary>
        {category.title} <span className="metric-count">{category.count} métricas</span>
      </summary>
      <div className="metric-explainer-list">
        {category.metrics.map((m) => (
          <MetricExplainer
            key={`${category.slug}-${m.key}`}
            metricKey={m.key}
            label={m.label}
            value={m.display_value}
            unit={m.unit}
            ideal={m.ideal}
            severity={m.severity}
            glossary={glossary}
          />
        ))}
      </div>
    </details>
  );
}

export function PremiumResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as LocationState | null)?.result;

  const [glossary, setGlossary] = useState<Record<string, GlossaryTerm>>({});
  useEffect(() => {
    fetchGlossary()
      .then(setGlossary)
      .catch(() => {/* silenciar se indisponível */});
  }, []);

  if (!result) {
    return (
      <div className="page" style={{ paddingTop: 60 }}>
        <section className="section">
          <h1 className="section-title">Resultado Premium não encontrado</h1>
          <p>Faça uma nova análise premium para visualizar os dados completos.</p>
          <button className="cta-btn" style={{ marginTop: 20 }} onClick={() => navigate("/")}>
            Voltar para captura
          </button>
        </section>
      </div>
    );
  }

  const annotatedUrl = result.run_id ? `/api/result/${result.run_id}/annotated` : null;
  const simBase = result.run_id ? `/api/result/${result.run_id}/simulation` : null;
  const hasSimulation = simBase && result.simulation_paths && !result.simulation_error;
  const hasWarnings = (result.photo_warnings?.length ?? 0) > 0;
  const hasRecs = (result.capture_recommendations?.length ?? 0) > 0;
  const phases = [
    result.evolution_path?.phase_1,
    result.evolution_path?.phase_2,
    result.evolution_path?.phase_3,
  ];

  return (
    <>
      {/* ── HERO ── */}
      <div className="hero">
        <div className="page">
          <div className="hero-badge">Face Before/After · Análise de Presença Visual</div>
          <h1 className="hero-title">Sua análise facial está pronta</h1>
          <p className="hero-sub">Veja o que os outros percebem — e o que é possível melhorar.</p>

          <div className="score-wrap">
            <ScoreArc score={result.score} />
            <div className="tier-badge">🏆 {result.tier}</div>
            <div className="tier-desc">{result.tier_description}</div>
            {result.auto_crop?.applied && (
              <div style={{ marginTop: 10 }}>
                <span className="badge-pill">✂️ Enquadramento 3x4 automático aplicado</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="page">

        {/* Insight Principal */}
        {result.main_insight?.short_name && (
          <section className="main-insight" style={{ marginTop: 20 }}>
            <div className="main-insight-kicker">💡 Insight principal</div>
            <h2 className="main-insight-title">{result.main_insight.short_name}</h2>
            {result.main_insight.detail && (
              <p className="main-insight-detail">{result.main_insight.detail}</p>
            )}
            {result.main_insight.metric_key &&
              feynmanFor(result.main_insight.metric_key) && (
                <details className="main-insight-feynman">
                  <summary>💡 Explicar como se eu tivesse 5 anos</summary>
                  <p>{feynmanFor(result.main_insight.metric_key)}</p>
                </details>
              )}
          </section>
        )}

        {/* Benchmark strip */}
        {(result.benchmark_message || result.score_context) && (
          <div className="benchmark-strip" style={{ marginTop: 20 }}>
            <div className="benchmark-icon">📊</div>
            <div>
              {result.benchmark_message && <div className="benchmark-text">{result.benchmark_message}</div>}
              {result.score_context && <div className="benchmark-ctx">{result.score_context}</div>}
            </div>
          </div>
        )}

        {/* Avisos de captura */}
        {(hasWarnings || hasRecs) && (
          <section className="section" style={{ borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.06)" }}>
            <h2 className="section-title">⚠️ Atenção: qualidade da captura</h2>
            {hasWarnings && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: 13, color: "#fde68a" }}>
                {result.photo_warnings!.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            {hasRecs && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: 13, color: "#fde68a" }}>
                {result.capture_recommendations!.map((r, i) => (
                  <li key={i}><strong>[{r.area.toUpperCase()}]</strong> {r.tip}</li>
                ))}
              </ul>
            )}
            <p style={{ marginTop: 10, color: "var(--muted)", fontSize: 12, fontStyle: "italic" }}>
              Uma foto em melhores condições pode mudar completamente as recomendações.
            </p>
            {result.capture_confidence !== undefined && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                  Confiança de captura: <strong style={{ color: "var(--text)" }}>{(result.capture_confidence * 100).toFixed(0)}%</strong>
                </div>
                <div className="bar-track" style={{ height: 6 }}>
                  <div className="bar-fill" style={{ width: `${result.capture_confidence * 100}%`, background: result.capture_confidence > 0.6 ? "#22d3ee" : "#f59e0b" }} />
                </div>
              </div>
            )}
          </section>
        )}

        {/* Primeira impressão */}
        <section className="section">
          <h2 className="section-title">👁 Primeira Impressão</h2>
          <p className="section-sub">O que a percepção externa capta nos primeiros segundos.</p>

          <div className="headline-box">
            <div className="headline-text">{result.first_impression?.headline || "—"}</div>
            {result.first_impression?.positive_signal && (
              <div className="positive-signal">✅ {result.first_impression.positive_signal}</div>
            )}
            {result.first_impression?.tags && result.first_impression.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {result.first_impression.tags.map((tag) => (
                  <span key={tag} className="badge-pill" style={{ fontSize: 12 }}>{tag}</span>
                ))}
              </div>
            )}
            {result.first_impression?.main_risk && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "#fca5a5", fontSize: 13 }}>
                ⚠️ {result.first_impression.main_risk}
              </div>
            )}
          </div>

          {annotatedUrl && (
            <div className="annotated-wrap">
              <img src={annotatedUrl} alt="Rosto analisado com landmarks" className="annotated-img" />
              <p className="annotated-caption">Mapa de métricas detectadas</p>
            </div>
          )}
        </section>

        {/* Simulação Visual */}
        {hasSimulation && (
          <section className="section">
            <h2 className="section-title">🪞 Simulação Visual</h2>
            <p className="section-sub">Projeções geradas a partir dos landmarks detectados — sem IA generativa.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 12 }}>
              {result.simulation_paths?.symmetrized && (
                <div style={{ background: "var(--surface2)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <img src={`${simBase}/symmetrized`} alt="Simetria simulada" style={{ width: "100%", display: "block" }} />
                  <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>Simetria simulada</div>
                </div>
              )}
              {result.simulation_paths?.ideal_proportions && (
                <div style={{ background: "var(--surface2)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <img src={`${simBase}/ideal_proportions`} alt="Proporções ideais" style={{ width: "100%", display: "block" }} />
                  <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>Proporções ideais</div>
                </div>
              )}
              {result.simulation_paths?.comparison_grid && (
                <div style={{ background: "var(--surface2)", borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", gridColumn: "1 / -1" }}>
                  <img src={`${simBase}/comparison_grid`} alt="Comparativo" style={{ width: "100%", display: "block" }} />
                  <div style={{ padding: "10px 12px", fontSize: 13, color: "var(--muted)" }}>Comparativo — original · simetrizado · proporções ideais</div>
                </div>
              )}
            </div>
          </section>
        )}
        {result.simulation_error && (
          <section className="section" style={{ borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)" }}>
            <h2 className="section-title">🪞 Simulação Visual</h2>
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Simulação não disponível para esta foto: {result.simulation_error}</p>
          </section>
        )}

        {/* Percepção visual */}
        {result.visual_status && (
          <section className="section">
            <h2 className="section-title">📈 Percepção Visual</h2>
            <p className="section-sub">Métricas de impacto percebido (escala 0–10).</p>
            <BarRow label="Dominância" value={result.visual_status.dominance_score} />
            <BarRow label="Atratividade" value={result.visual_status.attractiveness_score} />
            <BarRow label="Vitalidade" value={result.visual_status.freshness_score} />
            {result.visual_status.narrative && (
              <p className="narrative">{result.visual_status.narrative}</p>
            )}
          </section>
        )}

        {/* Assimetria Regional */}
        {result.measurements && (
          <section className="section">
            <h2 className="section-title">⚖️ Assimetria Regional</h2>
            <p className="section-sub">Valores normalizados em % da distância interpupilar (IPD).</p>
            {([
              ["Olhos — nível", "eye_level_difference_pct_ipd"],
              ["Olhos — eixo horizontal", "eye_horizontal_asymmetry_pct_ipd"],
              ["Nariz — desvio", "nose_deviation_pct_ipd"],
              ["Boca — desvio", "mouth_center_deviation_pct_ipd"],
              ["Queixo — desvio", "chin_deviation_pct_ipd"],
            ] as [string, string][]).map(([label, key]) => {
              const val = result.measurements?.[key];
              if (val == null) return null;
              const num = Number(val);
              const pct = Math.min((num / 8) * 100, 100);
              return (
                <div key={key} className="bar-row">
                  <div className="bar-label">{label}</div>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${pct}%`, background: num < 2 ? "#22d3ee" : num < 4 ? "#a78bfa" : "#f87171" }} />
                  </div>
                  <div className="bar-val">{num.toFixed(1)}%</div>
                </div>
              );
            })}
          </section>
        )}

        {/* Perfil Facial Detalhado */}
        {result.measurements && (
          <section className="section">
            <h2 className="section-title">🔬 Perfil Facial Detalhado</h2>
            <p className="section-sub">
              Toque em cada métrica para ver a explicação simples e o detalhe técnico.
            </p>
            <div className="metric-explainer-list">
              {([
                ["Olheiras (esq)", "under_eye_darkness_left", ""],
                ["Olheiras (dir)", "under_eye_darkness_right", ""],
                ["Uniformidade da pele (esq)", "skin_uniformity_std_lab_left", ""],
                ["Uniformidade da pele (dir)", "skin_uniformity_std_lab_right", ""],
                ["Desvio Máscara Áurea", "marquardt_deviation_pct_ipd", "%"],
                ["Inclinação Canthal", "canthal_tilt_mean_deg", "°"],
                ["Razão facial (fWHR)", "fwhr", ""],
                ["Terço inferior", "lower_third_ratio", ""],
                ["Definição da mandíbula", "jawline_definition_score", ""],
              ] as [string, string, string][])
                .map(([label, key, unit]) => {
                  const v = result.measurements?.[key];
                  if (v == null) return null;
                  const num = typeof v === "number" ? v : Number(v);
                  const display = Number.isFinite(num) ? num.toFixed(2) : String(v);
                  return (
                    <MetricExplainer
                      key={key}
                      metricKey={key}
                      label={label}
                      value={display}
                      unit={unit || undefined}
                      glossary={glossary}
                    />
                  );
                })
                .filter(Boolean)}
            </div>
          </section>
        )}

        {/* Top 3 ações */}
        {result.top3_actions_v2 && result.top3_actions_v2.length > 0 ? (
          <section className="section">
            <h2 className="section-title">✨ Seus Refinamentos de Alto Impacto</h2>
            <p className="section-sub">Ações ordenadas por impacto × facilidade de execução.</p>
            {result.top3_actions_v2.map((item) => (
              <div key={item.rank} className="action-card">
                <div className="action-rank">{RANK_EMOJI[item.rank - 1] ?? item.rank}</div>
                <div className="action-body">
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <div className="action-title">{item.short_action}</div>
                    {item.tier !== undefined && (
                      <span className="badge-pill" style={{ fontSize: 11, background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: "#22d3ee" }}>
                        {TIER_LABEL[item.tier] ?? `Tier ${item.tier}`}
                      </span>
                    )}
                  </div>
                  <div className="action-why">{item.why_it_matters}</div>
                  <div className="action-time">⏱ Resultado: {item.time_to_result}</div>
                </div>
              </div>
            ))}
          </section>
        ) : result.top_leverage ? (
          <section className="section">
            <div className="actions-header">Sua maior alavanca</div>
            <div className="action-card">
              <div className="action-rank">🥇</div>
              <div className="action-body">
                <div className="action-title">{result.top_leverage.short_action}</div>
                <div className="action-why">{result.top_leverage.why_it_matters}</div>
                {result.top_leverage.time_to_result && (
                  <div className="action-time">⏱ Resultado: {result.top_leverage.time_to_result}</div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* Caminho de evolução */}
        {phases.some(Boolean) && (
          <section className="section">
            <h2 className="section-title">🗺 Caminho de Evolução</h2>
            <p className="section-sub">Plano em 3 fases progressivas.</p>

            {result.evolution_path?.skin_alert && (
              <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "#fca5a5", fontSize: 13 }}>
                🔴 Alerta de pele detectado — considere avaliação dermatológica antes de iniciar protocolos.
              </div>
            )}

            {result.evolution_path?.mutable_metrics && result.evolution_path.mutable_metrics.length > 0 && (
              <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, fontSize: 13, color: "#a5b4fc" }}>
                🔧 <strong>{result.evolution_path.mutable_metrics.length}</strong> métricas com potencial de melhora identificadas.
              </div>
            )}

            {phases.map((phase, i) =>
              phase ? (
                <div key={i} className="phase-card">
                  <div className="phase-header">
                    <span className="phase-icon">{PHASE_ICON[i]}</span>
                    <div>
                      <div className="phase-label">{phase.label || `Fase ${i + 1}`}</div>
                      <div className="phase-focus">{phase.focus || "—"}</div>
                    </div>
                    {phase.requires_professional && (
                      <span className="badge-pill" style={{ marginLeft: "auto", fontSize: 11, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                        👨‍⚕️ Profissional
                      </span>
                    )}
                  </div>
                  {phase.confidence_score !== undefined && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>
                        Confiança do plano: {phase.confidence_score.toFixed(0)}%
                      </div>
                      <div className="bar-track" style={{ height: 4 }}>
                        <div className="bar-fill" style={{ width: `${phase.confidence_score}%` }} />
                      </div>
                    </div>
                  )}
                  {phase.actions && phase.actions.length > 0 && (
                    <ul className="phase-actions">
                      {phase.actions.map((a, j) => (
                        <li key={j}>
                          {a.titulo}
                          {a.metric_label && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--accent2)", fontStyle: "italic" }}>({a.metric_label})</span>}
                          {a.frequencia && <span className="phase-freq"> — {a.frequencia}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {(phase.reanalysis_label || phase.confidence_label) && (
                    <div className="phase-meta">
                      {phase.reanalysis_label && <>📅 Reanalisar: {phase.reanalysis_label}</>}
                      {phase.confidence_label && <> · {phase.confidence_label}</>}
                    </div>
                  )}
                </div>
              ) : null
            )}
          </section>
        )}

        {/* Catálogo de métricas */}
        {result.premium_metrics_catalog && result.premium_metrics_catalog.length > 0 && (
          <section className="section">
            <h2 className="section-title">📚 Métricas Completas (Premium)</h2>
            <p className="section-sub">Todas as métricas calculadas para este rosto, organizadas por categoria.</p>
            {result.premium_metrics_catalog.map((category) => (
              <MetricsCategory key={category.slug} category={category} glossary={glossary} />
            ))}
          </section>
        )}

        {/* Plano de Ação Detalhado */}
        {result.recommendations && result.recommendations.filter(r => !r.severity.toLowerCase().includes("excel")).length > 0 && (
          <section className="section">
            <h2 className="section-title">📋 Plano de Ação Detalhado</h2>
            <p className="section-sub">Recomendações específicas ordenadas por impacto, baseadas nas métricas críticas.</p>
            {result.recommendations
              .filter(r => !r.severity.toLowerCase().includes("excel"))
              .map((rec) => (
                <details key={rec.metric_key} style={{ marginBottom: 12, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
                  <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, listStyle: "none" }}>
                    <span className={severityClass(rec.severity)}>{rec.severity}</span>
                    <span style={{ fontWeight: 600, color: "var(--text)" }}>{rec.metric_label}</span>
                    <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>Ideal: {rec.ideal}</span>
                  </summary>
                  <div style={{ marginTop: 10 }}>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px" }}>{rec.why_matters}</p>
                    <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 6 }}>
                      {rec.actions.map((a, i) => (
                        <li key={i} style={{ fontSize: 13, color: "var(--text)" }}>
                          <strong>{a.titulo}</strong> — {a.descricao}
                          {a.frequencia && <span style={{ color: "var(--muted)", marginLeft: 6 }}>({a.frequencia})</span>}
                          {a.fonte && (
                            <a href={a.fonte.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, fontSize: 11, color: "var(--accent2)" }}>
                              📖 {a.fonte.titulo}
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              ))}
          </section>
        )}

        {/* Glossário (referência rápida) */}
        {Object.keys(glossary).length > 0 && (
          <section className="section">
            <h2 className="section-title">📖 Glossário (referência)</h2>
            <p className="section-sub">
              Termos técnicos usados na análise. Cada métrica acima já vem com a
              explicação simples e o detalhe — esta seção é só um índice.
            </p>
            <div className="metric-explainer-list">
              {Object.entries(glossary).map(([key, term]) => (
                <details
                  key={key}
                  className="metric-explainer"
                  style={{ paddingTop: 0 }}
                >
                  <summary>
                    <span className="me-label">{term.termo}</span>
                    {term.unidade && (
                      <span className="me-unit">({term.unidade})</span>
                    )}
                    <span className="me-toggle" aria-hidden>▾</span>
                  </summary>
                  <div className="me-body">
                    <p className="me-mini">{term.descricao}</p>
                    {term.como_medido && (
                      <p className="me-mini" style={{ marginTop: 6 }}>
                        <strong>Como medimos:</strong> {term.como_medido}
                      </p>
                    )}
                    {term.faixas && (
                      <p className="me-mini" style={{ marginTop: 6 }}>
                        <strong>Faixas:</strong> {term.faixas}
                      </p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          </section>
        )}

        <div className="footer">
          <button className="btn btn-ghost" onClick={() => navigate("/")}>← Nova análise</button>
        </div>
      </div>
    </>
  );
}
