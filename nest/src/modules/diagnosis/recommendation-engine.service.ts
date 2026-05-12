/**
 * PR-57 — RecommendationEngine (M4.3)
 *
 * Given an ``analysis_report_id``, loads all metric evaluations against
 * ideal, matches them against active recommendation triggers, scores by
 * (severity_weight × confidence_final × priority_default), applies the
 * top-5 cut (DEC-33), and persists ``recommendation_link`` rows.
 *
 * Called by:
 *   - ``NarrativeService`` (PR-59) after analysis is complete.
 *   - Any manual re-scoring pass triggered by the API.
 *
 * Dependency chain:
 *   - PR-55 (DDL): ``recommendation_trigger``, ``recommendation_catalog``,
 *     ``recommendation_link`` tables.
 *   - PR-56 (Opus): populates trigger rows; until then, 0 recommendations
 *     are returned (empty catalog = empty result, no error).
 *   - PR-58 (Opus): ``DiagnosticPriorityService`` applies the full formula
 *     and overwrites ``final_priority_in_session``; this engine assigns a
 *     raw score-based rank as a baseline (1 = highest score).
 *
 * Severity weight table (PLAN_M4_NARRATIVE §2.3 + DEC-34):
 *   minimal  → 0.10
 *   mild     → 0.30
 *   moderate → 0.50
 *   strong   → 0.80
 *   extreme  → 1.00
 *
 * Scoring (pre-PR-58 baseline):
 *   score = severity_weight × confidence_final × priority_default
 *
 * After PR-58, the ``DiagnosticPriorityService`` replaces this with:
 *   (I × S × C × A) × (1−R) × (1 − E×0.5)
 *
 * References:
 *   - PLAN_M4_NARRATIVE.md §2.3 (M4.3 backlog, PR-57)
 *   - PLAN_DDL_REVIEW.md §4.2 (schema)
 *   - PLAN_METRICS.md §0 (PR-57 row)
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { RecommendationCatalogVersionEntity } from './infrastructure/entities/recommendation-catalog-version.entity.js';
import { RecommendationCatalogEntity } from './infrastructure/entities/recommendation-catalog.entity.js';
import { RecommendationTriggerEntity } from './infrastructure/entities/recommendation-trigger.entity.js';
import { RecommendationLinkEntity } from './infrastructure/entities/recommendation-link.entity.js';
import { MetricEvaluationAgainstIdealEntity } from '../analysis/infrastructure/entities/metric-evaluation-against-ideal.entity.js';
import { MetricEvaluationEntity } from '../analysis/infrastructure/entities/metric-evaluation.entity.js';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface RecommendationMatch {
  recommendationId: string;
  score: number;
  rank: number;
  triggeredByMetricEvaluationIds: string[];
  requiresProfessional: boolean;
  professionalType: string | null;
  category: string;
  displayTextShortPt: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Severity weight map (pre-PR-58 baseline scoring)
// ──────────────────────────────────────────────────────────────────────────────

const SEVERITY_WEIGHTS: Record<string, number> = {
  minimal: 0.1,
  mild: 0.3,
  moderate: 0.5,
  strong: 0.8,
  extreme: 1.0,
  ideal: 0.0,   // ideal = no deviation; triggers should not fire on ideal
};

// ──────────────────────────────────────────────────────────────────────────────
// RecommendationEngine
// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class RecommendationEngine {
  private readonly logger = new Logger(RecommendationEngine.name);

  constructor(
    @InjectRepository(RecommendationCatalogVersionEntity)
    private readonly catalogVersionRepo: Repository<RecommendationCatalogVersionEntity>,

    @InjectRepository(RecommendationCatalogEntity)
    private readonly catalogRepo: Repository<RecommendationCatalogEntity>,

    @InjectRepository(RecommendationTriggerEntity)
    private readonly triggerRepo: Repository<RecommendationTriggerEntity>,

    @InjectRepository(RecommendationLinkEntity)
    private readonly linkRepo: Repository<RecommendationLinkEntity>,

    @InjectRepository(MetricEvaluationAgainstIdealEntity)
    private readonly evalAgainstIdealRepo: Repository<MetricEvaluationAgainstIdealEntity>,

    @InjectRepository(MetricEvaluationEntity)
    private readonly evalRepo: Repository<MetricEvaluationEntity>,
  ) {}

  /**
   * Main entry point. Runs the full matching + scoring + persistence cycle
   * for a given analysis report.
   *
   * Returns the top-5 ``RecommendationMatch`` objects (or fewer if the
   * catalog has fewer matching triggers). Returns empty array when the
   * catalog has no triggers (empty v0.1 seed — PR-56 Opus populates them).
   *
   * Side effects: persists ``recommendation_link`` rows. If links already
   * exist for this report (idempotent re-run), deletes and re-creates them.
   */
  async findForReport(
    analysisReportId: string,
    analysisReportGeneratedAt: Date,
  ): Promise<RecommendationMatch[]> {
    // 1. Load active catalog version
    const activeVersion = await this.catalogVersionRepo.findOne({
      where: { isActive: true },
    });

    if (!activeVersion) {
      this.logger.warn('No active recommendation_catalog_version found — skipping.');
      return [];
    }

    // 2. Load all triggers for this version (join with catalog for priority + display)
    const triggers = await this.triggerRepo
      .createQueryBuilder('t')
      .innerJoinAndSelect('t.recommendation', 'rec')
      .where('rec.version = :version', { version: activeVersion.version })
      .getMany();

    // 2b. Pre-compute trigger-count per recommendation. A recommendation that
    // fires for 100+ different metrics is a "catch-all" lifestyle/photo nudge
    // (e.g. routine-400 covers 195 distinct metric×severity combos), and
    // should not dominate over recommendations specifically targeted at the
    // user's actual findings. Penalty curve: factor = 1 / log2(2 + triggers).
    //   1 trigger   → 1.00 (no penalty)
    //   5 triggers  → 0.39
    //   20 triggers → 0.22
    //   100 triggers → 0.15
    //   200 triggers → 0.13
    const triggerCountByRec = new Map<string, number>();
    for (const t of triggers) {
      triggerCountByRec.set(
        t.recommendationId,
        (triggerCountByRec.get(t.recommendationId) ?? 0) + 1,
      );
    }
    const genericityPenalty = (recId: string): number => {
      const n = triggerCountByRec.get(recId) ?? 1;
      return 1.0 / Math.log2(2 + n);
    };

    if (triggers.length === 0) {
      this.logger.debug(
        `No recommendation triggers in catalog version=${activeVersion.version}. ` +
        'Run PR-56 (Opus) to populate the catalog.',
      );
      return [];
    }

    // 3. Load metric_evaluation rows for this report (to get metric_id + confidence_final)
    const evaluations = await this.evalRepo.find({
      where: {
        analysisReportId,
        analysisReportGeneratedAt,
      },
    });

    if (evaluations.length === 0) {
      this.logger.warn(
        `No metric_evaluation rows found for report=${analysisReportId}. ` +
        'Cannot match recommendations.',
      );
      return [];
    }

    // 4. Load metric_evaluation_against_ideal rows for these evaluations
    const evalIds = evaluations.map((e) => e.id);
    const againstIdeals = await this.evalAgainstIdealRepo
      .createQueryBuilder('ai')
      .where('ai.metric_evaluation_id IN (:...ids)', { ids: evalIds })
      .getMany();

    // 5. Build a lookup map: metricEvaluationId → {metricId, confidenceFinal, severity5, directionLabel}
    const evalMap = new Map(evaluations.map((e) => [e.id, e]));

    // 6. Match triggers against evaluations
    //    Accumulator: recommendation_id → { score, triggeredBy: Set<uuid> }
    interface AccEntry {
      score: number;
      triggeredBy: Set<string>;
      catalog: RecommendationCatalogEntity;
    }
    const acc = new Map<string, AccEntry>();

    for (const ai of againstIdeals) {
      const eval_ = evalMap.get(ai.metricEvaluationId);
      if (!eval_) continue;

      const severity = ai.severity5 ?? 'ideal';
      if (severity === 'ideal') continue;  // ideal → no deviation → skip

      const directionPt = this._extractDirectionValue(ai.directionLabel);
      const confidenceFinal = eval_.confidenceFinal ?? 0;
      if (confidenceFinal < 0.4) continue;  // DEC-7 display threshold

      // Severity matching with downgrade fallback: an "extreme" finding still
      // matches triggers configured for "strong" / "moderate" / "mild" if no
      // exact match exists. Preserves DEC-38 escada — a recommendation for
      // "strong" is semantically applicable to "extreme".
      const severityCandidates: string[] =
        severity === 'extreme'
          ? ['extreme', 'strong', 'moderate', 'mild']
          : severity === 'strong'
            ? ['strong', 'moderate', 'mild']
            : severity === 'moderate'
              ? ['moderate', 'mild']
              : [severity];

      for (const trigger of triggers) {
        if (trigger.metricId !== eval_.metricId) continue;
        const sevIdx = severityCandidates.indexOf(trigger.severity);
        if (sevIdx < 0) continue;
        if (trigger.direction !== 'any' && trigger.direction !== directionPt) continue;

        const severityWeight = SEVERITY_WEIGHTS[severity] ?? 0;
        // Penalize downgraded matches so exact-severity triggers always win.
        const sevPenalty = sevIdx === 0 ? 1.0 : Math.pow(0.7, sevIdx);
        const genPenalty = genericityPenalty(trigger.recommendationId);
        const score =
          severityWeight *
          confidenceFinal *
          trigger.recommendation.priorityDefault *
          sevPenalty *
          genPenalty;

        const existing = acc.get(trigger.recommendationId);
        if (existing) {
          // OR semantics: multiple triggers for same rec → take max score, union eval IDs
          existing.score = Math.max(existing.score, score);
          existing.triggeredBy.add(ai.id);
        } else {
          acc.set(trigger.recommendationId, {
            score,
            triggeredBy: new Set([ai.id]),
            catalog: trigger.recommendation,
          });
        }
      }
    }

    if (acc.size === 0) {
      this.logger.debug(`No triggers matched for report=${analysisReportId}.`);
      return [];
    }

    // 7. Sort by score desc, take top 5
    const sorted = Array.from(acc.entries())
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 5);

    // 8. Delete existing links for this report (idempotency)
    await this.linkRepo
      .createQueryBuilder()
      .delete()
      .where(
        'analysis_report_id = :rid AND analysis_report_generated_at = :gat',
        { rid: analysisReportId, gat: analysisReportGeneratedAt },
      )
      .execute();

    // 9. Persist new recommendation_link rows
    const links: RecommendationLinkEntity[] = sorted.map(
      ([recId, entry], idx) => {
        const link = new RecommendationLinkEntity();
        link.analysisReportId = analysisReportId;
        link.analysisReportGeneratedAt = analysisReportGeneratedAt;
        link.recommendationId = recId;
        link.triggeredByMetricEvaluationIds = Array.from(entry.triggeredBy);
        link.finalPriorityInSession = idx + 1;
        link.isDisplayedToUser = true;  // all top-5 are displayed
        return link;
      },
    );

    await this.linkRepo.save(links);

    this.logger.log(
      `RecommendationEngine: persisted ${links.length} links for report=${analysisReportId}`,
    );

    // 10. Return structured results
    return sorted.map(([recId, entry], idx) => ({
      recommendationId: recId,
      score: Math.round(entry.score * 1000) / 1000,
      rank: idx + 1,
      triggeredByMetricEvaluationIds: Array.from(entry.triggeredBy),
      requiresProfessional: entry.catalog.requiresProfessional,
      professionalType: entry.catalog.professionalType,
      category: entry.catalog.category,
      displayTextShortPt: entry.catalog.displayTextShortPt,
    }));
  }

  /**
   * Extract the primary direction value from the ``direction_label`` JSONB
   * (LocalizedText: { "pt-BR": "para a esquerda", … }).
   *
   * Triggers store direction as the raw direction key (e.g. "left_dominant"),
   * not the localised label. The ``directionLabel`` is for display.
   *
   * NOTE: ``metric_evaluation_against_ideal`` does not yet store a raw
   * direction key — only ``direction_label`` (JSONB i18n). For matching
   * purposes we use the English portion or fall back to 'neutral'.
   *
   * TODO (PR-58 / Opus): decide whether to add a raw ``direction`` TEXT
   * column to ``metric_evaluation_against_ideal`` for exact matching.
   * Until then, direction matching falls back to 'any' for all triggers
   * unless the trigger itself has direction='any'.
   */
  private _extractDirectionValue(directionLabel: Record<string, string>): string {
    // Heuristic: if there's an 'en' or 'en-US' key, use it as the raw direction
    return directionLabel?.['en'] ?? directionLabel?.['en-US'] ?? 'neutral';
  }
}
