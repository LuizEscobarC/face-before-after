import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import {
  LocalizedText,
  MetricRegion,
  MetricUnit,
} from '../../domain/types/catalog.types.js';
import { MetricRegistryVersionEntity } from './metric-registry-version.entity.js';

/**
 * Composite PK (metric_id, version). Same metric_id can exist in multiple
 * registry versions; FK keeps history coherent.
 */
@Entity({ name: 'metric_definition' })
@Index('idx_metric_definition_version', ['version'])
@Index('idx_metric_definition_region', ['region'])
export class MetricDefinitionEntity {
  @PrimaryColumn({ name: 'metric_id', type: 'text' })
  metricId!: string;

  @PrimaryColumn({ name: 'version', type: 'text' })
  version!: string;

  @ManyToOne(() => MetricRegistryVersionEntity, (v) => v.metricDefinitions)
  @JoinColumn({ name: 'version', referencedColumnName: 'version' })
  registryVersion!: Relation<MetricRegistryVersionEntity>;

  @Column({ name: 'family', type: 'text' })
  family!: string;

  @Column({ name: 'region', type: 'enum', enum: [
    'eyes', 'brows', 'nose', 'mouth', 'jaw', 'chin',
    'midface', 'cheeks', 'forehead', 'global', 'symmetry', 'photo_quality',
  ], enumName: 'metric_region_enum' })
  region!: MetricRegion;

  @Column({ name: 'unit', type: 'enum', enum: [
    'px', 'mm_normalized', 'ratio', 'intercanthal_units',
    'degrees', 'percent', 'index_0_1',
  ], enumName: 'metric_unit_enum' })
  unit!: MetricUnit;

  @Column({ name: 'display_name', type: 'jsonb', default: () => "'{}'::jsonb" })
  displayName!: LocalizedText;

  @Column({ name: 'presentation_only', type: 'boolean', default: false })
  presentationOnly!: boolean;

  @Column({ name: 'requires_pixel_analysis', type: 'boolean', default: false })
  requiresPixelAnalysis!: boolean;

  @Column({ name: 'dependency_landmarks', type: 'jsonb', default: () => "'[]'::jsonb" })
  dependencyLandmarks!: number[];

  @Column({
    name: 'default_weight_in_region',
    type: 'numeric',
    precision: 10,
    scale: 6,
    default: 1.0,
    transformer: {
      to: (v: number) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  defaultWeightInRegion!: number;

  @Column({
    name: 'min_confidence_to_display',
    type: 'numeric',
    precision: 10,
    scale: 6,
    default: 0.4,
    transformer: {
      to: (v: number) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  minConfidenceToDisplay!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
