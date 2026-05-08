import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisionModule } from '#modules/vision/vision.module.js';
import { PhotoQualityModule } from '#modules/photo-quality/photo-quality.module.js';
import { AnalysisController } from './analysis.controller.js';
import { AnalysisService } from './analysis.service.js';
import { IdealComparator } from './domain/ideal-comparator.js';
import { SeverityClassifier } from './domain/severity-classifier.js';
import { AnalysisOrchestratorService } from './domain/orchestrator.service.js';
import { RegionalScorer } from './domain/regional-scorer.js';
import { GlobalScorer } from './domain/global-scorer.js';
import { ScoreBander } from './domain/score-bander.js';
import { MetricRegistryVersionEntity } from './infrastructure/entities/metric-registry-version.entity.js';
import { MetricDefinitionEntity } from './infrastructure/entities/metric-definition.entity.js';
import { IdealsVersionEntity } from './infrastructure/entities/ideals-version.entity.js';
import { MetricIdealEntity } from './infrastructure/entities/metric-ideal.entity.js';
import { AnalysisThresholdConfigEntity } from './infrastructure/entities/analysis-threshold-config.entity.js';
import { SeverityCollapsePolicyEntity } from './infrastructure/entities/severity-collapse-policy.entity.js';
import { AnalysisReportEntity } from './infrastructure/entities/analysis-report.entity.js';
import { LandmarkPayloadEntity } from './infrastructure/entities/landmark-payload.entity.js';
import { MetricEvaluationEntity } from './infrastructure/entities/metric-evaluation.entity.js';
import { MetricEvaluationAgainstIdealEntity } from './infrastructure/entities/metric-evaluation-against-ideal.entity.js';
import { RegionMetricWeightsVersionEntity } from './infrastructure/entities/region-metric-weights-version.entity.js';
import { RegionMetricWeightEntity } from './infrastructure/entities/region-metric-weight.entity.js';
import { GlobalWeightsVersionEntity } from './infrastructure/entities/global-weights-version.entity.js';
import { GlobalWeightEntity } from './infrastructure/entities/global-weight.entity.js';
import { RegionalScoreEntity } from './infrastructure/entities/regional-score.entity.js';
import { GlobalScoreEntity } from './infrastructure/entities/global-score.entity.js';
import { ReportReaderService } from './domain/report-reader.service.js';

@Module({
  imports: [
    VisionModule,
    PhotoQualityModule,
    TypeOrmModule.forFeature([
      MetricRegistryVersionEntity,
      MetricDefinitionEntity,
      IdealsVersionEntity,
      MetricIdealEntity,
      AnalysisThresholdConfigEntity,
      SeverityCollapsePolicyEntity,
      AnalysisReportEntity,
      LandmarkPayloadEntity,
      MetricEvaluationEntity,
      MetricEvaluationAgainstIdealEntity,
      RegionMetricWeightsVersionEntity,
      RegionMetricWeightEntity,
      GlobalWeightsVersionEntity,
      GlobalWeightEntity,
      RegionalScoreEntity,
      GlobalScoreEntity,
    ]),
  ],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    IdealComparator,
    SeverityClassifier,
    RegionalScorer,
    GlobalScorer,
    ScoreBander,
    AnalysisOrchestratorService,
    ReportReaderService,
  ],
  exports: [
    IdealComparator,
    SeverityClassifier,
    RegionalScorer,
    GlobalScorer,
    ScoreBander,
    AnalysisOrchestratorService,
  ],
})
export class AnalysisModule {}
