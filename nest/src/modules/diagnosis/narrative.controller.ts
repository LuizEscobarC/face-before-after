/**
 * PR-59 — NarrativeController
 *
 * Maps ``GET /v1/analysis/:id/narrative`` to ``NarrativeService``.
 *
 * Placed in ``DiagnosisModule`` (same module as ``NarrativeService``,
 * ``TemplateRendererService``, and ``RecommendationEngine``) with a
 * path prefix that matches the analysis route namespace so the endpoint
 * appears alongside ``/v1/analysis/:id``.
 */
import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { NarrativeService, NarrativeResponseDto, NarrativeFindingDto } from './narrative.service.js';

@Controller('v1/analysis')
export class NarrativeController {
  constructor(private readonly narrativeService: NarrativeService) {}

  /**
   * Returns the assembled narrative for a completed analysis report.
   * @param id Analysis report UUID
   */
  @Get(':id/narrative')
  async getNarrative(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<NarrativeResponseDto> {
    return this.narrativeService.narrativeForReport(id);
  }

  /**
   * Paginated findings (PR-66). Returns ALL non-ideal findings sorted by
   * severity weight desc; supports ``?limit`` (default 50, max 200) and
   * ``?minSeverity`` (default ``mild`` — accepts ``ideal|minimal|mild|
   * moderate|strong|extreme``).
   */
  @Get(':id/findings')
  async getFindings(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('minSeverity') minSeverity?: string,
  ): Promise<NarrativeFindingDto[]> {
    return this.narrativeService.getAllFindings(id, {
      limit: limit ? Number(limit) : undefined,
      minSeverity: minSeverity ?? undefined,
    });
  }

  /**
   * Paginated recommendations (PR-66). Returns persisted
   * ``recommendation_link`` rows joined with ``recommendation_catalog``
   * (full long-form copy + invasiveness + priority). Supports ``?limit``
   * (default 20, max 100) and ``?category``.
   */
  @Get(':id/recommendations')
  async getRecommendations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
  ) {
    return this.narrativeService.getRecommendations(id, {
      limit: limit ? Number(limit) : undefined,
      category: category ?? undefined,
    });
  }
}
