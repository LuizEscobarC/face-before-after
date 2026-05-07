import type {
  AnalysisResult,
  AnalyzeMode,
  CaptureGuidelines,
  CompareResult,
  GlossaryTerm,
} from "./types";

// Vite dev proxy maps /v1 → orchestrator (see vite.config.ts).
const BASE = "";

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Falha ao ler imagem."));
      }
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
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
  subscore_breakdown: Record<string, number>;
  flags: Record<string, boolean>;
  pose: { yaw: number; pitch: number; roll: number };
  sharpness_score: number;
  lighting_asymmetry: number;
  session_id: string;
  processing_mode: string;
};

export async function validatePhotoQuality(
  file: File,
  sessionId?: string,
): Promise<PhotoQualityDecision> {
  const image_base64 = await fileToBase64(file);
  const res = await fetch(`${BASE}/v1/photo-quality/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64, session_id: sessionId }),
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
  const image_base64 = await fileToBase64(file);
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
): Promise<CompareResult> {
  const res = await fetch(`${BASE}/v1/analysis/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id_before, run_id_after }),
  });
  if (!res.ok) {
    throw new Error(await readError(res, "Erro na comparação."));
  }
  return (await res.json()) as CompareResult;
}

// ---------- Glossary (não exposto pelo orchestrator ainda) ----------

export async function fetchGlossary(): Promise<Record<string, GlossaryTerm>> {
  return {};
}
