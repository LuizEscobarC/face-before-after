import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { RecommendationCatalogEntity } from './recommendation-catalog.entity.js';

/**
 * PR-55 — recommendation_catalog_version
 *
 * Versioning container for the recommendation catalog. Mirrors the pattern of
 * `diagnostic_template_version`, `overlay_catalog_version`, and
 * `metric_registry_version`.
 *
 * Only one row may have `is_active=TRUE` at a time, enforced by the partial
 * unique index `ux_rec_catalog_version_active` (created by migration
 * `1746000200000-M43RecommendationCatalog.ts`).
 */
@Entity({ name: 'recommendation_catalog_version' })
export class RecommendationCatalogVersionEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'version', type: 'text', unique: true })
  version!: string;

  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes!: string | null;

  @OneToMany(
    () => RecommendationCatalogEntity,
    (catalog) => catalog.catalogVersion,
  )
  catalogItems!: Relation<RecommendationCatalogEntity[]>;
}
