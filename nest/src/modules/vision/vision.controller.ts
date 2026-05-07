import { Body, Controller, Get, Param, Post, Res, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { VisionClient } from './vision.client.js';
import {
  CaptureGuidelinesDto,
  CompareRequestDto,
  FullPipelineRequestDto,
  FullPipelineResponseDto,
  LandmarkRequestDto,
  LandmarkResponseDto,
  MetricsRequestDto,
  MetricsResponseDto,
} from './dto/vision.dto.js';

@ApiTags('Vision')
@Controller('v1/vision')
export class VisionController {
  constructor(private readonly client: VisionClient) {}

  @Get('capture-guidelines')
  @ApiOperation({ summary: 'Diretrizes para captura ideal da foto' })
  @ApiResponse({ status: 200, type: CaptureGuidelinesDto })
  guidelines(): Promise<CaptureGuidelinesDto> {
    return this.client.captureGuidelines();
  }

  @Post('landmarks')
  @HttpCode(200)
  @ApiOperation({ summary: 'Extrai landmarks + qualidade (fallback server-side)' })
  @ApiResponse({ status: 200, type: LandmarkResponseDto })
  landmarks(@Body() body: LandmarkRequestDto): Promise<LandmarkResponseDto> {
    return this.client.landmarks(body);
  }

  @Post('metrics')
  @HttpCode(200)
  @ApiOperation({ summary: 'Calcula métricas a partir de landmarks' })
  @ApiResponse({ status: 200, type: MetricsResponseDto })
  metrics(@Body() body: MetricsRequestDto): Promise<MetricsResponseDto> {
    return this.client.metrics(body);
  }

  @Post('full-pipeline')
  @HttpCode(200)
  @ApiOperation({ summary: 'Roda o pipeline completo (premium ou teaser)' })
  @ApiResponse({ status: 200, type: FullPipelineResponseDto })
  fullPipeline(@Body() body: FullPipelineRequestDto): Promise<FullPipelineResponseDto> {
    return this.client.fullPipeline(body);
  }

  @Post('compare')
  @HttpCode(200)
  @ApiOperation({ summary: 'Compara dois runs antes/depois' })
  @ApiResponse({ status: 200 })
  compare(@Body() body: CompareRequestDto): Promise<Record<string, unknown>> {
    return this.client.compare(body);
  }

  @Get('results/:runId/annotated')
  @ApiOperation({ summary: 'Imagem anotada com landmarks' })
  async annotated(
    @Param('runId') runId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const file = await this.client.fetchAnnotated(runId);
    void reply.header('Content-Type', file.contentType).send(file.data);
  }

  @Get('results/:runId/simulation/:simType')
  @ApiOperation({ summary: 'Simulação visual (symmetrized | ideal_proportions | comparison_grid)' })
  async simulation(
    @Param('runId') runId: string,
    @Param('simType') simType: 'symmetrized' | 'ideal_proportions' | 'comparison_grid',
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const file = await this.client.fetchSimulation(runId, simType);
    void reply.header('Content-Type', file.contentType).send(file.data);
  }
}
