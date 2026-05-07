import { feynmanFor } from "../data/feynman";
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

/**
 * Mapeia uma métrica (com sufixos como _mean_deg, _pct_ipd, _left)
 * para a chave-base do glossário.
 */
function glossaryKeyFor(metricKey: string): string {
  // Mapeamento direto dos termos curados em backend/app/domain/layers/glossary.py
  const direct: Record<string, string> = {
    fwhr: "fwhr",
    canthal_tilt_left_deg: "canthal_tilt",
    canthal_tilt_right_deg: "canthal_tilt",
    canthal_tilt_mean_deg: "canthal_tilt",
    gonial_angle_left_deg: "gonial_angle",
    gonial_angle_right_deg: "gonial_angle",
    gonial_angle_mean_deg: "gonial_angle",
    marquardt_deviation_pct_ipd: "marquardt",
    marquardt_deviation_px: "marquardt",
    skin_uniformity_std_lab_left: "skin_uniformity",
    skin_uniformity_std_lab_right: "skin_uniformity",
    skin_uniformity_std_lab_forehead: "skin_uniformity",
    skin_lighting_delta_e_lr: "lab_delta_e",
    lighting_asymmetry_delta_e: "lab_delta_e",
    under_eye_darkness_left: "under_eye_darkness",
    under_eye_darkness_right: "under_eye_darkness",
    sharpness_laplacian_var: "laplacian_sharpness",
    head_pose_yaw_deg: "solvepnp_pose",
    head_pose_pitch_deg: "solvepnp_pose",
    head_pose_roll_deg: "solvepnp_pose",
    thirds_std_dev: "thirds_fifths",
    fifths_std_dev: "thirds_fifths",
    thirds_upper_ratio: "thirds_fifths",
    thirds_middle_ratio: "thirds_fifths",
    thirds_lower_ratio: "thirds_fifths",
    jawline_definition_score: "jawline_definition_score",
    ipd_px: "ipd",
  };
  return direct[metricKey] ?? metricKey;
}

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
  const feynman = feynmanFor(metricKey);
  const term = glossary?.[glossaryKeyFor(metricKey)];

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
