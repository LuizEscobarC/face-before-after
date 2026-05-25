---
tenant_id: "face-before-after"
project: "face-before-after"
module: "_meta/index"
file_path: ".claude/local/context/_meta/00-index.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-25"
version: "1.1.0"
summary_context: >
  Índice mestre de `.claude/local/context/` para o monorepo face-before-after.
  Lista os 7 subsistemas documentados (frontend, backend, nest, database, infra,
  root-pipeline, context-harvester), cada um com seu próprio tenant_id de RAG
  (ver rag-map.md).
  É a porta de entrada que Claude carrega antes de qualquer subsystem-doc.
tags:
  - "meta"
  - "index"
rag_keywords:
  - "monorepo subsystem registry"
  - "tenant_id mapping per subproject"
  - "context entry point"
related_modules: []
depends_on: []
used_by: []
---

# `.claude/local/context/` — Índice Mestre

Documentação técnica interna do monorepo **face-before-after** organizada por **subsistema**. Cada pasta cobre um componente com seu próprio `00-index.md`. Esta é a fonte de contexto que Claude carrega em sessões futuras (complementar a `CLAUDE.md` que é human-facing).

Monorepo com 4 tenants RAG distintos — ver [`../rag-map.md`](../rag-map.md) para o mapeamento `cwd → slug`.

## Subsistemas

| Subsistema | Pasta | Tenant RAG | Cobertura | Status |
|---|---|---|---|---|
| **frontend** | [frontend/00-index.md](../frontend/00-index.md) | `face-before-after-frontend` | SPA Vite + React + TS, MediaPipe FaceMesh client-side, overlays SVG, design system MVP | estável |
| **backend** | [backend/00-index.md](../backend/00-index.md) | `face-before-after-backend` | FastAPI pipeline Python — BiSeNet, MediaPipe, dlib, MinIO, run_pipeline DDD | estável |
| **nest** | [nest/00-index.md](../nest/00-index.md) | `face-before-after-nest` | Orchestrator NestJS + TS, Postgres via TypeORM, fila/coordenação | estável |
| **database** | [database/01-schema.md](../database/01-schema.md) | `face-before-after-nest` | Schema Postgres + 47 migrations TypeORM (mora em `nest/src/database`) + catálogos seed | estável |
| **infra** | [infra/01-deployment.md](../infra/01-deployment.md) | `face-before-after` | Docker, nginx, multi-stage builds, `just frontend-deploy` | estável |
| **root-pipeline** | [root-pipeline/01-legacy-scripts.md](../root-pipeline/01-legacy-scripts.md) | `face-before-after` | Scripts Python na raiz (legacy pré-FastAPI), comparação before/after, processamento batch | em evolução |
| **context-harvester** | [context-harvester/00-index.md](../context-harvester/00-index.md) | `face-before-after` | Tooling TS read-only (`scripts/context/`) + skill local; regenera artefatos RAG (DDL, catalog map, business logic, golden queries, migrations index) via Postgres SELECT-only + ts-morph/Python AST | estável |

## Regra de evolução

Pastas são criadas **on-demand** pela skill `domain-context-updater` ao tocar o subsistema pela primeira vez. Não criar pastas vazias.

Quando criar/renomear/remover subsistema: atualizar esta tabela + bump `version`.

## Não confundir

- `.claude/local/context/` — contexto interno para Claude em sessões futuras.
- `docs/` (raiz do repo, quando existe) — documentação human-facing.
- `CLAUDE.md` — entrada principal (paleta MVP, regras de stack, política de context-loading do domínio face-analysis).
- `.claude/local/face-analysis/` — domínio especializado de análise facial (índice próprio em `00-index.md` lá).
