/**
 * PR-56 Admin — RecommendationCatalogController
 *
 * Admin API for reading and editing recommendation catalog.
 * Used by the frontend admin page to manage recommendation text and metadata.
 *
 * Endpoints:
 *   GET  /v1/diagnosis/recommendations              — list recommendations (filterable)
 *   GET  /v1/diagnosis/recommendations/categories   — list available categories (for dropdown)
 *   GET  /v1/diagnosis/recommendations/:id          — get single recommendation
 *   PATCH /v1/diagnosis/recommendations/:id         — update recommendation
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
import { RecommendationCatalogService } from './recommendation-catalog.service.js';
import { RecommendationCatalogEntity } from './infrastructure/entities/recommendation-catalog.entity.js';
import type { AnimationConfig, BiometricExerciseConfig } from './domain/types/recommendation.types.js';

@ApiTags('Diagnosis / Recommendations (Admin)')
@Controller('v1/diagnosis/recommendations')
export class RecommendationCatalogController {
  constructor(
    private readonly recommendationCatalogService: RecommendationCatalogService,
  ) {}

  /**
   * GET /v1/diagnosis/recommendations/categories
   * Returns list of recommendation categories for dropdown filter
   */
  @Get('categories')
  @ApiOperation({
    summary: 'List available recommendation categories',
    description: 'Returns distinct categories from recommendation_catalog table for dropdown filtering.',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of categories',
    schema: {
      example: [
        { category: 'photo' },
        { category: 'posture' },
        { category: 'lifestyle' },
        { category: 'styling' },
        { category: 'professional_referral' },
      ],
    },
  })
  async getCategories() {
    return this.recommendationCatalogService.getCategories();
  }

  /**
   * GET /v1/diagnosis/recommendations
   * List recommendations with optional filters
   */
  @Get()
  @ApiOperation({
    summary: 'List recommendations',
    description: 'Returns all recommendations, optionally filtered by category and/or version.',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by recommendation category (e.g., lifestyle, professional_referral)',
  })
  @ApiQuery({
    name: 'version',
    required: false,
    description: 'Filter by catalog version (default: v1.0)',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of recommendations',
    type: [RecommendationCatalogEntity],
  })
  async listRecommendations(
    @Query('category') category?: string,
    @Query('version') version?: string,
  ) {
    return this.recommendationCatalogService.getRecommendations({
      category,
      version,
    });
  }

  /**
   * GET /v1/diagnosis/recommendations/:id
   * Get single recommendation by ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get recommendation by ID',
    description: 'Returns a single recommendation with all metadata and triggers.',
  })
  @ApiParam({
    name: 'id',
    description: 'Recommendation ID (slug)',
  })
  @ApiResponse({
    status: 200,
    description: 'Recommendation',
    type: RecommendationCatalogEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Recommendation not found',
  })
  async getRecommendation(@Param('id') id: string) {
    return this.recommendationCatalogService.getRecommendationById(id);
  }

  /**
   * PATCH /v1/diagnosis/recommendations/:id
   * Update recommendation fields
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update recommendation',
    description: 'Updates display text, category, priority, and metadata for a recommendation.',
  })
  @ApiParam({
    name: 'id',
    description: 'Recommendation ID (slug)',
  })
  @ApiResponse({
    status: 200,
    description: 'Updated recommendation',
    type: RecommendationCatalogEntity,
  })
  @ApiResponse({
    status: 404,
    description: 'Recommendation not found',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request body',
  })
  async updateRecommendation(
    @Param('id') id: string,
    @Body()
    body: {
      displayTextShortPt?: string;
      displayTextLongPt?: string;
      category?: string;
      priorityDefault?: number;
      effortEstimate?: string;
      riskLevel?: number;
      requiresProfessional?: boolean;
      professionalType?: string | null;
      invasivenessLevel?: number;
      evidenceLevel?: string;
      clinicalPathwayRequired?: boolean;
      references?: { citation: string; url?: string }[];
      disclaimerTemplate?: string | null;
      animationConfig?: AnimationConfig | null;
      biometricConfig?: BiometricExerciseConfig | null;
    },
  ) {
    if (!body || Object.keys(body).length === 0) {
      throw new BadRequestException('Request body cannot be empty.');
    }

    return this.recommendationCatalogService.updateRecommendation(id, body);
  }

  /**
   * GET /v1/diagnosis/recommendations/:id/triggers
   * Get triggers for a recommendation (audit/debug endpoint)
   */
  @Get(':id/triggers')
  @ApiOperation({
    summary: 'Get triggers for recommendation',
    description: 'Returns all metric triggers that fire this recommendation.',
  })
  @ApiParam({
    name: 'id',
    description: 'Recommendation ID (slug)',
  })
  @ApiResponse({
    status: 200,
    description: 'Array of triggers',
  })
  async getRecommendationTriggers(@Param('id') id: string) {
    await this.recommendationCatalogService.getRecommendationById(id);
    return this.recommendationCatalogService.getRecommendationTriggers(id);
  }
}
