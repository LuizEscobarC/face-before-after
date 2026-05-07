import { Module } from '@nestjs/common';
import { VisionModule } from '#modules/vision/vision.module.js';
import { PhotoQualityModule } from '#modules/photo-quality/photo-quality.module.js';
import { AnalysisController } from './analysis.controller.js';
import { AnalysisService } from './analysis.service.js';

@Module({
  imports: [VisionModule, PhotoQualityModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
})
export class AnalysisModule {}
