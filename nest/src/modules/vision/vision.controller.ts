import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { VisionClient } from './vision.client.js';
import {
  CaptureGuidelinesDto,
  CompareRequestDto,
  ComposeBeforeIdealRequestDto,
  FullPipelineRequestDto,
  FullPipelineResponseDto,
  LandmarkRequestDto,
  LandmarkResponseDto,
  MetricsRequestDto,
  MetricsResponseDto,
  RenderOverlayRequestDto,
} from './dto/vision.dto.js';
import { ClientLandmarkPayloadDto } from './dto/client-landmark-payload.dto.js';

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

  @Post('submit-landmarks')
  @HttpCode(200)
  @ApiOperation({ summary: 'Recebe landmarks processados pelo cliente e calcula métricas' })
  @ApiResponse({ status: 200, type: MetricsResponseDto })
  submitLandmarks(@Body() body: ClientLandmarkPayloadDto): Promise<MetricsResponseDto> {
    return this.client.submitLandmarks(body);
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

  @Get('results/:runId/original')
  @ApiOperation({ summary: 'Foto original sem anotações' })
  async original(
    @Param('runId') runId: string,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const file = await this.client.fetchOriginal(runId);
    void reply.header('Content-Type', file.contentType).send(file.data);
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
    @Param('simType') simType: 'canonical' | 'symmetrized' | 'ideal_proportions' | 'comparison_grid',
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const file = await this.client.fetchSimulation(runId, simType);
    void reply.header('Content-Type', file.contentType).send(file.data);
  }

  /**
   * POST /v1/vision/compose-before-ideal
   *
   * Stateless before/ideal composition proxy (PR-42, M3.4).
   * Fetches the annotated photo by runId, posts multipart to Python
   * /vision/compose-before-ideal, and streams the resulting double-width
   * RGBA PNG back to the caller.
   *
   * Left pane = byte-identical original photo (no-warp per DEC-15).
   * Right pane = photo + actual wireframe (gray, optional) + ideal wireframe
   *   (cyan #22d3ee dashed 4/2, DEC-26) + guide lines (optional).
   *
   * References:
   *  - backend/app/vision/services/before_ideal_composer.py (PR-41)
   *  - PLAN_M3_OVERLAYS §2 PR-42, DEC-15, DEC-26
   *  - Pillow ImageDraw: https://pillow.readthedocs.io/en/stable/reference/ImageDraw.html
   *  - MediaPipe Mesh-478: https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md
   */
  @Post('compose-before-ideal')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Composição before/ideal side-by-side PNG (DEC-15 no-warp, PR-42 M3.4)' })
  @ApiResponse({ status: 200, description: 'Double-width PNG (left=original, right=ideal wireframe overlay)' })
  async composeBeforeIdeal(
    @Body() body: ComposeBeforeIdealRequestDto,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const file = await this.client.composeBeforeIdeal(
      body.runId,
      body.landmarks,
      body.offsets ?? [],
      body.showGuideLines ?? true,
      body.showActualWireframe ?? true,
    );
    void reply.header('Content-Type', 'image/png').send(file.data);
  }

  /**
   * POST /v1/vision/render-overlay
   *
   * PR-66 (M3.3) — Stateless overlay render streaming proxy.
   * Fetches the original photo by runId, posts multipart to Python
   * /vision/render with the requested overlay IDs, and streams the
   * resulting PNG back to the caller (no MinIO persistence).
   *
   * Supports all v1.0 overlay IDs including heatmap_asymmetry.
   * heatmap_ideal_adherence additionally requires regionAdherence in the body.
   *
   * References:
   *  - backend/app/vision/routers/render.py (PR-32 + PR-37/38, M3.1+M3.3)
   *  - PLAN_M3_OVERLAYS §2 PR-40 follow-up (heatmap wiring)
   *  - MediaPipe Mesh-478: https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md
   */
  @Post('render-overlay')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stateless overlay render — streams PNG (PR-66 M3.3)' })
  @ApiResponse({ status: 200, description: 'PNG with requested overlays drawn on original photo' })
  @ApiResponse({ status: 422, description: 'Heatmap suppressed (insufficient samples) or invalid input' })
  async renderOverlay(
    @Body() body: RenderOverlayRequestDto,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    const file = await this.client.renderOverlay(
      body.runId,
      body.landmarks,
      body.overlayIds,
      body.regionAdherence,
    );
    void reply.header('Content-Type', 'image/png').send(file.data);
  }
}
