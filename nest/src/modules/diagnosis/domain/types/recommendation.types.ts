/**
 * PR-55 — Domain types for the M4.3 Recommendation Catalog
 *
 * These constants and types are shared by:
 *   - TypeORM entities (infrastructure/entities/*)
 *   - RecommendationEngine service (PR-57)
 *   - DiagnosticPriorityService (PR-58)
 *   - Narrative endpoint DTO (PR-59)
 */

/** Categories for recommendation_catalog.category */
export const RECOMMENDATION_CATEGORIES = [
  'photo',
  'posture',
  'lifestyle',
  'styling',
  'professional_referral',
  'presentation_only',
] as const;

export type RecommendationCategory = (typeof RECOMMENDATION_CATEGORIES)[number];

/** Effort estimate levels for recommendation_catalog.effort_estimate */
export const EFFORT_ESTIMATES = ['low', 'medium', 'high'] as const;
export type EffortEstimate = (typeof EFFORT_ESTIMATES)[number];

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
] as const;

export type ProfessionalType = (typeof PROFESSIONAL_TYPES)[number];
