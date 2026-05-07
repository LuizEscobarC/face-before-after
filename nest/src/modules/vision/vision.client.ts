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
import { VISION_CLIENT_CONFIG, VisionClientConfig } from './vision.config.js';

@Injectable()
export class VisionClient {
  private readonly logger = new Logger(VisionClient.name);
  private readonly http: AxiosInstance;

  constructor(@Inject(VISION_CLIENT_CONFIG) config: VisionClientConfig) {
    this.http = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      maxBodyLength: 60 * 1024 * 1024,
      maxContentLength: 60 * 1024 * 1024,
      headers: { 'Content-Type': 'application/json' },
    });
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

  fullPipeline(payload: FullPipelineRequestDto): Promise<FullPipelineResponseDto> {
    return this.request<FullPipelineResponseDto>('POST', '/vision/full-pipeline', payload);
  }

  compare(payload: CompareRequestDto): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('POST', '/vision/compare', payload);
  }

  async fetchAnnotated(runId: string): Promise<{
    data: Buffer;
    contentType: string;
  }> {
    return this.fetchBinary(`/vision/results/${runId}/annotated`);
  }

  async fetchSimulation(
    runId: string,
    simType: 'symmetrized' | 'ideal_proportions' | 'comparison_grid',
  ): Promise<{ data: Buffer; contentType: string }> {
    return this.fetchBinary(`/vision/results/${runId}/simulation/${simType}`);
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
      let raw = axErr.response?.data as unknown;
      // Binary endpoints request responseType=arraybuffer; FastAPI errors are
      // still JSON, but axios delivers them as Buffer/ArrayBuffer. Decode so
      // the error envelope carries readable strings instead of byte arrays.
      if (raw instanceof ArrayBuffer) {
        raw = Buffer.from(raw).toString('utf8');
      } else if (Buffer.isBuffer(raw)) {
        raw = raw.toString('utf8');
      }
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw) as unknown;
        } catch {
          // keep as plain string
        }
      }
      const upstream = (typeof raw === 'object' && raw !== null ? raw : { detail: raw }) as {
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
