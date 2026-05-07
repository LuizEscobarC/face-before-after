import { ApiProperty } from '@nestjs/swagger';

export class ConcernDto {
  @ApiProperty() metric_id!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ type: Number }) severity!: number;
  @ApiProperty() message!: string;
}

export class DiagnosisReportDto {
  @ApiProperty() run_id!: string;
  @ApiProperty({ type: [ConcernDto] }) top_concerns!: ConcernDto[];
  @ApiProperty() summary!: string;
  @ApiProperty() timestamp!: string;
}
