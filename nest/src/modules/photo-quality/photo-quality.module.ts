import { Module } from '@nestjs/common';
import { VisionModule } from '#modules/vision/vision.module.js';
import { PhotoQualityController } from './photo-quality.controller.js';
import { PhotoQualityService } from './photo-quality.service.js';
import { PhotoStoragePolicy } from './photo-storage-policy.js';

@Module({
  imports: [VisionModule],
  controllers: [PhotoQualityController],
  providers: [PhotoQualityService, PhotoStoragePolicy],
  exports: [PhotoQualityService],
})
export class PhotoQualityModule {}
