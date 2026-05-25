---
tenant_id: "face-before-after"
project: "face-before-after"
module: "context-harvester/architecture"
file_path: ".claude/local/context/context-harvester/01-architecture.md"
doc_type: "architecture"
created_at: "2026-05-25"
updated_at: "2026-05-25"
version: "3.0.0"
summary_context: >
  Arquitetura do context-harvester: orquestrador TS (harvest.ts) que executa
  3 steps independentes (golden, db, catalogs), cada um emitindo um arquivo
  Markdown com frontmatter Obsidian sob .claude/local/context/. DB access é
  read-only (role harvester com GRANT SELECT). Steps `db` e `catalogs`
  requerem Postgres; `golden` é estático (AST TypeORM). Migrations, business
  logic e Python AST foram removidos — ai-first sourceProfileRegistry
  (profiles `face-before-after-nest` e `face-before-after`) cobre via
  ingestão direta do source code.
tags: ["context-harvester", "architecture", "tooling"]
rag_keywords:
  - "harvest orchestrator steps"
  - "ts-morph project AST"
  - "anonymization hash salt"
  - "live DB cross-check seeds"
  - "ESM tsx loader"
related_modules:
  - "database"
  - "nest"
  - "backend"
depends_on: []
used_by: []
---

# context-harvester — Arquitetura

## Visão geral

Pipeline TypeScript (ESM, executado via `tsx`) que regenera **apenas** os artefatos RAG que o pipeline ai-first não consegue derivar sozinho. Duas fontes: (a) parsing AST das queries TypeORM (via ts-morph) e (b) introspecção read-only do Postgres. Cada step escreve um único arquivo Markdown idempotente sob `.claude/local/context/`.

## Escopo deliberadamente reduzido

A partir de 2026-05-25, três outputs foram **removidos** porque o ai-first cobre nativamente via `src/ingest/sourceProfileRegistry.ts`:

- `migrations_index.md` — profile `face-before-after-nest` ingere `nest/src/**/*.ts` direto (inclui migrations).
- `business_logic_map.md` (Nest + Python) — mesmo profile cobre Nest services/controllers/modules; profile `face-before-after` (chunkPyByDef) cobre os 6 módulos Python. Contextual Retrieval (Fase 3) gera `summary_context` + `class_name` + `method_name` por chunk automaticamente.

Mantemos só o que **não é derivável** por leitura de source: live DB (counts/samples), TypeORM query patterns, e diff catálogo seed vs DB.

## Componentes

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| Orchestrator | [scripts/context/harvest.ts](../../../../scripts/context/harvest.ts) | Carrega `.env.harvest`, resolve `OUTPUT_PATH`, executa steps (com flags `--only` / `--skip-db`) |
| Shared utils | [scripts/context/steps/_shared.ts](../../../../scripts/context/steps/_shared.ts) | Frontmatter writer, anonymização (hash + `ANON_SALT`), helpers de path |
| Golden step | [scripts/context/steps/golden.ts](../../../../scripts/context/steps/golden.ts) | Extrai queries não-triviais (TypeORM repository/QueryBuilder) → `golden-queries.md` |
| DB step | [scripts/context/steps/db.ts](../../../../scripts/context/steps/db.ts) | Conecta no Postgres (SELECT-only), gera DDL link, per-table counts e 10 amostras anonimizadas → `ai_context_master.md` |
| Catalogs step | [scripts/context/steps/catalogs.ts](../../../../scripts/context/steps/catalogs.ts) | Parseia `Seed*.ts` via ts-morph e faz diff vs live DB → `catalog_semantic_map.md` |

## Fluxo

1. `just harvest-context [FLAGS]` → `npx tsx scripts/context/harvest.ts`.
2. `harvest.ts` carrega `.claude/.env.harvest` (gitignored), determina `OUTPUT_PATH` (default `.claude/local/context/`) e cria a pasta se necessário.
3. Resolve a lista de steps: por padrão todos; `--only X` roda um; `--skip-db` exclui `db` e `catalogs` (úteis para smoke sem Postgres).
4. Cada step é independente — falha em um não aborta os demais, e cada um sobrescreve seu próprio arquivo de output.

## Configuração

Arquivo: `.claude/.env.harvest` (template em `.claude/.env.harvest.example`, gitignored).

| Variável | Default | Uso |
|---|---|---|
| `PG_URL` | — | Connection string. **Role deve ter apenas `GRANT SELECT`** |
| `PG_STATEMENT_TIMEOUT_MS` | `30000` | Timeout por statement |
| `ANON_SALT` | `face-before-after-2026` | Salt para hashes estáveis em amostras anonimizadas |
| `OUTPUT_PATH` | `<repo>/.claude/local/context` | Override do destino dos arquivos (raramente alterado) |

## Decisões relevantes

- **Read-only por contrato:** documentação e template `.env.harvest.example` exigem role `harvester` com `GRANT SELECT` apenas. Anti-pattern explícito: usar credencial owner. Razão: harvester pode rodar em loop/CI e nunca deve mutar produção.
- **Project-exclusive:** os outputs só vão para `.claude/local/context/` deste repo. Não tenta normalizar/portar para outros projetos. Razão: cada projeto tem skill local própria (override da global) com a stack hard-coded.
- **Outputs sob tenant raiz (`face-before-after`):** apesar do monorepo ter 4 tenants RAG, os artefatos do harvester ficam sob a raiz porque atravessam todos os subprojetos (Nest + Python + DB). Subsystem docs específicos continuam sob seus tenants (ver [../_meta/00-index.md](../_meta/00-index.md)).
- **Steps independentes em vez de pipeline encadeado:** permite `--only` e tolera falhas isoladas (ex.: Postgres offline → ainda gera `golden`).

## Anonimização

`_shared.ts` expõe `anonymize(value, salt)` — hash determinístico baseado em `ANON_SALT`. Garante que amostras (step `db`) não vazem PII real mas mantenham padrões de cardinalidade entre rodadas (mesma input → mesmo hash).

## Pontos de extensão

- Novo step: criar `steps/X.ts` exportando `runXStep({outputPath})` + registrar em `harvest.ts` (`ALL` + `STEPS_MAP`).
- Novo padrão de query no `golden`: adicionar matcher em `steps/golden.ts` (busca por `QueryBuilder`, `repository.find(`, raw SQL).
- Trocar destino: setar `OUTPUT_PATH` no `.env.harvest`.

## Não-objetivos

- Não roda ingestão para o ai-first — isso é tarefa do `bash .claude/local/scripts/ingest-project.sh` (ver [../rag-map.md](../rag-map.md)).
- Não valida frontmatter dos arquivos gerados (assumido correto pelo writer compartilhado).
- Não cobre o frontend (Vite/React) — sem business logic relevante para RAG.
