import { Module } from '@nestjs/common';
import { pinoLogger } from './pino-logger.config.js';

export const PINO_LOGGER = Symbol('PINO_LOGGER');

@Module({
  providers: [
    {
      provide: PINO_LOGGER,
      useValue: pinoLogger,
    },
  ],
  exports: [PINO_LOGGER],
})
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export class LoggerModule {}
