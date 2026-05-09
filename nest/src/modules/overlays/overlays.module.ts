/**
 * PR-30 — OverlaysModule (updated PR-33)
 *
 * PR-30: Registers overlay catalog entities.
 * PR-33: Adds RenderedAssetService + OverlaysController + MinioStorageService.
 *
 * LandmarkPayloadEntity is registered here (cross-module entity access) to
 * allow RenderedAssetService to load raw pixel landmarks per analysis report.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OverlayCatalogVersionEntity } from './infrastructure/entities/overlay-catalog-version.entity.js';
import { OverlayDefinitionEntity } from './infrastructure/entities/overlay-definition.entity.js';
import { OverlayMetricDependencyEntity } from './infrastructure/entities/overlay-metric-dependency.entity.js';
import { RenderedAssetEntity } from './infrastructure/entities/rendered-asset.entity.js';
import { LandmarkPayloadEntity } from '../analysis/infrastructure/entities/landmark-payload.entity.js';
import { MinioStorageService } from './infrastructure/services/minio-storage.service.js';
import { RenderedAssetService } from './overlays.service.js';
import { OverlaysController } from './overlays.controller.js';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      OverlayCatalogVersionEntity,
      OverlayDefinitionEntity,
      OverlayMetricDependencyEntity,
      RenderedAssetEntity,
      // Cross-module: load landmarks for render pipeline (RenderedAssetService)
      LandmarkPayloadEntity,
    ]),
  ],
  controllers: [OverlaysController],
  providers: [MinioStorageService, RenderedAssetService],
  exports: [TypeOrmModule, RenderedAssetService, MinioStorageService],
})
export class OverlaysModule {}
