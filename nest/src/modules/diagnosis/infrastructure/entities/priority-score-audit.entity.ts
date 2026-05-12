import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * PR-58 — priority_score_audit
 *
 * 1:1 with `recommendation_link`. Stores the full decomposition of the
 * priority formula `(I × S × C × A) × (1 − R) × (1 − E × 0.5)`, the
 * cascade `raw → penalized → final`, the source FKs (DDL_REVIEW §5.7),
 * and the DEC-38 / guardrail suppression reason.
 *
 * Soft FK pattern (analysis_report is partitioned).
 */
export type PrioritySuppressionReason =
  | 'high_risk_self_application'
  | 'no_actionability'
  | 'clinical_pathway_not_required'
  | 'dec38_ladder_isolated_4b'
  | 'dec38_max_category_exceeded';

const numericTransformer = {
  to: (v: number | null | undefined) => v ?? null,
  from: (v: string | null) => (v === null ? null : parseFloat(v)),
};

const numericTransformerNonNull = {
  to: (v: number) => v,
  from: (v: string) => parseFloat(v),
};

@Entity({ name: 'priority_score_audit' })
@Index('idx_psa_report', ['analysisReportId', 'analysisReportGeneratedAt'])
export class PriorityScoreAuditEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'recommendation_link_id', type: 'uuid', unique: true })
  recommendationLinkId!: string;

  @Column({ name: 'analysis_report_id', type: 'uuid' })
  analysisReportId!: string;

  @Column({ name: 'analysis_report_generated_at', type: 'timestamptz' })
  analysisReportGeneratedAt!: Date;

  // ── Formula components ────────────────────────────────────────────────────

  @Column({ name: 'I', type: 'numeric', precision: 6, scale: 5, nullable: true, transformer: numericTransformer })
  I!: number | null;

  @Column({ name: 'S', type: 'numeric', precision: 6, scale: 5, nullable: true, transformer: numericTransformer })
  S!: number | null;

  @Column({ name: 'C', type: 'numeric', precision: 6, scale: 5, nullable: true, transformer: numericTransformer })
  C!: number | null;

  @Column({ name: 'A', type: 'numeric', precision: 6, scale: 5, nullable: true, transformer: numericTransformer })
  A!: number | null;

  @Column({ name: 'E', type: 'numeric', precision: 6, scale: 5, nullable: true, transformer: numericTransformer })
  E!: number | null;

  @Column({ name: 'R', type: 'numeric', precision: 6, scale: 5, nullable: true, transformer: numericTransformer })
  R!: number | null;

  // ── Cascade ───────────────────────────────────────────────────────────────

  @Column({ name: 'raw_score', type: 'numeric', precision: 8, scale: 6, transformer: numericTransformerNonNull })
  rawScore!: number;

  @Column({ name: 'penalized_score', type: 'numeric', precision: 8, scale: 6, transformer: numericTransformerNonNull })
  penalizedScore!: number;

  @Column({ name: 'final_score', type: 'numeric', precision: 8, scale: 6, transformer: numericTransformerNonNull })
  finalScore!: number;

  @Column({
    name: 'photo_quality_score_applied',
    type: 'numeric',
    precision: 6,
    scale: 5,
    nullable: true,
    transformer: numericTransformer,
  })
  photoQualityScoreApplied!: number | null;

  // ── Source FKs (DDL_REVIEW §5.7) ──────────────────────────────────────────

  @Column({ name: 'severity_source_against_ideal_id', type: 'uuid', nullable: true })
  severitySourceAgainstIdealId!: string | null;

  @Column({ name: 'confidence_source_evaluation_id', type: 'uuid', nullable: true })
  confidenceSourceEvaluationId!: string | null;

  @Column({ name: 'risk_source_recommendation_id', type: 'text', nullable: true })
  riskSourceRecommendationId!: string | null;

  @Column({ name: 'invasiveness_level_applied', type: 'smallint', nullable: true })
  invasivenessLevelApplied!: number | null;

  // ── DEC-38 / guardrail diagnosis ──────────────────────────────────────────

  @Column({ name: 'suppression_reason', type: 'text', nullable: true })
  suppressionReason!: PrioritySuppressionReason | null;

  @Column({ name: 'dec38_rank_position', type: 'integer', nullable: true })
  dec38RankPosition!: number | null;

  // ── Metadata ──────────────────────────────────────────────────────────────

  @Column({ name: 'scored_at', type: 'timestamptz', default: () => 'NOW()' })
  scoredAt!: Date;

  @Column({ name: 'service_version', type: 'text', default: 'pr-58.v1' })
  serviceVersion!: string;
}
