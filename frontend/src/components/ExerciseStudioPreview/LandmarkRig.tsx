/**
 * LandmarkRig — draws the SVG face DIRECTLY from MediaPipe's 478 landmarks
 * (or from the canonical mean face when no live data is available).
 *
 * Replaces the old FaceRig which used hardcoded anchors (HEAD_CX=50, etc.)
 * and could not match the user's actual topology.
 *
 * Two modes:
 *   • LIVE / REPLAY  — `landmarks` prop set: normalize → One-Euro filter →
 *                       polyline each region into <motion.path d=…>.
 *   • SCRIPTED       — `landmarks` null: load CANONICAL_FACE_LANDMARKS
 *                       (468 pts from MediaPipe canonical_face_model.obj)
 *                       and apply FaceState as regional deformations.
 *
 * Pseudo-3D matrix is preserved (user requested) — applied on the outer
 * <g> on top of the already-positioned points so it accentuates rotation
 * without replacing landmark-driven motion.
 *
 * NOTE on iris: canonical mesh has 468 vertices; live iris points 468-477
 * exist only at runtime. In scripted mode iris falls back to the eye centre.
 */

import { useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import canonicalRaw from '../../biometric/canonicalFaceMesh.json';
import {
  FACE_OVAL,
  LIPS_OUTER,
  LIPS_INNER,
  LEFT_EYE,
  RIGHT_EYE,
  LEFT_EYEBROW,
  RIGHT_EYEBROW,
  NOSE_BRIDGE,
  NOSE_BOTTOM,
  LEFT_IRIS,
  RIGHT_IRIS,
  polylinePath,
  regionCenter,
  regionRadius,
} from '../../biometric/faceMeshTopology';
import { normalizeToViewBox } from '../../biometric/normalizeLandmarks';
import { OneEuroFilterArray } from '../../biometric/oneEuroFilter';
import type { FaceState } from '../SvgFaceInstructor/faceState';
import type { StudioStyle } from './styles';

const CANONICAL: number[][] = canonicalRaw as number[][];

// Indices used for FaceState scripted deformations.
// Lower-half oval (chin region) — moves with jawDx / jawDy.
const OVAL_LOWER = FACE_OVAL.filter((idx) => {
  const p = CANONICAL[idx];
  return p && p[1] > 65; // viewBox cy=65, anything below is lower face
});

// Brow indices already covered; per-eye openness scales the ring vertically.

export type LandmarkRigProps = {
  landmarks: number[][] | null;
  state: FaceState;
  style: StudioStyle;
  transition: Transition;
  showMesh?: boolean;
  meshOpacity?: number;
};

export function LandmarkRig({
  landmarks,
  state,
  style,
  transition,
  showMesh = false,
  meshOpacity = 0.45,
}: LandmarkRigProps) {
  // One-Euro filter persists across renders (singleton per component instance).
  const filterRef = useRef<OneEuroFilterArray | null>(null);
  if (filterRef.current === null) {
    filterRef.current = new OneEuroFilterArray(478, 3, {
      mincutoff: 1.5,
      beta: 0.05,
      dcutoff: 1.0,
    });
  }

  const points = useMemo<number[][]>(() => {
    if (landmarks && landmarks.length > 0) {
      const norm = normalizeToViewBox(landmarks);
      return filterRef.current!.filter(norm.points);
    }
    // Scripted mode — start from canonical and deform via FaceState.
    return applyFaceStateDeformation(CANONICAL, state);
  }, [landmarks, state]);

  // Pseudo-3D matrix on the outer group (kept per user decision).
  // Subtle: the landmarks themselves already encode rotation in live mode,
  // this just exaggerates it for scripted mode and gives extra "tilt" feel.
  const skewX = -Math.sin((state.faceRotate * Math.PI) / 180) * 12;
  const sxYaw = Math.cos((state.faceRotate * Math.PI) / 180) * 0.2 + 0.8;
  const syPitch = Math.cos((state.facePitch * Math.PI) / 180) * 0.15 + 0.85;
  const tiltDeg = state.faceTilt;
  const headTransform = [
    `translate(50px, 65px)`,
    `rotate(${tiltDeg}deg)`,
    `skewX(${skewX}deg)`,
    `scale(${sxYaw}, ${syPitch})`,
    `translate(-50px, -65px)`,
    `translate(0px, ${state.faceDy}px)`,
  ].join(' ');

  // ── Path strings ──────────────────────────────────────────────────────
  const dOval = polylinePath(points, FACE_OVAL, true);
  const dLipsOuter = polylinePath(points, LIPS_OUTER, true);
  const dLipsInner = polylinePath(points, LIPS_INNER, true);
  const dEyeL = polylinePath(points, LEFT_EYE, true);
  const dEyeR = polylinePath(points, RIGHT_EYE, true);
  const dBrowL = polylinePath(points, LEFT_EYEBROW);
  const dBrowR = polylinePath(points, RIGHT_EYEBROW);
  const dNoseBridge = polylinePath(points, NOSE_BRIDGE);
  const dNoseBottom = polylinePath(points, NOSE_BOTTOM);

  // Iris: prefer landmark indices, fall back to eye centre when canonical
  // (468 pts only) is the source.
  const irisL = irisCenter(points, LEFT_IRIS, LEFT_EYE);
  const irisR = irisCenter(points, RIGHT_IRIS, RIGHT_EYE);
  const eyeRadL = regionRadius(points, LEFT_EYE) * 0.32;
  const eyeRadR = regionRadius(points, RIGHT_EYE) * 0.32;

  const stroke = style.faceStroke;
  const sw = style.faceWidth;
  const skinFill = style.faceFill;

  return (
    <g style={{ transform: headTransform, transformOrigin: '50px 65px' }}>
      {/* Skull silhouette — only opacity is framer-motion animated; d is a
          plain React prop so the browser always has a valid value on first
          paint (avoids framer-motion path-interpolation writing 'undefined'). */}
      <motion.path
        d={dOval || 'M0 0'}
        fill={skinFill}
        stroke={stroke}
        strokeWidth={sw}
        strokeLinejoin="round"
        animate={{ opacity: state.skinOpacity }}
        transition={transition}
      />

      {/* Brows */}
      <motion.path
        d={dBrowL || 'M0 0'}
        fill="none" stroke={stroke} strokeWidth={sw * 1.4} strokeLinecap="round"
        animate={{ d: dBrowL || 'M0 0' }}
        initial={false}
        transition={transition}
      />
      <motion.path
        d={dBrowR || 'M0 0'}
        fill="none" stroke={stroke} strokeWidth={sw * 1.4} strokeLinecap="round"
        animate={{ d: dBrowR || 'M0 0' }}
        initial={false}
        transition={transition}
      />

      {/* Nose */}
      <motion.path
        d={dNoseBridge || 'M0 0'}
        fill="none" stroke={stroke} strokeWidth={sw * 0.9} strokeLinecap="round"
        animate={{ d: dNoseBridge || 'M0 0' }}
        initial={false}
        transition={transition}
      />
      <motion.path
        d={dNoseBottom || 'M0 0'}
        fill="none" stroke={stroke} strokeWidth={sw * 0.9} strokeLinecap="round"
        animate={{ d: dNoseBottom || 'M0 0' }}
        initial={false}
        transition={transition}
      />

      {/* Eyes */}
      <motion.path
        d={dEyeL || 'M0 0'}
        fill={style.eyeFill ?? 'rgba(255,255,255,0.85)'} stroke={stroke} strokeWidth={sw}
        animate={{ d: dEyeL || 'M0 0' }}
        initial={false}
        transition={transition}
      />
      <motion.path
        d={dEyeR || 'M0 0'}
        fill={style.eyeFill ?? 'rgba(255,255,255,0.85)'} stroke={stroke} strokeWidth={sw}
        animate={{ d: dEyeR || 'M0 0' }}
        initial={false}
        transition={transition}
      />

      {/* Iris — plain circles; position updates each React render.
          No framer-motion needed: cx/cy change directly via state. */}
      <circle
        cx={irisL[0] + state.eyeLDx}
        cy={irisL[1] + state.eyeLDy}
        r={Math.max(0.1, eyeRadL)}
        fill={style.irisColor ?? '#22d3ee'}
      />
      <circle
        cx={irisR[0] + state.eyeRDx}
        cy={irisR[1] + state.eyeRDy}
        r={Math.max(0.1, eyeRadR)}
        fill={style.irisColor ?? '#22d3ee'}
      />

      {/* Lips */}
      <motion.path
        d={dLipsOuter || 'M0 0'}
        fill={style.lipColor ?? 'rgba(220,80,90,0.5)'} stroke={stroke} strokeWidth={sw * 0.8}
        animate={{ d: dLipsOuter || 'M0 0' }}
        initial={false}
        transition={transition}
      />
      <motion.path
        d={dLipsInner || 'M0 0'}
        fill={style.mouthInner ?? 'rgba(0,0,0,0.6)'} stroke="none"
        animate={{ d: dLipsInner || 'M0 0' }}
        initial={false}
        transition={transition}
      />

      {/* Mesh overlay (debug) — drawn last so it sits on top */}
      {showMesh && <MeshDots points={points} color={style.meshColor ?? '#67e8f9'} opacity={meshOpacity} />}
    </g>
  );
}

export default LandmarkRig;

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function irisCenter(
  points: number[][],
  irisIdx: number[],
  eyeIdx: number[],
): [number, number] {
  // Prefer iris point 0 (centre); fall back to mean of iris points; finally
  // to the eye-ring centre when canonical mesh is the source.
  const irisCentrePt = points[irisIdx[0]];
  if (irisCentrePt) return [irisCentrePt[0], irisCentrePt[1]];
  const mean = regionCenter(points, irisIdx);
  if (mean[0] !== 0 || mean[1] !== 0) return mean;
  return regionCenter(points, eyeIdx);
}

function MeshDots({
  points,
  color,
  opacity,
}: {
  points: number[][];
  color: string;
  opacity: number;
}) {
  return (
    <g opacity={opacity}>
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={0.35} fill={color} />
      ))}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Scripted-mode deformations: apply a FaceState as offsets / scales onto a
// copy of the canonical mesh. First pass covers the highest-impact fields;
// the rest degrade gracefully to neutral.
// ─────────────────────────────────────────────────────────────────────────

function applyFaceStateDeformation(
  canonical: number[][],
  state: FaceState,
): number[][] {
  const out: number[][] = canonical.map((p) => [p[0], p[1], p[2] ?? 0]);

  // jawDx / jawDy / jawDz — translate lower-half oval points.
  if (state.jawDx || state.jawDy || state.jawDz) {
    for (const idx of OVAL_LOWER) {
      out[idx][0] += state.jawDx;
      out[idx][1] += state.jawDy;
      out[idx][2] += state.jawDz;
    }
  }

  // mouthShape / mouthScaleX / mouthScaleY — scale lips around mouth centre.
  const lipsAll = [...LIPS_OUTER, ...LIPS_INNER];
  const [mcx, mcy] = regionCenter(out, lipsAll);
  const sx = state.mouthScaleX || 1;
  const sy = state.mouthScaleY || 1;
  if (sx !== 1 || sy !== 1 || state.mouthDy) {
    for (const idx of lipsAll) {
      const p = out[idx];
      p[0] = mcx + (p[0] - mcx) * sx;
      p[1] = mcy + (p[1] - mcy) * sy + state.mouthDy;
    }
  }

  // eye openness — vertical scale around each eye centre.
  applyEyeOpenness(out, LEFT_EYE, state.eyeLOpenness);
  applyEyeOpenness(out, RIGHT_EYE, state.eyeROpenness);

  // brow lift / lateral / rotation — translate each brow point.
  applyBrow(out, LEFT_EYEBROW, state.browLDx, state.browLDy, state.browLRotate);
  applyBrow(out, RIGHT_EYEBROW, state.browRDx, state.browRDy, state.browRRotate);

  // lip corner asymmetry.
  if (state.lipCornerLDy || state.lipCornerRDy) {
    // LIPS_OUTER index 0 is left corner (61), 10 is right corner (291).
    const lc = LIPS_OUTER[0];
    const rc = LIPS_OUTER[10];
    if (out[lc]) out[lc][1] += state.lipCornerLDy;
    if (out[rc]) out[rc][1] += state.lipCornerRDy;
  }

  return out;
}

function applyEyeOpenness(points: number[][], eyeIdx: number[], openness: number) {
  if (openness === 1) return;
  const [cx, cy] = regionCenter(points, eyeIdx);
  for (const idx of eyeIdx) {
    const p = points[idx];
    if (!p) continue;
    p[1] = cy + (p[1] - cy) * openness;
  }
}

function applyBrow(
  points: number[][],
  browIdx: number[],
  dx: number,
  dy: number,
  rotateDeg: number,
) {
  if (!dx && !dy && !rotateDeg) return;
  const [cx, cy] = regionCenter(points, browIdx);
  const cosA = Math.cos((rotateDeg * Math.PI) / 180);
  const sinA = Math.sin((rotateDeg * Math.PI) / 180);
  for (const idx of browIdx) {
    const p = points[idx];
    if (!p) continue;
    const x = p[0] - cx;
    const y = p[1] - cy;
    p[0] = cx + (x * cosA - y * sinA) + dx;
    p[1] = cy + (x * sinA + y * cosA) + dy;
  }
}
