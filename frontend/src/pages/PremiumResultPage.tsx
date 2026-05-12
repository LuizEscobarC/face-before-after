import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { evaluateFromLandmarks, fetchFindings, fetchGlossary, fetchNarrative, fetchReportRecommendations, type NarrativeFinding, type NarrativeRecommendation } from "../api";
import { MetricExplainer } from "../components/MetricExplainer";
import { DEFAULT_OVERLAYS, HeatmapImageLayer, OverlayLayer, OverlayToggleBar } from "../components/OverlayLayer";
import { OverlaySidebar } from "../components/OverlaySidebar";
import { BeforeIdealOverlay } from "../components/BeforeIdealOverlay";
import { MetricsMapLayer } from "../components/MetricsMapLayer";
import { IdealProportionsLayer } from "../components/IdealProportionsLayer";
import type { AnalysisResult, GlossaryTerm, MetricEvaluationResult, NarrativeResponseDto, PremiumMetricCategory } from "../types";

type LocationState = { result?: AnalysisResult };
type ViewMode = "landmarks" | "ideal" | "compare" | "overlays" | "before_ideal";

/**
 * Build the offsets array for POST /v1/vision/compose-before-ideal from the
 * metric evaluations carried by ``AnalysisResult``.
 *
 * The visual anchor (``landmark_index``) is supplied by the backend on each
 * ``MetricEvaluationResult.anchor_landmark_index`` (= first entry of the
 * metric's ``dependency_landmarks`` in ``metric_definition``). Metrics with
 * a null anchor or no improvement vector are skipped.
 *
 * Reference: PLAN_M3_OVERLAYS §2 PR-41/PR-42, MediaPipe Mesh-478.
 */
function buildComposeOffsets(
  evals: MetricEvaluationResult[],
): Array<{ landmark_index: number; dx_icu: number; dy_icu: number; metric_id: string }> {
  return evals
    .filter(
      (m) =>
        m.anchor_landmark_index !== null &&
        (m.improvement_vector_x !== null || m.improvement_vector_y !== null),
    )
    .map((m) => ({
      landmark_index: m.anchor_landmark_index as number,
      dx_icu: m.improvement_vector_x ?? 0,
      dy_icu: m.improvement_vector_y ?? 0,
      metric_id: m.metric_id,
    }));
}

function buildRegionAdherence(
  result?: AnalysisResult,
): Array<{ region: string; adherence: number; confidence: number }> {
  if (!result) return [];
  if (result.region_adherence && result.region_adherence.length > 0) {
    return result.region_adherence;
  }

  const byRegion = new Map<string, Array<{ adherence: number; confidence: number }>>();
  for (const metric of result.metric_evaluations ?? []) {
    if (!metric.region) continue;
    if (metric.deviation_normalized == null || metric.confidence_final == null) continue;
    const adherence = 1 - Math.min(1, Math.abs(metric.deviation_normalized));
    const confidence = Math.max(0, Math.min(1, metric.confidence_final));
    const samples = byRegion.get(metric.region) ?? [];
    samples.push({ adherence, confidence });
    byRegion.set(metric.region, samples);
  }

  const out: Array<{ region: string; adherence: number; confidence: number }> = [];
  for (const [region, samples] of byRegion.entries()) {
    const weight = samples.reduce((acc, item) => acc + item.confidence, 0);
    if (weight <= 0) continue;
    const adherence = samples.reduce((acc, item) => acc + (item.adherence * item.confidence), 0) / weight;
    out.push({
      region,
      adherence,
      confidence: Math.min(1, weight / samples.length),
    });
  }
  return out;
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

function narrativeSeverityColor(severity: string | null): string {
  if (!severity) return "var(--muted)";
  const s = severity.toUpperCase();
  if (s === "LEVE") return "#22d3ee";      // cyan
  if (s === "MODERADO") return "#6366f1";  // indigo
  if (s === "SEVERO") return "#a78bfa";    // violet
  return "var(--muted)";
}

function metricLabel(metricId: string): string {
  return metricId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function FindingsSection({ narrative, findings, glossary, loading }: { narrative: NarrativeResponseDto | null; findings: NarrativeFinding[] | null; glossary: Record<string, GlossaryTerm>; loading: boolean }) {
  if (!loading && !narrative) return null;
  // Prefer paginated findings (full list, sorted by severity); fall back to top-3 from narrative.
  const items: { metric_id: string; severity_3: string | null; narrative_text: string; deviation_normalized: number | null }[] =
    findings && findings.length > 0 ? findings : (narrative?.findings ?? []);
  const titleFor = (metricId: string) => glossary[metricId]?.termo ?? metricLabel(metricId);
  // deviation_normalized = (measured − ideal) / green_half_width.
  // |1.0| = exactly on the green-band edge, |2.0| = twice the tolerance, etc.
  // Render as a signed multiplier of the green tolerance, clamped to ±9.9.
  const fmtDeviation = (d: number) => {
    if (!isFinite(d)) return null;
    const clamped = Math.max(-9.9, Math.min(9.9, d));
    const sign = clamped >= 0 ? '+' : '';
    return `${sign}${clamped.toFixed(1)}× tol.`;
  };
  return (
    <section className="section">
      <h2 className="section-title">🔍 Diagnóstico Narrativo</h2>
      <p className="section-sub">Análise das métricas de maior impacto com base nos parâmetros clínicos de referência.</p>
      {loading && (
        <div style={{ display: "grid", gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: 80, background: "var(--surface2)", borderRadius: 12, opacity: 0.5, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      )}
      {!loading && items.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Nenhuma discrepância relevante identificada.</p>
      )}
      {!loading && items.map((f) => {
        const color = narrativeSeverityColor(f.severity_3);
        return (
          <div key={f.metric_id} style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, color: "var(--text)", fontSize: 14 }}>{titleFor(f.metric_id)}</span>
              {f.severity_3 && (
                <span style={{ fontSize: 11, padding: "2px 10px", borderRadius: 99, background: `${color}1e`, border: `1px solid ${color}4d`, color }}>
                  {f.severity_3.toUpperCase()}
                </span>
              )}
              {f.deviation_normalized !== null && f.deviation_normalized !== undefined && fmtDeviation(f.deviation_normalized) && (
                <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>
                  Desvio: {fmtDeviation(f.deviation_normalized)}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{f.narrative_text}</p>
          </div>
        );
      })}
      {!loading && narrative?.disclaimer && (
        <p style={{ marginTop: 12, fontSize: 11, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.5 }}>{narrative.disclaimer}</p>
      )}
    </section>
  );
}

type RecItem = {
  recommendation_id: string;
  rank: number;
  category: string;
  display_text_short_pt: string;
  display_text_long_pt?: string;
  requires_professional: boolean;
  professional_type: string | null;
};

function RecommendationsSection({ narrative, recommendations, loading }: { narrative: NarrativeResponseDto | null; recommendations: NarrativeRecommendation[] | null; loading: boolean }) {
  if (!loading && !narrative) return null;
  // Prefer paginated recommendations (full long copy); fall back to top-5 from narrative.
  const items: RecItem[] = recommendations && recommendations.length > 0
    ? recommendations.map((r, idx) => ({
        recommendation_id: r.recommendation_id,
        rank: r.final_priority_in_session ?? idx + 1,
        category: r.category,
        display_text_short_pt: r.display_text_short_pt,
        display_text_long_pt: r.display_text_long_pt,
        requires_professional: r.requires_professional,
        professional_type: r.professional_type,
      }))
    : (narrative?.recommendations ?? []).map((r) => ({
        recommendation_id: r.recommendation_id,
        rank: r.rank,
        category: r.category,
        display_text_short_pt: r.display_text_short_pt,
        requires_professional: r.requires_professional,
        professional_type: r.professional_type,
      }));
  return (
    <section className="section">
      <h2 className="section-title">💊 Recomendações Clínicas</h2>
      <p className="section-sub">Protocolo personalizado ordenado por prioridade e impacto.</p>
      {loading && (
        <div style={{ display: "grid", gap: 10 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ height: 56, background: "var(--surface2)", borderRadius: 12, opacity: 0.5, animation: "pulse 1.5s infinite" }} />
          ))}
        </div>
      )}
      {!loading && items.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>Nenhuma recomendação disponível para este perfil.</p>
      )}
      {!loading && items.map((r) => (
        <div key={r.recommendation_id} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", marginBottom: 10 }}>
          <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 99, background: "rgba(99,102,241,0.18)", border: "1px solid rgba(99,102,241,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, color: "#a5b4fc" }}>
            {r.rank}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{r.display_text_short_pt}</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "rgba(34,211,238,0.12)", border: "1px solid rgba(34,211,238,0.3)", color: "#22d3ee" }}>
                {r.category}
              </span>
              {r.requires_professional && (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.28)", color: "#fca5a5" }}>
                  👨‍⚕️ {r.professional_type ?? "Profissional"}
                </span>
              )}
            </div>
            {r.display_text_long_pt && r.display_text_long_pt !== r.display_text_short_pt && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{r.display_text_long_pt}</p>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

export function PremiumResultPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const result = (location.state as LocationState | null)?.result;

  const [glossary, setGlossary] = useState<Record<string, GlossaryTerm>>({});
  const [view, setView] = useState<ViewMode>("landmarks");
  const [activeOverlays, setActiveOverlays] = useState<string[]>(DEFAULT_OVERLAYS);
  /**
   * imgDims tracks BOTH the rendered (CSS-layout) dimensions and the natural
   * (intrinsic) dimensions of the overlay image.
   *
   * - `w / h`       — rendered size from getBoundingClientRect(). Used as the SVG
   *                   element's explicit pixel size so the overlay fills exactly the
   *                   same area as the visible <img>.
   * - `naturalW/H` — intrinsic pixel size. Used as the SVG viewBox so that
   *                   landmark coordinates (produced in natural-image pixel space by
   *                   MediaPipe) map correctly when the SVG is shown at a smaller
   *                   CSS-constrained size than the original photo.
   *
   * Without separating these, the SVG was sized to naturalWidth×naturalHeight
   * (often 1200×900) while the <img> was constrained to ~600px by CSS, causing
   * the overlay to overflow and landmark positions to appear at the wrong location.
   */
  const [imgDims, setImgDims] = useState<{
    w: number;
    h: number;
    naturalW: number;
    naturalH: number;
  } | null>(null);

  // PR-43 (M3.4) — before/ideal composition state
  const [beforeIdealUrl, setBeforeIdealUrl] = useState<string | null>(null);
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [showGuideLines, setShowGuideLines] = useState(true);
  const [showActualWireframe, setShowActualWireframe] = useState(true);
  // Mirrors `beforeIdealUrl` so the unmount cleanup (deps=[]) can revoke the
  // most recent URL. Without this the closure captures the initial null and
  // leaks the final blob URL on navigation away.
  const beforeIdealUrlRef = useRef<string | null>(null);
  // Ref to the overlay image element — used by ResizeObserver to keep imgDims
  // in sync when the window is resized (so the SVG always matches the rendered img).
  const overlayImgRef = useRef<HTMLImageElement>(null);

  // Task 5 (M3.6) — Metrics map layer interactive state
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [selectedIdealMetric, setSelectedIdealMetric] = useState<string | null>(null);
  const [idealDims, setIdealDims] = useState<{ naturalW: number; naturalH: number } | null>(null);

  // PR-62 (M4.5) — PDF download state
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // M4.4 — Narrative state (findings + recommendations from NarrativeService)
  const [narrative, setNarrative] = useState<NarrativeResponseDto | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  // PR-66 — paginated findings + recommendations (full list, full long copy).
  const [allFindings, setAllFindings] = useState<NarrativeFinding[] | null>(null);
  const [allRecommendations, setAllRecommendations] = useState<NarrativeRecommendation[] | null>(null);

  // PR-63 — analysis_report_id resolved by evaluateFromLandmarks (or from result.report_id).
  // Used by PR-66 heatmap wiring below.
  const [reportId, setReportId] = useState<string | null>(null);

  // PR-66 (M3.3) — heatmap PNG blob URLs keyed by overlay_id.
  const [heatmapAssetUrls, setHeatmapAssetUrls] = useState<Record<string, string>>({});
  const [heatmapLoading, setHeatmapLoading] = useState(false);
  // Tracks current blob URLs for cleanup on unmount.
  const heatmapUrlsRef = useRef<Record<string, string>>({});


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

  // M4.4 — Load narrative. If the backend already produced a report_id during the
  // main analysis, fetch the narrative directly. Only fall back to evaluating
  // landmarks when report_id is missing (legacy flow). Avoids a duplicate
  // POST /evaluate on every premium page mount.
  useEffect(() => {
    if (!result?.run_id) return;
    setNarrativeLoading(true);
    (async () => {
      try {
        let reportId = result.report_id;
        if (!reportId) {
          if (!result.landmarks) return;
          const evaluated = await evaluateFromLandmarks({
            landmarks: result.landmarks,
            quality_score: result.capture_confidence ?? 0.8,
          });
          reportId = evaluated.analysis_report_id;
        }
        setReportId(reportId);
        const data = await fetchNarrative(reportId);
        setNarrative(data);
      } catch (err) {
        console.error("Narrative load failed:", err);
      } finally {
        setNarrativeLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.run_id, result?.report_id]);

  // PR-66 — once we have a reportId, fetch the full paginated findings + recommendations.
  // These power the diagnostic + recommendation sections; narrative top-3/top-5 stays as fallback.
  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    (async () => {
      try {
        const [findings, recs] = await Promise.all([
          fetchFindings(reportId, { limit: 20, minSeverity: "mild" }),
          fetchReportRecommendations(reportId, { limit: 20 }),
        ]);
        if (cancelled) return;
        setAllFindings(findings);
        setAllRecommendations(recs);
      } catch (err) {
        console.error("Paginated findings/recommendations load failed:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [reportId]);

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
    if (beforeIdealUrlRef.current) {
      URL.revokeObjectURL(beforeIdealUrlRef.current);
      beforeIdealUrlRef.current = null;
    }
    setBeforeIdealUrl(null);
    setComposeError(null);
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
        const errBody = await res.text().catch(() => "");
        setComposeError(`Erro ${res.status}: ${errBody.slice(0, 120)}`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      beforeIdealUrlRef.current = url;
      setBeforeIdealUrl(url);
    } catch (e) {
      setComposeError("Falha ao gerar comparação vetorial.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, fetchCompose]);

  // Revoke last compose object URL on unmount. Reads from ref, so the closure
  // sees the most recent URL (not the initial null).
  useEffect(() => {
    return () => {
      if (beforeIdealUrlRef.current) {
        URL.revokeObjectURL(beforeIdealUrlRef.current);
        beforeIdealUrlRef.current = null;
      }
    };
  }, []);

  // Keep imgDims in sync with the rendered size of the overlay image so the SVG
  // stays aligned when the window is resized or the layout shifts.
  useEffect(() => {
    const img = overlayImgRef.current;
    if (!img) return;
    const observer = new ResizeObserver(() => {
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setImgDims((prev) => ({
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          naturalW: prev?.naturalW ?? img.naturalWidth,
          naturalH: prev?.naturalH ?? img.naturalHeight,
        }));
      }
    });
    observer.observe(img);
    return () => observer.disconnect();
  }, [view]); // re-attach when view changes (img mounts/unmounts)

  // PR-66 (M3.3) — Heatmap overlay IDs (mirrors HEATMAP_OVERLAY_IDS in OverlayLayer.tsx).
  const HEATMAP_IDS = new Set(["heatmap_asymmetry", "heatmap_ideal_adherence"]);

  // PR-66 (M3.3) — Fetch heatmap PNGs from POST /v1/vision/render-overlay when the
  // user activates a heatmap toggle in the overlays view. Each PNG is cached in
  // heatmapAssetUrls[overlayId] to avoid refetching on re-renders.
  // Only heatmap_asymmetry is fully supported (no regional adherence data needed).
  // heatmap_ideal_adherence is skipped if no regional scores are available.
  useEffect(() => {
    if (view !== "overlays") return;
    if (!result?.run_id || !result?.landmarks) return;
    const activeHeatmaps = activeOverlays.filter((id) => HEATMAP_IDS.has(id));
    if (activeHeatmaps.length === 0) return;
    const missing = activeHeatmaps.filter((id) => !heatmapAssetUrls[id]);
    if (missing.length === 0) return;

    const regionAdherence = buildRegionAdherence(result);

    setHeatmapLoading(true);
    void (async () => {
      try {
        const newUrls: Record<string, string> = {};
        await Promise.all(
          missing.map(async (overlayId) => {
            if (overlayId === "heatmap_ideal_adherence" && regionAdherence.length === 0) return;
            try {
              const res = await fetch("/v1/vision/render-overlay", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  runId: result.run_id,
                  landmarks: result.landmarks,
                  overlayIds: [overlayId],
                  regionAdherence: overlayId === "heatmap_ideal_adherence" ? regionAdherence : undefined,
                }),
              });
              if (res.ok) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                newUrls[overlayId] = url;
              }
            } catch (err) {
              console.warn(`Heatmap fetch failed for ${overlayId}:`, err);
            }
          }),
        );
        if (Object.keys(newUrls).length > 0) {
          heatmapUrlsRef.current = { ...heatmapUrlsRef.current, ...newUrls };
          setHeatmapAssetUrls((prev) => ({ ...prev, ...newUrls }));
        }
      } finally {
        setHeatmapLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, activeOverlays, result?.run_id]);

  // Revoke heatmap blob URLs on unmount.
  useEffect(() => {
    return () => {
      for (const url of Object.values(heatmapUrlsRef.current)) {
        URL.revokeObjectURL(url);
      }
      heatmapUrlsRef.current = {};
    };
  }, []);

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

  // Canonical (cropped + aligned) image — single source of truth for overlays.
  const canonicalUrl = result.run_id ? `/v1/vision/results/${result.run_id}/canonical` : null;
  const annotatedUrl = result.run_id ? `/v1/vision/results/${result.run_id}/annotated` : null;
  const originalUrl  = canonicalUrl;  // alias kept for compatibility w/ rest of page
  const simBase = result.run_id ? `/v1/vision/results/${result.run_id}/simulation` : null;
  const hasSimulation = !!(simBase && result.simulation_paths && !result.simulation_error);
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
        m.anchor_landmark_index !== null &&
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

          {result.overlay_annotations?.ideal_proportions && canonicalUrl && (
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
            <div style={{ marginTop: 8, fontSize: 11, color: "var(--muted)", lineHeight: 1.5, textAlign: "center" }}>
              Proximidade às proporções ideais medida em 88 métricas faciais (0–100)
            </div>
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

          {/* PR-62: PDF download button */}
          {result.run_id && (
            <button
              className="btn btn-ghost"
              style={{
                marginTop: 8,
                width: "100%",
                fontSize: 13,
                borderColor: "var(--accent)",
                color: "var(--accent)",
                opacity: pdfLoading ? 0.6 : 1,
              }}
              disabled={pdfLoading}
              onClick={async () => {
                if (!result.run_id) return;
                setPdfLoading(true);
                setPdfError(null);
                try {
                  // Use narrative findings/recommendations when available (M4.4),
                  // fall back to metric_evaluations for PDF content.
                  const findings = narrative
                    ? narrative.findings.map((f) => ({
                        metric_id: f.metric_id,
                        severity_3: f.severity_3,
                        severity_5: f.severity_5,           // pass all severity levels
                        narrative_text: f.narrative_text,
                        deviation_normalized: f.deviation_normalized,
                      }))
                    : (result.metric_evaluations ?? [])
                        .filter((m) => m.severity_5 && m.severity_5 !== "ideal")
                        .sort((a, b) => {
                          const order: Record<string, number> = { extreme: 5, strong: 4, moderate: 3, mild: 2, minimal: 1 };
                          return (order[b.severity_5 ?? ""] ?? 0) - (order[a.severity_5 ?? ""] ?? 0);
                        })
                        .slice(0, 3)
                        .map((m) => ({
                          metric_id: m.metric_id,
                          severity_3: m.severity_3 ?? null,
                          severity_5: m.severity_5 ?? null,  // pass all severity levels
                          narrative_text: `${m.metric_id.replace(/_/g, " ")} — severidade ${m.severity_3?.toLowerCase() ?? "indeterminada"}.`,
                          deviation_normalized: m.deviation_normalized ?? null,
                        }));

                  const recommendations = narrative
                    ? narrative.recommendations.map((r) => ({
                        recommendation_id: r.recommendation_id,
                        rank: r.rank,
                        category: r.category,
                        display_text_short_pt: r.display_text_short_pt,
                        requires_professional: r.requires_professional,
                        professional_type: r.professional_type,
                      }))
                    : [];

                  const res = await fetch(`/v1/analysis/run/${result.run_id}/pdf`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      global_score: narrative?.global_score ?? result.score ?? null,
                      findings,
                      recommendations,
                    }),
                  });

                  if (!res.ok) {
                    setPdfError("Erro ao gerar PDF. Tente novamente.");
                    return;
                  }

                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `relatorio_${result.run_id}.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  setPdfError("Falha na conexão. Tente novamente.");
                } finally {
                  setPdfLoading(false);
                }
              }}
            >
              {pdfLoading ? "Gerando PDF…" : "↓ Baixar relatório (PDF)"}
            </button>
          )}
          {pdfError && (
            <p style={{ fontSize: 11, color: "#ef4444", marginTop: 4, textAlign: "center" }}>
              {pdfError}
            </p>
          )}
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

              {view === "ideal" && canonicalUrl && (
                <div className="overlay-stage">
                  <div className="overlay-media">
                    <img
                      src={canonicalUrl}
                      alt="Proporções ideais"
                      className="panel-img overlay-stage-image"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        setIdealDims({ naturalW: img.naturalWidth, naturalH: img.naturalHeight });
                      }}
                    />
                    {result.overlay_annotations?.ideal_proportions && (
                      <IdealProportionsLayer
                        viewBoxWidth={idealDims?.naturalW || 1200}
                        viewBoxHeight={idealDims?.naturalH || 800}
                        landmarks={result.landmarks ?? []}
                        rows={result.overlay_annotations.ideal_proportions}
                        selectedMetricId={selectedIdealMetric}
                        onSelectMetric={(metricId) => {
                          setSelectedIdealMetric((prev) => (prev === metricId ? null : metricId));
                        }}
                      />
                    )}
                  </div>
                  {result.overlay_annotations && (
                    <div className="overlay-sidebars overlay-sidebars-ideal">
                      <OverlaySidebar
                        variant="ideal_proportions"
                        data={result.overlay_annotations}
                        selectedKey={selectedIdealMetric}
                        onSelectKey={(key) => setSelectedIdealMetric((prev) => (prev === key ? null : key))}
                      />
                    </div>
                  )}
                </div>
              )}

              {view === "compare" && simBase && (
                <BeforeAfterSlider
                  beforeSrc={`${simBase}/canonical`}
                  afterSrc={`${simBase}/symmetrized`}
                />
              )}

              {view === "overlays" && originalUrl && result.landmarks && (
                <div className="overlay-stage">
                  <div
                    className="overlay-media"
                    style={imgDims
                      ? { width: `${imgDims.w}px`, height: `${imgDims.h}px`, flex: "0 0 auto" }
                      : undefined}
                  >
                    <img
                      ref={overlayImgRef}
                      src={originalUrl}
                      alt="Rosto com overlays de referência"
                      className="panel-img overlay-stage-image"
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        // getBoundingClientRect() gives the rendered (CSS-constrained) size.
                        // naturalWidth/Height gives the intrinsic pixel size for the viewBox.
                        const rect = img.getBoundingClientRect();
                        setImgDims({
                          w: Math.round(rect.width)  || img.naturalWidth,
                          h: Math.round(rect.height) || img.naturalHeight,
                          naturalW: img.naturalWidth,
                          naturalH: img.naturalHeight,
                        });
                      }}
                    />
                    {/* z=30 heatmap layer (PR-40/PR-66, M3.3) — server-rendered PNG.
                        Fetched from POST /v1/vision/render-overlay (stateless proxy).
                        heatmapLoading shows a subtle spinner while fetching. */}
                    <HeatmapImageLayer
                      imageWidth={imgDims?.w ?? 640}
                      imageHeight={imgDims?.h ?? 480}
                      activeOverlays={activeOverlays}
                      heatmapAssetUrls={heatmapAssetUrls}
                    />
                    <OverlayLayer
                      landmarks={result.landmarks}
                      imageWidth={imgDims?.w ?? 640}
                      imageHeight={imgDims?.h ?? 480}
                      viewBoxWidth={imgDims?.naturalW}
                      viewBoxHeight={imgDims?.naturalH}
                      activeOverlays={activeOverlays}
                      metricEvaluations={result.metric_evaluations}
                      trichion_source={result.trichion_source}
                    />
                    {/* Task 5 (M3.6) — Metrics map layer (interactive SVG heatmap)
                        Render only when ideal-adherence heatmap is enabled to avoid
                        persistent translucent region blocks over the image. */}
                    {result.metric_evaluations && activeOverlays.includes("heatmap_ideal_adherence") && (
                      <MetricsMapLayer
                        viewBoxWidth={imgDims?.naturalW || 1200}
                        viewBoxHeight={imgDims?.naturalH || 800}
                        metric_evaluations={result.metric_evaluations}
                        region_adherence={result.region_adherence || {}}
                        overlay_metrics_map={result.overlay_annotations?.metrics_map}
                        onRegionClick={(region) => {
                          setSelectedRegion((prev) => (prev === region ? null : region));
                        }}
                        selectedRegion={selectedRegion}
                      />
                    )}
                  </div>
                  {result.overlay_annotations && (
                    <div className="overlay-sidebars">
                      {activeOverlays.includes("grid_thirds") &&
                        <OverlaySidebar variant="grid_thirds" data={result.overlay_annotations} />}
                      {activeOverlays.includes("grid_fifths") &&
                        <OverlaySidebar variant="grid_fifths" data={result.overlay_annotations} />}
                      {activeOverlays.includes("face_extents") &&
                        <OverlaySidebar variant="face_extents" data={result.overlay_annotations} />}
                      {activeOverlays.includes("heatmap_ideal_adherence") && !!buildRegionAdherence(result).length && (
                        <OverlaySidebar
                          variant="metrics_map"
                          data={result.overlay_annotations}
                          regionAdherence={buildRegionAdherence(result)}
                          selectedKey={selectedRegion}
                          onSelectKey={(key) => setSelectedRegion((prev) => (prev === key ? null : key))}
                        />
                      )}
                    </div>
                  )}
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
                    <div className="overlay-stage">
                      <div className="overlay-media">
                        <img
                          src={beforeIdealUrl}
                          alt="Comparação antes vs ideal com vetores"
                          className="panel-img overlay-stage-image"
                        />
                        {result.landmarks && (
                          <BeforeIdealOverlay
                            landmarks={result.landmarks}
                            imageWidth={imgDims?.w || 800}
                            imageHeight={imgDims?.h || 600}
                            viewBoxWidth={imgDims?.naturalW || 800}
                            viewBoxHeight={imgDims?.naturalH || 600}
                            metricEvaluations={result.metric_evaluations}
                          />
                        )}
                      </div>
                    </div>
                  )}
                  {!composeLoading && composeError && (
                    <div style={{ color: "#f87171", fontSize: 13, padding: 40, textAlign: "center" }}>
                      ⚠️ {composeError}
                    </div>
                  )}
                  {!composeLoading && !beforeIdealUrl && !composeError && (
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
              {(() => {
                // Feynman now comes from the backend glossary entry keyed by
                // the concrete metric_id (no more static lookup table).
                const mk = result.main_insight.metric_key;
                const feynman = mk ? glossary?.[mk]?.feynman ?? null : null;
                if (!feynman) return null;
                return (
                  <details className="main-insight-feynman">
                    <summary>💡 Explicar como se eu tivesse 5 anos</summary>
                    <p>{feynman}</p>
                  </details>
                );
              })()}
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

          {/* ── Diagnóstico Narrativo (M4.4) ── */}
          <FindingsSection narrative={narrative} findings={allFindings} glossary={glossary} loading={narrativeLoading} />

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
              <p className="section-sub">
                Como sua face é percebida socialmente — independente das proporções geométricas. Escala 0–10.
              </p>
              <div style={{ display: "grid", gap: 14, marginBottom: 16 }}>
                <div>
                  <BarRow label="Dominância" value={result.visual_status.dominance_score} />
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, paddingLeft: 2 }}>
                    Percepção de força e autoridade — baseada em fWHR, largura mandibular e proporção zigomática
                  </div>
                </div>
                <div>
                  <BarRow label="Atratividade" value={result.visual_status.attractiveness_score} />
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, paddingLeft: 2 }}>
                    Percepção de harmonia e juventude — baseada em ângulo do olhar, simetria e equilíbrio dos terços
                  </div>
                </div>
                <div>
                  <BarRow label="Vitalidade" value={result.visual_status.freshness_score} />
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3, paddingLeft: 2 }}>
                    Percepção de saúde e energia — baseada em uniformidade de pele, olheiras e abertura ocular
                  </div>
                </div>
              </div>
              <div style={{ padding: "10px 12px", background: "rgba(99,102,241,0.07)", border: "1px solid rgba(99,102,241,0.15)", borderRadius: 10, fontSize: 11, color: "var(--muted)", marginBottom: 12 }}>
                ℹ️ <strong style={{ color: "var(--text)" }}>Como ler:</strong> a Pontuação Geral (0–100) mede desvio geométrico de 88 métricas. A Percepção Visual (0–10) mede impressão social com base em pesquisa científica. Os dois sistemas são complementares — um rosto pode ter proporções ideais e percepção média, ou vice-versa.
              </div>
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
                  ["Assimetria Bilateral", "marquardt_deviation_pct_ipd", "%"],
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

          {/* ── Recomendações Clínicas (M4.4) ── */}
          <RecommendationsSection narrative={narrative} recommendations={allRecommendations} loading={narrativeLoading} />

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
