import type { AnalysisResult, AnalyzeMode, CaptureGuidelines } from "./types";

export async function fetchCaptureGuidelines(): Promise<CaptureGuidelines> {
  const res = await fetch("/api/capture-guidelines");
  if (!res.ok) {
    throw new Error("Não foi possível carregar o guia de captura.");
  }
  return (await res.json()) as CaptureGuidelines;
}

export async function analyzePhoto(mode: AnalyzeMode, file: File): Promise<AnalysisResult> {
  const endpoint = mode === "premium" ? "/api/analyze/premium" : "/api/analyze/free";
  const body = new FormData();
  body.append("photo", file);

  const res = await fetch(endpoint, {
    method: "POST",
    body,
  });

  if (!res.ok) {
    let msg = "Falha ao analisar a foto.";
    try {
      const data = await res.json();
      if (data?.detail) {
        msg = data.detail;
      }
    } catch {
      // noop
    }
    throw new Error(msg);
  }

  return (await res.json()) as AnalysisResult;
}
