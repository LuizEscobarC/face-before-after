/**
 * SvgAnatomicalHand — named pose presets.
 *
 * Each preset is a full HandConfig describing anatomically-plausible joint
 * angles for a specific interaction pattern.
 */

import type { HandConfig, HandPresetName } from './types';

const EXTENDED_FINGER = { mcp: 0, pip: 0, dip: 0, abduction: 3 } as const;
const FIST_FINGER = { mcp: 75, pip: 85, dip: 65, abduction: 0 } as const;
const RELAXED_THUMB = { cmc: 10, mcp: 5, ip: 5, abduction: 30 } as const;

export const HAND_PRESETS: Record<HandPresetName, HandConfig> = {
  /**
   * Open palm — all fingers extended with gentle natural spread.
   * Use for: general display, palm-up instruction cards.
   */
  open: {
    thumb:  { cmc: 10, mcp: 10, ip: 10, abduction: 40 },
    index:  { mcp: 5,  pip: 5,  dip: 0,  abduction: 8 },
    middle: { mcp: 5,  pip: 5,  dip: 0,  abduction: 4 },
    ring:   { mcp: 5,  pip: 5,  dip: 0,  abduction: -2 },
    pinky:  { mcp: 8,  pip: 8,  dip: 0,  abduction: -8 },
  },

  /**
   * Closed fist — all fingers fully flexed.
   * Use for: chin-fist resistance, jaw clenching exercises.
   */
  fist: {
    thumb:  { cmc: 30, mcp: 25, ip: 20, abduction: 5 },
    index:  FIST_FINGER,
    middle: { ...FIST_FINGER, mcp: 78, pip: 88 },
    ring:   { ...FIST_FINGER, mcp: 72, pip: 82 },
    pinky:  { ...FIST_FINGER, mcp: 70, pip: 78, dip: 60 },
  },

  /**
   * Pointing — index fully extended, all others closed.
   * Use for: single-point pressure (e.g., temple, philtrum traction).
   */
  point: {
    thumb:  { cmc: 15, mcp: 10, ip: 5, abduction: 15 },
    index:  EXTENDED_FINGER,
    middle: FIST_FINGER,
    ring:   FIST_FINGER,
    pinky:  { ...FIST_FINGER, dip: 55 },
  },

  /**
   * Two-finger press — index + middle extended, others closed.
   * Use for: brow isometric (fingers on forehead), cervical pressure.
   */
  two_finger_press: {
    thumb:  { cmc: 15, mcp: 10, ip: 5, abduction: 20 },
    index:  { mcp: 8,  pip: 8,  dip: 0, abduction: 5 },
    middle: { mcp: 8,  pip: 8,  dip: 0, abduction: 0 },
    ring:   FIST_FINGER,
    pinky:  { ...FIST_FINGER, dip: 55 },
  },

  /**
   * Pinch — index tip meets thumb tip; others lightly flexed.
   * Use for: lip traction, small-zone exercises.
   */
  pinch: {
    thumb:  { cmc: 30, mcp: 40, ip: 30, abduction: 10 },
    index:  { mcp: 35, pip: 40, dip: 25, abduction: -3 },
    middle: { mcp: 25, pip: 30, dip: 20, abduction: 4 },
    ring:   { mcp: 35, pip: 45, dip: 30, abduction: 0 },
    pinky:  { mcp: 45, pip: 55, dip: 40, abduction: -5 },
  },

  /**
   * Massage hand — all fingers gently curved, spread.
   * Use for: circular masseter massage, gua-sha simulation.
   */
  massage: {
    thumb:  { cmc: 20, mcp: 15, ip: 10, abduction: 35 },
    index:  { mcp: 20, pip: 25, dip: 10, abduction: 10 },
    middle: { mcp: 22, pip: 28, dip: 12, abduction: 5 },
    ring:   { mcp: 20, pip: 25, dip: 10, abduction: -2 },
    pinky:  { mcp: 22, pip: 30, dip: 15, abduction: -8 },
  },

  /**
   * Palm press — fingers close together, gentle curve, flat contact surface.
   * Use for: broad pressure on cheeks or temples.
   */
  palm_press: {
    thumb:  { cmc: 12, mcp: 8, ip: 5, abduction: 20 },
    index:  { mcp: 10, pip: 10, dip: 5, abduction: 2 },
    middle: { mcp: 10, pip: 10, dip: 5, abduction: 0 },
    ring:   { mcp: 10, pip: 10, dip: 5, abduction: -2 },
    pinky:  { mcp: 12, pip: 12, dip: 5, abduction: -4 },
  },

  /**
   * OK sign — index tip meets thumb; ring + pinky extended.
   * Use for: precise single-muscle targeting.
   */
  ok_sign: {
    thumb:  { cmc: 25, mcp: 35, ip: 25, abduction: 8 },
    index:  { mcp: 30, pip: 35, dip: 20, abduction: -5 },
    middle: { mcp: 10, pip: 10, dip: 0, abduction: 4 },
    ring:   { mcp: 8,  pip: 8,  dip: 0, abduction: -2 },
    pinky:  { mcp: 8,  pip: 8,  dip: 0, abduction: -8 },
  },

  /**
   * Chin fist — closed fist oriented so the knuckle row presses upward.
   * Rendered with rotation=180° so the flat face of the fist contacts the chin.
   * Use for: jaw isometric resistance.
   */
  chin_fist: {
    thumb:  { cmc: 35, mcp: 30, ip: 25, abduction: 0 },
    index:  FIST_FINGER,
    middle: { ...FIST_FINGER, mcp: 80, pip: 90 },
    ring:   { ...FIST_FINGER, mcp: 75, pip: 85 },
    pinky:  { ...FIST_FINGER, mcp: 72, pip: 80, dip: 60 },
  },

  /**
   * Brow press — two extended fingers angled to press the forehead downward.
   * Rendered with rotation≈170°. Use for: frontalis isometric.
   */
  brow_press: {
    thumb:  { cmc: 10, mcp: 5, ip: 5, abduction: 10 },
    index:  { mcp: 5,  pip: 5, dip: 0, abduction: 6 },
    middle: { mcp: 5,  pip: 5, dip: 0, abduction: 0 },
    ring:   { ...FIST_FINGER, mcp: 65, pip: 75 },
    pinky:  { ...FIST_FINGER, mcp: 62, pip: 72, dip: 55 },
  },
};

/** Human-readable label for each preset. */
export const HAND_PRESET_LABELS: Record<HandPresetName, string> = {
  open:             'Mão Aberta',
  fist:             'Punho Fechado',
  point:            'Indicador (Apontar)',
  two_finger_press: 'Dois Dedos (Pressão)',
  pinch:            'Pinça',
  massage:          'Massagem',
  palm_press:       'Palma Plana',
  ok_sign:          'OK',
  chin_fist:        'Punho no Queixo',
  brow_press:       'Pressão na Testa',
};

/** All preset names in display order. */
export const HAND_PRESET_NAMES: readonly HandPresetName[] = [
  'open',
  'two_finger_press',
  'brow_press',
  'point',
  'pinch',
  'massage',
  'palm_press',
  'ok_sign',
  'fist',
  'chin_fist',
];
