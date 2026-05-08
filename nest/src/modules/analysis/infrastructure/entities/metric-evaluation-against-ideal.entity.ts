import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { LocalizedText, Severity3, Severity5 } from '../../domain/types/catalog.types.js';
import { MetricIdealEntity } from './metric-ideal.entity.js';
import { MetricEvaluationEntity } from './metric-evaluation.entity.js';

const numericTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

/**
 * Comparison result between one metric_evaluation row and its chosen ideal.
 *
 * FK into metric_evaluation requires composite (id, generated_at) because
 * metric_evaluation is a partitioned table (Postgres FK rules).
 */
@Entity({ name: 'metric_evaluation_against_ideal' })
@Index('idx_against_ideal_eval', ['metricEvaluationId'])
@Index('idx_against_ideal_ideal', ['metricIdealId'])
export class MetricEvaluationAgainstIdealEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'metric_evaluation_id', type: 'uuid' })
  metricEvaluationId!: string;

  /** Required for composite FK → metric_evaluation(id, generated_at). */
  @Column({ name: 'metric_evaluation_generated_at', type: 'timestamptz' })
  metricEvaluationGeneratedAt!: Date;

  @OneToOne(() => MetricEvaluationEntity, (e) => e.againstIdeal)
  @JoinColumn([
    { name: 'metric_evaluation_id', referencedColumnName: 'id' },
    { name: 'metric_evaluation_generated_at', referencedColumnName: 'generatedAt' },
  ])
  metricEvaluation!: Relation<MetricEvaluationEntity>;

  @Column({ name: 'metric_ideal_id', type: 'uuid' })
  metricIdealId!: string;

  @ManyToOne(() => MetricIdealEntity)
  @JoinColumn({ name: 'metric_ideal_id' })
  metricIdeal!: Relation<MetricIdealEntity>;

  /** Absolute distance from the ideal central value in the metric's native unit. */
  @Column({ name: 'deviation_raw', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numericTransformer })
  deviationRaw!: number | null;

  /**
   * deviation_raw / (ideal range width) — unitless, enables cross-metric
   * comparison and scoring. Null when ideal ranges are not defined.
   */
  @Column({ name: 'deviation_normalized', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numericTransformer })
  deviationNormalized!: number | null;

  /** Raw 5-level severity (DEC-3): ideal | mild | moderate | strong | extreme. */
  @Column({
    name: 'severity_5',
    type: 'enum',
    enum: ['ideal', 'mild', 'moderate', 'strong', 'extreme'],
    enumName: 'severity_5_enum',
    nullable: true,
  })
  severity5!: Severity5 | null;

  /** Collapsed 3-level severity per severity_collapse_policy.mapping (DEC-3). */
  @Column({
    name: 'severity_3',
    type: 'enum',
    enum: ['LEVE', 'MODERADO', 'SEVERO'],
    enumName: 'severity_3_enum',
    nullable: true,
  })
  severity3!: Severity3 | null;

  /** i18n direction text: { "pt-BR": "olho mais alto" }. */
  @Column({ name: 'direction_label', type: 'jsonb', default: () => "'{}'::jsonb" })
  directionLabel!: LocalizedText;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
