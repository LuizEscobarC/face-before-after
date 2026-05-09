import type {
  AnalysisResult,
  AnalyzeMode,
  CaptureGuidelines,
  CompareResult,
  CompareWithConsistency,
  GlossaryTerm,
  NarrativeResponseDto,
} from "./types";

// Vite dev proxy maps /v1 → orchestrator (see vite.config.ts).
const BASE = "";

/**
 * Resize to max MAX_DIM on the longest side, then compress to JPEG.
 * Keeps aspect ratio. Reduces a 4K selfie (~8 MB) to ~150 KB.
 */
const MAX_DIM = 1280;
const JPEG_QUALITY = 0.88;

async function prepareImageBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, MAX_DIM / Math.max(w, h));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas não disponível.")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Falha ao ler imagem.")); };
    img.src = objectUrl;
  });
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as {
      message?: string;
      error?: { message?: string };
      detail?: unknown;
    };
    if (typeof data?.message === "string") return data.message;
    if (typeof data?.error?.message === "string") return data.error.message;
    if (typeof data?.detail === "string") return data.detail;
  } catch {
    /* noop */
  }
  return fallback;
}

// ---------- Photo Quality (Module 0) ----------

export type PhotoQualityDecision = {
  decision: "ACCEPT" | "WARN" | "REJECT";
  grade: "ALTA" | "MEDIA" | "BAIXA" | "REJEITADA";
  quality_score: number;
  recommendations: string[];
  fingerprint: string;
  fingerprint_parts: string[];
  subscore_breakdown: Record<string, number>;
  flags: {
    beard: boolean;
    beard_density: number;
    glasses: boolean;
    smile: boolean;
    hair_covering: boolean;
  };
  pose: { yaw: number; pitch: number; roll: number };
  sharpness_score: number;
  lighting_asymmetry: number;
  session_id: string;
  processing_mode: string;
  face_bbox?: { x: number; y: number; w: number; h: number };
};

/**
 * Crop a file to its detected face bounding box (+ padding) using the
 * same 1280px-resized frame the backend already processed.
 * Returns a new File ready to pass to analyzePhoto().
 */
export async function cropImageToFace(
  file: File,
  bbox: { x: number; y: number; w: number; h: number },
  padding = 0.30,
): Promise<File> {
  const resizedDataUrl = await prepareImageBase64(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const pad = Math.round(Math.max(bbox.w, bbox.h) * padding);
      const x = Math.max(0, bbox.x - pad);
      const y = Math.max(0, bbox.y - pad);
      const w = Math.min(img.naturalWidth - x, bbox.w + 2 * pad);
      const h = Math.min(img.naturalHeight - y, bbox.h + 2 * pad);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas não disponível.")); return; }
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error("Crop falhou.")); return; }
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.92,
      );
    };
    img.onerror = () => reject(new Error("Falha ao carregar imagem para crop."));
    img.src = resizedDataUrl;
  });
}

export async function validatePhotoQuality(
  file: File,
  sessionId?: string,
  userConsented?: boolean,
): Promise<PhotoQualityDecision> {
  const image_base64 = await prepareImageBase64(file);
  const res = await fetch(`${BASE}/v1/photo-quality/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_base64,
      session_id: sessionId,
      user_consented: userConsented ?? false,
    }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Falha ao validar qualidade da foto."));
  }
  return (await res.json()) as PhotoQualityDecision;
}

// ---------- Capture guidelines ----------

export async function fetchCaptureGuidelines(): Promise<CaptureGuidelines> {
  const res = await fetch(`${BASE}/v1/vision/capture-guidelines`);
  if (!res.ok) {
    throw new Error("Não foi possível carregar o guia de captura.");
  }
  const raw = (await res.json()) as {
    title: string;
    distance_meters: number | string;
    zoom: string;
    tips: string[];
  };
  return {
    title: raw.title,
    distance_meters:
      typeof raw.distance_meters === "number"
        ? `${raw.distance_meters}m`
        : raw.distance_meters,
    zoom: raw.zoom,
    tips: raw.tips,
  };
}

// ---------- Analyze ----------

export async function analyzePhoto(mode: AnalyzeMode, file: File): Promise<AnalysisResult> {
  const image_base64 = await prepareImageBase64(file);
  const visionMode: "premium" | "teaser" = mode === "premium" ? "premium" : "teaser";

  const res = await fetch(`${BASE}/v1/analysis`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_base64,
      mode: visionMode,
      filename: file.name,
      // O gatekeeper já foi invocado pelo frontend antes — pulamos para evitar reprocessamento.
      skip_quality_gate: true,
    }),
  });

  if (!res.ok) {
    throw new Error(await readError(res, "Falha ao analisar a foto."));
  }
  const wrapper = (await res.json()) as {
    run_id: string;
    output_dir: string;
    photo_url?: string;
    result: AnalysisResult;
  };
  return {
    ...wrapper.result,
    run_id: wrapper.run_id,
  };
}

// ---------- Compare ----------

export async function compareRuns(
  run_id_before: string,
  run_id_after: string,
): Promise<CompareWithConsistency> {
  const res = await fetch(`${BASE}/v1/analysis/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id_before, run_id_after }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Erro na comparação."));
  }
  return (await res.json()) as CompareWithConsistency;
}

// ---------- Glossary (não exposto pelo orchestrator ainda) ----------

export async function fetchGlossary(): Promise<Record<string, GlossaryTerm>> {
  return {};
}

// ---------- Client-side landmark submission ----------

export type ClientLandmarkPayload = {
  landmarks: number[][];
  pose: { yaw: number; pitch: number; roll: number };
  processing_mode: 'CLIENT_SIDE';
  session_id?: string;
};

export async function submitLandmarkPayload(
  payload: ClientLandmarkPayload,
): Promise<PhotoQualityDecision> {
  const res = await fetch(`${BASE}/v1/vision/submit-landmarks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Falha ao enviar landmarks do cliente.'));
  }
  return (await res.json()) as PhotoQualityDecision;
}

// ---------- Consistency types (E3) ----------

export type { CompareWithConsistency } from "./types";

// ---------- Evaluate landmarks → report_id ----------

export interface EvaluateFromLandmarksParams {
  landmarks: number[][];
  quality_score: number;
  session_id?: string;
}

export interface EvaluateResult {
  analysis_report_id: string;
}

export async function evaluateFromLandmarks(
  params: EvaluateFromLandmarksParams,
): Promise<EvaluateResult> {
  const res = await fetch(`${BASE}/v1/analysis/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      landmarks: params.landmarks,
      quality_context: { quality_score: params.quality_score },
      session_id: params.session_id,
    }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, 'Falha ao avaliar landmarks.'));
  }
  return (await res.json()) as EvaluateResult;
}

// ---------- Fetch narrative (M4.4) ----------

export async function fetchNarrative(reportId: string): Promise<NarrativeResponseDto> {
  const res = await fetch(`${BASE}/v1/analysis/${reportId}/narrative`);
  if (!res.ok) {
    throw new Error(await readError(res, 'Falha ao carregar diagnóstico narrativo.'));
  }
  return (await res.json()) as NarrativeResponseDto;
}
