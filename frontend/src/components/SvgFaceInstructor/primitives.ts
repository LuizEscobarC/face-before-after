import type { FacialPrimitiveId } from '../../types/animationConfig';
import type { FaceState } from './faceState';

/**
 * PR-B — Primitive registry: every FacialPrimitiveId maps to a function that
 * receives `intensity` (0..1, default 1) and returns a `Partial<FaceState>`
 * describing the deformation at the peak of the movement.
 *
 * SvgFaceInstructor sums all primitives' deltas into a single `peak: FaceState`
 * (added on top of NEUTRAL_FACE_STATE) and feeds it to FaceBase.
 *
 * Compose rules:
 *   - Numeric deltas: ADDED for "Dx/Dy/Rotate/Tilt" fields (relative offsets)
 *   - Numeric scales: MULTIPLIED for "Scale/Openness/Flare" fields (relative %)
 *   - Booleans / strings: LAST-WRITE-WINS (later primitive overrides)
 *
 * Every value is bounded to keep the visual within the SVG viewBox.
 */
export type PrimitiveRenderer = (intensity: number) => Partial<FaceState>;

const i = (intensity: number) => Math.max(0, Math.min(1, intensity));

export const PRIMITIVE_REGISTRY: Record<FacialPrimitiveId, PrimitiveRenderer> = {
  // ============================================================
  // BROW (5)
  // ============================================================
  brow_lift_both: (n) => ({
    browLDy: -6 * i(n),
    browRDy: -6 * i(n),
    browLRotate: -3 * i(n),
    browRRotate: 3 * i(n),
  }),
  brow_lift_left: (n) => ({
    browLDy: -7 * i(n),
    browLRotate: -4 * i(n),
  }),
  brow_lift_right: (n) => ({
    browRDy: -7 * i(n),
    browRRotate: 4 * i(n),
  }),
  brow_furrow: (n) => ({
    browLDx: 4 * i(n),
    browRDx: -4 * i(n),
    browLDy: 1.5 * i(n),
    browRDy: 1.5 * i(n),
  }),
  brow_relax: (n) => ({
    browLDy: 1.2 * i(n),
    browRDy: 1.2 * i(n),
  }),

  // ============================================================
  // EYE (6)
  // ============================================================
  eye_squeeze_both: (n) => ({
    eyeLOpenness: 1 - 0.85 * i(n),
    eyeROpenness: 1 - 0.85 * i(n),
  }),
  eye_squeeze_lower: (n) => ({
    eyeLOpenness: 1 - 0.55 * i(n),
    eyeROpenness: 1 - 0.55 * i(n),
    cheekLDy: -1.5 * i(n),
    cheekRDy: -1.5 * i(n),
  }),
  eye_wide_open: (n) => ({
    eyeLOpenness: 1 + 0.6 * i(n),
    eyeROpenness: 1 + 0.6 * i(n),
    browLDy: -2 * i(n),
    browRDy: -2 * i(n),
  }),
  eye_blink_asymmetric: (n) => ({
    eyeLOpenness: 1 - 0.95 * i(n),
    eyeROpenness: 1,
  }),
  eye_track_horizontal: (n) => ({
    eyeLDx: 2.5 * i(n),
    eyeRDx: 2.5 * i(n),
  }),
  eye_track_figure8: (n) => ({
    // Visualised as a diagonal pupil shift; the looping motion comes from
    // Framer's repeat:'mirror' on the animate target.
    eyeLDx: 2 * i(n),
    eyeLDy: -1.5 * i(n),
    eyeRDx: 2 * i(n),
    eyeRDy: -1.5 * i(n),
  }),

  // ============================================================
  // LIP / MOUTH (7)
  // ============================================================
  lip_pucker: (n) => ({
    mouthShape: 'pucker',
    mouthScaleX: 1 - 0.4 * i(n),
    mouthScaleY: 1 + 0.5 * i(n),
  }),
  lip_seal: (n) => ({
    mouthShape: 'seal',
    mouthScaleY: 1 - 0.4 * i(n),
  }),
  lip_wide_smile: (n) => ({
    mouthShape: 'wide_smile',
    mouthScaleX: 1 + 0.35 * i(n),
    lipCornerLDy: -2 * i(n),
    lipCornerRDy: -2 * i(n),
    cheekLScale: 1 + 0.15 * i(n),
    cheekRScale: 1 + 0.15 * i(n),
  }),
  lip_corner_lift_left: (n) => ({
    lipCornerLDy: -3 * i(n),
    cheekLScale: 1 + 0.2 * i(n),
  }),
  lip_corner_lift_right: (n) => ({
    lipCornerRDy: -3 * i(n),
    cheekRScale: 1 + 0.2 * i(n),
  }),
  lip_resistance_pull: (n) => ({
    mouthShape: 'pull',
    mouthScaleX: 1 + 0.5 * i(n),
    mouthScaleY: 1 - 0.2 * i(n),
  }),
  lip_trill_vibration: (n) => ({
    mouthShape: 'pucker',
    mouthScaleX: 1 - 0.3 * i(n),
    mouthScaleY: 1 + 0.3 * i(n),
    // The "vibration" feel comes from the short duration_ms typically
    // configured on this primitive (e.g. 300ms with repeat=infinite).
  }),

  // ============================================================
  // TONGUE (6) — all force tongueVisible=true; show_xray recommended
  // ============================================================
  tongue_palate_press: (n) => ({
    tongueVisible: true,
    tongueShape: 'palate_press',
    tongueDy: -2 * i(n),
    mouthShape: 'seal',
  }),
  tongue_lateral_left: (n) => ({
    tongueVisible: true,
    tongueShape: 'lateral_l',
    tongueDx: -2 * i(n),
    cheekLScale: 1 + 0.2 * i(n),
  }),
  tongue_lateral_right: (n) => ({
    tongueVisible: true,
    tongueShape: 'lateral_r',
    tongueDx: 2 * i(n),
    cheekRScale: 1 + 0.2 * i(n),
  }),
  tongue_extra_oral_down: (n) => ({
    tongueVisible: true,
    tongueShape: 'extended_down',
    tongueDy: 6 * i(n),
    mouthShape: 'open',
    jawDy: 2 * i(n),
  }),
  tongue_click: (n) => ({
    tongueVisible: true,
    tongueShape: 'tip',
    mouthShape: 'open',
    jawDy: 1 * i(n),
  }),
  tongue_sweep_circular: (n) => ({
    tongueVisible: true,
    tongueShape: 'sweep',
    cheekLScale: 1 + 0.1 * i(n),
    cheekRScale: 1 + 0.1 * i(n),
  }),

  // ============================================================
  // JAW (7)
  // ============================================================
  jaw_clench: (n) => ({
    jawScaleX: 1 + 0.06 * i(n),
    mouthShape: 'seal',
  }),
  jaw_protrusion: (n) => ({
    jawDy: 2 * i(n),
    jawScaleX: 1 + 0.04 * i(n),
    lipCornerLDy: 1 * i(n),
    lipCornerRDy: 1 * i(n),
  }),
  jaw_retrusion: (n) => ({
    jawDy: -1.5 * i(n),
    jawScaleX: 1 - 0.05 * i(n),
  }),
  jaw_lateral_left: (n) => ({
    jawDx: -4 * i(n),
  }),
  jaw_lateral_right: (n) => ({
    jawDx: 4 * i(n),
  }),
  jaw_open_wide: (n) => ({
    jawDy: 8 * i(n),
    mouthShape: 'open',
    mouthScaleY: 1 + 0.6 * i(n),
  }),
  jaw_infinity: (n) => ({
    // Static peak shows the rightmost loop position; the looping comes from
    // Framer's repeat:'mirror' over the animation cycle.
    jawDx: 3 * i(n),
    jawDy: 1.5 * i(n),
  }),

  // ============================================================
  // CHEEK (4)
  // ============================================================
  cheek_puff_both: (n) => ({
    cheekLScale: 1 + 0.45 * i(n),
    cheekRScale: 1 + 0.45 * i(n),
    mouthShape: 'seal',
  }),
  cheek_puff_left: (n) => ({
    cheekLScale: 1 + 0.55 * i(n),
    mouthShape: 'seal',
  }),
  cheek_puff_right: (n) => ({
    cheekRScale: 1 + 0.55 * i(n),
    mouthShape: 'seal',
  }),
  cheek_lift_smile: (n) => ({
    cheekLScale: 1 + 0.25 * i(n),
    cheekRScale: 1 + 0.25 * i(n),
    cheekLDy: -1 * i(n),
    cheekRDy: -1 * i(n),
    lipCornerLDy: -2 * i(n),
    lipCornerRDy: -2 * i(n),
    mouthShape: 'wide_smile',
    eyeLOpenness: 1 - 0.3 * i(n),
    eyeROpenness: 1 - 0.3 * i(n),
  }),

  // ============================================================
  // NECK (5) — all force showNeck=true
  // ============================================================
  neck_chin_tuck: (n) => ({
    showNeck: true,
    faceDy: -2 * i(n),
    jawDy: -1 * i(n),
  }),
  neck_extension: (n) => ({
    showNeck: true,
    faceTilt: -8 * i(n),
    faceDy: 1 * i(n),
  }),
  neck_rotation_left: (n) => ({
    showNeck: true,
    faceRotate: -18 * i(n),
  }),
  neck_rotation_right: (n) => ({
    showNeck: true,
    faceRotate: 18 * i(n),
  }),
  neck_lateral_flex: (n) => ({
    showNeck: true,
    faceTilt: 14 * i(n),
  }),

  // ============================================================
  // STATIC / informational (2)
  // ============================================================
  static_breathing_indicator: () => ({
    showBreathingIndicator: true,
  }),
  static_posture_silhouette: () => ({
    showPostureSilhouette: true,
    showNeck: true,
  }),
};

/**
 * Field-by-field composition rules.
 *  - 'add'      → sum delta (offsets, rotations)
 *  - 'multiply' → multiply (scales, opacity, openness)
 *  - 'last'     → last-write-wins (booleans, strings)
 */
type ComposeRule = 'add' | 'multiply' | 'last';

const COMPOSE_RULES: Record<keyof FaceState, ComposeRule> = {
  skinOpacity: 'multiply',
  faceRotate: 'add',
  faceTilt: 'add',
  faceDy: 'add',
  browLDy: 'add', browLDx: 'add', browLRotate: 'add',
  browRDy: 'add', browRDx: 'add', browRRotate: 'add',
  eyeLDx: 'add', eyeLDy: 'add', eyeRDx: 'add', eyeRDy: 'add',
  eyeLOpenness: 'multiply', eyeROpenness: 'multiply',
  cheekLScale: 'multiply', cheekRScale: 'multiply',
  cheekLDy: 'add', cheekRDy: 'add',
  noseFlare: 'multiply',
  mouthScaleX: 'multiply', mouthScaleY: 'multiply', mouthDy: 'add',
  lipCornerLDy: 'add', lipCornerRDy: 'add',
  mouthShape: 'last',
  jawScaleX: 'multiply', jawDy: 'add', jawDx: 'add',
  tongueVisible: 'last',
  tongueShape: 'last',
  tongueDx: 'add', tongueDy: 'add',
  showNeck: 'last',
  showBreathingIndicator: 'last',
  showPostureSilhouette: 'last',
};

/**
 * Compose multiple primitive deltas onto a base FaceState.
 * Boolean OR semantics: if ANY primitive sets `tongueVisible=true` or
 * `showNeck=true`, the result is true even if a later primitive doesn't touch
 * it. The 'last' rule above handles explicit overrides correctly because
 * primitives that DON'T set a field don't appear in the delta at all.
 */
export function composeFaceState(
  base: FaceState,
  deltas: Array<Partial<FaceState>>,
): FaceState {
  const out: FaceState = { ...base };
  for (const delta of deltas) {
    for (const key of Object.keys(delta) as Array<keyof FaceState>) {
      const rule = COMPOSE_RULES[key];
      const incoming = delta[key];
      if (incoming === undefined) continue;
      if (rule === 'add' && typeof incoming === 'number') {
        (out[key] as number) = (out[key] as number) + incoming;
      } else if (rule === 'multiply' && typeof incoming === 'number') {
        (out[key] as number) = (out[key] as number) * incoming;
      } else {
        // last-write-wins (booleans and strings) — except booleans should OR.
        if (typeof incoming === 'boolean') {
          (out[key] as boolean) = (out[key] as boolean) || incoming;
        } else {
          (out as Record<string, unknown>)[key] = incoming;
        }
      }
    }
  }
  return out;
}
