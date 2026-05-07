import { useEffect, useRef, useState } from "react";
import { DeviceCapabilityDetector } from "../vision/DeviceCapabilityDetector";
import { ClientPhotoProcessor } from "../vision/ClientPhotoProcessor";
import type { RealtimeFeedback } from "../types";
import { submitLandmarkPayload } from "../api";

type SourceTab = "upload" | "webcam";

interface Props {
  /** Foto pronta para envio (sempre orientada normalmente — NUNCA espelhada). */
  onPhotoReady: (file: File, previewUrl: string) => void;
  /** Quando true, desabilita interações (durante o submit). */
  busy?: boolean;
  /** Foto atualmente selecionada (controla o preview). */
  currentFile?: File | null;
}

function describeMediaError(err: unknown): string {
  if (err && typeof err === "object" && "name" in err) {
    const name = String((err as { name?: string }).name);
    switch (name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return "Permissão da câmera negada. Clique no ícone de câmera ao lado da URL e libere o acesso, depois tente novamente.";
      case "NotFoundError":
      case "DevicesNotFoundError":
        return "Nenhuma câmera detectada. Tente fazer upload de uma foto.";
      case "NotReadableError":
      case "TrackStartError":
        return "A câmera está em uso por outro app. Feche outras janelas (Zoom, Meet, OBS) e tente novamente.";
      case "OverconstrainedError":
        return "Resolução solicitada não é suportada pela sua câmera.";
      default:
        return (err as { message?: string }).message || "Erro inesperado ao acessar a câmera.";
    }
  }
  return "Erro inesperado ao acessar a câmera.";
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
}

export function CaptureSourceTabs({ onPhotoReady, busy, currentFile }: Props) {
  const [activeTab, setActiveTab] = useState<SourceTab>("upload");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processorRef = useRef<ClientPhotoProcessor | null>(null);
  const frameCountRef = useRef(0);
  const [feedback, setFeedback] = useState<RealtimeFeedback | null>(null);
  const [clientProcessing, setClientProcessing] = useState(false);

  // Atualiza preview a partir do arquivo controlado
  useEffect(() => {
    if (!currentFile) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(currentFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [currentFile]);

  // Cleanup: fecha câmera ao desmontar
  useEffect(() => {
    return () => {
      stopStream(stream);
    };
  }, [stream]);

  // Fecha câmera ao trocar para upload
  useEffect(() => {
    if (activeTab === "upload" && cameraOn) {
      closeCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Initialize client-side MediaPipe processor when webcam tab is opened
  useEffect(() => {
    if (activeTab !== "webcam") return;
    let cancelled = false;
    DeviceCapabilityDetector.shouldFallback().then((shouldFallback) => {
      if (shouldFallback || cancelled) return;
      ClientPhotoProcessor.create()
        .then((processor) => {
          if (cancelled) { processor.dispose(); return; }
          processorRef.current = processor;
        })
        .catch(() => { /* silently fall back to server-side path */ });
    });
    return () => {
      cancelled = true;
      processorRef.current?.dispose();
      processorRef.current = null;
      setFeedback(null);
    };
  }, [activeTab]);

  // Real-time feedback loop: runs every 5 frames while camera is on
  useEffect(() => {
    if (!cameraOn || !processorRef.current) return;
    let animId: number;
    const loop = () => {
      frameCountRef.current++;
      if (
        frameCountRef.current % 5 === 0 &&
        videoRef.current &&
        processorRef.current
      ) {
        const video = videoRef.current;
        if (video.readyState >= 2 && video.videoWidth > 0) {
          const offscreen = document.createElement("canvas");
          offscreen.width = video.videoWidth;
          offscreen.height = video.videoHeight;
          const ctx = offscreen.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
            processorRef.current
              .validateRealtimeFeedback(imageData)
              .then((result) => { if (result) setFeedback(result); })
              .catch(() => {});
          }
        }
      }
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [cameraOn]);

  const validateAndEmit = (file: File) => {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setUploadError("Formato inválido. Use PNG ou JPG/JPEG.");
      return;
    }
    setUploadError("");
    const url = URL.createObjectURL(file);
    onPhotoReady(file, url);
  };

  const onUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) validateAndEmit(selectedFile);
  };

  const openCamera = async () => {
    setCameraError("");
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
      // Aguarda o React montar o vídeo. Se o ref estiver pronto, anexa direto;
      // caso contrário useEffect abaixo conecta.
      if (videoRef.current) {
        videoRef.current.srcObject = media;
        try {
          await videoRef.current.play();
        } catch {
          /* autoplay pode falhar em alguns browsers; ignora */
        }
      }
    } catch (err) {
      setCameraError(describeMediaError(err));
      setCameraOn(false);
    }
  };

  // Garante srcObject mesmo quando o vídeo monta DEPOIS do stream estar pronto
  useEffect(() => {
    if (cameraOn && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraOn, stream]);

  const closeCamera = () => {
    stopStream(stream);
    setStream(null);
    setCameraOn(false);
  };

  const captureFromCamera = () => {
    if (!videoRef.current || !canvasRef.current) {
      setCameraError("Câmera indisponível para captura.");
      return;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video.videoWidth || !video.videoHeight) {
      setCameraError("Aguarde a câmera carregar antes de capturar.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setCameraError("Não foi possível processar a captura.");
      return;
    }

    // A prévia mostra o vídeo espelhado (selfie), MAS gravamos sem espelhar:
    // backend recebe a imagem com orientação correta para landmarks anatômicos.
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setCameraError("Falha ao capturar a imagem.");
          return;
        }
        const captured = new File([blob], `captura-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        setCameraError("");
        const url = URL.createObjectURL(captured);

        if (processorRef.current) {
          try {
            setClientProcessing(true);
            const captureCtx = canvas.getContext("2d");
            if (captureCtx) {
              const imageData = captureCtx.getImageData(0, 0, canvas.width, canvas.height);
              const landmarkPayload = await processorRef.current.runMediaPipe(imageData);
              if (landmarkPayload) {
                await submitLandmarkPayload(landmarkPayload);
                onPhotoReady(captured, url);
                return;
              }
            }
          } catch {
            // fall through to server-side path
          } finally {
            setClientProcessing(false);
          }
        }

        onPhotoReady(captured, url);
      },
      "image/jpeg",
      0.95,
    );
  };

  return (
    <div className="capture-tabs">
      <div className="source-tabs" role="tablist" aria-label="Fonte da foto">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "upload"}
          className={`source-tab ${activeTab === "upload" ? "is-active" : ""}`}
          onClick={() => setActiveTab("upload")}
          disabled={busy}
        >
          📁 Enviar foto
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "webcam"}
          className={`source-tab ${activeTab === "webcam" ? "is-active" : ""}`}
          onClick={() => setActiveTab("webcam")}
          disabled={busy}
        >
          📷 Webcam
        </button>
      </div>

      {activeTab === "upload" && (
        <div className="tab-panel" role="tabpanel">
          <label className="field-label" htmlFor="upload-file">
            Selecionar foto (PNG/JPG)
          </label>
          <input
            id="upload-file"
            className="file-input"
            type="file"
            accept="image/png,image/jpeg"
            capture="user"
            onChange={onUploadChange}
            disabled={busy}
          />
          <p className="hint-line">
            No celular, abre direto a câmera. No computador, escolhe um arquivo.
          </p>
          {uploadError && <p className="error-text">{uploadError}</p>}
        </div>
      )}

      {activeTab === "webcam" && (
        <div className="tab-panel" role="tabpanel">
          {!cameraOn && !cameraError && (
            <div className="webcam-empty">
              <p className="hint-line">
                Vamos pedir acesso à sua câmera para capturar a foto agora mesmo.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={openCamera}
                disabled={busy}
              >
                Abrir webcam
              </button>
            </div>
          )}

          {cameraError && (
            <div className="webcam-error">
              <p className="error-text">{cameraError}</p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={openCamera}
                disabled={busy}
              >
                Tentar novamente
              </button>
            </div>
          )}

          {cameraOn && (
            <div className="webcam-frame">
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="webcam-video"
              />
              <svg className="webcam-guide" viewBox="0 0 100 100" preserveAspectRatio="none">
                {/* Máscara escura com janela 3:4 central */}
                <defs>
                  <mask id="frame-mask">
                    <rect x="0" y="0" width="100" height="100" fill="white" />
                    <rect x="31.25" y="6.25" width="37.5" height="87.5" fill="black" rx="2" />
                  </mask>
                </defs>
                <rect x="0" y="0" width="100" height="100" fill="rgba(0,0,0,0.4)" mask="url(#frame-mask)" />
                {/* Borda do frame 3:4 */}
                <rect
                  x="31.25"
                  y="6.25"
                  width="37.5"
                  height="87.5"
                  fill="none"
                  stroke="rgba(99,102,241,0.85)"
                  strokeWidth="0.4"
                  rx="2"
                />
                {/* Linha guia para os olhos (1/3 do topo do frame) */}
                <line
                  x1="33"
                  y1="35.4"
                  x2="67"
                  y2="35.4"
                  stroke="rgba(34,211,238,0.7)"
                  strokeWidth="0.3"
                  strokeDasharray="1 1"
                />
              </svg>
              <div className="webcam-hint">Alinhe os olhos com a linha tracejada</div>
              {feedback && (
                <div
                  className="feedback-ring"
                  title={feedback.face_detected ? (feedback.pose_ok ? "Pose OK" : "Ajuste o ângulo") : "Rosto não detectado"}
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background:
                      feedback.face_detected && feedback.pose_ok
                        ? "var(--accent2)"
                        : "red",
                    boxShadow: "0 0 6px rgba(0,0,0,0.5)",
                  }}
                />
              )}
            </div>
          )}

          {cameraOn && (
            <div className="camera-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={captureFromCamera}
                disabled={busy || clientProcessing}
              >
                {clientProcessing ? "⏳ Processando..." : "📸 Capturar"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeCamera}
                disabled={busy}
              >
                Fechar câmera
              </button>
            </div>
          )}

          <canvas ref={canvasRef} className="hidden-canvas" />
        </div>
      )}

      {previewUrl && (
        <figure className="preview-wrap">
          <img src={previewUrl} alt="Prévia da foto escolhida" className="preview-image" />
          <figcaption>Prévia da foto que será analisada</figcaption>
        </figure>
      )}
    </div>
  );
}
