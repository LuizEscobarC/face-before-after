import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import { ERROR_CODES, ERROR_MESSAGES } from '#shared/errors/error-catalog.js';
import {
  CaptureGuidelinesDto,
  CompareRequestDto,
  FullPipelineRequestDto,
  FullPipelineResponseDto,
  LandmarkRequestDto,
  LandmarkResponseDto,
  MetricsRequestDto,
  MetricsResponseDto,
} from './dto/vision.dto.js';
import type { ClientLandmarkPayloadDto } from './dto/client-landmark-payload.dto.js';
import type { MetricsV2ResponseDto } from '#modules/analysis/dto/evaluate.dto.js';
import { VISION_CLIENT_CONFIG, VisionClientConfig } from './vision.config.js';

@Injectable()
export class VisionClient {
  private readonly logger = new Logger(VisionClient.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;

  constructor(@Inject(VISION_CLIENT_CONFIG) config: VisionClientConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      maxBodyLength: 60 * 1024 * 1024,
      maxContentLength: 60 * 1024 * 1024,
      headers: { 'Content-Type': 'application/json' },
    });
    this.baseUrl = config.baseUrl;
  }

  health(): Promise<{ status: string }> {
    return this.request<{ status: string }>('GET', '/vision/health');
  }

  captureGuidelines(): Promise<CaptureGuidelinesDto> {
    return this.request<CaptureGuidelinesDto>('GET', '/vision/capture-guidelines');
  }

  landmarks(payload: LandmarkRequestDto): Promise<LandmarkResponseDto> {
    return this.request<LandmarkResponseDto>('POST', '/vision/landmarks', payload);
  }

  metrics(payload: MetricsRequestDto): Promise<MetricsResponseDto> {
    return this.request<MetricsResponseDto>('POST', '/vision/metrics', payload);
  }

  submitLandmarks(payload: ClientLandmarkPayloadDto): Promise<MetricsResponseDto> {
    return this.request<MetricsResponseDto>('POST', '/vision/metrics', {
      landmarks: payload.landmarks,
      quality_context: { quality_score: 1.0, regional_penalties: {} },
      session_id: payload.session_id,
    });
  }

  metricsV2(payload: {
    landmarks: number[][];
    quality_context: { quality_score: number; regional_penalties: Record<string, number>; pose?: Record<string, number> };
    session_id?: string | null;
    yaw_deg?: number;
    pitch_deg?: number;
    image_size?: number[] | null;
  }): Promise<MetricsV2ResponseDto> {
    return this.request<MetricsV2ResponseDto>('POST', '/vision/metrics-v2', payload);
  }

  fullPipeline(payload: FullPipelineRequestDto): Promise<FullPipelineResponseDto> {
    return this.request<FullPipelineResponseDto>('POST', '/vision/full-pipeline', payload);
  }

  compare(payload: CompareRequestDto): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/vision/compare', payload);
  }

  /**
   * Calls ``POST /vision/generate-pdf`` on the Python vision service.
   * Returns the raw PDF bytes.
   * PR-61 (M4.5).
   */
  async generatePdf(payload: Record<string, unknown>): Promise<Buffer> {
    try {
      const response = await this.http.post('/vision/generate-pdf', payload, {
        responseType: 'arraybuffer',
      });
      return Buffer.from(response.data as ArrayBuffer);
    } catch (error) {
      throw this.toHttpException(error, 'POST /vision/generate-pdf');
    }
  }

  async fetchOriginal(runId: string): Promise<{ data: Buffer; contentType: string }> {
    return this.fetchBinary(`/vision/results/${runId}/original`);
  }

  async fetchAnnotated(runId: string): Promise<{
    data: Buffer;
    contentType: string;
  }> {
    return this.fetchBinary(`/vision/results/${runId}/annotated`);
  }

  async fetchSimulation(
    runId: string,
    simType: 'canonical' | 'symmetrized' | 'ideal_proportions' | 'comparison_grid',
  ): Promise<{ data: Buffer; contentType: string }> {
    return this.fetchBinary(`/vision/results/${runId}/simulation/${simType}`);
  }

  /**
   * PR-42 (M3.4) — Generate a before/ideal composition PNG via Python.
   *
   * Fetches the annotated base photo by runId, then POSTs multipart to
   * Python /vision/compose-before-ideal with the full landmark array and
   * optional offsets. Returns the PNG buffer.
   *
   * References:
   *  - backend/app/vision/services/before_ideal_composer.py (PR-41)
   *  - PLAN_M3_OVERLAYS §2 PR-42, DEC-15, DEC-26
   *  - Pillow ImageDraw: https://pillow.readthedocs.io/en/stable/reference/ImageDraw.html
   */
  async composeBeforeIdeal(
    runId: string,
    landmarks: number[][],
    offsets: Array<{ landmark_index: number; dx_icu: number; dy_icu: number; metric_id?: string }>,
    showGuideLines = true,
    showActualWireframe = true,
  ): Promise<{ data: Buffer; contentType: string }> {
    // 1. Fetch the original (clean) base image from Python (uses existing fetchBinary).
    const imageResult = await this.fetchOriginal(runId);

    // 2. POST multipart to Python /vision/compose-before-ideal (native fetch for FormData).
    const formData = new FormData();
    formData.append(
      'image',
      new Blob([new Uint8Array(imageResult.data)], { type: 'image/png' }),
      'photo.png',
    );
    formData.append('landmarks_json', JSON.stringify(landmarks));
    formData.append('offsets_json', JSON.stringify(offsets));
    formData.append('show_guide_lines', showGuideLines ? 'true' : 'false');
    formData.append('show_actual_wireframe', showActualWireframe ? 'true' : 'false');

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/vision/compose-before-ideal`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      this.logger.error(`compose-before-ideal fetch failed: ${String(err)}`);
      throw new ServiceUnavailableException({
        code: ERROR_CODES.VISION_UPSTREAM_ERROR,
        message: ERROR_MESSAGES.vision.upstreamError,
        details: String(err),
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '(unreadable)');
      const status = response.status;
      this.logger.warn(`compose-before-ideal returned ${status}: ${errText}`);
      let detail: unknown = errText;
      try { detail = JSON.parse(errText) as unknown; } catch { /* keep as text */ }
      throw new HttpException(
        {
          code: ERROR_CODES.VISION_UPSTREAM_ERROR,
          message: `Compose-before-ideal failed (${status})`,
          details: detail,
        },
        status >= 400 && status < 600 ? status : HttpStatus.BAD_GATEWAY,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return { data: Buffer.from(arrayBuffer), contentType: 'image/png' };
  }

  /**
   * PR-66 (M3.3) — Stateless overlay render via Python POST /vision/render.
   *
   * Fetches the original photo by runId, posts multipart to Python
   * /vision/render with the landmark array and the requested overlay IDs,
   * then returns the resulting PNG buffer.
   *
   * Supports all overlay IDs in the v1.0 catalog including heatmap_asymmetry
   * and heatmap_ideal_adherence (the latter requires regionAdherence samples).
   *
   * References:
   *  - backend/app/vision/routers/render.py (PR-32 + PR-37/38)
   *  - PLAN_M3_OVERLAYS §2 PR-40 follow-up (heatmap wiring)
   */
  async renderOverlay(
    runId: string,
    landmarks: number[][],
    overlayIds: string[],
    regionAdherence?: Array<{ region: string; adherence: number; confidence: number }>,
  ): Promise<{ data: Buffer; contentType: string }> {
    const imageResult = await this.fetchOriginal(runId);

    const formData = new FormData();
    formData.append(
      'image',
      new Blob([new Uint8Array(imageResult.data)], { type: 'image/png' }),
      'photo.png',
    );
    formData.append('landmarks_json', JSON.stringify(landmarks));
    formData.append('overlay_ids_json', JSON.stringify(overlayIds));
    if (regionAdherence && regionAdherence.length > 0) {
      formData.append('region_adherence_json', JSON.stringify(regionAdherence));
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/vision/render`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(30_000),
      });
    } catch (err) {
      this.logger.error(`render-overlay fetch failed: ${String(err)}`);
      throw new ServiceUnavailableException({
        code: ERROR_CODES.VISION_UPSTREAM_ERROR,
        message: ERROR_MESSAGES.vision.upstreamError,
        details: String(err),
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '(unreadable)');
      const status = response.status;
      this.logger.warn(`render-overlay returned ${status}: ${errText}`);
      let detail: unknown = errText;
      try { detail = JSON.parse(errText) as unknown; } catch { /* keep as text */ }
      throw new HttpException(
        {
          code: ERROR_CODES.VISION_UPSTREAM_ERROR,
          message: `Render overlay failed (${status})`,
          details: detail,
        },
        status >= 400 && status < 600 ? status : HttpStatus.BAD_GATEWAY,
      );
    }

    return { data: Buffer.from(await response.arrayBuffer()), contentType: 'image/png' };
  }

  private async fetchBinary(path: string): Promise<{ data: Buffer; contentType: string }> {
    try {
      const response = await this.http.get(path, { responseType: 'arraybuffer' });
      const rawCt = response.headers['content-type'];
      return {
        data: Buffer.from(response.data as ArrayBuffer),
        contentType: typeof rawCt === 'string' ? rawCt : 'application/octet-stream',
      };
    } catch (error) {
      throw this.toHttpException(error, `GET ${path}`);
    }
  }

  private async request<T>(
    method: AxiosRequestConfig['method'],
    url: string,
    body?: unknown,
  ): Promise<T> {
    try {
      const response = await this.http.request<T>({ method, url, data: body });
      return response.data;
    } catch (error) {
      throw this.toHttpException(error, `${String(method)} ${url}`);
    }
  }

  private toHttpException(error: unknown, context: string): HttpException {
    if (axios.isAxiosError(error)) {
      const axErr = error as AxiosError<unknown>;
      const status = axErr.response?.status;

      if (axErr.code === 'ECONNABORTED' || axErr.code === 'ETIMEDOUT') {
        this.logger.error(`${context} timed out: ${axErr.message}`);
        return new ServiceUnavailableException({
          code: ERROR_CODES.VISION_TIMEOUT,
          message: ERROR_MESSAGES.vision.timeout,
        });
      }

      if (axErr.code === 'ECONNREFUSED' || !status) {
        this.logger.error(`${context} unreachable: ${axErr.message}`);
        return new ServiceUnavailableException({
          code: ERROR_CODES.VISION_UPSTREAM_ERROR,
          message: ERROR_MESSAGES.vision.upstreamError,
          details: axErr.message,
        });
      }

      this.logger.warn(`${context} responded ${String(status)}`);
      let upstreamData = axErr.response?.data as unknown;
      // Binary endpoints request responseType=arraybuffer; FastAPI errors are
      // still JSON, but axios delivers them as Buffer/ArrayBuffer. Decode so
      // the error envelope carries readable strings instead of byte arrays.
      if (upstreamData instanceof ArrayBuffer) {
        upstreamData = Buffer.from(upstreamData).toString('utf8');
      } else if (Buffer.isBuffer(upstreamData)) {
        upstreamData = (upstreamData as Buffer).toString('utf8');
      }
      if (typeof upstreamData === 'string') {
        try {
          upstreamData = JSON.parse(upstreamData) as unknown;
        } catch {
          // keep as plain string
        }
      }
      const upstream = (typeof upstreamData === 'object' && upstreamData !== null ? upstreamData : { detail: upstreamData }) as {
        detail?: unknown;
        message?: string;
        code?: string;
      };
      return new HttpException(
        {
          code: upstream.code ?? ERROR_CODES.VISION_UPSTREAM_ERROR,
          message:
            (typeof upstream.detail === 'string' ? upstream.detail : upstream.message) ??
            ERROR_MESSAGES.vision.upstreamError,
          details: upstream.detail ?? upstream,
        },
        status,
      );
    }

    this.logger.error(`${context} unknown error`, error instanceof Error ? error.stack : error);
    return new HttpException(
      {
        code: ERROR_CODES.VISION_UPSTREAM_ERROR,
        message: ERROR_MESSAGES.vision.upstreamError,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
