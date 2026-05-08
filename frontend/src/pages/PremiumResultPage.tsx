import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchGlossary } from "../api";
import { MetricExplainer } from "../components/MetricExplainer";
import { DEFAULT_OVERLAYS, HeatmapImageLayer, OverlayLayer, OverlayToggleBar } from "../components/OverlayLayer";
import { feynmanFor } from "../data/feynman";
import type { AnalysisResult, GlossaryTerm, MetricEvaluationResult, PremiumMetricCategory } from "../types";

type LocationState = { result?: AnalysisResult };
type ViewMode = "landmarks" | "ideal" | "compare" | "overlays" | "before_ideal";

/**
 * PR-42/PR-43 (M3.4) — anchor landmark per metric_id for the before/ideal composer.
 * Mirrors IMPROVEMENT_ANCHOR in OverlayLayer.tsx (MediaPipe Mesh-478).
 * Only metrics that emit improvement_vector_x/y are listed here.
 * References: PLAN_M3_OVERLAYS §2 PR-41/PR-42, MediaPipe Mesh-478
 *   https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md
 */
const COMPOSE_ANCHOR: Record<string, number> = {
  midline_deviation:  1,    // P_NOSE_TIP (landmark 1)
  chin_height_ratio:  152,  // P_MENTON (landmark 152)
  brow_height_l:      107,  // P_BROW_LEFT_INNER
  brow_height_r:      336,  // P_BROW_RIGHT_INNER
};

/**
 * Build the offsets array for POST /v1/vision/compose-before-ideal from
 * metric_evaluations that carry improvement_vector_x/y.
 * Only metrics present in COMPOSE_ANCHOR are included.
 */
function buildComposeOffsets(
  evals: MetricEvaluationResult[],
): Array<{ landmark_index: number; dx_icu: number; dy_icu: number; metric_id: string }> {
  return evals
    .filter(
      (m) =>
        COMPOSE_ANCHOR[m.metric_id] !== undefined &&
        (m.improvement_vector_x !== null || m.improvement_vector_y !== null),
    )
    .map((m) => ({
      landmark_index: COMPOSE_ANCHOR[m.metric_id],
      dx_icu: m.improvement_vector_x ?? 0,
      dy_icu: m.improvement_vector_y ?? 0,
      metric_id: m.metric_id,
    }));
}

const RANK_EMOJI = ["🥇", "🥈", "🥉"];
const PHASE_ICON = ["⚡", "🎯", "🏅"];
const TIER_LABEL: Record<number, string> = { 0: "Grátis", 1: "Essential", 2: "Premium" };

function severityClass(severity: string): string {
  const key = severity.toLowerCase();
  if (key.includes("excel")) return "sev-pill sev-excelente";
  if (key.includes("leve")) return "sev-pill sev-leve";
  if (key.includes("moder")) return "sev-pill sev-moderada";
  if (key.includes("acent")) return "sev-pill sev-acentuada";
  if (key.includes("sever")) return "sev-pill sev-severa";
  return "sev-pill sev-info";
}

function BarRow({ label, value }: { label: string; value: number | undefined }) {
  const pct = ((value ?? 0) / 10) * 100;
  const val = value?.toFixed(1) ?? "—";
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="bar-val">{val}</div>
    </div>
  );
}

function MetricsCategory({
  category,
  glossary,
}: {
  category: PremiumMetricCategory;
  glossary: Record<string, GlossaryTerm>;
}) {
  return (
    <details className="metric-group">
      <summary>
        {category.title} <span className="metric-count">{category.count} métricas</span>
      </summary>
      <div className="metric-explainer-list">
        {category.metrics.map((m) => (
          <MetricExplainer
            key={`${category.slug}-${m.key}`}
            metricKey={m.key}
            label={m.label}
            value={m.display_value}
            unit={m.unit}
            ideal={m.ideal}
            severity={m.severity}
            glossary={glossary}
          />
        ))}
      </div>
    </details>
  );
}

function BeforeAfterSlider({ beforeSrc, afterSrc }: { beforeSrc: string; afterSrc: string }) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePos = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const p = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setPos(p);
  };

  return (
    <div
      ref={containerRef}
      className="ba-slider"
      onMouseDown={() => { dragging.current = true; }}
      onMouseUp={() => { dragging.current = false; }}
      onMouseLeave={() => { dragging.current = false; }}
      onMouseMove={(e) => { if (dragging.current) updatePos(e.clientX); }}
      onTouchMove={(e) => { e.preventDefault(); updatePos(e.touches[0].clientX); }}
      onTouchStart={(e) => updatePos(e.touches[0].clientX)}
    >
      {/* Base layer — symmetrized (after) */}
      <img src={afterSrc} alt="Simetrizado" className="ba-base" draggable={false} />

      {/* Overlay layer — annotated original (before), revealed from left */}
      <img
        src={beforeSrc}
        alt="Original com marcações"
        className="ba-overlay"
        draggable={false}
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />

      {/* Divider + handle */}
      <div className="ba-divider" style={{ left: `${pos}%` }}>
        <div className="ba-divider-line" />
        <div className="ba-handle-btn">↔</div>
      </div>

      {/* Labels */}
      <div className="ba-tag ba-tag-l">Original</div>
      <div className="ba-tag ba-tag-r">Simetrizado</div>
    </div>
  );
}

export function PremiumResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as LocationState | null)?.result;

  const [glossary, setGlossary] = useState<Record<string, GlossaryTerm>>({});
  const [view, setView] = useState<ViewMode>("landmarks");
  const [activeOverlays, setActiveOverlays] = useState<string[]>(DEFAULT_OVERLAYS);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);

  // PR-43 (M3.4) — before/ideal composition state
  const [beforeIdealUrl, setBeforeIdealUrl] = useState<string | null>(null);
  const [composeLoading, setComposeLoading] = useState(false);
  const [showGuideLines, setShowGuideLines] = useState(true);
  const [showActualWireframe, setShowActualWireframe] = useState(true);

  const handleOverlayToggle = (id: string) => {
    setActiveOverlays((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
  };

  useEffect(() => {
    fetchGlossary()
      .then(setGlossary)
      .catch(() => {});
  }, []);

  /**
   * PR-43 (M3.4) — Fetch the before/ideal composition PNG from
   * POST /v1/vision/compose-before-ideal. Triggered when the user enters
   * the "before_ideal" view, or when showGuideLines/showActualWireframe toggles.
   *
   * References:
   *  - nest/src/modules/vision/vision.controller.ts (PR-42 endpoint)
   *  - backend/app/vision/services/before_ideal_composer.py (PR-41)
   *  - PLAN_M3_OVERLAYS §2 PR-42/PR-43, DEC-15, DEC-26
   */
  const fetchCompose = useCallback(async () => {
    if (!result?.run_id || !result?.landmarks || !result?.metric_evaluations) return;
    setComposeLoading(true);
    // Revoke previous object URL to avoid memory leaks.
    setBeforeIdealUrl((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
    try {
      const offsets = buildComposeOffsets(result.metric_evaluations);
      const res = await fetch("/v1/vision/compose-before-ideal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: result.run_id,
          landmarks: result.landmarks,
          offsets,
          showGuideLines,
          showActualWireframe,
        }),
      });
      if (!res.ok) {
        console.error(`compose-before-ideal: HTTP ${res.status}`);
        return;
      }
      const blob = await res.blob();
      setBeforeIdealUrl(URL.createObjectURL(blob));
    } catch (e) {
      console.error("compose-before-ideal failed:", e);
    } finally {
      setComposeLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.run_id, result?.landmarks, result?.metric_evaluations, showGuideLines, showActualWireframe]);

  useEffect(() => {
    if (view === "before_ideal") {
      void fetchCompose();
    }
  // Revoke object URL when component unmounts to avoid memory leak.
  return () => {
    if (beforeIdealUrl) URL.revokeObjectURL(beforeIdealUrl);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, fetchCompose]);

  if (!result) {
    return (
      <div className="page" style={{ paddingTop: 60 }}>
        <section className="section">
          <h1 className="section-title">Resultado Premium não encontrado</h1>
          <p>Faça uma nova análise premium para visualizar os dados completos.</p>
          <button className="cta-btn" style={{ marginTop: 20 }} onClick={() => navigate("/")}>
            Voltar para captura
          </button>
        </section>
      </div>
    );
  }

  const annotatedUrl = result.run_id ? `/v1/vision/results/${result.run_id}/annotated` : null;
  const originalUrl = result.run_id ? `/v1/vision/results/${result.run_id}/original` : null;
  const simBase = result.run_id ? `/v1/vision/results/${result.run_id}/simulation` : null;
  const hasSimulation = !!(simBase && result.simulation_paths && !result.simulation_error);
  const hasIdeal = hasSimulation && !!result.simulation_paths?.ideal_proportions;
  const hasSymmetrized = hasSimulation && !!result.simulation_paths?.symmetrized;
  const hasWarnings = (result.photo_warnings?.length ?? 0) > 0;
  const hasRecs = (result.capture_recommendations?.length ?? 0) > 0;
  const phases = [
    result.evolution_path?.phase_1,
    result.evolution_path?.phase_2,
    result.evolution_path?.phase_3,
  ];

  /**
   * PR-43 — Show before/ideal view when we have landmarks + run_id +
   * at least one metric with an improvement vector.
   */
  const hasBeforeIdeal =
    !!(result.landmarks && result.run_id) &&
    !!(result.metric_evaluations?.some(
      (m) =>
        COMPOSE_ANCHOR[m.metric_id] !== undefined &&
        (m.improvement_vector_x !== null || m.improvement_vector_y !== null),
    ));

  const viewMeta: Record<ViewMode, { icon: string; label: string; sub: string }> = {
    landmarks:    { icon: "🗺", label: "Mapa de métricas", sub: "detectadas" },
    ideal:        { icon: "📐", label: "Proporções", sub: "ideais" },
    compare:      { icon: "⚖️", label: "Comparativo", sub: "original vs simetrizado" },
    overlays:     { icon: "🔬", label: "Overlays", sub: "linhas de referência" },
    before_ideal: { icon: "📏", label: "Comparação vetorial", sub: "antes vs ideal" },
  };

  return (
    <>
      {/* ── HERO ── */}
      <div className="hero">
        <div className="page">
          <div className="hero-badge">Face Before/After · Análise de Presença Visual</div>
          <h1 className="hero-title">Sua análise facial está pronta</h1>
          <p className="hero-sub">Veja o que os outros percebem — e o que é possível melhorar.</p>
        </div>
      </div>

      {/* ── TWO-COLUMN LAYOUT ── */}
      <div className="result-layout">

        {/* SIDEBAR */}
        <aside className="view-sidebar">
          <div className="view-sidebar-label">Visualizações</div>

          {annotatedUrl && (
            <button
              className={`view-btn${view === "landmarks" ? " view-btn-active" : ""}`}
              onClick={() => setView("landmarks")}
            >
              <span className="view-btn-icon">🗺</span>
              <span className="view-btn-text">
                Mapa de métricas
                <small>detectadas</small>
              </span>
            </button>
          )}

          {hasIdeal && (
            <button
              className={`view-btn${view === "ideal" ? " view-btn-active" : ""}`}
              onClick={() => setView("ideal")}
            >
              <span className="view-btn-icon">📐</span>
              <span className="view-btn-text">
                Proporções
                <small>ideais</small>
              </span>
            </button>
          )}

          {hasSymmetrized && annotatedUrl && (
            <button
              className={`view-btn${view === "compare" ? " view-btn-active" : ""}`}
              onClick={() => setView("compare")}
            >
              <span className="view-btn-icon">⚖️</span>
              <span className="view-btn-text">
                Comparativo
                <small>original vs simetrizado</small>
              </span>
            </button>
          )}

          {annotatedUrl && result.landmarks && (
            <button
              className={`view-btn${view === "overlays" ? " view-btn-active" : ""}`}
              onClick={() => setView("overlays")}
            >
              <span className="view-btn-icon">🔬</span>
              <span className="view-btn-text">
                Overlays
                <small>linhas de referência</small>
              </span>
            </button>
          )}

          {/* PR-43 (M3.4) — Before/ideal comparison button: visible only when
              improvement vectors exist and we have a run_id + landmarks.
              Reference: PLAN_M3_OVERLAYS §2 PR-42/PR-43, DEC-26 */}
          {hasBeforeIdeal && (
            <button
              className={`view-btn${view === "before_ideal" ? " view-btn-active" : ""}`}
              onClick={() => setView("before_ideal")}
            >
              <span className="view-btn-icon">📏</span>
              <span className="view-btn-text">
                Vetores ideais
                <small>antes vs ideal</small>
              </span>
            </button>
          )}

          {view === "overlays" && result.landmarks && (
            <OverlayToggleBar activeOverlays={activeOverlays} onToggle={handleOverlayToggle} />
          )}

          {/* PR-43 — toggle controls for the before/ideal composition */}
          {view === "before_ideal" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              <button
                className={`view-btn${showGuideLines ? " view-btn-active" : ""}`}
                style={{ fontSize: 12, padding: "6px 10px" }}
                onClick={() => setShowGuideLines((v) => !v)}
              >
                {showGuideLines ? "✅" : "⬜"} Linhas guia
              </button>
              <button
                className={`view-btn${showActualWireframe ? " view-btn-active" : ""}`}
                style={{ fontSize: 12, padding: "6px 10px" }}
                onClick={() => setShowActualWireframe((v) => !v)}
              >
                {showActualWireframe ? "✅" : "⬜"} Wireframe atual
              </button>
            </div>
          )}

          {/* Score card */}
          <div className="sidebar-score">
            <div className="sidebar-score-num">{result.score}</div>
            <div className="sidebar-score-label">pontuação geral</div>
            <div className="sidebar-tier">🏆 {result.tier}</div>
            {result.auto_crop?.applied && (
              <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
                ✂️ Enquadramento auto aplicado
              </div>
            )}
          </div>

          <button
            className="btn btn-ghost"
            style={{ marginTop: 8, width: "100%", fontSize: 13 }}
            onClick={() => navigate("/")}
          >
            ← Nova análise
          </button>
        </aside>

        {/* MAIN CONTENT */}
        <main className="result-main">

          {/* ── IMAGE VIEWER ── */}
          <div className="image-viewer">
            <div className="image-viewer-header">
              <div className="image-viewer-title">
                <span>{viewMeta[view].icon}</span>
                {viewMeta[view].label} <span style={{ color: "var(--muted)", fontWeight: 400 }}>{viewMeta[view].sub}</span>
              </div>
              {view === "compare" && (
                <div className="image-viewer-hint">Arraste o divisor para comparar</div>
              )}
            </div>

            <div className="image-viewer-body">
              {view === "landmarks" && annotatedUrl && (
                <img src={annotatedUrl} alt="Rosto analisado com landmarks" className="panel-img" />
              )}
              {view === "landmarks" && !annotatedUrl && (
                <div style={{ color: "var(--muted)", padding: 40, textAlign: "center" }}>
                  Imagem anotada não disponível
                </div>
              )}

              {view === "ideal" && simBase && (
                <img src={`${simBase}/ideal_proportions`} alt="Proporções ideais" className="panel-img" />
              )}

              {view === "compare" && simBase && (
                <BeforeAfterSlider
                  beforeSrc={`${simBase}/canonical`}
                  afterSrc={`${simBase}/symmetrized`}
                />
              )}

              {view === "overlays" && annotatedUrl && result.landmarks && (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img
                    src={annotatedUrl}
                    alt="Rosto com overlays de referência"
                    className="panel-img"
                    style={{ display: "block" }}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
                    }}
                  />
                  {/* z=30 heatmap layer (PR-40, M3.3) — server-rendered PNG.
                      heatmapAssetUrls is wired by the caller once Nest exposes a
                      /v1/overlays/:reportId/render call for heatmap_* overlay_ids;
                      until then the toggle is visible but the layer is a no-op. */}
                  <HeatmapImageLayer
                    imageWidth={imgDims?.w ?? 640}
                    imageHeight={imgDims?.h ?? 480}
                    activeOverlays={activeOverlays}
                  />
                  <OverlayLayer
                    landmarks={result.landmarks}
                    imageWidth={imgDims?.w ?? 640}
                    imageHeight={imgDims?.h ?? 480}
                    activeOverlays={activeOverlays}
                    metricEvaluations={result.metric_evaluations}
                  />
                </div>
              )}

              {/* PR-43 (M3.4) — Before/ideal composition view.
                  Fetches PNG from POST /v1/vision/compose-before-ideal (Nest proxy).
                  The Python composer (PR-41) returns a double-width image:
                    left  = original annotated photo
                    right = ideal wireframe overlay (ICU landmark offsets applied)
                  Toggles: showGuideLines (midline + intercanthal), showActualWireframe.
                  References:
                    PLAN_M3_OVERLAYS §2 PR-42/PR-43, DEC-15, DEC-26
                    nest/src/modules/vision/vision.controller.ts composeBeforeIdeal
                    backend/app/vision/services/before_ideal_composer.py (PR-41)
                    MDN URL.createObjectURL: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL
              */}
              {view === "before_ideal" && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 12,
                    minHeight: 200,
                  }}
                >
                  {composeLoading && (
                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: 14,
                        padding: 40,
                        textAlign: "center",
                      }}
                    >
                      ⏳ Gerando comparação vetorial…
                    </div>
                  )}
                  {!composeLoading && beforeIdealUrl && (
                    <img
                      src={beforeIdealUrl}
                      alt="Comparação antes vs ideal com vetores"
                      className="panel-img"
                      style={{ width: "100%", borderRadius: "var(--radius)", display: "block" }}
                    />
                  )}
                  {!composeLoading && !beforeIdealUrl && (
                    <div style={{ color: "var(--muted)", fontSize: 13, padding: 40 }}>
                      Clique em "Vetores ideais" para gerar a comparação.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Insight Principal ── */}
          {result.main_insight?.short_name && (
            <section className="main-insight" style={{ marginBottom: 20 }}>
              <div className="main-insight-kicker">💡 Insight principal</div>
              <h2 className="main-insight-title">{result.main_insight.short_name}</h2>
              {result.main_insight.detail && (
                <p className="main-insight-detail">{result.main_insight.detail}</p>
              )}
              {result.main_insight.metric_key && feynmanFor(result.main_insight.metric_key) && (
                <details className="main-insight-feynman">
                  <summary>💡 Explicar como se eu tivesse 5 anos</summary>
                  <p>{feynmanFor(result.main_insight.metric_key)}</p>
                </details>
              )}
            </section>
          )}

          {/* ── Benchmark strip ── */}
          {(result.benchmark_message || result.score_context) && (
            <div className="benchmark-strip" style={{ marginBottom: 20 }}>
              <div className="benchmark-icon">📊</div>
              <div>
                {result.benchmark_message && <div className="benchmark-text">{result.benchmark_message}</div>}
                {result.score_context && <div className="benchmark-ctx">{result.score_context}</div>}
              </div>
            </div>
          )}

          {/* ── Avisos de captura ── */}
          {(hasWarnings || hasRecs) && (
            <section className="section" style={{ borderColor: "rgba(251,191,36,0.4)", background: "rgba(251,191,36,0.06)" }}>
              <h2 className="section-title">⚠️ Atenção: qualidade da captura</h2>
              {hasWarnings && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: 13, color: "#fde68a" }}>
                  {result.photo_warnings!.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
              {hasRecs && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18, display: "grid", gap: 6, fontSize: 13, color: "#fde68a" }}>
                  {result.capture_recommendations!.map((r, i) => (
                    <li key={i}><strong>[{r.area.toUpperCase()}]</strong> {r.tip}</li>
                  ))}
                </ul>
              )}
              <p style={{ marginTop: 10, color: "var(--muted)", fontSize: 12, fontStyle: "italic" }}>
                Uma foto em melhores condições pode mudar completamente as recomendações.
              </p>
              {result.capture_confidence !== undefined && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
                    Confiança de captura: <strong style={{ color: "var(--text)" }}>{(result.capture_confidence * 100).toFixed(0)}%</strong>
                  </div>
                  <div className="bar-track" style={{ height: 6 }}>
                    <div className="bar-fill" style={{ width: `${result.capture_confidence * 100}%`, background: result.capture_confidence > 0.6 ? "#22d3ee" : "#f59e0b" }} />
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Primeira impressão ── */}
          <section className="section">
            <h2 className="section-title">👁 Primeira Impressão</h2>
            <p className="section-sub">O que a percepção externa capta nos primeiros segundos.</p>
            <div className="headline-box">
              <div className="headline-text">{result.first_impression?.headline || "—"}</div>
              {result.first_impression?.positive_signal && (
                <div className="positive-signal">✅ {result.first_impression.positive_signal}</div>
              )}
              {result.first_impression?.tags && result.first_impression.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {result.first_impression.tags.map((tag) => (
                    <span key={tag} className="badge-pill" style={{ fontSize: 12 }}>{tag}</span>
                  ))}
                </div>
              )}
              {result.first_impression?.main_risk && (
                <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "#fca5a5", fontSize: 13 }}>
                  ⚠️ {result.first_impression.main_risk}
                </div>
              )}
            </div>
          </section>

          {/* ── Simulação Visual (comparativo full grid, se disponível) ── */}
          {result.simulation_error && (
            <section className="section" style={{ borderColor: "rgba(251,191,36,0.3)", background: "rgba(251,191,36,0.05)" }}>
              <h2 className="section-title">🪞 Simulação Visual</h2>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>Simulação não disponível: {result.simulation_error}</p>
            </section>
          )}

          {/* ── Percepção visual ── */}
          {result.visual_status && (
            <section className="section">
              <h2 className="section-title">📈 Percepção Visual</h2>
              <p className="section-sub">Métricas de impacto percebido (escala 0–10).</p>
              <BarRow label="Dominância" value={result.visual_status.dominance_score} />
              <BarRow label="Atratividade" value={result.visual_status.attractiveness_score} />
              <BarRow label="Vitalidade" value={result.visual_status.freshness_score} />
              {result.visual_status.narrative && (
                <p className="narrative">{result.visual_status.narrative}</p>
              )}
            </section>
          )}

          {/* ── Assimetria Regional ── */}
          {result.measurements && (
            <section className="section">
              <h2 className="section-title">⚖️ Assimetria Regional</h2>
              <p className="section-sub">Valores normalizados em % da distância interpupilar (IPD).</p>
              {([
                ["Olhos — nível", "eye_level_difference_pct_ipd"],
                ["Olhos — eixo horizontal", "eye_horizontal_asymmetry_pct_ipd"],
                ["Nariz — desvio", "nose_deviation_pct_ipd"],
                ["Boca — desvio", "mouth_center_deviation_pct_ipd"],
                ["Queixo — desvio", "chin_deviation_pct_ipd"],
              ] as [string, string][]).map(([label, key]) => {
                const val = result.measurements?.[key];
                if (val == null) return null;
                const num = Number(val);
                const pct = Math.min((num / 8) * 100, 100);
                return (
                  <div key={key} className="bar-row">
                    <div className="bar-label">{label}</div>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${pct}%`, background: num < 2 ? "#22d3ee" : num < 4 ? "#a78bfa" : "#f87171" }} />
                    </div>
                    <div className="bar-val">{num.toFixed(1)}%</div>
                  </div>
                );
              })}
            </section>
          )}

          {/* ── Perfil Facial Detalhado ── */}
          {result.measurements && (
            <section className="section">
              <h2 className="section-title">🔬 Perfil Facial Detalhado</h2>
              <p className="section-sub">Toque em cada métrica para ver a explicação simples e o detalhe técnico.</p>
              <div className="metric-explainer-list">
                {([
                  ["Olheiras (esq)", "under_eye_darkness_left", ""],
                  ["Olheiras (dir)", "under_eye_darkness_right", ""],
                  ["Uniformidade da pele (esq)", "skin_uniformity_std_lab_left", ""],
                  ["Uniformidade da pele (dir)", "skin_uniformity_std_lab_right", ""],
                  ["Desvio Máscara Áurea", "marquardt_deviation_pct_ipd", "%"],
                  ["Inclinação Canthal", "canthal_tilt_mean_deg", "°"],
                  ["Razão facial (fWHR)", "fwhr", ""],
                  ["Terço inferior", "lower_third_ratio", ""],
                  ["Definição da mandíbula", "jawline_definition_score", ""],
                ] as [string, string, string][])
                  .map(([label, key, unit]) => {
                    const v = result.measurements?.[key];
                    if (v == null) return null;
                    const num = typeof v === "number" ? v : Number(v);
                    const display = Number.isFinite(num) ? num.toFixed(2) : String(v);
                    return (
                      <MetricExplainer
                        key={key}
                        metricKey={key}
                        label={label}
                        value={display}
                        unit={unit || undefined}
                        glossary={glossary}
                      />
                    );
                  })
                  .filter(Boolean)}
              </div>
            </section>
          )}

          {/* ── Top 3 ações ── */}
          {result.top3_actions_v2 && result.top3_actions_v2.length > 0 ? (
            <section className="section">
              <h2 className="section-title">✨ Seus Refinamentos de Alto Impacto</h2>
              <p className="section-sub">Ações ordenadas por impacto × facilidade de execução.</p>
              {result.top3_actions_v2.map((item) => (
                <div key={item.rank} className="action-card">
                  <div className="action-rank">{RANK_EMOJI[item.rank - 1] ?? item.rank}</div>
                  <div className="action-body">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div className="action-title">{item.short_action}</div>
                      {item.tier !== undefined && (
                        <span className="badge-pill" style={{ fontSize: 11, background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: "#22d3ee" }}>
                          {TIER_LABEL[item.tier] ?? `Tier ${item.tier}`}
                        </span>
                      )}
                    </div>
                    <div className="action-why">{item.why_it_matters}</div>
                    <div className="action-time">⏱ Resultado: {item.time_to_result}</div>
                  </div>
                </div>
              ))}
            </section>
          ) : result.top_leverage ? (
            <section className="section">
              <div className="actions-header">Sua maior alavanca</div>
              <div className="action-card">
                <div className="action-rank">🥇</div>
                <div className="action-body">
                  <div className="action-title">{result.top_leverage.short_action}</div>
                  <div className="action-why">{result.top_leverage.why_it_matters}</div>
                  {result.top_leverage.time_to_result && (
                    <div className="action-time">⏱ Resultado: {result.top_leverage.time_to_result}</div>
                  )}
                </div>
              </div>
            </section>
          ) : null}

          {/* ── Caminho de evolução ── */}
          {phases.some(Boolean) && (
            <section className="section">
              <h2 className="section-title">🗺 Caminho de Evolução</h2>
              <p className="section-sub">Plano em 3 fases progressivas.</p>
              {result.evolution_path?.skin_alert && (
                <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, color: "#fca5a5", fontSize: 13 }}>
                  🔴 Alerta de pele detectado — considere avaliação dermatológica antes de iniciar protocolos.
                </div>
              )}
              {result.evolution_path?.mutable_metrics && result.evolution_path.mutable_metrics.length > 0 && (
                <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 10, fontSize: 13, color: "#a5b4fc" }}>
                  🔧 <strong>{result.evolution_path.mutable_metrics.length}</strong> métricas com potencial de melhora identificadas.
                </div>
              )}
              {phases.map((phase, i) =>
                phase ? (
                  <div key={i} className="phase-card">
                    <div className="phase-header">
                      <span className="phase-icon">{PHASE_ICON[i]}</span>
                      <div>
                        <div className="phase-label">{phase.label || `Fase ${i + 1}`}</div>
                        <div className="phase-focus">{phase.focus || "—"}</div>
                      </div>
                      {phase.requires_professional && (
                        <span className="badge-pill" style={{ marginLeft: "auto", fontSize: 11, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                          👨‍⚕️ Profissional
                        </span>
                      )}
                    </div>
                    {phase.confidence_score !== undefined && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 3 }}>
                          Confiança do plano: {phase.confidence_score.toFixed(0)}%
                        </div>
                        <div className="bar-track" style={{ height: 4 }}>
                          <div className="bar-fill" style={{ width: `${phase.confidence_score}%` }} />
                        </div>
                      </div>
                    )}
                    {phase.actions && phase.actions.length > 0 && (
                      <ul className="phase-actions">
                        {phase.actions.map((a, j) => (
                          <li key={j}>
                            {a.titulo}
                            {a.metric_label && <span style={{ marginLeft: 6, fontSize: 11, color: "var(--accent2)", fontStyle: "italic" }}>({a.metric_label})</span>}
                            {a.frequencia && <span className="phase-freq"> — {a.frequencia}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(phase.reanalysis_label || phase.confidence_label) && (
                      <div className="phase-meta">
                        {phase.reanalysis_label && <>📅 Reanalisar: {phase.reanalysis_label}</>}
                        {phase.confidence_label && <> · {phase.confidence_label}</>}
                      </div>
                    )}
                  </div>
                ) : null
              )}
            </section>
          )}

          {/* ── Catálogo de métricas ── */}
          {result.premium_metrics_catalog && result.premium_metrics_catalog.length > 0 && (
            <section className="section">
              <h2 className="section-title">📚 Métricas Completas (Premium)</h2>
              <p className="section-sub">Todas as métricas calculadas para este rosto, organizadas por categoria.</p>
              {result.premium_metrics_catalog.map((category) => (
                <MetricsCategory key={category.slug} category={category} glossary={glossary} />
              ))}
            </section>
          )}

          {/* ── Plano de Ação Detalhado ── */}
          {result.recommendations && result.recommendations.filter(r => !r.severity.toLowerCase().includes("excel")).length > 0 && (
            <section className="section">
              <h2 className="section-title">📋 Plano de Ação Detalhado</h2>
              <p className="section-sub">Recomendações específicas ordenadas por impacto, baseadas nas métricas críticas.</p>
              {result.recommendations
                .filter(r => !r.severity.toLowerCase().includes("excel"))
                .map((rec) => (
                  <details key={rec.metric_key} style={{ marginBottom: 12, background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
                    <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10, listStyle: "none" }}>
                      <span className={severityClass(rec.severity)}>{rec.severity}</span>
                      <span style={{ fontWeight: 600, color: "var(--text)" }}>{rec.metric_label}</span>
                      <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>Ideal: {rec.ideal}</span>
                    </summary>
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 8px" }}>{rec.why_matters}</p>
                      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 6 }}>
                        {rec.actions.map((a, i) => (
                          <li key={i} style={{ fontSize: 13, color: "var(--text)" }}>
                            <strong>{a.titulo}</strong> — {a.descricao}
                            {a.frequencia && <span style={{ color: "var(--muted)", marginLeft: 6 }}>({a.frequencia})</span>}
                            {a.fonte && (
                              <a href={a.fonte.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8, fontSize: 11, color: "var(--accent2)" }}>
                                📖 {a.fonte.titulo}
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </details>
                ))}
            </section>
          )}

          {/* ── Glossário ── */}
          {Object.keys(glossary).length > 0 && (
            <section className="section">
              <h2 className="section-title">📖 Glossário (referência)</h2>
              <p className="section-sub">
                Termos técnicos usados na análise.
              </p>
              <div className="metric-explainer-list">
                {Object.entries(glossary).map(([key, term]) => (
                  <details key={key} className="metric-explainer" style={{ paddingTop: 0 }}>
                    <summary>
                      <span className="me-label">{term.termo}</span>
                      {term.unidade && <span className="me-unit">({term.unidade})</span>}
                      <span className="me-toggle" aria-hidden>▾</span>
                    </summary>
                    <div className="me-body">
                      <p className="me-mini">{term.descricao}</p>
                      {term.como_medido && (
                        <p className="me-mini" style={{ marginTop: 6 }}>
                          <strong>Como medimos:</strong> {term.como_medido}
                        </p>
                      )}
                      {term.faixas && (
                        <p className="me-mini" style={{ marginTop: 6 }}>
                          <strong>Faixas:</strong> {term.faixas}
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

        </main>
      </div>
    </>
  );
}
