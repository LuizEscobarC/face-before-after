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

// ---------------------------------------------------------------------------
// PR-A — SVG Facial Exercise Instructor declarative animation types
// Full schema: `.claude/plans/fa-a-mais-uma-revis-o-quirky-hopper.md` §PR-A
// Mirror in frontend: `frontend/src/types/animationConfig.ts` (PR-B)
// ---------------------------------------------------------------------------

/**
 * All primitive movement IDs supported by <SvgFaceInstructor> (PR-B).
 * Grouped by region for readability.
 */
export type FacialPrimitiveId =
  // --- Brow ---
  | 'brow_lift_both'
  | 'brow_lift_left'
  | 'brow_lift_right'
  | 'brow_furrow'
  | 'brow_relax'
  // --- Eye ---
  | 'eye_squeeze_both'
  | 'eye_squeeze_lower'
  | 'eye_wide_open'
  | 'eye_blink_asymmetric'
  | 'eye_track_horizontal'
  | 'eye_track_figure8'
  // --- Lip / Mouth ---
  | 'lip_pucker'
  | 'lip_seal'
  | 'lip_wide_smile'
  | 'lip_corner_lift_left'
  | 'lip_corner_lift_right'
  | 'lip_resistance_pull'
  | 'lip_trill_vibration'
  // --- Tongue (x-ray overlay when show_xray=true) ---
  | 'tongue_palate_press'
  | 'tongue_lateral_left'
  | 'tongue_lateral_right'
  | 'tongue_extra_oral_down'
  | 'tongue_click'
  | 'tongue_sweep_circular'
  // --- Jaw ---
  | 'jaw_clench'
  | 'jaw_protrusion'
  | 'jaw_retrusion'
  | 'jaw_lateral_left'
  | 'jaw_lateral_right'
  | 'jaw_open_wide'
  | 'jaw_infinity'
  // --- Cheek ---
  | 'cheek_puff_both'
  | 'cheek_puff_left'
  | 'cheek_puff_right'
  | 'cheek_lift_smile'
  // --- Neck / Cervical ---
  | 'neck_chin_tuck'
  | 'neck_extension'
  | 'neck_rotation_left'
  | 'neck_rotation_right'
  | 'neck_lateral_flex'
  // --- Static / informational ---
  | 'static_breathing_indicator'
  | 'static_posture_silhouette';

/** All supported heat-region identifiers (anatomical muscle zones). */
export type HeatRegionId =
  | 'frontalis'
  | 'masseter_l'
  | 'masseter_r'
  | 'orbicularis_oris'
  | 'orbicularis_oculi_l'
  | 'orbicularis_oculi_r'
  | 'platysma'
  | 'mentalis'
  | 'zygomaticus_l'
  | 'zygomaticus_r'
  | 'corrugator'
  | 'buccinator_l'
  | 'buccinator_r'
  | 'temporalis'
  | 'suboccipital'
  | 'scm_l'
  | 'scm_r';

/**
 * Declarative animation config stored in `recommendation_catalog.animation_config`.
 * Interpreted by `<SvgFaceInstructor>` (frontend PR-B).
 *
 * Invariants (enforced by DB CHECK `chk_rec_animation_config_schema`):
 *   - schema_version === 1
 *   - primitives.length >= 1 OR recorded_timeline.frames.length >= 1
 */
export type AnimationConfig = {
  /** Always 1. Guard for future schema migrations. */
  schema_version: 1;

  /** One or more movement primitives to activate. Rendered in order. */
  primitives: Array<{
    id: FacialPrimitiveId;
    /** Movement amplitude 0..1. Default 1. */
    intensity?: number;
    /** Delay before this primitive starts animating, in ms. Default 0. */
    delay_ms?: number;
  }>;

  /** Duration of one full animation cycle in ms. Default 2000. */
  duration_ms: number;

  /**
   * How long (ms) to hold the peak position before returning.
   * Use for isometric exercises (masseter clench, mewing press). Default 0.
   */
  hold_ms?: number;

  /** Animation repeat mode. */
  repeat: 'infinite' | 'reverse' | 'once';

  /**
   * Anatomical heat regions to highlight with a pulsing blur overlay.
   * These are the muscles the user should feel contracting.
   */
  heat_regions?: Array<{
    region: HeatRegionId;
    /** If true, region pulses in/out to indicate active contraction. */
    pulse: boolean;
  }>;

  /**
   * Short Portuguese caption to display below the SVG.
   * Tells the user what they should feel (e.g. "Sinta o músculo tensionar aqui").
   */
  caption_pt?: string;

  /**
   * When true, the face skin is rendered semi-transparent (opacity 0.4),
   * revealing tongue/jaw primitives as a pseudo-X-ray effect.
   * Required for tongue primitives (tongue_palate_press, tongue_lateral_*, etc.).
   */
  show_xray?: boolean;

  /**
   * Optional recorded landmark timeline from webcam capture (PR-64).
   * When present with frames, `primitives` may be empty — the animation is
   * driven entirely by the landmark data via LandmarkRig.
   */
  recorded_timeline?: {
    fps: number;
    duration_ms: number;
    frames: Array<{
      t: number;
      delta: Record<string, unknown>;
      landmarks?: number[][];
    }>;
  };
};

export const FACIAL_PRIMITIVE_IDS: readonly FacialPrimitiveId[] = [
  'brow_lift_both', 'brow_lift_left', 'brow_lift_right', 'brow_furrow', 'brow_relax',
  'eye_squeeze_both', 'eye_squeeze_lower', 'eye_wide_open', 'eye_blink_asymmetric', 'eye_track_horizontal', 'eye_track_figure8',
  'lip_pucker', 'lip_seal', 'lip_wide_smile', 'lip_corner_lift_left', 'lip_corner_lift_right', 'lip_resistance_pull', 'lip_trill_vibration',
  'tongue_palate_press', 'tongue_lateral_left', 'tongue_lateral_right', 'tongue_extra_oral_down', 'tongue_click', 'tongue_sweep_circular',
  'jaw_clench', 'jaw_protrusion', 'jaw_retrusion', 'jaw_lateral_left', 'jaw_lateral_right', 'jaw_open_wide', 'jaw_infinity',
  'cheek_puff_both', 'cheek_puff_left', 'cheek_puff_right', 'cheek_lift_smile',
  'neck_chin_tuck', 'neck_extension', 'neck_rotation_left', 'neck_rotation_right', 'neck_lateral_flex',
  'static_breathing_indicator', 'static_posture_silhouette',
] as const;

export const HEAT_REGION_IDS: readonly HeatRegionId[] = [
  'frontalis', 'masseter_l', 'masseter_r', 'orbicularis_oris', 'orbicularis_oculi_l', 'orbicularis_oculi_r',
  'platysma', 'mentalis', 'zygomaticus_l', 'zygomaticus_r', 'corrugator', 'buccinator_l', 'buccinator_r',
  'temporalis', 'suboccipital', 'scm_l', 'scm_r',
] as const;

// ── PR-A — Biometric exercise schema (anatomical zone + verb) ──────────────

export type AnatomicalZoneId =
  | 'frontalis' | 'corrugator'
  | 'orbicularis_oculi_l' | 'orbicularis_oculi_r'
  | 'temporalis_l' | 'temporalis_r'
  | 'zygomaticus_l' | 'zygomaticus_r'
  | 'masseter_l' | 'masseter_r'
  | 'orbicularis_oris' | 'mentalis'
  | 'buccinator_l' | 'buccinator_r'
  | 'tmj_joint_l' | 'tmj_joint_r'
  | 'platysma' | 'scm_l' | 'scm_r' | 'suboccipital';

export type MovementVerb =
  | 'stretch' | 'compress' | 'massage_circular' | 'isometric_hold' | 'rotate_around_pivot';

export type PivotId = 'tmj_l' | 'tmj_r' | 'tmj_center' | 'atlas_c1' | 'occipital_c0';

export type Vec2 = { x: number; y: number };

export type BiometricStep = {
  zone: AnatomicalZoneId;
  verb: MovementVerb;
  vector?: Vec2;
  amplitude?: number;
  pivot?: PivotId;
  angle_deg?: number;
  duration_ms: number;
  hold_ms?: number;
  delay_ms?: number;
  heat_intensity?: number;
};

export type BiometricExerciseConfig = {
  schema_version: 1;
  steps: BiometricStep[];
  cycle_ms: number;
  repeat: 'infinite' | 'once' | 'reverse';
  caption_pt?: string;
  fallback_avatar?: boolean;
};

export const ANATOMICAL_ZONE_IDS: readonly AnatomicalZoneId[] = [
  'frontalis','corrugator','orbicularis_oculi_l','orbicularis_oculi_r',
  'temporalis_l','temporalis_r','zygomaticus_l','zygomaticus_r',
  'masseter_l','masseter_r','orbicularis_oris','mentalis',
  'buccinator_l','buccinator_r','tmj_joint_l','tmj_joint_r',
  'platysma','scm_l','scm_r','suboccipital',
];
export const MOVEMENT_VERBS: readonly MovementVerb[] = [
  'stretch','compress','massage_circular','isometric_hold','rotate_around_pivot',
];
export const PIVOT_IDS: readonly PivotId[] = [
  'tmj_l','tmj_r','tmj_center','atlas_c1','occipital_c0',
];
