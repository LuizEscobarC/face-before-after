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
import { AnalysisReportEntity } from './analysis-report.entity.js';
import { MetricEvaluationAgainstIdealEntity } from './metric-evaluation-against-ideal.entity.js';

const numericTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

/**
 * One row per metric per analysis run. Maps to the partitioned parent table
 * `metric_evaluation`. Postgres routes by generated_at (same value as
 * analysis_report.generated_at for co-location).
 *
 * IMPORTANT: Postgres-level PK is (id, generated_at). TypeORM uses `id`.
 * Always supply `generated_at` in queries for partition pruning.
 */
@Entity({ name: 'metric_evaluation' })
@Index('idx_metric_evaluation_report', ['analysisReportId'])
@Index('idx_metric_evaluation_metric_id', ['metricId'])
export class MetricEvaluationEntity {
  /** TypeORM logical PK. Postgres composite PK (id, generated_at) managed by migration. */
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'analysis_report_id', type: 'uuid' })
  analysisReportId!: string;

  /** Required for composite FK → analysis_report(id, generated_at). */
  @Column({ name: 'analysis_report_generated_at', type: 'timestamptz' })
  analysisReportGeneratedAt!: Date;

  @ManyToOne(() => AnalysisReportEntity, (r) => r.metricEvaluations)
  @JoinColumn([
    { name: 'analysis_report_id', referencedColumnName: 'id' },
    { name: 'analysis_report_generated_at', referencedColumnName: 'generatedAt' },
  ])
  analysisReport!: Relation<AnalysisReportEntity>;

  @Column({ name: 'metric_id', type: 'text' })
  metricId!: string;

  @Column({ name: 'metric_definition_version', type: 'text' })
  metricDefinitionVersion!: string;

  @Column({ name: 'value', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numericTransformer })
  value!: number | null;

  /** Populated when calculation fails; null means success. */
  @Column({ name: 'error', type: 'text', nullable: true })
  error!: string | null;

  /** Raw confidence from the vision service before pose penalty. */
  @Column({ name: 'confidence_raw', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numericTransformer })
  confidenceRaw!: number | null;

  /** Post pose-penalty confidence used for display/gating decisions. */
  @Column({ name: 'confidence_final', type: 'numeric', precision: 10, scale: 6, nullable: true, transformer: numericTransformer })
  confidenceFinal!: number | null;

  /** confidence_final < threshold_config.min_confidence_to_display_metric (DEC-7 default: 0.4). */
  @Column({ name: 'is_low_confidence', type: 'boolean', default: false })
  isLowConfidence!: boolean;

  /** presentation_only=FALSE AND is_low_confidence=FALSE AND error IS NULL. */
  @Column({ name: 'displayable', type: 'boolean', default: true })
  displayable!: boolean;

  /** 'above' | 'below' | 'neutral' relative to ideal. */
  @Column({ name: 'direction', type: 'text', nullable: true })
  direction!: string | null;

  /** Partition key. Must equal analysis_report.generated_at for co-location. */
  @Column({ name: 'generated_at', type: 'timestamptz', default: () => 'NOW()' })
  generatedAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @OneToOne(
    () => MetricEvaluationAgainstIdealEntity,
    (a) => a.metricEvaluation,
  )
  againstIdeal!: Relation<MetricEvaluationAgainstIdealEntity> | null;
}
