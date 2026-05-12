/**
 * SvgAnatomicalHand — per-joint configuration types.
 *
 * Coordinate convention:
 *   - Angles in degrees, 0° = fully extended, positive = flexion (closing).
 *   - Abduction in degrees, 0° = aligned with hand axis, positive = away from center.
 *   - ViewBox: 0 0 100 130, tip of index finger at (0, 0) in local space,
 *     palm / wrist extends downward (+Y).
 */

/** Per-finger joint config: MCP, PIP, DIP angles and lateral spread. */
export type FingerConfig = {
  /** Metacarpophalangeal flexion 0..90° */
  mcp: number;
  /** Proximal interphalangeal flexion 0..90° */
  pip: number;
  /** Distal interphalangeal flexion 0..90° */
  dip: number;
  /**
   * Abduction from the hand's center axis in degrees.
   * Positive = away from palm center (splay), negative = adducted.
   */
  abduction: number;
};

/** Thumb has an extra CMC joint (trapeziometacarpal). */
export type ThumbConfig = {
  /** Carpometacarpal flexion/opposition 0..60° */
  cmc: number;
  /** Metacarpophalangeal flexion 0..60° */
  mcp: number;
  /** Interphalangeal flexion 0..80° */
  ip: number;
  /**
   * Abduction from the hand plane in degrees.
   * Positive = away from index finger.
   */
  abduction: number;
};

/** Full hand joint configuration — all 5 digits. */
export type HandConfig = {
  thumb: ThumbConfig;
  index: FingerConfig;
  middle: FingerConfig;
  ring: FingerConfig;
  pinky: FingerConfig;
};

/** Action overlay added via Framer Motion micro-animation. */
export type HandAction = 'idle' | 'press' | 'pull' | 'massage';

/** Name of a built-in preset. */
export type HandPresetName =
  | 'open'
  | 'fist'
  | 'point'
  | 'two_finger_press'
  | 'pinch'
  | 'massage'
  | 'palm_press'
  | 'ok_sign'
  | 'chin_fist'
  | 'brow_press';

/** Computed points for a single finger in local SVG space. */
export type FingerPoints = {
  /** MCP joint position (knuckle). */
  mcp: { x: number; y: number };
  /** PIP joint position (middle knuckle). */
  pip: { x: number; y: number };
  /** DIP joint position (upper knuckle). */
  dip: { x: number; y: number };
  /** Finger tip. */
  tip: { x: number; y: number };
};

/** Computed geometry for the whole hand (before rotation/flip/scale). */
export type HandGeometry = {
  thumb: FingerPoints;
  index: FingerPoints;
  middle: FingerPoints;
  ring: FingerPoints;
  pinky: FingerPoints;
  /** Base of palm (wrist line center). */
  palmBase: { x: number; y: number };
};
