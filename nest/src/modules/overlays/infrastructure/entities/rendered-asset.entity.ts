import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AnalysisReportEntity } from '../../../analysis/infrastructure/entities/analysis-report.entity.js';
import { OverlayCatalogVersionEntity } from './overlay-catalog-version.entity.js';
import {
  RENDERED_ASSET_FORMATS,
  RENDERED_ASSET_TYPES,
  type RenderedAssetFormat,
  type RenderedAssetType,
} from '../../domain/types/overlay.types.js';

/**
 * PR-30 — rendered_asset
 *
 * Registry of every server-side render. NOT partitioned (mirrors
 * ``landmark_payload``); composite FK ``(analysis_report_id,
 * analysis_report_generated_at)`` reaches the partitioned PK of
 * ``analysis_report``.
 *
 * Retention is owner-driven (see PLAN_M3_OVERLAYS DEC-24): the rendering
 * service decides whether to set ``expires_at = NOW() + 7d`` (default) or
 * ``+ 30d`` (opt-in). A nightly CRON flips ``is_expired=TRUE`` and the
 * MinIO object is GC-ed.
 *
 * The composite ``overlay_ids_applied`` (JSONB array) plus
 * ``overlay_catalog_version`` snapshot allows reproducing exactly which
 * overlays were drawn — important for audit and for re-rendering after
 * catalog upgrades.
 */
@Entity({ name: 'rendered_asset' })
@Index('idx_rendered_asset_report', ['analysisReportId'])
@Index('idx_rendered_asset_type', ['assetType'])
export class RenderedAssetEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'analysis_report_id', type: 'uuid' })
  analysisReportId!: string;

  @Column({ name: 'analysis_report_generated_at', type: 'timestamptz' })
  analysisReportGeneratedAt!: Date;

  @ManyToOne(() => AnalysisReportEntity, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'analysis_report_id', referencedColumnName: 'id' },
    { name: 'analysis_report_generated_at', referencedColumnName: 'generatedAt' },
  ])
  analysisReport!: Relation<AnalysisReportEntity>;

  @Column({
    name: 'asset_type',
    type: 'enum',
    enum: RENDERED_ASSET_TYPES,
    enumName: 'rendered_asset_type_enum',
  })
  assetType!: RenderedAssetType;

  @Column({ name: 'region', type: 'text', nullable: true })
  region!: string | null;

  @Column({ name: 'overlay_ids_applied', type: 'jsonb', default: () => "'[]'::jsonb" })
  overlayIdsApplied!: string[];

  @Column({ name: 'overlay_catalog_version', type: 'text', nullable: true })
  overlayCatalogVersion!: string | null;

  @ManyToOne(() => OverlayCatalogVersionEntity, { nullable: true })
  @JoinColumn({
    name: 'overlay_catalog_version',
    referencedColumnName: 'version',
  })
  overlayCatalogVersionRef!: Relation<OverlayCatalogVersionEntity> | null;

  @Column({
    name: 'format',
    type: 'enum',
    enum: RENDERED_ASSET_FORMATS,
    enumName: 'rendered_asset_format_enum',
  })
  format!: RenderedAssetFormat;

  @Column({ name: 'storage_url', type: 'text' })
  storageUrl!: string;

  @Column({ name: 'dimensions', type: 'jsonb', nullable: true })
  dimensions!: { width: number; height: number } | null;

  @Column({ name: 'byte_size', type: 'bigint', nullable: true, transformer: {
    to: (v: number | null) => v,
    from: (v: string | null) => (v === null ? null : parseInt(v, 10)),
  } })
  byteSize!: number | null;

  @Column({ name: 'generated_at', type: 'timestamptz', default: () => 'NOW()' })
  generatedAt!: Date;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'is_expired', type: 'boolean', default: false })
  isExpired!: boolean;

  @Column({ name: 'processing_notes', type: 'jsonb', nullable: true })
  processingNotes!: Record<string, unknown> | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
