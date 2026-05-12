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
const P_FOREHEAD_CROWN  = 10;  // hairline proxy
// Bizygomatic anchors — outermost cheek/contour points for FaceExtents bounding box.
// 234 = image-left (person's right cheek), 454 = image-right (person's left cheek).
const P_ZYGO_IMG_RIGHT = 454;
const P_ZYGO_IMG_LEFT  = 234;
// Eye outer corners — used for the Rule of Fifths (Naini 2011 §6).
// The five fifths are: [face edge | outer eye L | inner eye L–inner eye R | outer eye R | face edge].
// We use eye-outer as the 1/5 and 4/5 dividers; face edges are ZYGO anchors above.
// P_LEFT_EYE_OUTER = 33 (person's right eye outer = image-left outer corner)
// P_RIGHT_EYE_OUTER = 263 (person's left eye outer = image-right outer corner)
const P_EYE_OUTER_IMG_LEFT  = 33;   // image-left  eye outer corner
const P_EYE_OUTER_IMG_RIGHT = 263;  // image-right eye outer corner
// Facial outline — 17 mandible points (backend landmark_mesh.py LM_JAWLINE).
// Front-end closes the polygon with the 37-point full-contour from cheek to cheek.
const LM_JAWLINE  = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];

// Anchor landmark indices for improvement-vector arrows used to come from
// a hardcoded ``IMPROVEMENT_ANCHOR`` map. The backend now ships the anchor
// per-metric on ``MetricEvaluationResult.anchor_landmark_index`` (sourced
// from ``metric_definition.dependency_landmarks[0]``), so we read it from
// the payload instead of duplicating the table client-side.
// Reference: PLAN_M3_OVERLAYS §2, backend/app/services/metrics/{symmetry,jaw,brows}.py

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
  face_extents:            { stroke: "#ffffff", strokeWidth: 1.5 },
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
  face_extents:            "Extremidades da face",
  improvement_vectors:     "Vetores de melhoria",
  heatmap_asymmetry:       "Mapa de calor — assimetria",
  heatmap_ideal_adherence: "Mapa de calor — aderência",
};

// Heatmap overlay IDs — rendered as <img> layers (PNG fetched from Nest), not SVG.
const HEATMAP_OVERLAY_IDS = new Set([
  "heatmap_asymmetry",
  "heatmap_ideal_adherence",
]);

// Default toggle state — axes give frame, contour shows oval, improvement
// vectors surface the "what to fix" arrows immediately (M3.2 hero feature).
const DEFAULT_OVERLAYS = ["axis_vertical", "axis_intercanthal", "outline_face", "face_extents", "grid_thirds", "improvement_vectors"];

export interface OverlayLayerProps {
  /** Raw pixel coordinate pairs [x, y] from MediaPipe Mesh-478 (478 entries). */
  landmarks: Array<[number, number]>;
  /** Rendered (CSS layout) width of the image in px — sets the SVG element size. */
  imageWidth: number;
  /** Rendered (CSS layout) height of the image in px — sets the SVG element size. */
  imageHeight: number;
  /**
   * Natural (intrinsic) image width in px — used as the SVG viewBox width so that
   * landmark pixel coordinates (which are in natural-image space) map correctly onto
   * the scaled SVG.  If omitted, falls back to imageWidth (backward-compatible when
   * imageWidth already equals naturalWidth).
   */
  viewBoxWidth?: number;
  /**
   * Natural (intrinsic) image height in px — used as the SVG viewBox height.
   * If omitted, falls back to imageHeight.
   */
  viewBoxHeight?: number;
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
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
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

function AxisVertical({ landmarks, vbH }: { landmarks: Array<[number, number]>; vbW: number; vbH: number }) {
  // Midline passes through the midpoint between the two inner canthi.
  // For a more anatomically correct midline, average with nose tip x as well.
  const xEyes = (lm(landmarks, P_LEFT_EYE_INNER)[0] + lm(landmarks, P_RIGHT_EYE_INNER)[0]) / 2;
  const xNose = lm(landmarks, P_NOSE_TIP)[0];
  const xMid = (xEyes + xNose) / 2;
  const s = OVERLAY_STYLES.axis_vertical;
  return (
    <line
      x1={xMid} y1={0} x2={xMid} y2={vbH}
      stroke={s.stroke} strokeWidth={s.strokeWidth}
      strokeDasharray={s.strokeDasharray}
    />
  );
}

function AxisIntercanthal({ landmarks, vbW }: { landmarks: Array<[number, number]>; vbW: number; vbH: number }) {
  const yMid = (lm(landmarks, P_LEFT_EYE_INNER)[1] + lm(landmarks, P_RIGHT_EYE_INNER)[1]) / 2;
  const s = OVERLAY_STYLES.axis_intercanthal;
  return (
    <line
      x1={0} y1={yMid} x2={vbW} y2={yMid}
      stroke={s.stroke} strokeWidth={s.strokeWidth}
    />
  );
}

// Maps severity_5 (backend SeverityClassifier) to a color — aligns with
// SEVERITY_ARROW_COLORS and replaces the old hardcoded deviation% thresholds.
function _severityColor(severity5: string | null | undefined): string {
  switch (severity5) {
    case "ideal":    return "#22c55e";
    case "mild":     return "#22c55e";
    case "moderate": return "#eab308";
    case "strong":   return "#f97316";
    case "extreme":  return "#ef4444";
    default:         return "#94a3b8"; // unknown / null
  }
}

/**
 * FaceExtents — desenha linhas sólidas brancas nas extremidades da face
 * (hairline, queixo, têmpora L, têmpora R) com labels.
 */
function FaceExtents({ landmarks }: { landmarks: Array<[number, number]> }) {
  const yTop = lm(landmarks, P_FOREHEAD_CROWN)[1];
  const yMenton = lm(landmarks, P_MENTON)[1];
  // 234 = image-left zygomatic arch (lower x), 454 = image-right (higher x).
  const xL = lm(landmarks, P_ZYGO_IMG_LEFT)[0];
  const xR = lm(landmarks, P_ZYGO_IMG_RIGHT)[0];
  const stroke = "#ffffff";
  return (
    <g>
      <line x1={xL} y1={yTop}    x2={xR} y2={yTop}    stroke={stroke} strokeWidth={1.5} />
      <line x1={xL} y1={yMenton} x2={xR} y2={yMenton} stroke={stroke} strokeWidth={1.5} />
      <line x1={xL} y1={yTop}    x2={xL} y2={yMenton} stroke={stroke} strokeWidth={1.5} />
      <line x1={xR} y1={yTop}    x2={xR} y2={yMenton} stroke={stroke} strokeWidth={1.5} />
      <text x={xL + 4} y={yTop - 4} fill={stroke} fontSize={11} fontWeight={600}
        style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>Trichion (mesh)</text>
      <text x={xL + 4} y={yMenton + 14} fill={stroke} fontSize={11} fontWeight={600}
        style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>Menton</text>
    </g>
  );
}

function GridThirds({
  landmarks,
  vbW,
  metricEvaluations,
}: {
  landmarks: Array<[number, number]>;
  vbW: number;
  vbH: number;
  metricEvaluations?: MetricEvaluationResult[];
}) {
  const yTop  = lm(landmarks, P_FOREHEAD_CROWN)[1];
  const yBrow = (lm(landmarks, P_BROW_LEFT_INNER)[1] + lm(landmarks, P_BROW_RIGHT_INNER)[1]) / 2;
  const ySub  = lm(landmarks, P_SUBNASALE)[1];
  const yMen  = lm(landmarks, P_MENTON)[1];
  const xL = lm(landmarks, P_ZYGO_IMG_LEFT)[0];
  const xR = lm(landmarks, P_ZYGO_IMG_RIGHT)[0];

  const metricsMap = new Map(
    (metricEvaluations ?? []).map((m) => [m.metric_id, m])
  );
  const mUpper  = metricsMap.get("upper_third_ratio");
  const mMiddle = metricsMap.get("middle_third_ratio");
  const mLower  = metricsMap.get("lower_third_ratio");

  const faceH = Math.max(1, yMen - yTop);
  const upperPct  = mUpper?.value  != null ? (mUpper.value as number)  * 100 : ((yBrow - yTop) / faceH) * 100;
  const middlePct = mMiddle?.value != null ? (mMiddle.value as number) * 100 : ((ySub  - yBrow) / faceH) * 100;
  const lowerPct  = mLower?.value  != null ? (mLower.value as number)  * 100 : ((yMen  - ySub) / faceH) * 100;

  const upperColor  = _severityColor(mUpper?.severity_5);
  const middleColor = _severityColor(mMiddle?.severity_5);
  const lowerColor  = _severityColor(mLower?.severity_5);

  // Ideal dividers: where brow and subnasale WOULD be if face were perfectly divided.
  // These are reference lines — not landmark positions.
  const yT1 = yTop + faceH / 3;
  const yT2 = yTop + (2 * faceH) / 3;

  const s = OVERLAY_STYLES.grid_thirds;
  // Lateral labels anchored to the RIGHT zygomatic edge + small margin.
  // xR is typically close to the viewBox right edge (~94% of vbW), so we place
  // text anchored to the right margin of the viewBox instead to avoid clipping.
  const labelX = vbW - 4;
  const inlineLabelX = xL + 4;

  const thirds = [
    { yA: yTop,  yB: yBrow, pct: upperPct,  label: "T1", color: upperColor },
    { yA: yBrow, yB: ySub,  pct: middlePct, label: "T2", color: middleColor },
    { yA: ySub,  yB: yMen,  pct: lowerPct,  label: "T3", color: lowerColor },
  ];

  return (
    <g>
      {/* Ideal equal-thirds dividers (dashed purple) — reference, not landmarks */}
      <line x1={0} y1={yT1} x2={vbW} y2={yT1} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray={s.strokeDasharray} />
      <line x1={0} y1={yT2} x2={vbW} y2={yT2} stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray={s.strokeDasharray} />
      <text x={inlineLabelX} y={yT1 - 3} fill={s.stroke} fontSize={10}
        style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>ideal 1/3</text>
      <text x={inlineLabelX} y={yT2 - 3} fill={s.stroke} fontSize={10}
        style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>ideal 2/3</text>

      {/* Actual landmark lines (solid orange) — brow and subnasale */}
      <line x1={0} y1={yBrow} x2={vbW} y2={yBrow} stroke="#f97316" strokeWidth={1.5} opacity={0.9} />
      <text x={inlineLabelX} y={yBrow - 3} fill="#f97316" fontSize={10}
        style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>Sobrancelha</text>
      <line x1={0} y1={ySub} x2={vbW} y2={ySub} stroke="#f97316" strokeWidth={1.5} opacity={0.9} />
      <text x={inlineLabelX} y={ySub - 3} fill="#f97316" fontSize={10}
        style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>Subnasale</text>

      {/* Lateral labels right-aligned to vbW — avoids clipping when xR ≈ vbW */}
      {thirds.map(({ yA, yB, pct, label, color }) => {
        const dev = pct - 33.3;
        const devStr = dev >= 0 ? `+${dev.toFixed(0)}` : `${dev.toFixed(0)}`;
        return (
          <text key={label} x={labelX} y={(yA + yB) / 2 + 4}
            fill={color} fontSize={11} fontWeight={700}
            textAnchor="end"
            style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>
            {label} {pct.toFixed(0)}% ({devStr}%)
          </text>
        );
      })}
    </g>
  );
}

function GridFifths({ landmarks }: { landmarks: Array<[number, number]> }) {
  const yTop = lm(landmarks, P_FOREHEAD_CROWN)[1];
  const yMen = lm(landmarks, P_MENTON)[1];
  // Rule of Fifths (Naini 2011 §6): face divided into 5 equal vertical fifths.
  // Boundaries: bizygomatic edges (234/454).
  // Ideal dividers: 1/5 & 4/5 = eye outer corners; 2/5 & 3/5 = eye inner corners.
  const xFaceL  = lm(landmarks, P_ZYGO_IMG_LEFT)[0];
  const xFaceR  = lm(landmarks, P_ZYGO_IMG_RIGHT)[0];
  const xEyeOL  = lm(landmarks, P_EYE_OUTER_IMG_LEFT)[0];
  const xEyeIL  = lm(landmarks, P_LEFT_EYE_INNER)[0];
  const xEyeIR  = lm(landmarks, P_RIGHT_EYE_INNER)[0];
  const xEyeOR  = lm(landmarks, P_EYE_OUTER_IMG_RIGHT)[0];

  const faceW = Math.max(1, xFaceR - xFaceL);
  const fifth = faceW / 5;
  const s = OVERLAY_STYLES.grid_fifths;

  // Ideal x positions for each divider
  const ideals = [1, 2, 3, 4].map((i) => xFaceL + i * fifth);
  // Actual landmark x positions aligned to each ideal divider
  const actuals = [xEyeOL, xEyeIL, xEyeIR, xEyeOR];
  const names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"];

  // Y position for deviation labels — just above menton so they don't overlap with brow labels
  const yLabel = yMen - 10;

  return (
    <g>
      {/* Face edge boundaries (white) */}
      <line x1={xFaceL} y1={yTop} x2={xFaceL} y2={yMen} stroke="#ffffff" strokeWidth={1} opacity={0.6} />
      <line x1={xFaceR} y1={yTop} x2={xFaceR} y2={yMen} stroke="#ffffff" strokeWidth={1} opacity={0.6} />

      {/* Ideal equal fifths (dashed purple) */}
      {ideals.map((x, i) => (
        <line key={`ideal-${i}`}
          x1={x} y1={yTop} x2={x} y2={yMen}
          stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray={s.strokeDasharray} />
      ))}

      {/* Actual eye-corner positions (solid orange) + deviation label */}
      {actuals.map((x, i) => {
        const dev = Math.round(x - ideals[i]);
        const devStr = dev === 0 ? "±0" : dev > 0 ? `+${dev}` : `${dev}`;
        return (
          <g key={`actual-${i}`}>
            <line x1={x} y1={yTop} x2={x} y2={yMen} stroke="#f97316" strokeWidth={1.5} opacity={0.9} />
            <text x={x + 2} y={yLabel} fill="#f97316" fontSize={9} fontWeight={600}
              style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>
              {names[i]} {devStr}px
            </text>
          </g>
        );
      })}

      <text x={xFaceL + 2} y={yTop - 4} fill={s.stroke} fontSize={10} fontWeight={600}
        style={{ paintOrder: "stroke", stroke: "#000", strokeWidth: 2 }}>
        Quintos — tracejado: ideal · laranja: real (desvio em px)
      </text>
    </g>
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
 * - Anchor: ``MetricEvaluationResult.anchor_landmark_index`` (server-supplied,
 *   from ``metric_definition.dependency_landmarks[0]``).
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
    const { metric_id, improvement_vector_x, improvement_vector_y, severity_5, anchor_landmark_index } = metric;
    if (improvement_vector_x == null || improvement_vector_y == null) continue;
    if (!severity_5 || severity_5 === "ideal") continue;
    const color = SEVERITY_ARROW_COLORS[severity_5] ?? "#94a3b8";

    if (anchor_landmark_index == null) continue;
    const [sx, sy] = lm(landmarks, anchor_landmark_index);

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

export function OverlayLayer({ landmarks, imageWidth, imageHeight, viewBoxWidth, viewBoxHeight, activeOverlays, metricEvaluations }: OverlayLayerProps) {
  if (!landmarks || landmarks.length < 478) return null;

  const active = new Set(activeOverlays);
  const w = imageWidth;
  const h = imageHeight;
  // viewBox uses natural/intrinsic dimensions so landmark coordinates (which are in
  // natural-image pixel space) map correctly when the SVG element is rendered at a
  // different (CSS-constrained) size than the original photo.
  const vbW = viewBoxWidth ?? imageWidth;
  const vbH = viewBoxHeight ?? imageHeight;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${vbW} ${vbH}`}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "none",
      }}
      aria-hidden="true"
    >
      {/* z=10: axes */}
      {active.has("axis_vertical")     && <AxisVertical     landmarks={landmarks} vbW={vbW} vbH={vbH} />}
      {active.has("axis_intercanthal") && <AxisIntercanthal landmarks={landmarks} vbW={vbW} vbH={vbH} />}
      {/* z=10: grids */}
      {active.has("grid_thirds")       && <GridThirds       landmarks={landmarks} vbW={vbW} vbH={vbH} metricEvaluations={metricEvaluations} />}
      {active.has("grid_fifths")       && <GridFifths       landmarks={landmarks} />}
      {/* z=20: contour */}
      {active.has("outline_face")      && <OutlineFace      landmarks={landmarks} />}
      {active.has("face_extents")      && <FaceExtents      landmarks={landmarks} />}
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
