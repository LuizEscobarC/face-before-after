/**
 * DiagnosisReportEntity (PR-66) — persisted version of the in-memory map
 * previously held by ``DiagnosisService``.
 *
 * One row per analysis ``run_id``. Stores the curated top-3 concerns and
 * the human-readable summary so the diagnosis endpoint survives process
 * restarts.
 */
import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

import type { ConcernDto } from '../../dto/diagnosis.dto.js';

@Entity({ name: 'diagnosis_report' })
@Index('idx_diagnosis_report_created_at', ['createdAt'])
export class DiagnosisReportEntity {
  /** Mirrors ``run_id`` from the analysis pipeline. */
  @PrimaryColumn({ name: 'run_id', type: 'text' })
  runId!: string;

  /** Pre-ranked top concerns (max 3) — JSON for portability. */
  @Column({ name: 'top_concerns', type: 'jsonb', default: () => `'[]'::jsonb` })
  topConcerns!: ConcernDto[];

  /** Plain-text summary derived from ``topConcerns``. */
  @Column({ name: 'summary', type: 'text' })
  summary!: string;

  /** ISO timestamp captured at insertion (kept as text to match DTO). */
  @Column({ name: 'timestamp', type: 'text' })
  timestamp!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
