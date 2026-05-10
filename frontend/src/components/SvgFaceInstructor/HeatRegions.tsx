import { motion } from 'framer-motion';
import type { HeatRegionConfig, HeatRegionId } from '../../types/animationConfig';

/**
 * PR-B — Anatomical heat-region anchor positions in the FaceBase viewBox (0..100).
 * Coordinates are approximate centroids of each muscle group. The blur filter
 * does the visual heavy lifting — exact pixel placement is not critical.
 */
const HEAT_REGION_GEOMETRY: Record<
  HeatRegionId,
  { cx: number; cy: number; rx: number; ry: number }
> = {
  // Forehead
  frontalis:           { cx: 50, cy: 22, rx: 22, ry: 8 },
  corrugator:          { cx: 50, cy: 32, rx: 8,  ry: 4 },
  temporalis:          { cx: 14, cy: 30, rx: 5,  ry: 8 },
  // Eyes
  orbicularis_oculi_l: { cx: 35, cy: 45, rx: 8,  ry: 5 },
  orbicularis_oculi_r: { cx: 65, cy: 45, rx: 8,  ry: 5 },
  // Mid-face / cheek
  zygomaticus_l:       { cx: 30, cy: 60, rx: 8,  ry: 6 },
  zygomaticus_r:       { cx: 70, cy: 60, rx: 8,  ry: 6 },
  buccinator_l:        { cx: 28, cy: 68, rx: 6,  ry: 6 },
  buccinator_r:        { cx: 72, cy: 68, rx: 6,  ry: 6 },
  // Jaw
  masseter_l:          { cx: 22, cy: 68, rx: 7,  ry: 9 },
  masseter_r:          { cx: 78, cy: 68, rx: 7,  ry: 9 },
  mentalis:            { cx: 50, cy: 88, rx: 6,  ry: 5 },
  // Mouth
  orbicularis_oris:    { cx: 50, cy: 78, rx: 11, ry: 6 },
  // Neck (only in rendered position when showNeck=true)
  platysma:            { cx: 50, cy: 100, rx: 18, ry: 6 },
  scm_l:               { cx: 35, cy: 102, rx: 4,  ry: 8 },
  scm_r:               { cx: 65, cy: 102, rx: 4,  ry: 8 },
  suboccipital:        { cx: 50, cy: 14, rx: 10, ry: 4 },
};

const PULSE_TRANSITION = {
  duration: 1.4,
  repeat: Infinity,
  repeatType: 'mirror' as const,
  ease: 'easeInOut' as const,
};

const STATIC_TRANSITION = {
  duration: 0.6,
  ease: 'easeOut' as const,
};

interface HeatRegionsProps {
  regions: HeatRegionConfig[];
  /** Tailwind-ish heat colour. Default red for "warm muscle" UX cue. */
  color?: string;
}

/**
 * Renders a translucent blurred ellipse over each requested anatomical region.
 * Pulses opacity 0 → 0.7 when `pulse=true`, otherwise holds at 0.45.
 *
 * Must be rendered AFTER FaceBase so it sits visually on top.
 */
export function HeatRegions({ regions, color = '#ef4444' }: HeatRegionsProps) {
  if (regions.length === 0) return null;

  return (
    <g aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <defs>
        <filter id="heat-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      {regions.map(({ region, pulse }) => {
        const geo = HEAT_REGION_GEOMETRY[region];
        if (!geo) return null;
        return (
          <motion.ellipse
            key={region}
            cx={geo.cx}
            cy={geo.cy}
            rx={geo.rx}
            ry={geo.ry}
            fill={color}
            filter="url(#heat-blur)"
            initial={{ opacity: 0 }}
            animate={{ opacity: pulse ? [0, 0.7, 0] : 0.45 }}
            transition={pulse ? PULSE_TRANSITION : STATIC_TRANSITION}
          />
        );
      })}
    </g>
  );
}
