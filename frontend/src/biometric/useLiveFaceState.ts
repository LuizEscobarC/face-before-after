/**
 * useLiveFaceState — React hook that drives SvgFaceInstructor from a live
 * camera feed via the MediaPipe FaceLandmarker worker.
 *
 * Usage:
 *   const { faceState, isRunning, start, stop, error } = useLiveFaceState(modelUrl);
 *
 *   // Pass faceState to SvgFaceInstructor:
 *   <SvgFaceInstructor config={null} liveState={faceState} />
 *
 * The hook manages:
 *   1. Worker lifecycle (Comlink wrap of mediapipe.worker.ts)
 *   2. getUserMedia camera stream
 *   3. Frame-by-frame capture via hidden <canvas>
 *   4. Landmark extraction via detectVideoLandmarks()
 *   5. Conversion to Partial<FaceState> via landmarkToFaceState()
 *
 * Default model URL points to the local /models/face_landmarker.task bundled
 * in the frontend public/ directory. WASM runtime is served from /wasm/.
 * Override with a different path if needed.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import type { FaceState } from '../components/SvgFaceInstructor/faceState';
import { landmarkToFaceState } from './landmarkToFaceState';
import type { LandmarkPayload } from '../vision/mediapipe.worker';

type WorkerApi = {
  initialize(modelUrl: string): Promise<void>;
  detectVideoLandmarks(imageData: ImageData): Promise<LandmarkPayload | null>;
};

// Local model served from /public/models/ — no external dependency.
const DEFAULT_MODEL_URL = '/models/face_landmarker.task';

/** Target frame interval (ms). 24 fps ≈ 41ms; no need to go higher for this use case. */
const FRAME_INTERVAL_MS = 42;

/** Canvas size for landmark detection (smaller = faster CPU/GPU decode). */
const CAPTURE_WIDTH = 320;
const CAPTURE_HEIGHT = 240;

export type LiveFaceStateResult = {
  /** Latest converted FaceState delta from the live camera. null if no face detected. */
  faceState: Partial<FaceState> | null;
  /** Latest raw 478-point MediaPipe landmarks ([x_px, y_px, z_norm][]). null if no face. */
  landmarks: number[][] | null;
  /** True while the camera + worker loop is active. */
  isRunning: boolean;
  /** Start capturing. Requests camera permission and initializes the worker on first call. */
  start: () => Promise<void>;
  /** Stop capturing and release camera. */
  stop: () => void;
  /** Last error string if initialization or capture failed. */
  error: string | null;
  /** True while the MediaPipe model is being downloaded/initialized. */
  isInitializing: boolean;
};

export function useLiveFaceState(
  modelUrl: string = DEFAULT_MODEL_URL,
): LiveFaceStateResult {
  const [faceState, setFaceState] = useState<Partial<FaceState> | null>(null);
  const [landmarks, setLandmarks] = useState<number[][] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const apiRef = useRef<WorkerApi | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // ── Cleanup ────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      clearTimeout(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    setIsRunning(false);
    setFaceState(null);
    setLandmarks(null);
  }, []);

  // ── Frame loop ─────────────────────────────────────────────────────────
  const captureFrame = useCallback(async () => {
    const api = apiRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!api || !video || !canvas || video.readyState < 2) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);
    const imageData = ctx.getImageData(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);

    try {
      const result = await api.detectVideoLandmarks(Comlink.transfer(imageData, [imageData.data.buffer]));
      if (result) {
        setFaceState(landmarkToFaceState(result.landmarks, result.pose));
        setLandmarks(result.landmarks);
      } else {
        setFaceState(null);
        setLandmarks(null);
      }
    } catch {
      // Detection errors are transient; continue loop.
    }
  }, []);

  const runLoop = useCallback(() => {
    captureFrame().finally(() => {
      if (streamRef.current) {
        rafRef.current = setTimeout(runLoop, FRAME_INTERVAL_MS);
      }
    });
  }, [captureFrame]);

  // ── Start ──────────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    if (isRunning) return;
    setError(null);

    try {
      // 1. Initialize worker (only once across start/stop cycles).
      if (!initializedRef.current) {
        setIsInitializing(true);

        const worker = new Worker(
          new URL('../vision/mediapipe.worker.ts', import.meta.url),
        );
        workerRef.current = worker;
        const api = Comlink.wrap<WorkerApi>(worker);
        apiRef.current = api;

        await api.initialize(modelUrl);
        initializedRef.current = true;
        setIsInitializing(false);
      }

      // 2. Open camera stream.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: CAPTURE_WIDTH },
          height: { ideal: CAPTURE_HEIGHT },
          facingMode: 'user',
        },
        audio: false,
      });
      streamRef.current = stream;

      // 3. Create offscreen video element.
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      videoRef.current = video;

      // 4. Create offscreen canvas.
      const canvas = document.createElement('canvas');
      canvas.width = CAPTURE_WIDTH;
      canvas.height = CAPTURE_HEIGHT;
      canvasRef.current = canvas;

      setIsRunning(true);
      runLoop();
    } catch (err) {
      setIsInitializing(false);
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      cleanup();
    }
  }, [isRunning, modelUrl, runLoop, cleanup]);

  // ── Stop ───────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // ── Unmount cleanup ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      cleanup();
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
        initializedRef.current = false;
      }
    };
  }, [cleanup]);

  return { faceState, landmarks, isRunning, start, stop, error, isInitializing };
}
