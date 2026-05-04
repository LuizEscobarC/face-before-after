import { useLocation, useNavigate } from "react-router-dom";

import type { AnalysisResult } from "../types";

type LocationState = {
  result?: AnalysisResult;
};

export function FreeResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as LocationState | null)?.result;

  if (!result) {
    return (
      <main className="page">
        <section className="panel">
          <h1 className="panel-title">Resultado Free não encontrado</h1>
          <p>Faça uma nova análise para visualizar o resultado.</p>
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            Voltar para captura
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page">
      <section className="hero hero-free">
        <p className="hero-kicker">Resultado Free</p>
        <h1 className="hero-title">Seu diagnóstico inicial está pronto</h1>
        <p className="hero-subtitle">Visão rápida para você entender sua maior alavanca agora.</p>
      </section>

      <section className="result-grid">
        <article className="panel">
          <h2 className="panel-title">Resumo rápido</h2>
          <p className="score-value">{result.score}/100</p>
          <p className="score-tier">{result.tier}</p>
          <p>{result.tier_description}</p>
          <p className="badge-line">
            Enquadramento 3x4 automático: <strong>{result.auto_crop?.applied ? "aplicado" : "não necessário"}</strong>
          </p>
        </article>

        <article className="panel">
          <h2 className="panel-title">Primeira impressão</h2>
          <p>{result.first_impression?.headline || "Sem headline disponível."}</p>
        </article>

        <article className="panel">
          <h2 className="panel-title">Sua maior alavanca</h2>
          <p className="lead-action">{result.top_leverage?.short_action || "Ação não disponível"}</p>
          <p>{result.top_leverage?.why_it_matters || "—"}</p>
          <p className="badge-line">
            Tempo estimado: <strong>{result.top_leverage?.time_to_result || "—"}</strong>
          </p>
        </article>

        <article className="panel upgrade-panel">
          <h2 className="panel-title">Desbloqueie o Premium</h2>
          <ul className="tips-list compact">
            <li>Simulação visual completa</li>
            <li>Top 3 refinamentos por prioridade</li>
            <li>Plano de evolução em fases</li>
            <li>Catálogo completo de métricas</li>
          </ul>
          <div className="actions-row">
            <button className="btn btn-primary" onClick={() => navigate("/")}>Nova análise premium</button>
            <button className="btn btn-ghost" onClick={() => navigate("/")}>Voltar</button>
          </div>
        </article>
      </section>
    </main>
  );
}
