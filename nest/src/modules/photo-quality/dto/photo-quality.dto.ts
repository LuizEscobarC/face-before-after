import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ValidatePhotoDto {
  @ApiProperty({ description: 'Imagem em base64 (com ou sem data URL prefix)' })
  @IsString()
  image_base64!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  session_id?: string;

  @ApiPropertyOptional({ description: 'Indica se o usuário consentiu com armazenamento da foto bruta' })
  @IsOptional()
  @IsBoolean()
  user_consented?: boolean;
}

export class PhotoQualityDecisionDto {
  @ApiProperty({ enum: ['ACCEPT', 'WARN', 'REJECT'] })
  decision!: 'ACCEPT' | 'WARN' | 'REJECT';

  @ApiProperty({ enum: ['ALTA', 'MEDIA', 'BAIXA', 'REJEITADA'] })
  grade!: 'ALTA' | 'MEDIA' | 'BAIXA' | 'REJEITADA';

  @ApiProperty()
  quality_score!: number;

  @ApiProperty({ type: [String] })
  recommendations!: string[];

  @ApiProperty()
  fingerprint!: string;

  @ApiProperty({ type: [String] })
  fingerprint_parts!: string[];

  @ApiProperty()
  subscore_breakdown!: Record<string, number>;

  @ApiProperty()
  flags!: Record<string, boolean>;

  @ApiProperty()
  pose!: { yaw: number; pitch: number; roll: number };

  @ApiProperty()
  sharpness_score!: number;

  @ApiProperty()
  lighting_asymmetry!: number;

  @ApiProperty()
  session_id!: string;

  @ApiProperty()
  processing_mode!: string;

  @ApiPropertyOptional()
  face_bbox?: { x: number; y: number; w: number; h: number };
}
