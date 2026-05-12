/**
 * ExerciseStudioPreview — single unified preview that replaces the old
 * SvgFaceInstructor + BiometricFaceSimulator pair in admin contexts.
 *
 * Pipeline:
 *   1. Compose a peak FaceState from `animationConfig.primitives` via the
 *      existing PRIMITIVE_REGISTRY, OR snap to a live MediaPipe delta, OR
 *      replay an `animationConfig.recorded_timeline`.
 *   2. Render the face via <FaceRig>, a hierarchy of transformable SVG groups
 *      (skull / brows / eyes / nose / cheeks / lips / mandible) so EVERY
 *      FaceState field actually moves the SVG — including jaw lateral,
 *      protrusion, head yaw/pitch/roll, eye gaze, nostril flare.
 *   3. Overlay heat blobs from BOTH `animationConfig.heat_regions` AND
 *      `biometricConfig.steps[].zone` (deduplicated; pulsing).
 *   4. Render anatomical hands & force arrows from
 *      `animationConfig.action_vectors` (passthrough JSON).
 *   5. Optional 478-point MediaPipe mesh overlay (debug / scanner mode).
 *   6. Toggle visual style (Premium Sci-Fi default / Scanner HUD).
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import type { AnimationConfig } from '../../types/animationConfig';
import type { BiometricExerciseConfig } from '../../biometric/types';
import { NEUTRAL_FACE_STATE, type FaceState } from '../SvgFaceInstructor/faceState';
import { PRIMITIVE_REGISTRY } from '../SvgFaceInstructor/primitives';
import { AnatomicalHand } from './AnatomicalHand';
import { LandmarkRig } from './LandmarkRig';
import { STUDIO_STYLES, HEAT_BLOBS, type StudioStyle } from './styles';

// ─────────────────────────────────────────────────────────────────────────
// Compose primitives → peak FaceState (re-uses existing registry).
// ─────────────────────────────────────────────────────────────────────────
function composePeak(animationConfig: AnimationConfig | null): FaceState {
  if (!animationConfig) return NEUTRAL_FACE_STATE;
  const peak: FaceState = { ...NEUTRAL_FACE_STATE };
  for (const p of animationConfig.primitives) {
    const renderer = PRIMITIVE_REGISTRY[p.id];
    if (!renderer) continue;
    const delta = renderer(p.intensity ?? 1);
    // Numeric: ADD for offsets/rotations; MULTIPLY for scales/openness/flare.
    // String/boolean: last-write-wins.
    for (const [k, v] of Object.entries(delta)) {
      if (typeof v === 'number') {
        const isMultiplier = /Scale|Openness|Flare|Opacity/.test(k);
        const cur = (peak as unknown as Record<string, number>)[k] ?? 0;
        (peak as unknown as Record<string, number>)[k] = isMultiplier
          ? cur * v
          : cur + v;
      } else {
        (peak as unknown as Record<string, unknown>)[k] = v;
      }
    }
  }
  return peak;
}

// ─────────────────────────────────────────────────────────────────────────
// Heat zones — union of animationConfig.heat_regions + biometric steps zones.
// ─────────────────────────────────────────────────────────────────────────
type HeatZone = { id: string; pulse: boolean; intensity: number };

function collectHeatZones(
  animationConfig: AnimationConfig | null,
  biometricConfig: BiometricExerciseConfig | null,
): HeatZone[] {
  const map = new Map<string, HeatZone>();
  if (animationConfig?.heat_regions) {
    for (const hr of animationConfig.heat_regions) {
      map.set(hr.region, { id: hr.region, pulse: hr.pulse !== false, intensity: 1 });
    }
  }
  if (biometricConfig?.steps) {
    for (const step of biometricConfig.steps) {
      const existing = map.get(step.zone);
      const intensity = step.heat_intensity ?? 0.8;
      if (existing) {
        existing.intensity = Math.max(existing.intensity, intensity);
      } else {
        map.set(step.zone, { id: step.zone, pulse: true, intensity });
      }
    }
  }
  return Array.from(map.values());
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────
export type ExerciseStudioPreviewProps = {
  animationConfig: AnimationConfig | null;
  biometricConfig: BiometricExerciseConfig | null;
  /** Visual style id. Default 'scifi'. */
  styleId?: StudioStyle['id'];
  /** Live FaceState delta (e.g. from useExerciseRecorder.liveDelta) — when set,
   *  bypasses the primitives loop and snaps the SVG to the camera in real time. */
  liveDelta?: Partial<FaceState> | null;
  /** Hide hands overlay (still shows everything else). */
  hideHands?: boolean;
  /** Auto-loop primitives. Default true. False = freeze at neutral. */
  playing?: boolean;
  /** Raw MediaPipe landmarks for the debug mesh overlay (478 points). */
  meshLandmarks?: number[][] | null;
  /** Show the mesh overlay (only takes effect if meshLandmarks is provided). */
  showMesh?: boolean;
  width?: number | string;
  height?: number | string;
  showCaption?: boolean;
};

export function ExerciseStudioPreview({
  animationConfig,
  biometricConfig,
  styleId = 'scifi',
  liveDelta = null,
  hideHands = false,
  playing = true,
  meshLandmarks = null,
  showMesh = false,
  width = '100%',
  height = 'auto',
  showCaption = true,
}: ExerciseStudioPreviewProps) {
  const style = STUDIO_STYLES[styleId];
  const [phase, setPhase] = useState<'idle' | 'active'>('idle');

  // Phase loop driven by animationConfig timing.
  useEffect(() => {
    if (!playing || liveDelta) {
      setPhase('idle');
      return;
    }
    const dur = animationConfig?.duration_ms ?? 2000;
    const hold = animationConfig?.hold_ms ?? 0;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const loop = (next: 'idle' | 'active') => {
      if (!alive) return;
      setPhase(next);
      const wait = next === 'active' ? dur + hold : dur;
      timer = setTimeout(() => loop(next === 'active' ? 'idle' : 'active'), wait);
    };
    loop('active');
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [animationConfig, playing, liveDelta]);

  // Compute the rendered FaceState for the current frame.
  const renderedState: FaceState = useMemo(() => {
    if (liveDelta) return { ...NEUTRAL_FACE_STATE, ...liveDelta };
    if (phase === 'active') return composePeak(animationConfig);
    return NEUTRAL_FACE_STATE;
  }, [animationConfig, phase, liveDelta]);

  const heatZones = useMemo(
    () => collectHeatZones(animationConfig, biometricConfig),
    [animationConfig, biometricConfig],
  );

  const transition: Transition = useMemo(
    () => ({
      duration: liveDelta ? 0.08 : (animationConfig?.duration_ms ?? 1500) / 1000,
      ease: 'easeInOut',
    }),
    [animationConfig, liveDelta],
  );

  const showOverlays = !!liveDelta || phase === 'active';
  const caption = animationConfig?.caption_pt || biometricConfig?.caption_pt;

  return (
    <div
      style={{
        width,
        height,
        background: style.panelBg,
        border: `1px solid ${style.borderColor}`,
        borderRadius: 16,
        padding: 18,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        color: style.text,
      }}
    >
      <svg
        viewBox="0 0 100 130"
        width="100%"
        style={{ filter: style.shadow, overflow: 'visible', maxHeight: 460 }}
      >
        {/* Heat blobs first so they sit behind the face */}
        {heatZones.map((hz, i) => {
          const blob = HEAT_BLOBS[hz.id];
          if (!blob) return null;
          return (
            <motion.circle
              key={`heat-${hz.id}-${i}`}
              cx={blob.cx}
              cy={blob.cy}
              r={blob.r}
              fill={style.heatColor}
              style={{ filter: 'blur(7px)' }}
              animate={{
                opacity: showOverlays
                  ? hz.pulse
                    ? [0.1, 0.7 * hz.intensity, 0.1]
                    : 0.5 * hz.intensity
                  : 0,
              }}
              transition={hz.pulse ? { duration: 0.9, repeat: Infinity } : transition}
            />
          );
        })}

        {/* Face rig — live camera landmarks when available; canonical mesh +
            FaceState deformation otherwise (scripted / replay mode). */}
        <LandmarkRig
          landmarks={liveDelta && meshLandmarks ? meshLandmarks : null}
          state={renderedState}
          style={style}
          transition={transition}
          showMesh={showMesh}
          meshOpacity={0.45}
        />

        {/* Hands & arrows (active only) */}
        {showOverlays &&
          !hideHands &&
          animationConfig?.action_vectors?.map((v, i) => {
            if (v.type === 'hand') {
              return (
                <AnatomicalHand
                  key={`hand-${i}`}
                  x={v.x}
                  y={v.y}
                  angle={v.angle}
                  scale={v.scale}
                  flip={v.flip}
                  spread={v.spread}
                  action={v.action}
                  color={style.handColor}
                  fill={style.handFill}
                />
              );
            }
            const isMuscle = v.type === 'arrow_muscle';
            const ang =
              (Math.atan2(v.y2 - v.y1, v.x2 - v.x1) * 180) / Math.PI - 90;
            const color = isMuscle ? style.heatColor : style.arrowColor;
            return (
              <motion.g
                key={`arrow-${i}`}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <line
                  x1={v.x1}
                  y1={v.y1}
                  x2={v.x2}
                  y2={v.y2}
                  stroke={color}
                  strokeWidth={isMuscle ? 2 : 1.5}
                  strokeDasharray={isMuscle ? 'none' : '3 3'}
                />
                <polygon
                  points={`${v.x2},${v.y2} ${v.x2 - 3},${v.y2 - 6} ${v.x2 + 3},${v.y2 - 6}`}
                  fill={color}
                  style={{
                    transformOrigin: `${v.x2}px ${v.y2}px`,
                    transform: `rotate(${ang}deg)`,
                  }}
                />
              </motion.g>
            );
          })}
      </svg>

      {showCaption && caption && (
        <p
          style={{
            color: style.text,
            fontSize: 13,
            textAlign: 'center',
            lineHeight: 1.55,
            margin: 0,
            opacity: 0.85,
            padding: '0 8px',
          }}
        >
          {caption}
        </p>
      )}
    </div>
  );
}

export default ExerciseStudioPreview;
