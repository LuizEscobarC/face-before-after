/**
 * PR-B — FaceState: the additive delta layer that primitives compose into.
 *
 * Every primitive returns a `Partial<FaceState>` (the "peak" of its movement).
 * SvgFaceInstructor sums all primitives' deltas into a single peak state,
 * passes it to FaceBase, which animates from neutral (default 0 / 1) to peak
 * via Framer Motion's `animate` prop.
 */

export type FaceState = {
  // --- Global / skin ---
  /** 1 = solid skin, 0.4 = pseudo X-ray (reveals tongue layer). */
  skinOpacity: number;

  // --- Whole-face transforms (head movement) ---
  /** Yaw (Y-axis rotation in degrees), used by neck_rotation_*. */
  faceRotate: number;
  /** Roll (Z-axis tilt in degrees), used by neck_lateral_flex. */
  faceTilt: number;
  /** Pitch (X-axis nod in degrees, + = looking down, - = up). */
  facePitch: number;
  /** Translate Y of the whole face group, used by neck_chin_tuck (negative = retract). */
  faceDy: number;

  // --- Brow ---
  browLDy: number; browLDx: number; browLRotate: number;
  browRDy: number; browRDx: number; browRRotate: number;

  // --- Eye (pupils + lid openness) ---
  /** Pupil offset relative to centre. */
  eyeLDx: number; eyeLDy: number;
  eyeRDx: number; eyeRDy: number;
  /** 1.0 = neutral aperture; 0.0 = closed; 1.5 = wide. */
  eyeLOpenness: number;
  eyeROpenness: number;

  // --- Cheek ---
  /** 1.0 = neutral; > 1 = puffed/lifted. */
  cheekLScale: number;
  cheekRScale: number;
  cheekLDy: number;
  cheekRDy: number;

  // --- Nose ---
  /** 1.0 = neutral; > 1 = flared. */
  noseFlare: number;

  // --- Mouth ---
  mouthScaleX: number;
  mouthScaleY: number;
  mouthDy: number;
  /** Lip corners (Y delta — negative = lifted, positive = dropped). */
  lipCornerLDy: number;
  lipCornerRDy: number;
  /** Visual mouth shape — last-write-wins among primitives that touch mouth. */
  mouthShape: MouthShape;

  // --- Jaw / mandible ---
  jawScaleX: number;
  jawDy: number;
  jawDx: number;
  /** Protrusion / retrusion (z-axis). + = forward, - = back. Range ~ -1..+1. */
  jawDz: number;

  // --- Tongue overlay (visible only when show_xray=true OR a tongue primitive is active) ---
  tongueVisible: boolean;
  tongueShape: TongueShape;
  tongueDx: number;
  tongueDy: number;

  // --- Neck (only renders when any neck primitive is active) ---
  showNeck: boolean;

  // --- Decorative overlays ---
  showBreathingIndicator: boolean;
  showPostureSilhouette: boolean;
};

export type MouthShape =
  | 'smile'      // gentle upturn (default)
  | 'pucker'     // 'O' shape
  | 'wide_smile' // big stretched smile
  | 'open'       // mouth open (jaw drop)
  | 'seal'       // lips firmly pressed
  | 'flat'       // neutral line
  | 'pull';      // pulled outward against resistance

export type TongueShape =
  | 'palate_press' // flat against roof
  | 'lateral_l'
  | 'lateral_r'
  | 'extended_down'
  | 'tip'
  | 'sweep'
  | 'rest';

/** Identity / starting state for the rest pose. All deltas = 0; scales = 1. */
export const NEUTRAL_FACE_STATE: FaceState = {
  skinOpacity: 1,
  faceRotate: 0,
  faceTilt: 0,
  facePitch: 0,
  faceDy: 0,
  browLDy: 0, browLDx: 0, browLRotate: 0,
  browRDy: 0, browRDx: 0, browRRotate: 0,
  eyeLDx: 0, eyeLDy: 0,
  eyeRDx: 0, eyeRDy: 0,
  eyeLOpenness: 1, eyeROpenness: 1,
  cheekLScale: 1, cheekRScale: 1,
  cheekLDy: 0, cheekRDy: 0,
  noseFlare: 1,
  mouthScaleX: 1, mouthScaleY: 1, mouthDy: 0,
  lipCornerLDy: 0, lipCornerRDy: 0,
  mouthShape: 'smile',
  jawScaleX: 1, jawDy: 0, jawDx: 0, jawDz: 0,
  tongueVisible: false,
  tongueShape: 'rest',
  tongueDx: 0, tongueDy: 0,
  showNeck: false,
  showBreathingIndicator: false,
  showPostureSilhouette: false,
};
