import React from "react";

export interface AsymmetryAnalysisData {
  image_size: { width: number; height: number };
  frankfort_horizontal: {
    y: number;
    eye_left: { x: number; y: number };
    eye_right: { x: number; y: number };
  };
  facial_midline: {
    x_top: number;
    y_top: number;
    x_bottom: number;
    y_bottom: number;
  };
  deviations: Array<{
    label: string;
    landmark_idx: number;
    x: number;
    y: number;
    midline_x: number;
    deviation_px: number;
  }>;
  overall_asymmetry_score?: number | null;
  overall_asymmetry_score_pct_ipd?: number | null;
}

interface AsymmetryAnalysisLayerProps {
  viewBoxWidth: number;
  viewBoxHeight: number;
  landmarks?: Array<[number, number]>;
  data: AsymmetryAnalysisData;
  selectedPoint?: string | null;
  onSelectPoint?: (label: string) => void;
  activeOverlays?: string[];
}

const COLOR_LANDMARKS  = "#22c55e";
const COLOR_FRANKFORT  = "#facc15";
const COLOR_MIDLINE    = "#60a5fa";
const COLOR_DEVIATION  = "#ef4444";
const COLOR_TEXT       = "#f8fafc";
const COLOR_TEXT_BG    = "rgba(0,0,0,0.65)";

export function AsymmetryAnalysisLayer({
  viewBoxWidth,
  viewBoxHeight,
  landmarks,
  data,
  selectedPoint,
  onSelectPoint,
  activeOverlays,
}: AsymmetryAnalysisLayerProps) {
  if (!data || !data.frankfort_horizontal || !data.facial_midline) return null;

  const active = activeOverlays ? new Set(activeOverlays) : null;
  const show = (key: string) => active === null || active.has(key);

  const { frankfort_horizontal: fh, facial_midline: ml, deviations } = data;
  const stroke = Math.max(1, viewBoxWidth / 600);
  const fontSize = Math.max(10, viewBoxWidth / 70);
  const dotR = Math.max(2, viewBoxWidth / 400);

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      width="100%"
      height="100%"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        pointerEvents: "auto",
        zIndex: 18,
      }}
      aria-hidden="true"
    >
      {show("asymmetry_points") && landmarks && landmarks.length > 0 && (
        <g opacity={0.7}>
          {landmarks.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={dotR * 0.7} fill={COLOR_LANDMARKS} />
          ))}
        </g>
      )}

      {show("asymmetry_frankfort") && (
        <>
          <line
            x1={0}
            y1={fh.y}
            x2={viewBoxWidth}
            y2={fh.y}
            stroke={COLOR_FRANKFORT}
            strokeWidth={stroke * 1.5}
            strokeDasharray={`${stroke * 6} ${stroke * 4}`}
          />
          <circle cx={fh.eye_left.x}  cy={fh.eye_left.y}  r={dotR * 2} fill={COLOR_FRANKFORT} />
          <circle cx={fh.eye_right.x} cy={fh.eye_right.y} r={dotR * 2} fill={COLOR_FRANKFORT} />
          <text
            x={10}
            y={fh.y - 6}
            fontSize={fontSize}
            fontWeight={600}
            fill={COLOR_FRANKFORT}
            style={{ paintOrder: "stroke", stroke: COLOR_TEXT_BG, strokeWidth: 3 }}
          >
            Frankfort Horizontal
          </text>
        </>
      )}

      {show("asymmetry_midline") && (
        <>
          <line
            x1={ml.x_top}
            y1={ml.y_top}
            x2={ml.x_bottom}
            y2={ml.y_bottom}
            stroke={COLOR_MIDLINE}
            strokeWidth={stroke * 1.5}
          />
          <text
            x={ml.x_top + 6}
            y={ml.y_top + fontSize}
            fontSize={fontSize}
            fontWeight={600}
            fill={COLOR_MIDLINE}
            style={{ paintOrder: "stroke", stroke: COLOR_TEXT_BG, strokeWidth: 3 }}
          >
            Facial Midline
          </text>
        </>
      )}

      {show("asymmetry_points") && deviations.map((d) => {
        const selected = selectedPoint === d.label;
        return (
          <g key={d.label} style={{ cursor: onSelectPoint ? "pointer" : "default" }}
             onClick={() => onSelectPoint?.(d.label)}>
            <line
              x1={d.x}
              y1={d.y}
              x2={d.midline_x}
              y2={d.y}
              stroke={COLOR_DEVIATION}
              strokeWidth={selected ? stroke * 2.5 : stroke * 1.5}
            />
            <circle
              cx={d.x}
              cy={d.y}
              r={selected ? dotR * 3 : dotR * 2}
              fill={COLOR_DEVIATION}
            />
            <text
              x={Math.min(d.x, d.midline_x) - 4}
              y={d.y - 6}
              fontSize={fontSize * 0.85}
              fill={COLOR_DEVIATION}
              fontWeight={600}
              textAnchor="end"
              style={{ paintOrder: "stroke", stroke: COLOR_TEXT_BG, strokeWidth: 3 }}
            >
              {d.label}: {d.deviation_px.toFixed(1)}px
            </text>
          </g>
        );
      })}

      {show("asymmetry_scores") && (data.overall_asymmetry_score != null || data.overall_asymmetry_score_pct_ipd != null) && (
        <g>
          <rect
            x={10}
            y={10}
            width={fontSize * 18}
            height={fontSize * 3.6}
            rx={6}
            fill={COLOR_TEXT_BG}
          />
          <text x={18} y={10 + fontSize * 1.2} fontSize={fontSize * 1.05}
                fontWeight={700} fill={COLOR_TEXT}>
            Asymmetry Analysis
          </text>
          {data.overall_asymmetry_score_pct_ipd != null && (
            <text x={18} y={10 + fontSize * 2.4} fontSize={fontSize * 0.9} fill={COLOR_TEXT}>
              Score: {data.overall_asymmetry_score_pct_ipd.toFixed(2)}% IPD
            </text>
          )}
          {data.overall_asymmetry_score != null && (
            <text x={18} y={10 + fontSize * 3.4} fontSize={fontSize * 0.8} fill={COLOR_TEXT}>
              Raw: {data.overall_asymmetry_score.toFixed(2)} px
            </text>
          )}
        </g>
      )}
    </svg>
  );
}
