import { motion } from 'framer-motion';
import type { ExerciseFrame } from '../../biometric/useBiometricExercise';

export function Wireframe({
  frames,
  viewBoxSize = 100,
}: {
  frames: ExerciseFrame[];
  viewBoxSize?: number;
}) {
  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <ellipse
        cx={viewBoxSize / 2}
        cy={viewBoxSize / 2}
        rx={viewBoxSize * 0.4}
        ry={viewBoxSize * 0.46}
        fill="none"
        stroke="var(--border)"
        strokeWidth={0.4}
      />
      {frames.map((f, i) => (
        <motion.path
          key={i}
          d={f.pathD}
          fill="rgba(99,102,241,0.08)"
          stroke="var(--accent)"
          strokeWidth={0.5}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
