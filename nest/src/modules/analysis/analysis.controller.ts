import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalysisService, AnalysisResultDto } from './analysis.service.js';
import { AnalyzePhotoDto, CompareRunsDto, CompareWithConsistencyDto } from './dto/analysis.dto.js';
import { AnalysisOrchestratorService } from './domain/orchestrator.service.js';
import { ReportReaderService } from './domain/report-reader.service.js';
import { EvaluateRequestDto, EvaluateResponseDto } from './dto/evaluate.dto.js';
import { GetReportByIdParams, ListReportsBySessionQuery } from './dto/get-report.dto.js';

@ApiTags('Analysis')
@Controller('v1/analysis')
export class AnalysisController {
  constructor(
    private readonly service: AnalysisService,
    private readonly orchestrator: AnalysisOrchestratorService,
    private readonly reportReader: ReportReaderService,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Roda gatekeeper Module 0 + full-pipeline e devolve resultado',
  })
  @ApiResponse({ status: 200 })
  analyze(@Body() body: AnalyzePhotoDto): Promise<AnalysisResultDto> {
    return this.service.analyze(body);
  }

  @Post('compare')
  @HttpCode(200)
  @ApiOperation({ summary: 'Compara dois runs antes/depois com ConsistencyScore' })
  @ApiResponse({ status: 200, type: CompareWithConsistencyDto })
  compare(@Body() body: CompareRunsDto): Promise<CompareWithConsistencyDto> {
    return this.service.compare(body) as unknown as Promise<CompareWithConsistencyDto>;
  }

  @Post('evaluate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'M1: submits landmarks → computes metrics → persists AnalysisReport',
    description:
      'Accepts pre-computed MediaPipe landmarks from the client. ' +
      'Calls Python /vision/metrics-v2, compares each metric against configured ideals, ' +
      'classifies severity (5-level + 3-level collapse), and returns the full AnalysisReport.',
  })
  @ApiResponse({ status: 200 })
  evaluate(@Body() body: EvaluateRequestDto): Promise<EvaluateResponseDto> {
    return this.orchestrator.evaluate(body);
  }

  // ---------------------------------------------------------------------------
  // PR-24: Report retrieval
  // ---------------------------------------------------------------------------

  @Get('reports')
  @HttpCode(200)
  @ApiOperation({
    summary: 'List AnalysisReports for a session_id (newest first)',
    description:
      'Returns up to `limit` reports (default 10, max 50) for the given session_id, ' +
      'ordered by generated_at DESC. Each item has the same shape as POST /evaluate response.',
  })
  @ApiResponse({ status: 200 })
  listReportsBySession(
    @Query() query: ListReportsBySessionQuery,
  ): Promise<EvaluateResponseDto[]> {
    return this.reportReader.listBySession(query.session_id, query.limit ?? 10);
  }

  @Get('reports/:id')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Retrieve a single AnalysisReport by UUID',
    description:
      'Returns the full AnalysisReport aggregate — same shape as POST /evaluate response. ' +
      'Loads metric evaluations, regional scores, and global score from DB.',
  })
  @ApiResponse({ status: 200 })
  @ApiNotFoundResponse({ description: 'AnalysisReport not found' })
  getReportById(@Param() params: GetReportByIdParams): Promise<EvaluateResponseDto> {
    return this.reportReader.getReportById(params.id);
  }
}
