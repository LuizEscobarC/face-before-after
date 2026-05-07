import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBase64, IsOptional, IsString, IsIn, IsNumber, IsArray, IsObject } from 'class-validator';

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
  @ApiProperty() processing_mode!: string;
  @ApiProperty() sharpness_score!: number;
  @ApiProperty() lighting_asymmetry!: number;
  @ApiProperty() subscore_breakdown!: Record<string, number>;
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

// Suppress unused import warning when validators unused on a class
void IsBase64;
