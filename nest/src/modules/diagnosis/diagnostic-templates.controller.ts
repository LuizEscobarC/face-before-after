/**
 * PR-53 — DiagnosticTemplatesController
 *
 * Admin API for reading and editing diagnostic templates.
 * Used by the frontend admin page to manage template text and preview renders.
 *
 * Endpoints:
 *   GET  /v1/diagnosis/templates              — list templates (filterable)
 *   GET  /v1/diagnosis/templates/metrics      — list available metric IDs (for dropdown)
 *   GET  /v1/diagnosis/templates/:id          — get single template
 *   PATCH /v1/diagnosis/templates/:id         — update template_pt
 *
 * NOTE: No authentication in v1. Before production, add @UseGuards(AdminAuthGuard).
 */

import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { DiagnosisService } from './diagnosis.service.js';
import { DiagnosticTemplateEntity } from './infrastructure/entities/diagnostic-template.entity.js';

@ApiTags('Diagnosis / Templates (Admin)')
@Controller('v1/diagnosis/templates')
export class DiagnosticTemplatesController {
  constructor(private readonly diagnosisService: DiagnosisService) {}

  /**
   * GET /v1/diagnosis/templates/metrics
   * Returns list of metric IDs for dropdown filter
   */
  @Get('metrics')
  @ApiOperation({
    summary: 'List available metric IDs',
    description: 'Returns distinct metric IDs from diagnostic_template table for dropdown filtering.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of metric IDs',
    schema: {
      example: [
        { metricId: 'eye_width_left' },
        { metricId: 'eye_width_right' },
        { metricId: 'midline_deviation' },
      ],
    },
  })
  async getMetrics() {
    return this.diagnosisService.getTemplateMetrics();
  }

  /**
   * GET /v1/diagnosis/templates
   * List templates with optional filters
   */
  @Get()
  @ApiOperation({
    summary: 'List templates',
    description: 'Returns all templates, optionally filtered by metricId and/or size.',
  })
  @ApiQuery({
    name: 'metricId',
    required: false,
    description: 'Filter by metric ID (e.g. midline_deviation)',
  })
  @ApiQuery({
    name: 'size',
    required: false,
    enum: ['short', 'medium', 'long'],
    description: 'Filter by template size',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of diagnostic templates',
    type: [DiagnosticTemplateEntity],
  })
  async listTemplates(
    @Query('metricId') metricId?: string,
    @Query('size') size?: string,
  ) {
    const validSizes = ['short', 'medium', 'long'];
    if (size && !validSizes.includes(size)) {
      throw new BadRequestException(`Invalid size. Must be one of: ${validSizes.join(', ')}`);
    }

    return this.diagnosisService.getTemplates({ metricId, size });
  }

  /**
   * GET /v1/diagnosis/templates/:id
   * Get single template by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get template by ID',
    description: 'Returns a single diagnostic template with all metadata.',
  })
  @ApiParam({
    name: 'id',
    description: 'Template UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Diagnostic template',
    type: DiagnosticTemplateEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  async getTemplate(@Param('id') id: string) {
    return this.diagnosisService.getTemplateById(id);
  }

  /**
   * PATCH /v1/diagnosis/templates/:id
   * Update template text
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update template text',
    description: 'Updates the template_pt field for a template. Used by admin editor.',
  })
  @ApiParam({
    name: 'id',
    description: 'Template UUID',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated template',
    type: DiagnosticTemplateEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  async updateTemplate(
    @Param('id') id: string,
    @Body() body: { templatePt: string },
  ) {
    if (!body.templatePt || typeof body.templatePt !== 'string') {
      throw new BadRequestException('Field "templatePt" is required and must be a string.');
    }

    if (body.templatePt.trim().length === 0) {
      throw new BadRequestException('Template text cannot be empty.');
    }

    return this.diagnosisService.updateTemplate(id, body.templatePt);
  }
}
