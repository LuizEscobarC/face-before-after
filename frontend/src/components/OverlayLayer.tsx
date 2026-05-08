/**
 * OverlayLayer — SVG facial overlay renderer (PR-31, M3.1).
 *
 * Renders geometric overlay lines over a face photo.
 * Overlay IDs and styles match overlay_definition seed v1.0 (PR-30).
 *
 * References: Naini 2011 §4-6, Powell & Humphreys 1984, Farkas 1994.
 */

// Landmark index constants (MediaPipe Mesh-478)
// Source: backend/app/domain/landmarks_mesh.py
const P_LEFT_EYE_INNER  = 133;
const P_RIGHT_EYE_INNER = 362;
const P_LEFT_EYE_OUTER  = 33;
const P_RIGHT_EYE_OUTER = 263;
const P_BROW_LEFT_INNER  = 107;
const P_BROW_RIGHT_INNER = 336;
const P_SUBNASALE = 2;
const LM_JAWLINE  = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400];

// Rendering styles (mirrors overlay_definition.rendering_hints from PR-30 seed)
const OVERLAY_STYLES: Record<string, {
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}> = {
  axis_vertical:     { stroke: "#22d3ee", strokeWidth: 1.5, strokeDasharray: "4 2" },
  axis_intercanthal: { stroke: "#22d3ee", strokeWidth: 1.5 },
  grid_thirds:       { stroke: "#a5b4fc", strokeWidth: 1,   strokeDasharray: "6 3" },
  grid_fifths:       { stroke: "#a5b4fc", strokeWidth: 1,   strokeDasharray: "6 3" },
  outline_face:      { stroke: "#67e8f9", strokeWidth: 1.5 },
};

// Human-readable labels for toggle buttons
const OVERLAY_LABELS: Record<string, string> = {
  axis_vertical:     "Eixo vertical",
  axis_intercanthal: "Eixo intercantal",
  grid_thirds:       "Terços faciais",
  grid_fifths:       "Quintos faciais",
  outline_face:      "Contorno facial",
};

// Default toggle state
const DEFAULT_OVERLAYS = ["axis_vertical", "axis_intercanthal"];

export interface OverlayLayerProps {
  /** Raw pixel coordinate pairs [x, y] from MediaPipe Mesh-478 (478 entries). */
  landmarks: Array<[number, number]>;
  imageWidth: number;
  imageHeight: number;
  /** Overlay IDs to render. */
  activeOverlays: string[];
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
    <polyline
      points={pts}
      stroke={s.stroke} strokeWidth={s.strokeWidth}
      fill="none"
    />
  );
}

export function OverlayLayer({ landmarks, imageWidth, imageHeight, activeOverlays }: OverlayLayerProps) {
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
      {/* z-order: axes first, then grids, then contour */}
      {active.has("axis_vertical")     && <AxisVertical     landmarks={landmarks} w={w} h={h} />}
      {active.has("axis_intercanthal") && <AxisIntercanthal landmarks={landmarks} w={w} h={h} />}
      {active.has("grid_thirds")       && <GridThirds       landmarks={landmarks} w={w} h={h} />}
      {active.has("grid_fifths")       && <GridFifths       landmarks={landmarks} w={w} h={h} />}
      {active.has("outline_face")      && <OutlineFace      landmarks={landmarks} />}
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
