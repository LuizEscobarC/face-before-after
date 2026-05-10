// PR-A — Biometric exercise schema (frontend mirror of backend types).
// Source of truth: nest/src/modules/diagnosis/domain/types/recommendation.types.ts
// Self-contained — must not import from outside frontend/src.

export type AnatomicalZoneId =
  | 'frontalis'
  | 'corrugator'
  | 'orbicularis_oculi_l'
  | 'orbicularis_oculi_r'
  | 'temporalis_l'
  | 'temporalis_r'
  | 'zygomaticus_l'
  | 'zygomaticus_r'
  | 'masseter_l'
  | 'masseter_r'
  | 'orbicularis_oris'
  | 'mentalis'
  | 'buccinator_l'
  | 'buccinator_r'
  | 'tmj_joint_l'
  | 'tmj_joint_r'
  | 'platysma'
  | 'scm_l'
  | 'scm_r'
  | 'suboccipital';

export type MovementVerb =
  | 'stretch'
  | 'compress'
  | 'massage_circular'
  | 'isometric_hold'
  | 'rotate_around_pivot';

export type Vec2 = { x: number; y: number };

export type PivotId = 'tmj_l' | 'tmj_r' | 'tmj_center' | 'atlas_c1' | 'occipital_c0';

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
