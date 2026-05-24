---
tenant_id: "face-before-after-nest"
project: "face-before-after-nest"
module: "nest/index"
file_path: ".claude/local/context/nest/00-index.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  NestJS orchestrator (face-orchestrator) é o gateway que proxia o backend Python (vision-service)
  e gateia o pipeline por photo quality (Module 0). Node 24, TypeScript, ESM puro com path imports
  #src/* #modules/* #shared/*. 12 módulos em nest/src/modules — health, identity, vision, analysis,
  diagnosis, overlays, photo-quality, decision, execution, admin, catalog, tracking. Padrão DDD
  por módulo: controller + service + domain + infrastructure + dto.
tags:
  - "nest"
  - "nestjs"
  - "typescript"
  - "orchestrator"
  - "ddd"
rag_keywords:
  - "NestJS 10 modular architecture"
  - "DDD bounded context"
  - "ESM Node 24"
  - "tsx watch dev mode"
  - "subpath imports node"
  - "TypeORM migrations"
  - "vision-service gateway"
  - "photo quality gating"
related_modules: []
depends_on:
  - "backend"
used_by: []
---

# Nest — Índice

> **Última atualização:** 2026-05-24

`face-orchestrator` (`nest/package.json`) é o gateway NestJS em frente ao backend Python.
Orquestra: photo quality → vision → analysis → diagnosis → overlays → output.

## Módulos (DDD bounded contexts)

| Módulo | Path | Função |
|---|---|---|
| health | [nest/src/modules/health](../../../../nest/src/modules/health) | Healthcheck |
| identity | [nest/src/modules/identity](../../../../nest/src/modules/identity) | Identidade de sessão/usuário |
| vision | [nest/src/modules/vision](../../../../nest/src/modules/vision) | Cliente HTTP para backend Python vision API |
| analysis | [nest/src/modules/analysis](../../../../nest/src/modules/analysis) | Pipeline de análise principal (domain + infra + dto) |
| diagnosis | [nest/src/modules/diagnosis](../../../../nest/src/modules/diagnosis) | Narrative + diagnostic priority + templates |
| overlays | [nest/src/modules/overlays](../../../../nest/src/modules/overlays) | Geração/serving de overlays SVG (centralizada) |
| photo-quality | [nest/src/modules/photo-quality](../../../../nest/src/modules/photo-quality) | Gate Module 0 — bloqueia análise se foto ruim |
| decision | [nest/src/modules/decision](../../../../nest/src/modules/decision) | Decisões de roteamento (ex.: vai pra análise ou rejeita) |
| execution | [nest/src/modules/execution](../../../../nest/src/modules/execution) | Tracking de execuções/jobs |
| admin | [nest/src/modules/admin](../../../../nest/src/modules/admin) | CRUD de blacklist, global-weights, metric-ideal, threshold |
| catalog | [nest/src/modules/catalog](../../../../nest/src/modules/catalog) | Catálogo de métricas/templates |
| tracking | [nest/src/modules/tracking](../../../../nest/src/modules/tracking) | Telemetria/eventos |

## Documentos

| Arquivo | Cobre |
|---|---|
| [01-architecture.md](01-architecture.md) | Topologia, bootstrap, padrão de módulo |
| 99-changelog.md | Criar conforme PRs |

## Cross-refs

- Backend Python consumido: [.claude/local/context/backend/](../backend/00-index.md)
- Frontend consumidor: [.claude/local/context/frontend/](../frontend/README.md)
- Plans Nest: [.claude/local/plans/marcos/](../../plans/marcos/)
