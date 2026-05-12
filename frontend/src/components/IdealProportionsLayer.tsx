import React from "react";

type IdealRow = {
  metric_id?: string;
  value?: number | null;
  severity_5?: string | null;
  direction?: string | null;
};

interface IdealProportionsLayerProps {
  viewBoxWidth: number;
  viewBoxHeight: number;
  landmarks: Array<[number, number]>;
  rows: IdealRow[];
  selectedMetricId?: string | null;
  onSelectMetric?: (metricId: string) => void;
}

type ZoneDef = {
  metricId: string;
  label: string;
};

type ZoneRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const ZONES: ZoneDef[] = [
  { metricId: "forehead_height_ratio", label: "Testa" },
  { metricId: "upper_third_ratio", label: "Terco superior" },
  { metricId: "middle_third_ratio", label: "Terco medio" },
  { metricId: "lower_third_ratio", label: "Terco inferior" },
];

const SEVERITY_STROKE: Record<string, string> = {
  ideal: "#22c55e",
  mild: "#22c55e",
  moderate: "#eab308",
  strong: "#f97316",
  extreme: "#ef4444",
};

const P_SUBNASALE = 2;
const P_MENTON = 152;
const P_BROW_LEFT_INNER = 107;
const P_BROW_RIGHT_INNER = 336;
const P_ZYGO_LEFT = 234;
const P_ZYGO_RIGHT = 454;
const LM_FOREHEAD_RIDGE = [109, 67, 103, 54, 21, 162, 10, 338, 297, 332, 284, 251];

function metricToZone(vw: number, vh: number, zone: ZoneRect) {
  return {
    x: Math.max(0, Math.min(vw - 1, zone.x)),
    y: Math.max(0, Math.min(vh - 1, zone.y)),
    width: Math.max(1, Math.min(vw, zone.width)),
    height: Math.max(1, Math.min(vh, zone.height)),
  };
}

function lm(landmarks: Array<[number, number]>, idx: number): [number, number] {
  return landmarks[idx] ?? [0, 0];
}

function createAnatomicalZones(
  landmarks: Array<[number, number]>,
  vbW: number,
  vbH: number,
): Record<string, ZoneRect> {
  const [xZL] = lm(landmarks, P_ZYGO_LEFT);
  const [xZR] = lm(landmarks, P_ZYGO_RIGHT);
  const [, ySub] = lm(landmarks, P_SUBNASALE);
  const [, yMen] = lm(landmarks, P_MENTON);
  const [, yBL] = lm(landmarks, P_BROW_LEFT_INNER);
  const [, yBR] = lm(landmarks, P_BROW_RIGHT_INNER);

  const xFaceL = Math.max(0, Math.min(xZL, xZR));
  const xFaceR = Math.min(vbW, Math.max(xZL, xZR));
  const faceW = Math.max(1, xFaceR - xFaceL);

  const foreheadYs = LM_FOREHEAD_RIDGE
    .map((idx) => lm(landmarks, idx)[1])
    .filter((y) => Number.isFinite(y));
  const yTop = Math.max(0, Math.min(...foreheadYs, (yBL + yBR) / 2));
  const yBrow = Math.max(yTop + 1, Math.min(vbH - 2, (yBL + yBR) / 2));
  const yMid = Math.max(yBrow + 1, Math.min(vbH - 1, ySub));
  const yBot = Math.max(yMid + 1, Math.min(vbH, yMen));

  return {
    forehead_height_ratio: {
      x: xFaceL + faceW * 0.16,
      y: yTop,
      width: faceW * 0.68,
      height: Math.max(12, yBrow - yTop),
    },
    upper_third_ratio: {
      x: xFaceL + faceW * 0.08,
      y: yTop,
      width: faceW * 0.84,
      height: Math.max(12, yBrow - yTop),
    },
    middle_third_ratio: {
      x: xFaceL + faceW * 0.08,
      y: yBrow,
      width: faceW * 0.84,
      height: Math.max(12, yMid - yBrow),
    },
    lower_third_ratio: {
      x: xFaceL + faceW * 0.05,
      y: yMid,
      width: faceW * 0.90,
      height: Math.max(12, yBot - yMid),
    },
  };
}

export function IdealProportionsLayer({
  viewBoxWidth,
  viewBoxHeight,
  landmarks,
  rows,
  selectedMetricId,
  onSelectMetric,
}: IdealProportionsLayerProps) {
  if (!rows || rows.length === 0) return null;
  if (!landmarks || landmarks.length < 478) return null;

  const available = new Set(rows.map((r) => r.metric_id).filter(Boolean) as string[]);
  const zonesByMetric = createAnatomicalZones(landmarks, viewBoxWidth, viewBoxHeight);

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
      {ZONES.filter((z) => available.has(z.metricId)).map((zone) => {
        const row = rows.find((r) => r.metric_id === zone.metricId);
        const severity = row?.severity_5 ?? "ideal";
        const stroke = SEVERITY_STROKE[severity] ?? "#94a3b8";
        const selected = selectedMetricId === zone.metricId;
        const rect = metricToZone(viewBoxWidth, viewBoxHeight, zonesByMetric[zone.metricId]);
        return (
          <g key={zone.metricId}>
            <rect
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              rx={8}
              fill={selected ? `${stroke}2b` : "transparent"}
              stroke={stroke}
              strokeWidth={selected ? 2.5 : 1.2}
              strokeDasharray={selected ? undefined : "5 4"}
              style={{ cursor: "pointer", transition: "all 0.18s ease" }}
              onClick={() => onSelectMetric?.(zone.metricId)}
            />
            <text
              x={rect.x + rect.width / 2}
              y={rect.y - 8}
              textAnchor="middle"
              fontSize={12}
              fontWeight={700}
              fill={stroke}
              style={{ pointerEvents: "none" }}
            >
              {zone.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
