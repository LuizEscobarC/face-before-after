import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MetricIdealEntity } from '../analysis/infrastructure/entities/metric-ideal.entity.js';
import { GlobalWeightEntity } from '../analysis/infrastructure/entities/global-weight.entity.js';
import { AnalysisThresholdConfigEntity } from '../analysis/infrastructure/entities/analysis-threshold-config.entity.js';
import {
  TemplateBlacklistTermEntity,
  TemplateBlacklistVersionEntity,
} from './entities/template-blacklist.entity.js';

import { AdminMetricIdealService } from './admin-metric-ideal.service.js';
import { AdminMetricIdealController } from './admin-metric-ideal.controller.js';
import { AdminGlobalWeightsService } from './admin-global-weights.service.js';
import { AdminGlobalWeightsController } from './admin-global-weights.controller.js';
import { AdminBlacklistService } from './admin-blacklist.service.js';
import { AdminBlacklistController } from './admin-blacklist.controller.js';
import { AdminThresholdService } from './admin-threshold.service.js';
import { AdminThresholdController } from './admin-threshold.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MetricIdealEntity,
      GlobalWeightEntity,
      AnalysisThresholdConfigEntity,
      TemplateBlacklistTermEntity,
      TemplateBlacklistVersionEntity,
    ]),
  ],
  controllers: [
    AdminMetricIdealController,
    AdminGlobalWeightsController,
    AdminBlacklistController,
    AdminThresholdController,
  ],
  providers: [
    AdminMetricIdealService,
    AdminGlobalWeightsService,
    AdminBlacklistService,
    AdminThresholdService,
  ],
})
export class AdminModule {}
