import { useLocation, useNavigate } from "react-router-dom";
import type { AnalysisResult } from "../types";

type LocationState = { result?: AnalysisResult };

function scoreColor(score: number): string {
  if (score >= 80) return "#22d3ee";
  if (score >= 60) return "#22d3ee";
  if (score >= 40) return "#a78bfa";
  return "#6366f1";
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
        <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
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
          stroke="url(#arcGrad)"
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

export function FreeResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as LocationState | null)?.result;

  if (!result) {
    return (
      <div className="page" style={{ paddingTop: 60 }}>
        <section className="section">
          <h1 className="section-title">Resultado não encontrado</h1>
          <p>Faça uma nova análise para visualizar o resultado.</p>
          <button className="cta-btn" style={{ marginTop: 20 }} onClick={() => navigate("/")}>
            Voltar para captura
          </button>
        </section>
      </div>
    );
  }

  const annotatedUrl = result.run_id ? `/v1/vision/results/${result.run_id}/annotated` : null;
  const hasWarnings = (result.photo_warnings?.length ?? 0) > 0;
  const hasRecs = (result.capture_recommendations?.length ?? 0) > 0;

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
              <div className="annotated-caption">Foto analisada com marcações de landmarks</div>
            </div>
          )}
        </section>

        {/* Maior alavanca */}
        {result.top_leverage && (
          <section className="section">
            <div className="actions-header">Sua maior alavanca</div>
            <div className="action-card">
              <div className="action-rank">🥇</div>
              <div className="action-body">
                <div className="action-title">{result.top_leverage.short_action || "—"}</div>
                <div className="action-why">{result.top_leverage.why_it_matters || "—"}</div>
                {result.top_leverage.time_to_result && (
                  <div className="action-time">⏱ Resultado: {result.top_leverage.time_to_result}</div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* CTA Upgrade */}
        <div className="cta-section">
          <div className="urgency">No premium você recebe simulação visual, plano em 3 fases e todas as métricas avançadas.</div>
          <div className="ns-msg">Esse é seu diagnóstico gratuito. O relatório premium mostra o mapa completo de métricas e prioridades.</div>
          <button className="cta-btn" onClick={() => navigate("/")}>
            Desbloquear Premium →
          </button>
        </div>

        <div className="footer">
          <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => navigate("/")}>← Nova análise</button>
        </div>
      </div>
    </>
  );
}
