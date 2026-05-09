import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { RecommendationCatalogEntity } from './recommendation-catalog.entity.js';

/**
 * PR-55 — recommendation_link
 *
 * Per-session instance: which recommendations fired for a given
 * `analysis_report`, their final priority after the scoring pass, and
 * whether they were displayed to the user (DEC-33: top-5 shown).
 *
 * Replaces `solution_reference` (deprecated per PLAN_DDL_REVIEW §5.8).
 *
 * SOFT FK pattern for analysis_report
 * -------------------------------------
 * `analysis_report` is a partitioned table (range by generated_at). Adding a
 * hard FK against a partitioned table requires including the partition key in
 * the FK, which TypeORM doesn't support cleanly. We use the same pattern as
 * `rendered_asset`: store both `analysis_report_id` (UUID) and
 * `analysis_report_generated_at` (TIMESTAMPTZ) without a DB-level FK
 * constraint. Application code is responsible for referential integrity.
 *
 * Lifecycle
 * ---------
 *   1. `RecommendationEngine` (PR-57) fires matching triggers → inserts rows
 *      with `final_priority_in_session=NULL`, `is_displayed_to_user=FALSE`.
 *   2. `DiagnosticPriorityService` (PR-58) runs formula → sets
 *      `final_priority_in_session` for all rows of a report.
 *   3. `NarrativeService` (PR-59) selects rows where
 *      `final_priority_in_session ≤ 5` → flips `is_displayed_to_user=TRUE`
 *      and returns them in the narrative response.
 */
@Entity({ name: 'recommendation_link' })
@Index('idx_rec_link_report', ['analysisReportId', 'analysisReportGeneratedAt'])
@Index('idx_rec_link_recommendation', ['recommendationId'])
@Index('idx_rec_link_displayed', ['analysisReportId', 'isDisplayedToUser'])
export class RecommendationLinkEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  /** Soft FK to analysis_report.id — no constraint, table is partitioned. */
  @Column({ name: 'analysis_report_id', type: 'uuid' })
  analysisReportId!: string;

  /** Partition key required to enable partition pruning in joins. */
  @Column({ name: 'analysis_report_generated_at', type: 'timestamptz' })
  analysisReportGeneratedAt!: Date;

  @Column({ name: 'recommendation_id', type: 'text' })
  recommendationId!: string;

  @ManyToOne(
    () => RecommendationCatalogEntity,
    (catalog) => catalog.links,
    { onDelete: 'RESTRICT' },
  )
  @JoinColumn({ name: 'recommendation_id', referencedColumnName: 'id' })
  recommendation!: Relation<RecommendationCatalogEntity>;

  /**
   * JSON array of `metric_evaluation_against_ideal.id` UUIDs that caused
   * this recommendation to fire. Enables audit: "why did this appear?"
   */
  @Column({
    name: 'triggered_by_metric_evaluation_ids',
    type: 'jsonb',
    default: () => "'[]'::jsonb",
  })
  triggeredByMetricEvaluationIds!: string[];

  /**
   * Rank within this analysis session. Set by `DiagnosticPriorityService`
   * (PR-58). NULL until that pass runs. Lower = higher priority (1 = top).
   */
  @Column({ name: 'final_priority_in_session', type: 'smallint', nullable: true })
  finalPriorityInSession!: number | null;

  /**
   * Set to TRUE for rows that cleared the top-5 cut (DEC-33).
   * `NarrativeService` (PR-59) reads only is_displayed_to_user=TRUE rows.
   */
  @Column({ name: 'is_displayed_to_user', type: 'boolean', default: false })
  isDisplayedToUser!: boolean;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
