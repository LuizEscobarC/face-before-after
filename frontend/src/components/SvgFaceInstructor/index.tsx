import { useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Transition } from 'framer-motion';
import type { AnimationConfig } from '../../types/animationConfig';
import { FaceBase } from './FaceBase';
import { HeatRegions } from './HeatRegions';
import { NEUTRAL_FACE_STATE } from './faceState';
import type { FaceState } from './faceState';
import { PRIMITIVE_REGISTRY, composeFaceState } from './primitives';

// Re-exports for downstream consumers (admin editor, tests, future routine player).
export type { FaceState } from './faceState';
export { NEUTRAL_FACE_STATE } from './faceState';
export { PRIMITIVE_REGISTRY } from './primitives';

interface SvgFaceInstructorProps {
  /** Declarative config from `recommendation_catalog.animation_config`. */
  config: AnimationConfig | null;
  /** Lock the SVG at neutral pose without animating (for thumbnails). */
  freeze?: boolean;
  /** Show the Portuguese caption underneath the SVG. Default true. */
  showCaption?: boolean;
  /** Inline width override. Default 100% of container. */
  width?: number | string;
  /** Inline height override. Default auto. */
  height?: number | string;
}

/**
 * PR-B — Top-level player for declarative facial-exercise animations.
 *
 * Reads an `AnimationConfig` (from the DB), composes the requested primitives
 * into a single peak `FaceState`, and renders FaceBase + HeatRegions inside a
 * shared SVG. Animation timing comes straight from `config.duration_ms`,
 * `config.hold_ms`, and `config.repeat`.
 *
 * Usage:
 *   <SvgFaceInstructor config={recommendation.animationConfig} />
 *
 * Visual is INTENTIONALLY abstract (clinical-HUD aesthetic) — this is not a
 * cartoon mascot. The SVG sits inside the dark surface palette of the app.
 */
export function SvgFaceInstructor({
  config,
  freeze = false,
  showCaption = true,
  width = '100%',
  height = 'auto',
}: SvgFaceInstructorProps) {
  // -----------------------------------------------------------------
  // 1. Compose all primitives into a single peak FaceState.
  // -----------------------------------------------------------------
  const peak = useMemo<FaceState>(() => {
    if (!config) return NEUTRAL_FACE_STATE;
    const deltas = config.primitives
      .map(({ id, intensity }) => {
        const renderer = PRIMITIVE_REGISTRY[id];
        if (!renderer) {
          // Unknown id (should never happen if backend validates) — skip.
          // eslint-disable-next-line no-console
          console.warn(`[SvgFaceInstructor] unknown primitive id: ${id}`);
          return null;
        }
        return renderer(intensity ?? 1);
      })
      .filter((d): d is Partial<FaceState> => d !== null);

    let composed = composeFaceState(NEUTRAL_FACE_STATE, deltas);
    // X-ray mode: drop skin opacity to reveal tongue layer.
    if (config.show_xray) {
      composed = { ...composed, skinOpacity: 0.4, tongueVisible: true };
    }
    return composed;
  }, [config]);

  // -----------------------------------------------------------------
  // 2. Translate config.repeat / hold_ms to a Framer Motion transition.
  // -----------------------------------------------------------------
  const transition = useMemo<Transition>(() => {
    if (!config || freeze) {
      return { duration: 0 };
    }
    const durationSec = Math.max(0.1, config.duration_ms / 1000);
    const holdSec = Math.max(0, (config.hold_ms ?? 0) / 1000);
    const base: Transition = {
      duration: durationSec,
      ease: 'easeInOut',
    };
    switch (config.repeat) {
      case 'infinite':
        return { ...base, repeat: Infinity, repeatType: 'mirror', repeatDelay: holdSec };
      case 'reverse':
        return { ...base, repeat: Infinity, repeatType: 'reverse', repeatDelay: holdSec };
      case 'once':
      default:
        return base;
    }
  }, [config, freeze]);

  // -----------------------------------------------------------------
  // 3. Render.
  // -----------------------------------------------------------------
  const heatRegions = config?.heat_regions ?? [];
  const caption = config?.caption_pt;

  return (
    <div
      style={{
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '100 / 115',
          background: 'var(--surface2, #1c1c2e)',
          borderRadius: '16px',
          padding: '8px',
          position: 'relative',
        }}
      >
        <svg
          viewBox="0 0 100 115"
          width="100%"
          height="100%"
          style={{ display: 'block' }}
        >
          <FaceBase peak={peak} transition={transition} freeze={freeze} />
          <HeatRegions regions={heatRegions} />
          {peak.showBreathingIndicator && <BreathingIndicator transition={transition} />}
          {peak.showPostureSilhouette && <PostureSilhouette />}
        </svg>
      </div>

      {showCaption && caption && (
        <p
          style={{
            margin: 0,
            color: 'var(--muted, #94a3b8)',
            fontSize: 'clamp(12px, 1.6vw, 14px)',
            textAlign: 'center',
            lineHeight: 1.45,
            maxWidth: '36ch',
          }}
        >
          {caption}
        </p>
      )}
    </div>
  );
}

// =====================================================================
// Decorative overlays
// =====================================================================

function BreathingIndicator({ transition }: { transition: Transition }) {
  return (
    <motion.circle
      cx="50"
      cy="6"
      r="2.5"
      fill="var(--accent2, #22d3ee)"
      animate={{ scale: [1, 1.6, 1], opacity: [0.6, 1, 0.6] }}
      transition={{ ...transition, repeat: Infinity, repeatType: 'mirror' }}
    />
  );
}

function PostureSilhouette() {
  // Decorative cervical posture guide — vertical alignment line + ear marker.
  return (
    <g opacity="0.45" stroke="var(--accent, #6366f1)" strokeDasharray="2 1.5" fill="none">
      <line x1="50" y1="0" x2="50" y2="115" strokeWidth="0.5" />
      <circle cx="50" cy="55" r="0.8" fill="var(--accent, #6366f1)" />
    </g>
  );
}
