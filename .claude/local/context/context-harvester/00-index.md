---
tenant_id: "face-before-after"
project: "face-before-after"
module: "context-harvester/index"
file_path: ".claude/local/context/context-harvester/00-index.md"
doc_type: "architecture"
created_at: "2026-05-25"
updated_at: "2026-05-25"
version: "1.0.0"
summary_context: >
  Subsistema "context-harvester": pipeline TS read-only que regenera os
  artefatos RAG do face-before-after (schema DDL, catalog semantic map,
  business logic map, golden queries, índice de migrations) lendo Postgres
  via role SELECT-only e parseando AST de Nest (ts-morph) e Python. Disparado
  pela skill local `context-harvester` ou via `just harvest-context`.
tags: ["context-harvester", "rag", "harvest", "tooling"]
rag_keywords:
  - "context harvest pipeline"
  - "ts-morph AST extraction"
  - "Postgres SELECT-only role"
  - "Seed*.ts parsing"
  - "golden queries extraction"
  - "RAG corpus regeneration"
related_modules:
  - "database"
  - "nest"
  - "backend"
depends_on: []
used_by: []
---

# context-harvester — Índice

Tooling read-only que regenera os arquivos de contexto sob `.claude/local/context/` consumidos pelo pipeline RAG do ai-first.

## Docs

| Arquivo | Cobertura |
|---|---|
| [01-architecture.md](01-architecture.md) | Steps, orquestração, outputs, env, gates de segurança |
| [99-changelog.md](99-changelog.md) | Histórico de mudanças |

## Componentes externos

- **Skill local:** [`.claude/local/skills/context-harvester/SKILL.md`](../../skills/context-harvester/SKILL.md) (override da global)
- **Orchestrator:** [`scripts/context/harvest.ts`](../../../../scripts/context/harvest.ts)
- **Recipe:** `just harvest-context [--only STEP] [--skip-db]`

## Outputs (sempre sob `.claude/local/context/`)

- `ai_context_master.md` — DDL link + per-table counts + 10 amostras anonimizadas/tabela
- `catalog_semantic_map.md` — Seeds (`Seed*.ts`) parseados + diff vs live DB
- `golden-queries.md` — Queries não-triviais extraídas dos services Nest

**Removidos em 2026-05-25** (ai-first `sourceProfileRegistry.ts` cobre nativamente):
- ~~`migrations_index.md`~~ — profile `face-before-after-nest` ingere `nest/src/**/*.ts`.
- ~~`business_logic_map.md`~~ — mesmo profile (TS) + profile `face-before-after` (Python, `chunkPyByDef`) cobrem services, @Modules e os 6 módulos Python.

## Não-objetivos

- Não escreve no Postgres (role é SELECT-only).
- Não cobre os outros subprojetos como tenants distintos — todos os outputs ficam sob o tenant `face-before-after` (raiz).
- Não substitui [[database/index]] ou [[nest/index]] — produz artefatos derivados.
