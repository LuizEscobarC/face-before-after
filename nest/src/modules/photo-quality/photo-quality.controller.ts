import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PhotoQualityService } from './photo-quality.service.js';
import {
  PhotoQualityDecisionDto,
  ValidatePhotoDto,
} from './dto/photo-quality.dto.js';

@ApiTags('PhotoQuality')
@Controller('v1/photo-quality')
export class PhotoQualityController {
  constructor(private readonly service: PhotoQualityService) {}

  @Post('validate')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Module 0 — valida qualidade da foto e devolve decisão (ACCEPT/WARN/REJECT)',
  })
  @ApiResponse({ status: 200, type: PhotoQualityDecisionDto })
  validate(@Body() body: ValidatePhotoDto): Promise<PhotoQualityDecisionDto> {
    return this.service.validate(body);
  }
}
