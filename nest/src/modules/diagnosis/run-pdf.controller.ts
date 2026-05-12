/**
 * PR-62 — RunPdfController
 *
 * ``POST /v1/analysis/run/:runId/pdf``
 *
 * Frontend-friendly PDF endpoint that accepts a Python ``run_id`` (which
 * the frontend already has from ``POST /v1/analysis``) instead of a DB
 * ``analysis_report_id`` (which requires the separate evaluate flow).
 *
 * Behaviour:
 *   1. Accept ``run_id`` as path param.
 *   2. Accept pre-computed data in the JSON body (findings, global_score)
 *      that the frontend has from the Python pipeline result.
 *   3. Forward to Python ``POST /vision/generate-pdf``.
 *   4. Stream the PDF bytes back to the client with
 *      ``Content-Disposition: attachment; filename="relatorio_{runId}.pdf"``
 *
 * Does NOT persist to DB (no RenderedAsset row) — this is the lightweight
 * path for the standard analysis flow. The full DB-backed path is available
 * via ``POST /v1/analysis/:id/pdf`` (PR-61) for analyses that went through
 * ``POST /v1/analysis/evaluate``.
 *
 * References:
 *   - PLAN_M4_NARRATIVE.md §4 (PR-62 row)
 *   - PR-60 (Python PdfBuilder)
 *   - PR-61 (DB-backed Nest PDF endpoint)
 */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { VisionClient } from '../vision/vision.client.js';

interface FindingPayload {
  metric_id: string;
  severity_3?: string | null;   // English 3-level: "mild" | "moderate" | "strong"
  severity_5?: string | null;   // English 5-level: "minimal" | "mild" | "moderate" | "strong" | "extreme"
  severity_pt?: string | null;  // PT-BR (already translated, passed through as-is)
  narrative_text?: string;      // preferred: rendered text from NarrativeService
  text_medium?: string;         // alternate field name (Python-native, passed through as-is)
  region_pt?: string;           // PT-BR region label (optional)
  deviation_normalized?: number | null;
}

interface RecommendationPayload {
  recommendation_id: string;
  rank?: number;
  category: string;
  display_text_short_pt: string;
  requires_professional: boolean;
  professional_type: string | null;
}

interface RunPdfRequestBody {
  global_score?: number | null;
  findings?: FindingPayload[];
  recommendations?: RecommendationPayload[];
  disclaimer?: string;
}

// ── Severity EN → PT-BR ────────────────────────────────────────────────────

const SEVERITY_PT: Record<string, string> = {
  minimal:  'mínimo',
  mild:     'leve',
  moderate: 'moderado',
  strong:   'considerável',
  extreme:  'extremo',
};

// ── metric_id → region label PT-BR (best-effort, falls back to formatted id) ─

function toRegionPt(metricId: string): string {
  const id = metricId.toLowerCase();
  if (/asymmetry|midline|global_asym/.test(id))                  return 'Simetria Facial';
  if (/^brow|interbrow|brow_arch|brow_tail|brow_height/.test(id)) return 'Sobrancelhas';
  if (/^eye|interpupillary|intercanthal|canthal/.test(id))        return 'Olhos';
  if (/^nose|nasal|alar|dorsum|nasal_tip/.test(id))               return 'Nariz';
  if (/^mouth|^lip|upper_lip|lower_lip|vermilion|lip_corner/.test(id)) return 'Boca';
  if (/^jaw|gonial|mandibular|chin_height/.test(id))              return 'Mandíbula';
  if (/zygomatic|malar|cheekbone|submalar|midface/.test(id))      return 'Maçãs do Rosto';
  if (/^forehead|temporal|hairline/.test(id))                     return 'Testa';
  if (/third_ratio|upper_third|middle_third|lower_third/.test(id)) return 'Terços Faciais';
  if (/^fifth|intercanthal_to_eye/.test(id))                      return 'Quintos Faciais';
  if (/^phi|golden/.test(id))                                     return 'Proporção Áurea';
  if (/^face_|convexity|e_line/.test(id))                         return 'Proporção Global';
  // fallback: "jaw_width_ratio" → "Jaw Width Ratio"
  return metricId
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const DEFAULT_DISCLAIMER =
  'Esta análise é gerada por inteligência artificial e tem caráter exclusivamente ' +
  'informativo. Não substitui a avaliação de profissionais de saúde qualificados. ' +
  'Os resultados podem variar de acordo com qualidade da foto, iluminação e ângulo. ' +
  'Consulte um médico ou especialista antes de tomar qualquer decisão baseada nestas informações.';

@Controller('v1/analysis')
export class RunPdfController {
  constructor(private readonly visionClient: VisionClient) {}

  /**
   * Generate and stream a PDF for a Python run_id.
   * The frontend passes available data in the body.
   */
  @Post('run/:runId/pdf')
  @HttpCode(HttpStatus.OK)
  async generateRunPdf(
    @Param('runId') runId: string,
    @Body() body: RunPdfRequestBody,
    @Res({ passthrough: false }) reply: FastifyReply,
  ): Promise<void> {
    // Transform frontend FindingPayload → Python PdfBuilder FindingData
    // Fields: narrative_text→text_medium, severity_3(EN)→severity_pt(PT-BR), derive region_pt
    const mappedFindings = (body.findings ?? []).map((f) => ({
      metric_id: f.metric_id,
      region_pt: f.region_pt ?? toRegionPt(f.metric_id),
      severity_pt:
        f.severity_pt ??
        SEVERITY_PT[(f.severity_5 ?? f.severity_3 ?? '').toLowerCase()] ??
        f.severity_3 ??
        '—',
      text_medium: f.text_medium ?? f.narrative_text ?? '—',
    }));

    // Recommendations already match PdfBuilder.RecommendationData shape
    const mappedRecommendations = (body.recommendations ?? []).map((r) => ({
      recommendation_id: r.recommendation_id,
      display_text_short_pt: r.display_text_short_pt,
      requires_professional: r.requires_professional,
      professional_type: r.professional_type ?? null,
      category: r.category,
    }));

    const pdfPayload = {
      report_id: runId,
      generated_at: new Date().toISOString(),
      global_score: body.global_score ?? null,
      findings: mappedFindings,
      recommendations: mappedRecommendations,
      disclaimer: body.disclaimer ?? DEFAULT_DISCLAIMER,
      rendered_asset_urls: [],
    };

    const pdfBytes = await this.visionClient.generatePdf(pdfPayload);

    void reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="relatorio_${runId}.pdf"`)
      .header('Content-Length', String(pdfBytes.length))
      .send(pdfBytes);
  }
}
