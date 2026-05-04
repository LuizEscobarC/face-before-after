import type { AnalysisResult, AnalyzeMode, CaptureGuidelines, CompareResult, GlossaryTerm } from "./types";

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

export async function fetchGlossary(): Promise<Record<string, GlossaryTerm>> {
  const res = await fetch("/api/glossary");
  if (!res.ok) throw new Error("Glossário indisponível");
  return (await res.json()) as Record<string, GlossaryTerm>;
}

export async function compareRuns(
  run_id_before: string,
  run_id_after: string,
): Promise<CompareResult> {
  const res = await fetch("/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ run_id_before, run_id_after }),
  });
  if (!res.ok) {
    let msg = "Erro na comparação.";
    try {
      const data = await res.json();
      if (data?.detail) msg = data.detail;
    } catch {
      // noop
    }
    throw new Error(msg);
  }
  return (await res.json()) as CompareResult;
}
