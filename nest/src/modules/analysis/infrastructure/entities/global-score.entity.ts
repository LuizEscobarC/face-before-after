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
import { AnalysisReportEntity } from './analysis-report.entity.js';

const numericTransformer = {
  to: (v: number | null) => v,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

/**
 * Score band labels per DEC-9. Persisted alongside the numeric score so
 * downstream UI never has to re-derive bands.
 */
export type ScoreBand = 'no_number' | 'refine' | 'good' | 'high';

export interface RegionalBreakdownEntry {
  region: string;
  score_0_100: number | null;
  weight: number;
  confidence_aggregate: number | null;
  contributed: boolean;
}

/**
 * One row per analysis_report. score_0_100 is null when DEC-8 critical-region
 * gating fails (any critical region has confidence_aggregate < 0.5).
 */
@Entity({ name: 'global_score' })
@Unique('uq_global_score_report', ['analysisReportId'])
@Index('idx_global_score_report', ['analysisReportId'])
export class GlobalScoreEntity {
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

  /** 0..100, null when DEC-8 gating fails or no scorable region exists. */
  @Column({
    name: 'score_0_100',
    type: 'numeric',
    precision: 6,
    scale: 3,
    nullable: true,
    transformer: numericTransformer,
  })
  score0to100!: number | null;

  @Column({ name: 'is_displayable', type: 'boolean', default: false })
  isDisplayable!: boolean;

  @Column({
    name: 'band',
    type: 'enum',
    enum: ['no_number', 'refine', 'good', 'high'],
    enumName: 'score_band_enum',
    nullable: true,
  })
  band!: ScoreBand | null;

  /** Per-region contribution snapshot for UI/audit. */
  @Column({
    name: 'regional_breakdown',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  regionalBreakdown!: RegionalBreakdownEntry[];

  @Column({ name: 'global_weights_version', type: 'text', nullable: true })
  globalWeightsVersion!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
