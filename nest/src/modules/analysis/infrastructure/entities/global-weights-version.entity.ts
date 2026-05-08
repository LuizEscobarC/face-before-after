import { Column, Entity, Index, OneToMany, PrimaryColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { GlobalWeightEntity } from './global-weight.entity.js';

/**
 * Versioned container for global_weight rows + critical_regions snapshot.
 * critical_regions persists DEC-8 gating list (regions whose
 * confidence_aggregate < 0.5 force global_score = null).
 */
@Entity({ name: 'global_weights_version' })
export class GlobalWeightsVersionEntity {
  @PrimaryColumn({ name: 'version', type: 'text' })
  version!: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Index('uq_global_weights_version_active', { unique: true, where: 'is_active = TRUE' })
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

  /** Snapshot of region names that gate the global score per DEC-8. */
  @Column({
    name: 'critical_regions',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  criticalRegions!: string[];

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @OneToMany(() => GlobalWeightEntity, (w) => w.versionRef)
  weights!: Relation<GlobalWeightEntity>[];
}
