import { Module } from '@nestjs/common';
import { DiagnosisService } from './diagnosis.service.js';
import { DiagnosisController } from './diagnosis.controller.js';
import { TemplateRendererService } from './template-renderer.service.js';

@Module({
  controllers: [DiagnosisController],
  providers: [DiagnosisService, TemplateRendererService],
  exports: [DiagnosisService, TemplateRendererService],
})
export class DiagnosisModule {}
