import { Module } from '@nestjs/common';
import { VisionClient } from './vision.client.js';
import { VisionController } from './vision.controller.js';
import { loadVisionClientConfig, VISION_CLIENT_CONFIG } from './vision.config.js';

@Module({
  controllers: [VisionController],
  providers: [
    {
      provide: VISION_CLIENT_CONFIG,
      useFactory: loadVisionClientConfig,
    },
    VisionClient,
  ],
  exports: [VisionClient],
})
export class VisionModule {}
