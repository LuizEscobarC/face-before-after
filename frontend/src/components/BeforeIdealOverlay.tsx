import React from 'react';
import type { MetricEvaluationResult } from '../types';

interface BeforeIdealOverlayProps {
  landmarks: Array<[number, number]>;
  imageWidth: number;
  imageHeight: number;
  viewBoxWidth?: number;
  viewBoxHeight?: number;
  metricEvaluations?: MetricEvaluationResult[];
}

// Landmark index constants (MediaPipe Mesh-478)
const P_LEFT_EYE_INNER  = 133;
const P_RIGHT_EYE_INNER = 362;

// Arrow color by severity5
const SEVERITY_ARROW_COLORS: Record<string, string> = {
  mild:     "#22c55e",
  moderate: "#eab308",
  strong:   "#f97316",
  extreme:  "#ef4444",
};

function lm(landmarks: Array<[number, number]>, idx: number): [number, number] {
  return landmarks[idx] ?? [0, 0];
}

/**
 * BeforeIdealOverlay — renders improvement vectors as SVG arrows over the
 * before-ideal composite image.
 * 
 * The background image already contains guide lines (midline, wireframe actual),
 * so we just render the improvement vectors on top.
 */
export const BeforeIdealOverlay: React.FC<BeforeIdealOverlayProps> = ({
  landmarks,
  imageWidth,
  imageHeight,
  viewBoxWidth,
  viewBoxHeight,
  metricEvaluations,
}) => {
  if (!landmarks || landmarks.length < 478) return null;
  if (!metricEvaluations || metricEvaluations.length === 0) return null;

  const w = imageWidth;
  const h = imageHeight;
  const vbW = viewBoxWidth ?? imageWidth;
  const vbH = viewBoxHeight ?? imageHeight;

  // Intercanthal distance in pixels (inner canthus to inner canthus).
  // Used to scale ICU vectors to pixel space.
  const [lix, liy] = lm(landmarks, P_LEFT_EYE_INNER);
  const [rix, riy] = lm(landmarks, P_RIGHT_EYE_INNER);
  const icdPx = Math.hypot(rix - lix, riy - liy);

  const arrows: JSX.Element[] = [];

  if (icdPx > 1) {
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
  }

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
      {arrows}
    </svg>
  );
};
