/**
 * FaceCalibrationModal — one-time global face calibration via webcam.
 *
 * The user opens this modal, shows a neutral face, and clicks "Calibrar".
 * The current MediaPipe FaceState is saved as the global calibration baseline
 * (persisted to localStorage). Future liveDelta values from any exercise
 * preview are relative to this baseline.
 *
 * No recording. No countdown. No timeline.
 */

import { useCallback, useEffect, useState } from 'react';
import { useLiveFaceState } from '../../biometric/useLiveFaceState';
import { useFaceCalibration } from '../../contexts/FaceCalibrationContext';
import { ExerciseStudioPreview } from '../ExerciseStudioPreview';

export type FaceCalibrationModalProps = {
  open: boolean;
  onClose: () => void;
};

export function FaceCalibrationModal({ open, onClose }: FaceCalibrationModalProps) {
  const live = useLiveFaceState();
  const { calibrate, clearCalibration, hasBaseline } = useFaceCalibration();
  const [justCalibrated, setJustCalibrated] = useState(false);

  // Auto-start camera when modal opens; stop on close.
  useEffect(() => {
    if (open) {
      void live.start();
    } else {
      live.stop();
      setJustCalibrated(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCalibrate = useCallback(() => {
    if (live.faceState) {
      calibrate(live.faceState);
      setJustCalibrated(true);
      setTimeout(() => setJustCalibrated(false), 2500);
    }
  }, [live.faceState, calibrate]);

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: 28,
          width: 420,
          maxWidth: '95vw',
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          color: 'var(--text)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px' }}>
            Calibrar Rosto
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
              padding: '2px 6px',
            }}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Instructions */}
        <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
          Posicione seu rosto na câmera em posição <strong style={{ color: 'var(--text)' }}>neutra e relaxada</strong> e
          clique em <strong style={{ color: 'var(--accent)' }}>Calibrar</strong>. O SVG usará esse
          perfil como referência para todos os exercícios.
        </p>

        {/* Status badge */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {hasBaseline && (
            <span
              style={{
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.35)',
                color: '#4ade80',
                borderRadius: 99,
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ✓ Calibrado
            </span>
          )}
          {!hasBaseline && (
            <span
              style={{
                background: 'rgba(148,163,184,0.08)',
                border: '1px solid rgba(148,163,184,0.2)',
                color: 'var(--muted)',
                borderRadius: 99,
                padding: '3px 10px',
                fontSize: 12,
              }}
            >
              Não calibrado
            </span>
          )}
          {live.isInitializing && (
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              Inicializando câmera…
            </span>
          )}
          {live.error && (
            <span style={{ color: '#f87171', fontSize: 12 }}>
              {live.error}
            </span>
          )}
          {justCalibrated && (
            <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
              Baseline salvo!
            </span>
          )}
        </div>

        {/* Live SVG preview */}
        <ExerciseStudioPreview
          animationConfig={null}
          biometricConfig={null}
          liveDelta={live.faceState}
          meshLandmarks={live.landmarks}
          showMesh={!!live.landmarks}
          playing={false}
          showCaption={false}
          height={300}
        />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleCalibrate}
            disabled={!live.faceState || live.isInitializing}
            style={{
              flex: 1,
              background: live.faceState ? 'var(--accent)' : 'rgba(99,102,241,0.3)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              padding: '10px 0',
              fontSize: 14,
              fontWeight: 600,
              cursor: live.faceState ? 'pointer' : 'not-allowed',
              transition: 'opacity 0.2s',
            }}
          >
            Calibrar
          </button>

          {hasBaseline && (
            <button
              onClick={() => {
                clearCalibration();
                setJustCalibrated(false);
              }}
              style={{
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.3)',
                color: '#f87171',
                borderRadius: 10,
                padding: '10px 14px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
