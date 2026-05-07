import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  analyzePhoto,
  compareRuns,
  cropImageToFace,
  fetchCaptureGuidelines,
  validatePhotoQuality,
  type PhotoQualityDecision,
} from "../api";
import { CaptureSourceTabs } from "../components/CaptureSourceTabs";
import { PhotoQualityCard } from "../components/PhotoQualityCard";
import type { AnalyzeMode, CaptureGuidelines } from "../types";

const fallbackGuidelines: CaptureGuidelines = {
  title: "Guia de Captura (estilo 3x4)",
  distance_meters: "0.5m a 0.8m",
  zoom: "2x quando possível",
  tips: [
    "Iluminação frontal homogênea.",
    "Rosto centralizado e bem visível.",
    "Cabeça frontal, sem inclinação excessiva.",
    "Evite desfoque e selfie muito próxima.",
  ],
};

export function CapturePage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<AnalyzeMode>("free");
  const [file, setFile] = useState<File | null>(null);
  const [fileBefore, setFileBefore] = useState<File | null>(null);
  const [fileAfter, setFileAfter] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [guidelines, setGuidelines] = useState<CaptureGuidelines>(fallbackGuidelines);
  const [quality, setQuality] = useState<PhotoQualityDecision | null>(null);
  const [validating, setValidating] = useState(false);

  useEffect(() => {
    fetchCaptureGuidelines()
      .then((data) => setGuidelines(data))
      .catch(() => setGuidelines(fallbackGuidelines));
  }, []);

  const handlePhotoReady = async (picked: File) => {
    setError("");
    setFile(picked);
    setQuality(null);
    setValidating(true);
    try {
      const decision = await validatePhotoQuality(picked);
      setQuality(decision);
      if (decision.decision === "REJECT") {
        setError(
          "A foto não passou nos critérios mínimos. Veja as recomendações abaixo e capture novamente.",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao validar a foto.";
      setError(message);
    } finally {
      setValidating(false);
    }
  };

  const handleRetake = () => {
    setFile(null);
    setQuality(null);
    setError("");
  };

  const submit = async () => {
    if (mode === "compare") {
      if (!fileBefore || !fileAfter) {
        setError("Escolha as fotos ANTES e DEPOIS para comparar.");
        return;
      }
      setBusy(true);
      setError("");
      try {
        const [resBefore, resAfter] = await Promise.all([
          analyzePhoto("premium", fileBefore),
          analyzePhoto("premium", fileAfter),
        ]);
        const runBefore = resBefore.run_id;
        const runAfter = resAfter.run_id;
        if (!runBefore || !runAfter) throw new Error("run_id não retornado pela API.");
        const compareResult = await compareRuns(runBefore, runAfter);
        navigate("/resultado/compare", { state: { compareResult, resBefore, resAfter } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro inesperado na comparação.";
        setError(message);
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!file) {
      setError("Escolha uma foto ou capture pela câmera antes de continuar.");
      return;
    }

    if (quality && quality.decision === "REJECT") {
      setError("A foto foi rejeitada pelo gatekeeper. Capture outra antes de continuar.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      // Crop to the face bounding box returned by the quality check (+ 30% padding).
      // If no bbox available (e.g. quality was skipped), fall back to the original file.
      const fileToAnalyze =
        quality?.face_bbox ? await cropImageToFace(file, quality.face_bbox) : file;
      const result = await analyzePhoto(mode, fileToAnalyze);
      navigate(mode === "premium" ? "/resultado/premium" : "/resultado/free", {
        state: { result },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro inesperado ao analisar foto.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <section className="hero">
        <p className="hero-kicker">Face Before/After</p>
        <h1 className="hero-title">Análise Facial com Upload ou Câmera</h1>
        <p className="hero-subtitle">
          Tire uma foto estilo 3x4 e receba seu resultado em duas versões: Free ou Premium.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel-title">Escolha sua experiência</h2>
        <div className="mode-switch">
          <button
            type="button"
            className={`mode-btn ${mode === "free" ? "is-active" : ""}`}
            onClick={() => setMode("free")}
          >
            Free
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === "premium" ? "is-active" : ""}`}
            onClick={() => setMode("premium")}
          >
            Premium
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === "compare" ? "is-active" : ""}`}
            onClick={() => setMode("compare")}
          >
            Antes/Depois
          </button>
        </div>
      </section>

      <section className="capture-layout">
        <article className="panel">
          <h2 className="panel-title">
            {mode === "compare" ? "Envie as duas fotos" : "Como você quer enviar a foto?"}
          </h2>

          {mode !== "compare" ? (
            <CaptureSourceTabs
              onPhotoReady={handlePhotoReady}
              busy={busy}
              currentFile={file}
            />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="field-label" htmlFor="upload-before">
                  Foto ANTES (PNG/JPG)
                </label>
                <input
                  id="upload-before"
                  className="file-input"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setFileBefore(e.target.files?.[0] ?? null)}
                />
                {fileBefore && (
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    ✅ {fileBefore.name}
                  </p>
                )}
              </div>
              <div>
                <label className="field-label" htmlFor="upload-after">
                  Foto DEPOIS (PNG/JPG)
                </label>
                <input
                  id="upload-after"
                  className="file-input"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setFileAfter(e.target.files?.[0] ?? null)}
                />
                {fileAfter && (
                  <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                    ✅ {fileAfter.name}
                  </p>
                )}
              </div>
            </div>
          )}

          {validating && (
            <p style={{ color: "var(--muted)", fontSize: 13 }}>Validando qualidade da foto…</p>
          )}

          {quality && mode !== "compare" && (
            <PhotoQualityCard decision={quality} onRetake={handleRetake} />
          )}

          {error && <p className="error-text">{error}</p>}

          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={busy}
          >
            {busy
              ? "Analisando..."
              : mode === "compare"
                ? "Comparar Antes/Depois"
                : `Gerar resultado ${mode === "premium" ? "Premium" : "Free"}`}
          </button>
        </article>

        <article className="panel">
          <h2 className="panel-title">{guidelines.title}</h2>
          <div className="meta-grid">
            <p>
              <strong>Distância:</strong> {guidelines.distance_meters}
            </p>
            <p>
              <strong>Zoom:</strong> {guidelines.zoom}
            </p>
          </div>
          <ul className="tips-list">
            {guidelines.tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <p className="hint-box">
            Dica prática: enquadre o rosto como foto 3x4, com espaço pequeno acima da
            cabeça e sem cortar queixo.
          </p>
        </article>
      </section>
    </main>
  );
}
