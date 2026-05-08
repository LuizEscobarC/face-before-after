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
import { RegionMetricWeightsVersionEntity } from './region-metric-weights-version.entity.js';

const numericTransformer = {
  to: (v: number) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

/**
 * One weight row per (version, region, metric_id). Loaded by RegionalScorer
 * to compose region scores from individual MetricEvaluation results.
 *
 * presentation_only metrics MUST NOT appear here (DEC-6, enforced both by
 * seed migration source-of-truth and by RegionalScorer assertion).
 */
@Entity({ name: 'region_metric_weight' })
@Unique('uq_region_metric_weight_version_region_metric', ['version', 'region', 'metricId'])
@Index('idx_region_metric_weight_version', ['version'])
@Index('idx_region_metric_weight_region', ['region'])
export class RegionMetricWeightEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'version', type: 'text' })
  version!: string;

  @ManyToOne(() => RegionMetricWeightsVersionEntity, (v) => v.weights)
  @JoinColumn({ name: 'version', referencedColumnName: 'version' })
  versionRef!: Relation<RegionMetricWeightsVersionEntity>;

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

  @Column({ name: 'metric_id', type: 'text' })
  metricId!: string;

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
