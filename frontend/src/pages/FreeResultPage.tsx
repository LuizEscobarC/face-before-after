import { useLocation, useNavigate } from "react-router-dom";
import type { AnalysisResult } from "../types";

type LocationState = { result?: AnalysisResult };

function scoreColor(score: number): string {
  if (score >= 80) return "#22d3ee";
  if (score >= 60) return "#4ade80";
  if (score >= 40) return "#fbbf24";
  return "#f87171";
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

export function FreeResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as LocationState | null)?.result;

  if (!result) {
    return (
      <main className="page">
        <section className="panel">
          <h1 className="panel-title">Resultado não encontrado</h1>
          <p>Faça uma nova análise para visualizar o resultado.</p>
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

  return (
    <main className="page">
      <section className="hero hero-free">
        <p className="hero-kicker">Resultado Free</p>
        <h1 className="hero-title">Seu diagnóstico inicial está pronto</h1>
        <p className="hero-subtitle">Visão rápida para você entender sua maior alavanca agora.</p>
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
        {annotatedUrl && (
          <figure className="annotated-wrap">
            <img src={annotatedUrl} alt="Rosto analisado com landmarks" className="annotated-image" />
            <figcaption>Foto analisada com marcações</figcaption>
          </figure>
        )}
      </section>

      {/* Maior alavanca */}
      {result.top_leverage && (
        <section className="panel action-card">
          <div className="action-rank">🥇</div>
          <div className="action-body">
            <h2 className="panel-title">Sua maior alavanca</h2>
            <p className="action-title">{result.top_leverage.short_action || "—"}</p>
            <p className="action-why">{result.top_leverage.why_it_matters || "—"}</p>
            {result.top_leverage.time_to_result && (
              <span className="time-badge">⏱ {result.top_leverage.time_to_result}</span>
            )}
          </div>
        </section>
      )}

      {/* CTA Upgrade */}
      <section className="panel upgrade-panel">
        <h2 className="panel-title">🔓 Desbloqueie o Premium</h2>
        <ul className="tips-list compact">
          <li>
            <strong>Simulação visual</strong>
            <span>veja como ficaria com simetria zerada e proporções ideais</span>
          </li>
          <li>
            <strong>Top 3 refinamentos</strong>
            <span>ações priorizadas por impacto e velocidade de resultado</span>
          </li>
          <li>
            <strong>Plano de evolução</strong>
            <span>3 fases com ações, frequência e data de reanálise</span>
          </li>
          <li>
            <strong>Catálogo completo</strong>
            <span>85+ métricas com severidade e valores ideais</span>
          </li>
        </ul>
        <div className="actions-row" style={{ marginTop: 16 }}>
          <button className="btn btn-primary" onClick={() => navigate("/")}>
            Nova análise Premium
          </button>
          <button className="btn btn-ghost" onClick={() => navigate("/")}>
            Voltar
          </button>
        </div>
      </section>
    </main>
  );
}
