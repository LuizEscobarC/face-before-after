import { Injectable, Logger } from '@nestjs/common';
import { VisionClient } from '#modules/vision/vision.client.js';
import type { LandmarkResponseDto } from '#modules/vision/dto/vision.dto.js';
import {
  PhotoQualityDecisionDto,
  ValidatePhotoDto,
} from './dto/photo-quality.dto.js';

@Injectable()
export class PhotoQualityService {
  private readonly logger = new Logger(PhotoQualityService.name);

  constructor(private readonly vision: VisionClient) {}

  async validate(payload: ValidatePhotoDto): Promise<PhotoQualityDecisionDto> {
    const result: LandmarkResponseDto = await this.vision.landmarks(payload);

    const decision = this.gradeToDecision(result.quality_grade);

    this.logger.log(
      `photo-quality session=${result.session_id} grade=${result.quality_grade} score=${result.quality_score.toFixed(2)} decision=${decision}`,
    );

    return {
      decision,
      grade: result.quality_grade,
      quality_score: result.quality_score,
      recommendations: result.recommendations,
      fingerprint: result.fingerprint,
      subscore_breakdown: result.subscore_breakdown,
      flags: result.flags,
      pose: result.pose,
      sharpness_score: result.sharpness_score,
      lighting_asymmetry: result.lighting_asymmetry,
      session_id: result.session_id,
      processing_mode: result.processing_mode,
    };
  }

  private gradeToDecision(grade: LandmarkResponseDto['quality_grade']): 'ACCEPT' | 'WARN' | 'REJECT' {
    switch (grade) {
      case 'ALTA':
        return 'ACCEPT';
      case 'MEDIA':
        return 'WARN';
      case 'BAIXA':
      case 'REJEITADA':
      default:
        return 'REJECT';
    }
  }
}
