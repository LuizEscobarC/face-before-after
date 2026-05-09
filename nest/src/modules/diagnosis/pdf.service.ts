/**
 * PR-61 — PdfService (M4.5 Nest side)
 *
 * Orchestrates:
 *   1. Retrieve narrative data via ``NarrativeService`` (findings +
 *      recommendations + global_score) — already persists rec links.
 *   2. Forward to Python ``POST /vision/generate-pdf`` via ``VisionClient``.
 *   3. Upload resulting PDF bytes to MinIO at
 *      ``rendered/pdf/{reportId}.pdf``.
 *   4. Persist a ``rendered_asset`` row with ``asset_type='report_pdf'``.
 *   5. Return ``{ pdf_url, report_id }``.
 *
 * Idempotent: if a ``rendered_asset`` row with ``asset_type='report_pdf'``
 * already exists for this report, it is deleted and replaced (re-generation
 * re-runs the matching + scoring pipeline too via NarrativeService).
 *
 * References:
 *   - PLAN_M4_NARRATIVE.md §4 (M4.5 backlog, PR-61 row)
 *   - PR-60: Python PdfBuilder (generates the actual PDF)
 *   - PR-57: RecommendationEngine (called inside NarrativeService)
 *   - PR-59: NarrativeService (aggregates data for PDF)
 */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { NarrativeService } from './narrative.service.js';
import { VisionClient } from '../vision/vision.client.js';
import { MinioStorageService } from '../overlays/infrastructure/services/minio-storage.service.js';
import { RenderedAssetEntity } from '../overlays/infrastructure/entities/rendered-asset.entity.js';
import { AnalysisReportEntity } from '../analysis/infrastructure/entities/analysis-report.entity.js';

export interface PdfGenerationResult {
  pdf_url: string;
  report_id: string;
  asset_id: string;
}

@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);

  constructor(
    private readonly narrativeService: NarrativeService,
    private readonly visionClient: VisionClient,
    private readonly minioStorage: MinioStorageService,

    @InjectRepository(RenderedAssetEntity)
    private readonly assetRepo: Repository<RenderedAssetEntity>,

    @InjectRepository(AnalysisReportEntity)
    private readonly reportRepo: Repository<AnalysisReportEntity>,
  ) {}

  async generateForReport(reportId: string): Promise<PdfGenerationResult> {
    // 1. Load report for generatedAt (partition key)
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) {
      throw new NotFoundException(`Analysis report not found: ${reportId}`);
    }

    // 2. Retrieve narrative (also runs RecommendationEngine idempotently)
    const narrative = await this.narrativeService.narrativeForReport(reportId);

    // 3. Build Python request payload
    // Query existing non-PDF rendered assets for this report and include their
    // presigned URLs so the Python PdfBuilder can embed them (PR-67).
    const existingAssets = await this.assetRepo.find({
      where: { analysisReportId: reportId },
    });
    const renderedAssetUrls: string[] = [];
    for (const asset of existingAssets) {
      if (asset.assetType === 'report_pdf') continue;
      if (asset.isExpired) continue;
      const url = await this.minioStorage.storageUrlToPresigned(asset.storageUrl, 3600);
      if (url) renderedAssetUrls.push(url);
    }

    const pdfPayload = {
      report_id: reportId,
      generated_at: narrative.generated_at,
      global_score: narrative.global_score,
      findings: narrative.findings.map((f) => ({
        metric_id: f.metric_id,
        severity_3: f.severity_3,
        narrative_text: f.narrative_text,
        deviation_normalized: f.deviation_normalized,
      })),
      recommendations: narrative.recommendations.map((r) => ({
        recommendation_id: r.recommendation_id,
        rank: r.rank,
        category: r.category,
        display_text_short_pt: r.display_text_short_pt,
        requires_professional: r.requires_professional,
        professional_type: r.professional_type,
      })),
      disclaimer: narrative.disclaimer,
      rendered_asset_urls: renderedAssetUrls,
    };

    // 4. Call Python PDF generator
    let pdfBytes: Buffer;
    try {
      pdfBytes = await this.visionClient.generatePdf(pdfPayload);
    } catch (err) {
      this.logger.error(`Python PDF generation failed for report=${reportId}`, err);
      throw new InternalServerErrorException('PDF generation failed. Try again later.');
    }

    // 5. Upload to MinIO
    const objectPath = `rendered/pdf/${reportId}.pdf`;
    let storageUrl: string;
    try {
      storageUrl = await this.minioStorage.uploadBuffer(pdfBytes, objectPath, 'application/pdf');
    } catch (err) {
      this.logger.error(`MinIO upload failed for PDF report=${reportId}`, err);
      throw new InternalServerErrorException('PDF storage failed. Try again later.');
    }

    // 6. Delete existing PDF rendered_asset (idempotency)
    await this.assetRepo.delete({
      analysisReportId: reportId,
      assetType: 'report_pdf' as any,
    });

    // 7. Persist new rendered_asset row
    const asset = new RenderedAssetEntity();
    asset.analysisReportId = reportId;
    asset.analysisReportGeneratedAt = report.generatedAt;
    asset.assetType = 'report_pdf' as any;
    asset.region = null;
    asset.overlayIdsApplied = [];
    asset.overlayCatalogVersion = null;
    asset.storageUrl = storageUrl;
    asset.byteSize = pdfBytes.length;

    const saved = await this.assetRepo.save(asset) as RenderedAssetEntity;

    this.logger.log(
      `PDF rendered_asset ${saved.id} saved for report=${reportId} (${pdfBytes.length} bytes)`,
    );

    return {
      pdf_url: storageUrl,
      report_id: reportId,
      asset_id: saved.id,
    };
  }
}
