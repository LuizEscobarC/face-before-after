/**
 * SvgAnatomicalHand — forward kinematics engine.
 *
 * Computes absolute (x, y) SVG positions for every joint given
 * per-joint flexion and abduction angles.
 *
 * Coordinate system:
 *   - Origin = MCP base of the index finger (knuckle row), y increases downward.
 *   - Finger tips extend upward (-Y), wrist/palm extends downward (+Y).
 *   - Horizontal: index at x≈0, middle at x≈13, ring at x≈25, pinky at x≈35.
 *   - All angles in degrees; converted to radians internally.
 *
 * ViewBox after applying layout: 0 0 100 130 (extra columns left for thumb).
 * Caller applies SVG transform (translate/scale/rotate/flip) externally.
 */

import type { FingerConfig, ThumbConfig, FingerPoints, HandConfig, HandGeometry } from './types';

const DEG = Math.PI / 180;

/** Segment lengths (in SVG units) for each phalange of each finger. */
const FINGER_LENGTHS: Record<'index' | 'middle' | 'ring' | 'pinky', [number, number, number]> = {
  //               [proximal, middle, distal]
  index:  [22, 14, 10],
  middle: [24, 15, 11],
  ring:   [22, 14, 10],
  pinky:  [16, 10,  7],
};

/** Thumb phalange lengths: [proximal, distal] (no middle phalange). */
const THUMB_LENGTHS: [number, number] = [18, 14];

/** Base X offsets for each finger's MCP, relative to a shared palm origin. */
const FINGER_BASE_X: Record<'index' | 'middle' | 'ring' | 'pinky', number> = {
  index:  0,
  middle: 13,
  ring:   25,
  pinky:  35,
};

/** Y position of the MCP row (knuckle line), relative to palm origin. */
const MCP_BASE_Y = 50;

/** Palm base (wrist) Y position relative to palm origin. */
const PALM_BASE_Y = 95;

/**
 * Computes joint positions for a 4-joint finger chain
 * (palm→MCP→PIP→DIP→tip) using forward kinematics.
 *
 * @param baseX - X of the MCP joint in palm coordinates.
 * @param config - Per-joint flexion + abduction angles.
 * @param lengths - [proximal, middle, distal] phalange lengths.
 */
function computeFinger(
  baseX: number,
  config: FingerConfig,
  lengths: [number, number, number],
): FingerPoints {
  // Clamp angles to valid ranges.
  const mcpAng = Math.max(0, Math.min(90, config.mcp)) * DEG;
  const pipAng = Math.max(0, Math.min(90, config.pip)) * DEG;
  const dipAng = Math.max(0, Math.min(90, config.dip)) * DEG;
  // Abduction shifts the MCP laterally (positive = away from center = larger X).
  const abdX = baseX + Math.sin(config.abduction * DEG) * lengths[0];

  const mcpPos = { x: abdX, y: MCP_BASE_Y };

  // Proximal phalange: starts pointing straight up (-Y), bends via MCP flexion.
  // Accumulated angle from vertical (0 = straight up).
  const angle0 = mcpAng; // deviation from -Y axis
  const p1x = mcpPos.x + Math.sin(angle0) * lengths[0];
  const p1y = mcpPos.y - Math.cos(angle0) * lengths[0];
  const pipPos = { x: p1x, y: p1y };

  // Middle phalange: continues from PIP, adds PIP flexion on top of MCP angle.
  const angle1 = angle0 + pipAng;
  const p2x = pipPos.x + Math.sin(angle1) * lengths[1];
  const p2y = pipPos.y - Math.cos(angle1) * lengths[1];
  const dipPos = { x: p2x, y: p2y };

  // Distal phalange: DIP flexion adds to accumulated angle.
  const angle2 = angle1 + dipAng;
  const p3x = dipPos.x + Math.sin(angle2) * lengths[2];
  const p3y = dipPos.y - Math.cos(angle2) * lengths[2];
  const tipPos = { x: p3x, y: p3y };

  return { mcp: mcpPos, pip: pipPos, dip: dipPos, tip: tipPos };
}

/**
 * Computes thumb joint positions.
 * Thumb MCP base is at x≈-18, y≈65 (lateral to the palm, below MCP row).
 */
function computeThumb(config: ThumbConfig): FingerPoints {
  // Thumb CMC is anchored at the lateral palm edge.
  const cmcX = -16;
  const cmcY = 68;

  const cmcAng = Math.max(0, Math.min(60, config.cmc)) * DEG;
  const mcpAng = Math.max(0, Math.min(60, config.mcp)) * DEG;
  const ipAng = Math.max(0, Math.min(80, config.ip)) * DEG;
  const abdAng = Math.max(-20, Math.min(60, config.abduction)) * DEG;

  // CMC determines the base direction of the thumb metacarpal.
  // Thumb starts pointing up-left; abduction rotates it away from the palm.
  // Base angle from upward-left diagonal (-135°+45° = -90° total), modified by abduction.
  const baseAngle = (-Math.PI / 2 + Math.PI / 4) - abdAng + cmcAng;

  const mcpX = cmcX + Math.cos(baseAngle) * 18;
  const mcpY = cmcY + Math.sin(baseAngle) * 18;
  const mcpPos = { x: mcpX, y: mcpY };

  // MCP phalange (proximal phalange of thumb).
  const angle1 = baseAngle + mcpAng;
  const p1x = mcpX + Math.cos(angle1) * THUMB_LENGTHS[0];
  const p1y = mcpY + Math.sin(angle1) * THUMB_LENGTHS[0];
  const pipPos = { x: p1x, y: p1y }; // (anatomically: MCP joint of thumb)

  // IP phalange (distal phalange of thumb).
  const angle2 = angle1 + ipAng;
  const p2x = p1x + Math.cos(angle2) * THUMB_LENGTHS[1];
  const p2y = p1y + Math.sin(angle2) * THUMB_LENGTHS[1];
  const dipPos = { x: p2x, y: p2y }; // (anatomically: IP joint)

  // Tip.
  const p3x = p2x + Math.cos(angle2) * 6;
  const p3y = p2y + Math.sin(angle2) * 6;
  const tipPos = { x: p3x, y: p3y };

  return { mcp: mcpPos, pip: pipPos, dip: dipPos, tip: tipPos };
}

/** Computes full hand geometry from a HandConfig. */
export function computeHandGeometry(config: HandConfig): HandGeometry {
  return {
    thumb:  computeThumb(config.thumb),
    index:  computeFinger(FINGER_BASE_X.index,  config.index,  FINGER_LENGTHS.index),
    middle: computeFinger(FINGER_BASE_X.middle, config.middle, FINGER_LENGTHS.middle),
    ring:   computeFinger(FINGER_BASE_X.ring,   config.ring,   FINGER_LENGTHS.ring),
    pinky:  computeFinger(FINGER_BASE_X.pinky,  config.pinky,  FINGER_LENGTHS.pinky),
    palmBase: { x: (FINGER_BASE_X.index + FINGER_BASE_X.pinky) / 2, y: PALM_BASE_Y },
  };
}

/**
 * Builds an SVG cubic-bezier path for a single finger from 4 key points.
 * Creates a closed outline shape (left side up, right side down).
 *
 * @param pts - Computed joint positions.
 * @param width - Width of the finger (full diameter, split evenly each side).
 */
export function fingerOutlinePath(pts: FingerPoints, width: number): string {
  const hw = width / 2;
  const { mcp, pip, dip, tip } = pts;

  // Direction vector from mcp→pip.
  const dx01 = pip.x - mcp.x;
  const dy01 = pip.y - mcp.y;
  const len01 = Math.sqrt(dx01 * dx01 + dy01 * dy01) || 1;
  const perp01 = { x: -dy01 / len01, y: dx01 / len01 };

  // Direction from pip→dip.
  const dx12 = dip.x - pip.x;
  const dy12 = dip.y - pip.y;
  const len12 = Math.sqrt(dx12 * dx12 + dy12 * dy12) || 1;
  const perp12 = { x: -dy12 / len12, y: dx12 / len12 };

  // Direction from dip→tip.
  const dx23 = tip.x - dip.x;
  const dy23 = tip.y - dip.y;
  const len23 = Math.sqrt(dx23 * dx23 + dy23 * dy23) || 1;
  const perp23 = { x: -dy23 / len23, y: dx23 / len23 };

  // Left-side points (using perpendicular).
  const lMcp = { x: mcp.x - perp01.x * hw, y: mcp.y - perp01.y * hw };
  const lPip = { x: pip.x - perp12.x * hw, y: pip.y - perp12.y * hw };
  const lDip = { x: dip.x - perp23.x * hw, y: dip.y - perp23.y * hw };
  // Right-side points.
  const rMcp = { x: mcp.x + perp01.x * hw, y: mcp.y + perp01.y * hw };
  const rPip = { x: pip.x + perp12.x * hw, y: pip.y + perp12.y * hw };
  const rDip = { x: dip.x + perp23.x * hw, y: dip.y + perp23.y * hw };

  const p = (v: { x: number; y: number }) => `${v.x.toFixed(2)},${v.y.toFixed(2)}`;

  return [
    `M ${p(lMcp)}`,
    `C ${p(lMcp)} ${p(lPip)} ${p(lPip)}`,
    `C ${p(lPip)} ${p(lDip)} ${p(lDip)}`,
    // Tip arc (rounded).
    `Q ${p(tip)} ${p(rDip)}`,
    `C ${p(rDip)} ${p(rPip)} ${p(rPip)}`,
    `C ${p(rPip)} ${p(rMcp)} ${p(rMcp)}`,
    `Z`,
  ].join(' ');
}

/**
 * Builds a palm polygon from the four finger MCP positions and the wrist corners.
 */
export function palmPath(geo: HandGeometry): string {
  const { index, pinky, palmBase } = geo;
  const palmW = pinky.mcp.x - index.mcp.x + 12;
  const lx = index.mcp.x - 6;
  const rx = pinky.mcp.x + 6;
  const topY = MCP_BASE_Y;
  const bottomY = PALM_BASE_Y;

  const p = (x: number, y: number) => `${x.toFixed(2)},${y.toFixed(2)}`;

  return [
    `M ${p(lx, topY)}`,
    `C ${p(lx - 5, topY + 15)} ${p(lx - 7, bottomY - 12)} ${p(lx - 2, bottomY)}`,
    `Q ${p(palmBase.x, bottomY + 8)} ${p(rx + 2, bottomY)}`,
    `C ${p(rx + 7, bottomY - 12)} ${p(rx + 5, topY + 15)} ${p(rx, topY)}`,
    `Z`,
  ].join(' ');
}
