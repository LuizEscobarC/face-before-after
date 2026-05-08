/**
 * DTOs for GET /v1/analysis/reports/:id and GET /v1/analysis/reports?session_id=X
 * (PR-24).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetReportByIdParams {
  @ApiProperty({ description: 'UUID of the AnalysisReport to retrieve' })
  @IsUUID()
  id!: string;
}

export class ListReportsBySessionQuery {
  @ApiProperty({ description: 'Client session ID to look up' })
  @IsString()
  session_id!: string;

  @ApiPropertyOptional({
    description: 'Maximum number of reports to return (default: 10, max: 50)',
    default: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 10;
}
