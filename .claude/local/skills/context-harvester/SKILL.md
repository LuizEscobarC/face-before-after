---
name: context-harvester
triggers:
  - "harvest context"
  - "update AI context"
  - "atualizar contexto"
  - "gerar contexto do projeto"
  - "harvest face-before-after"
description: "Project-scoped context harvester for face-before-after. Regenera arquivos RAG em .claude/local/context/ cobrindo apenas o que o pipeline ai-first NÃO deriva sozinho: schema Postgres live (DDL + counts + amostras anonimizadas), catalog semantic map (Seed*.ts via ts-morph + cross-check live DB), Nest @Module graph + Python AST (pipeline de análise), e golden queries TypeORM. Read-only, project-exclusive. Migrations e per-method Nest detail são deixados para o RAG ingerir do source code direto."
tags: ["context", "ai", "rag", "harvest", "read-only", "nest", "postgres", "python"]
---

# Context Harvester — face-before-after (local override)

Esta versão local sobrepõe a global. É **específica** deste projeto (NestJS + TypeORM + Postgres + pipeline Python).

## Outputs (sempre sob `.claude/local/context/`)

```
.claude/local/context/
├── ai_context_master.md      ← DDL link + per-table counts + 10 amostras anonimizadas/tabela
├── catalog_semantic_map.md   ← ★ Seeds (Seed*.ts) parseados + diff vs live DB
└── golden-queries.md         ← Queries não-triviais extraídas dos services Nest
```

**O que o harvester DELIBERADAMENTE não produz** (cobertura nativa pelo ai-first — ver `ai-first/src/ingest/sourceProfileRegistry.ts`):

- ~~`migrations_index.md`~~ — profile `face-before-after-nest` ingere `nest/src/**/*.ts` direto (inclui migrations).
- ~~`business_logic_map.md`~~ — mesmo profile + profile `face-before-after` (Python, `chunkPyByDef`) cobrem Nest @Module graph e os 6 módulos Python. Contextual Retrieval (Fase 3) gera `summary_context` + `class_name` + `method_name` por chunk automaticamente.

Todos os arquivos emitem frontmatter Obsidian YAML (`tenant_id: face-before-after`, `doc_type`, `depends_on`, `used_by`, `rag_keywords`).

## Stack (fixa, não detectada)

- **Orquestrador:** NestJS + TypeORM, `nest/` — DB via `DATABASE_URL` (Postgres)
- **Migrations:** `nest/src/database/migrations/` (47 arquivos, muitas Seed*)
- **Pipeline:** Python — módulos canônicos analisados:
  `face_metrics.py`, `recommendations.py`, `impression_layer.py`,
  `top_leverage.py`, `mvp_pipeline.py`, `face_asymmetry.py`
- **Frontend:** `frontend/` — **fora do escopo** do harvester

## Pré-requisitos

1. Copiar `.claude/.env.harvest.example` → `.claude/.env.harvest` e preencher com **role read-only**:
   ```
   PG_URL=postgresql://reader:***@host:5432/face_before_after
   ```
2. Postgres acessível (rede / VPN se aplicável).
3. Node deps: `cd scripts/context && npm i` (ou usar deps do `nest/`).

## Como executar

```bash
just harvest-context                       # tudo (3 steps)
just harvest-context --only catalogs       # só catalog semantic map (★)
just harvest-context --only db             # só schema + samples
just harvest-context --only golden         # só golden queries
just harvest-context --skip-db             # tudo exceto db/catalogs (offline-safe)
```

## Steps (cada um é idempotente, pode rodar isolado)

### 1. `db` — schema snapshot + samples
- Conecta com `SET TRANSACTION READ ONLY`.
- `SELECT count(*)` por tabela.
- `SELECT * FROM <t> ORDER BY random() LIMIT 10` → anonimiza `email`, `*token*`, `user_id`, `photo_url`, `phone`.
- Emite `ai_context_master.md` (e atualiza/regenera `.claude/local/database/ddl.sql` via `pg_dump --schema-only` se disponível).

### 2. `catalogs` — semantic map (★ diferencial deste projeto)
- Glob: `nest/src/database/migrations/{Seed*,Rebalance*,M*Catalog*,M*Templates*}.ts`
- Parser: ts-morph. Extrai literais passados para `.values()`, `.insert()`, `repository.save()`, `INSERT INTO ... VALUES`.
- Cross-check com `SELECT * FROM <catalog_table>` (live).
- Por catálogo, emite tabela: `code | label | weight | family | version | matches_seed?`
- Catálogos cobertos:
  - `metric_catalog` (V1 + V15 rebalance)
  - Famílias: jaw, nose, mouth, brow, cheekbones, forehead, global_shape, phi_golden
  - M3 overlay catalog, M32 improvement vectors, M41 diagnostic templates

### 3. `golden` — queries não-triviais
- Grep com pgxs/AST em `nest/src/**/*.ts` por:
  - `createQueryBuilder`
  - `repository.{find,count,query}`
  - SQL literal multilinha
- Agrupa por entity referenciada. Saída bruta — pós-enriquecimento via skill `golden-queries-enricher` (global).

## Security Guards

- **DB:** `.claude/.env.harvest` separado do `.env` do Nest, gitignored.
  Role com `GRANT SELECT ONLY`. Driver pg com `statement_timeout` e `SET TRANSACTION READ ONLY`.
  Zero `INSERT`/`UPDATE`/`DELETE`/`DROP` no código do harvester.
- **AST:** análise 100% estática. Sem boot do Nest, sem import de módulos do projeto, sem execução do pipeline Python.
- **Escopo:** writes só em `.claude/local/context/` e `.claude/local/database/`. Verificável via `git status`.

## Quando regenerar

- Após nova migration de schema ou catálogo.
- Após criar/renomear service ou módulo Python do pipeline.
- Antes de tasks que toquem scoring, métricas, ou recomendações.
- Antes de implementar feature nova em área não documentada.

## Override / configuração

| Env | Default | Efeito |
|---|---|---|
| `OUTPUT_PATH` | `.claude/local/context` | Onde escrever |
| `PG_URL` | (de `.claude/.env.harvest`) | Postgres connection |
| `SKIP_DB` | `false` | Pula steps `db` e `catalogs` (live diff) |

## Referência cruzada

- Pós-enriquecimento de golden queries: skill global `golden-queries-enricher`
- Atualização incremental de doc de domínio: skill local `domain-context-updater`
- Skill que ingere o output: pipeline RAG do projeto `ai-first`
