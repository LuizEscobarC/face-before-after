import { useLocation, useNavigate } from "react-router-dom";
import type { AnalysisResult, PremiumMetricCategory } from "../types";

type LocationState = { result?: AnalysisResult };

const RANK_EMOJI = ["🥇", "🥈", "🥉"];
const PHASE_ICON = ["⚡", "🎯", "🏅"];

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

function MetricsCategory({ category }: { category: PremiumMetricCategory }) {
  return (
    <details className="metric-group">
      <summary>
        {category.title} <span className="metric-count">{category.count} métricas</span>
      </summary>
      <div className="metric-table-wrap">
        <table className="metric-table">
          <thead>
            <tr>
              <th>Métrica</th>
              <th>Valor</th>
              <th>Unidade</th>
              <th>Ideal</th>
              <th>Severidade</th>
            </tr>
          </thead>
          <tbody>
            {category.metrics.map((m) => (
              <tr key={`${category.slug}-${m.key}`}>
                <td>{m.label}</td>
                <td>{m.display_value}</td>
                <td>{m.unit || "—"}</td>
                <td>{m.ideal || "—"}</td>
                <td>
                  <span className={severityClass(m.severity)}>{m.severity}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export function PremiumResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as LocationState | null)?.result;

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
          </div>

          {annotatedUrl && (
            <div className="annotated-wrap">
              <img src={annotatedUrl} alt="Rosto analisado com landmarks" className="annotated-img" />
              <p className="annotated-caption">Mapa de métricas detectadas</p>
            </div>
          )}
        </section>

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

        {/* Top 3 ações */}
        {result.top3_actions_v2 && result.top3_actions_v2.length > 0 ? (
          <section className="section">
            <h2 className="section-title">✨ Seus Refinamentos de Alto Impacto</h2>
            <p className="section-sub">Ações ordenadas por impacto × facilidade de execução.</p>
            {result.top3_actions_v2.map((item) => (
              <div key={item.rank} className="action-card">
                <div className="action-rank">{RANK_EMOJI[item.rank - 1] ?? item.rank}</div>
                <div className="action-body">
                  <div className="action-title">{item.short_action}</div>
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
            {phases.map((phase, i) =>
              phase ? (
                <div key={i} className="phase-card">
                  <div className="phase-header">
                    <span className="phase-icon">{PHASE_ICON[i]}</span>
                    <div>
                      <div className="phase-label">{phase.label || `Fase ${i + 1}`}</div>
                      <div className="phase-focus">{phase.focus || "—"}</div>
                    </div>
                  </div>
                  {phase.actions && phase.actions.length > 0 && (
                    <ul className="phase-actions">
                      {phase.actions.map((a, j) => (
                        <li key={j}>
                          {a.titulo}
                          {a.frequencia && <span className="phase-freq"> ({a.frequencia})</span>}
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
              <MetricsCategory key={category.slug} category={category} />
            ))}
          </section>
        )}

        <div className="footer">
          <button className="btn btn-ghost" onClick={() => navigate("/")}>← Nova análise</button>
        </div>
      </div>
    </>
  );
}
