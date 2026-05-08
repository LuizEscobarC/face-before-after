import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { OverlayCatalogVersionEntity } from './overlay-catalog-version.entity.js';
import { OverlayMetricDependencyEntity } from './overlay-metric-dependency.entity.js';
import type {
  LocalizedText,
} from '../../../analysis/domain/types/catalog.types.js';
import type {
  OverlayCategory,
  RenderingHints,
} from '../../domain/types/overlay.types.js';
import { OVERLAY_CATEGORIES } from '../../domain/types/overlay.types.js';

/**
 * PR-30 — overlay_definition
 *
 * Catalog of overlay specifications. Composite PK ``(overlay_id, version)``
 * matches ``metric_definition`` so historical analyses can keep referring
 * to the exact overlay snapshot they were rendered with.
 */
@Entity({ name: 'overlay_definition' })
@Index('idx_overlay_definition_version', ['version'])
@Index('idx_overlay_definition_category', ['category'])
export class OverlayDefinitionEntity {
  @PrimaryColumn({ name: 'overlay_id', type: 'text' })
  overlayId!: string;

  @PrimaryColumn({ name: 'version', type: 'text' })
  version!: string;

  @ManyToOne(() => OverlayCatalogVersionEntity, (v) => v.overlayDefinitions)
  @JoinColumn({ name: 'version', referencedColumnName: 'version' })
  catalogVersion!: Relation<OverlayCatalogVersionEntity>;

  @Column({ name: 'display_name', type: 'jsonb', default: () => "'{}'::jsonb" })
  displayName!: LocalizedText;

  @Column({ name: 'description', type: 'jsonb', default: () => "'{}'::jsonb" })
  description!: LocalizedText;

  @Column({
    name: 'category',
    type: 'enum',
    enum: OVERLAY_CATEGORIES,
    enumName: 'overlay_category_enum',
  })
  category!: OverlayCategory;

  @Column({ name: 'default_visible', type: 'boolean', default: true })
  defaultVisible!: boolean;

  @Column({ name: 'z_order', type: 'int', default: 10 })
  zOrder!: number;

  @Column({ name: 'legend_text', type: 'jsonb', default: () => "'{}'::jsonb" })
  legendText!: LocalizedText;

  @Column({ name: 'is_decorative', type: 'boolean', default: false })
  isDecorative!: boolean;

  @Column({ name: 'rendering_hints', type: 'jsonb', default: () => "'{}'::jsonb" })
  renderingHints!: RenderingHints;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @OneToMany(() => OverlayMetricDependencyEntity, (d) => d.overlay)
  dependencies!: Relation<OverlayMetricDependencyEntity>[];
}
