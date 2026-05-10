import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import type { FaceState, MouthShape, TongueShape } from './faceState';

/**
 * PR-B — FaceBase: parameterised SVG of an abstract face inside viewBox 0..100.
 *
 * Receives a "peak" FaceState (the deformed pose at the height of the
 * exercise) and a Framer Motion `transition`. Each motion.* element animates
 * from its neutral value to the peak via the provided transition.
 *
 * Coordinate convention (viewBox 0 0 100 110 — extra 10 below for neck):
 *   - face centre ≈ (50, 50)
 *   - intercanthal axis ≈ y=45
 *   - mouth ≈ y=78
 *   - chin ≈ y=92
 *   - neck (when shown) ≈ y=100..108
 *
 * Style follows project palette (--text, --accent, --muted) for a clinical-HUD
 * feel rather than a cartoon face.
 */

const SKIN_FILL = '#fde7d3';
const SKIN_STROKE = '#a8765c';
const FEATURE_STROKE = '#3a2515';
const PUPIL_FILL = '#1f2937';
const LIP_FILL = '#c87560';
const TONGUE_FILL = '#e07570';
const NECK_FILL = '#fde7d3';

interface FaceBaseProps {
  peak: FaceState;
  transition: Transition;
  /** When true, lock at neutral pose (no animation), useful for static preview. */
  freeze?: boolean;
}

/**
 * Renders the face as an SVG `<g>` group inside the parent SVG's coordinate
 * system (expects viewBox 0 0 100 115). The wrapper SvgFaceInstructor owns
 * the outer `<svg>`.
 */
export function FaceBase({ peak, transition, freeze = false }: FaceBaseProps) {
  const animate = freeze ? undefined : peak;

  return (
    <g role="img" aria-label="Instrutor facial vetorial">
      <defs>
        <radialGradient id="cheek-blush" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f4b8a0" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f4b8a0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ===== WHOLE-FACE GROUP (rotation/tilt/translation) ===== */}
      <motion.g
        animate={
          freeze
            ? undefined
            : {
                rotate: peak.faceRotate,
                skewX: 0,
                x: 0,
                y: peak.faceDy,
              }
        }
        transition={transition}
        style={{
          transformOrigin: '50px 60px',
          // Roll (tilt) is applied via separate transform on a wrapper
        }}
      >
        <motion.g
          animate={freeze ? undefined : { rotate: peak.faceTilt }}
          transition={transition}
          style={{ transformOrigin: '50px 60px' }}
        >
          {/* ===== NECK (rendered first so it sits behind the chin) ===== */}
          {peak.showNeck && (
            <g>
              <rect x="38" y="92" width="24" height="16" rx="3" fill={NECK_FILL} stroke={SKIN_STROKE} strokeWidth="0.6" />
              <line x1="44" y1="92" x2="44" y2="108" stroke={SKIN_STROKE} strokeWidth="0.4" opacity="0.4" />
              <line x1="56" y1="92" x2="56" y2="108" stroke={SKIN_STROKE} strokeWidth="0.4" opacity="0.4" />
            </g>
          )}

          {/* ===== SKIN (face oval — animates skinOpacity for x-ray mode) ===== */}
          <motion.ellipse
            cx="50"
            cy="55"
            rx="33"
            ry="42"
            fill={SKIN_FILL}
            stroke={SKIN_STROKE}
            strokeWidth="0.8"
            animate={animate ? { opacity: peak.skinOpacity, scaleX: 1 } : undefined}
            transition={transition}
            style={{ transformOrigin: '50px 55px' }}
          />

          {/* ===== JAW (lower portion overlay — separate so jawClench can scale it) ===== */}
          <motion.path
            d="M 17 60 Q 22 92 50 96 Q 78 92 83 60 Z"
            fill={SKIN_FILL}
            stroke={SKIN_STROKE}
            strokeWidth="0.8"
            animate={
              animate
                ? {
                    scaleX: peak.jawScaleX,
                    x: peak.jawDx,
                    y: peak.jawDy,
                    opacity: peak.skinOpacity,
                  }
                : undefined
            }
            transition={transition}
            style={{ transformOrigin: '50px 78px' }}
          />

          {/* ===== CHEEKS (subtle blush regions — scale for puff) ===== */}
          <motion.ellipse
            cx="30"
            cy="62"
            rx="9"
            ry="7"
            fill="url(#cheek-blush)"
            animate={
              animate
                ? { scale: peak.cheekLScale, y: peak.cheekLDy, opacity: peak.skinOpacity * 0.9 }
                : undefined
            }
            transition={transition}
            style={{ transformOrigin: '30px 62px' }}
          />
          <motion.ellipse
            cx="70"
            cy="62"
            rx="9"
            ry="7"
            fill="url(#cheek-blush)"
            animate={
              animate
                ? { scale: peak.cheekRScale, y: peak.cheekRDy, opacity: peak.skinOpacity * 0.9 }
                : undefined
            }
            transition={transition}
            style={{ transformOrigin: '70px 62px' }}
          />

          {/* ===== BROWS ===== */}
          <motion.path
            d="M 22 36 Q 32 31 42 35"
            stroke={FEATURE_STROKE}
            strokeWidth="2.2"
            fill="transparent"
            strokeLinecap="round"
            animate={
              animate
                ? { x: peak.browLDx, y: peak.browLDy, rotate: peak.browLRotate }
                : undefined
            }
            transition={transition}
            style={{ transformOrigin: '32px 35px' }}
          />
          <motion.path
            d="M 58 35 Q 68 31 78 36"
            stroke={FEATURE_STROKE}
            strokeWidth="2.2"
            fill="transparent"
            strokeLinecap="round"
            animate={
              animate
                ? { x: peak.browRDx, y: peak.browRDy, rotate: peak.browRRotate }
                : undefined
            }
            transition={transition}
            style={{ transformOrigin: '68px 35px' }}
          />

          {/* ===== EYES (lid + pupil per side) ===== */}
          <EyeGroup
            cx={35}
            cy={45}
            openness={peak.eyeLOpenness}
            pupilDx={peak.eyeLDx}
            pupilDy={peak.eyeLDy}
            freeze={freeze}
            transition={transition}
          />
          <EyeGroup
            cx={65}
            cy={45}
            openness={peak.eyeROpenness}
            pupilDx={peak.eyeRDx}
            pupilDy={peak.eyeRDy}
            freeze={freeze}
            transition={transition}
          />

          {/* ===== NOSE ===== */}
          <motion.g
            animate={animate ? { scaleX: peak.noseFlare } : undefined}
            transition={transition}
            style={{ transformOrigin: '50px 60px' }}
          >
            <path
              d="M 50 48 L 47 62 Q 50 65 53 62 Z"
              stroke={FEATURE_STROKE}
              strokeWidth="0.9"
              fill="none"
              strokeLinejoin="round"
            />
            <ellipse cx="48" cy="64" rx="1.2" ry="0.8" fill={FEATURE_STROKE} opacity="0.5" />
            <ellipse cx="52" cy="64" rx="1.2" ry="0.8" fill={FEATURE_STROKE} opacity="0.5" />
          </motion.g>

          {/* ===== MOUTH ===== */}
          <motion.g
            animate={
              animate
                ? {
                    scaleX: peak.mouthScaleX,
                    scaleY: peak.mouthScaleY,
                    y: peak.mouthDy,
                  }
                : undefined
            }
            transition={transition}
            style={{ transformOrigin: '50px 78px' }}
          >
            <MouthShape shape={peak.mouthShape} />
            {/* Lip-corner deltas */}
            <motion.circle
              cx="40"
              cy="78"
              r="1.2"
              fill={LIP_FILL}
              animate={animate ? { y: peak.lipCornerLDy } : undefined}
              transition={transition}
            />
            <motion.circle
              cx="60"
              cy="78"
              r="1.2"
              fill={LIP_FILL}
              animate={animate ? { y: peak.lipCornerRDy } : undefined}
              transition={transition}
            />
          </motion.g>

          {/* ===== TONGUE OVERLAY (visible if any tongue primitive active or x-ray mode) ===== */}
          {peak.tongueVisible && (
            <motion.g
              animate={animate ? { x: peak.tongueDx, y: peak.tongueDy } : undefined}
              transition={transition}
              style={{ transformOrigin: '50px 75px' }}
              opacity={peak.skinOpacity < 1 ? 1 : 0.7}
            >
              <TongueShape shape={peak.tongueShape} />
            </motion.g>
          )}
        </motion.g>
      </motion.g>
    </g>
  );
}

// =====================================================================
// Sub-components
// =====================================================================

interface EyeGroupProps {
  cx: number;
  cy: number;
  openness: number;
  pupilDx: number;
  pupilDy: number;
  freeze: boolean;
  transition: Transition;
}

function EyeGroup({ cx, cy, openness, pupilDx, pupilDy, freeze, transition }: EyeGroupProps) {
  return (
    <g>
      {/* Eyelid aperture — animates via ry scale (openness 0 = closed) */}
      <motion.ellipse
        cx={cx}
        cy={cy}
        rx={5}
        ry={3}
        fill="#fff"
        stroke={FEATURE_STROKE}
        strokeWidth="0.8"
        animate={freeze ? undefined : { scaleY: Math.max(0.05, openness) }}
        transition={transition}
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
      {/* Pupil — tracks via translate */}
      <motion.circle
        cx={cx}
        cy={cy}
        r={1.6}
        fill={PUPIL_FILL}
        animate={freeze ? undefined : { x: pupilDx, y: pupilDy, opacity: openness > 0.2 ? 1 : 0 }}
        transition={transition}
      />
    </g>
  );
}

function MouthShape({ shape }: { shape: MouthShape }) {
  const stroke = LIP_FILL;
  switch (shape) {
    case 'pucker':
      return <ellipse cx="50" cy="78" rx="3.5" ry="3.5" fill={LIP_FILL} stroke={stroke} strokeWidth="0.6" />;
    case 'wide_smile':
      return (
        <path
          d="M 38 76 Q 50 86 62 76 Q 50 80 38 76 Z"
          fill={LIP_FILL}
          stroke={stroke}
          strokeWidth="0.6"
        />
      );
    case 'open':
      return <ellipse cx="50" cy="79" rx="6" ry="5" fill="#3a1a14" stroke={stroke} strokeWidth="0.8" />;
    case 'seal':
      return <line x1="40" y1="78" x2="60" y2="78" stroke={stroke} strokeWidth="2.2" strokeLinecap="round" />;
    case 'flat':
      return <line x1="42" y1="78" x2="58" y2="78" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />;
    case 'pull':
      return (
        <path
          d="M 36 78 Q 50 76 64 78"
          stroke={stroke}
          strokeWidth="2.2"
          fill="transparent"
          strokeLinecap="round"
        />
      );
    case 'smile':
    default:
      return (
        <path
          d="M 40 77 Q 50 82 60 77"
          stroke={stroke}
          strokeWidth="2.2"
          fill="transparent"
          strokeLinecap="round"
        />
      );
  }
}

function TongueShape({ shape }: { shape: TongueShape }) {
  switch (shape) {
    case 'palate_press':
      return <ellipse cx="50" cy="72" rx="7" ry="3" fill={TONGUE_FILL} opacity="0.85" />;
    case 'lateral_l':
      return <ellipse cx="42" cy="78" rx="5" ry="3" fill={TONGUE_FILL} opacity="0.85" />;
    case 'lateral_r':
      return <ellipse cx="58" cy="78" rx="5" ry="3" fill={TONGUE_FILL} opacity="0.85" />;
    case 'extended_down':
      return <ellipse cx="50" cy="86" rx="4" ry="6" fill={TONGUE_FILL} opacity="0.9" />;
    case 'tip':
      return <circle cx="50" cy="78" r="2" fill={TONGUE_FILL} />;
    case 'sweep':
      return (
        <path
          d="M 44 78 Q 50 70 56 78 Q 50 84 44 78 Z"
          fill={TONGUE_FILL}
          opacity="0.85"
        />
      );
    case 'rest':
    default:
      return <ellipse cx="50" cy="80" rx="5" ry="2" fill={TONGUE_FILL} opacity="0.7" />;
  }
}
