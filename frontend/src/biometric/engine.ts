import {
  ANATOMICAL_ZONES,
  getCentroid,
  resolvePivot,
} from './anatomicalZones';
import { applyVerb } from './movementVerbs';
import { AVATAR_LANDMARKS } from './avatarLandmarks';
import type { BiometricExerciseConfig, BiometricStep } from './types';

export type Pt = { x: number; y: number };

export type CompiledStep = {
  step: BiometricStep;
  centroid: Pt;
  pivot: Pt;
  zoneIndices: ReadonlyArray<number>;
  hullIndices: ReadonlyArray<number>;
  basePoints: Pt[];
  sample: (t: number) => Pt[];
};

export class BiometricEngine {
  static compile(
    config: BiometricExerciseConfig,
    landmarks: ReadonlyArray<Pt> | null,
  ): CompiledStep[] {
    const lm = landmarks ?? AVATAR_LANDMARKS;
    return config.steps.map((step) => {
      const zone = ANATOMICAL_ZONES[step.zone];
      const basePoints: Pt[] = zone.indices.length
        ? zone.indices.map((i) => ({ x: lm[i].x, y: lm[i].y }))
        : [getCentroid(step.zone, lm)];
      const centroid = getCentroid(step.zone, lm);
      const pivot = step.pivot ? resolvePivot(step.pivot, lm) : centroid;
      const vector = step.vector ?? { x: 0, y: -1 };
      const amplitude = step.amplitude ?? 0.15;
      const angleRad = ((step.angle_deg ?? 15) * Math.PI) / 180;
      return {
        step,
        centroid,
        pivot,
        zoneIndices: zone.indices,
        hullIndices: zone.hull,
        basePoints,
        sample: (t: number) =>
          applyVerb(step.verb, basePoints, { centroid, pivot, vector, amplitude, angleRad }, t),
      };
    });
  }

  /** Convert sampled points to an SVG path `d` string. Closes the polygon. */
  static toSvgPath(points: ReadonlyArray<Pt>, viewBoxSize: number = 100): string {
    if (points.length === 0) return '';
    if (points.length < 3) {
      const p = points[0];
      const r = 0.01 * viewBoxSize;
      const cx = p.x * viewBoxSize;
      const cy = p.y * viewBoxSize;
      return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
    }
    const cmds = points.map((p, i) => {
      const x = (p.x * viewBoxSize).toFixed(3);
      const y = (p.y * viewBoxSize).toFixed(3);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    });
    return cmds.join(' ') + ' Z';
  }
}
