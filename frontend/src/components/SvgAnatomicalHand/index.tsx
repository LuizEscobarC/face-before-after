/**
 * SvgAnatomicalHand — fully parameterized anatomical hand SVG component.
 *
 * Each finger joint (MCP, PIP, DIP + abduction) is independently controllable.
 * Geometry is computed via forward kinematics, so arbitrary poses are physically
 * plausible without hardcoded paths.
 *
 * Usage:
 *   <SvgAnatomicalHand
 *     config={HAND_PRESETS.brow_press}
 *     rotation={175}
 *     x={26}
 *     y={28}
 *     scale={0.5}
 *     flip
 *     action="press"
 *     color="var(--accent2)"
 *   />
 *
 * The component renders an <svg> with viewBox "0 0 100 130". Embed inside a
 * parent SVG or render standalone — both work.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import type { HandConfig, HandAction, HandPresetName } from './types';
import { computeHandGeometry, fingerOutlinePath, palmPath } from './kinematics';
import { HAND_PRESETS } from './presets';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SvgAnatomicalHandProps {
  /**
   * Full per-joint configuration. Use HAND_PRESETS[key] for named poses
   * or build a custom HandConfig for arbitrary poses.
   */
  config?: HandConfig;

  /**
   * Shortcut: load a named preset. Overridden by `config` if both provided.
   */
  preset?: HandPresetName;

  /**
   * Mirror all geometry along the X axis → produces the left hand.
   * Default: false (right hand).
   */
  flip?: boolean;

  /**
   * Overall rotation of the hand in degrees (applied via SVG transform).
   * 0° = index finger pointing up.
   * 90° = pointing right, 180° = pointing down (e.g. chin press).
   */
  rotation?: number;

  /**
   * Uniform scale factor applied before positioning.
   * Default: 1 (100% of viewBox).
   */
  scale?: number;

  /**
   * Translation X in the **parent** SVG coordinate space.
   * Only meaningful when embedded inside a parent `<svg>`.
   */
  x?: number;

  /** Translation Y in parent SVG coordinate space. */
  y?: number;

  /**
   * Stroke / accent color for wireframe lines and joint dots.
   * Default: 'var(--accent2, #22d3ee)' (cyan from design palette).
   */
  color?: string;

  /**
   * Fill opacity for the palm/finger shapes (ghost fill).
   * Default: 0.06.
   */
  fillOpacity?: number;

  /**
   * Enable Framer Motion animation loop (idle float + action motion).
   * Default: true.
   */
  animate?: boolean;

  /** Framer Motion transition override. */
  transition?: Transition;

  /**
   * Show MCP / PIP / DIP joint dots (useful for debugging or anatomy education).
   * Default: false.
   */
  showJointDots?: boolean;

  /**
   * Render a pulsing contact halo at the tip of the index finger.
   * Use when the hand is pressing a surface.
   * Default: false.
   */
  showContactHalo?: boolean;

  /**
   * Micro-animation overlay:
   *   - idle    : gentle float (y oscillation)
   *   - press   : compress towards the contact point
   *   - pull    : retract away from contact point
   *   - massage : circular orbit
   * Default: 'idle'.
   */
  action?: HandAction;

  /**
   * Width/height of the standalone <svg> element when rendered without a
   * parent SVG. Ignored when embedded inside another SVG.
   * Default: '100%' × 'auto'.
   */
  svgWidth?: number | string;
  svgHeight?: number | string;

  /** aria-label for the root SVG element. */
  ariaLabel?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VIEWBOX = '0 0 100 130';
const FINGER_WIDTHS: Record<'index' | 'middle' | 'ring' | 'pinky', number> = {
  index:  7.5,
  middle: 8,
  ring:   7.5,
  pinky:  6,
};
const THUMB_WIDTH = 7;

// ---------------------------------------------------------------------------
// Action micro-animations
// ---------------------------------------------------------------------------

function actionVariants(action: HandAction) {
  switch (action) {
    case 'press':
      return { y: [0, -5, 0], scale: [1, 0.92, 1] };
    case 'pull':
      return { y: [0, 8, 0] };
    case 'massage':
      return { x: [0, 4, 0, -4, 0], y: [0, 3, 0, -3, 0] };
    case 'idle':
    default:
      return { y: [0, -3, 0] };
  }
}

function actionTransition(action: HandAction, custom?: Transition): Transition {
  if (custom) return custom;
  const duration = action === 'massage' ? 1.8 : 1.6;
  return { duration, repeat: Infinity, ease: 'easeInOut' };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SvgAnatomicalHand({
  config,
  preset,
  flip = false,
  rotation = 0,
  scale = 1,
  x = 50,
  y = 50,
  color = 'var(--accent2, #22d3ee)',
  fillOpacity = 0.06,
  animate: enableAnimation = true,
  transition,
  showJointDots = false,
  showContactHalo = false,
  action = 'idle',
  svgWidth = '100%',
  svgHeight = 'auto',
  ariaLabel = 'Mão anatômica',
}: SvgAnatomicalHandProps) {
  // Resolve config: explicit config > named preset > default (open).
  const resolvedConfig = config ?? HAND_PRESETS[preset ?? 'open'];

  // Compute all joint positions via forward kinematics.
  const geo = useMemo(
    () => computeHandGeometry(resolvedConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(resolvedConfig)],
  );

  // Build SVG paths.
  const paths = useMemo(() => {
    return {
      palm:   palmPath(geo),
      index:  fingerOutlinePath(geo.index,  FINGER_WIDTHS.index),
      middle: fingerOutlinePath(geo.middle, FINGER_WIDTHS.middle),
      ring:   fingerOutlinePath(geo.ring,   FINGER_WIDTHS.ring),
      pinky:  fingerOutlinePath(geo.pinky,  FINGER_WIDTHS.pinky),
      // Thumb is narrower — use a simplified path.
      thumb:  fingerOutlinePath(geo.thumb,  THUMB_WIDTH),
    };
  }, [geo]);

  // SVG transform for the whole hand group (applied within parent SVG).
  // Origin for rotation is the palm center (approx 18px right of index MCP, 72px down).
  const originX = 18;
  const originY = 72;
  const flipStr = flip ? `scale(-1,1) translate(${-(2 * originX + 36)}px,0)` : '';
  const transform = `translate(${x}px,${y}px) rotate(${rotation}deg) scale(${scale}) ${flipStr}`;

  const fillColor = color;

  const anim = enableAnimation ? actionVariants(action) : undefined;
  const trans = enableAnimation ? actionTransition(action, transition) : undefined;

  // Collect all finger joint positions for dot rendering.
  const joints = showJointDots
    ? (
        ['thumb', 'index', 'middle', 'ring', 'pinky'] as const
      ).flatMap((f) => [geo[f].mcp, geo[f].pip, geo[f].dip])
    : [];

  const svgContent = (
    <motion.g
      style={{ transform, transformOrigin: `${originX}px ${originY}px` }}
      animate={anim}
      transition={trans}
    >
      {/* Contact halo at index fingertip */}
      {showContactHalo && (
        <>
          <motion.circle
            cx={geo.index.tip.x}
            cy={geo.index.tip.y}
            r={8}
            fill={fillColor}
            opacity={0.18}
            animate={{ r: [8, 12, 8] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <circle
            cx={geo.index.tip.x}
            cy={geo.index.tip.y}
            r={12}
            fill="none"
            stroke={fillColor}
            strokeWidth={0.5}
            strokeDasharray="2 2"
            opacity={0.45}
          />
        </>
      )}

      {/* Palm */}
      <path
        d={paths.palm}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={fillColor}
        strokeWidth={1}
        strokeLinejoin="round"
      />

      {/* Thumb */}
      <path
        d={paths.thumb}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={fillColor}
        strokeWidth={0.9}
        strokeLinejoin="round"
      />

      {/* Fingers */}
      {(['index', 'middle', 'ring', 'pinky'] as const).map((finger) => (
        <path
          key={finger}
          d={paths[finger]}
          fill={fillColor}
          fillOpacity={fillOpacity}
          stroke={fillColor}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      ))}

      {/* Web valleys between fingers */}
      {[
        { l: geo.index.mcp,  r: geo.middle.mcp },
        { l: geo.middle.mcp, r: geo.ring.mcp   },
        { l: geo.ring.mcp,   r: geo.pinky.mcp  },
      ].map(({ l, r }, i) => (
        <polygon
          key={i}
          points={`${l.x.toFixed(1)},${(l.y - 6).toFixed(1)} ${((l.x + r.x) / 2).toFixed(1)},${l.y.toFixed(1)} ${r.x.toFixed(1)},${(r.y - 6).toFixed(1)}`}
          fill={fillColor}
          fillOpacity={fillOpacity * 0.6}
          stroke={fillColor}
          strokeWidth={0.4}
          opacity={0.7}
        />
      ))}

      {/* Nail ellipses */}
      {(['index', 'middle', 'ring', 'pinky'] as const).map((finger) => {
        const tip = geo[finger].tip;
        return (
          <ellipse
            key={`nail-${finger}`}
            cx={tip.x}
            cy={tip.y + 2}
            rx={FINGER_WIDTHS[finger] * 0.3}
            ry={FINGER_WIDTHS[finger] * 0.38}
            fill={fillColor}
            fillOpacity={0.12}
            stroke={fillColor}
            strokeWidth={0.5}
            opacity={0.5}
          />
        );
      })}
      {/* Thumb nail */}
      <ellipse
        cx={geo.thumb.tip.x}
        cy={geo.thumb.tip.y + 2}
        rx={THUMB_WIDTH * 0.3}
        ry={THUMB_WIDTH * 0.4}
        fill={fillColor}
        fillOpacity={0.12}
        stroke={fillColor}
        strokeWidth={0.5}
        opacity={0.5}
      />

      {/* MCP knuckle row dots */}
      {(['index', 'middle', 'ring', 'pinky'] as const).map((finger) => {
        const mcp = geo[finger].mcp;
        return (
          <ellipse
            key={`mcp-${finger}`}
            cx={mcp.x}
            cy={mcp.y}
            rx={FINGER_WIDTHS[finger] * 0.38}
            ry={2}
            fill={fillColor}
            opacity={0.55}
          />
        );
      })}

      {/* PIP knuckle dots */}
      {(['index', 'middle', 'ring', 'pinky'] as const).map((finger) => {
        const pip = geo[finger].pip;
        return (
          <ellipse
            key={`pip-${finger}`}
            cx={pip.x}
            cy={pip.y}
            rx={FINGER_WIDTHS[finger] * 0.32}
            ry={1.8}
            fill={fillColor}
            opacity={0.4}
          />
        );
      })}

      {/* Debug joint dots */}
      {showJointDots &&
        joints.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={1.5}
            fill="red"
            opacity={0.8}
          />
        ))}

      {/* Wrist lines */}
      <line
        x1={-8}  y1={90} x2={42} y2={90}
        stroke={fillColor} strokeWidth={0.6} opacity={0.35}
      />
      <line
        x1={-6}  y1={94} x2={40} y2={94}
        stroke={fillColor} strokeWidth={0.5} opacity={0.22}
        strokeDasharray="2 3"
      />
      {/* Wrist center dot */}
      <circle cx={17} cy={90} r={2.5}
        fill="none" stroke={fillColor} strokeWidth={0.9} opacity={0.4} />
      <circle cx={17} cy={90} r={1}
        fill={fillColor} opacity={0.75} />
    </motion.g>
  );

  return (
    <svg
      viewBox={VIEWBOX}
      width={svgWidth}
      height={svgHeight}
      aria-label={ariaLabel}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {svgContent}
    </svg>
  );
}

/**
 * Embeddable version for use inside an existing parent <svg>.
 * Renders only the <g> group (no outer <svg> wrapper), so the caller controls
 * the coordinate space and viewBox.
 *
 * Usage inside a parent SVG:
 *   <svg viewBox="0 0 100 115">
 *     <SvgAnatomicalHandGroup x={20} y={30} scale={0.4} flip action="press" />
 *   </svg>
 */
export function SvgAnatomicalHandGroup(props: Omit<SvgAnatomicalHandProps, 'svgWidth' | 'svgHeight'>) {
  const resolvedConfig = props.config ?? HAND_PRESETS[props.preset ?? 'open'];
  const geo = useMemo(
    () => computeHandGeometry(resolvedConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(resolvedConfig)],
  );
  const paths = useMemo(() => ({
    palm:   palmPath(geo),
    index:  fingerOutlinePath(geo.index,  FINGER_WIDTHS.index),
    middle: fingerOutlinePath(geo.middle, FINGER_WIDTHS.middle),
    ring:   fingerOutlinePath(geo.ring,   FINGER_WIDTHS.ring),
    pinky:  fingerOutlinePath(geo.pinky,  FINGER_WIDTHS.pinky),
    thumb:  fingerOutlinePath(geo.thumb,  THUMB_WIDTH),
  }), [geo]);

  const {
    flip = false,
    rotation = 0,
    scale = 1,
    x = 50,
    y = 50,
    color = 'var(--accent2, #22d3ee)',
    fillOpacity = 0.06,
    animate: enableAnimation = true,
    transition,
    showJointDots = false,
    showContactHalo = false,
    action = 'idle',
  } = props;

  const originX = 18;
  const originY = 72;
  const flipStr = flip ? `scale(-1,1) translate(${-(2 * originX + 36)}px,0)` : '';
  const transform = `translate(${x}px,${y}px) rotate(${rotation}deg) scale(${scale}) ${flipStr}`;
  const fillColor = color;

  const anim = enableAnimation ? actionVariants(action) : undefined;
  const trans = enableAnimation ? actionTransition(action, transition) : undefined;

  return (
    <motion.g
      style={{ transform, transformOrigin: `${originX}px ${originY}px` }}
      animate={anim}
      transition={trans}
    >
      {showContactHalo && (
        <motion.circle
          cx={geo.index.tip.x} cy={geo.index.tip.y} r={8}
          fill={fillColor} opacity={0.2}
          animate={{ r: [8, 12, 8] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <path d={paths.palm} fill={fillColor} fillOpacity={fillOpacity} stroke={fillColor} strokeWidth={1} strokeLinejoin="round" />
      <path d={paths.thumb} fill={fillColor} fillOpacity={fillOpacity} stroke={fillColor} strokeWidth={0.9} strokeLinejoin="round" />
      {(['index', 'middle', 'ring', 'pinky'] as const).map((f) => (
        <path key={f} d={paths[f]} fill={fillColor} fillOpacity={fillOpacity} stroke={fillColor} strokeWidth={1} strokeLinejoin="round" />
      ))}
      {[{ l: geo.index.mcp, r: geo.middle.mcp }, { l: geo.middle.mcp, r: geo.ring.mcp }, { l: geo.ring.mcp, r: geo.pinky.mcp }].map(({ l, r }, i) => (
        <polygon key={i}
          points={`${l.x.toFixed(1)},${(l.y - 6).toFixed(1)} ${((l.x + r.x) / 2).toFixed(1)},${l.y.toFixed(1)} ${r.x.toFixed(1)},${(r.y - 6).toFixed(1)}`}
          fill={fillColor} fillOpacity={fillOpacity * 0.6} stroke={fillColor} strokeWidth={0.4} opacity={0.7} />
      ))}
      {(['index', 'middle', 'ring', 'pinky'] as const).map((f) => {
        const mcp = geo[f].mcp;
        return <ellipse key={`m-${f}`} cx={mcp.x} cy={mcp.y} rx={FINGER_WIDTHS[f] * 0.38} ry={2} fill={fillColor} opacity={0.55} />;
      })}
      {(['index', 'middle', 'ring', 'pinky'] as const).map((f) => {
        const pip = geo[f].pip;
        return <ellipse key={`p-${f}`} cx={pip.x} cy={pip.y} rx={FINGER_WIDTHS[f] * 0.32} ry={1.8} fill={fillColor} opacity={0.4} />;
      })}
      {showJointDots && (['index', 'middle', 'ring', 'pinky', 'thumb'] as const).flatMap((f) =>
        [geo[f].mcp, geo[f].pip, geo[f].dip].map((pt, i) => (
          <circle key={`${f}-${i}`} cx={pt.x} cy={pt.y} r={1.5} fill="red" opacity={0.8} />
        ))
      )}
      <line x1={-8} y1={90} x2={42} y2={90} stroke={fillColor} strokeWidth={0.6} opacity={0.35} />
      <line x1={-6} y1={94} x2={40} y2={94} stroke={fillColor} strokeWidth={0.5} opacity={0.22} strokeDasharray="2 3" />
      <circle cx={17} cy={90} r={2.5} fill="none" stroke={fillColor} strokeWidth={0.9} opacity={0.4} />
      <circle cx={17} cy={90} r={1} fill={fillColor} opacity={0.75} />
    </motion.g>
  );
}

export type { HandConfig, HandAction, HandPresetName } from './types';
export { HAND_PRESETS, HAND_PRESET_LABELS, HAND_PRESET_NAMES } from './presets';
export type { FingerConfig, ThumbConfig } from './types';
