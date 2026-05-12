/**
 * PR-59 — NarrativeService (M4.4 skeleton)
 *
 * Assembles the full narrative response for ``GET /v1/analysis/:id/narrative``:
 *
 *   findings       — top-3 ``metric_evaluation_against_ideal`` by severity
 *                    weight, rendered via ``TemplateRendererService`` (PR-51).
 *                    Falls back to a generated sentence when no template exists
 *                    (PR-53 Opus populates templates later).
 *
 *   recommendations — top-5 from ``RecommendationEngine.findForReport()``
 *                     (PR-57). Returns empty array when catalog has no triggers
 *                     (PR-56 Opus populates them later).
 *
 *   global_score    — score_0_100 from the ``global_score`` table (nullable
 *                     when DEC-8 gating blocks display).
 *
 *   disclaimer      — static DEC-35 notice appended to every report.
 *
 * Skeleton behaviour (before Opus PRs 53/56/58):
 *   - Templates not found → fallback sentence (Portuguese): metric_id +
 *     severity_3 + direction_label['pt-BR']
 *   - No recommendation triggers → empty recommendations array
 *   - final_priority_in_session set by RecommendationEngine (simple rank)
 *
 * References:
 *   - PLAN_M4_NARRATIVE.md §3 (PR-59 backlog row)
 *   - PLAN_METRICS.md §0 (PR-59 row)
 *   - DEC-35 (disclaimer text)
 */
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { TemplateRendererService } from './template-renderer.service.js';
import { RecommendationEngine } from './recommendation-engine.service.js';
import { DiagnosticPriorityService } from './diagnostic-priority.service.js';
import type { RecommendationMatch } from './recommendation-engine.service.js';

import { DiagnosticTemplateEntity } from './infrastructure/entities/diagnostic-template.entity.js';
import { RecommendationLinkEntity } from './infrastructure/entities/recommendation-link.entity.js';
import { RecommendationCatalogEntity } from './infrastructure/entities/recommendation-catalog.entity.js';

import { MetricEvaluationAgainstIdealEntity } from '../analysis/infrastructure/entities/metric-evaluation-against-ideal.entity.js';
import { MetricEvaluationEntity } from '../analysis/infrastructure/entities/metric-evaluation.entity.js';
import { AnalysisReportEntity } from '../analysis/infrastructure/entities/analysis-report.entity.js';
import { GlobalScoreEntity } from '../analysis/infrastructure/entities/global-score.entity.js';

// ──────────────────────────────────────────────────────────────────────────────
// Severity ordering for top-3 finding selection (highest → lowest)
// ──────────────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<string, number> = {
  extreme: 5,
  strong:  4,
  moderate: 3,
  mild: 2,
  minimal: 1,
  ideal: 0,
};

// ──────────────────────────────────────────────────────────────────────────────
// DTO shapes (local — exported for controller use)
// ──────────────────────────────────────────────────────────────────────────────

export interface NarrativeFindingDto {
  metric_id: string;
  severity_3: string | null;
  severity_5: string | null;
  direction_label_pt: string | null;
  narrative_text: string;
  deviation_normalized: number | null;
}

export interface NarrativeRecommendationDto {
  recommendation_id: string;
  rank: number;
  score: number;
  category: string;
  display_text_short_pt: string;
  requires_professional: boolean;
  professional_type: string | null;
}

export interface NarrativeResponseDto {
  report_id: string;
  generated_at: string;
  global_score: number | null;
  findings: NarrativeFindingDto[];
  recommendations: NarrativeRecommendationDto[];
  disclaimer: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Static disclaimer (DEC-35)
// ──────────────────────────────────────────────────────────────────────────────

const DISCLAIMER_PT =
  'Esta análise é gerada por inteligência artificial e tem caráter exclusivamente ' +
  'informativo. Não substitui a avaliação de profissionais de saúde qualificados. ' +
  'Os resultados podem variar de acordo com qualidade da foto, iluminação e ângulo. ' +
  'Consulte um médico ou especialista antes de tomar qualquer decisão baseada nestas informações.';

// ──────────────────────────────────────────────────────────────────────────────
// NarrativeService
// ──────────────────────────────────────────────────────────────────────────────

@Injectable()
export class NarrativeService {
  private readonly logger = new Logger(NarrativeService.name);

  constructor(
    private readonly renderer: TemplateRendererService,
    private readonly recommendationEngine: RecommendationEngine,
    private readonly priorityService: DiagnosticPriorityService,

    @InjectRepository(DiagnosticTemplateEntity)
    private readonly templateRepo: Repository<DiagnosticTemplateEntity>,

    @InjectRepository(MetricEvaluationAgainstIdealEntity)
    private readonly evalAgainstIdealRepo: Repository<MetricEvaluationAgainstIdealEntity>,

    @InjectRepository(MetricEvaluationEntity)
    private readonly evalRepo: Repository<MetricEvaluationEntity>,

    @InjectRepository(AnalysisReportEntity)
    private readonly reportRepo: Repository<AnalysisReportEntity>,

    @InjectRepository(GlobalScoreEntity)
    private readonly globalScoreRepo: Repository<GlobalScoreEntity>,

    @InjectRepository(RecommendationLinkEntity)
    private readonly linkRepo: Repository<RecommendationLinkEntity>,

    @InjectRepository(RecommendationCatalogEntity)
    private readonly catalogRepo: Repository<RecommendationCatalogEntity>,
  ) {}

  async narrativeForReport(reportId: string): Promise<NarrativeResponseDto> {
    // 1. Load report (partition-scan by id — acceptable for single-row lookup)
    const report = await this.reportRepo.findOne({
      where: { id: reportId },
    });

    if (!report) {
      throw new NotFoundException(`Analysis report not found: ${reportId}`);
    }

    const generatedAt = report.generatedAt;

    // 2. Load global score
    const globalScore = await this.globalScoreRepo.findOne({
      where: { analysisReportId: reportId },
    });

    // 3. Load all metric_evaluation rows for partition-pruning
    const evaluations = await this.evalRepo.find({
      where: { analysisReportId: reportId, analysisReportGeneratedAt: generatedAt },
    });

    const evalIds = evaluations.map((e) => e.id);
    const evalMap = new Map(evaluations.map((e) => [e.id, e]));

    // 4. Load metric_evaluation_against_ideal rows, sort by severity desc
    let againstIdeals: MetricEvaluationAgainstIdealEntity[] = [];

    if (evalIds.length > 0) {
      againstIdeals = await this.evalAgainstIdealRepo
        .createQueryBuilder('ai')
        .where('ai.metric_evaluation_id IN (:...ids)', { ids: evalIds })
        .getMany();
    }

    // Sort by severity weight desc; pick top 3 non-ideal
    const sortedFindings = againstIdeals
      .filter((ai) => ai.severity5 && ai.severity5 !== 'ideal')
      .sort(
        (a, b) =>
          (SEVERITY_ORDER[b.severity5 ?? 'ideal'] ?? 0) -
          (SEVERITY_ORDER[a.severity5 ?? 'ideal'] ?? 0),
      )
      .slice(0, 3);

    // 5. Build narrative text for each finding
    const findings: NarrativeFindingDto[] = await Promise.all(
      sortedFindings.map(async (ai) => {
        const eval_ = evalMap.get(ai.metricEvaluationId);
        const metricId = eval_?.metricId ?? 'unknown';
        const directionPt: string | null = ai.directionLabel?.['pt-BR'] ?? null;
        const severityPt = this._severityPtBr(ai.severity3 ?? null);

        const narrativeText = await this._renderFindingText(
          metricId,
          ai.severity5 ?? null,
          ai.severity3 ?? null,
          directionPt,
          ai.deviationNormalized,
        );

        return {
          metric_id: metricId,
          severity_3: ai.severity3,
          severity_5: ai.severity5,
          direction_label_pt: directionPt,
          narrative_text: narrativeText,
          deviation_normalized: ai.deviationNormalized,
        };
      }),
    );

    // 6. Run RecommendationEngine (idempotent — deletes + recreates links)
    let matches: RecommendationMatch[] = [];
    try {
      matches = await this.recommendationEngine.findForReport(reportId, generatedAt);
    } catch (err) {
      this.logger.error(`RecommendationEngine failed for report=${reportId}`, err);
      // Non-fatal: narrative continues without recommendations
    }

    // 6b. Apply DiagnosticPriorityService (PR-58) — full I×S×C×A×(1−R)×(1−E×0.5)
    //     formula + diversity constraint (max 2/category) + top-5 selection.
    //     Overwrites simple-rank scores from RecommendationEngine with the
    //     final priority + is_displayed_to_user flags.
    if (matches.length > 0) {
      try {
        matches = await this.priorityService.prioritize(
          reportId,
          generatedAt,
          report.qualityScore ?? 1.0,
        );
      } catch (err) {
        this.logger.error(`DiagnosticPriorityService failed for report=${reportId}`, err);
        // Non-fatal: keep RecommendationEngine baseline ranking
      }
    }

    const recommendations: NarrativeRecommendationDto[] = matches.map((m) => ({
      recommendation_id: m.recommendationId,
      rank: m.rank,
      score: m.score,
      category: m.category,
      display_text_short_pt: m.displayTextShortPt,
      requires_professional: m.requiresProfessional,
      professional_type: m.professionalType,
    }));

    return {
      report_id: reportId,
      generated_at: generatedAt.toISOString(),
      global_score: globalScore?.score0to100 ?? null,
      findings,
      recommendations,
      disclaimer: DISCLAIMER_PT,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Renders finding text.
   * Priority:
   *   1. Template from ``diagnostic_template`` (metric_id + severity_5 + size='medium')
   *   2. Fallback sentence (safe for pre-PR-53 skeleton)
   */
  private async _renderFindingText(
    metricId: string,
    severity5: string | null,
    severity3: string | null,
    directionPt: string | null,
    deviationNormalized: number | null,
  ): Promise<string> {
    if (severity5) {
      const template = await this.templateRepo.findOne({
        where: {
          metricId,
          severity: severity5 as any,
          size: 'medium',
        },
      });

      if (template) {
        try {
          const deviationPct = deviationNormalized
            ? String(Math.round(deviationNormalized * 100))
            : '—';

          return this.renderer.render({
            template: template.templatePt,
            placeholdersUsed: template.placeholdersUsed,
            context: {
              ...(template.placeholdersUsed.includes('deviation_pct') && { deviation_pct: deviationPct }),
              ...(template.placeholdersUsed.includes('direction_label') && { direction_label: directionPt ?? '' }),
            },
          });
        } catch (err) {
          this.logger.warn(
            `Template render failed for metric=${metricId} sev=${severity5}: ${String(err)}`,
          );
        }
      }
    }

    // Fallback (pre-PR-53)
    return this._buildFallbackFinding(metricId, severity3, directionPt, deviationNormalized);
  }

  private _buildFallbackFinding(
    metricId: string,
    severity3: string | null,
    directionPt: string | null,
    deviationNormalized: number | null,
  ): string {
    const metricLabel = metricId.replace(/_/g, ' ');
    const severityLabel = this._severityPtBr(severity3);
    const directionStr = directionPt ? ` — ${directionPt}` : '';
    const deviationStr =
      deviationNormalized != null
        ? ` (desvio de ${Math.round(deviationNormalized * 100)}%)`
        : '';

    return `${metricLabel}${deviationStr} — severidade ${severityLabel}${directionStr}.`;
  }

  private _severityPtBr(severity3: string | null): string {
    switch (severity3) {
      case 'LEVE':     return 'leve';
      case 'MODERADO': return 'moderada';
      case 'SEVERO':   return 'severa';
      default:         return 'indeterminada';
    }
  }
}
