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
} from '@nestjs/common';
import { NarrativeService, NarrativeResponseDto } from './narrative.service.js';

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
}
