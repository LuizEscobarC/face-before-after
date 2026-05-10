/**
 * PR-B — Frontend mirror of backend AnimationConfig domain types.
 *
 * Source of truth: nest/src/modules/diagnosis/domain/types/recommendation.types.ts
 * (FacialPrimitiveId, HeatRegionId, AnimationConfig — search "PR-A" header).
 *
 * Keep these two files synchronised. If the backend adds a primitive id, the
 * frontend renderer registry (components/SvgFaceInstructor/primitives/index.ts)
 * MUST learn how to render it before the seed migration (PR-D) ships.
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

export type AnimationPrimitive = {
  id: FacialPrimitiveId;
  intensity?: number;
  delay_ms?: number;
};

export type HeatRegionConfig = {
  region: HeatRegionId;
  pulse: boolean;
};

export type AnimationConfig = {
  schema_version: 1;
  primitives: AnimationPrimitive[];
  duration_ms: number;
  hold_ms?: number;
  repeat: 'infinite' | 'reverse' | 'once';
  heat_regions?: HeatRegionConfig[];
  caption_pt?: string;
  show_xray?: boolean;
};

/** Full enumerated list of valid primitive ids — used by registry + admin gallery. */
export const ALL_FACIAL_PRIMITIVE_IDS: readonly FacialPrimitiveId[] = [
  'brow_lift_both',
  'brow_lift_left',
  'brow_lift_right',
  'brow_furrow',
  'brow_relax',
  'eye_squeeze_both',
  'eye_squeeze_lower',
  'eye_wide_open',
  'eye_blink_asymmetric',
  'eye_track_horizontal',
  'eye_track_figure8',
  'lip_pucker',
  'lip_seal',
  'lip_wide_smile',
  'lip_corner_lift_left',
  'lip_corner_lift_right',
  'lip_resistance_pull',
  'lip_trill_vibration',
  'tongue_palate_press',
  'tongue_lateral_left',
  'tongue_lateral_right',
  'tongue_extra_oral_down',
  'tongue_click',
  'tongue_sweep_circular',
  'jaw_clench',
  'jaw_protrusion',
  'jaw_retrusion',
  'jaw_lateral_left',
  'jaw_lateral_right',
  'jaw_open_wide',
  'jaw_infinity',
  'cheek_puff_both',
  'cheek_puff_left',
  'cheek_puff_right',
  'cheek_lift_smile',
  'neck_chin_tuck',
  'neck_extension',
  'neck_rotation_left',
  'neck_rotation_right',
  'neck_lateral_flex',
  'static_breathing_indicator',
  'static_posture_silhouette',
] as const;

export const ALL_HEAT_REGION_IDS: readonly HeatRegionId[] = [
  'frontalis',
  'masseter_l',
  'masseter_r',
  'orbicularis_oris',
  'orbicularis_oculi_l',
  'orbicularis_oculi_r',
  'platysma',
  'mentalis',
  'zygomaticus_l',
  'zygomaticus_r',
  'corrugator',
  'buccinator_l',
  'buccinator_r',
  'temporalis',
  'suboccipital',
  'scm_l',
  'scm_r',
] as const;
