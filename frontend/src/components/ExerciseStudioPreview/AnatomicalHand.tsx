/**
 * AnatomicalHand — anatomically-accurate dorsal hand SVG ported from
 * EXOESQUELETO_FACIAL_GUIDE.md (MVP HTML).
 *
 * Origin (0,0) is the tip of the index finger (the contact point with the face).
 * The palm and wrist extend in the +Y direction (downward in SVG space).
 *
 * Configurable: position (x,y), rotation (angle°), scale, mirror (flip),
 * finger spread (0..1), and animation action ('press' | 'pull' | 'massage').
 */

import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';

export type AnatomicalHandProps = {
  x: number;
  y: number;
  angle?: number;
  scale?: number;
  flip?: boolean;
  spread?: number;
  action?: 'press' | 'pull' | 'massage';
  color: string;
  fill: string;
};

const ACTION_TRANSITION: Transition = {
  duration: 1.5,
  repeat: Infinity,
  ease: 'easeInOut',
};

export function AnatomicalHand({
  x,
  y,
  angle = 0,
  scale = 1,
  flip = false,
  spread = 0.3,
  action = 'press',
  color,
  fill,
}: AnatomicalHandProps) {
  const s = Math.max(0, Math.min(1, spread));
  const sep = s * 5;
  const mOff = 12 + sep;
  const rOff = mOff + 11 + sep;
  const pOff = rOff + 10 + sep;

  const fingerPath = (cx: number, tipY: number, baseY: number, w: number) => {
    const h = w / 2;
    const tw = h * 0.85;
    return [
      `M ${cx - h} ${baseY}`,
      `C ${cx - h} ${baseY - 10} ${cx - h} ${tipY + 14} ${cx - tw} ${tipY + 6}`,
      `Q ${cx} ${tipY - 2} ${cx + tw} ${tipY + 6}`,
      `C ${cx + h} ${tipY + 14} ${cx + h} ${baseY - 10} ${cx + h} ${baseY}`,
      'Z',
    ].join(' ');
  };

  const valleyY = 44;
  const palmL = -5;
  const palmR = pOff + 5;
  const palmMid = (palmL + palmR) / 2;

  const palmPath = [
    `M ${palmL} 52`,
    `C ${palmL - 4} 62 ${palmL - 8} 72 ${palmL - 6} 82`,
    `C ${palmL - 4} 90 ${palmMid - 10} 96 ${palmMid} 98`,
    `C ${palmMid + 10} 100 ${palmR + 4} 94 ${palmR + 2} 84`,
    `C ${palmR + 2} 74 ${palmR - 2} 62 ${palmR} 52`,
    'Z',
  ].join(' ');

  const thumbPath = [
    'M -4 62',
    'C -10 58 -18 50 -22 40',
    'C -26 32 -28 24 -24 18',
    'Q -20 12 -15 16',
    'Q -10 20 -10 28',
    'C -8 36 -6 48 -4 54',
    'Z',
  ].join(' ');

  const creaseHeart = `M ${palmL} 66 Q ${palmMid - 5} 62 ${palmMid + 8} 65`;
  const creaseHead = `M ${palmL + 2} 74 Q ${palmMid} 70 ${palmR - 2} 74`;

  const tf = `translate(${x}px, ${y}px) rotate(${angle}deg) scale(${flip ? -scale : scale}, ${scale})`;

  const animMap = {
    press: { scale: [1, 0.9, 1], y: [0, -5, 0] },
    pull: { y: [0, 10, 0] },
    massage: { x: [0, 5, 0, -5, 0], y: [0, 5, 0, -5, 0] },
  };

  const joints = [
    { cx: 0, mcp: 52, pip: 27, tip: -6, nr: 3, nt: 3.5 },
    { cx: mOff, mcp: 50, pip: 20, tip: -14, nr: 3.2, nt: 3.8 },
    { cx: rOff, mcp: 51, pip: 24, tip: -10, nr: 3, nt: 3.5 },
    { cx: pOff, mcp: 53, pip: 34, tip: 4, nr: 2.5, nt: 2.8 },
  ];

  return (
    <g style={{ transform: tf, transformOrigin: '0px 0px' }}>
      <motion.g animate={animMap[action]} transition={ACTION_TRANSITION}>
        {/* Halo de contato */}
        <circle cx={0} cy={0} r={9} fill={color} opacity={0.2} style={{ filter: 'blur(4px)' }} />
        <circle cx={0} cy={0} r={14} fill="transparent" stroke={color} strokeWidth={0.5} strokeDasharray="2 2" opacity={0.5} />

        {/* Palma */}
        <path d={palmPath} fill={fill} stroke={color} strokeWidth={1.1} strokeLinejoin="round" />

        {/* Polegar */}
        <path d={thumbPath} fill={fill} stroke={color} strokeWidth={1} strokeLinejoin="round" />
        <ellipse cx={-16} cy={24} rx={3} ry={2} fill={color} opacity={0.5} transform="rotate(-20,-16,24)" />
        <ellipse cx={-18} cy={16} rx={2.8} ry={3.2} fill="none" stroke={color} strokeWidth={0.6} opacity={0.45} transform="rotate(-15,-18,16)" />

        {/* Dedos */}
        <path d={fingerPath(0, -6, 52, 8)} fill={fill} stroke={color} strokeWidth={1.1} />
        <path d={fingerPath(mOff, -14, 52, 9)} fill={fill} stroke={color} strokeWidth={1.1} />
        <path d={fingerPath(rOff, -10, 52, 8)} fill={fill} stroke={color} strokeWidth={1.1} />
        <path d={fingerPath(pOff, 4, 52, 6.5)} fill={fill} stroke={color} strokeWidth={1} />

        {/* Vales entre os dedos */}
        {[
          { x1: 5, x2: mOff - 4 },
          { x1: mOff + 5, x2: rOff - 4 },
          { x1: rOff + 5, x2: pOff - 4 },
        ].map((v, i) => (
          <polygon
            key={i}
            points={`${v.x1},${valleyY} ${(v.x1 + v.x2) / 2},52 ${v.x2},${valleyY}`}
            fill={fill}
            stroke={color}
            strokeWidth={0.5}
            opacity={0.7}
          />
        ))}

        {/* Nós (MCP) */}
        {joints.map((j, idx) => (
          <ellipse key={`mcp-${idx}`} cx={j.cx} cy={j.mcp} rx={idx === 1 ? 4 : 3.5} ry={2.2} fill={color} opacity={0.6} />
        ))}

        {/* PIP */}
        {joints.map((j, idx) => (
          <ellipse key={`pip-${idx}`} cx={j.cx} cy={j.pip} rx={idx === 1 ? 3 : 2.5} ry={2} fill={color} opacity={0.45} />
        ))}

        {/* Dobras de pele */}
        {joints.map((j, idx) => (
          <g key={`crease-${idx}`} opacity={0.3}>
            <line x1={j.cx - 3} y1={j.pip + 2} x2={j.cx + 3} y2={j.pip + 2} stroke={color} strokeWidth={0.5} />
            <line x1={j.cx - 2.5} y1={j.pip + 4} x2={j.cx + 2.5} y2={j.pip + 4} stroke={color} strokeWidth={0.4} />
          </g>
        ))}

        {/* Unhas */}
        {joints.map((j, idx) => (
          <ellipse
            key={`nail-${idx}`}
            cx={j.cx}
            cy={j.tip + 3}
            rx={j.nr}
            ry={j.nt}
            fill={`${color}20`}
            stroke={color}
            strokeWidth={0.6}
            opacity={0.55}
          />
        ))}

        {/* Sulcos da palma */}
        <path d={creaseHeart} fill="none" stroke={color} strokeWidth={0.7} opacity={0.35} strokeLinecap="round" />
        <path d={creaseHead} fill="none" stroke={color} strokeWidth={0.6} opacity={0.25} strokeLinecap="round" strokeDasharray="2 2" />

        {/* Pulso */}
        <path d={`M ${palmL + 2} 90 Q ${palmMid} 87 ${palmR - 2} 90`} fill="none" stroke={color} strokeWidth={0.6} opacity={0.35} />
        <path d={`M ${palmL + 4} 95 Q ${palmMid} 92 ${palmR - 4} 95`} fill="none" stroke={color} strokeWidth={0.5} opacity={0.25} strokeDasharray="2 3" />

        {/* Nó do pulso */}
        <circle cx={palmMid} cy={98} r={3.5} fill="transparent" stroke={color} strokeWidth={1.1} opacity={0.45} />
        <circle cx={palmMid} cy={98} r={1.3} fill={color} opacity={0.8} />
      </motion.g>
    </g>
  );
}
