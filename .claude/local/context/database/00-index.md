---
tenant_id: "face-before-after-nest"
project: "face-before-after-nest"
module: "database/index"
file_path: ".claude/local/context/database/00-index.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Schema Postgres 16 do monorepo face-before-after, possuído pelo subsistema nest
  (migrations TypeORM em nest/src/database/migrations/, 47 itens versionados,
  synchronize=false invariante). Cobre catálogos de métricas, pesos, overlays,
  diagnostic templates, recommendation ladder e exercise catalog (270 itens).
tags:
  - "database"
  - "postgres"
  - "typeorm"
rag_keywords:
  - "Postgres 16 schema"
  - "TypeORM migrations CLI-driven"
  - "metric weights catalog"
  - "exercise catalog 270"
  - "diagnostic templates ladder"
related_modules:
  - "nest"
depends_on: []
used_by:
  - "nest"
---

# Database — Índice

> **Última atualização:** 2026-05-24
> Schema Postgres 16 owned por **nest** (TypeORM migrations).

## Documentos

| Arquivo | Cobre |
|---|---|
| [01-schema.md](01-schema.md) | Schema completo: tabelas, catálogos seed, invariantes TypeORM |
| [99-changelog.md](99-changelog.md) | Histórico de mudanças no schema/docs |

## Stack

- **Engine:** PostgreSQL 16 (container `postgres` do docker-compose)
- **ORM:** TypeORM em `nest/src/database/`
- **Migrations:** `nest/src/database/migrations/` — 47 itens, CLI-driven
- **Invariantes:** `synchronize=false`, `migrationsRun=false` (toda mudança via migration)

## Cross-refs

- Subsistema dono: [nest/00-index.md](../nest/00-index.md)
- Infra do container: [infra/01-deployment.md](../infra/01-deployment.md)
