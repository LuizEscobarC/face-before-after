import React, { useMemo } from 'react';
import type { MetricEvaluationResult } from '../types';

interface RegionAdherence {
  region: string;
  adherence: number;
  confidence: number;
}

interface MetricsMapLayerProps {
  viewBoxWidth: number;
  viewBoxHeight: number;
  metric_evaluations: MetricEvaluationResult[];
  region_adherence: RegionAdherence[] | Record<string, number>;
  onRegionClick?: (region: string) => void;
  selectedRegion?: string | null;
}

interface RegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Renders an interactive SVG heatmap of facial regions colored by metric adherence.
 * 
 * Regions (Naini 2011):
 *   - FOREHEAD: upper third
 *   - EYES: middle upper third
 *   - NOSE: central zone
 *   - MOUTH: lower middle zone
 *   - JAW: chin and jawline
 * 
 * Color mapping (adherence):
 *   - >= 0.9 (excellent): green (#10b981)
 *   - 0.7–0.9 (good): amber (#f59e0b)
 *   - < 0.7 (needs work): red (#ef4444)
 */
export const MetricsMapLayer: React.FC<MetricsMapLayerProps> = ({
  viewBoxWidth,
  viewBoxHeight,
  metric_evaluations,
  region_adherence,
  onRegionClick,
  selectedRegion,
}) => {
  // Define approximate region bounds in canonical image space
  // (adjust based on your canonical image dimensions: typically 1200×800)
  const REGION_BOUNDS: Record<string, RegionBounds> = {
    FOREHEAD: { x: 250, y: 80, width: 700, height: 150 },
    EYES: { x: 300, y: 210, width: 600, height: 120 },
    NOSE: { x: 450, y: 310, width: 300, height: 140 },
    MOUTH: { x: 380, y: 450, width: 440, height: 110 },
    JAW: { x: 220, y: 530, width: 760, height: 180 },
  };

  // Normalize region_adherence to object format
  const adherenceMap = useMemo(() => {
    if (Array.isArray(region_adherence)) {
      return Object.fromEntries(region_adherence.map(r => [r.region, r.adherence]));
    }
    return region_adherence;
  }, [region_adherence]);

  // Count metrics per region
  const metricsByRegion = useMemo(() => {
    const count: Record<string, number> = {};
    for (const metric of metric_evaluations) {
      if (metric.region) {
        count[metric.region] = (count[metric.region] || 0) + 1;
      }
    }
    return count;
  }, [metric_evaluations]);

  // Map adherence to color
  const adherenceToColor = (adherence: number | undefined): string => {
    if (adherence === undefined) return '#94a3b8';  // Gray (neutral/unknown)
    if (adherence >= 0.9) return '#10b981';  // Green (excellent)
    if (adherence >= 0.7) return '#f59e0b';  // Amber (good)
    return '#ef4444';  // Red (needs work)
  };

  // Map adherence to opacity intensity
  const adherenceToOpacity = (adherence: number | undefined): number => {
    if (adherence === undefined) return 0.1;
    return Math.max(0.15, Math.min(0.5, adherence * 0.6));
  };

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
      width="100%"
      height="100%"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'auto',
        zIndex: 25,
      }}
    >
      {/* Region heatmap rectangles */}
      {Object.entries(REGION_BOUNDS).map(([region, bounds]) => {
        const adherence = adherenceMap[region];
        const color = adherenceToColor(adherence);
        const opacity = adherenceToOpacity(adherence);
        const isSelected = selectedRegion === region;
        const metricCount = metricsByRegion[region] ?? 0;

        return (
          <g key={`region-${region}`}>
            {/* Background rectangle (clickable) */}
            <rect
              x={bounds.x}
              y={bounds.y}
              width={bounds.width}
              height={bounds.height}
              fill={color}
              opacity={isSelected ? opacity * 1.5 : opacity}
              stroke={color}
              strokeWidth={isSelected ? 3 : 1.5}
              rx={6}
              style={{
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onClick={() => onRegionClick?.(region)}
              onMouseEnter={(e) => {
                (e.currentTarget as SVGRectElement).style.opacity = String(
                  isSelected ? opacity * 1.8 : opacity * 1.3
                );
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as SVGRectElement).style.opacity = String(
                  isSelected ? opacity * 1.5 : opacity
                );
              }}
            />

            {/* Region label + metric count */}
            <text
              x={bounds.x + bounds.width / 2}
              y={bounds.y + bounds.height / 2 - 8}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isSelected ? 16 : 14}
              fontWeight={isSelected ? 'bold' : '600'}
              fill={color}
              opacity={0.9}
              pointerEvents="none"
              style={{
                transition: 'all 0.2s ease',
              }}
            >
              {region}
            </text>

            {/* Metric count sub-label */}
            <text
              x={bounds.x + bounds.width / 2}
              y={bounds.y + bounds.height / 2 + 12}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={isSelected ? 12 : 11}
              fill={color}
              opacity={0.7}
              pointerEvents="none"
              style={{
                transition: 'all 0.2s ease',
              }}
            >
              {metricCount} métricas
            </text>

            {/* Adherence percentage (for selected region) */}
            {isSelected && adherence !== undefined && (
              <text
                x={bounds.x + bounds.width / 2}
                y={bounds.y + bounds.height / 2 + 26}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fill={color}
                opacity={0.8}
                pointerEvents="none"
              >
                {Math.round(adherence * 100)}% conformidade
              </text>
            )}
          </g>
        );
      })}

      {/* Legend (top-right corner) */}
      <g style={{ pointerEvents: 'none' }}>
        <rect
          x={viewBoxWidth - 180}
          y={10}
          width={170}
          height={90}
          fill="rgba(13, 13, 22, 0.9)"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth={1}
          rx={4}
        />

        <text
          x={viewBoxWidth - 175}
          y={28}
          fontSize={12}
          fontWeight="bold"
          fill="#e2e8f0"
        >
          Conformidade
        </text>

        {/* Green legend */}
        <circle cx={viewBoxWidth - 170} cy={45} r={4} fill="#10b981" />
        <text x={viewBoxWidth - 160} y={49} fontSize={10} fill="#e2e8f0">
          ≥ 90%
        </text>

        {/* Amber legend */}
        <circle cx={viewBoxWidth - 170} cy={62} r={4} fill="#f59e0b" />
        <text x={viewBoxWidth - 160} y={66} fontSize={10} fill="#e2e8f0">
          70–89%
        </text>

        {/* Red legend */}
        <circle cx={viewBoxWidth - 170} cy={79} r={4} fill="#ef4444" />
        <text x={viewBoxWidth - 160} y={83} fontSize={10} fill="#e2e8f0">
          &lt; 70%
        </text>
      </g>
    </svg>
  );
};

export default MetricsMapLayer;
