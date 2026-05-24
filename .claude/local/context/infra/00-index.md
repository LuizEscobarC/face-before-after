---
tenant_id: "face-before-after"
project: "face-before-after"
module: "infra/index"
file_path: ".claude/local/context/infra/00-index.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Infraestrutura do monorepo face-before-after: docker-compose com 7 serviços
  (postgres 16, minio, minio-init, vision-service Python, orchestrator NestJS,
  frontend nginx, face-analysis legacy), Dockerfiles multi-stage, Justfile com
  `just frontend-deploy`, deploy de prod na Hostinger.
tags:
  - "infra"
  - "docker"
  - "deploy"
rag_keywords:
  - "docker-compose 7 services"
  - "multi-stage Dockerfile Node nginx"
  - "Python 3.12 dlib opencv build"
  - "just frontend-deploy recipe"
  - "Hostinger production deploy"
related_modules:
  - "backend"
  - "nest"
  - "frontend"
depends_on: []
used_by: []
---

# Infra — Índice

> **Última atualização:** 2026-05-24
> Containers, build e deploy do monorepo.

## Documentos

| Arquivo | Cobre |
|---|---|
| [01-deployment.md](01-deployment.md) | docker-compose, Dockerfiles, Justfile, deploy Hostinger |
| [99-changelog.md](99-changelog.md) | Histórico de mudanças de infra |

## Serviços (docker-compose)

`postgres` · `minio` · `minio-init` · `vision-service` (backend FastAPI) · `orchestrator` (nest) · `frontend` (nginx) · `face-analysis` (legacy)

## Comandos úteis

```bash
just frontend-deploy      # npm run build + rebuild imagem + restart
docker compose up -d      # sobe stack local
```

## Cross-refs

- Backend container: [backend/00-index.md](../backend/00-index.md)
- Nest container: [nest/00-index.md](../nest/00-index.md)
- Frontend container: [frontend/00-index.md](../frontend/00-index.md)
