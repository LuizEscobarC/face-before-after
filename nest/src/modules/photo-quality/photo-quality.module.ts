import { Module } from '@nestjs/common';
import { VisionModule } from '#modules/vision/vision.module.js';
import { PhotoQualityController } from './photo-quality.controller.js';
import { PhotoQualityService } from './photo-quality.service.js';

@Module({
  imports: [VisionModule],
  controllers: [PhotoQualityController],
  providers: [PhotoQualityService],
  exports: [PhotoQualityService],
})
export class PhotoQualityModule {}
