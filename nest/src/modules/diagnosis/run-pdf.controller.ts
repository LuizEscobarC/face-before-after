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
  severity_3: string | null;
  narrative_text: string;
  deviation_normalized: number | null;
}

interface RecommendationPayload {
  recommendation_id: string;
  rank: number;
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
    const pdfPayload = {
      report_id: runId,
      generated_at: new Date().toISOString(),
      global_score: body.global_score ?? null,
      findings: body.findings ?? [],
      recommendations: body.recommendations ?? [],
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
