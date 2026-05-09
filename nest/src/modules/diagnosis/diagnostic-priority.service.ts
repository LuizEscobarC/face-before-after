/**
 * PR-58 — DiagnosticPriorityService (M4.3)
 *
 * Applies the full priority formula to all ``recommendation_link`` rows for a
 * given analysis report, overwrites ``final_priority_in_session``, and marks
 * the top-5 as ``is_displayed_to_user=TRUE``.
 *
 * Formula (PLAN_M4_NARRATIVE §2.4, PR-58):
 *
 *   score = (I × S × C × A) × (1 − R) × (1 − E×0.5)
 *
 * Components:
 *   I  = impact     — normalized priority_default (1→0.2, 2→0.4, 3→0.6, 4→0.8, 5→1.0)
 *   S  = severity   — weight from severity5 of the worst triggering metric_evaluation_against_ideal
 *                     ideal=0.00, minimal=0.10, mild=0.30, moderate=0.50, strong=0.80, extreme=1.00
 *   C  = confidence — confidence_final from the triggering metric_evaluation (worst-S evaluation)
 *   A  = actionability (inverse effort): low=1.0, medium=0.6, high=0.3
 *   R  = risk_level  — recommendation_catalog.risk_level (0.0–1.0)
 *   E  = effort      — encoded: low=0.0, medium=0.5, high=1.0
 *
 * Diversity constraint (PLAN_M4_NARRATIVE §6 "Armadilhas" item 7):
 *   Maximum 2 recommendations per category.
 *
 * Persistence:
 *   - Sets ``final_priority_in_session`` (1 = highest priority) for all links.
 *   - Sets ``is_displayed_to_user=TRUE`` for the top-5, ``FALSE`` for the rest.
 *
 * Idempotency:
 *   Safe to call multiple times on the same report. Re-scores and overwrites.
 *
 * Called by:
 *   - ``NarrativeService`` (PR-59) after ``RecommendationEngine`` (PR-57) runs.
 *
 * References:
 *   - PLAN_M4_NARRATIVE.md §2.4 (PR-58)
 *   - PLAN_DDL_REVIEW.md §5.7 (recommendation_link schema)
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { RecommendationLinkEntity } from './infrastructure/entities/recommendation-link.entity.js';
import { RecommendationCatalogEntity } from './infrastructure/entities/recommendation-catalog.entity.js';
import { MetricEvaluationEntity } from '../analysis/infrastructure/entities/metric-evaluation.entity.js';
import { MetricEvaluationAgainstIdealEntity } from '../analysis/infrastructure/entities/metric-evaluation-against-ideal.entity.js';
import type { RecommendationMatch } from './recommendation-engine.service.js';
import type { EffortEstimate } from './domain/types/recommendation.types.js';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/** I: Normalized impact from priority_default (1–5). */
const IMPACT_MAP: Record<number, number> = {
  1: 0.2,
  2: 0.4,
  3: 0.6,
  4: 0.8,
  5: 1.0,
};

/** S: Severity weight (same as RecommendationEngine baseline). */
const SEVERITY_WEIGHTS: Record<string, number> = {
  ideal:    0.00,
  minimal:  0.10,
  mild:     0.30,
  moderate: 0.50,
  strong:   0.80,
  extreme:  1.00,
};

/** A: Actionability from effort_estimate (inverse of effort). */
const ACTIONABILITY: Record<EffortEstimate, number> = {
  low:    1.0,
  medium: 0.6,
  high:   0.3,
};

/** E: Effort encoding for the (1 − E×0.5) penalty term. */
const EFFORT_ENCODED: Record<EffortEstimate, number> = {
  low:    0.0,
  medium: 0.5,
  high:   1.0,
};

/** DEC-33: Top-N recommendations shown to the user. */
const TOP_N = 5;

/** PLAN_M4_NARRATIVE §6 item 7: Max recs per category for diversity. */
const MAX_PER_CATEGORY = 2;

// ──────────────────────────────────────────────────────────────────────────────
// DiagnosticPriorityService
// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class DiagnosticPriorityService {
  private readonly logger = new Logger(DiagnosticPriorityService.name);

  constructor(
    @InjectRepository(RecommendationLinkEntity)
    private readonly linkRepo: Repository<RecommendationLinkEntity>,

    @InjectRepository(RecommendationCatalogEntity)
    private readonly catalogRepo: Repository<RecommendationCatalogEntity>,

    @InjectRepository(MetricEvaluationEntity)
    private readonly evalRepo: Repository<MetricEvaluationEntity>,

    @InjectRepository(MetricEvaluationAgainstIdealEntity)
    private readonly evalAgainstIdealRepo: Repository<MetricEvaluationAgainstIdealEntity>,
  ) {}

  /**
   * Main entry point.
   *
   * Loads all ``recommendation_link`` rows for the given report, computes the
   * full priority formula, applies diversity constraints, persists
   * ``final_priority_in_session`` + ``is_displayed_to_user``, and returns
   * the full ranked list as ``RecommendationMatch[]``.
   *
   * @param analysisReportId       UUID of the analysis_report.
   * @param analysisReportGeneratedAt  Partition key (matches report row).
   * @returns Ranked list (all links for the report, sorted by priority asc).
   */
  async prioritize(
    analysisReportId: string,
    analysisReportGeneratedAt: Date,
  ): Promise<RecommendationMatch[]> {
    // ── 1. Load recommendation_link rows for this report ──────────────────────
    const links = await this.linkRepo.find({
      where: { analysisReportId, analysisReportGeneratedAt },
    });

    if (links.length === 0) {
      this.logger.warn(
        `DiagnosticPriorityService: no recommendation_link rows for report=${analysisReportId}. ` +
        'RecommendationEngine (PR-57) must run first.',
      );
      return [];
    }

    // ── 2. Collect all triggering metric_evaluation_against_ideal UUIDs ───────
    const allAgainstIdealIds = Array.from(
      new Set(links.flatMap((l) => l.triggeredByMetricEvaluationIds)),
    );

    if (allAgainstIdealIds.length === 0) {
      this.logger.warn(
        `DiagnosticPriorityService: all links have empty triggeredByMetricEvaluationIds for ` +
        `report=${analysisReportId}. Cannot compute priority scores.`,
      );
      return [];
    }

    // ── 3. Load metric_evaluation_against_ideal rows (for severity5) ──────────
    const againstIdeals = await this.evalAgainstIdealRepo.find({
      where: { id: In(allAgainstIdealIds) },
    });

    const againstIdealMap = new Map(againstIdeals.map((ai) => [ai.id, ai]));

    // ── 4. Collect metric_evaluation UUIDs (for confidence_final) ─────────────
    const allEvalIds = Array.from(
      new Set(againstIdeals.map((ai) => ai.metricEvaluationId)),
    );

    const evaluations = allEvalIds.length > 0
      ? await this.evalRepo.find({ where: { id: In(allEvalIds) } })
      : [];

    // Map: metric_evaluation_against_ideal.id → metric_evaluation (for confidence_final)
    const evalByAgainstIdealId = new Map<string, MetricEvaluationEntity>();
    for (const ai of againstIdeals) {
      const eval_ = evaluations.find((e) => e.id === ai.metricEvaluationId);
      if (eval_) evalByAgainstIdealId.set(ai.id, eval_);
    }

    // ── 5. Load catalog rows for all recommendations ──────────────────────────
    const recIds = Array.from(new Set(links.map((l) => l.recommendationId)));
    const catalogs = await this.catalogRepo.find({ where: { id: In(recIds) } });
    const catalogMap = new Map(catalogs.map((c) => [c.id, c]));

    // ── 6. Compute score for each link ────────────────────────────────────────
    interface ScoredLink {
      link: RecommendationLinkEntity;
      catalog: RecommendationCatalogEntity;
      score: number;
    }

    const scored: ScoredLink[] = [];

    for (const link of links) {
      const catalog = catalogMap.get(link.recommendationId);
      if (!catalog) {
        this.logger.warn(
          `DiagnosticPriorityService: catalog not found for recommendation_id=${link.recommendationId}. Skipping.`,
        );
        continue;
      }

      // Find worst severity among triggering against-ideal rows
      let worstSeverityWeight = 0;
      let confidenceForWorst = 0;

      for (const aiId of link.triggeredByMetricEvaluationIds) {
        const ai = againstIdealMap.get(aiId);
        if (!ai) continue;

        const sevWeight = SEVERITY_WEIGHTS[ai.severity5 ?? 'ideal'] ?? 0;
        if (sevWeight > worstSeverityWeight) {
          worstSeverityWeight = sevWeight;
          const eval_ = evalByAgainstIdealId.get(aiId);
          confidenceForWorst = eval_?.confidenceFinal ?? 0;
        }
      }

      const effort = catalog.effortEstimate as EffortEstimate;

      const I = IMPACT_MAP[catalog.priorityDefault] ?? 0.2;
      const S = worstSeverityWeight;
      const C = confidenceForWorst;
      const A = ACTIONABILITY[effort] ?? 0.6;
      const R = catalog.riskLevel;
      const E = EFFORT_ENCODED[effort] ?? 0.5;

      const score = (I * S * C * A) * (1 - R) * (1 - E * 0.5);

      scored.push({ link, catalog, score });
    }

    // ── 7. Sort by score descending ───────────────────────────────────────────
    scored.sort((a, b) => b.score - a.score);

    // ── 8. Apply diversity constraint (max MAX_PER_CATEGORY per category) ─────
    const categoryCount = new Map<string, number>();
    const diverse: ScoredLink[] = [];
    const excluded: ScoredLink[] = [];

    for (const item of scored) {
      const cat = item.catalog.category as string;
      const count = categoryCount.get(cat) ?? 0;
      if (count < MAX_PER_CATEGORY) {
        categoryCount.set(cat, count + 1);
        diverse.push(item);
      } else {
        excluded.push(item);
      }
    }

    // Combine: diverse first (ordered by score), then excluded after (ordered by score)
    const ranked = [...diverse, ...excluded];

    // ── 9. Assign final_priority_in_session + is_displayed_to_user ────────────
    const updates: RecommendationLinkEntity[] = ranked.map((item, idx) => {
      item.link.finalPriorityInSession = idx + 1;
      item.link.isDisplayedToUser = idx < TOP_N;
      return item.link;
    });

    await this.linkRepo.save(updates);

    this.logger.debug(
      `DiagnosticPriorityService: prioritized ${updates.length} recommendations for ` +
      `report=${analysisReportId}. Top-${TOP_N} marked is_displayed_to_user=TRUE.`,
    );

    // ── 10. Return as RecommendationMatch[] ───────────────────────────────────
    return ranked.map((item) => ({
      recommendationId: item.link.recommendationId,
      score: item.score,
      rank: item.link.finalPriorityInSession!,
      triggeredByMetricEvaluationIds: item.link.triggeredByMetricEvaluationIds,
      requiresProfessional: item.catalog.requiresProfessional,
      professionalType: item.catalog.professionalType,
      category: item.catalog.category,
      displayTextShortPt: item.catalog.displayTextShortPt,
    }));
  }
}
