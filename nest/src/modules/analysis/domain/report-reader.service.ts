/**
 * ReportReaderService — PR-24.
 *
 * Provides read access to persisted AnalysisReport aggregates (the write side
 * lives in AnalysisOrchestratorService.evaluate).
 *
 * Two public methods:
 *  - getReportById(id)              → single report or throws NotFoundException
 *  - listBySession(sessionId,limit) → paginated slice ordered by generated_at DESC
 *
 * Partition notes:
 *  - analysis_report is RANGE-partitioned by generated_at. Querying by id alone
 *    causes a sequential partition scan — acceptable for single-row admin lookups.
 *  - metric_evaluation is co-located with analysis_report. Once we have
 *    report.generatedAt we supply it to all child queries for partition pruning.
 *  - regional_score and global_score are plain (non-partitioned) tables.
 *
 * Data sources:
 *  - TypeORM entities (analysis_report, metric_evaluation,
 *    metric_evaluation_against_ideal, regional_score, global_score,
 *    metric_definition)
 *  - No external HTTP calls; fully self-contained DB reads.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { AnalysisReportEntity } from '../infrastructure/entities/analysis-report.entity.js';
import { MetricEvaluationEntity } from '../infrastructure/entities/metric-evaluation.entity.js';
import { MetricEvaluationAgainstIdealEntity } from '../infrastructure/entities/metric-evaluation-against-ideal.entity.js';
import { RegionalScoreEntity } from '../infrastructure/entities/regional-score.entity.js';
import { GlobalScoreEntity } from '../infrastructure/entities/global-score.entity.js';
import { MetricDefinitionEntity } from '../infrastructure/entities/metric-definition.entity.js';
import { LandmarkPayloadEntity } from '../infrastructure/entities/landmark-payload.entity.js';

import type {
  EvaluateResponseDto,
  EvaluateVersionsDto,
  GlobalScoreResultDto,
  MetricEvaluationResultDto,
  RegionalScoreResultDto,
} from '../dto/evaluate.dto.js';

@Injectable()
export class ReportReaderService {
  private readonly logger = new Logger(ReportReaderService.name);

  constructor(
    @InjectRepository(AnalysisReportEntity)
    private readonly reportRepo: Repository<AnalysisReportEntity>,

    @InjectRepository(MetricEvaluationEntity)
    private readonly evalRepo: Repository<MetricEvaluationEntity>,

    @InjectRepository(MetricEvaluationAgainstIdealEntity)
    private readonly againstIdealRepo: Repository<MetricEvaluationAgainstIdealEntity>,

    @InjectRepository(RegionalScoreEntity)
    private readonly regionalRepo: Repository<RegionalScoreEntity>,

    @InjectRepository(GlobalScoreEntity)
    private readonly globalRepo: Repository<GlobalScoreEntity>,

    @InjectRepository(MetricDefinitionEntity)
    private readonly definitionRepo: Repository<MetricDefinitionEntity>,

    @InjectRepository(LandmarkPayloadEntity)
    private readonly landmarkRepo: Repository<LandmarkPayloadEntity>,
  ) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Fetch a single AnalysisReport by its UUID, reconstructing the full
   * EvaluateResponseDto shape (same as POST /v1/analysis/evaluate response).
   *
   * @throws NotFoundException when no report exists with the given id.
   */
  async getReportById(id: string): Promise<EvaluateResponseDto> {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) {
      throw new NotFoundException(`AnalysisReport ${id} not found`);
    }
    this.logger.debug(`Loading report ${id} (generated_at=${report.generatedAt.toISOString()})`);
    return this.buildResponseDto(report);
  }

  /**
   * List AnalysisReports for a session_id, ordered newest-first.
   * Returns up to `limit` records (default 10, max enforced by DTO: 50).
   */
  async listBySession(sessionId: string, limit = 10): Promise<EvaluateResponseDto[]> {
    const reports = await this.reportRepo.find({
      where: { sessionId },
      order: { generatedAt: 'DESC' },
      take: limit,
    });
    this.logger.debug(`listBySession: ${reports.length} reports for session ${sessionId}`);
    // Load each report's children in parallel batches (reports.length typically ≤ 10).
    return Promise.all(reports.map((r) => this.buildResponseDto(r)));
  }

  // ---------------------------------------------------------------------------
  // Internal builder
  // ---------------------------------------------------------------------------

  private async buildResponseDto(report: AnalysisReportEntity): Promise<EvaluateResponseDto> {
    const generatedAt = report.generatedAt;

    // Load all child datasets in parallel.
    // metric_evaluation + landmark_payload: pruned by (analysis_report_id, analysis_report_generated_at).
    // regional_score + global_score: plain tables, pruned by analysis_report_id.
    const [evals, landmarkPayload, regionalScores, globalScore] = await Promise.all([
      this.evalRepo.find({
        where: {
          analysisReportId: report.id,
          analysisReportGeneratedAt: generatedAt,
        },
      }),
      this.landmarkRepo.findOne({
        where: {
          analysisReportId: report.id,
          analysisReportGeneratedAt: generatedAt,
        },
      }),
      this.regionalRepo.find({
        where: {
          analysisReportId: report.id,
          analysisReportGeneratedAt: generatedAt,
        },
      }),
      this.globalRepo.findOne({
        where: { analysisReportId: report.id, analysisReportGeneratedAt: generatedAt },
      }),
    ]);

    // Load against-ideal rows (not partitioned) for all evaluation ids.
    const evalIds = evals.map((e) => e.id);
    const againstIdeals = evalIds.length
      ? await this.againstIdealRepo.find({
          where: { metricEvaluationId: In(evalIds) },
        })
      : [];

    // Index against-ideal by metricEvaluationId for O(1) lookup.
    const againstMap = new Map<string, MetricEvaluationAgainstIdealEntity>();
    for (const a of againstIdeals) {
      againstMap.set(a.metricEvaluationId, a);
    }

    // Load metric definitions for region/family/unit enrichment.
    const metricIds = [...new Set(evals.map((e) => e.metricId))];
    const definitionMap = await this.loadDefinitionMap(metricIds, report.metricRegistryVersion);

    // Build metrics array.
    const metrics: MetricEvaluationResultDto[] = evals.map((ev) => {
      const against = againstMap.get(ev.id);
      const def = definitionMap.get(ev.metricId);
      return {
        metric_id: ev.metricId,
        region: def?.region ?? 'unknown',
        family: def?.family ?? 'unknown',
        unit: def?.unit ?? 'unknown',
        value: ev.value,
        confidence_raw: ev.confidenceRaw,
        confidence_final: ev.confidenceFinal,
        is_low_confidence: ev.isLowConfidence,
        direction: ev.direction,
        deviation_raw: against?.deviationRaw ?? null,
        deviation_normalized: against?.deviationNormalized ?? null,
        severity_5: against?.severity5 ?? null,
        severity_3: against?.severity3 ?? null,
        direction_label: against?.directionLabel ?? {},
        improvement_vector_x: against?.improvementVectorX ?? null,
        improvement_vector_y: against?.improvementVectorY ?? null,
      };
    });

    // Build regional scores array.
    const regionalScoresDto: RegionalScoreResultDto[] = regionalScores.map((rs) => ({
      region: rs.region,
      score_0_100: rs.score0to100,
      confidence_aggregate: rs.confidenceAggregate,
      contributing_metric_ids: rs.contributingMetricIds,
    }));

    // Build global score (null-safe: report may have no global_score row if
    // scoring was skipped due to missing weights).
    const globalScoreDto: GlobalScoreResultDto = globalScore
      ? {
          score_0_100: globalScore.score0to100,
          is_displayable: globalScore.isDisplayable,
          band: globalScore.band,
          regional_breakdown: globalScore.regionalBreakdown,
        }
      : {
          score_0_100: null,
          is_displayable: false,
          band: null,
          regional_breakdown: [],
        };

    const versions: EvaluateVersionsDto = {
      metric_registry_version: report.metricRegistryVersion,
      ideals_version: report.idealsVersion,
      threshold_config_version: report.thresholdConfigVersion,
      severity_collapse_version: report.severityCollapseVersion,
      region_metric_weights_version: report.regionMetricWeightsVersion,
      global_weights_version: report.globalWeightsVersion,
    };

    // Extract landmarks from payload (convert {x, y, z} back to [x, y]).
    const landmarks = landmarkPayload?.rawLandmarks
      ? landmarkPayload.rawLandmarks.map((lm: { x: number; y: number }) => [lm.x, lm.y] as [number, number])
      : undefined;

    return {
      analysis_report_id: report.id,
      session_id: report.sessionId,
      generated_at: generatedAt.toISOString(),
      status: report.status,
      quality_score: report.qualityScore,
      metric_count: metrics.length,
      metrics,
      /** Alias for frontend (AnalysisResult.metric_evaluations). Same as metrics array. PR-36 M3.2. */
      metric_evaluations: metrics,
      /** Raw pixel landmarks from MediaPipe Mesh-478 (PR-31 M3.1 overlays). */
      landmarks,
      regional_scores: regionalScoresDto,
      global_score: globalScoreDto,
      versions,
    };
  }

  /**
   * Load MetricDefinitionEntity rows for the given metric IDs, preferring the
   * version stored on the report. Falls back to any version when the report's
   * version is null (e.g., legacy rows or early tests).
   *
   * Returns a Map<metricId, MetricDefinitionEntity> (one entry per metric_id,
   * first-match wins when multiple versions are present for the same metric_id).
   */
  private async loadDefinitionMap(
    metricIds: string[],
    registryVersion: string | null,
  ): Promise<Map<string, MetricDefinitionEntity>> {
    if (!metricIds.length) return new Map();

    const rows = registryVersion
      ? await this.definitionRepo.find({
          where: { metricId: In(metricIds), version: registryVersion },
        })
      : await this.definitionRepo.find({
          where: { metricId: In(metricIds) },
        });

    const map = new Map<string, MetricDefinitionEntity>();
    for (const row of rows) {
      // Keep the first hit when multiple versions present (version-unfiltered path).
      if (!map.has(row.metricId)) {
        map.set(row.metricId, row);
      }
    }
    return map;
  }
}
