/**
 * FaceCalibrationContext — global one-time face calibration.
 *
 * The user opens the FaceCalibrationModal, shows a neutral face, and clicks
 * "Calibrar". The raw Partial<FaceState> at that moment is stored as the
 * `baseline`. Every subsequent liveDelta from the camera can be passed through
 * `applyCalibration(raw)` to subtract the personal resting bias.
 *
 * Baseline is persisted to localStorage so it survives page reloads.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { FaceState } from '../components/SvgFaceInstructor/faceState';

const STORAGE_KEY = 'face_calibration_baseline';

type FaceCalibrationContextValue = {
  /** Current calibration baseline. null = not calibrated yet. */
  baseline: Partial<FaceState> | null;
  /** True if a baseline has been captured. */
  hasBaseline: boolean;
  /**
   * Capture the current raw FaceState as the neutral baseline.
   * Call this while the user is showing a relaxed neutral face.
   */
  calibrate: (raw: Partial<FaceState>) => void;
  /** Clear the stored baseline. */
  clearCalibration: () => void;
  /**
   * Apply the calibration baseline to a raw live FaceState delta.
   * Numeric fields: offsets are subtracted; multiplier fields (Scale/Openness/
   * Flare/Opacity) are divided. Returns the adjusted delta.
   */
  applyCalibration: (raw: Partial<FaceState>) => Partial<FaceState>;
};

const FaceCalibrationContext = createContext<FaceCalibrationContextValue | null>(null);

export function FaceCalibrationProvider({ children }: { children: React.ReactNode }) {
  const [baseline, setBaseline] = useState<Partial<FaceState> | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Partial<FaceState>) : null;
    } catch {
      return null;
    }
  });

  // Sync to localStorage whenever baseline changes.
  useEffect(() => {
    if (baseline === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(baseline));
      } catch {
        // localStorage full — silently skip persistence
      }
    }
  }, [baseline]);

  const calibrate = useCallback((raw: Partial<FaceState>) => {
    setBaseline({ ...raw });
  }, []);

  const clearCalibration = useCallback(() => {
    setBaseline(null);
  }, []);

  const applyCalibration = useCallback(
    (raw: Partial<FaceState>): Partial<FaceState> => {
      if (!baseline) return raw;
      const out: Record<string, unknown> = { ...raw };
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'number') {
          const b = (baseline as Record<string, unknown>)[k];
          if (typeof b === 'number') {
            const isMultiplier = /Scale|Openness|Flare|Opacity/.test(k);
            out[k] = isMultiplier ? v / (b || 1) : v - b;
          }
        }
      }
      return out as Partial<FaceState>;
    },
    [baseline],
  );

  const value = useMemo(
    () => ({ baseline, hasBaseline: baseline !== null, calibrate, clearCalibration, applyCalibration }),
    [baseline, calibrate, clearCalibration, applyCalibration],
  );

  return (
    <FaceCalibrationContext.Provider value={value}>
      {children}
    </FaceCalibrationContext.Provider>
  );
}

export function useFaceCalibration(): FaceCalibrationContextValue {
  const ctx = useContext(FaceCalibrationContext);
  if (!ctx) throw new Error('useFaceCalibration must be used inside FaceCalibrationProvider');
  return ctx;
}
