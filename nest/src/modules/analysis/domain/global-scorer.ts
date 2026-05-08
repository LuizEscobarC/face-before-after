/**
 * GlobalScorer — pure domain service (PR-12 / M2 first slice).
 *
 * Aggregates per-region RegionalScoreResult into a single 0..100 global score.
 *
 * Algorithm:
 *   - Each region contributes (score * weight) only if its score is non-null
 *     AND its confidence_aggregate >= min_confidence (DEC-7 default 0.5 for
 *     min_confidence_to_show_global_score).
 *   - global_score = Σ(score_i * weight_i) / Σ(weight_i used)
 *
 * Gating (DEC-8):
 *   - For every region listed in critical_regions, its confidence_aggregate
 *     MUST be >= criticalConfidenceFloor (default 0.5). If any critical
 *     region is missing from the input or below the floor, global score is
 *     null and is_displayable=false.
 */

import { Injectable } from '@nestjs/common';
import type { RegionalScoreResult } from './regional-scorer.js';
import type { RegionalBreakdownEntry, ScoreBand } from '../infrastructure/entities/global-score.entity.js';
import { ScoreBander } from './score-bander.js';

export interface GlobalScorerWeight {
  region: string;
  weight: number;
}

export interface GlobalScoreResult {
  score0to100: number | null;
  isDisplayable: boolean;
  band: ScoreBand | null;
  regionalBreakdown: RegionalBreakdownEntry[];
}

const CRITICAL_CONFIDENCE_FLOOR_DEFAULT = 0.5;

@Injectable()
export class GlobalScorer {
  constructor(private readonly bander: ScoreBander) {}

  score(
    regionalScores: ReadonlyArray<RegionalScoreResult>,
    weights: ReadonlyArray<GlobalScorerWeight>,
    criticalRegions: ReadonlyArray<string>,
    criticalConfidenceFloor: number = CRITICAL_CONFIDENCE_FLOOR_DEFAULT,
  ): GlobalScoreResult {
    const weightByRegion = new Map<string, number>();
    for (const w of weights) weightByRegion.set(w.region, w.weight);
    const regionalByName = new Map<string, RegionalScoreResult>();
    for (const r of regionalScores) regionalByName.set(r.region, r);

    // ── DEC-8 gating ──────────────────────────────────────────────────
    let gatingFailed = false;
    for (const critical of criticalRegions) {
      const r = regionalByName.get(critical);
      if (
        !r ||
        r.confidenceAggregate === null ||
        r.confidenceAggregate < criticalConfidenceFloor
      ) {
        gatingFailed = true;
        break;
      }
    }

    // ── breakdown ─────────────────────────────────────────────────────
    const regionsUsed = new Set<string>([
      ...weightByRegion.keys(),
      ...regionalByName.keys(),
    ]);
    const breakdown: RegionalBreakdownEntry[] = [];
    let weightedSum = 0;
    let weightSum = 0;

    for (const region of regionsUsed) {
      const weight = weightByRegion.get(region) ?? 0;
      const r = regionalByName.get(region);
      const contributed = !gatingFailed
        && weight > 0
        && r !== undefined
        && r.score0to100 !== null;

      if (contributed) {
        weightedSum += r!.score0to100! * weight;
        weightSum += weight;
      }

      breakdown.push({
        region,
        score_0_100: r?.score0to100 ?? null,
        weight,
        confidence_aggregate: r?.confidenceAggregate ?? null,
        contributed,
      });
    }

    if (gatingFailed || weightSum === 0) {
      return {
        score0to100: null,
        isDisplayable: false,
        band: null,
        regionalBreakdown: breakdown,
      };
    }

    const score = weightedSum / weightSum;
    const rounded = Math.round(score * 1000) / 1000;
    const band = this.bander.band(rounded);

    return {
      score0to100: rounded,
      isDisplayable: true,
      band,
      regionalBreakdown: breakdown,
    };
  }
}
