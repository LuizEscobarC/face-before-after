import { useLocation, useNavigate } from "react-router-dom";
import type { AnalysisResult, PremiumMetricCategory } from "../types";

type LocationState = { result?: AnalysisResult };

const RANK_EMOJI = ["🥇", "🥈", "🥉"];
const PHASE_ICON = ["⚡", "🎯", "🏅"];

function scoreColor(score: number): string {
  if (score >= 80) return "#22d3ee";
  if (score >= 60) return "#4ade80";
  if (score >= 40) return "#fbbf24";
  return "#f87171";
}

function severityClass(severity: string): string {
  const key = severity.toLowerCase();
  if (key.includes("excel")) return "sev sev-ok";
  if (key.includes("leve")) return "sev sev-soft";
  if (key.includes("moder")) return "sev sev-mid";
  if (key.includes("acent") || key.includes("sever")) return "sev sev-high";
  return "sev sev-info";
}

function ScoreArc({ score }: { score: number }) {
  const r = 72;
  const cx = 100;
  const cy = 100;
  const angle = score * 1.8;
  const rad = ((180 - angle) * Math.PI) / 180;
  const ex = cx + r * Math.cos(rad);
  const ey = cy - r * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;
  const color = scoreColor(score);

  return (
    <div className="score-arc-wrap">
      <svg viewBox="0 0 200 110" className="score-arc-svg">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {score > 0 && (
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey}`}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="30" fontWeight="800" fill={color}>
          {score}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="#94a3b8">
          /100
        </text>
      </svg>
    </div>
  );
}

function PerceptionBar({ label, value }: { label: string; value: number | undefined }) {
  const pct = ((value ?? 0) / 10) * 100;
  return (
    <div className="perception-bar">
      <div className="perception-label">
        <span>{label}</span>
        <strong>{value?.toFixed(1) ?? "—"}</strong>
      </div>
      <div className="perception-track">
        <div className="perception-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MetricsCategory({ category }: { category: PremiumMetricCategory }) {
  return (
    <details className="metric-accordion">
      <summary>
        {category.title} <span>{category.count} métricas</span>
      </summary>
      <div className="table-wrap">
        <table className="metrics-table">
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
      <main className="page">
        <section className="panel">
          <h1 className="panel-title">Resultado Premium não encontrado</h1>
          <p>Faça uma nova análise premium para visualizar os dados completos.</p>
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            Voltar para captura
          </button>
        </section>
      </main>
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
    <main className="page">
      <section className="hero hero-premium">
        <p className="hero-kicker">Resultado Premium</p>
        <h1 className="hero-title">Análise completa da sua presença visual</h1>
        <p className="hero-subtitle">Todas as métricas e recomendações da sua foto, em uma única tela.</p>
      </section>

      {/* Score arc */}
      <section className="panel score-panel">
        <ScoreArc score={result.score} />
        <div className="score-info">
          <p className="score-tier-label" style={{ color: scoreColor(result.score) }}>
            {result.tier}
          </p>
          <p className="score-desc">{result.tier_description}</p>
          {result.auto_crop?.applied && (
            <span className="badge-pill">✂️ Enquadramento 3x4 automático aplicado</span>
          )}
        </div>
      </section>

      {/* Benchmark banner */}
      {(result.benchmark_message || result.score_context) && (
        <section className="panel benchmark-banner">
          {result.benchmark_message && <p className="benchmark-msg">{result.benchmark_message}</p>}
          {result.score_context && <p className="benchmark-ctx">{result.score_context}</p>}
        </section>
      )}

      {/* Avisos de captura */}
      {(hasWarnings || hasRecs) && (
        <section className="panel warning-panel">
          <h2 className="panel-title">⚠️ Atenção: qualidade da captura</h2>
          {hasWarnings && (
            <ul className="warning-list">
              {result.photo_warnings!.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
          {hasRecs && (
            <ul className="warning-list" style={{ marginTop: 8 }}>
              {result.capture_recommendations!.map((r, i) => (
                <li key={i}><strong>[{r.area.toUpperCase()}]</strong> {r.tip}</li>
              ))}
            </ul>
          )}
          <p className="warning-footer">Uma foto em melhores condições pode mudar completamente as recomendações.</p>
        </section>
      )}

      {/* Primeira impressão + foto anotada */}
      <section className="panel">
        <h2 className="panel-title">💬 Primeira impressão</h2>
        <p className="first-impression-headline">{result.first_impression?.headline || "—"}</p>
        {result.first_impression?.positive_signal && (
          <p className="positive-signal">✅ {result.first_impression.positive_signal}</p>
        )}
        {annotatedUrl && (
          <figure className="annotated-wrap">
            <img src={annotatedUrl} alt="Rosto analisado com landmarks" className="annotated-image" />
            <figcaption>Foto analisada com marcações</figcaption>
          </figure>
        )}
      </section>

      {/* Status visual com barras */}
      {result.visual_status && (
        <section className="panel">
          <h2 className="panel-title">📈 Percepção visual</h2>
          <PerceptionBar label="Dominância" value={result.visual_status.dominance_score} />
          <PerceptionBar label="Atratividade" value={result.visual_status.attractiveness_score} />
          <PerceptionBar label="Vitalidade" value={result.visual_status.freshness_score} />
          {result.visual_status.narrative && (
            <p className="mini-text" style={{ marginTop: 12 }}>{result.visual_status.narrative}</p>
          )}
        </section>
      )}

      {/* Top 3 ações */}
      {result.top3_actions_v2 && result.top3_actions_v2.length > 0 ? (
        <section className="panel">
          <h2 className="panel-title">🎯 Refinamentos de alto impacto</h2>
          <div className="actions-stack">
            {result.top3_actions_v2.map((item) => (
              <div key={item.rank} className="action-card">
                <div className="action-rank">{RANK_EMOJI[item.rank - 1] ?? item.rank}</div>
                <div className="action-body">
                  <p className="action-title">{item.short_action}</p>
                  <p className="action-why">{item.why_it_matters}</p>
                  <span className="time-badge">⏱ {item.time_to_result}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        // fallback: top_leverage único
        result.top_leverage && (
          <section className="panel action-card">
            <div className="action-rank">🥇</div>
            <div className="action-body">
              <h2 className="panel-title">Sua maior alavanca</h2>
              <p className="action-title">{result.top_leverage.short_action}</p>
              <p className="action-why">{result.top_leverage.why_it_matters}</p>
              {result.top_leverage.time_to_result && (
                <span className="time-badge">⏱ {result.top_leverage.time_to_result}</span>
              )}
            </div>
          </section>
        )
      )}

      {/* Caminho de evolução */}
      {phases.some(Boolean) && (
        <section className="panel">
          <h2 className="panel-title">🧭 Caminho de evolução</h2>
          <div className="phases-stack">
            {phases.map((phase, i) =>
              phase ? (
                <div key={i} className="phase-card">
                  <div className="phase-icon">{PHASE_ICON[i]}</div>
                  <div className="phase-body">
                    <p className="phase-label">{phase.label || `Fase ${i + 1}`}</p>
                    <p className="phase-focus">{phase.focus || "—"}</p>
                    {phase.actions && phase.actions.length > 0 && (
                      <ul className="phase-actions">
                        {phase.actions.map((a, j) => (
                          <li key={j}>
                            <strong>{a.titulo}</strong>
                            {a.frequencia && <span className="freq-badge">{a.frequencia}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {phase.reanalysis_label && (
                      <p className="reanalysis-label">
                        📅 Reanalisar {phase.reanalysis_label}
                        {phase.confidence_label && (
                          <span className="conf-badge">{phase.confidence_label}</span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </section>
      )}

      {/* Catálogo de métricas */}
      {result.premium_metrics_catalog && result.premium_metrics_catalog.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">📚 Catálogo completo de métricas</h2>
          <div className="metrics-stack">
            {result.premium_metrics_catalog.map((category) => (
              <MetricsCategory key={category.slug} category={category} />
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="actions-row">
          <button className="btn btn-primary" onClick={() => navigate("/")}>Nova análise</button>
          <button className="btn btn-ghost" onClick={() => navigate("/")}>Voltar</button>
        </div>
      </section>
    </main>
  );
}
