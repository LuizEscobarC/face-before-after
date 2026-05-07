# Face Orchestrator (NestJS)

NestJS + Fastify orchestrator que faz ponte entre o frontend React e o `vision-service` (FastAPI/Python).

## Arquitetura

```
Browser  →  Orchestrator (NestJS, :3000)  →  vision-service (FastAPI, :8000)  →  MinIO
```

## Comandos locais

```bash
cp .env.example .env
npm install
npm run start:dev       # tsx watch
```

- Swagger: http://localhost:3000/api/docs
- Health:  http://localhost:3000/health

## Variáveis de ambiente

| Variável | Default | Descrição |
|----------|---------|-----------|
| `NODE_ENV` | `development` | dev/local/production |
| `PORT` | `3000` | Porta interna |
| `LOG_LEVEL` | `debug` (dev) / `info` | Nível pino |
| `VISION_SERVICE_URL` | `http://vision-service:8000` | Base URL FastAPI |
| `VISION_SERVICE_TIMEOUT_MS` | `30000` | Timeout axios |

## Estrutura

- `src/shared/` — config (pino), errors (filter, catalog)
- `src/modules/health/` — liveness probe
- `src/modules/vision/` — proxy para vision-service (B2)
- `src/modules/photo-quality/` — gatekeeper Module 0 (B3)
- `src/modules/analysis/` — orquestração full-pipeline (B4)

Baseado em `~/cursobeta/general-reporting-api/` (template oficial).
