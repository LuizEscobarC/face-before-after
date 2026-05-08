import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VisionModule } from '#modules/vision/vision.module.js';
import { PhotoQualityModule } from '#modules/photo-quality/photo-quality.module.js';
import { AnalysisController } from './analysis.controller.js';
import { AnalysisService } from './analysis.service.js';
import { MetricRegistryVersionEntity } from './infrastructure/entities/metric-registry-version.entity.js';
import { MetricDefinitionEntity } from './infrastructure/entities/metric-definition.entity.js';
import { IdealsVersionEntity } from './infrastructure/entities/ideals-version.entity.js';
import { MetricIdealEntity } from './infrastructure/entities/metric-ideal.entity.js';
import { AnalysisThresholdConfigEntity } from './infrastructure/entities/analysis-threshold-config.entity.js';
import { SeverityCollapsePolicyEntity } from './infrastructure/entities/severity-collapse-policy.entity.js';

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
    ]),
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
