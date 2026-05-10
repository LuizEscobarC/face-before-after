import { motion } from 'framer-motion';
import type { ExerciseFrame } from '../../biometric/useBiometricExercise';

export function Heatmap({
  frames,
  viewBoxSize = 100,
}: {
  frames: ExerciseFrame[];
  viewBoxSize?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      <defs>
        <radialGradient id="heat-grad">
          <stop offset="0%" stopColor="rgba(239,68,68,0.9)" />
          <stop offset="60%" stopColor="rgba(245,158,11,0.4)" />
          <stop offset="100%" stopColor="rgba(245,158,11,0)" />
        </radialGradient>
      </defs>
      {frames.map((f, i) => {
        const cx = f.step.centroid.x * viewBoxSize;
        const cy = f.step.centroid.y * viewBoxSize;
        return (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            r={viewBoxSize * 0.12}
            fill="url(#heat-grad)"
            style={{
              opacity: f.heatOpacity,
              scale: f.heatScale,
              transformOrigin: `${cx}px ${cy}px`,
            }}
          />
        );
      })}
    </svg>
  );
}
