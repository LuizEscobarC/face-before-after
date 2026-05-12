/**
 * PR-58 — DiagnosticPriorityService (M4.4)
 *
 * Applies the full priority formula to all `recommendation_link` rows for a
 * given analysis report, persists a `priority_score_audit` row per link
 * (RNF-D01 — auditabilidade total), enforces DEC-38 invasiveness-ladder
 * rules and risk/actionability guardrails, then writes
 * `final_priority_in_session` + `is_displayed_to_user` on the displayed
 * top-5.
 *
 * Formula (PLAN_M4_NARRATIVE §2.4):
 *
 *   raw       = (I × S × C × A) × (1 − R) × (1 − E × 0.5)
 *   penalized = raw × (1 − quality_penalty),
 *               where quality_penalty = (1 − photo_quality_score) × 0.3
 *   final     = guardrails_zero_when(R>0.7, A=0 outside professional_referral,
 *                                    DEC-38 R3, DEC-38 R5) else penalized
 *
 * Components (see §1.1 of M4_PR58 plan):
 *   I = priority_default ∈ {1..5}    →  {1:0.2, 2:0.4, 3:0.6, 4:0.8, 5:1.0}
 *   S = severity_5 weight             →  ideal:0, minimal:0.10, mild:0.30,
 *                                        moderate:0.50, strong:0.80, extreme:1.00
 *   C = confidence_final              →  passthrough (NULL → 0)
 *   A = actionability (inverse effort) → low:1.0, medium:0.6, high:0.3
 *   R = risk_level                    →  passthrough; R>0.7 = bloqueio
 *   E = effort encoded                →  low:0.0, medium:0.5, high:1.0
 *
 * DEC-38 ladder rules (PLAN_M4_NARRATIVE §3 + M4_PR58 §1.3):
 *   R1. Tie-break (Δscore ≤ 0.05) prefers lower invasiveness_level.
 *   R2. Max 2 distinct categories in top-5.        (DEC-41: applied AFTER R4)
 *   R3. Level-4b (professional_referral) NEVER isolated; requires ≥2 vagas
 *       with invasiveness_level ≤ 3, else suppressed to position 6+.
 *   R4. Max 2 recommendations of the same category in top-5.
 *   R5. Level-4b only fires when severity = extreme OR
 *       catalog.clinical_pathway_required = TRUE (suppressed at entry).
 *
 * Idempotency: `priority_score_audit` has UNIQUE(recommendation_link_id);
 * service re-runs UPSERT.
 *
 * References:
 *   - .claude/plans/marcos/M4_PR58_DiagnosticPriorityService.md (full plan)
 *   - PLAN_M4_NARRATIVE.md §2.4, §3 DEC-34/35/37/38, §6 armadilhas
 *   - PLAN_DDL_REVIEW.md §5.7
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { RecommendationLinkEntity } from './infrastructure/entities/recommendation-link.entity.js';
import { RecommendationCatalogEntity } from './infrastructure/entities/recommendation-catalog.entity.js';
import {
  PriorityScoreAuditEntity,
  type PrioritySuppressionReason,
} from './infrastructure/entities/priority-score-audit.entity.js';
import { MetricEvaluationEntity } from '../analysis/infrastructure/entities/metric-evaluation.entity.js';
import { MetricEvaluationAgainstIdealEntity } from '../analysis/infrastructure/entities/metric-evaluation-against-ideal.entity.js';
import type { RecommendationMatch } from './recommendation-engine.service.js';
import type { EffortEstimate } from './domain/types/recommendation.types.js';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/** I: Normalized impact from priority_default (1–5). */
export const IMPACT_MAP: Record<number, number> = {
  1: 0.2, 2: 0.4, 3: 0.6, 4: 0.8, 5: 1.0,
};

/** S: Severity weight (same baseline as RecommendationEngine). */
export const SEVERITY_WEIGHTS: Record<string, number> = {
  ideal:    0.00,
  minimal:  0.10,
  mild:     0.30,
  moderate: 0.50,
  strong:   0.80,
  extreme:  1.00,
};

/** A: Actionability from effort_estimate (inverse of effort). */
export const ACTIONABILITY: Record<EffortEstimate, number> = {
  low: 1.0, medium: 0.6, high: 0.3,
};

/** E: Effort encoding for the (1 − E×0.5) penalty term. */
export const EFFORT_ENCODED: Record<EffortEstimate, number> = {
  low: 0.0, medium: 0.5, high: 1.0,
};

/** DEC-33: Top-N recommendations shown to the user. */
export const TOP_N = 5;

/** DEC-38 R4: Max recs per single category in top-N. */
export const MAX_PER_CATEGORY = 2;

/** DEC-38 R2: Max distinct categories in top-N. */
export const MAX_DISTINCT_CATEGORIES = 2;

/** DEC-46: Tie-break window for invasiveness preference. */
export const TIE_BREAK_DELTA = 0.05;

/** DEC-42: Max % of raw_score that quality penalty can subtract. */
export const QUALITY_PENALTY_CAP = 0.3;

/** Risk threshold for high_risk_self_application guardrail. */
export const RISK_BLOCK_THRESHOLD = 0.7;

/** Service version stamped on every audit row. */
const SERVICE_VERSION = 'pr-58.v1';

/** DEC-38 R3 anti-loop cap. */
const DEC38_MAX_REBALANCE_ITERATIONS = 2;

// ──────────────────────────────────────────────────────────────────────────────
// Internal types
// ──────────────────────────────────────────────────────────────────────────────

interface ScoredLink {
  link: RecommendationLinkEntity;
  catalog: RecommendationCatalogEntity;
  // formula components
  I: number;
  S: number;
  C: number;
  A: number;
  E: number;
  R: number;
  rawScore: number;
  penalizedScore: number;
  finalScore: number;
  // source FKs
  severitySourceAgainstIdealId: string | null;
  confidenceSourceEvaluationId: string | null;
  worstSeverity: string;
  // entry-time guardrail (R5, R, A)
  suppressionReason: PrioritySuppressionReason | null;
}

interface RankedItem {
  scored: ScoredLink;
  finalScore: number;
  dec38Rank: number | null;
  suppressionReason: PrioritySuppressionReason | null;
}

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

    @InjectRepository(PriorityScoreAuditEntity)
    private readonly auditRepo: Repository<PriorityScoreAuditEntity>,
  ) {}

  /**
   * Main entry point.
   *
   * @param analysisReportId        UUID of the analysis_report.
   * @param analysisReportGeneratedAt  Partition key (matches report row).
   * @param photoQualityScore       Score in [0,1] from analysis_report.quality_score
   *                                (1.0 if NULL — neutral).
   * @returns The displayed top-N (sorted by final rank asc) as
   *          `RecommendationMatch[]`. Suppressed links are persisted in
   *          audit but excluded from the return.
   */
  async prioritize(
    analysisReportId: string,
    analysisReportGeneratedAt: Date,
    photoQualityScore: number = 1.0,
  ): Promise<RecommendationMatch[]> {
    // ── 1. Load recommendation_link rows ──────────────────────────────────────
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

    // ── 2. Load triggering MEAI rows ──────────────────────────────────────────
    const allAgainstIdealIds = Array.from(
      new Set(links.flatMap((l) => l.triggeredByMetricEvaluationIds)),
    );
    const againstIdeals = allAgainstIdealIds.length > 0
      ? await this.evalAgainstIdealRepo.find({ where: { id: In(allAgainstIdealIds) } })
      : [];
    const againstIdealMap = new Map(againstIdeals.map((ai) => [ai.id, ai]));

    // ── 3. Load metric_evaluation for confidence_final ────────────────────────
    const allEvalIds = Array.from(new Set(againstIdeals.map((ai) => ai.metricEvaluationId)));
    const evaluations = allEvalIds.length > 0
      ? await this.evalRepo.find({ where: { id: In(allEvalIds) } })
      : [];
    const evalById = new Map(evaluations.map((e) => [e.id, e]));

    // ── 4. Load catalog rows ──────────────────────────────────────────────────
    const recIds = Array.from(new Set(links.map((l) => l.recommendationId)));
    const catalogs = recIds.length > 0
      ? await this.catalogRepo.find({ where: { id: In(recIds) } })
      : [];
    const catalogMap = new Map(catalogs.map((c) => [c.id, c]));

    // Defensive clamp on quality (NaN/null → 1.0)
    const safeQuality =
      Number.isFinite(photoQualityScore)
        ? Math.max(0, Math.min(1, photoQualityScore))
        : 1.0;
    const qualityPenalty = (1 - safeQuality) * QUALITY_PENALTY_CAP;

    // ── 5. Score each link ────────────────────────────────────────────────────
    const scored: ScoredLink[] = [];

    for (const link of links) {
      const catalog = catalogMap.get(link.recommendationId);
      if (!catalog) {
        this.logger.warn(
          `DiagnosticPriorityService: catalog not found for recommendation_id=${link.recommendationId}. Skipping.`,
        );
        continue;
      }

      // Find worst severity + its confidence
      let worstSeverityWeight = 0;
      let worstSeverityName: string = 'ideal';
      let confidenceForWorst = 0;
      let severitySourceId: string | null = null;
      let confidenceSourceId: string | null = null;

      for (const aiId of link.triggeredByMetricEvaluationIds) {
        const ai = againstIdealMap.get(aiId);
        if (!ai) continue;
        const sevName = ai.severity5 ?? 'ideal';
        const sevWeight = SEVERITY_WEIGHTS[sevName] ?? 0;
        if (sevWeight > worstSeverityWeight) {
          worstSeverityWeight = sevWeight;
          worstSeverityName = sevName;
          severitySourceId = ai.id;
          const eval_ = evalById.get(ai.metricEvaluationId);
          confidenceForWorst = eval_?.confidenceFinal ?? 0;
          confidenceSourceId = eval_?.id ?? null;
        }
      }

      const effort = catalog.effortEstimate as EffortEstimate;
      const I = IMPACT_MAP[catalog.priorityDefault] ?? 0.2;
      const S = worstSeverityWeight;
      const C = confidenceForWorst;
      const A = ACTIONABILITY[effort] ?? 0.6;
      const R = catalog.riskLevel;
      const E = EFFORT_ENCODED[effort] ?? 0.5;

      const rawScore = I * S * C * A * (1 - R) * (1 - E * 0.5);
      const penalizedScore = Math.max(0, rawScore * (1 - qualityPenalty));

      // ── Entry-time guardrails ─────────────────────────────────────────────
      let suppressionReason: PrioritySuppressionReason | null = null;
      let finalScore = penalizedScore;

      // R5 — level-4b without clinical pathway and without extreme severity
      if (
        catalog.invasivenessLevel === 4 &&
        catalog.category === 'professional_referral' &&
        worstSeverityName !== 'extreme' &&
        !catalog.clinicalPathwayRequired
      ) {
        finalScore = 0;
        suppressionReason = 'clinical_pathway_not_required';
      }

      // R guardrail — high risk for self-application
      if (suppressionReason === null && R > RISK_BLOCK_THRESHOLD) {
        finalScore = 0;
        suppressionReason = 'high_risk_self_application';
      }

      // A guardrail — A=0 outside professional_referral
      if (suppressionReason === null && A === 0 && catalog.category !== 'professional_referral') {
        finalScore = 0;
        suppressionReason = 'no_actionability';
      }

      scored.push({
        link, catalog,
        I, S, C, A, E, R,
        rawScore, penalizedScore, finalScore,
        severitySourceAgainstIdealId: severitySourceId,
        confidenceSourceEvaluationId: confidenceSourceId,
        worstSeverity: worstSeverityName,
        suppressionReason,
      });
    }

    // ── 6. Apply DEC-38 ladder rules ──────────────────────────────────────────
    const ranked = this.rankWithDec38Ladder(scored);

    // ── 7. Persist atomically ─────────────────────────────────────────────────
    await this.linkRepo.manager.transaction(async (txn) => {
      const updates: RecommendationLinkEntity[] = [];
      for (const item of ranked) {
        const isDisplayed =
          item.finalScore > 0 &&
          item.suppressionReason === null &&
          item.dec38Rank !== null &&
          item.dec38Rank <= TOP_N;

        item.scored.link.finalPriorityInSession = item.dec38Rank ?? null;
        item.scored.link.isDisplayedToUser = isDisplayed;
        updates.push(item.scored.link);
      }
      if (updates.length > 0) {
        await txn.save(RecommendationLinkEntity, updates);
      }

      const auditRows = ranked.map((item) => {
        const row = new PriorityScoreAuditEntity();
        row.recommendationLinkId = item.scored.link.id;
        row.analysisReportId = analysisReportId;
        row.analysisReportGeneratedAt = analysisReportGeneratedAt;
        row.I = item.scored.I;
        row.S = item.scored.S;
        row.C = item.scored.C;
        row.A = item.scored.A;
        row.E = item.scored.E;
        row.R = item.scored.R;
        row.rawScore = item.scored.rawScore;
        row.penalizedScore = item.scored.penalizedScore;
        row.finalScore = item.finalScore;
        row.photoQualityScoreApplied = qualityPenalty;
        row.severitySourceAgainstIdealId = item.scored.severitySourceAgainstIdealId;
        row.confidenceSourceEvaluationId = item.scored.confidenceSourceEvaluationId;
        row.riskSourceRecommendationId = item.scored.catalog.id;
        row.invasivenessLevelApplied = item.scored.catalog.invasivenessLevel;
        row.suppressionReason = item.suppressionReason ?? item.scored.suppressionReason;
        row.dec38RankPosition = item.dec38Rank;
        row.serviceVersion = SERVICE_VERSION;
        return row;
      });

      if (auditRows.length > 0) {
        await txn
          .createQueryBuilder()
          .insert()
          .into(PriorityScoreAuditEntity)
          .values(auditRows)
          .orUpdate(
            [
              'I', 'S', 'C', 'A', 'E', 'R',
              'raw_score', 'penalized_score', 'final_score',
              'photo_quality_score_applied',
              'severity_source_against_ideal_id',
              'confidence_source_evaluation_id',
              'risk_source_recommendation_id',
              'invasiveness_level_applied',
              'suppression_reason',
              'dec38_rank_position',
              'service_version',
            ],
            ['recommendation_link_id'],
          )
          .execute();
      }
    });

    const displayedCount = ranked.filter(
      (r) =>
        r.dec38Rank !== null &&
        r.dec38Rank <= TOP_N &&
        r.finalScore > 0 &&
        r.suppressionReason === null,
    ).length;

    this.logger.debug(
      `DiagnosticPriorityService: prioritized ${ranked.length} links for report=${analysisReportId}, ` +
      `displayed=${displayedCount}`,
    );

    // ── 8. Return only displayed top-N ────────────────────────────────────────
    return ranked
      .filter((r) =>
        r.dec38Rank !== null &&
        r.dec38Rank <= TOP_N &&
        r.finalScore > 0 &&
        r.suppressionReason === null &&
        r.scored.suppressionReason === null,
      )
      .sort((a, b) => (a.dec38Rank! - b.dec38Rank!))
      .map((item) => ({
        recommendationId: item.scored.link.recommendationId,
        score: item.finalScore,
        rank: item.dec38Rank!,
        triggeredByMetricEvaluationIds: item.scored.link.triggeredByMetricEvaluationIds,
        requiresProfessional: item.scored.catalog.requiresProfessional,
        professionalType: item.scored.catalog.professionalType,
        category: item.scored.catalog.category,
        displayTextShortPt: item.scored.catalog.displayTextShortPt,
      }));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Pure ranking algorithm — exposed for unit tests
  // ──────────────────────────────────────────────────────────────────────────

  rankWithDec38Ladder(scored: ScoredLink[]): RankedItem[] {
    const eligible = scored.filter((s) => s.finalScore > 0 && s.suppressionReason === null);
    const preSuppressed = scored.filter((s) => !(s.finalScore > 0 && s.suppressionReason === null));

    // Sort: score desc, tie-break (Δ ≤ TIE_BREAK_DELTA) → invasiveness asc
    const sortedEligible = [...eligible].sort((a, b) => {
      const dScore = b.finalScore - a.finalScore;
      if (Math.abs(dScore) > TIE_BREAK_DELTA) return dScore > 0 ? 1 : -1;
      return (a.catalog.invasivenessLevel ?? 0) - (b.catalog.invasivenessLevel ?? 0);
    });

    const filled = this.greedyFillWithDec38(sortedEligible);

    // Map by link.id → rank info
    const byLinkId = new Map<string, { rank: number; finalScore: number; suppression: PrioritySuppressionReason | null }>();
    for (const r of filled) {
      byLinkId.set(r.scored.link.id, {
        rank: r.rank,
        finalScore: r.finalScore,
        suppression: r.suppression,
      });
    }

    const out: RankedItem[] = [];
    for (const s of eligible) {
      const r = byLinkId.get(s.link.id);
      if (r) {
        out.push({
          scored: s,
          finalScore: r.finalScore,
          dec38Rank: r.rank,
          suppressionReason: r.suppression,
        });
      } else {
        out.push({ scored: s, finalScore: s.finalScore, dec38Rank: null, suppressionReason: null });
      }
    }
    for (const s of preSuppressed) {
      out.push({
        scored: s,
        finalScore: s.finalScore,
        dec38Rank: null,
        suppressionReason: s.suppressionReason,
      });
    }
    return out;
  }

  /**
   * Greedy top-N fill respecting R4 → R2 → R3 (DEC-41 order).
   * Items not selected for top-N still receive a rank (TOP_N+1, …) so that
   * `final_priority_in_session` is meaningful even for non-displayed rows.
   */
  private greedyFillWithDec38(
    sortedEligible: ScoredLink[],
  ): Array<{
    scored: ScoredLink;
    rank: number;
    finalScore: number;
    suppression: PrioritySuppressionReason | null;
  }> {
    type Selected = {
      scored: ScoredLink;
      rank: number;
      finalScore: number;
      suppression: PrioritySuppressionReason | null;
    };

    const blockedLinkIds = new Set<string>();
    let selected: Selected[] = [];

    for (let iter = 0; iter < DEC38_MAX_REBALANCE_ITERATIONS; iter++) {
      const categoryCount = new Map<string, number>();
      const distinctCategories = new Set<string>();
      const top: ScoredLink[] = [];
      const r4Excluded: ScoredLink[] = [];
      const r2Excluded: ScoredLink[] = [];
      const overflow: ScoredLink[] = [];

      for (const item of sortedEligible) {
        if (blockedLinkIds.has(item.link.id)) {
          overflow.push(item);
          continue;
        }
        if (top.length >= TOP_N) {
          overflow.push(item);
          continue;
        }
        const cat = item.catalog.category;

        // R4 first (DEC-41)
        const count = categoryCount.get(cat) ?? 0;
        if (count >= MAX_PER_CATEGORY) {
          r4Excluded.push(item);
          continue;
        }

        // R2: max 2 distinct categories
        const wouldAddNewCategory = !distinctCategories.has(cat);
        if (wouldAddNewCategory && distinctCategories.size >= MAX_DISTINCT_CATEGORIES) {
          r2Excluded.push(item);
          continue;
        }

        top.push(item);
        categoryCount.set(cat, count + 1);
        distinctCategories.add(cat);
      }

      // R3 — level-4b never isolated
      const level4bInTop = top.filter(
        (s) => s.catalog.invasivenessLevel === 4 && s.catalog.category === 'professional_referral',
      );
      const levelLE3Count = top.filter((s) => (s.catalog.invasivenessLevel ?? 0) <= 3).length;

      if (level4bInTop.length > 0 && levelLE3Count < 2) {
        for (const s of level4bInTop) blockedLinkIds.add(s.link.id);
        continue;
      }

      // Accept iteration → assign ranks
      selected = [];
      let rank = 1;
      for (const item of top) {
        selected.push({ scored: item, rank: rank++, finalScore: item.finalScore, suppression: null });
      }
      for (const item of r4Excluded) {
        selected.push({
          scored: item,
          rank: rank++,
          finalScore: 0,
          suppression: 'dec38_max_category_exceeded',
        });
      }
      for (const item of r2Excluded) {
        selected.push({
          scored: item,
          rank: rank++,
          finalScore: 0,
          suppression: 'dec38_max_category_exceeded',
        });
      }
      for (const item of overflow) {
        const isBlocked4b = blockedLinkIds.has(item.link.id);
        selected.push({
          scored: item,
          rank: rank++,
          finalScore: isBlocked4b ? 0 : item.finalScore,
          suppression: isBlocked4b ? 'dec38_ladder_isolated_4b' : null,
        });
      }
      return selected;
    }

    this.logger.warn(
      `DiagnosticPriorityService: DEC-38 R3 hit ${DEC38_MAX_REBALANCE_ITERATIONS} iterations; top-${TOP_N} may be incomplete.`,
    );
    if (selected.length === 0) {
      let rank = 1;
      for (const item of sortedEligible) {
        const is4b =
          item.catalog.invasivenessLevel === 4 &&
          item.catalog.category === 'professional_referral';
        selected.push({
          scored: item,
          rank: rank++,
          finalScore: is4b ? 0 : item.finalScore,
          suppression: is4b ? 'dec38_ladder_isolated_4b' : null,
        });
      }
    }
    return selected;
  }
}
