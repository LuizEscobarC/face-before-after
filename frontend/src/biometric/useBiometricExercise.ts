import { useEffect, useMemo, useRef } from 'react';
import { useMotionValue, useAnimationFrame, type MotionValue } from 'framer-motion';
import { BiometricEngine, type CompiledStep, type Pt } from './engine';
import type { BiometricExerciseConfig } from './types';

export type ExerciseFrame = {
  step: CompiledStep;
  pathD: MotionValue<string>;
  heatOpacity: MotionValue<number>;
  heatScale: MotionValue<number>;
};

const MAX_STEPS = 8;

function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

export function useBiometricExercise(
  config: BiometricExerciseConfig,
  landmarks: ReadonlyArray<Pt> | null,
  viewBoxSize = 100,
): { frames: ExerciseFrame[]; phase: MotionValue<number> } {
  const compiled = useMemo(
    () => BiometricEngine.compile(config, landmarks),
    [config, landmarks],
  );

  // Unrolled to satisfy rules-of-hooks: 8 fixed slots.
  const p0 = useMotionValue<string>('');
  const p1 = useMotionValue<string>('');
  const p2 = useMotionValue<string>('');
  const p3 = useMotionValue<string>('');
  const p4 = useMotionValue<string>('');
  const p5 = useMotionValue<string>('');
  const p6 = useMotionValue<string>('');
  const p7 = useMotionValue<string>('');

  const o0 = useMotionValue<number>(0);
  const o1 = useMotionValue<number>(0);
  const o2 = useMotionValue<number>(0);
  const o3 = useMotionValue<number>(0);
  const o4 = useMotionValue<number>(0);
  const o5 = useMotionValue<number>(0);
  const o6 = useMotionValue<number>(0);
  const o7 = useMotionValue<number>(0);

  const s0 = useMotionValue<number>(1);
  const s1 = useMotionValue<number>(1);
  const s2 = useMotionValue<number>(1);
  const s3 = useMotionValue<number>(1);
  const s4 = useMotionValue<number>(1);
  const s5 = useMotionValue<number>(1);
  const s6 = useMotionValue<number>(1);
  const s7 = useMotionValue<number>(1);

  const phase = useMotionValue<number>(0);

  const pathDs: MotionValue<string>[] = [p0, p1, p2, p3, p4, p5, p6, p7];
  const heatOps: MotionValue<number>[] = [o0, o1, o2, o3, o4, o5, o6, o7];
  const heatScales: MotionValue<number>[] = [s0, s1, s2, s3, s4, s5, s6, s7];

  useEffect(() => {
    compiled.forEach((cs, i) => {
      if (i >= MAX_STEPS) return;
      const pts = cs.sample(0);
      const hullPts = cs.hullIndices.length > 0
        ? cs.hullIndices.map((idx) => {
            const k = cs.zoneIndices.indexOf(idx);
            return k >= 0 ? pts[k] : cs.centroid;
          })
        : pts;
      pathDs[i].set(BiometricEngine.toSvgPath(hullPts, viewBoxSize));
    });
    if (compiled.length > MAX_STEPS) {
      // eslint-disable-next-line no-console
      console.warn(
        `[useBiometricExercise] ${compiled.length} steps > MAX_STEPS=${MAX_STEPS}; extras ignored`,
      );
    }
    // pathDs is stable (refs to motion values); intentional dep list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compiled, viewBoxSize]);

  const startedAtRef = useRef<number | null>(null);

  useAnimationFrame((time) => {
    if (startedAtRef.current === null) startedAtRef.current = time;
    const elapsed = time - startedAtRef.current;
    const cycleT = (elapsed % config.cycle_ms) / config.cycle_ms;
    phase.set(cycleT);

    compiled.forEach((cs, i) => {
      if (i >= MAX_STEPS) return;
      const step = cs.step;
      const delay = step.delay_ms ?? 0;
      const duration = step.duration_ms;
      const hold = step.hold_ms ?? 0;

      const stepStart = delay;
      const stepEnd = delay + duration + hold + duration;
      const localMs = elapsed % config.cycle_ms;

      let t = 0;
      if (localMs < stepStart) {
        t = 0;
      } else if (localMs < stepStart + duration) {
        t = easeInOut((localMs - stepStart) / duration);
      } else if (localMs < stepStart + duration + hold) {
        t = 1;
      } else if (localMs < stepEnd) {
        t = easeInOut(1 - (localMs - stepStart - duration - hold) / duration);
      } else {
        t = 0;
      }

      const pts = cs.sample(t);
      const hullPts = cs.hullIndices.length > 0
        ? cs.hullIndices.map((idx) => {
            const k = cs.zoneIndices.indexOf(idx);
            return k >= 0 ? pts[k] : cs.centroid;
          })
        : pts;
      pathDs[i].set(BiometricEngine.toSvgPath(hullPts, viewBoxSize));

      const intensity = step.heat_intensity ?? 1;
      const pulse = 0.5 + 0.5 * Math.sin(elapsed / 250);
      heatOps[i].set(intensity * (0.4 + 0.6 * t) * (0.7 + 0.3 * pulse));
      heatScales[i].set(1 + 0.15 * t);
    });
  });

  const frames: ExerciseFrame[] = compiled.slice(0, MAX_STEPS).map((cs, i) => ({
    step: cs,
    pathD: pathDs[i],
    heatOpacity: heatOps[i],
    heatScale: heatScales[i],
  }));

  return { frames, phase };
}
