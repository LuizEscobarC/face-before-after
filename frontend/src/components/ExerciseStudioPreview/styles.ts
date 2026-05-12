/**
 * Visual style presets ported from EXOESQUELETO_FACIAL_GUIDE.md (MVP HTML).
 * Two equally premium aesthetics — admin can toggle on the preview.
 */

export type StudioStyle = {
  id: 'scifi' | 'mesh';
  name: string;
  bg: string;
  panelBg: string;
  text: string;
  faceStroke: string;
  faceFill: string;
  faceWidth: number;
  shadow: string;
  heatColor: string;
  arrowColor: string;
  handColor: string;
  handFill: string;
  borderColor: string;
  // LandmarkRig (optional, with sensible defaults applied at render time)
  eyeFill?: string;
  irisColor?: string;
  lipColor?: string;
  mouthInner?: string;
  meshColor?: string;
};

export const STUDIO_STYLES: Record<StudioStyle['id'], StudioStyle> = {
  scifi: {
    id: 'scifi',
    name: 'Premium Sci-Fi',
    bg: 'linear-gradient(135deg,#1c1c28,#0a0a0f)',
    panelBg: 'rgba(255,255,255,0.03)',
    text: '#e2e8f0',
    faceStroke: 'rgba(255,255,255,0.78)',
    faceFill: 'rgba(255,255,255,0.02)',
    faceWidth: 1.2,
    shadow: 'drop-shadow(0 10px 18px rgba(0,0,0,0.55))',
    heatColor: '#ff9f0a',
    arrowColor: '#32ade6',
    handColor: '#32ade6',
    handFill: 'rgba(50,173,230,0.08)',
    borderColor: 'rgba(255,255,255,0.06)',
    eyeFill: 'rgba(255,255,255,0.85)',
    irisColor: '#3b82f6',
    lipColor: 'rgba(220,80,90,0.55)',
    mouthInner: 'rgba(0,0,0,0.65)',
    meshColor: '#67e8f9',
  },
  mesh: {
    id: 'mesh',
    name: 'Scanner HUD',
    bg: '#050508',
    panelBg: '#0a0a10',
    text: '#00ffcc',
    faceStroke: '#00ffcc',
    faceFill: 'rgba(0,255,204,0.03)',
    faceWidth: 1.2,
    shadow: 'drop-shadow(0 0 4px rgba(0,255,204,0.6))',
    heatColor: '#ff0055',
    arrowColor: '#ffcc00',
    handColor: '#00e5ff',
    handFill: 'rgba(0,229,255,0.07)',
    borderColor: 'rgba(0,255,204,0.18)',
    eyeFill: 'rgba(0,255,204,0.18)',
    irisColor: '#00ffcc',
    lipColor: 'rgba(0,255,204,0.25)',
    mouthInner: 'rgba(0,0,0,0.7)',
    meshColor: '#00ffcc',
  },
};

/** Heat zone → SVG circle (in 100×120 viewBox). Unifies AnimationConfig.heat_regions
 *  AND BiometricExerciseConfig.steps[].zone. */
export const HEAT_BLOBS: Record<string, { cx: number; cy: number; r: number }> = {
  // Forehead / brow
  frontalis: { cx: 50, cy: 20, r: 18 },
  corrugator: { cx: 50, cy: 30, r: 8 },
  temporalis: { cx: 18, cy: 30, r: 8 },
  temporalis_l: { cx: 18, cy: 30, r: 8 },
  temporalis_r: { cx: 82, cy: 30, r: 8 },
  // Eyes
  orbicularis_oculi_l: { cx: 32, cy: 42, r: 9 },
  orbicularis_oculi_r: { cx: 67, cy: 42, r: 9 },
  // Cheeks
  zygomaticus_l: { cx: 26, cy: 58, r: 10 },
  zygomaticus_r: { cx: 74, cy: 58, r: 10 },
  buccinator_l: { cx: 24, cy: 70, r: 9 },
  buccinator_r: { cx: 76, cy: 70, r: 9 },
  // Mouth / chin
  orbicularis_oris: { cx: 50, cy: 78, r: 12 },
  mentalis: { cx: 50, cy: 92, r: 9 },
  // Jaw
  masseter_l: { cx: 20, cy: 78, r: 12 },
  masseter_r: { cx: 80, cy: 78, r: 12 },
  tmj_joint_l: { cx: 14, cy: 60, r: 7 },
  tmj_joint_r: { cx: 86, cy: 60, r: 7 },
  // Neck (rendered below face when active)
  platysma: { cx: 50, cy: 112, r: 14 },
  scm_l: { cx: 32, cy: 112, r: 9 },
  scm_r: { cx: 68, cy: 112, r: 9 },
  suboccipital: { cx: 50, cy: 6, r: 9 },
};
