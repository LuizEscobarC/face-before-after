import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class ClientLandmarkPayloadDto {
  @ApiProperty({
    description: 'Landmark points from client-side MediaPipe (478 × 2, pixel coords)',
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  @IsArray()
  landmarks!: number[][];

  @ApiProperty({ description: 'Pose angles estimated client-side' })
  @IsObject()
  pose!: { yaw: number; pitch: number; roll: number };

  @ApiProperty({ enum: ['CLIENT_SIDE'] })
  @IsString()
  @IsIn(['CLIENT_SIDE'])
  processing_mode!: 'CLIENT_SIDE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  session_id?: string;
}
