---
title: "Local context-harvester skill for face-before-after"
date: 2026-05-24
project: face-before-after
status: planned
---

# Plan — Local `context-harvester` skill (overrides global)

## Goal
Build a project-scoped `context-harvester` skill at `.claude/local/skills/context-harvester/SKILL.md` that overrides the global one and produces RAG context tailored to face-before-after's NestJS+TypeORM+Postgres orchestrator, Python analysis pipeline, and the 47 TypeORM migrations (many of them seed-only catalogs).

## Stack (confirmed)
- **Orchestrator:** NestJS + TypeORM, Postgres (`nest/`)
- **Pipeline:** Python (`face.py`, `face_metrics.py`, `recommendations.py`, `impression_layer.py`, `top_leverage.py`, `mvp_pipeline.py`)
- **Frontend:** React (`frontend/`) — out of scope for harvester
- **Migrations:** 47 files; mix of schema, `Seed*` catalogs, `Add*`, `Rebalance*`
- **DDL snapshot:** `.claude/local/database/ddl.sql` (703 lines, already present)
- **Justfile present;** no harvest recipe yet
- **Existing local skills:** `auto-execute-prompt`, `domain-context-updater`, `execute-prompt`, `full-auto-pipeline`, `planner`, `prompt-initializer`, `session-save` (no local harvester yet)

## Constraints (memory `feedback_harvest_scope`)
- Only this project's Postgres.
- Only writes under `.claude/local/`.
- Read-only DB session (`SET TRANSACTION READ ONLY`, `GRANT SELECT`).
- 100% static code analysis (ts-morph + Python `ast`). No framework boot.
- Credentials live in `.claude/.env.harvest` (gitignored), separate from `.env`.

## Outputs (under `.claude/local/context/`)
| File | Content |
|---|---|
| `ai_context_master.md` | DDL link + per-table row counts + 10 anonymized samples/table |
| `catalog_semantic_map.md` | ★ Seeds parsed from `Seed*.ts` migrations + diffed against live DB rows. Tables: metric_catalog (V1+V15), jaw/nose/mouth/brow/cheekbones/forehead/global-shape/phi-golden families, M3 overlays, M32 improvement vectors, M41 diagnostic templates |
| `business_logic_map.md` | Nest services/controllers (ts-morph AST) + Python module public functions + magic numbers |
| `golden-queries.md` | Non-trivial queries grep'd from Nest services (raw; later enriched by `golden-queries-enricher`) |
| `migrations_index.md` | All 47 migrations, classified `schema | seed | add-column | rebalance`, with 1-liner per file |

Each file emits Obsidian YAML frontmatter (`tenant_id: face-before-after`, `doc_type`, `depends_on`, `used_by`, `rag_keywords`) compatible with the ai-first ingest.

## Numbered steps

1. **Read context** — confirm structure: `ls nest/src/database/migrations/`, `ls .claude/local/context/`, peek at `nest/src/database/data-source.ts` for DB config conventions. (inline)
2. **Create skill directory** — `.claude/local/skills/context-harvester/` (inline).
3. **Write SKILL.md** — local version; same `name: context-harvester` so it overrides global. Sections: triggers, stack-detection (fixed to this project), outputs table, security guards, how-to-run, when-to-regenerate. (inline; no `doc-writer` skill exists locally)
4. **Write `.claude/.env.harvest.example`** — `PG_HOST`, `PG_PORT`, `PG_USER` (read-only role), `PG_PASSWORD`, `PG_DATABASE`. Add `.claude/.env.harvest` to `.gitignore` (verify first).
5. **Write `scripts/context/harvest.ts`** — orchestrator (TypeScript, runs via `tsx`):
   - parses `--only db|catalogs|soul|golden|migrations` and `--skip-*`
   - opens pg client with `SET TRANSACTION READ ONLY`
   - dispatches to step modules under `scripts/context/steps/`
   - writes outputs atomically to `.claude/local/context/`
6. **Step module: `steps/schema.ts`** — counts + 10-row samples per table; anonymize `email`, `user_id`, `photo_url`, tokens.
7. **Step module: `steps/catalogs.ts`** (★ project differential):
   - glob `nest/src/database/migrations/Seed*.ts` + `Rebalance*.ts` + `M*Catalog*.ts` + `M*Templates*.ts`
   - parse with ts-morph; extract object literals passed to `.insert()/.save()/.values()`
   - cross-check with `SELECT * FROM <catalog_table>` to detect drift
   - emit per-catalog table: `code | label | weight | family | version | matches_seed?`
8. **Step module: `steps/business_logic.ts`**:
   - Nest: ts-morph walk on `nest/src/**/*.{service,controller}.ts` → method signatures + repository calls
   - Python: `ast` walk on the 6 canonical modules listed above → public functions + numeric literals
9. **Step module: `steps/golden_queries.ts`** — grep `createQueryBuilder|repository\.(find|count)|SELECT ` in Nest services; group by referenced entity.
10. **Step module: `steps/migrations_index.ts`** — read all 47 filenames + class names; classify by prefix (`Seed`/`Add`/`Rebalance`/`M\d+`); 1-liner from class comment or filename.
11. **Justfile recipe**:
    ```
    harvest-context:
        npx tsx scripts/context/harvest.ts
    ```
12. **Smoke run** — `just harvest-context --only migrations` (cheapest step, no DB). Verify `migrations_index.md` is produced with 47 entries. **Decision point:** ask user before running steps that hit Postgres (credentials may not be configured yet).
13. **Update `.claude/local/context/rag-map.md`** if it tracks doc registry (already exists per earlier `ls`).

## Skills mapping
| Step | Skill | Why |
|---|---|---|
| 1, 2, 3, 4, 11, 13 | inline | no local skill matches scaffolding/docs writing for this project |
| 5–10 | inline | code generation, no skill fits |
| 12 | inline | one-off smoke; no harvester-runner skill |
| Post-impl | `session-save` (local) | persist session context |

`doc-writer`, `golden-queries-enricher`, `context-injector` exist only globally — they consume the outputs, they don't produce the harvester.

## Decision points
- **DP1 (Step 4):** does `.claude/.env.harvest` already exist? If yes, don't overwrite; just generate the `.example`.
- **DP2 (Step 12):** Postgres credentials available? If no, ship the skill + scripts and stop before step that requires DB; user runs it later.
- **DP3:** keep `frontend/` out — confirmed yes (no domain logic, just UI).

## Success verification
- `.claude/local/skills/context-harvester/SKILL.md` exists, frontmatter parses.
- `scripts/context/harvest.ts --only migrations` produces `migrations_index.md` with 47 entries and valid YAML frontmatter.
- `just harvest-context --help` lists the new flags.
- No writes outside `.claude/local/` (verified by `git status`).

## Quality gate
Per `CLAUDE.md`: no project-wide lint defined for backend orchestrator harness scripts. Run `npx tsc --noEmit scripts/context/harvest.ts` if a tsconfig exists for `scripts/`; otherwise skip.

## Recommended Execution Model
**sonnet** — multi-file TS scaffolding, AST parsing, no deep reasoning required; opus would be overkill.
