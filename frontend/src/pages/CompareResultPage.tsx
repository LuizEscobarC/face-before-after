import { useLocation, useNavigate } from "react-router-dom";
import { ConsistencyWarning } from "../components/ConsistencyWarning";
import type { AnalysisResult, CompareWithConsistency } from "../types";
import { colorForScore, useScoreBands } from "../hooks/useScoreBands";

type LocationState = {
  compareResult?: CompareWithConsistency;
  resBefore?: AnalysisResult;
  resAfter?: AnalysisResult;
};

function ScoreArc({ score, label }: { score: number; label: string }) {
  const bands = useScoreBands();
  const r = 80;
  const cx = 100;
  const cy = 100;
  const angle = score * 1.8;
  const rad = ((180 - angle) * Math.PI) / 180;
  const ex = cx + r * Math.cos(rad);
  const ey = cy - r * Math.sin(rad);
  const largeArc = angle > 180 ? 1 : 0;
  const color = colorForScore(score, bands);

  return (
    <div style={{ textAlign: "center" }}>
      <svg viewBox="0 0 200 110" style={{ width: 150 }}>
        <defs>
          <linearGradient id={`arcGrad-${label}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" strokeLinecap="round" />
        {score > 0 && (
          <path
            d={`M 20 100 A 80 80 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`}
            fill="none"
            stroke={`url(#arcGrad-${label})`}
            strokeWidth="14"
            strokeLinecap="round"
          />
        )}
        <text x={cx} y={90} textAnchor="middle" fontSize="36" fontWeight="800" fill={color} fontFamily="system-ui">{score}</text>
        <text x={cx} y={108} textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.55)" fontFamily="system-ui">/ 100</text>
      </svg>
      <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

export function CompareResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState | null);
  const compareResult = state?.compareResult;

  if (!compareResult) {
    return (
      <div className="page" style={{ paddingTop: 60 }}>
        <section className="section">
          <h1 className="section-title">Comparação não encontrada</h1>
          <p>Volte e envie as fotos Antes e Depois para comparar.</p>
          <button className="cta-btn" style={{ marginTop: 20 }} onClick={() => navigate("/")}>← Voltar</button>
        </section>
      </div>
    );
  }

  const deltaColor = compareResult.score_delta >= 0 ? "#22d3ee" : "#f87171";
  const deltaSign = compareResult.score_delta >= 0 ? "+" : "";

  return (
    <>
      {/* HERO */}
      <div className="hero">
        <div className="page">
          <div className="hero-badge">Face Before/After · Comparação Antes/Depois</div>
          <h1 className="hero-title">Resultado da Comparação</h1>
          <p className="hero-sub">Evolução baseada nas métricas faciais objetivas.</p>

          <div style={{ display: "flex", justifyContent: "center", gap: 40, flexWrap: "wrap", marginTop: 24 }}>
            <ScoreArc score={compareResult.score_before} label="ANTES" />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: deltaColor }}>
                {deltaSign}{compareResult.score_delta}
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>pontos</div>
            </div>
            <ScoreArc score={compareResult.score_after} label="DEPOIS" />
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <span className="badge-pill">{compareResult.tier_before} → {compareResult.tier_after}</span>
            <span className="badge-pill" style={{ background: "rgba(34,211,238,0.12)", borderColor: "rgba(34,211,238,0.3)", color: "#22d3ee" }}>
              ✅ {compareResult.improved_count} melhorias
            </span>
            {compareResult.worsened_count > 0 && (
              <span className="badge-pill" style={{ background: "rgba(248,113,113,0.12)", borderColor: "rgba(248,113,113,0.3)", color: "#fca5a5" }}>
                ⚠️ {compareResult.worsened_count} regressões
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="page">
        {compareResult.consistency_score !== undefined && (
          <section className="section" style={{ paddingTop: 0 }}>
            <ConsistencyWarning
              consistency_score={compareResult.consistency_score}
              consistency_issues={compareResult.consistency_issues ?? []}
              is_comparable={compareResult.is_comparable ?? true}
            />
          </section>
        )}
        {/* Top melhorias */}
        {compareResult.top_improvements.length > 0 && (
          <section className="section">
            <h2 className="section-title">✅ Maiores Melhorias</h2>
            {compareResult.top_improvements.map((m) => (
              <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.before.toFixed(2)} → {m.after.toFixed(2)}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#22d3ee" }}>+{m.delta.toFixed(2)}</div>
              </div>
            ))}
          </section>
        )}

        {/* Top regressões */}
        {compareResult.top_regressions.length > 0 && (
          <section className="section">
            <h2 className="section-title">⚠️ Maiores Regressões</h2>
            {compareResult.top_regressions.map((m) => (
              <div key={m.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 10, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>{m.label}</div>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>{m.before.toFixed(2)} → {m.after.toFixed(2)}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#f87171" }}>{m.delta.toFixed(2)}</div>
              </div>
            ))}
          </section>
        )}

        {/* Tabela completa */}
        {compareResult.metrics.length > 0 && (
          <section className="section">
            <h2 className="section-title">📊 Todas as Métricas</h2>
            <div className="metric-table-wrap">
              <table className="metric-table">
                <thead>
                  <tr>
                    <th>Métrica</th>
                    <th>Antes</th>
                    <th>Depois</th>
                    <th>Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {compareResult.metrics.map((m) => (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      <td>{m.before.toFixed(2)}</td>
                      <td>{m.after.toFixed(2)}</td>
                      <td style={{ color: m.improved ? "#22d3ee" : "#f87171", fontWeight: 600 }}>
                        {m.improved ? "+" : ""}{m.delta.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
