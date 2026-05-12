import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DiagnosisService } from './diagnosis.service.js';
import { DiagnosisReportDto } from './dto/diagnosis.dto.js';

@ApiTags('Diagnosis')
@Controller('v1/diagnosis')
export class DiagnosisController {
  constructor(private readonly diagnosisService: DiagnosisService) {}

  @Get(':runId')
  @ApiOperation({ summary: 'Retorna o relatório de diagnóstico para um run_id' })
  @ApiParam({ name: 'runId', description: 'ID do run de análise' })
  @ApiResponse({ status: 200, type: DiagnosisReportDto })
  @ApiResponse({ status: 404, description: 'Diagnóstico não encontrado' })
  getReport(@Param('runId') runId: string): Promise<DiagnosisReportDto> {
    return this.diagnosisService.getReport(runId);
  }
}
