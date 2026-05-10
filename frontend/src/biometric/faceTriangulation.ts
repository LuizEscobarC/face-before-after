import Delaunator from 'delaunator';
import { AVATAR_LANDMARKS } from './avatarLandmarks';

/**
 * Canonical face mesh triangulation derived from the 478 AVATAR_LANDMARKS via
 * Delaunay (delaunator). We filter out:
 *  - iris vertices (>= 468), they cluster too tightly and produce slivers
 *  - triangles whose longest edge exceeds MAX_EDGE in normalized coords —
 *    these are the spurious long edges Delaunay creates around the convex hull.
 *
 * The result is a clean front-facing mesh that deforms in lockstep with the
 * landmark array, ready for use as a single SVG <path> per frame.
 */

const MAX_EDGE = 0.08; // normalized [0..1] — drops convex-hull spans

function edgeLen(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildTriangles(): ReadonlyArray<readonly [number, number, number]> {
  const pts = AVATAR_LANDMARKS.map((p) => ({ x: p.x, y: p.y }));
  const d = Delaunator.from(pts, (p) => p.x, (p) => p.y);
  const out: [number, number, number][] = [];
  for (let i = 0; i < d.triangles.length; i += 3) {
    const a = d.triangles[i];
    const b = d.triangles[i + 1];
    const c = d.triangles[i + 2];
    // Drop iris ring (468..477)
    if (a >= 468 || b >= 468 || c >= 468) continue;
    const pa = pts[a];
    const pb = pts[b];
    const pc = pts[c];
    const longest = Math.max(edgeLen(pa, pb), edgeLen(pb, pc), edgeLen(pa, pc));
    if (longest > MAX_EDGE) continue;
    out.push([a, b, c]);
  }
  return out;
}

export const FACE_TRIANGLES: ReadonlyArray<readonly [number, number, number]> =
  buildTriangles();
