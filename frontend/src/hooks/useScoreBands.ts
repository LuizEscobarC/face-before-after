import { useEffect, useState } from "react";
import { fetchScoreBands } from "../api";
import type { ScoreBandConfig, ScoreBandName } from "../types";

/**
 * Module-level cache so multiple components in the same session share one
 * network round-trip. Score bands are part of the active threshold config
 * and only change when an admin activates a new version.
 */
let cached: ScoreBandConfig | null = null;
let inflight: Promise<ScoreBandConfig> | null = null;

function loadOnce(): Promise<ScoreBandConfig> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetchScoreBands()
    .then((cfg) => {
      cached = cfg;
      inflight = null;
      return cfg;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

/**
 * React hook returning the active score band configuration.
 *
 * While loading (or on error) it returns ``null``. Callers MUST tolerate the
 * null state — there is no hardcoded fallback. This is intentional: the whole
 * point is to remove fixed thresholds from the frontend.
 */
export function useScoreBands(): ScoreBandConfig | null {
  const [cfg, setCfg] = useState<ScoreBandConfig | null>(cached);

  useEffect(() => {
    if (cached) return;
    let alive = true;
    loadOnce()
      .then((c) => {
        if (alive) setCfg(c);
      })
      .catch(() => {
        // Keep null on failure; UI uses neutral styling.
      });
    return () => {
      alive = false;
    };
  }, []);

  return cfg;
}

/**
 * Bucket a numeric global score into one of the four DEC-9 bands using the
 * thresholds carried by ``cfg``. Returns ``null`` when ``cfg`` is not yet
 * loaded (callers should render neutral chrome in that case).
 */
export function scoreBandOf(
  score: number,
  cfg: ScoreBandConfig | null,
): ScoreBandName | null {
  if (!cfg) return null;
  if (score >= cfg.good_max) return "high";
  if (score >= cfg.refine_max) return "good";
  if (score >= cfg.no_number_max) return "refine";
  return "no_number";
}

/**
 * Canonical CSS colour for each band. Keeps colour decisions central so a
 * future theme tweak does not need to touch every result page.
 *
 * Tokens align with the MVP design system (.claude/claude.md):
 *   high      → cyan       (#22d3ee)
 *   good      → cyan-soft  (#67e8f9)
 *   refine    → violet     (#a78bfa)
 *   no_number → indigo     (#6366f1)  — also used while config is loading
 */
const BAND_COLORS: Record<ScoreBandName, string> = {
  high: "#22d3ee",
  good: "#67e8f9",
  refine: "#a78bfa",
  no_number: "#6366f1",
};

const NEUTRAL_COLOR = "#6366f1";

export function colorForScore(
  score: number,
  cfg: ScoreBandConfig | null,
): string {
  const band = scoreBandOf(score, cfg);
  return band ? BAND_COLORS[band] : NEUTRAL_COLOR;
}
