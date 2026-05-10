import type { AnatomicalZoneId, PivotId } from './types';

export type Pt = { x: number; y: number };

export type ZoneDefinition = {
  indices: ReadonlyArray<number>;
  hull: ReadonlyArray<number>;
  centroidLandmark?: number;
  syntheticOffset?: { x: number; y: number; relativeTo?: number };
};

/**
 * Anatomical zones mapped to MediaPipe Face Mesh-478 landmark indices.
 * Indices come from the plan's "Dicionário Anatômico" table and must be
 * validated visually in the admin preview (PR-C).
 */
export const ANATOMICAL_ZONES: Record<AnatomicalZoneId, ZoneDefinition> = {
  frontalis: {
    indices: [67, 109, 10, 338, 297],
    hull: [67, 109, 10, 338, 297],
    centroidLandmark: 10,
  },
  corrugator: {
    indices: [9, 8, 168, 6],
    hull: [9, 8, 168, 6],
    centroidLandmark: 9,
  },
  orbicularis_oculi_l: {
    indices: [33, 7, 163, 144, 145, 153, 154, 155, 133],
    hull: [33, 7, 163, 144, 145, 153, 154, 155, 133],
  },
  orbicularis_oculi_r: {
    indices: [263, 249, 390, 373, 374, 380, 381, 382, 362],
    hull: [263, 249, 390, 373, 374, 380, 381, 382, 362],
  },
  temporalis_l: {
    indices: [162, 127, 234, 93, 132],
    hull: [162, 127, 234, 93, 132],
  },
  temporalis_r: {
    indices: [389, 356, 454, 323, 361],
    hull: [389, 356, 454, 323, 361],
  },
  zygomaticus_l: {
    indices: [205, 206, 207, 187],
    hull: [205, 206, 207, 187],
    centroidLandmark: 205,
  },
  zygomaticus_r: {
    indices: [425, 426, 427, 411],
    hull: [425, 426, 427, 411],
    centroidLandmark: 425,
  },
  masseter_l: {
    indices: [172, 136, 150, 149, 176, 148],
    hull: [172, 136, 150, 149, 176, 148],
    centroidLandmark: 172,
  },
  masseter_r: {
    indices: [397, 365, 379, 378, 400, 377],
    hull: [397, 365, 379, 378, 400, 377],
    centroidLandmark: 397,
  },
  orbicularis_oris: {
    indices: [61, 84, 17, 314, 405, 321, 375, 291, 270, 269, 267, 0, 37, 39, 40, 185],
    hull:    [61, 84, 17, 314, 405, 321, 375, 291, 270, 269, 267, 0, 37, 39, 40, 185],
    centroidLandmark: 13,
  },
  mentalis: {
    indices: [199, 175, 152],
    hull: [199, 175, 152],
    centroidLandmark: 152,
  },
  buccinator_l: {
    indices: [138, 215, 192],
    hull: [138, 215, 192],
    centroidLandmark: 215,
  },
  buccinator_r: {
    indices: [367, 435, 416],
    hull: [367, 435, 416],
    centroidLandmark: 435,
  },
  tmj_joint_l: {
    indices: [234, 132],
    hull: [234, 132],
    centroidLandmark: 234,
  },
  tmj_joint_r: {
    indices: [454, 361],
    hull: [454, 361],
    centroidLandmark: 454,
  },
  // Synthetic cervical zones — outside the face mesh.
  // Indices empty; rendered as markers offset from a reference landmark.
  platysma: {
    indices: [],
    hull: [],
    syntheticOffset: { x: 0, y: 0.15, relativeTo: 152 },
  },
  scm_l: {
    indices: [],
    hull: [],
    syntheticOffset: { x: -0.12, y: 0.15, relativeTo: 152 },
  },
  scm_r: {
    indices: [],
    hull: [],
    syntheticOffset: { x: 0.12, y: 0.15, relativeTo: 152 },
  },
  suboccipital: {
    indices: [],
    hull: [],
    syntheticOffset: { x: 0, y: -0.12, relativeTo: 10 },
  },
};

export const PIVOT_DEFINITIONS: Record<
  PivotId,
  {
    type: 'landmark' | 'midpoint' | 'synthetic';
    landmark?: number;
    landmarks?: [number, number];
    offset?: { x: number; y: number; relativeTo?: number };
  }
> = {
  tmj_l: { type: 'landmark', landmark: 234 },
  tmj_r: { type: 'landmark', landmark: 454 },
  tmj_center: { type: 'midpoint', landmarks: [234, 454] },
  atlas_c1: { type: 'synthetic', offset: { x: 0, y: 0.18, relativeTo: 152 } },
  occipital_c0: { type: 'synthetic', offset: { x: 0, y: -0.12, relativeTo: 10 } },
};

export function resolvePivot(
  pivot: PivotId,
  landmarks: ReadonlyArray<Pt>,
): Pt {
  const def = PIVOT_DEFINITIONS[pivot];
  if (def.type === 'landmark' && def.landmark !== undefined) {
    const lm = landmarks[def.landmark];
    return { x: lm.x, y: lm.y };
  }
  if (def.type === 'midpoint' && def.landmarks) {
    const a = landmarks[def.landmarks[0]];
    const b = landmarks[def.landmarks[1]];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  if (def.type === 'synthetic' && def.offset) {
    const ref =
      def.offset.relativeTo !== undefined ? landmarks[def.offset.relativeTo] : { x: 0.5, y: 0.5 };
    return { x: ref.x + def.offset.x, y: ref.y + def.offset.y };
  }
  return { x: 0.5, y: 0.5 };
}

export function getCentroid(
  zone: AnatomicalZoneId,
  landmarks: ReadonlyArray<Pt>,
): Pt {
  const def = ANATOMICAL_ZONES[zone];
  if (def.syntheticOffset) {
    const ref =
      def.syntheticOffset.relativeTo !== undefined
        ? landmarks[def.syntheticOffset.relativeTo]
        : { x: 0.5, y: 0.5 };
    return {
      x: ref.x + def.syntheticOffset.x,
      y: ref.y + def.syntheticOffset.y,
    };
  }
  if (def.centroidLandmark !== undefined) {
    const lm = landmarks[def.centroidLandmark];
    return { x: lm.x, y: lm.y };
  }
  if (def.indices.length === 0) {
    return { x: 0.5, y: 0.5 };
  }
  let sx = 0;
  let sy = 0;
  for (const i of def.indices) {
    sx += landmarks[i].x;
    sy += landmarks[i].y;
  }
  return { x: sx / def.indices.length, y: sy / def.indices.length };
}
