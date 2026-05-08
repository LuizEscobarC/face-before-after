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
import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';
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
}
