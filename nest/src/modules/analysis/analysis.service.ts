import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ERROR_CODES, ERROR_MESSAGES } from '#shared/errors/error-catalog.js';
import { VisionClient } from '#modules/vision/vision.client.js';
import { PhotoQualityService } from '#modules/photo-quality/photo-quality.service.js';
import type { PhotoQualityDecisionDto } from '#modules/photo-quality/dto/photo-quality.dto.js';
import type { FullPipelineResponseDto } from '#modules/vision/dto/vision.dto.js';
import { AnalyzePhotoDto, CompareRunsDto } from './dto/analysis.dto.js';

export interface AnalysisResultDto {
  run_id: string;
  output_dir: string;
  photo_url?: string;
  result: Record<string, unknown>;
  quality?: PhotoQualityDecisionDto;
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    private readonly vision: VisionClient,
    private readonly photoQuality: PhotoQualityService,
    private readonly events: EventEmitter2,
  ) {}

  async analyze(payload: AnalyzePhotoDto): Promise<AnalysisResultDto> {
    let qualityDecision: PhotoQualityDecisionDto | undefined;

    if (!payload.skip_quality_gate) {
      qualityDecision = await this.photoQuality.validate({
        image_base64: payload.image_base64,
        session_id: payload.session_id,
      });

      if (qualityDecision.decision === 'REJECT') {
        this.events.emit('photo.quality.rejected', {
          session_id: qualityDecision.session_id,
          grade: qualityDecision.grade,
          recommendations: qualityDecision.recommendations,
        });

        throw new BadRequestException({
          code: ERROR_CODES.PHOTO_QUALITY_REJECTED,
          message: ERROR_MESSAGES.photoQuality.rejected,
          details: 'A foto foi rejeitada pelo gatekeeper.',
          metadata: {
            grade: qualityDecision.grade,
            quality_score: qualityDecision.quality_score,
            recommendations: qualityDecision.recommendations,
          },
        });
      }

      this.events.emit('photo.quality.accepted', {
        session_id: qualityDecision.session_id,
        grade: qualityDecision.grade,
      });
    }

    const pipelineResponse: FullPipelineResponseDto = await this.vision.fullPipeline({
      image_base64: payload.image_base64,
      mode: payload.mode ?? 'premium',
      session_id: payload.session_id,
      filename: payload.filename,
    });

    this.events.emit('analysis.completed', {
      session_id: payload.session_id,
      run_id: pipelineResponse.run_id,
      mode: payload.mode ?? 'premium',
      result: pipelineResponse.result,
    });

    this.logger.log(
      `analysis run_id=${pipelineResponse.run_id} mode=${payload.mode ?? 'premium'} quality=${qualityDecision?.grade ?? 'skipped'}`,
    );

    return {
      run_id: pipelineResponse.run_id,
      output_dir: pipelineResponse.output_dir,
      photo_url: pipelineResponse.photo_url,
      result: pipelineResponse.result,
      quality: qualityDecision,
    };
  }

  async compare(payload: CompareRunsDto): Promise<Record<string, unknown>> {
    const result = await this.vision.compare({
      run_id_before: payload.run_id_before,
      run_id_after: payload.run_id_after,
    });

    this.events.emit('analysis.compared', {
      run_id_before: payload.run_id_before,
      run_id_after: payload.run_id_after,
    });

    return result;
  }
}
