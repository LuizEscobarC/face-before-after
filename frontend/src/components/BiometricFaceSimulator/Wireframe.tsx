import { useRef } from 'react';
import { motion, useMotionValue, useAnimationFrame } from 'framer-motion';
import { FACE_TRIANGLES } from '../../biometric/faceTriangulation';
import { BiometricEngine, type Pt } from '../../biometric/engine';
import type { BiometricExerciseConfig } from '../../biometric/types';

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function Wireframe({
  config,
  landmarks = null,
  viewBoxSize = 100,
  fillStyle = 'wireframe',
}: {
  config: BiometricExerciseConfig;
  landmarks?: ReadonlyArray<Pt> | null;
  viewBoxSize?: number;
  fillStyle?: 'wireframe' | 'shaded';
}) {
  const trisPathD = useMotionValue<string>('');
  const startedAt = useRef<number | null>(null);

  useAnimationFrame((time) => {
    if (startedAt.current === null) startedAt.current = time;
    const elapsed = time - startedAt.current;
    const cycleT = (elapsed % config.cycle_ms) / config.cycle_ms;
    // Triangle wave 0→1→0, eased.
    const tri = cycleT < 0.5 ? cycleT * 2 : (1 - cycleT) * 2;
    const t = easeInOut(tri);

    const pts = BiometricEngine.sampleFullMesh(config, landmarks, t);
    const cmds: string[] = [];
    for (const tri3 of FACE_TRIANGLES) {
      const pa = pts[tri3[0]];
      const pb = pts[tri3[1]];
      const pc = pts[tri3[2]];
      if (!pa || !pb || !pc) continue;
      cmds.push(
        `M${(pa.x * viewBoxSize).toFixed(2)} ${(pa.y * viewBoxSize).toFixed(2)}`,
        `L${(pb.x * viewBoxSize).toFixed(2)} ${(pb.y * viewBoxSize).toFixed(2)}`,
        `L${(pc.x * viewBoxSize).toFixed(2)} ${(pc.y * viewBoxSize).toFixed(2)}Z`,
      );
    }
    trisPathD.set(cmds.join(' '));
  });

  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <motion.path
        d={trisPathD}
        fill={fillStyle === 'shaded' ? 'rgba(99,102,241,0.04)' : 'none'}
        stroke="var(--accent)"
        strokeWidth={0.15}
        strokeLinejoin="round"
      />
    </svg>
  );
}
