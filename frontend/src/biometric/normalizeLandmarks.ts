/**
 * normalizeLandmarks — projects raw MediaPipe pixel landmarks into the SVG
 * viewBox space used by the rig (default 100 × 130, matching the existing
 * studio preview).
 *
 * Strategy: anchor on 4 stable points (forehead 10, chin 152, cheek-L 234,
 * cheek-R 454) to compute the face bbox, then scale uniformly so the
 * vertical extent (chin - forehead) fills `fillRatio` of the viewBox height.
 * Centres on the bbox midpoint. Z is preserved untouched.
 *
 * Same normalization is used by:
 *   • runtime LandmarkRig (live + replay)
 *   • scripts/extract_canonical_mesh.py (canonical mean face seed)
 * so the canonical JSON aligns 1:1 with live frames.
 */

const FOREHEAD = 10;
const CHIN = 152;
const CHEEK_L = 234;
const CHEEK_R = 454;

export type NormalizedLandmarks = {
  points: number[][]; // [x, y, z][] in viewBox coordinates (z untouched).
  scale: number;
  cx: number;
  cy: number;
};

export function normalizeToViewBox(
  lm: number[][],
  viewW = 100,
  viewH = 130,
  fillRatio = 0.85,
): NormalizedLandmarks {
  if (!lm || lm.length === 0) {
    return { points: [], scale: 1, cx: viewW / 2, cy: viewH / 2 };
  }
  const forehead = lm[FOREHEAD] ?? lm[0];
  const chin = lm[CHIN] ?? lm[lm.length - 1];
  const cheekL = lm[CHEEK_L] ?? forehead;
  const cheekR = lm[CHEEK_R] ?? forehead;

  // Face bbox in source pixels.
  const minX = Math.min(cheekL[0], cheekR[0]);
  const maxX = Math.max(cheekL[0], cheekR[0]);
  const minY = Math.min(forehead[1], chin[1]);
  const maxY = Math.max(forehead[1], chin[1]);
  const srcCx = (minX + maxX) / 2;
  const srcCy = (minY + maxY) / 2;
  const srcH = Math.max(1e-6, maxY - minY);

  // Uniform scale so vertical face extent fills fillRatio * viewH.
  const scale = (viewH * fillRatio) / srcH;
  const cx = viewW / 2;
  const cy = viewH / 2;

  const points: number[][] = new Array(lm.length);
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i];
    points[i] = [
      cx + (p[0] - srcCx) * scale,
      cy + (p[1] - srcCy) * scale,
      p[2] ?? 0,
    ];
  }
  return { points, scale, cx, cy };
}
