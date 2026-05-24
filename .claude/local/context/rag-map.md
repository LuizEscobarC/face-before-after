---
tenant_id: face-before-after
project: face-before-after
doc_type: architecture
---

# RAG Map — face-before-after

Mapa de slugs de tenant configurados para este monorepo.

| Subprojeto | Slug | Caminho | Stack |
|---|---|---|---|
| raiz (scripts Python + docs) | `face-before-after` | `/` | Python (pipeline) + Markdown |
| frontend | `face-before-after-frontend` | `/frontend` | Vite + React + TS |
| backend | `face-before-after-backend` | `/backend` | Python (FastAPI / face-analysis-api) |
| nest | `face-before-after-nest` | `/nest` | NestJS + TS |

## Servidor ai-first
- URL: `http://localhost:3099`
- Token: `$AI_INTERNAL_TOKEN` (fallback `test-token-123`)
- **Status na configuração:** offline/unreachable — hook ficará silencioso até subir o servidor.

## Ingestão
```bash
bash .claude/local/scripts/ingest-project.sh                       # ingesta tudo
bash .claude/local/scripts/ingest-project.sh face-before-after-backend  # só backend
```

## Hook RAG
Instalado em `.claude/local/hooks/scripts/ask-rag-enrich.sh`.
Detecta subprojeto pelo cwd:
- `*/frontend*` → `face-before-after-frontend`
- `*/backend*`  → `face-before-after-backend`
- `*/nest*`     → `face-before-after-nest`
- demais        → `face-before-after`

Registrado no `.claude/settings.json` como hook `UserPromptSubmit`.
