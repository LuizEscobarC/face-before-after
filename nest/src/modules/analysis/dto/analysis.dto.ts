import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class AnalyzePhotoDto {
  @ApiProperty()
  @IsString()
  image_base64!: string;

  @ApiPropertyOptional({ enum: ['premium', 'teaser'], default: 'premium' })
  @IsOptional()
  @IsIn(['premium', 'teaser'])
  mode?: 'premium' | 'teaser' = 'premium';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  session_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Pula o gatekeeper Module 0 (NÃO recomendado em produção)',
  })
  @IsOptional()
  @IsBoolean()
  skip_quality_gate?: boolean = false;
}

export class CompareRunsDto {
  @ApiProperty() @IsString() run_id_before!: string;
  @ApiProperty() @IsString() run_id_after!: string;
}
