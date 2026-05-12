import {
  Column,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { LocalizedText } from '../../domain/types/catalog.types.js';
import { LandmarkPayloadEntity } from './landmark-payload.entity.js';
import { MetricEvaluationEntity } from './metric-evaluation.entity.js';

/**
 * Root aggregate for one analysis run. Maps to the partitioned parent table
 * `analysis_report`. Postgres routes inserts to the correct monthly partition
 * based on generated_at.
 *
 * IMPORTANT: Postgres-level PK is (id, generated_at). TypeORM uses `id` as
 * its logical PK (synchronize:false — TypeORM never recreates the DB PK).
 * Always supply `generated_at` when querying to enable partition pruning.
 */
@Entity({ name: 'analysis_report' })
@Index('idx_analysis_report_session', ['sessionId'])
export class AnalysisReportEntity {
  /**
   * TypeORM logical PK. Postgres DB-level PK is (id, generated_at) for
   * partitioning — managed by migration, not by this decorator.
   */
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'session_id', type: 'text' })
  sessionId!: string;

  @Column({ name: 'photo_reference', type: 'text', nullable: true })
  photoReference!: string | null;

  @Column({
    name: 'normalization_basis',
    type: 'text',
    default: 'intercanthal',
  })
  normalizationBasis!: string;

  @Column({ name: 'pose_correction_applied', type: 'boolean', default: false })
  poseCorrectionApplied!: boolean;

  @Column({ name: 'midline_aligned', type: 'boolean', default: false })
  midlineAligned!: boolean;

  @Column({
    name: 'quality_score',
    type: 'numeric',
    precision: 10,
    scale: 6,
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
    },
  })
  qualityScore!: number | null;

  @Column({ name: 'metric_registry_version', type: 'text', nullable: true })
  metricRegistryVersion!: string | null;

  @Column({ name: 'ideals_version', type: 'text', nullable: true })
  idealsVersion!: string | null;

  @Column({ name: 'threshold_config_version', type: 'text', nullable: true })
  thresholdConfigVersion!: string | null;

  @Column({ name: 'severity_collapse_version', type: 'text', nullable: true })
  severityCollapseVersion!: string | null;

  /** Snapshot of region_metric_weights_version active at evaluation time (PR-12). */
  @Column({ name: 'region_metric_weights_version', type: 'text', nullable: true })
  regionMetricWeightsVersion!: string | null;

  /** Snapshot of global_weights_version active at evaluation time (PR-12). */
  @Column({ name: 'global_weights_version', type: 'text', nullable: true })
  globalWeightsVersion!: string | null;

  @Column({ name: 'locale', type: 'text', default: 'pt-BR' })
  locale!: string;

  /** sex/age accepted but IGNORED in M1 pipeline (DEC-13). */
  @Column({ name: 'user_context', type: 'jsonb', nullable: true })
  userContext!: Record<string, unknown> | null;

  @Column({
    name: 'processing_notes',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  processingNotes!: string[];

  @Column({ name: 'disclaimer_text_snapshot', type: 'text', nullable: true })
  disclaimerTextSnapshot!: string | null;

  @Column({ name: 'status', type: 'text', default: 'complete' })
  status!: string;

  /**
   * Partition key. Must be supplied on insert; used by Postgres to route the
   * row to the correct monthly partition. Always include in WHERE clauses for
   * partition pruning.
   */
  @Column({ name: 'generated_at', type: 'timestamptz', default: () => 'NOW()' })
  generatedAt!: Date;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @OneToOne(() => LandmarkPayloadEntity, (lp) => lp.analysisReport)
  landmarkPayload!: Relation<LandmarkPayloadEntity> | null;

  @OneToMany(() => MetricEvaluationEntity, (me) => me.analysisReport)
  metricEvaluations!: Relation<MetricEvaluationEntity>[];
}
