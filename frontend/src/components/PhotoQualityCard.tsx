import type { PhotoQualityDecision } from "../api";

type Props = {
  decision: PhotoQualityDecision;
  onContinue?: () => void;
  onRetake?: () => void;
};

const COLORS: Record<PhotoQualityDecision["decision"], { fg: string; bg: string; label: string }> = {
  ACCEPT: {
    fg: "#67e8f9",
    bg: "rgba(34,211,238,0.12)",
    label: "Foto aprovada",
  },
  WARN: {
    fg: "#fcd34d",
    bg: "rgba(252,211,77,0.12)",
    label: "Foto aceita com ressalvas",
  },
  REJECT: {
    fg: "#fca5a5",
    bg: "rgba(252,165,165,0.12)",
    label: "Foto rejeitada — capture novamente",
  },
};

const GRADE_LABEL: Record<PhotoQualityDecision["grade"], string> = {
  ALTA: "Alta qualidade",
  MEDIA: "Qualidade média",
  BAIXA: "Baixa qualidade",
  REJEITADA: "Rejeitada",
};

export function PhotoQualityCard({ decision, onContinue, onRetake }: Props): JSX.Element {
  const palette = COLORS[decision.decision];
  const score = Math.round(decision.quality_score * 100);

  return (
    <article
      className="panel"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 20,
        display: "grid",
        gap: 16,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <p
            style={{
              display: "inline-block",
              padding: "4px 12px",
              borderRadius: 99,
              fontSize: 12,
              letterSpacing: 0.4,
              textTransform: "uppercase",
              background: palette.bg,
              color: palette.fg,
              border: `1px solid ${palette.fg}33`,
            }}
          >
            {palette.label}
          </p>
          <h2 style={{ margin: "8px 0 0", color: "var(--text)", fontSize: 22 }}>
            {GRADE_LABEL[decision.grade]} · {score}/100
          </h2>
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: `conic-gradient(${palette.fg} ${score * 3.6}deg, var(--surface2) 0)`,
            display: "grid",
            placeItems: "center",
          }}
        >
          <span
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "var(--surface)",
              display: "grid",
              placeItems: "center",
              color: "var(--text)",
              fontWeight: 600,
            }}
          >
            {score}
          </span>
        </div>
      </header>

      {decision.recommendations.length > 0 && (
        <section>
          <h3 style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.6, margin: 0 }}>
            Para melhorar a captura
          </h3>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, color: "var(--text)", display: "grid", gap: 4 }}>
            {decision.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 12,
        }}
      >
        <Subscore label="Pose" value={decision.subscore_breakdown.pose_score} />
        <Subscore label="Nitidez" value={decision.subscore_breakdown.sharpness_score} />
        <Subscore label="Iluminação" value={decision.subscore_breakdown.lighting_score} />
        <Subscore label="Oclusão" value={decision.subscore_breakdown.occlusion_score} />
        <Subscore label="Expressão" value={decision.subscore_breakdown.expression_score} />
      </section>

      <footer style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {onRetake && (
          <button type="button" className="btn" onClick={onRetake}>
            Refazer captura
          </button>
        )}
        {onContinue && decision.decision !== "REJECT" && (
          <button type="button" className="btn btn-primary" onClick={onContinue}>
            Continuar análise
          </button>
        )}
      </footer>
    </article>
  );
}

function Subscore({ label, value }: { label: string; value?: number }): JSX.Element {
  const pct = Math.round((value ?? 0) * 100);
  return (
    <div
      style={{
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <p style={{ margin: 0, color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>{label}</p>
      <p style={{ margin: "4px 0 0", color: "var(--text)", fontWeight: 600, fontSize: 18 }}>{pct}</p>
    </div>
  );
}
