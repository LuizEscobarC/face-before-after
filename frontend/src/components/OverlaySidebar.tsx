/**
 * OverlaySidebar — painel textual ao lado de cada overlay SVG.
 *
 * Substitui os labels que antes eram queimados (baixa qualidade tipográfica)
 * dentro do PNG.  Cada variant casa com um overlay específico.  Paleta
 * espelha as CSS variables (--surface2 / --border / --text / --muted) definidas
 * em CLAUDE.md.
 */

import type { AnalysisResult } from "../types";
import React from "react";

type Annotations = NonNullable<AnalysisResult["overlay_annotations"]>;

type Variant =
  | "grid_thirds"
  | "grid_fifths"
  | "face_extents"
  | "ideal_proportions"
  | "metrics_map";

interface Props {
  variant: Variant;
  data: Annotations;
  selectedKey?: string | null;
  onSelectKey?: (key: string) => void;
  regionAdherence?: Array<{ region: string; adherence: number; confidence: number }>;
}

const SEVERITY_BG: Record<string, string> = {
  ideal:    "rgba(34, 197, 94, 0.18)",
  mild:     "rgba(34, 197, 94, 0.18)",
  moderate: "rgba(234, 179, 8, 0.20)",
  strong:   "rgba(249, 115, 22, 0.20)",
  extreme:  "rgba(239, 68, 68, 0.22)",
};

const SEVERITY_FG: Record<string, string> = {
  ideal:    "#86efac",
  mild:     "#86efac",
  moderate: "#fde68a",
  strong:   "#fdba74",
  extreme:  "#fca5a5",
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface2)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 16,
  color: "var(--text)",
  fontSize: 13,
  lineHeight: 1.45,
};

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: "var(--muted)",
  marginBottom: 10,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 10px",
  borderRadius: 8,
  marginBottom: 4,
};

const legendStyle: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: "1px solid var(--border)",
  color: "var(--muted)",
  fontSize: 12,
};

const IDEAL_PROPORTION_LABELS: Record<string, string> = {
  forehead_height_ratio: "Altura da testa",
  lower_third_ratio: "Terço inferior",
  middle_third_ratio: "Terço médio",
  upper_third_ratio: "Terço superior",
};

function idealProportionLabel(metricId?: string): string {
  if (!metricId) return "Proporção";
  return IDEAL_PROPORTION_LABELS[metricId] ?? metricId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function OverlaySidebar({ variant, data, selectedKey, onSelectKey, regionAdherence }: Props) {
  switch (variant) {
    case "grid_thirds":
      return renderGridThirds(data.grid_thirds);
    case "grid_fifths":
      return renderGridFifths(data.grid_fifths);
    case "face_extents":
      return renderFaceExtents(data.face_extents);
    case "ideal_proportions":
      return renderIdealProportions(data.ideal_proportions, selectedKey, onSelectKey);
    case "metrics_map":
      return renderMetricsMap(regionAdherence ?? [], selectedKey, onSelectKey);
  }
}

function renderGridThirds(g: Annotations["grid_thirds"]) {
  if (!g) return null;
  return (
    <aside style={cardStyle}>
      <div style={titleStyle}>Terços faciais</div>
      {g.rows.map((r) => {
        const sev = r.severity_5 ?? undefined;
        const bg = (sev && SEVERITY_BG[sev]) || "rgba(255,255,255,0.04)";
        const fg = (sev && SEVERITY_FG[sev]) || "var(--text)";
        return (
          <div key={r.id} style={{ ...rowStyle, background: bg }}>
            <div>
              <strong style={{ color: fg }}>{r.id}</strong>{" "}
              <span style={{ color: "var(--muted)" }}>· {r.label}</span>
            </div>
            <div style={{ color: fg, fontVariantNumeric: "tabular-nums" }}>
              {r.pct.toFixed(1)}%{" "}
              <span style={{ color: "var(--muted)", marginLeft: 6 }}>
                ({r.deviation_pct >= 0 ? "+" : ""}{r.deviation_pct.toFixed(1)} pp)
              </span>
            </div>
          </div>
        );
      })}
      <div style={legendStyle}>
        Ideal {g.ideal_pct}% por terço (Farkas 1994). Cores indicam severidade.
        {g.legend?.dashed_purple && <div style={{ marginTop: 4 }}>· {g.legend.dashed_purple}</div>}
        {g.legend?.solid_orange && <div>· {g.legend.solid_orange}</div>}
      </div>
    </aside>
  );
}

function renderGridFifths(g: Annotations["grid_fifths"]) {
  if (!g) return null;
  return (
    <aside style={cardStyle}>
      <div style={titleStyle}>Quintos faciais</div>
      {g.rows.map((r) => {
        const dev = r.deviation_px;
        const sign = dev === 0 ? "±0" : dev > 0 ? `+${dev}` : `${dev}`;
        return (
          <div key={r.id} style={{ ...rowStyle, background: "rgba(255,255,255,0.04)" }}>
            <div><strong>{r.id}</strong></div>
            <div style={{ color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              {sign} px
            </div>
          </div>
        );
      })}
      <div style={legendStyle}>
        Desvio do canto ocular real em relação à divisão ideal de 1/5 da largura facial.
        {g.legend?.dashed_purple && <div style={{ marginTop: 4 }}>· {g.legend.dashed_purple}</div>}
        {g.legend?.solid_orange && <div>· {g.legend.solid_orange}</div>}
      </div>
    </aside>
  );
}

function renderFaceExtents(f: Annotations["face_extents"]) {
  if (!f) return null;
  return (
    <aside style={cardStyle}>
      <div style={titleStyle}>Extensão facial</div>
      <div style={{ ...rowStyle, background: "rgba(255,255,255,0.04)" }}>
        <div>{f.trichion_label}</div>
        <div style={{ color: "var(--muted)" }}>topo</div>
      </div>
      <div style={{ ...rowStyle, background: "rgba(255,255,255,0.04)" }}>
        <div>{f.menton_label}</div>
        <div style={{ color: "var(--muted)" }}>base</div>
      </div>
      <div style={{ ...rowStyle, background: "rgba(99,102,241,0.10)" }}>
        <div style={{ color: "var(--muted)" }}>Altura</div>
        <div style={{ fontVariantNumeric: "tabular-nums" }}>{f.face_height_px} px</div>
      </div>
      <div style={{ ...rowStyle, background: "rgba(99,102,241,0.10)" }}>
        <div style={{ color: "var(--muted)" }}>Largura zigomática</div>
        <div style={{ fontVariantNumeric: "tabular-nums" }}>{f.face_width_px} px</div>
      </div>
      {f.legend && <div style={legendStyle}>{f.legend}</div>}
    </aside>
  );
}

function renderIdealProportions(
  rows: Annotations["ideal_proportions"],
  selectedKey?: string | null,
  onSelectKey?: (key: string) => void,
) {
  if (!rows || rows.length === 0) return null;
  return (
    <aside style={cardStyle}>
      <div style={titleStyle}>Proporções ideais</div>
      <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 10, lineHeight: 1.5 }}>
        Referências canônicas usadas para alinhar a leitura dos terços faciais.
      </div>
      {rows.map((r, i) => {
        const sev = r.severity_5 ?? undefined;
        const bg = (sev && SEVERITY_BG[sev]) || "rgba(255,255,255,0.04)";
        const fg = (sev && SEVERITY_FG[sev]) || "var(--text)";
        const key = r.metric_id ?? `${i}`;
        const isSelected = selectedKey === key;
        return (
          <div
            key={key}
            style={{
              ...rowStyle,
              background: bg,
              cursor: "pointer",
              border: isSelected ? `1px solid ${fg}` : "1px solid transparent",
            }}
            onClick={() => onSelectKey?.(key)}
          >
            <div>
              <div style={{ color: fg, fontWeight: 600 }}>{idealProportionLabel(r.metric_id)}</div>
              <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>
                {r.direction ? r.direction.replace(/_/g, " ") : "referência"}
              </div>
            </div>
            <div style={{ color: fg, fontVariantNumeric: "tabular-nums" }}>
              {r.value != null ? Number(r.value).toFixed(3) : "—"}
            </div>
          </div>
        );
      })}
    </aside>
  );
}

function regionLabel(region: string): string {
  const MAP: Record<string, string> = {
    FOREHEAD: "Testa",
    EYES: "Olhos",
    NOSE: "Nariz",
    MOUTH: "Boca",
    JAW: "Mandibula",
  };
  return MAP[region] ?? region;
}

function renderMetricsMap(
  rows: Array<{ region: string; adherence: number; confidence: number }>,
  selectedKey?: string | null,
  onSelectKey?: (key: string) => void,
) {
  if (!rows || rows.length === 0) return null;
  const sorted = [...rows].sort((a, b) => a.region.localeCompare(b.region));

  return (
    <aside style={cardStyle}>
      <div style={titleStyle}>Mapa de metricas</div>
      {sorted.map((r) => {
        const pct = Math.round(r.adherence * 100);
        const isSelected = selectedKey === r.region;
        return (
          <div
            key={r.region}
            style={{
              ...rowStyle,
              background: "rgba(255,255,255,0.04)",
              cursor: "pointer",
              border: isSelected ? "1px solid rgba(34,211,238,0.7)" : "1px solid transparent",
            }}
            onClick={() => onSelectKey?.(r.region)}
          >
            <div>
              <strong>{regionLabel(r.region)}</strong>
              <div style={{ color: "var(--muted)", fontSize: 11 }}>
                Confianca {Math.round(r.confidence * 100)}%
              </div>
            </div>
            <div style={{ fontVariantNumeric: "tabular-nums" }}>{pct}%</div>
          </div>
        );
      })}
      <div style={legendStyle}>Clique em uma regiao para sincronizar destaque no SVG.</div>
    </aside>
  );
}
