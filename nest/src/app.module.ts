import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from './shared/config/logger.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { VisionModule } from './modules/vision/vision.module.js';
import { PhotoQualityModule } from './modules/photo-quality/photo-quality.module.js';
import { AnalysisModule } from './modules/analysis/analysis.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { DiagnosisModule } from './modules/diagnosis/diagnosis.module.js';
import { DecisionModule } from './modules/decision/decision.module.js';
import { ExecutionModule } from './modules/execution/execution.module.js';
import { TrackingModule } from './modules/tracking/tracking.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';

@Module({
  imports: [
    EventEmitterModule.forRoot({ wildcard: true }),
    LoggerModule,
    DatabaseModule,
    HealthModule,
    VisionModule,
    PhotoQualityModule,
    AnalysisModule,
    CatalogModule,
    DiagnosisModule,
    DecisionModule,
    ExecutionModule,
    TrackingModule,
    IdentityModule,
  ],
})
export class AppModule {}
