/**
 * RegionalScorer — pure domain service (PR-12 / M2 first slice).
 *
 * Aggregates per-metric MetricEvaluation results into a 0..100 region score.
 *
 * Algorithm:
 *   - For each contributing metric:
 *       quality_i = clip(1 - |deviation_normalized|, 0, 1)
 *       contribution_i = quality_i * weight_i * confidence_final_i
 *       confidence_contrib_i = weight_i * confidence_final_i
 *   - score_0_100 = (Σ contribution_i / Σ confidence_contrib_i) * 100
 *   - confidence_aggregate = Σ confidence_contrib_i / Σ weight_i
 *
 * Filtering rules (DEC-6 + DEC-7):
 *   - presentation_only metrics rejected by HARD assertion (defensive — they
 *     should never appear in region_metric_weight rows in the first place).
 *   - metrics with value === null skipped (calculation failed).
 *   - metrics with deviation_normalized === null skipped (no ideal range).
 *   - metrics with confidence_final < min_confidence_to_display skipped.
 *
 * Returns score_0_100 = null when no metric contributes.
 */

import { Injectable } from '@nestjs/common';

export interface RegionalScorerMetricInput {
  metricId: string;
  region: string;
  value: number | null;
  deviationNormalized: number | null;
  confidenceFinal: number | null;
  presentationOnly: boolean;
}

export interface RegionalScorerWeight {
  metricId: string;
  weight: number;
}

export interface RegionalScoreResult {
  region: string;
  score0to100: number | null;
  confidenceAggregate: number | null;
  contributingMetricIds: string[];
}

const MIN_CONFIDENCE_TO_DISPLAY_DEFAULT = 0.4;

@Injectable()
export class RegionalScorer {
  /**
   * Score one region. metrics must already be filtered to that region; weights
   * are looked up by metric_id (any extras are ignored, any missing default to
   * weight 1.0).
   */
  score(
    region: string,
    metrics: ReadonlyArray<RegionalScorerMetricInput>,
    weights: ReadonlyArray<RegionalScorerWeight>,
    minConfidenceToDisplay: number = MIN_CONFIDENCE_TO_DISPLAY_DEFAULT,
  ): RegionalScoreResult {
    const weightByMetric = new Map<string, number>();
    for (const w of weights) {
      weightByMetric.set(w.metricId, w.weight);
    }

    let sumWeightedQuality = 0;
    let sumWeightedConfidence = 0;
    let sumWeight = 0;
    const contributingMetricIds: string[] = [];

    for (const m of metrics) {
      // DEC-6: presentation_only must NEVER feed scoring.
      if (m.presentationOnly) {
        throw new Error(
          `RegionalScorer: presentation_only metric '${m.metricId}' must not appear in scoring inputs (DEC-6).`,
        );
      }
      if (m.value === null) continue;
      if (m.deviationNormalized === null) continue;
      if (m.confidenceFinal === null) continue;
      if (m.confidenceFinal < minConfidenceToDisplay) continue;

      const weight = weightByMetric.get(m.metricId) ?? 1.0;
      if (weight <= 0) continue;

      const quality = clip(1 - Math.abs(m.deviationNormalized), 0, 1);
      const wConf = weight * m.confidenceFinal;

      sumWeightedQuality += quality * wConf;
      sumWeightedConfidence += wConf;
      sumWeight += weight;
      contributingMetricIds.push(m.metricId);
    }

    if (contributingMetricIds.length === 0 || sumWeightedConfidence === 0) {
      return {
        region,
        score0to100: null,
        confidenceAggregate: null,
        contributingMetricIds: [],
      };
    }

    const score0to100 = (sumWeightedQuality / sumWeightedConfidence) * 100;
    const confidenceAggregate = sumWeightedConfidence / sumWeight;

    return {
      region,
      score0to100: round3(score0to100),
      confidenceAggregate: round6(confidenceAggregate),
      contributingMetricIds,
    };
  }
}

function clip(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function round6(v: number): number {
  return Math.round(v * 1_000_000) / 1_000_000;
}
