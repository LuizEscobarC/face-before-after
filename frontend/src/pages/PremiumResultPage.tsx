import { useLocation, useNavigate } from "react-router-dom";

import type { AnalysisResult, PremiumMetricCategory } from "../types";

type LocationState = {
  result?: AnalysisResult;
};

function severityClass(severity: string): string {
  const key = severity.toLowerCase();
  if (key.includes("excel")) return "sev sev-ok";
  if (key.includes("leve")) return "sev sev-soft";
  if (key.includes("moder")) return "sev sev-mid";
  if (key.includes("acent") || key.includes("sever")) return "sev sev-high";
  return "sev sev-info";
}

function MetricsCategory({ category }: { category: PremiumMetricCategory }) {
  return (
    <details className="metric-accordion" open>
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

  return (
    <main className="page">
      <section className="hero hero-premium">
        <p className="hero-kicker">Resultado Premium</p>
        <h1 className="hero-title">Análise completa da sua presença visual</h1>
        <p className="hero-subtitle">Todas as métricas e recomendações da sua foto, em uma única tela.</p>
      </section>

      <section className="result-grid">
        <article className="panel">
          <h2 className="panel-title">Resumo Premium</h2>
          <p className="score-value">{result.score}/100</p>
          <p className="score-tier">{result.tier}</p>
          <p>{result.tier_description}</p>
          <p className="badge-line">
            Enquadramento 3x4 automático: <strong>{result.auto_crop?.applied ? "aplicado" : "não necessário"}</strong>
          </p>
          {result.score_context && <p className="mini-text">{result.score_context}</p>}
          {result.benchmark_message && <p className="mini-text">{result.benchmark_message}</p>}
        </article>

        <article className="panel">
          <h2 className="panel-title">Primeira impressão</h2>
          <p>{result.first_impression?.headline || "Sem headline disponível."}</p>
        </article>

        <article className="panel">
          <h2 className="panel-title">Status visual</h2>
          <div className="status-grid">
            <p>Dominância: <strong>{result.visual_status?.dominance_score?.toFixed(1) ?? "—"}</strong></p>
            <p>Atratividade: <strong>{result.visual_status?.attractiveness_score?.toFixed(1) ?? "—"}</strong></p>
            <p>Vitalidade: <strong>{result.visual_status?.freshness_score?.toFixed(1) ?? "—"}</strong></p>
          </div>
          <p>{result.visual_status?.narrative || "—"}</p>
        </article>

        <article className="panel">
          <h2 className="panel-title">Top refinamentos</h2>
          {result.top3_actions_v2 && result.top3_actions_v2.length > 0 ? (
            <ul className="tips-list compact">
              {result.top3_actions_v2.map((item) => (
                <li key={item.rank}>
                  <strong>{item.rank}. {item.short_action}</strong>
                  <span>{item.why_it_matters}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Sem ações prioritárias no momento.</p>
          )}
        </article>

        <article className="panel">
          <h2 className="panel-title">Caminho de evolução</h2>
          <ul className="tips-list compact">
            <li>
              <strong>{result.evolution_path?.phase_1?.label || "Fase 1"}</strong>
              <span>{result.evolution_path?.phase_1?.focus || "—"}</span>
            </li>
            <li>
              <strong>{result.evolution_path?.phase_2?.label || "Fase 2"}</strong>
              <span>{result.evolution_path?.phase_2?.focus || "—"}</span>
            </li>
            <li>
              <strong>{result.evolution_path?.phase_3?.label || "Fase 3"}</strong>
              <span>{result.evolution_path?.phase_3?.focus || "—"}</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="panel">
        <h2 className="panel-title">Catálogo completo de métricas</h2>
        {result.premium_metrics_catalog && result.premium_metrics_catalog.length > 0 ? (
          <div className="metrics-stack">
            {result.premium_metrics_catalog.map((category) => (
              <MetricsCategory key={category.slug} category={category} />
            ))}
          </div>
        ) : (
          <p>Catálogo indisponível para este resultado.</p>
        )}
      </section>

      <section className="panel">
        <div className="actions-row">
          <button className="btn btn-primary" onClick={() => navigate("/")}>Nova análise</button>
          <button className="btn btn-ghost" onClick={() => navigate("/")}>Voltar</button>
        </div>
      </section>
    </main>
  );
}
