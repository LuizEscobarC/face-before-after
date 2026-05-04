import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { analyzePhoto, compareRuns, fetchCaptureGuidelines } from "../api";
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

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export function CapturePage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<AnalyzeMode>("free");
  const [file, setFile] = useState<File | null>(null);
  const [fileBefore, setFileBefore] = useState<File | null>(null);
  const [fileAfter, setFileAfter] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cameraOn, setCameraOn] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [guidelines, setGuidelines] = useState<CaptureGuidelines>(fallbackGuidelines);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetchCaptureGuidelines()
      .then((data) => setGuidelines(data))
      .catch(() => setGuidelines(fallbackGuidelines));
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    return () => {
      stopStream(stream);
    };
  }, [stream]);

  const onFilePicked = (picked: File | null) => {
    if (!picked) return;
    if (!["image/png", "image/jpeg"].includes(picked.type)) {
      setError("Formato inválido. Use PNG ou JPG/JPEG.");
      return;
    }
    setError("");
    setFile(picked);
  };

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onFilePicked(event.target.files?.[0] ?? null);
  };

  const openCamera = async () => {
    setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      setStream(media);
      setCameraOn(true);
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        await videoRef.current.play();
      }
    } catch {
      setError("Não foi possível abrir a câmera. Verifique permissão do navegador.");
    }
  };

  const closeCamera = () => {
    stopStream(stream);
    setStream(null);
    setCameraOn(false);
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) {
      setError("Câmera indisponível para captura.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video.videoWidth || !video.videoHeight) {
      setError("Aguarde a câmera carregar antes de capturar.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Não foi possível processar a captura.");
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Falha ao capturar a imagem.");
          return;
        }
        const captured = new File([blob], `captura-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setFile(captured);
        setError("");
      },
      "image/jpeg",
      0.95
    );
  };

  const submit = async () => {    if (mode === "compare") {
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
        const runAfter  = resAfter.run_id;
        if (!runBefore || !runAfter) throw new Error("run_id n\u00e3o retornado pela API.");
        const compareResult = await compareRuns(runBefore, runAfter);
        navigate("/resultado/compare", { state: { compareResult, resBefore, resAfter } });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro inesperado na compara\u00e7\u00e3o.";
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

    setBusy(true);
    setError("");
    try {
      const result = await analyzePhoto(mode, file);
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
          <h2 className="panel-title">Enviar ou tirar foto</h2>

          <div className="input-stack">
            <label className="field-label" htmlFor="upload-file">
              Selecionar foto (PNG/JPG)
            </label>
            <input
              id="upload-file"
              className="file-input"
              type="file"
              accept="image/png,image/jpeg"
              onChange={onFileInputChange}
            />

            <label className="field-label" htmlFor="capture-file">
              Abrir câmera do celular (captura direta)
            </label>
            <input
              id="capture-file"
              className="file-input"
              type="file"
              accept="image/png,image/jpeg"
              capture="user"
              onChange={onFileInputChange}
            />
          </div>

          <div className="camera-actions">
            {!cameraOn ? (
              <button type="button" className="btn btn-secondary" onClick={openCamera}>
                Abrir webcam
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-secondary" onClick={captureFromCamera}>
                  Capturar da webcam
                </button>
                <button type="button" className="btn btn-ghost" onClick={closeCamera}>
                  Fechar câmera
                </button>
              </>
            )}
          </div>

          {cameraOn && (
            <div className="video-wrap">
              <video ref={videoRef} playsInline muted className="video" />
            </div>
          )}

          <canvas ref={canvasRef} className="hidden-canvas" />

          {previewUrl && (
            <figure className="preview-wrap">
              <img src={previewUrl} alt="Prévia da foto escolhida" className="preview-image" />
              <figcaption>Prévia da foto enviada</figcaption>
            </figure>
          )}

          {error && <p className="error-text">{error}</p>}

          {mode === "compare" ? (
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label className="field-label" htmlFor="upload-before">Foto ANTES (PNG/JPG)</label>
                <input
                  id="upload-before"
                  className="file-input"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setFileBefore(e.target.files?.[0] ?? null)}
                />
                {fileBefore && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>✅ {fileBefore.name}</p>}
              </div>
              <div>
                <label className="field-label" htmlFor="upload-after">Foto DEPOIS (PNG/JPG)</label>
                <input
                  id="upload-after"
                  className="file-input"
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(e) => setFileAfter(e.target.files?.[0] ?? null)}
                />
                {fileAfter && <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>✅ {fileAfter.name}</p>}
              </div>
            </div>
          ) : null}

          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
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
            Dica prática: enquadre o rosto como foto 3x4, com espaço pequeno acima da cabeça e sem cortar queixo.
          </p>
        </article>
      </section>
    </main>
  );
}
