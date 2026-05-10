/**
 * PR-55 / PR-55b — Domain types for the M4.3 Recommendation Catalog
 *
 * Updated 2026-05-09 (PR-55b — invasiveness ladder). See plan:
 * `.claude/plans/fa-a-mais-uma-revis-o-quirky-hopper.md` and migration
 * `1746000230000-M44RecommendationLadder.ts`.
 *
 * Shared by:
 *   - TypeORM entities (infrastructure/entities/*)
 *   - RecommendationEngine service (PR-57)
 *   - DiagnosticPriorityService (PR-58)
 *   - Narrative endpoint DTO (PR-59)
 */

/**
 * Categories for recommendation_catalog.category — 5-level invasiveness
 * ladder (level 0 = least invasive, level 4 = clinical/surgical).
 * `professional_referral` is informational only — never required.
 */
export const RECOMMENDATION_CATEGORIES = [
  'photo',                  // level 0
  'presentation_only',      // level 0 (info-only)
  'posture',                // level 1
  'lifestyle',              // level 1
  'exercise',               // level 2 (PR-55b)
  'styling',                // level 3
  'aesthetic_procedure',    // level 4a (PR-55b)
  'professional_referral',  // level 4b
] as const;

export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];

/** Mapping category → invasiveness ladder level (mirrors the SQL backfill). */
export const CATEGORY_TO_INVASIVENESS: Record<RecommendationCategory, number> = {
  photo: 0,
  presentation_only: 0,
  posture: 1,
  lifestyle: 1,
  exercise: 2,
  styling: 3,
  aesthetic_procedure: 4,
  professional_referral: 4,
};

/** Effort estimate levels for recommendation_catalog.effort_estimate */
export const EFFORT_ESTIMATES = ['low', 'medium', 'high'] as const;
export type EffortEstimate = (typeof EFFORT_ESTIMATES)[number];

/**
 * Evidence level for the recommendation. Drives whether a disclaimer is
 * required (`anecdotal` rows must populate `disclaimer_template`).
 */
export const EVIDENCE_LEVELS = ['strong', 'moderate', 'anecdotal'] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

/**
 * Professional specialties for recommendation_catalog.professional_type.
 * NULL when requires_professional=FALSE.
 */
export const PROFESSIONAL_TYPES = [
  'dentist',
  'physiotherapist',
  'dermatologist',
  'otolaryngologist',
  'plastic_surgeon',
  'orthodontist',
  'oral_maxillofacial_surgeon',
] as const;

export type ProfessionalType = (typeof PROFESSIONAL_TYPES)[number];

/** Editorial label for {professional_type_pt} placeholder in disclaimer text. */
export const PROFESSIONAL_TYPE_LABEL_PT: Record<ProfessionalType, string> = {
  dentist: 'odontologia',
  physiotherapist: 'fisioterapia / postura cervical',
  dermatologist: 'dermatologia',
  otolaryngologist: 'otorrino / função respiratória',
  plastic_surgeon: 'cirurgia plástica',
  orthodontist: 'ortodontia',
  oral_maxillofacial_surgeon: 'buco-maxilo',
};

/** Reference entry for recommendation_catalog.references_jsonb. */
export type RecommendationReference = {
  citation: string;
  url?: string;
};
