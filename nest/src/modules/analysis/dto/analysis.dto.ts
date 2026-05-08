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

export class CompareWithConsistencyDto {
  @ApiProperty() score_before!: number;
  @ApiProperty() score_after!: number;
  @ApiProperty() score_delta!: number;
  @ApiProperty() tier_before!: string;
  @ApiProperty() tier_after!: string;
  @ApiProperty() metrics!: unknown[];
  @ApiProperty() improved_count!: number;
  @ApiProperty() worsened_count!: number;
  @ApiProperty() top_improvements!: unknown[];
  @ApiProperty() top_regressions!: unknown[];
  @ApiProperty() consistency_score!: number;
  @ApiProperty({ type: [String] }) consistency_issues!: string[];
  @ApiProperty() is_comparable!: boolean;
  @ApiPropertyOptional() baseline_group_id_before?: string;
  @ApiPropertyOptional() baseline_group_id_after?: string;
}
