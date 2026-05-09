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
 * PR-55 — recommendation_trigger
 *
 * Rules that map (metric_id, severity, direction) → a recommendation_catalog
 * row. A single recommendation can have multiple triggers (OR semantics):
 * if any trigger matches, the recommendation fires.
 *
 * Used by `RecommendationEngine` (PR-57) to:
 *   1. Load all triggers for the active catalog version.
 *   2. For each `metric_evaluation_against_ideal` in the report, find
 *      matching triggers (metric_id + severity + direction/any).
 *   3. Deduplicate (same recommendation_id fired by multiple triggers →
 *      union of `triggered_by_metric_evaluation_ids`).
 *   4. Score and rank.
 *
 * `direction='any'` is a wildcard that matches regardless of direction.
 * `additional_conditions` (JSONB, nullable) supports compound rules like
 * "also requires metric X at minimum severity Y".
 */
@Entity({ name: 'recommendation_trigger' })
@Index('idx_rec_trigger_recommendation', ['recommendationId'])
@Index('idx_rec_trigger_metric_severity', ['metricId', 'severity'])
export class RecommendationTriggerEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'id' })
  id!: string;

  @Column({ name: 'recommendation_id', type: 'text' })
  recommendationId!: string;

  @ManyToOne(
    () => RecommendationCatalogEntity,
    (catalog) => catalog.triggers,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'recommendation_id', referencedColumnName: 'id' })
  recommendation!: Relation<RecommendationCatalogEntity>;

  /** Soft FK to metric_definition.metric_id (same pattern as diagnostic_template). */
  @Column({ name: 'metric_id', type: 'text' })
  metricId!: string;

  /**
   * Uses the PostgreSQL enum `severity_5_enum` created in the initial
   * migrations (1746000030000-EvaluationsAndRoot.ts).
   */
  @Column({
    name: 'severity',
    type: 'enum',
    enumName: 'severity_5_enum',
    enum: ['minimal', 'mild', 'moderate', 'strong', 'extreme'],
  })
  severity!: 'minimal' | 'mild' | 'moderate' | 'strong' | 'extreme';

  /**
   * Free-text direction value; `any` is a wildcard matching all directions.
   * Same decision as diagnostic_template.direction (DEC-39, PR-50).
   */
  @Column({ name: 'direction', type: 'text', default: 'any' })
  direction!: string;

  /** Optional compound conditions. NULL = unconditional match. */
  @Column({ name: 'additional_conditions', type: 'jsonb', nullable: true })
  additionalConditions!: Record<string, unknown> | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;
}
