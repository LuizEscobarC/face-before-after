/**
 * Converts MediaPipe FaceLandmarker output (478-point model) into a
 * Partial<FaceState> that can be merged into the SvgFaceInstructor's peak.
 *
 * All deltas are normalized relative to the inter-ocular distance (IOD)
 * so the output is resolution-independent.
 *
 * Landmark index reference (MediaPipe 478-point canonical face model):
 *   - 33  = left eye outer corner
 *   - 263 = right eye outer corner
 *   - 1   = nose tip
 *   - 152 = chin (menton)
 *   - 61  = left mouth corner
 *   - 291 = right mouth corner
 *   - 13  = upper inner lip center
 *   - 14  = lower inner lip center
 *   - 159 = left eye upper lid
 *   - 145 = left eye lower lid
 *   - 386 = right eye upper lid
 *   - 374 = right eye lower lid
 *   - 55  = left brow inner
 *   - 65  = left brow center
 *   - 52  = left brow outer
 *   - 285 = right brow inner
 *   - 295 = right brow center
 *   - 282 = right brow outer
 *   - 234 = left cheek
 *   - 454 = right cheek
 */

import type { FaceState } from '../components/SvgFaceInstructor/faceState';

export type PoseAngles = { yaw: number; pitch: number; roll: number };

/** [x, y, z?] coordinate triple. z is normalised depth from MediaPipe (negative = closer to camera). */
type Pt = [number, number, number?];

function dist(a: Pt, b: Pt): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

function getLm(landmarks: number[][], index: number): Pt {
  const lm = landmarks[index];
  if (!lm) return [0, 0, 0];
  return [lm[0], lm[1], lm[2] ?? 0];
}

/**
 * Converts raw MediaPipe pixel landmarks + pose angles to a FaceState delta.
 *
 * @param landmarks - Array of [x, y] pixel positions (478 entries).
 * @param pose - Yaw/pitch/roll in degrees from the worker's estimatePose().
 */
export function landmarkToFaceState(
  landmarks: number[][],
  pose: PoseAngles,
): Partial<FaceState> {
  if (!landmarks || landmarks.length < 468) {
    return {};
  }

  // ── Normalisation baseline ─────────────────────────────────────────────
  // Inter-ocular distance (left outer eye corner → right outer eye corner).
  const iod = dist(getLm(landmarks, 33), getLm(landmarks, 263));
  if (iod < 1) return {}; // Face too small / not detected.

  // Scale factor: 1 SVG unit ≈ how many pixels of IOD.
  // In the SVG face, IOD is roughly 26px (from x≈24 to x≈76 scaled to 100px wide).
  const svgIod = 26;
  const pxToSvg = svgIod / iod;

  // ── Reference vertical positions ──────────────────────────────────────
  const eyeMidY = (getLm(landmarks, 33)[1] + getLm(landmarks, 263)[1]) / 2;
  const neutralBrowY = eyeMidY - iod * 0.18; // approx neutral brow height

  // ── BROW ──────────────────────────────────────────────────────────────
  // Left brow center
  const browLCenter = getLm(landmarks, 65);
  // Positive browLDy in FaceState = brow moves DOWN; negative = UP.
  const browLDy = Math.max(-8, Math.min(4, (neutralBrowY - browLCenter[1]) * pxToSvg * 0.6));

  // Right brow center
  const browRCenter = getLm(landmarks, 295);
  const browRDy = Math.max(-8, Math.min(4, (neutralBrowY - browRCenter[1]) * pxToSvg * 0.6));

  // Brow rotation: tilt of inner vs outer brow (furrow detection)
  const browLInner = getLm(landmarks, 55);
  const browLOuter = getLm(landmarks, 52);
  const browLRotate = Math.max(-5, Math.min(5,
    Math.atan2(browLOuter[1] - browLInner[1], browLOuter[0] - browLInner[0]) * (180 / Math.PI) * 0.4,
  ));
  const browRInner = getLm(landmarks, 285);
  const browROuter = getLm(landmarks, 282);
  const browRRotate = Math.max(-5, Math.min(5,
    Math.atan2(browROuter[1] - browRInner[1], browROuter[0] - browRInner[0]) * (180 / Math.PI) * 0.4,
  ));

  // ── EYE OPENNESS (vertical aspect ratio) ──────────────────────────────
  const eyeLUpperY = getLm(landmarks, 159)[1];
  const eyeLLowerY = getLm(landmarks, 145)[1];
  const eyeLWidth = dist(getLm(landmarks, 33), getLm(landmarks, 133));
  const eyeLRatio = eyeLWidth > 1 ? (eyeLLowerY - eyeLUpperY) / eyeLWidth : 0.28;
  // Neutral ratio ≈ 0.28; closed ≈ 0.02; wide ≈ 0.5.
  const eyeLOpenness = Math.max(0, Math.min(1.8, eyeLRatio / 0.28));

  const eyeRUpperY = getLm(landmarks, 386)[1];
  const eyeRLowerY = getLm(landmarks, 374)[1];
  const eyeRWidth = dist(getLm(landmarks, 263), getLm(landmarks, 362));
  const eyeRRatio = eyeRWidth > 1 ? (eyeRLowerY - eyeRUpperY) / eyeRWidth : 0.28;
  const eyeROpenness = Math.max(0, Math.min(1.8, eyeRRatio / 0.28));

  // ── MOUTH / JAW ────────────────────────────────────────────────────────
  const upperLipY = getLm(landmarks, 13)[1];
  const lowerLipY = getLm(landmarks, 14)[1];
  const mouthOpenPx = Math.max(0, lowerLipY - upperLipY);
  // Map to jawDy: 0 = closed, ~10 = wide open in SVG units.
  const jawDy = Math.min(14, mouthOpenPx * pxToSvg * 0.55);

  // Mouth width → mouthScaleX
  const leftCorner = getLm(landmarks, 61);
  const rightCorner = getLm(landmarks, 291);
  const mouthWidthPx = dist(leftCorner, rightCorner);
  const neutralMouthW = iod * 0.55; // ≈ 55% of IOD for neutral mouth width
  const mouthScaleX = Math.max(0.7, Math.min(1.5, mouthWidthPx / neutralMouthW));

  // Lip corner heights → lipCornerLDy / lipCornerRDy
  const mouthMidY = (upperLipY + lowerLipY) / 2;
  const lipCornerLDy = Math.max(-5, Math.min(5, (leftCorner[1] - mouthMidY) * pxToSvg * 0.4));
  const lipCornerRDy = Math.max(-5, Math.min(5, (rightCorner[1] - mouthMidY) * pxToSvg * 0.4));

  // Jaw open → mouthShape
  const mouthShape = jawDy > 6
    ? 'open'
    : mouthScaleX < 0.85
    ? 'pucker'
    : (lipCornerLDy < -2 && lipCornerRDy < -2)
    ? 'smile'
    : 'flat';

  // ── CHEEK PUFF ────────────────────────────────────────────────────────
  // Cheek landmark x-position vs neutral.
  const leftCheekX = getLm(landmarks, 234)[0];
  const rightCheekX = getLm(landmarks, 454)[0];
  const faceWidth = rightCheekX - leftCheekX;
  const neutralFaceW = iod * 1.5; // approx neutral
  const cheekScale = faceWidth > 0 ? faceWidth / neutralFaceW : 1;
  const cheekLScale = Math.max(0.85, Math.min(1.4, cheekScale));
  const cheekRScale = cheekLScale;

  // ── HEAD POSE ──────────────────────────────────────────────────────────
  // Clamp to avoid extreme deformations.
  const faceRotate = Math.max(-40, Math.min(40, pose.yaw));
  const faceTilt = Math.max(-30, Math.min(30, pose.roll));
  const facePitch = Math.max(-30, Math.min(30, pose.pitch));

  // ── JAW LATERAL & PROTRUSION ──────────────────────────────────────────
  // Chin (152) X position relative to face midline (nose tip 1, forehead 10).
  const noseTip = getLm(landmarks, 1);
  const forehead = getLm(landmarks, 10);
  const chin = getLm(landmarks, 152);
  // Midline X is the average of nose+forehead (rotation-compensated).
  const midlineX = (noseTip[0] + forehead[0]) / 2;
  // Lateral chin offset, normalised to IOD, in SVG units (face is 70 wide).
  const jawDx = Math.max(-8, Math.min(8, (chin[0] - midlineX) * pxToSvg * 1.2));
  // Protrusion: z-depth of chin minus z-depth of nose tip. Negative z = closer.
  // Forward jut → chin.z becomes more negative than nose.z.
  const jawDz = Math.max(-1, Math.min(1, ((noseTip[2] ?? 0) - (chin[2] ?? 0)) * 5));

  // ── EYE GAZE (iris position relative to eye centre) ──────────────────
  // Left iris centre = 468, right iris centre = 473 (refined-landmarks model).
  const leftIris = getLm(landmarks, 468);
  const rightIris = getLm(landmarks, 473);
  const leftEyeCentre: Pt = [
    (getLm(landmarks, 33)[0] + getLm(landmarks, 133)[0]) / 2,
    (getLm(landmarks, 33)[1] + getLm(landmarks, 133)[1]) / 2,
  ];
  const rightEyeCentre: Pt = [
    (getLm(landmarks, 263)[0] + getLm(landmarks, 362)[0]) / 2,
    (getLm(landmarks, 263)[1] + getLm(landmarks, 362)[1]) / 2,
  ];
  // Gaze offsets in SVG units (small — pupils only move ~1-2px in our SVG).
  const eyeLDx = Math.max(-2, Math.min(2, (leftIris[0] - leftEyeCentre[0]) * pxToSvg * 1.5));
  const eyeLDy = Math.max(-1.5, Math.min(1.5, (leftIris[1] - leftEyeCentre[1]) * pxToSvg * 1.2));
  const eyeRDx = Math.max(-2, Math.min(2, (rightIris[0] - rightEyeCentre[0]) * pxToSvg * 1.5));
  const eyeRDy = Math.max(-1.5, Math.min(1.5, (rightIris[1] - rightEyeCentre[1]) * pxToSvg * 1.2));

  // ── NOSE FLARE (nostril width vs neutral) ────────────────────────────
  // Left ala 64 / right ala 294. Width grows ~10-15% on flare.
  const noseAlaWidth = dist(getLm(landmarks, 64), getLm(landmarks, 294));
  const neutralAla = iod * 0.30;
  const noseFlare = Math.max(0.85, Math.min(1.4, noseAlaWidth / neutralAla));

  return {
    browLDy,
    browRDy,
    browLRotate,
    browRRotate,
    eyeLOpenness,
    eyeROpenness,
    eyeLDx,
    eyeLDy,
    eyeRDx,
    eyeRDy,
    jawDy,
    jawDx,
    jawDz,
    mouthScaleX,
    lipCornerLDy,
    lipCornerRDy,
    mouthShape,
    cheekLScale,
    cheekRScale,
    noseFlare,
    faceRotate,
    faceTilt,
    facePitch,
  };
}
