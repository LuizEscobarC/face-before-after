/**
 * One-Euro filter (Casiez et al. 2012) — adaptive low-pass filter for noisy
 * signals where a simple low-pass would over-smooth fast motion.
 *
 *   cutoff(t) = mincutoff + beta * |dx/dt|
 *
 * Used to stabilize the 478 MediaPipe landmarks at ~24fps without lagging
 * actual head motion. Each component (x/y/z) of each landmark gets its own
 * 1D filter instance; we wrap them in a flat array for cache locality.
 *
 * Defaults tuned for face landmarks in viewBox space (~100 units wide):
 *   mincutoff = 1.0  Hz  → still cuts buzz when head is still
 *   beta      = 0.05      → loosens cutoff when motion is fast
 *   dcutoff   = 1.0  Hz  → smooths the velocity estimate itself
 */

type LowPassState = {
  hatX: number | null;
  hatDx: number | null;
};

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export type OneEuroParams = {
  mincutoff?: number;
  beta?: number;
  dcutoff?: number;
};

export class OneEuroFilterArray {
  private states: LowPassState[];
  private lastT = 0;
  private mincutoff: number;
  private beta: number;
  private dcutoff: number;

  constructor(
    private readonly count: number,
    private readonly dim: number = 3,
    params: OneEuroParams = {},
  ) {
    this.mincutoff = params.mincutoff ?? 1.0;
    this.beta = params.beta ?? 0.05;
    this.dcutoff = params.dcutoff ?? 1.0;
    this.states = new Array(count * dim);
    for (let i = 0; i < count * dim; i++) {
      this.states[i] = { hatX: null, hatDx: null };
    }
  }

  /**
   * Filter a fresh batch of points. `tNow` in seconds; if omitted, uses
   * performance.now()/1000.
   */
  filter(points: number[][], tNow?: number): number[][] {
    const t = tNow ?? performance.now() / 1000;
    const dt = this.lastT > 0 ? Math.max(1e-3, t - this.lastT) : 1 / 60;
    this.lastT = t;

    const out: number[][] = new Array(points.length);
    const aD = alpha(this.dcutoff, dt);

    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const o = new Array(this.dim) as number[];
      for (let d = 0; d < this.dim; d++) {
        const idx = i * this.dim + d;
        const s = this.states[idx];
        const x = p[d] ?? 0;

        // Velocity (smoothed).
        const dx = s.hatX === null ? 0 : (x - s.hatX) / dt;
        const hatDx =
          s.hatDx === null ? dx : aD * dx + (1 - aD) * s.hatDx;

        // Adaptive cutoff.
        const cutoff = this.mincutoff + this.beta * Math.abs(hatDx);
        const a = alpha(cutoff, dt);
        const hatX = s.hatX === null ? x : a * x + (1 - a) * s.hatX;

        s.hatX = hatX;
        s.hatDx = hatDx;
        o[d] = hatX;
      }
      out[i] = o;
    }
    return out;
  }

  reset() {
    for (const s of this.states) {
      s.hatX = null;
      s.hatDx = null;
    }
    this.lastT = 0;
  }
}
