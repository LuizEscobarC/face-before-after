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

  /**
   * Compute the FULL deformed 478-point landmark cloud at time t. Each step's
   * verb is applied to its zone subset of the working buffer. For
   * `rotate_around_pivot` we additionally rotate every landmark below the
   * pivot's y coordinate so the mandible behaves as a rigid bone — mouth and
   * jawline rotate together with the masseter/mentalis zones.
   */
  static sampleFullMesh(
    config: BiometricExerciseConfig,
    landmarks: ReadonlyArray<Pt> | null,
    t: number,
  ): Pt[] {
    const lm = landmarks ?? AVATAR_LANDMARKS;
    const out: Pt[] = lm.map((p) => ({ x: p.x, y: p.y }));
    for (const step of config.steps) {
      const zone = ANATOMICAL_ZONES[step.zone];
      const centroid = getCentroid(step.zone, out);
      const pivot = step.pivot ? resolvePivot(step.pivot, out) : centroid;
      const vector = step.vector ?? { x: 0, y: -1 };
      const amplitude = step.amplitude ?? 0.15;
      const angleRad = ((step.angle_deg ?? 15) * Math.PI) / 180;

      let targetIndices: ReadonlyArray<number> = zone.indices;
      if (step.verb === 'rotate_around_pivot') {
        // Lower-face mandible block: every landmark below the pivot.
        const lower: number[] = [];
        for (let i = 0; i < out.length; i++) {
          if (out[i].y > pivot.y) lower.push(i);
        }
        // Union with explicit zone indices, deduped.
        const seen = new Set<number>(lower);
        for (const idx of zone.indices) seen.add(idx);
        targetIndices = Array.from(seen);
      }

      const subset = targetIndices.map((i) => out[i]);
      const moved = applyVerb(
        step.verb,
        subset,
        { centroid, pivot, vector, amplitude, angleRad },
        t,
      );
      targetIndices.forEach((i, k) => {
        out[i] = moved[k];
      });
    }
    return out;
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
