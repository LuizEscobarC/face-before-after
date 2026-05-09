import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VisionModule } from '../vision/vision.module.js';
import { OverlaysModule } from '../overlays/overlays.module.js';

import { DiagnosisService } from './diagnosis.service.js';
import { DiagnosisController } from './diagnosis.controller.js';
import { TemplateRendererService } from './template-renderer.service.js';
import { RecommendationEngine } from './recommendation-engine.service.js';
import { DiagnosticPriorityService } from './diagnostic-priority.service.js';
import { NarrativeService } from './narrative.service.js';
import { NarrativeController } from './narrative.controller.js';
import { PdfService } from './pdf.service.js';
import { PdfController } from './pdf.controller.js';
import { RunPdfController } from './run-pdf.controller.js';

import { DiagnosticTemplateEntity } from './infrastructure/entities/diagnostic-template.entity.js';
import { RecommendationCatalogVersionEntity } from './infrastructure/entities/recommendation-catalog-version.entity.js';
import { RecommendationCatalogEntity } from './infrastructure/entities/recommendation-catalog.entity.js';
import { RecommendationTriggerEntity } from './infrastructure/entities/recommendation-trigger.entity.js';
import { RecommendationLinkEntity } from './infrastructure/entities/recommendation-link.entity.js';

// Cross-module: needed by RecommendationEngine, NarrativeService, PdfService
import { MetricEvaluationAgainstIdealEntity } from '../analysis/infrastructure/entities/metric-evaluation-against-ideal.entity.js';
import { MetricEvaluationEntity } from '../analysis/infrastructure/entities/metric-evaluation.entity.js';
import { AnalysisReportEntity } from '../analysis/infrastructure/entities/analysis-report.entity.js';
import { GlobalScoreEntity } from '../analysis/infrastructure/entities/global-score.entity.js';

@Module({
  imports: [
    VisionModule,   // exports VisionClient (used by PdfService)
    OverlaysModule, // exports MinioStorageService + RenderedAssetEntity (used by PdfService)
    TypeOrmModule.forFeature([
      DiagnosticTemplateEntity,
      RecommendationCatalogVersionEntity,
      RecommendationCatalogEntity,
      RecommendationTriggerEntity,
      RecommendationLinkEntity,
      // Cross-module entities required by RecommendationEngine + NarrativeService + PdfService
      MetricEvaluationAgainstIdealEntity,
      MetricEvaluationEntity,
      AnalysisReportEntity,
      GlobalScoreEntity,
    ]),
  ],
  controllers: [DiagnosisController, NarrativeController, PdfController, RunPdfController],
  providers: [
    DiagnosisService,
    TemplateRendererService,
    RecommendationEngine,
    DiagnosticPriorityService,
    NarrativeService,
    PdfService,
  ],
  exports: [
    TypeOrmModule,
    DiagnosisService,
    TemplateRendererService,
    RecommendationEngine,
    DiagnosticPriorityService,
    NarrativeService,
    PdfService,
  ],
})
export class DiagnosisModule {}
