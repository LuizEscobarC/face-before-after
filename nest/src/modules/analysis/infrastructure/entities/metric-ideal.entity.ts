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
import { IdealType, LocalizedText } from '../../domain/types/catalog.types.js';
import { IdealsVersionEntity } from './ideals-version.entity.js';
import { MetricDefinitionEntity } from './metric-definition.entity.js';

const numericTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

@Entity({ name: 'metric_ideal' })
@Unique('uq_metric_ideal_metric_def_version', [
  'metricId',
  'metricDefinitionVersion',
  'idealsVersion',
])
@Index('idx_metric_ideal_version', ['idealsVersion'])
export class MetricIdealEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'metric_id', type: 'text' })
  metricId!: string;

  @Column({ name: 'metric_definition_version', type: 'text' })
  metricDefinitionVersion!: string;

  @ManyToOne(() => MetricDefinitionEntity)
  @JoinColumn([
    { name: 'metric_id', referencedColumnName: 'metricId' },
    { name: 'metric_definition_version', referencedColumnName: 'version' },
  ])
  metricDefinition!: Relation<MetricDefinitionEntity>;

  @Column({ name: 'ideals_version', type: 'text' })
  idealsVersion!: string;

  @ManyToOne(() => IdealsVersionEntity, (v) => v.metricIdeals)
  @JoinColumn({ name: 'ideals_version', referencedColumnName: 'version' })
  idealsVersionRef!: Relation<IdealsVersionEntity>;

  @Column({
    name: 'ideal_type',
    type: 'enum',
    enum: ['canonical', 'population_statistical', 'presentation_only'],
    enumName: 'ideal_type_enum',
  })
  idealType!: IdealType;

  @Column({ name: 'ideal_central_value', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numericTransformer })
  idealCentralValue!: number | null;

  @Column({ name: 'green_range_min', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numericTransformer })
  greenRangeMin!: number | null;

  @Column({ name: 'green_range_max', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numericTransformer })
  greenRangeMax!: number | null;

  @Column({ name: 'yellow_range_min', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numericTransformer })
  yellowRangeMin!: number | null;

  @Column({ name: 'yellow_range_max', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numericTransformer })
  yellowRangeMax!: number | null;

  @Column({ name: 'direction_label_above', type: 'jsonb', default: () => "'{}'::jsonb" })
  directionLabelAbove!: LocalizedText;

  @Column({ name: 'direction_label_below', type: 'jsonb', default: () => "'{}'::jsonb" })
  directionLabelBelow!: LocalizedText;

  @Column({ name: 'population_reference_note', type: 'text', nullable: true })
  populationReferenceNote!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
