/**
 * PR-61 — PdfController
 *
 * Maps ``POST /v1/analysis/:id/pdf`` to ``PdfService``.
 *
 * Returns JSON: ``{ pdf_url, report_id, asset_id }``
 * where ``pdf_url`` is the MinIO URI (``minio://…``).
 *
 * The client (PR-62 frontend) will call this endpoint to trigger
 * PDF generation and receive the URL for download.
 */
import {
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { PdfService, PdfGenerationResult } from './pdf.service.js';

@Controller('v1/analysis')
export class PdfController {
  constructor(private readonly pdfService: PdfService) {}

  /**
   * Generate (or regenerate) the PDF report for a completed analysis.
   * Idempotent: replaces existing PDF asset if already generated.
   * @param id Analysis report UUID
   */
  @Post(':id/pdf')
  @HttpCode(HttpStatus.OK)
  async generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PdfGenerationResult> {
    return this.pdfService.generateForReport(id);
  }
}
