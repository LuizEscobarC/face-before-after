import { Module } from '@nestjs/common';
import { DiagnosisService } from './diagnosis.service.js';
import { DiagnosisController } from './diagnosis.controller.js';

@Module({
  controllers: [DiagnosisController],
  providers: [DiagnosisService],
  exports: [DiagnosisService],
})
export class DiagnosisModule {}
