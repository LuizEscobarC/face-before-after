import { ANATOMICAL_ZONES } from './anatomicalZones';

type Pt = { x: number; y: number };

/**
 * Pinned anatomical landmarks. Coordinates are normalized [0,1] using the
 * MediaPipe Face Mesh convention (origin top-left, y grows downward).
 *
 * These are intentionally approximate — this fallback avatar exists only so
 * admin previews and first-render states have *some* landmark set when a real
 * Face Mesh result is unavailable. Visual accuracy is validated in PR-C.
 */
const PINNED: Record<number, Pt> = {
  // Skull / outline anchors
  10: { x: 0.50, y: 0.10 },
  152: { x: 0.50, y: 0.92 },
  234: { x: 0.10, y: 0.50 },
  454: { x: 0.90, y: 0.50 },
  // Nose
  168: { x: 0.50, y: 0.40 },
  6: { x: 0.50, y: 0.38 },
  8: { x: 0.50, y: 0.32 },
  9: { x: 0.50, y: 0.30 },
  // Lips
  13: { x: 0.50, y: 0.72 },
  0: { x: 0.50, y: 0.69 },
  17: { x: 0.50, y: 0.78 },
  61: { x: 0.40, y: 0.74 },
  291: { x: 0.60, y: 0.74 },
  // Eye corners
  33: { x: 0.32, y: 0.42 },
  263: { x: 0.68, y: 0.42 },
  133: { x: 0.44, y: 0.42 },
  362: { x: 0.56, y: 0.42 },
  // Forehead band
  67: { x: 0.38, y: 0.15 },
  338: { x: 0.62, y: 0.15 },
  109: { x: 0.44, y: 0.12 },
  297: { x: 0.56, y: 0.12 },
  // Eye ring left
  7: { x: 0.30, y: 0.44 },
  163: { x: 0.32, y: 0.46 },
  144: { x: 0.36, y: 0.47 },
  145: { x: 0.40, y: 0.46 },
  153: { x: 0.42, y: 0.45 },
  154: { x: 0.42, y: 0.43 },
  155: { x: 0.40, y: 0.41 },
  // Eye ring right
  249: { x: 0.70, y: 0.44 },
  390: { x: 0.68, y: 0.46 },
  373: { x: 0.64, y: 0.47 },
  374: { x: 0.60, y: 0.46 },
  380: { x: 0.58, y: 0.45 },
  381: { x: 0.58, y: 0.43 },
  382: { x: 0.60, y: 0.41 },
  // Temporalis
  162: { x: 0.12, y: 0.32 },
  127: { x: 0.10, y: 0.40 },
  93: { x: 0.12, y: 0.55 },
  132: { x: 0.14, y: 0.50 },
  389: { x: 0.88, y: 0.32 },
  356: { x: 0.90, y: 0.40 },
  323: { x: 0.88, y: 0.55 },
  361: { x: 0.86, y: 0.50 },
  // Zygomaticus L
  205: { x: 0.30, y: 0.55 },
  206: { x: 0.28, y: 0.58 },
  207: { x: 0.26, y: 0.60 },
  187: { x: 0.24, y: 0.56 },
  // Zygomaticus R
  425: { x: 0.70, y: 0.55 },
  426: { x: 0.72, y: 0.58 },
  427: { x: 0.74, y: 0.60 },
  411: { x: 0.76, y: 0.56 },
  // Masseter L (lateral mandible)
  172: { x: 0.20, y: 0.72 },
  136: { x: 0.18, y: 0.74 },
  150: { x: 0.22, y: 0.78 },
  149: { x: 0.24, y: 0.80 },
  176: { x: 0.28, y: 0.82 },
  148: { x: 0.32, y: 0.84 },
  // Masseter R
  397: { x: 0.80, y: 0.72 },
  365: { x: 0.82, y: 0.74 },
  379: { x: 0.78, y: 0.78 },
  378: { x: 0.76, y: 0.80 },
  400: { x: 0.72, y: 0.82 },
  377: { x: 0.68, y: 0.84 },
  // Mouth ring extras
  84: { x: 0.46, y: 0.78 },
  314: { x: 0.54, y: 0.78 },
  405: { x: 0.56, y: 0.77 },
  321: { x: 0.58, y: 0.76 },
  375: { x: 0.59, y: 0.75 },
  270: { x: 0.55, y: 0.71 },
  269: { x: 0.53, y: 0.70 },
  267: { x: 0.51, y: 0.69 },
  37: { x: 0.49, y: 0.69 },
  39: { x: 0.47, y: 0.70 },
  40: { x: 0.45, y: 0.71 },
  185: { x: 0.41, y: 0.75 },
  // Chin
  199: { x: 0.50, y: 0.86 },
  175: { x: 0.50, y: 0.89 },
  // Buccinator
  138: { x: 0.26, y: 0.66 },
  215: { x: 0.22, y: 0.70 },
  192: { x: 0.24, y: 0.74 },
  367: { x: 0.74, y: 0.66 },
  435: { x: 0.78, y: 0.70 },
  416: { x: 0.76, y: 0.74 },
};

function deterministicNoise(i: number): { dx: number; dy: number } {
  // Tiny hash-based jitter so points don't collapse perfectly onto each other.
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 43758.5453;
  return { dx: (a - Math.floor(a) - 0.5) * 0.01, dy: (b - Math.floor(b) - 0.5) * 0.01 };
}

function generateNeutralFace(): Pt[] {
  const N = 478;
  const out: Pt[] = new Array(N);
  for (let i = 0; i < N; i++) {
    if (PINNED[i]) {
      out[i] = { x: PINNED[i].x, y: PINNED[i].y };
      continue;
    }
    // Default: distribute on a face oval. Angle progression around index 0..N-1.
    const angle = (i / N) * 2 * Math.PI;
    const cx = 0.5;
    const cy = 0.5;
    const rx = 0.30;
    const ry = 0.40;
    const noise = deterministicNoise(i);
    out[i] = {
      x: cx + rx * Math.cos(angle) + noise.dx,
      y: cy + ry * Math.sin(angle) + noise.dy,
    };
  }

  // For each anatomical zone, nudge any non-pinned indices toward the zone's
  // approximate cluster so heatmaps render in the right region.
  for (const zoneId of Object.keys(ANATOMICAL_ZONES) as Array<keyof typeof ANATOMICAL_ZONES>) {
    const def = ANATOMICAL_ZONES[zoneId];
    if (!def.indices.length) continue;
    // Compute pinned-only centroid for this zone.
    let sx = 0;
    let sy = 0;
    let count = 0;
    for (const idx of def.indices) {
      if (PINNED[idx]) {
        sx += PINNED[idx].x;
        sy += PINNED[idx].y;
        count++;
      }
    }
    if (!count) continue;
    const cx = sx / count;
    const cy = sy / count;
    for (const idx of def.indices) {
      if (PINNED[idx]) continue;
      const noise = deterministicNoise(idx);
      out[idx] = { x: cx + noise.dx * 2, y: cy + noise.dy * 2 };
    }
  }

  return out;
}

export const AVATAR_LANDMARKS: ReadonlyArray<Pt> = Object.freeze(generateNeutralFace());
