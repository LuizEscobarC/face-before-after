import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { OverlayDefinitionEntity } from './overlay-definition.entity.js';

/**
 * PR-30 — overlay_catalog_version
 *
 * Versioning container for the overlay catalog. Mirrors the design of
 * ``metric_registry_version`` and ``ideals_version``. A new row with a fresh
 * ``version`` and ``is_active=TRUE`` activates a new catalog snapshot;
 * historical reports keep referencing the previous version through the
 * composite FK on ``overlay_definition``.
 */
@Entity({ name: 'overlay_catalog_version' })
export class OverlayCatalogVersionEntity {
  @PrimaryColumn({ name: 'version', type: 'text' })
  version!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Index('uq_overlay_catalog_version_active', { unique: true, where: 'is_active = TRUE' })
  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @OneToMany(() => OverlayDefinitionEntity, (o) => o.catalogVersion)
  overlayDefinitions!: Relation<OverlayDefinitionEntity>[];
}
