/**
 * MinioStorageService — wraps MinIO SDK for rendered-asset uploads (PR-33, M3.1).
 *
 * Env vars (same keys as the Python minio_client.py):
 *   MINIO_ENDPOINT      (default: minio:9000)
 *   MINIO_ACCESS_KEY    (default: minioadmin)
 *   MINIO_SECRET_KEY    (default: minioadmin123)
 *   MINIO_BUCKET_NAME   (default: face-analysis)
 *   MINIO_USE_SSL       (default: false)
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

@Injectable()
export class MinioStorageService implements OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor() {
    const endpoint = process.env.MINIO_ENDPOINT ?? 'minio:9000';
    // Strip port from endpoint if present (Minio SDK takes host + port separately)
    const [host, portStr] = endpoint.split(':');
    const port = portStr ? parseInt(portStr, 10) : 9000;

    this.bucket = process.env.MINIO_BUCKET_NAME ?? 'face-analysis';
    const useSSL = (process.env.MINIO_USE_SSL ?? 'false').toLowerCase() === 'true';

    this.client = new Minio.Client({
      endPoint: host,
      port,
      useSSL,
      accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin123',
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }
    } catch (err) {
      // Non-fatal — MinIO might not be reachable in dev.
      this.logger.warn(`MinIO init warning: ${String(err)}`);
    }
  }

  /**
   * Upload a PNG Buffer to MinIO at the given object path.
   * Returns a `minio://{bucket}/{objectPath}` URI for storage in rendered_asset.
   */
  async uploadPng(data: Buffer, objectPath: string): Promise<string> {
    return this.uploadBuffer(data, objectPath, 'image/png');
  }

  /**
   * Upload any Buffer to MinIO with the given content type.
   * Returns a `minio://{bucket}/{objectPath}` URI.
   */
  async uploadBuffer(
    data: Buffer,
    objectPath: string,
    contentType: string,
  ): Promise<string> {
    await this.client.putObject(this.bucket, objectPath, data, data.length, {
      'Content-Type': contentType,
    });
    this.logger.debug(`Uploaded ${objectPath} (${data.length} bytes, ${contentType})`);
    return `minio://${this.bucket}/${objectPath}`;
  }
}
