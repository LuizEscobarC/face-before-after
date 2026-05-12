/**
 * faceMeshTopology — official MediaPipe FaceLandmarker (478-point) connection
 * sets, exported as ordered index arrays so we can polyline them into SVG
 * paths. Indices come from the public spec
 * (https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/python/solutions/face_mesh_connections.py)
 * traced into ordered loops.
 */

/** Outer face silhouette (closed loop, ~36 points, traversed clockwise from
 *  forehead-right). */
export const FACE_OVAL: number[] = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109,
];

/** Outer lips contour (closed loop, ordered). */
export const LIPS_OUTER: number[] = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17,
  84, 181, 91, 146,
];

/** Inner lips contour (closed loop, ordered). */
export const LIPS_INNER: number[] = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14,
  87, 178, 88, 95,
];

/** Left eye ring (closed, 16 pts — viewer's left = subject's right anatomically). */
export const LEFT_EYE: number[] = [
  33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246,
];

/** Right eye ring (closed, 16 pts). */
export const RIGHT_EYE: number[] = [
  263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466,
];

/** Left eyebrow upper edge (open polyline). */
export const LEFT_EYEBROW: number[] = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];

/** Right eyebrow upper edge (open polyline). */
export const RIGHT_EYEBROW: number[] = [336, 296, 334, 293, 300, 285, 295, 282, 283, 276];

/** Nose bridge (open, top → tip). */
export const NOSE_BRIDGE: number[] = [168, 6, 197, 195, 5, 4, 1];

/** Nose bottom (open, alar arc left → right under tip). */
export const NOSE_BOTTOM: number[] = [240, 99, 97, 2, 326, 328, 460];

/** Iris rings (5 pts each: centre + 4 cardinal). */
export const LEFT_IRIS: number[] = [468, 469, 470, 471, 472];
export const RIGHT_IRIS: number[] = [473, 474, 475, 476, 477];

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Build an SVG `d` attribute from a list of points + ordered indices.
 * Out-of-range indices are skipped so partial detections don't crash.
 */
export function polylinePath(
  points: number[][],
  indices: number[],
  close = false,
): string {
  if (!points.length || !indices.length) return '';
  const cmds: string[] = [];
  let started = false;
  for (const i of indices) {
    const p = points[i];
    if (!p) continue;
    if (!started) {
      cmds.push(`M${p[0].toFixed(2)} ${p[1].toFixed(2)}`);
      started = true;
    } else {
      cmds.push(`L${p[0].toFixed(2)} ${p[1].toFixed(2)}`);
    }
  }
  if (close) cmds.push('Z');
  return cmds.join(' ');
}

/** Average position of a list of indices; falls back to (0,0) on empty. */
export function regionCenter(
  points: number[][],
  indices: number[],
): [number, number] {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const i of indices) {
    const p = points[i];
    if (!p) continue;
    sx += p[0];
    sy += p[1];
    n++;
  }
  if (n === 0) return [0, 0];
  return [sx / n, sy / n];
}

/** Approximate region radius (max distance from centre). */
export function regionRadius(
  points: number[][],
  indices: number[],
  center?: [number, number],
): number {
  const [cx, cy] = center ?? regionCenter(points, indices);
  let r = 0;
  for (const i of indices) {
    const p = points[i];
    if (!p) continue;
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > r) r = d;
  }
  return r;
}
