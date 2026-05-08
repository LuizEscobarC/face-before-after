/**
 * OverlaysController — exposes overlay rendering endpoints (PR-33, M3.1).
 *
 * Routes:
 *   POST /v1/overlays/:reportId/render
 *   GET  /v1/overlays/:reportId/assets
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsDateString, IsOptional, IsString, IsInt, IsNumber, Min, Max } from 'class-validator';
import { RenderedAssetService } from './overlays.service.js';
import { RenderedAssetEntity } from './infrastructure/entities/rendered-asset.entity.js';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

class RenderRequestDto {
  @IsDateString()
  generatedAt!: string;          // ISO 8601 — partition key of analysis_report

  @IsArray()
  @IsString({ each: true })
  overlayIds!: string[];         // e.g. ["axis_vertical", "grid_thirds"]

  @IsString()
  imageUrl!: string;             // Base photo URL (vision service annotated or original)

  @IsOptional()
  @IsString()
  overlayCatalogVersion?: string; // Defaults to 'v1.0'
}

/** One ideal-landmark offset for the before/ideal composer (PR-42). */
class OffsetItemDto {
  @IsInt()
  @Min(0)
  @Max(477)
  landmark_index!: number;

  @IsNumber()
  dx_icu!: number;

  @IsNumber()
  dy_icu!: number;

  @IsOptional()
  @IsString()
  metric_id?: string;
}

/**
 * PR-42 (M3.4) — request DTO for POST /v1/overlays/:reportId/compose-before-ideal.
 *
 * The caller supplies the generatedAt partition key + imageUrl of the base photo
 * and an optional array of landmark offsets in ICU.  The Nest service loads
 * the landmark payload from DB, calls Python, uploads to MinIO, and persists
 * a RenderedAssetEntity with assetType='before_ideal_composition'.
 *
 * References:
 *  - PLAN_M3_OVERLAYS §2 PR-42, DEC-15, DEC-26
 *  - backend/app/vision/services/before_ideal_composer.py (PR-41)
 */
class ComposeBeforeIdealBodyDto {
  @IsDateString()
  generatedAt!: string;

  @IsString()
  imageUrl!: string;

  @IsOptional()
  @IsArray()
  offsets?: OffsetItemDto[];

  @IsOptional()
  @IsBoolean()
  showGuideLines?: boolean;

  @IsOptional()
  @IsBoolean()
  showActualWireframe?: boolean;

  @IsOptional()
  @IsString()
  overlayCatalogVersion?: string;
}

class RenderedAssetDto {
  id!: string;
  analysisReportId!: string;
  assetType!: string;
  format!: string;
  storageUrl!: string;
  overlayIdsApplied!: string[];
  overlayCatalogVersion!: string | null;
  byteSize!: number | null;
  expiresAt!: string;
  createdAt!: string;

  static from(e: RenderedAssetEntity): RenderedAssetDto {
    const d = new RenderedAssetDto();
    d.id = e.id;
    d.analysisReportId = e.analysisReportId;
    d.assetType = e.assetType;
    d.format = e.format;
    d.storageUrl = e.storageUrl;
    d.overlayIdsApplied = e.overlayIdsApplied;
    d.overlayCatalogVersion = e.overlayCatalogVersion;
    d.byteSize = e.byteSize;
    d.expiresAt = e.expiresAt.toISOString();
    d.createdAt = e.createdAt.toISOString();
    return d;
  }
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@ApiTags('Overlays')
@Controller('v1/overlays')
export class OverlaysController {
  constructor(private readonly renderedAssetService: RenderedAssetService) {}

  /**
   * POST /v1/overlays/:reportId/render
   *
   * Triggers overlay rendering for a given analysis report.
   * Downloads the base image from `imageUrl`, calls Python /vision/render,
   * uploads the result PNG to MinIO, and persists a RenderedAssetEntity row.
   */
  @Post(':reportId/render')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Render facial overlays onto a photo (M3.1)' })
  @ApiParam({ name: 'reportId', description: 'UUID of the analysis_report' })
  @ApiResponse({ status: 201, description: 'Rendered asset persisted' })
  @ApiResponse({ status: 404, description: 'No landmark payload for this report' })
  async render(
    @Param('reportId') reportId: string,
    @Body() body: RenderRequestDto,
  ): Promise<RenderedAssetDto> {
    const generatedAt = new Date(body.generatedAt);
    const asset = await this.renderedAssetService.renderAndPersist(
      reportId,
      generatedAt,
      body.overlayIds,
      body.imageUrl,
      body.overlayCatalogVersion,
    );
    return RenderedAssetDto.from(asset);
  }

  /**
   * GET /v1/overlays/:reportId/assets
   *
   * Returns all non-expired rendered assets for a report.
   * `generatedAt` query param (ISO) required for partition pruning.
   */
  @Get(':reportId/assets')
  @ApiOperation({ summary: 'List rendered assets for an analysis report' })
  @ApiParam({ name: 'reportId', description: 'UUID of the analysis_report' })
  async listAssets(
    @Param('reportId') reportId: string,
    @Body() body: { generatedAt: string },
  ): Promise<RenderedAssetDto[]> {
    const generatedAt = new Date(body.generatedAt ?? new Date().toISOString());
    const assets = await this.renderedAssetService.findByReportId(reportId, generatedAt);
    return assets.map(RenderedAssetDto.from);
  }

  /**
   * POST /v1/overlays/:reportId/compose-before-ideal
   *
   * PR-42 (M3.4) — Generates a before/ideal composition PNG (calling Python
   * /vision/compose-before-ideal), uploads to MinIO, and persists a
   * RenderedAssetEntity with assetType='before_ideal_composition'.
   *
   * Caller supplies imageUrl of the base photo (e.g. annotated URL from the
   * vision service) plus optional ideal-landmark offsets in ICU derived from
   * MetricEvaluationResult.improvement_vector_x/y.
   *
   * References:
   *  - PLAN_M3_OVERLAYS §2 PR-42, DEC-15, DEC-26
   *  - backend/app/vision/services/before_ideal_composer.py (PR-41)
   *  - rendered_asset DDL: migration 1746000160000-M3OverlayCatalog
   */
  @Post(':reportId/compose-before-ideal')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate and persist before/ideal composition (M3.4 PR-42)' })
  @ApiParam({ name: 'reportId', description: 'UUID of the analysis_report' })
  @ApiResponse({ status: 201, description: 'RenderedAssetEntity persisted (assetType=before_ideal_composition)' })
  @ApiResponse({ status: 404, description: 'No landmark payload for this report' })
  async composeBeforeIdeal(
    @Param('reportId') reportId: string,
    @Body() body: ComposeBeforeIdealBodyDto,
  ): Promise<RenderedAssetDto> {
    const generatedAt = new Date(body.generatedAt);
    const asset = await this.renderedAssetService.composeBeforeIdealAndPersist(
      reportId,
      generatedAt,
      body.imageUrl,
      body.offsets ?? [],
      body.showGuideLines ?? true,
      body.showActualWireframe ?? true,
    );
    return RenderedAssetDto.from(asset);
  }
}
