/**
 * DTOs for POST /v1/analysis/evaluate (PR-10 M1 endpoint).
 *
 * This endpoint accepts pre-computed landmarks from the client (MediaPipe WASM)
 * and returns a persisted AnalysisReport with all 21 atomic metric evaluations.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Request
// ---------------------------------------------------------------------------

export class QualityContextEvaluateDto {
  @ApiProperty({ description: 'Global quality score [0, 1]', default: 1.0 })
  @IsNumber()
  @Min(0)
  @Max(1)
  quality_score: number = 1.0;

  @ApiPropertyOptional({ description: 'Region → penalty fraction map' })
  @IsOptional()
  @IsObject()
  regional_penalties?: Record<string, number> = {};

  @ApiPropertyOptional({ description: 'Pose angles: {yaw, pitch, roll} in degrees' })
  @IsOptional()
  @IsObject()
  pose?: Record<string, number> = {};
}

export class EvaluateRequestDto {
  @ApiProperty({
    description: 'Raw MediaPipe Face Mesh landmarks (N×3 pixel coordinates)',
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  @IsArray()
  landmarks!: number[][];

  @ApiProperty({ type: QualityContextEvaluateDto })
  @ValidateNested()
  @Type(() => QualityContextEvaluateDto)
  quality_context!: QualityContextEvaluateDto;

  @ApiPropertyOptional({ description: 'Client session ID' })
  @IsOptional()
  @IsString()
  session_id?: string;

  @ApiPropertyOptional({ description: 'Yaw correction angle (degrees)', default: 0 })
  @IsOptional()
  @IsNumber()
  yaw_deg?: number = 0.0;

  @ApiPropertyOptional({ description: 'Pitch correction angle (degrees)', default: 0 })
  @IsOptional()
  @IsNumber()
  pitch_deg?: number = 0.0;

  @ApiPropertyOptional({ description: 'Original image size [width, height]' })
  @IsOptional()
  @IsArray()
  image_size?: number[];

  @ApiPropertyOptional({ description: 'i18n locale for direction labels', default: 'pt-BR' })
  @IsOptional()
  @IsString()
  locale?: string = 'pt-BR';
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface MetricEvaluationResultDto {
  metric_id: string;
  region: string;
  family: string;
  unit: string;
  value: number | null;
  confidence_raw: number | null;
  confidence_final: number | null;
  is_low_confidence: boolean;
  direction: string | null;
  deviation_raw: number | null;
  deviation_normalized: number | null;
  severity_5: string | null;
  severity_3: string | null;
  direction_label: Record<string, string>;
  /** Improvement vector X in normalised intercanthal units (ICU). Null when N/A. */
  improvement_vector_x: number | null;
  /** Improvement vector Y in normalised intercanthal units (ICU). Positive = downward. Null when N/A. */
  improvement_vector_y: number | null;
}

export interface EvaluateVersionsDto {
  metric_registry_version: string | null;
  ideals_version: string | null;
  threshold_config_version: string | null;
  severity_collapse_version: string | null;
  region_metric_weights_version: string | null;
  global_weights_version: string | null;
}

export interface RegionalScoreResultDto {
  region: string;
  score_0_100: number | null;
  confidence_aggregate: number | null;
  contributing_metric_ids: string[];
}

export interface RegionalBreakdownDto {
  region: string;
  score_0_100: number | null;
  weight: number;
  confidence_aggregate: number | null;
  contributed: boolean;
}

export interface GlobalScoreResultDto {
  score_0_100: number | null;
  is_displayable: boolean;
  band: 'no_number' | 'refine' | 'good' | 'high' | null;
  regional_breakdown: RegionalBreakdownDto[];
}

export interface EvaluateResponseDto {
  analysis_report_id: string;
  session_id: string | null;
  generated_at: string;
  status: string;
  quality_score: number | null;
  metric_count: number;
  metrics: MetricEvaluationResultDto[];
  regional_scores: RegionalScoreResultDto[];
  global_score: GlobalScoreResultDto;
  versions: EvaluateVersionsDto;
}

// ---------------------------------------------------------------------------
// Raw metric shape from Python /vision/metrics-v2
// ---------------------------------------------------------------------------

export interface RawMetricV2 {
  metric_id: string;
  region: string;
  family: string;
  unit: string;
  value: number | null;
  error: number;
  confidence_raw: number;
  confidence_final: number;
  is_low_confidence: boolean;
  direction: string;
  dependency_landmarks: number[];
  presentation_only: boolean;
  /** Improvement vector [dx, dy] in normalised ICU, or null when N/A. Emitted by Python calculators (PR-34). */
  improvement_vector?: [number, number] | null;
}

export interface MetricsV2ResponseDto {
  session_id: string | null;
  metrics: RawMetricV2[];
  metric_count: number;
}
