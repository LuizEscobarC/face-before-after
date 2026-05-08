import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { RegionMetricWeightEntity } from './region-metric-weight.entity.js';

/**
 * Versioned container for region_metric_weight rows.
 * Same pattern as IdealsVersionEntity / MetricRegistryVersionEntity.
 *
 * Exactly one row may have is_active = TRUE at a time (partial unique idx).
 */
@Entity({ name: 'region_metric_weights_version' })
export class RegionMetricWeightsVersionEntity {
  @PrimaryColumn({ name: 'version', type: 'text' })
  version!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Index('uq_region_weights_version_active', { unique: true, where: 'is_active = TRUE' })
  @Column({ name: 'is_active', type: 'boolean', default: false })
  isActive!: boolean;

  /**
   * TRUE when this version is a candidate awaiting empirical validation
   * (PR-22 real-photo calibration). Production runtime selection uses
   * is_active=TRUE; is_provisional is documentation/UX only and does
   * NOT affect the orchestrator's version lookup.
   *
   * Added in migration 1746000150000-RebalanceWeightsV15 (PR-21).
   */
  @Column({ name: 'is_provisional', type: 'boolean', default: false })
  isProvisional!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @OneToMany(() => RegionMetricWeightEntity, (w) => w.versionRef)
  weights!: Relation<RegionMetricWeightEntity>[];
}
