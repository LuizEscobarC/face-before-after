import type { MovementVerb, Vec2 } from './types';

export type Pt = { x: number; y: number };

type Kernel = (
  pts: ReadonlyArray<Pt>,
  centroid: Pt,
  vector: Vec2,
  amplitude: number,
  t: number,
) => Pt[];

export const stretch: Kernel = (pts, _c, v, amp, t) =>
  pts.map((p) => ({ x: p.x + v.x * amp * t, y: p.y + v.y * amp * t }));

export const compress: Kernel = (pts, c, _v, amp, t) =>
  pts.map((p) => ({
    x: p.x + (c.x - p.x) * amp * t,
    y: p.y + (c.y - p.y) * amp * t,
  }));

export const massage_circular: Kernel = (pts, _c, _v, amp, t) => {
  const theta = t * 2 * Math.PI;
  const dx = Math.cos(theta) * amp;
  const dy = Math.sin(theta) * amp;
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
};

export const isometric_hold: Kernel = (pts, c, _v, amp, t) => {
  const pulse = Math.sin(t * 4 * Math.PI) * amp * 0.5;
  return pts.map((p) => ({
    x: p.x + (c.x - p.x) * pulse,
    y: p.y + (c.y - p.y) * pulse,
  }));
};

export const rotate_around_pivot = (
  pts: ReadonlyArray<Pt>,
  pivot: Pt,
  angleRad: number,
  t: number,
): Pt[] => {
  const theta = angleRad * t;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return pts.map((p) => {
    const dx = p.x - pivot.x;
    const dy = p.y - pivot.y;
    return {
      x: pivot.x + dx * cos - dy * sin,
      y: pivot.y + dx * sin + dy * cos,
    };
  });
};

export const VERBS = {
  stretch,
  compress,
  massage_circular,
  isometric_hold,
  rotate_around_pivot,
};

export function applyVerb(
  verb: MovementVerb,
  pts: ReadonlyArray<Pt>,
  ctx: { centroid: Pt; pivot: Pt; vector: Vec2; amplitude: number; angleRad: number },
  t: number,
): Pt[] {
  switch (verb) {
    case 'stretch':
      return stretch(pts, ctx.centroid, ctx.vector, ctx.amplitude, t);
    case 'compress':
      return compress(pts, ctx.centroid, ctx.vector, ctx.amplitude, t);
    case 'massage_circular':
      return massage_circular(pts, ctx.centroid, ctx.vector, ctx.amplitude, t);
    case 'isometric_hold':
      return isometric_hold(pts, ctx.centroid, ctx.vector, ctx.amplitude, t);
    case 'rotate_around_pivot':
      return rotate_around_pivot(pts, ctx.pivot, ctx.angleRad, t);
    default: {
      const _exhaustive: never = verb;
      return [..._exhaustive as never as Pt[]];
    }
  }
}
