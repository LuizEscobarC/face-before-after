/**
 * OverlayLayer — SVG facial overlay renderer (PR-31, M3.1; improvement vectors PR-36, M3.2;
 * heatmap toggles + image layer PR-40, M3.3).
 *
 * Renders geometric overlay lines and improvement-vector arrows over a face photo.
 * Heatmaps (heatmap_asymmetry, heatmap_ideal_adherence) are server-rendered PNGs and
 * displayed via the sibling ``HeatmapImageLayer`` component (caller fetches the PNG
 * URL via POST /v1/overlays/:reportId/render and passes it in via heatmapAssetUrls).
 * Overlay IDs and styles match overlay_definition seed v1.0 (PR-30 + PR-39).
 *
 * References:
 *  - Naini 2011 §4-6, Powell & Humphreys 1984, Farkas 1994 (line overlays).
 *  - Improvement vector spec: PLAN_M3_OVERLAYS §2, DEC-25.
 *  - Heatmap renderer: backend/app/vision/services/heatmap_renderer.py (PR-37/38).
 *  - Z-order DEC-25: heatmap (z=30) renders BELOW lines (z=10/20) and vectors (z=40)
 *    so user can read both simultaneously.
 */

import type { MetricEvaluationResult } from "../types";

// Landmark index constants (MediaPipe Mesh-478)
// Source: backend/app/domain/landmarks_mesh.py
const P_NOSE_TIP        = 1;
const P_MENTON          = 152;
const P_LEFT_EYE_INNER  = 133;
const P_RIGHT_EYE_INNER = 362;
const P_LEFT_EYE_OUTER  = 33;
const P_RIGHT_EYE_OUTER = 263;
const P_BROW_LEFT_INNER  = 107;
const P_BROW_RIGHT_INNER = 336;
const P_SUBNASALE = 2;
const LM_JAWLINE  = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];

// Anchor landmark per metric_id — hardcoded for the 4 calculators that emit improvement_vector (PR-34).
// Reference: PLAN_M3_OVERLAYS §2, backend/app/services/metrics/{symmetry,jaw,brows}.py
const IMPROVEMENT_ANCHOR: Record<string, number> = {
  midline_deviation:  P_NOSE_TIP,
  chin_height_ratio:  P_MENTON,
  brow_height_l:      P_BROW_LEFT_INNER,
  brow_height_r:      P_BROW_RIGHT_INNER,
};

// Arrow color by severity5 (DEC-3, PLAN_M3_OVERLAYS §2)
const SEVERITY_ARROW_COLORS: Record<string, string> = {
  mild:     "#22c55e",
  moderate: "#eab308",
  strong:   "#f97316",
  extreme:  "#ef4444",
};

// Rendering styles (mirrors overlay_definition.rendering_hints from PR-30 + PR-39 seed)
const OVERLAY_STYLES: Record<string, {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}> = {
  axis_vertical:           { stroke: "#22d3ee", strokeWidth: 1.5, strokeDasharray: "4 2" },
  axis_intercanthal:       { stroke: "#22d3ee", strokeWidth: 1.5 },
  grid_thirds:             { stroke: "#a5b4fc", strokeWidth: 1,   strokeDasharray: "6 3" },
  grid_fifths:             { stroke: "#a5b4fc", strokeWidth: 1,   strokeDasharray: "6 3" },
  outline_face:            { stroke: "#67e8f9", strokeWidth: 1.5 },
  improvement_vectors:     { stroke: "#f97316", strokeWidth: 2 },  // swatch colour only; arrows use per-severity colours
  // Heatmaps (PR-37/38, M3.3) — swatch colour reflects the colormap mid-tone.
  heatmap_asymmetry:       { stroke: "#b40426", strokeWidth: 8 },  // coolwarm hot end
  heatmap_ideal_adherence: { stroke: "#3cb45a", strokeWidth: 8 },  // sequential ideal end
};

// Human-readable labels for toggle buttons
const OVERLAY_LABELS: Record<string, string> = {
  axis_vertical:           "Eixo vertical",
  axis_intercanthal:       "Eixo intercantal",
  grid_thirds:             "Terços faciais",
  grid_fifths:             "Quintos faciais",
  outline_face:            "Contorno facial",
  improvement_vectors:     "Vetores de melhoria",
  heatmap_asymmetry:       "Mapa de calor — assimetria",
  heatmap_ideal_adherence: "Mapa de calor — aderência",
};

// Heatmap overlay IDs — rendered as <img> layers (PNG fetched from Nest), not SVG.
const HEATMAP_OVERLAY_IDS = new Set([
  "heatmap_asymmetry",
  "heatmap_ideal_adherence",
]);

// Default toggle state
const DEFAULT_OVERLAYS = ["axis_vertical", "axis_intercanthal"];

export interface OverlayLayerProps {
  /** Raw pixel coordinate pairs [x, y] from MediaPipe Mesh-478 (478 entries). */
  landmarks: Array<[number, number]>;
  imageWidth: number;
  imageHeight: number;
  /** Overlay IDs to render. */
  activeOverlays: string[];
  /** Metric evaluations with improvement_vector_x/y (from Nest M1 pipeline, PR-34). Required for improvement_vectors overlay. */
  metricEvaluations?: MetricEvaluationResult[];
}

/**
 * Props for HeatmapImageLayer (PR-40, M3.3).
 *
 * The heatmap is a server-rendered PNG returned by POST /v1/overlays/:reportId/render
 * with overlay_id in {heatmap_asymmetry, heatmap_ideal_adherence}. The caller is
 * responsible for triggering the render call and supplying the resulting URL via
 * ``heatmapAssetUrls`` keyed by overlay_id.
 */
export interface HeatmapImageLayerProps {
  imageWidth: number;
  imageHeight: number;
  activeOverlays: string[];
  /** Map of overlay_id → presigned PNG URL (returned by Nest after render). */
  heatmapAssetUrls?: Record<string, string>;
}

/**
 * HeatmapImageLayer — server-rendered heatmap PNG overlay (PR-40, M3.3).
 *
 * Sits BETWEEN the base annotated image and the SVG OverlayLayer so that
 * lines/grids/vectors stay readable on top of the heatmap (DEC-25 z-order:
 * heatmap z=30, lines z=10/20, vectors z=40 — visually heatmap is "below"
 * the line overlays in the rendering stack so the user can read both at once).
 *
 * Only one heatmap is ever active at a time; if both toggles are on we render
 * the asymmetry one and ignore ideal_adherence (caller should enforce
 * single-selection in the UI).
 */
export function HeatmapImageLayer({
  imageWidth,
  imageHeight,
  activeOverlays,
  heatmapAssetUrls,
}: HeatmapImageLayerProps) {
  if (!heatmapAssetUrls) return null;
  const active = activeOverlays.find((id) => HEATMAP_OVERLAY_IDS.has(id));
  if (!active) return null;
  const url = heatmapAssetUrls[active];
  if (!url) return null;
  return (
    <img
      src={url}
      alt={OVERLAY_LABELS[active] ?? "heatmap"}
      width={imageWidth}
      height={imageHeight}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: imageWidth,
        height: imageHeight,
        pointerEvents: "none",
        // alpha is already baked into the PNG by the renderer (alpha=0.55 default)
      }}
      aria-hidden="true"
    />
  );
}

function lm(landmarks: Array<[number, number]>, idx: number): [number, number] {
  return landmarks[idx] ?? [0, 0];
}

function AxisVertical({ landmarks, h }: { landmarks: Array<[number, number]>; w: number; h: number }) {
  const xMid = (lm(landmarks, P_LEFT_EYE_INNER)[0] + lm(landmarks, P_RIGHT_EYE_INNER)[0]) / 2;
  const s = OVERLAY_STYLES.axis_vertical;
  return (
    <line
      x1={xMid} y1={0} x2={xMid} y2={h}
      stroke={s.stroke} strokeWidth={s.strokeWidth}
      strokeDasharray={s.strokeDasharray}
    />
  );
}

function AxisIntercanthal({ landmarks, w }: { landmarks: Array<[number, number]>; w: number; h: number }) {
  const yMid = (lm(landmarks, P_LEFT_EYE_INNER)[1] + lm(landmarks, P_RIGHT_EYE_INNER)[1]) / 2;
  const s = OVERLAY_STYLES.axis_intercanthal;
  return (
    <line
      x1={0} y1={yMid} x2={w} y2={yMid}
      stroke={s.stroke} strokeWidth={s.strokeWidth}
    />
  );
}

function GridThirds({ landmarks, w }: { landmarks: Array<[number, number]>; w: number; h: number }) {
  const yBrow = (lm(landmarks, P_BROW_LEFT_INNER)[1] + lm(landmarks, P_BROW_RIGHT_INNER)[1]) / 2;
  const ySub  = lm(landmarks, P_SUBNASALE)[1];
  const s = OVERLAY_STYLES.grid_thirds;
  return (
    <>
      <line x1={0} y1={yBrow} x2={w} y2={yBrow} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray={s.strokeDasharray} />
      <line x1={0} y1={ySub}  x2={w} y2={ySub}  stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray={s.strokeDasharray} />
    </>
  );
}

function GridFifths({ landmarks, h }: { landmarks: Array<[number, number]>; w: number; h: number }) {
  const xs = [P_LEFT_EYE_OUTER, P_LEFT_EYE_INNER, P_RIGHT_EYE_INNER, P_RIGHT_EYE_OUTER].map(
    (idx) => lm(landmarks, idx)[0]
  );
  const s = OVERLAY_STYLES.grid_fifths;
  return (
    <>
      {xs.map((x, i) => (
        <line key={i} x1={x} y1={0} x2={x} y2={h} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray={s.strokeDasharray} />
      ))}
    </>
  );
}

function OutlineFace({ landmarks }: { landmarks: Array<[number, number]> }) {
  const pts = LM_JAWLINE.map((i) => lm(landmarks, i).join(",")).join(" ");
  const s = OVERLAY_STYLES.outline_face;
  return (
    <polygon
      points={pts}
      stroke={s.stroke} strokeWidth={s.strokeWidth}
      fill="none"
    />
  );
}

/**
 * ImprovementVectors — PR-36 (M3.2).
 *
 * Renders one SVG arrow per metric that has a non-null improvement_vector.
 * - Anchor: hardcoded landmark per metric_id (see IMPROVEMENT_ANCHOR).
 * - Direction: (dx * icd_px, dy * icd_px) where icd_px is intercanthal distance in pixels.
 * - Color: per severity_5 (SEVERITY_ARROW_COLORS).
 * - "ideal" and null severities are skipped (no correction needed).
 *
 * References: PLAN_M3_OVERLAYS §2, DEC-25, Naini 2011 §4-6.
 */
function ImprovementVectors({
  landmarks,
  metricEvaluations,
}: {
  landmarks: Array<[number, number]>;
  metricEvaluations: MetricEvaluationResult[];
}) {
  // Intercanthal distance in pixels (inner canthus to inner canthus).
  // Used to scale ICU vectors to pixel space.
  const [lix, liy] = lm(landmarks, P_LEFT_EYE_INNER);
  const [rix, riy] = lm(landmarks, P_RIGHT_EYE_INNER);
  const icdPx = Math.hypot(rix - lix, riy - liy);
  if (icdPx < 1) return null;

  const arrows: JSX.Element[] = [];

  for (const metric of metricEvaluations) {
    const { metric_id, improvement_vector_x, improvement_vector_y, severity_5 } = metric;
    if (improvement_vector_x == null || improvement_vector_y == null) continue;
    if (!severity_5 || severity_5 === "ideal") continue;
    const color = SEVERITY_ARROW_COLORS[severity_5] ?? "#94a3b8";

    const anchorIdx = IMPROVEMENT_ANCHOR[metric_id];
    if (anchorIdx == null) continue;
    const [sx, sy] = lm(landmarks, anchorIdx);

    const ex = sx + improvement_vector_x * icdPx;
    const ey = sy + improvement_vector_y * icdPx;

    const dx = ex - sx;
    const dy = ey - sy;
    const len = Math.hypot(dx, dy);
    if (len < 2) continue; // skip near-zero vectors

    // Unit direction vector for arrowhead
    const nx = dx / len;
    const ny = dy / len;
    const ARROW_SIZE = 9;
    const WING_W = 4;
    const w1x = ex - nx * ARROW_SIZE + ny * WING_W;
    const w1y = ey - ny * ARROW_SIZE - nx * WING_W;
    const w2x = ex - nx * ARROW_SIZE - ny * WING_W;
    const w2y = ey - ny * ARROW_SIZE + nx * WING_W;

    arrows.push(
      <g key={metric_id}>
        <line
          x1={sx} y1={sy}
          x2={ex} y2={ey}
          stroke={color}
          strokeWidth={2}
          opacity={0.9}
        />
        <polygon
          points={`${ex},${ey} ${w1x},${w1y} ${w2x},${w2y}`}
          fill={color}
          opacity={0.9}
        />
      </g>
    );
  }

  return <>{arrows}</>;
}

export function OverlayLayer({ landmarks, imageWidth, imageHeight, activeOverlays, metricEvaluations }: OverlayLayerProps) {
  if (!landmarks || landmarks.length < 478) return null;

  const active = new Set(activeOverlays);
  const w = imageWidth;
  const h = imageHeight;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {/* z=10: axes */}
      {active.has("axis_vertical")     && <AxisVertical     landmarks={landmarks} w={w} h={h} />}
      {active.has("axis_intercanthal") && <AxisIntercanthal landmarks={landmarks} w={w} h={h} />}
      {/* z=10: grids */}
      {active.has("grid_thirds")       && <GridThirds       landmarks={landmarks} w={w} h={h} />}
      {active.has("grid_fifths")       && <GridFifths       landmarks={landmarks} w={w} h={h} />}
      {/* z=20: contour */}
      {active.has("outline_face")      && <OutlineFace      landmarks={landmarks} />}
      {/* z=40: improvement vectors (rendered last = topmost) */}
      {active.has("improvement_vectors") && metricEvaluations && metricEvaluations.length > 0 && (
        <ImprovementVectors landmarks={landmarks} metricEvaluations={metricEvaluations} />
      )}
    </svg>
  );
}

// Toggle bar component
export interface OverlayToggleBarProps {
  activeOverlays: string[];
  onToggle: (id: string) => void;
}

export function OverlayToggleBar({ activeOverlays, onToggle }: OverlayToggleBarProps) {
  const active = new Set(activeOverlays);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
      {Object.keys(OVERLAY_LABELS).map((id) => (
        <button
          key={id}
          onClick={() => onToggle(id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            background: active.has(id)
              ? "rgba(99,102,241,0.15)"
              : "var(--surface2)",
            border: active.has(id)
              ? "1px solid rgba(99,102,241,0.4)"
              : "1px solid var(--border)",
            borderRadius: 8,
            color: active.has(id) ? "var(--text)" : "var(--muted)",
            fontSize: 12,
            cursor: "pointer",
            textAlign: "left",
          }}
          aria-pressed={active.has(id)}
        >
          <span
            style={{
              width: 14,
              height: 3,
              background: OVERLAY_STYLES[id]?.stroke ?? "var(--accent)",
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
          {OVERLAY_LABELS[id]}
        </button>
      ))}
    </div>
  );
}

export { DEFAULT_OVERLAYS };
