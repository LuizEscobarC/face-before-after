/**
 * PR-30 — OverlaysModule
 *
 * Registers the four overlay catalog entities so `autoLoadEntities` picks
 * them up at runtime. No services or controllers yet — read API arrives
 * with PR-31..33 (frontend SVG layer + Python render endpoint + Nest
 * RenderedAssetService) per PLAN_M3_OVERLAYS §2.
 */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { OverlayCatalogVersionEntity } from './infrastructure/entities/overlay-catalog-version.entity.js';
import { OverlayDefinitionEntity } from './infrastructure/entities/overlay-definition.entity.js';
import { OverlayMetricDependencyEntity } from './infrastructure/entities/overlay-metric-dependency.entity.js';
import { RenderedAssetEntity } from './infrastructure/entities/rendered-asset.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OverlayCatalogVersionEntity,
      OverlayDefinitionEntity,
      OverlayMetricDependencyEntity,
      RenderedAssetEntity,
    ]),
  ],
  exports: [TypeOrmModule],
})
export class OverlaysModule {}
