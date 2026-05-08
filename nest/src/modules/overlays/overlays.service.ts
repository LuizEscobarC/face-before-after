/**
 * RenderedAssetService — orchestrates overlay rendering and persistence (PR-33, M3.1).
 *
 * Flow:
 *  1. Load LandmarkPayloadEntity for the given reportId+generatedAt.
 *  2. Download the face photo from the provided imageUrl.
 *  3. POST to Python /vision/render (multipart: image + landmarks_json + overlay_ids_json).
 *  4. Upload resulting PNG to MinIO at rendered/{reportId}/{uuid}.png.
 *  5. Persist RenderedAssetEntity and return it.
 *
 * References:
 *  - PLAN_M3_OVERLAYS §2 (PR-33 spec)
 *  - overlay_definition seed v1.0 (PR-30)
 *  - rendered_asset DDL (PR-30 migration 1746000160000-M3OverlayCatalog)
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { RenderedAssetEntity } from './infrastructure/entities/rendered-asset.entity.js';
import { LandmarkPayloadEntity } from '../analysis/infrastructure/entities/landmark-payload.entity.js';
import { MinioStorageService } from './infrastructure/services/minio-storage.service.js';

/** 7-day default TTL for rendered assets (DEC-24 in PLAN_M3_OVERLAYS). */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Overlay catalog version locked in by the seed (PR-30). */
const CATALOG_VERSION = 'v1.0';

@Injectable()
export class RenderedAssetService {
  private readonly logger = new Logger(RenderedAssetService.name);

  constructor(
    @InjectRepository(RenderedAssetEntity)
    private readonly assetRepo: Repository<RenderedAssetEntity>,

    @InjectRepository(LandmarkPayloadEntity)
    private readonly landmarkRepo: Repository<LandmarkPayloadEntity>,

    private readonly minioStorage: MinioStorageService,
  ) {}

  private get visionBaseUrl(): string {
    return process.env.VISION_SERVICE_URL ?? 'http://vision-service:8000';
  }

  /**
   * Render the requested overlays on `imageUrl`, persist and return the entity.
   *
   * @param reportId        UUID of the analysis_report (TypeORM logical PK).
   * @param generatedAt     Partition key of analysis_report (required for composite FK).
   * @param overlayIds      Which overlays to draw (e.g. ['axis_vertical', 'grid_thirds']).
   * @param imageUrl        URL of the base photo (e.g. http://vision-service:8000/vision/results/{runId}/annotated).
   * @param overlayCatalogVersion  Defaults to 'v1.0'.
   */
  async renderAndPersist(
    reportId: string,
    generatedAt: Date,
    overlayIds: string[],
    imageUrl: string,
    overlayCatalogVersion: string = CATALOG_VERSION,
  ): Promise<RenderedAssetEntity> {
    // -----------------------------------------------------------------------
    // 1. Load landmark payload
    // -----------------------------------------------------------------------
    const lp = await this.landmarkRepo.findOne({
      where: {
        analysisReportId: reportId,
        analysisReportGeneratedAt: generatedAt,
      },
    });
    if (!lp) {
      throw new NotFoundException(
        `No landmark payload found for reportId=${reportId} generatedAt=${generatedAt.toISOString()}`,
      );
    }

    // rawLandmarks is Array<{x,y,z}> (pixel coordinates from MediaPipe)
    const landmarkPixels: [number, number][] = lp.rawLandmarks.map(
      (pt: { x: number; y: number; z: number }) => [pt.x, pt.y],
    );

    // -----------------------------------------------------------------------
    // 2. Download base image
    // -----------------------------------------------------------------------
    let imageBuffer: Buffer;
    try {
      const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15_000) });
      if (!imgRes.ok) {
        throw new Error(`HTTP ${imgRes.status} from ${imageUrl}`);
      }
      imageBuffer = Buffer.from(await imgRes.arrayBuffer());
    } catch (err) {
      this.logger.error(`Failed to download image from ${imageUrl}: ${String(err)}`);
      throw new InternalServerErrorException(`Could not download base image: ${String(err)}`);
    }

    // -----------------------------------------------------------------------
    // 3. Call Python /vision/render (multipart)
    // -----------------------------------------------------------------------
    const visionRenderUrl = `${this.visionBaseUrl}/vision/render`;
    let pngBuffer: Buffer;
    try {
      const formData = new FormData();
      formData.append(
        'image',
        new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }),
        'photo.png',
      );
      formData.append('landmarks_json', JSON.stringify(landmarkPixels));
      formData.append('overlay_ids_json', JSON.stringify(overlayIds));

      const renderRes = await fetch(visionRenderUrl, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });

      if (!renderRes.ok) {
        const errText = await renderRes.text().catch(() => '(unreadable)');
        throw new Error(`Python render returned ${renderRes.status}: ${errText}`);
      }

      pngBuffer = Buffer.from(await renderRes.arrayBuffer());
    } catch (err) {
      this.logger.error(`Python render failed: ${String(err)}`);
      throw new InternalServerErrorException(`Render call failed: ${String(err)}`);
    }

    // -----------------------------------------------------------------------
    // 4. Upload PNG to MinIO
    // -----------------------------------------------------------------------
    const objectPath = `rendered/${reportId}/${randomUUID()}.png`;
    let storageUrl: string;
    try {
      storageUrl = await this.minioStorage.uploadPng(pngBuffer, objectPath);
    } catch (err) {
      this.logger.error(`MinIO upload failed: ${String(err)}`);
      throw new InternalServerErrorException(`Storage upload failed: ${String(err)}`);
    }

    // -----------------------------------------------------------------------
    // 5. Persist RenderedAssetEntity
    // -----------------------------------------------------------------------
    const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);

    const asset = this.assetRepo.create({
      analysisReportId: reportId,
      analysisReportGeneratedAt: generatedAt,
      assetType: 'single_annotated',
      region: null,
      overlayIdsApplied: overlayIds,
      overlayCatalogVersion,
      format: 'png',
      storageUrl,
      dimensions: null,
      byteSize: pngBuffer.byteLength,
      expiresAt,
      isExpired: false,
      processingNotes: null,
    });

    const saved = await this.assetRepo.save(asset) as RenderedAssetEntity;
    this.logger.log(
      `Rendered asset ${saved.id} for report ${reportId} (${overlayIds.join(',')})`,
    );
    return saved;
  }

  /** List all non-expired rendered assets for a report. */
  async findByReportId(
    reportId: string,
    generatedAt: Date,
  ): Promise<RenderedAssetEntity[]> {
    return this.assetRepo.find({
      where: {
        analysisReportId: reportId,
        analysisReportGeneratedAt: generatedAt,
        isExpired: false,
      },
      order: { createdAt: 'DESC' },
    });
  }
}
