import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MetricRegion } from '../../domain/types/catalog.types.js';
import { GlobalWeightsVersionEntity } from './global-weights-version.entity.js';

const numericTransformer = {
  to: (v: number) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

/**
 * One weight per (version, region) — composes regional scores into the
 * single global score. region uses the same enum as metric_definition.region
 * so M2 dimensions can map onto regions directly.
 */
@Entity({ name: 'global_weight' })
@Unique('uq_global_weight_version_region', ['version', 'region'])
@Index('idx_global_weight_version', ['version'])
export class GlobalWeightEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'version', type: 'text' })
  version!: string;

  @ManyToOne(() => GlobalWeightsVersionEntity, (v) => v.weights)
  @JoinColumn({ name: 'version', referencedColumnName: 'version' })
  versionRef!: Relation<GlobalWeightsVersionEntity>;

  @Column({
    name: 'region',
    type: 'enum',
    enum: [
      'eyes', 'brows', 'nose', 'mouth', 'jaw', 'chin',
      'midface', 'cheeks', 'forehead', 'global', 'symmetry', 'photo_quality',
    ],
    enumName: 'metric_region_enum',
  })
  region!: MetricRegion;

  @Column({
    name: 'weight',
    type: 'numeric',
    precision: 10,
    scale: 6,
    default: 1.0,
    transformer: numericTransformer,
  })
  weight!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
