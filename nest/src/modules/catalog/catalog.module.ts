/**
 * CatalogModule — serves GET /v1/catalog/* endpoints.
 *
 * Imports the same entity repositories already used by AnalysisModule.
 * No new migrations required — all entities exist from M1/M2 work.
 *
 * Entities registered (read-only consumers):
 *   - MetricDefinitionEntity    (metric_definition, 66 rows)
 *   - MetricIdealEntity         (metric_ideal, 59 rows)
 *   - MetricRegistryVersionEntity
 *   - IdealsVersionEntity
 *   - AnalysisThresholdConfigEntity
 *   - SeverityCollapsePolicyEntity
 *   - RegionMetricWeightsVersionEntity
 *   - GlobalWeightsVersionEntity
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetricDefinitionEntity } from '../analysis/infrastructure/entities/metric-definition.entity.js';
import { MetricIdealEntity } from '../analysis/infrastructure/entities/metric-ideal.entity.js';
import { MetricRegistryVersionEntity } from '../analysis/infrastructure/entities/metric-registry-version.entity.js';
import { IdealsVersionEntity } from '../analysis/infrastructure/entities/ideals-version.entity.js';
import { AnalysisThresholdConfigEntity } from '../analysis/infrastructure/entities/analysis-threshold-config.entity.js';
import { SeverityCollapsePolicyEntity } from '../analysis/infrastructure/entities/severity-collapse-policy.entity.js';
import { RegionMetricWeightsVersionEntity } from '../analysis/infrastructure/entities/region-metric-weights-version.entity.js';
import { GlobalWeightsVersionEntity } from '../analysis/infrastructure/entities/global-weights-version.entity.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MetricDefinitionEntity,
      MetricIdealEntity,
      MetricRegistryVersionEntity,
      IdealsVersionEntity,
      AnalysisThresholdConfigEntity,
      SeverityCollapsePolicyEntity,
      RegionMetricWeightsVersionEntity,
      GlobalWeightsVersionEntity,
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
