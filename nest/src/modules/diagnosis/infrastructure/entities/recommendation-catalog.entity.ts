import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import {
  RECOMMENDATION_CATEGORIES,
  type RecommendationCategory,
  type EffortEstimate,
  type EvidenceLevel,
  type ProfessionalType,
  type RecommendationReference,
  type AnimationConfig,
  type BiometricExerciseConfig,
} from '../../domain/types/recommendation.types.js';
import { RecommendationCatalogVersionEntity } from './recommendation-catalog-version.entity.js';
import { RecommendationTriggerEntity } from './recommendation-trigger.entity.js';
import { RecommendationLinkEntity } from './recommendation-link.entity.js';

/**
 * PR-55 — recommendation_catalog
 *
 * Catalog of versioned recommendations. PK is a human-readable snake_case
 * slug (e.g. `improve-head-posture`, `consult-orthodontist-midline`) for
 * readability in audit logs and PDF without needing UUID lookup.
 *
 * Columns:
 *   - `category`:            drives rendering section in PDF + disclaimer logic.
 *   - `display_text_short`:  ≤120 chars; card summary (DEC-31).
 *   - `display_text_long`:   paragraph; used in PDF and narrative (DEC-31).
 *   - `priority_default`:    baseline priority 1–5 used by RecommendationEngine
 *                            before session-specific override (PR-57).
 *   - `effort_estimate`:     feeds E in formula (1 − E×0.5) (PR-58).
 *   - `risk_level`:          feeds R in formula (1−R) (PR-58). 0 = safe, 1 = high risk.
 *   - `requires_professional`: gate for disclaimer (DEC-35).
 *   - `professional_type`:   which specialty, when requires_professional=TRUE.
 *
 * Content is deferred to PR-56 (Opus — judgment of professional_referral vs
 * lifestyle per metric, per DEC-34).
 */
@Entity({ name: 'recommendation_catalog' })
@Index('idx_rec_catalog_version', ['version'])
@Index('idx_rec_catalog_category', ['category'])
export class RecommendationCatalogEntity {
  /** Snake-case slug PK — human-readable, stable across catalog versions. */
  @PrimaryColumn({ name: 'id', type: 'text' })
  id!: string;

  @Column({ name: 'version', type: 'text' })
  version!: string;

  @ManyToOne(
    () => RecommendationCatalogVersionEntity,
    (v) => v.catalogItems,
  )
  @JoinColumn({ name: 'version', referencedColumnName: 'version' })
  catalogVersion!: Relation<RecommendationCatalogVersionEntity>;

  @Column({
    name: 'category',
    type: 'enum',
    enum: RECOMMENDATION_CATEGORIES,
    enumName: 'recommendation_category_enum',
  })
  category!: RecommendationCategory;

  @Column({ name: 'display_text_short_pt', type: 'text' })
  displayTextShortPt!: string;

  @Column({ name: 'display_text_long_pt', type: 'text' })
  displayTextLongPt!: string;

  @Column({ name: 'priority_default', type: 'smallint' })
  priorityDefault!: number;

  @Column({ name: 'effort_estimate', type: 'text' })
  effortEstimate!: EffortEstimate;

  @Column({
    name: 'risk_level',
    type: 'numeric',
    precision: 4,
    scale: 3,
    default: 0.0,
    transformer: {
      to: (v: number) => v,
      from: (v: string) => parseFloat(v),
    },
  })
  riskLevel!: number;

  @Column({ name: 'requires_professional', type: 'boolean', default: false })
  requiresProfessional!: boolean;

  @Column({ name: 'professional_type', type: 'text', nullable: true })
  professionalType!: ProfessionalType | null;

  /** Invasiveness ladder 0..4 — see CATEGORY_TO_INVASIVENESS in domain types. */
  @Column({ name: 'invasiveness_level', type: 'smallint' })
  invasivenessLevel!: number;

  @Column({
    name: 'evidence_level',
    type: 'enum',
    enum: ['strong', 'moderate', 'anecdotal'],
    enumName: 'evidence_level_enum',
    default: 'moderate',
  })
  evidenceLevel!: EvidenceLevel;

  /** Generated column — read-only mirror of (evidence_level = 'anecdotal'). */
  @Column({
    name: 'requires_anecdotal_disclaimer',
    type: 'boolean',
    insert: false,
    update: false,
  })
  requiresAnecdotalDisclaimer!: boolean;

  @Column({ name: 'clinical_pathway_required', type: 'boolean', default: false })
  clinicalPathwayRequired!: boolean;

  @Column({ name: 'references_jsonb', type: 'jsonb', default: () => "'[]'::jsonb" })
  references!: RecommendationReference[];

  @Column({ name: 'disclaimer_template', type: 'text', nullable: true })
  disclaimerTemplate!: string | null;

  /**
   * PR-A — Declarative SVG animation config for the Facial Exercise Instructor.
   * NULL = no animation (static fallback). Non-NULL only for category='exercise'
   * rows with visible facial movement. Populated by migration
   * 1746000260000-M44AnimationConfigSeed (PR-D).
   *
   * DB CHECK `chk_rec_animation_config_schema` enforces:
   *   - schema_version = 1
   *   - primitives array length ≥ 1
   *
   * Frontend component: <SvgFaceInstructor> (PR-B).
   */
  @Column({ name: 'animation_config', type: 'jsonb', nullable: true })
  animationConfig!: AnimationConfig | null;

  /**
   * PR-A — Declarative biometric exercise config (anatomical zones + verbs).
   * NULL = no biometric animation (uses static fallback or animationConfig).
   *
   * DB CHECK `recommendation_catalog_biometric_config_chk` enforces:
   *   - schema_version = 1
   *   - steps array length ≥ 1
   *   - cycle_ms > 0
   *   - repeat ∈ {'infinite','once','reverse'}
   */
  @Column({ name: 'biometric_config', type: 'jsonb', nullable: true })
  biometricConfig!: BiometricExerciseConfig | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'NOW()' })
  createdAt!: Date;

  @OneToMany(() => RecommendationTriggerEntity, (t) => t.recommendation)
  triggers!: Relation<RecommendationTriggerEntity[]>;

  @OneToMany(() => RecommendationLinkEntity, (l) => l.recommendation)
  links!: Relation<RecommendationLinkEntity[]>;
}
