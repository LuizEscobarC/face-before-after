---
tenant_id: "face-before-after"
project: "face-before-after"
module: "infra/deployment"
file_path: ".claude/local/context/infra/01-deployment.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Infraestrutura local e de deploy: docker-compose com 7 serviços (postgres 16, minio,
  minio-init, vision-service Python, orchestrator NestJS, frontend nginx, face-analysis legacy).
  Build via Dockerfile.api (Python 3.12-slim + libgl/opencv deps + dlib build) e
  Dockerfile.frontend (multi-stage Node 20 + nginx). Justfile expõe atalhos
  (`just frontend-deploy`). Deploy de prod: Hostinger.
tags:
  - "infra"
  - "docker"
  - "deployment"
  - "compose"
rag_keywords:
  - "Docker Compose multi-service"
  - "Python 3.12 slim image"
  - "Node 20 alpine multi-stage"
  - "MinIO object storage"
  - "PostgreSQL 16"
  - "nginx reverse proxy"
  - "Hostinger VPS deploy"
  - "justfile recipes"
related_modules:
  - "backend"
  - "nest"
depends_on: []
used_by: []
---

# Infra — Deployment

## Topologia (docker-compose)

| Service | Image / Build | Função |
|---|---|---|
| `postgres` | `postgres:16-alpine` | DB do Nest (TypeORM) |
| `minio` | `minio/minio:latest` | Object storage (fotos antes/depois) |
| `minio-init` | `minio/mc:latest` | Bootstrap de buckets |
| `vision-service` | `Dockerfile.api` (Python 3.12) | Backend Python (face-analysis-api) |
| `orchestrator` | `nest/Dockerfile.dev` | NestJS gateway |
| `frontend` | `Dockerfile.frontend` (Node 20 + nginx) | Static SPA |
| `face-analysis` | build legacy | Worker / pipeline legacy (root scripts) |

Volumes: `api-data`, `minio-data`, `postgres-data`.

Arquivo: [docker-compose.yml](../../../../docker-compose.yml).

## Build images

### Dockerfile.api (Python backend)

[Dockerfile.api](../../../../Dockerfile.api) — base `python:3.12-slim`. Instala:
- `libgl1`, `libgles2`, `libegl1`, `libglib2.0-0`, `libsm6`, `libxext6`, `libxrender1` — OpenCV runtime
- `libgomp1` — OpenMP para numpy/scipy/mediapipe
- `cmake`, `g++`, `build-essential`, `libopenblas-dev` — build de dlib
- `curl` — healthcheck

Copia `backend/pyproject.toml` primeiro para cache de layer; depois `pip install`. Entrypoint:
`entrypoint.sh` (wrapper de uvicorn).

### Dockerfile.frontend

[Dockerfile.frontend](../../../../Dockerfile.frontend) — multi-stage:

1. **builder**: `node:20-alpine` — `npm ci` + `npm run build` (Vite).
2. **runtime**: nginx servindo `dist/` estático com [nginx.conf](../../../../nginx.conf).

## Nginx

| Arquivo | Uso |
|---|---|
| [nginx.conf](../../../../nginx.conf) | Produção (Hostinger) |
| [nginx.local.conf](../../../../nginx.local.conf) | Dev local (compose) |

## Justfile

[justfile](../../../../justfile) expõe receitas:

- `just frontend-deploy` — `npm run build` + rebuild imagem + restart (atalho documentado em CLAUDE.md).
- Demais receitas: ver `just --list`.

## Deploy de produção

Hostinger VPS — ver [DEPLOY_HOSTINGER.md](../../../../DEPLOY_HOSTINGER.md) e
[DEPLOYMENT_OPTIMIZATION.md](../../../../DEPLOYMENT_OPTIMIZATION.md).

## Variáveis de ambiente

`.env` na raiz; `.env.example` para template. Cada serviço lê o que precisa via compose
`env_file` ou `environment`. Nest lê via `@nestjs/config`; Python lê via `pydantic-settings`.

## Operação local

```bash
docker compose up -d                  # sobe todo o stack
docker compose logs -f vision-service # logs do backend Python
just frontend-deploy                  # rebuild + restart frontend
```

## Não-objetivos

- Não há CI/CD configurado neste repo (a documentar quando montar).
- Não há orquestrador (k8s/swarm) — compose puro.
