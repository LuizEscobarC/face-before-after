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
    const landmarkResponse: LandmarkResponseDto = await this.vision.landmarks(payload);

    const decision = this.gradeToDecision(landmarkResponse.quality_grade);

    this.logger.log(
      `photo-quality session=${landmarkResponse.session_id} grade=${landmarkResponse.quality_grade} score=${landmarkResponse.quality_score.toFixed(2)} decision=${decision}`,
    );

    return {
      decision,
      grade: landmarkResponse.quality_grade,
      quality_score: landmarkResponse.quality_score,
      recommendations: landmarkResponse.recommendations,
      fingerprint: landmarkResponse.fingerprint,
      subscore_breakdown: landmarkResponse.subscore_breakdown,
      flags: landmarkResponse.flags,
      pose: landmarkResponse.pose,
      sharpness_score: landmarkResponse.sharpness_score,
      lighting_asymmetry: landmarkResponse.lighting_asymmetry,
      session_id: landmarkResponse.session_id,
      processing_mode: landmarkResponse.processing_mode,
      face_bbox: landmarkResponse.face_bbox,
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
