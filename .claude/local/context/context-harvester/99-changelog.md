---
tenant_id: "face-before-after"
project: "face-before-after"
module: "context-harvester/changelog"
file_path: ".claude/local/context/context-harvester/99-changelog.md"
doc_type: "concept"
created_at: "2026-05-25"
updated_at: "2026-05-25"
version: "1.0.0"
summary_context: >
  Changelog do subsistema context-harvester (tooling RAG read-only).
tags: ["context-harvester", "changelog"]
rag_keywords: []
related_modules: []
depends_on: []
used_by: []
---

# context-harvester — Changelog

- **2026-05-25** — Step `soul` removido. ai-first já tem `src/ingest/sourceProfileRegistry.ts` com profiles `face-before-after-nest` (TS, `chunkTsByExport`) e `face-before-after` (Python, `chunkPyByDef`) — cobre Nest @Module graph, services/controllers e os 6 módulos Python via ingestão direta de source. Arquivo `business_logic_map.md` deletado. Total: 4 → 3 steps (`db`, `catalogs`, `golden`).
- **2026-05-25** — Escopo reduzido após audit vs `ai-first/.claude/local/context/rag/`. Removido step `migrations` (RAG ingere `.ts` direto + tag no chunker). Encolhido step `soul`: agora emite apenas `@Module` graph (macro) + Python AST — per-method/per-class Nest detail removido porque Contextual Retrieval (Fase 3) gera `summary_context` + `class_name` + `method_name` por chunk automaticamente. Total: 5 steps → 4 steps. Arquivo `migrations_index.md` deletado.
- **2026-05-25** — Subsistema criado. Skill local em `.claude/local/skills/context-harvester/` (override da global), orquestrador `scripts/context/harvest.ts` (TS/ESM via tsx) com 5 steps (migrations, soul, golden, db, catalogs), recipe `just harvest-context`, template `.claude/.env.harvest.example` exigindo role Postgres SELECT-only. Primeiros outputs gerados sob `.claude/local/context/`.
