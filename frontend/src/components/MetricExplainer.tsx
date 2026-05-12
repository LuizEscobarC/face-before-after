import type { GlossaryTerm } from "../types";

interface Props {
  metricKey: string;            // ex: "fwhr", "canthal_tilt_mean_deg"
  label: string;                // ex: "Razão facial (fWHR)"
  value: string;                // ex: "1.82"
  unit?: string;                // ex: "razão"
  ideal?: string;               // ex: "~1.85"
  severity?: string;            // ex: "leve" | "excelente"
  glossary?: Record<string, GlossaryTerm>;
}

// Glossary entries are now keyed by the concrete ``metric_id`` (the backend
// resolves former aliases like canthal_tilt_left_deg → canthal_tilt at seed
// time inside ``metric_content``). The Feynman analogy lives on the same
// entry as ``term.feynman``.

function severityClass(severity: string | undefined): string {
  if (!severity) return "sev-pill sev-info";
  const k = severity.toLowerCase();
  if (k.includes("excel")) return "sev-pill sev-excelente";
  if (k.includes("leve")) return "sev-pill sev-leve";
  if (k.includes("moder")) return "sev-pill sev-moderada";
  if (k.includes("acent")) return "sev-pill sev-acentuada";
  if (k.includes("sever")) return "sev-pill sev-severa";
  return "sev-pill sev-info";
}

export function MetricExplainer({
  metricKey,
  label,
  value,
  unit,
  ideal,
  severity,
  glossary,
}: Props) {
  const term = glossary?.[metricKey];
  const feynman = term?.feynman ?? null;

  return (
    <details className="metric-explainer">
      <summary>
        <span className="me-label">{label}</span>
        <span className="me-value">
          {value}
          {unit && <span className="me-unit"> {unit}</span>}
        </span>
        {severity && <span className={severityClass(severity)}>{severity}</span>}
        <span className="me-toggle" aria-hidden>▾</span>
      </summary>

      <div className="me-body">
        {/* Camada 1 — Feynman */}
        {feynman && (
          <details className="me-layer me-feynman" open>
            <summary>💡 Em palavras simples</summary>
            <p>{feynman}</p>
          </details>
        )}

        {/* Camada 2 — Como medimos */}
        {term?.como_medido && (
          <details className="me-layer">
            <summary>🔬 Como medimos</summary>
            <p>{term.como_medido}</p>
            {ideal && (
              <p className="me-mini">
                <strong>Ideal:</strong> {ideal}
              </p>
            )}
          </details>
        )}

        {/* Camada 3 — Faixas + problemas comuns */}
        {term && (term.faixas || term.problemas_comuns?.length) && (
          <details className="me-layer">
            <summary>📐 Faixas e problemas comuns</summary>
            {term.faixas && (
              <p className="me-mini">
                <strong>Faixas típicas:</strong> {term.faixas}
              </p>
            )}
            {term.problemas_comuns && term.problemas_comuns.length > 0 && (
              <>
                <p className="me-mini" style={{ marginTop: 8 }}>
                  <strong>Quando confiar menos no número:</strong>
                </p>
                <ul className="me-list">
                  {term.problemas_comuns.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </>
            )}
            {term.referencias && term.referencias.length > 0 && (
              <p className="me-mini" style={{ marginTop: 8 }}>
                <strong>Referências:</strong>{" "}
                {term.referencias.map((r, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="me-link"
                    >
                      {r.titulo}
                    </a>
                  </span>
                ))}
              </p>
            )}
          </details>
        )}

        {!feynman && !term && (
          <p className="me-mini" style={{ color: "var(--muted)" }}>
            Métrica técnica — sem explicação detalhada disponível ainda.
          </p>
        )}
      </div>
    </details>
  );
}
