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

/**
 * 1:1 with analysis_report. Stores raw + normalized landmark arrays from
 * MediaPipe Face Mesh (up to 478 points).
 *
 * FK references the composite PK (id, generated_at) of analysis_report,
 * so analysis_report_generated_at must always match the parent row.
 */
@Entity({ name: 'landmark_payload' })
@Index('idx_landmark_payload_report', ['analysisReportId'])
export class LandmarkPayloadEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'analysis_report_id', type: 'uuid' })
  analysisReportId!: string;

  /** Required for composite FK → analysis_report(id, generated_at). */
  @Column({ name: 'analysis_report_generated_at', type: 'timestamptz' })
  analysisReportGeneratedAt!: Date;

  @OneToOne(() => AnalysisReportEntity, (r) => r.landmarkPayload)
  @JoinColumn([
    { name: 'analysis_report_id', referencedColumnName: 'id' },
    { name: 'analysis_report_generated_at', referencedColumnName: 'generatedAt' },
  ])
  analysisReport!: Relation<AnalysisReportEntity>;

  /**
   * Array of {x, y, z} objects from MediaPipe Face Mesh.
   * Shape: [{x: 0.123, y: 0.456, z: -0.002}, ...] (478 points max).
   */
  @Column({ name: 'raw_landmarks', type: 'jsonb' })
  rawLandmarks!: Array<{ x: number; y: number; z: number }>;

  /**
   * Post-normalization landmarks (intercanthal units, DEC-1).
   * Null until normalization step runs.
   */
  @Column({ name: 'normalized_landmarks', type: 'jsonb', nullable: true })
  normalizedLandmarks!: Array<{ x: number; y: number; z: number }> | null;

  @Column({
    name: 'normalization_basis',
    type: 'text',
    nullable: true,
  })
  normalizationBasis!: string | null;

  /** DEC-11: multi-capture deferred. Column reserved, always 1 in M1. */
  @Column({ name: 'capture_count', type: 'int', default: 1 })
  captureCount!: number;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
