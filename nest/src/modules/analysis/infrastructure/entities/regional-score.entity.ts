import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { MetricRegion } from '../../domain/types/catalog.types.js';
import { AnalysisReportEntity } from './analysis-report.entity.js';

const numericTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

/**
 * One row per (analysis_report, region). Score is null when the region had
 * no scorable contributions (all metrics presentation_only or below
 * min_confidence_to_display).
 *
 * FK into analysis_report uses composite (id, generated_at) — Postgres rule
 * for FKs into partitioned parent tables.
 */
@Entity({ name: 'regional_score' })
@Index('idx_regional_score_report', ['analysisReportId'])
export class RegionalScoreEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'analysis_report_id', type: 'uuid' })
  analysisReportId!: string;

  @Column({ name: 'analysis_report_generated_at', type: 'timestamptz' })
  analysisReportGeneratedAt!: Date;

  @ManyToOne(() => AnalysisReportEntity)
  @JoinColumn([
    { name: 'analysis_report_id', referencedColumnName: 'id' },
    { name: 'analysis_report_generated_at', referencedColumnName: 'generatedAt' },
  ])
  analysisReport!: Relation<AnalysisReportEntity>;

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

  /** 0..100. Null when unscorable (no contributing metrics). */
  @Column({
    name: 'score_0_100',
    type: 'numeric',
    precision: 6,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  score0to100!: number | null;

  /** Weighted mean confidence_final of contributing metrics. */
  @Column({
    name: 'confidence_aggregate',
    type: 'numeric',
    precision: 10,
    scale: 6,
    nullable: true,
    transformer: numericTransformer,
  })
  confidenceAggregate!: number | null;

  /** Snapshot of metric_ids that fed this score (post filtering). */
  @Column({
    name: 'contributing_metric_ids',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  contributingMetricIds!: string[];

  @Column({ name: 'weights_version', type: 'text', nullable: true })
  weightsVersion!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
