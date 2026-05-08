import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AnalysisService, AnalysisResultDto } from './analysis.service.js';
import { AnalyzePhotoDto, CompareRunsDto, CompareWithConsistencyDto } from './dto/analysis.dto.js';

@ApiTags('Analysis')
@Controller('v1/analysis')
export class AnalysisController {
  constructor(private readonly service: AnalysisService) {}

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
}
