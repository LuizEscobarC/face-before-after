import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBase64, IsBoolean, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class LandmarkRequestDto {
  @ApiProperty({ description: 'Base64 da imagem (com ou sem data URL prefix)' })
  @IsString()
  image_base64!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  session_id?: string;
}

export class PoseAnglesDto {
  @ApiProperty() @IsNumber() yaw!: number;
  @ApiProperty() @IsNumber() pitch!: number;
  @ApiProperty() @IsNumber() roll!: number;
}

export class LandmarkResponseDto {
  @ApiProperty() session_id!: string;
  @ApiProperty({ type: 'array', items: { type: 'array', items: { type: 'number' } } })
  landmarks!: number[][];
  @ApiProperty({ type: PoseAnglesDto }) pose!: PoseAnglesDto;
  @ApiProperty() quality_score!: number;
  @ApiProperty({ enum: ['ALTA', 'MEDIA', 'BAIXA', 'REJEITADA'] })
  quality_grade!: 'ALTA' | 'MEDIA' | 'BAIXA' | 'REJEITADA';
  @ApiProperty() flags!: Record<string, boolean>;
  @ApiProperty() regional_penalties!: Record<string, number>;
  @ApiProperty({ type: [String] }) recommendations!: string[];
  @ApiProperty() fingerprint!: string;
  @ApiProperty({ type: [String] }) fingerprint_parts!: string[];
  @ApiProperty() processing_mode!: string;
  @ApiProperty() sharpness_score!: number;
  @ApiProperty() lighting_asymmetry!: number;
  @ApiProperty() subscore_breakdown!: Record<string, number>;
  @ApiPropertyOptional()
  face_bbox?: { x: number; y: number; w: number; h: number };
}

export class QualityContextDto {
  @ApiProperty() @IsNumber() quality_score!: number;
  @ApiProperty() @IsObject() regional_penalties!: Record<string, number>;
}

export class MetricsRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsString() session_id?: string;
  @ApiProperty({ type: 'array', items: { type: 'array', items: { type: 'number' } } })
  @IsArray()
  landmarks!: number[][];
  @ApiPropertyOptional() @IsOptional() @IsString() image_base64?: string;
  @ApiProperty({ type: QualityContextDto })
  quality_context!: QualityContextDto;
}

export class MetricsResponseDto {
  @ApiProperty({ type: 'array' }) metrics!: unknown[];
  @ApiProperty() raw!: Record<string, unknown>;
}

/**
 * PR-42 (M3.4) — one ideal-landmark offset for the before/ideal composer.
 * landmark_index ∈ [0, 477] (MediaPipe Mesh-478).
 * dx_icu / dy_icu in intercanthal units; Python caps them at ±0.3 ICU (DEC-15).
 */
export class OffsetDto {
  @ApiProperty({ description: 'MediaPipe Mesh-478 landmark index (0–477)' })
  @IsInt()
  @Min(0)
  @Max(477)
  landmark_index!: number;

  @ApiProperty({ description: 'Horizontal displacement in ICU (capped ±0.3 by Python)' })
  @IsNumber()
  dx_icu!: number;

  @ApiProperty({ description: 'Vertical displacement in ICU (capped ±0.3 by Python)' })
  @IsNumber()
  dy_icu!: number;

  @ApiPropertyOptional({ description: 'Metric id for traceability (passed through to Python, not rendered)' })
  @IsOptional()
  @IsString()
  metric_id?: string;
}

/**
 * PR-42 (M3.4) — request DTO for POST /v1/vision/compose-before-ideal.
 *
 * The caller supplies the run_id from the vision pipeline result (used to
 * download the annotated base photo from the Python service), the raw
 * MediaPipe landmark array, and optional ideal offsets derived from
 * MetricEvaluationResult.improvement_vector_x/y.
 *
 * References:
 *  - backend/app/vision/services/before_ideal_composer.py (PR-41)
 *  - PLAN_M3_OVERLAYS §2 PR-42, DEC-15, DEC-26
 */
export class ComposeBeforeIdealRequestDto {
  @ApiProperty({ description: 'run_id of the vision pipeline result (used to fetch the annotated base photo)' })
  @IsString()
  runId!: string;

  @ApiProperty({
    description: 'MediaPipe Mesh-478 raw pixel coordinates [[x, y], …] (478 entries)',
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  @IsArray()
  landmarks!: number[][];

  @ApiPropertyOptional({ description: 'Ideal landmark offsets in ICU; empty = ideal wireframe matches actual', type: [OffsetDto] })
  @IsOptional()
  @IsArray()
  offsets?: OffsetDto[];

  @ApiPropertyOptional({ description: 'Draw guide lines (vertical midline + horizontal intercanthal) on right pane', default: true })
  @IsOptional()
  @IsBoolean()
  showGuideLines?: boolean;

  @ApiPropertyOptional({ description: 'Draw actual (gray) wireframe on right pane', default: true })
  @IsOptional()
  @IsBoolean()
  showActualWireframe?: boolean;
}

export class FullPipelineRequestDto {
  @ApiProperty() @IsString() image_base64!: string;
  @ApiPropertyOptional({ enum: ['premium', 'teaser'], default: 'premium' })
  @IsOptional()
  @IsIn(['premium', 'teaser'])
  mode?: 'premium' | 'teaser' = 'premium';
  @ApiPropertyOptional() @IsOptional() @IsString() session_id?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() filename?: string;
}

export class FullPipelineResponseDto {
  @ApiProperty() run_id!: string;
  @ApiProperty() output_dir!: string;
  @ApiPropertyOptional() photo_url?: string;
  @ApiProperty() result!: Record<string, unknown>;
}

export class CompareRequestDto {
  @ApiProperty() @IsString() run_id_before!: string;
  @ApiProperty() @IsString() run_id_after!: string;
}

export class CaptureGuidelinesDto {
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: Number }) distance_meters!: number;
  @ApiProperty({ type: String }) zoom!: string;
  @ApiProperty({ type: [String] }) tips!: string[];
}

export class CompareResponseDto {
  @ApiProperty({ type: Number }) consistency_score!: number;
  @ApiProperty({ type: [String] }) consistency_issues!: string[];
  @ApiProperty({ type: Boolean }) is_comparable!: boolean;
}

// Suppress unused import warning when validators unused on a class
void IsBase64;
