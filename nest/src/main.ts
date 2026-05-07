import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe, Logger } from '@nestjs/common';
import { writeFileSync, mkdirSync } from 'node:fs';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module.js';
import { pinoHttpLogger } from './shared/config/pino-logger.config.js';
import { ApiExceptionFilter } from './shared/errors/api-exception.filter.js';

const logger = new Logger('Bootstrap');

async function bootstrap(): Promise<void> {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local') {
      process.exit(1);
    }
  });

  process.on('uncaughtException', error => {
    logger.error('Uncaught Exception:', error);
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local') {
      process.exit(1);
    }
  });

  try {
    logger.log('🚀 Starting Face Analysis Orchestrator...');
    logger.log(`NODE_ENV: ${process.env.NODE_ENV ?? 'development'}`);
    logger.log(`PORT: ${String(process.env.PORT ?? 3000)}`);
    logger.log(`VISION_SERVICE_URL: ${process.env.VISION_SERVICE_URL ?? '(unset)'}`);

    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: pinoHttpLogger,
      }),
    );

    await app.register(multipart, {
      limits: {
        fileSize: 52428800,
      },
    });

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidUnknownValues: true,
        transform: true,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    );

    app.useGlobalFilters(new ApiExceptionFilter());

    const config = new DocumentBuilder()
      .setTitle('Face Analysis Orchestrator API')
      .setDescription(
        `
# Face Before/After — Orchestrator

API NestJS que orquestra o pipeline de análise facial sobre o vision-service (FastAPI/Python).

## Módulos
| Módulo | Descrição |
|--------|-----------|
| **Health** | Verificação de saúde |
| **Vision** | Proxy para o vision-service (landmarks, métricas, full-pipeline, compare) |
| **Photo Quality** | Gatekeeper Module 0 — valida qualidade da foto antes de avançar |
| **Analysis** | Orquestra full-pipeline + comparação |
        `,
      )
      .setVersion('0.1.0')
      .addTag('Health')
      .addTag('Vision')
      .addTag('PhotoQuality')
      .addTag('Analysis')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        filter: true,
        showRequestDuration: true,
      },
      customSiteTitle: 'Face Orchestrator - Docs',
    });

    const env = process.env.NODE_ENV;
    if (env !== 'production' && env !== 'prd-local') {
      mkdirSync('./swagger', { recursive: true });
      writeFileSync('./swagger/openapi.json', JSON.stringify(document, null, 2));
    }

    app.enableCors();

    const port = parseInt(process.env.PORT ?? '3000', 10);
    await app.listen(port, '0.0.0.0');

    logger.log(`🚀 Orchestrator running on: http://localhost:${port.toString()}`);
    logger.log(`📚 Swagger docs at: http://localhost:${port.toString()}/api/docs`);
  } catch (error) {
    logger.error('❌ Failed to start application', error instanceof Error ? error.stack : error);
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'local') {
      process.exit(1);
    }
  }
}

void bootstrap();
