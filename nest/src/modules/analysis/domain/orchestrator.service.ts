/**
 * AnalysisOrchestratorService — PR-10 M1 core.
 *
 * Orchestrates one full analysis run:
 *  1. Call Python /vision/metrics-v2 to get 21 atomic MetricValues.
 *  2. Load active DB versions (metric_registry, ideals, threshold, severity_collapse).
 *  3. For each raw metric:
 *     a. Create MetricEvaluationEntity.
 *     b. Look up MetricIdealEntity for this metric+ideals_version.
 *     c. Run IdealComparator → deviation_raw, deviation_normalized, direction_label.
 *     d. Run SeverityClassifier → severity_5, severity_3.
 *     e. Create MetricEvaluationAgainstIdealEntity (if ideal found).
 *  4. Create AnalysisReportEntity + LandmarkPayloadEntity.
 *  5. Persist everything in a single DB transaction.
 *  6. Return EvaluateResponseDto.
 *
 * Dependencies that need DB access are injected via TypeORM repositories.
 * IdealComparator and SeverityClassifier are injected as pure domain services.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { VisionClient } from '#modules/vision/vision.client.js';
import { IdealComparator } from './ideal-comparator.js';
import { SeverityClassifier } from './severity-classifier.js';
import { DEFAULT_COLLAPSE_MAPPING } from './severity-classifier.js';
import { RegionalScorer } from './regional-scorer.js';
import type { RegionalScorerMetricInput, RegionalScoreResult } from './regional-scorer.js';
import { GlobalScorer } from './global-scorer.js';
import { AnalysisReportEntity } from '../infrastructure/entities/analysis-report.entity.js';
import { LandmarkPayloadEntity } from '../infrastructure/entities/landmark-payload.entity.js';
import { MetricEvaluationEntity } from '../infrastructure/entities/metric-evaluation.entity.js';
import { MetricEvaluationAgainstIdealEntity } from '../infrastructure/entities/metric-evaluation-against-ideal.entity.js';
import { MetricIdealEntity } from '../infrastructure/entities/metric-ideal.entity.js';
import { MetricRegistryVersionEntity } from '../infrastructure/entities/metric-registry-version.entity.js';
import { IdealsVersionEntity } from '../infrastructure/entities/ideals-version.entity.js';
import { AnalysisThresholdConfigEntity } from '../infrastructure/entities/analysis-threshold-config.entity.js';
import { SeverityCollapsePolicyEntity } from '../infrastructure/entities/severity-collapse-policy.entity.js';
import type { SeverityCollapseMapping } from '../infrastructure/entities/severity-collapse-policy.entity.js';
import { RegionMetricWeightsVersionEntity } from '../infrastructure/entities/region-metric-weights-version.entity.js';
import { RegionMetricWeightEntity } from '../infrastructure/entities/region-metric-weight.entity.js';
import { GlobalWeightsVersionEntity } from '../infrastructure/entities/global-weights-version.entity.js';
import { GlobalWeightEntity } from '../infrastructure/entities/global-weight.entity.js';
import { RegionalScoreEntity } from '../infrastructure/entities/regional-score.entity.js';
import { GlobalScoreEntity } from '../infrastructure/entities/global-score.entity.js';
import type {
  EvaluateRequestDto,
  EvaluateResponseDto,
  MetricEvaluationResultDto,
  RegionalScoreResultDto,
  GlobalScoreResultDto,
  RawMetricV2,
} from '../dto/evaluate.dto.js';

// Disclaimer snapshot (DEC-3/DEC-5) — frozen text
const DISCLAIMER_TEXT =
  'Esta análise é gerada por inteligência artificial para fins informativos. ' +
  'Não substitui avaliação médica ou odontológica. Os resultados são baseados em proporções ' +
  'de referência da literatura e podem variar conforme iluminação e posição da câmera.';

@Injectable()
export class AnalysisOrchestratorService {
  private readonly logger = new Logger(AnalysisOrchestratorService.name);

  constructor(
    private readonly vision: VisionClient,
    private readonly comparator: IdealComparator,
    private readonly classifier: SeverityClassifier,
    private readonly regionalScorer: RegionalScorer,
    private readonly globalScorer: GlobalScorer,
    private readonly dataSource: DataSource,
    @InjectRepository(MetricIdealEntity)
    private readonly idealRepo: Repository<MetricIdealEntity>,
    @InjectRepository(MetricRegistryVersionEntity)
    private readonly registryVersionRepo: Repository<MetricRegistryVersionEntity>,
    @InjectRepository(IdealsVersionEntity)
    private readonly idealsVersionRepo: Repository<IdealsVersionEntity>,
    @InjectRepository(AnalysisThresholdConfigEntity)
    private readonly thresholdRepo: Repository<AnalysisThresholdConfigEntity>,
    @InjectRepository(SeverityCollapsePolicyEntity)
    private readonly collapseRepo: Repository<SeverityCollapsePolicyEntity>,
    @InjectRepository(RegionMetricWeightsVersionEntity)
    private readonly regionWeightsVersionRepo: Repository<RegionMetricWeightsVersionEntity>,
    @InjectRepository(RegionMetricWeightEntity)
    private readonly regionWeightRepo: Repository<RegionMetricWeightEntity>,
    @InjectRepository(GlobalWeightsVersionEntity)
    private readonly globalWeightsVersionRepo: Repository<GlobalWeightsVersionEntity>,
    @InjectRepository(GlobalWeightEntity)
    private readonly globalWeightRepo: Repository<GlobalWeightEntity>,
  ) {}

  async evaluate(dto: EvaluateRequestDto): Promise<EvaluateResponseDto> {
    const generatedAt = new Date();

    // -----------------------------------------------------------------------
    // 1. Call Python for raw metrics
    // -----------------------------------------------------------------------
    const v2Response = await this.vision.metricsV2({
      landmarks: dto.landmarks,
      quality_context: {
        quality_score: dto.quality_context.quality_score,
        regional_penalties: dto.quality_context.regional_penalties ?? {},
        pose: dto.quality_context.pose ?? {},
      },
      session_id: dto.session_id,
      yaw_deg: dto.yaw_deg ?? 0.0,
      pitch_deg: dto.pitch_deg ?? 0.0,
      image_size: dto.image_size ?? null,
    });

    const rawMetrics = v2Response.metrics as RawMetricV2[];
    this.logger.log(`metrics-v2 returned ${rawMetrics.length} metrics`);

    // -----------------------------------------------------------------------
    // 2. Load active DB versions (graceful degradation when DB is empty)
    // -----------------------------------------------------------------------
    const [
      registryVersion,
      idealsVersion,
      thresholdConfig,
      collapsePolicy,
      regionWeightsVersion,
      globalWeightsVersion,
    ] = await Promise.all([
      this.registryVersionRepo.findOne({ where: { isActive: true } }),
      this.idealsVersionRepo.findOne({ where: { isActive: true } }),
      this.thresholdRepo.findOne({ where: { isActive: true } }),
      this.collapseRepo.findOne({ where: { isActive: true } }),
      this.regionWeightsVersionRepo.findOne({ where: { isActive: true } }),
      this.globalWeightsVersionRepo.findOne({ where: { isActive: true } }),
    ]);

    const metricRegistryVer = registryVersion?.version ?? null;
    const idealsVer = idealsVersion?.version ?? null;
    const thresholdVer = thresholdConfig?.version ?? null;
    const collapseVer = collapsePolicy?.version ?? null;
    const regionWeightsVer = regionWeightsVersion?.version ?? null;
    const globalWeightsVer = globalWeightsVersion?.version ?? null;
    const criticalRegions: string[] = globalWeightsVersion?.criticalRegions ?? [];
    const collapseMapping: SeverityCollapseMapping =
      collapsePolicy?.mapping ?? DEFAULT_COLLAPSE_MAPPING;

    // -----------------------------------------------------------------------
    // 3. Load metric ideals + weights in bulk for the active versions
    // -----------------------------------------------------------------------
    const idealsByMetricId = new Map<string, MetricIdealEntity>();
    if (idealsVer) {
      const ideals = await this.idealRepo.find({
        where: { idealsVersion: idealsVer },
      });
      for (const ideal of ideals) {
        idealsByMetricId.set(ideal.metricId, ideal);
      }
      this.logger.log(`Loaded ${ideals.length} ideals for version ${idealsVer}`);
    }

    const regionWeightsByRegion = new Map<string, Map<string, number>>();
    if (regionWeightsVer) {
      const rows = await this.regionWeightRepo.find({
        where: { version: regionWeightsVer },
      });
      for (const r of rows) {
        let inner = regionWeightsByRegion.get(r.region);
        if (!inner) {
          inner = new Map<string, number>();
          regionWeightsByRegion.set(r.region, inner);
        }
        inner.set(r.metricId, r.weight);
      }
      this.logger.log(
        `Loaded ${rows.length} region_metric_weight rows for version ${regionWeightsVer}`,
      );
    }

    const globalWeightsByRegion = new Map<string, number>();
    if (globalWeightsVer) {
      const rows = await this.globalWeightRepo.find({
        where: { version: globalWeightsVer },
      });
      for (const r of rows) {
        globalWeightsByRegion.set(r.region, r.weight);
      }
      this.logger.log(
        `Loaded ${rows.length} global_weight rows for version ${globalWeightsVer}`,
      );
    }

    // -----------------------------------------------------------------------
    // 4. Build entities in memory
    // -----------------------------------------------------------------------
    const metricResults: MetricEvaluationResultDto[] = [];

    const evaluationEntities: MetricEvaluationEntity[] = [];
    const againstIdealEntities: MetricEvaluationAgainstIdealEntity[] = [];

    for (const raw of rawMetrics) {
      // MetricEvaluation
      const eval_ = new MetricEvaluationEntity();
      eval_.metricId = raw.metric_id;
      eval_.metricDefinitionVersion = metricRegistryVer ?? 'v1.0';
      eval_.value = raw.value;
      eval_.error = raw.value === null ? 'calculation_failed' : null;
      eval_.confidenceRaw = raw.confidence_raw;
      eval_.confidenceFinal = raw.confidence_final;
      eval_.isLowConfidence = raw.is_low_confidence;
      eval_.displayable = !raw.presentation_only && !raw.is_low_confidence && raw.value !== null;
      eval_.direction = raw.direction;
      eval_.generatedAt = generatedAt;
      // analysisReportId + analysisReportGeneratedAt set after report creation

      // IdealComparator + SeverityClassifier
      const ideal = idealsByMetricId.get(raw.metric_id);
      let deviationRaw: number | null = null;
      let deviationNormalized: number | null = null;
      let severity5 = null;
      let severity3 = null;
      let directionLabel: Record<string, string> = {};

      if (ideal) {
        const comparison = this.comparator.compare(raw.value, {
          idealCentralValue: ideal.idealCentralValue,
          greenRangeMin: ideal.greenRangeMin,
          greenRangeMax: ideal.greenRangeMax,
          directionLabelAbove: ideal.directionLabelAbove,
          directionLabelBelow: ideal.directionLabelBelow,
        });
        deviationRaw = comparison.deviationRaw;
        deviationNormalized = comparison.deviationNormalized;
        directionLabel = comparison.directionLabel;

        const classified = this.classifier.classifyAndCollapse(
          deviationNormalized,
          collapseMapping,
        );
        severity5 = classified.severity5;
        severity3 = classified.severity3;
      }

      evaluationEntities.push(eval_);

      // MetricEvaluationAgainstIdeal (only when ideal exists)
      if (ideal) {
        const against = new MetricEvaluationAgainstIdealEntity();
        against.metricIdealId = ideal.id;
        against.deviationRaw = deviationRaw;
        against.deviationNormalized = deviationNormalized;
        against.severity5 = severity5;
        against.severity3 = severity3;
        against.directionLabel = directionLabel;
        against.metricEvaluationGeneratedAt = generatedAt;
        // Improvement vector from Python calculator (PR-34, M3.2)
        against.improvementVectorX = raw.improvement_vector?.[0] ?? null;
        against.improvementVectorY = raw.improvement_vector?.[1] ?? null;
        // metricEvaluationId set after eval_ is saved
        againstIdealEntities.push(against);
      } else {
        againstIdealEntities.push(null as unknown as MetricEvaluationAgainstIdealEntity);
      }

      metricResults.push({
        metric_id: raw.metric_id,
        region: raw.region,
        family: raw.family,
        unit: raw.unit,
        value: raw.value,
        confidence_raw: raw.confidence_raw,
        confidence_final: raw.confidence_final,
        is_low_confidence: raw.is_low_confidence,
        direction: raw.direction,
        deviation_raw: deviationRaw,
        deviation_normalized: deviationNormalized,
        severity_5: severity5,
        severity_3: severity3,
        direction_label: directionLabel,
        improvement_vector_x: raw.improvement_vector?.[0] ?? null,
        improvement_vector_y: raw.improvement_vector?.[1] ?? null,
        anchor_landmark_index: raw.dependency_landmarks?.[0] ?? null,
      });
    }

    // -----------------------------------------------------------------------
    // 4b. Score per region + global (PR-12)
    // -----------------------------------------------------------------------
    const metricsByRegion = new Map<string, RegionalScorerMetricInput[]>();
    for (const r of metricResults) {
      // DEC-6: presentation_only metrics never feed scoring.
      const raw = rawMetrics.find((m) => m.metric_id === r.metric_id);
      if (raw?.presentation_only) continue;
      const list = metricsByRegion.get(r.region) ?? [];
      list.push({
        metricId: r.metric_id,
        region: r.region,
        value: r.value,
        deviationNormalized: r.deviation_normalized,
        confidenceFinal: r.confidence_final,
        presentationOnly: false,
      });
      metricsByRegion.set(r.region, list);
    }

    const regionalResults: RegionalScoreResult[] = [];
    for (const [region, items] of metricsByRegion) {
      const weightsMap = regionWeightsByRegion.get(region) ?? new Map();
      const weights = Array.from(weightsMap.entries()).map(([metricId, weight]) => ({
        metricId,
        weight,
      }));
      const result = this.regionalScorer.score(region, items, weights);
      regionalResults.push(result);
    }

    const globalWeightsArr = Array.from(globalWeightsByRegion.entries()).map(
      ([region, weight]) => ({ region, weight }),
    );
    const globalResult = this.globalScorer.score(
      regionalResults,
      globalWeightsArr,
      criticalRegions,
    );

    const regionalScoresDto: RegionalScoreResultDto[] = regionalResults.map((r) => ({
      region: r.region,
      score_0_100: r.score0to100,
      confidence_aggregate: r.confidenceAggregate,
      contributing_metric_ids: r.contributingMetricIds,
    }));
    const globalScoreDto: GlobalScoreResultDto = {
      score_0_100: globalResult.score0to100,
      is_displayable: globalResult.isDisplayable,
      band: globalResult.band,
      regional_breakdown: globalResult.regionalBreakdown,
    };

    // -----------------------------------------------------------------------
    // 5. Persist in a single transaction
    // -----------------------------------------------------------------------
    let reportId: string;

    await this.dataSource.transaction(async (manager) => {
      // 5a. AnalysisReport
      const report = manager.create(AnalysisReportEntity, {
        sessionId: dto.session_id ?? `auto-${Date.now()}`,
        normalizationBasis: 'intercanthal',
        poseCorrectionApplied: (dto.yaw_deg ?? 0) !== 0 || (dto.pitch_deg ?? 0) !== 0,
        midlineAligned: true,
        qualityScore: dto.quality_context.quality_score,
        metricRegistryVersion: metricRegistryVer,
        idealsVersion: idealsVer,
        thresholdConfigVersion: thresholdVer,
        severityCollapseVersion: collapseVer,
        regionMetricWeightsVersion: regionWeightsVer,
        globalWeightsVersion: globalWeightsVer,
        locale: dto.locale ?? 'pt-BR',
        disclaimerTextSnapshot: DISCLAIMER_TEXT,
        status: 'complete',
        generatedAt,
      });
      const savedReport = await manager.save(AnalysisReportEntity, report);
      reportId = savedReport.id;

      // 5b. LandmarkPayload
      const lp = manager.create(LandmarkPayloadEntity, {
        analysisReportId: reportId,
        analysisReportGeneratedAt: generatedAt,
        rawLandmarks: dto.landmarks.map(([x, y, z]) => ({ x: x ?? 0, y: y ?? 0, z: z ?? 0 })),
        normalizedLandmarks: null,
        normalizationBasis: 'intercanthal',
        captureCount: 1,
      });
      await manager.save(LandmarkPayloadEntity, lp);

      // 5c. MetricEvaluations + MetricEvaluationAgainstIdeals
      for (let i = 0; i < evaluationEntities.length; i++) {
        const eval_ = evaluationEntities[i];
        eval_.analysisReportId = reportId;
        eval_.analysisReportGeneratedAt = generatedAt;
        const savedEval = await manager.save(MetricEvaluationEntity, eval_);

        const against = againstIdealEntities[i];
        if (against) {
          against.metricEvaluationId = savedEval.id;
          against.metricEvaluationGeneratedAt = generatedAt;
          await manager.save(MetricEvaluationAgainstIdealEntity, against);
        }
      }

      // 5d. RegionalScores (PR-12)
      for (const r of regionalResults) {
        const rs = manager.create(RegionalScoreEntity, {
          analysisReportId: reportId,
          analysisReportGeneratedAt: generatedAt,
          region: r.region as RegionalScoreEntity['region'],
          score0to100: r.score0to100,
          confidenceAggregate: r.confidenceAggregate,
          contributingMetricIds: r.contributingMetricIds,
          weightsVersion: regionWeightsVer,
        });
        await manager.save(RegionalScoreEntity, rs);
      }

      // 5e. GlobalScore (PR-12)
      const gs = manager.create(GlobalScoreEntity, {
        analysisReportId: reportId,
        analysisReportGeneratedAt: generatedAt,
        score0to100: globalResult.score0to100,
        isDisplayable: globalResult.isDisplayable,
        band: globalResult.band,
        regionalBreakdown: globalResult.regionalBreakdown,
        globalWeightsVersion: globalWeightsVer,
      });
      await manager.save(GlobalScoreEntity, gs);
    });

    // -----------------------------------------------------------------------
    // 6. Return response
    // -----------------------------------------------------------------------
    return {
      analysis_report_id: reportId!,
      session_id: dto.session_id ?? null,
      generated_at: generatedAt.toISOString(),
      status: 'complete',
      quality_score: dto.quality_context.quality_score,
      metric_count: rawMetrics.length,
      metrics: metricResults,
      /** Alias for frontend (AnalysisResult.metric_evaluations). Same as metrics array. PR-36 M3.2 improvement vectors. */
      metric_evaluations: metricResults,
      /** Raw pixel landmarks from MediaPipe Mesh-478 (PR-31 M3.1 overlays). Each entry [x, y]. */
      landmarks: dto.landmarks.map(([x, y]) => [x, y] as [number, number]),
      regional_scores: regionalScoresDto,
      global_score: globalScoreDto,
      versions: {
        metric_registry_version: metricRegistryVer,
        ideals_version: idealsVer,
        threshold_config_version: thresholdVer,
        severity_collapse_version: collapseVer,
        region_metric_weights_version: regionWeightsVer,
        global_weights_version: globalWeightsVer,
      },
    };
  }
}
