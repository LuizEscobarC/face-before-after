# Task B1 — NestJS 11 Scaffold: Fastify + ESM + Swagger + Shared Infra
**Created**: 2026-05-07
**Status**: ✅ CONCLUÍDO
**Stack**: NestJS 11, TypeScript ESM, Fastify, pino, Swagger

---

## 0. O que foi feito

Bootstrap do orquestrador NestJS a partir do template `~/cursobeta/general-reporting-api`. Configurado com Fastify, módulo ESM (`"type":"module"`), path aliases, Swagger em `/api/docs`, ValidationPipe, filtro de exceções global e pino logger.

---

## 1. Arquivos criados

```
nest/
  package.json             ← name=face-orchestrator, "type":"module", NestJS 11
  tsconfig.json            ← paths: #src/*, #modules/*, #shared/*
  tsconfig.build.json      ← exclui tests
  Dockerfile.dev           ← node:24-alpine, tsc build-time, node dist/src/main.js
  src/
    main.ts                ← Bootstrap: Fastify + multipart + ValidationPipe + Swagger + CORS
    app.module.ts          ← Root module com EventEmitterModule(wildcard) + todos os módulos
    shared/
      config/
        logger.module.ts
        pino-logger.config.ts
      errors/
        api-exception.filter.ts   ← @Catch() global — envelope {success, message, error, timestamp, path}
        error-catalog.ts          ← ERROR_CODES + ERROR_MESSAGES + ApiErrorPayload interface
```

---

## 2. Dependências principais

| Pacote | Versão | Função |
|--------|--------|--------|
| `@nestjs/platform-fastify` | ^11 | Adapter HTTP |
| `@fastify/multipart` | ^9 | Upload de arquivos (50MB) |
| `@nestjs/swagger` | ^11 | Swagger em `/api/docs` |
| `@nestjs/event-emitter` | ^3 | EventBus wildcard |
| `axios` | ^1.7 | HTTP client para vision-service |
| `class-validator` + `class-transformer` | latest | ValidationPipe |
| `pino` + `pino-http` + `pino-pretty` | latest | Structured logging |

---

## 3. Dockerfile.dev — decisão crítica

**Problema resolvido**: `tsx watch` não emite `emitDecoratorMetadata`, quebrando `@nestjs/swagger` com erro de reflect-metadata em runtime.

**Solução**: compilar com `tsc` no build-time e executar `node dist/src/main.js`:

```dockerfile
FROM node:24-alpine
RUN apk add --no-cache dumb-init
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001 -G nodejs && chown -R nestjs:nodejs /app
USER nestjs
COPY --chown=nestjs:nodejs package*.json ./
RUN npm install && npm cache clean --force
COPY --chown=nestjs:nodejs . .
RUN rm -rf dist && npm run build
EXPOSE 3000 9229
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main.js"]
```

Nota: `chown /app` ANTES de `USER nestjs` evita `EACCES: permission denied on /app/dist`.

---

## 4. Error Catalog

```typescript
export const ERROR_CODES = {
  COMMON_INVALID_REQUEST, COMMON_VALIDATION_FAILED, COMMON_INTERNAL_SERVER_ERROR,
  COMMON_NOT_FOUND, AUTH_UNAUTHORIZED, AUTH_FORBIDDEN,
  VISION_UPSTREAM_ERROR, VISION_TIMEOUT, PHOTO_QUALITY_REJECTED,
}
```

Envelope de resposta de erro:
```json
{
  "success": false,
  "message": "string",
  "error": { "statusCode": 400, "code": "...", "message": "...", "details": "..." },
  "timestamp": "2026-05-07T...",
  "path": "/v1/..."
}
```

---

## 5. `main.ts` — configurações

- `ValidationPipe`: `whitelist: true`, `forbidUnknownValues: true`, `transform: true`
- `ApiExceptionFilter` global
- Swagger: título "Face Analysis Orchestrator API", persiste auth, filter, showRequestDuration
- `@fastify/multipart` limite `52428800` (50MB)
- Porta de `process.env.PORT ?? 3000`
- Swagger OpenAPI JSON exportado para `./swagger/openapi.json` (non-production)

---

## 6. Verificação

```bash
# Rebuild e subir
just nest-docker-build && docker compose up -d orchestrator

# Health
curl http://localhost:9020/health | jq .
# {"status":"ok","service":"face-orchestrator",...}

# Swagger docs
curl -s http://localhost:9020/api/docs | grep -o "<title>.*</title>"

# TypeScript compile limpo
cd nest && npm run build
```
