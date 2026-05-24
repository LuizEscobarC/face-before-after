---
tenant_id: "face-before-after"
project: "face-before-after"
module: "root-pipeline/index"
file_path: ".claude/local/context/root-pipeline/00-index.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Scripts Python legacy na raiz do monorepo — primeira versão do pipeline de
  face-analysis, anterior à refactor DDD que moveu o domínio para backend/app.
  Mantidos como referência funcional e geradores standalone de relatórios MVP
  (build_mvp_html.py, mvp_pipeline.py).
tags:
  - "root-pipeline"
  - "legacy"
  - "python"
rag_keywords:
  - "legacy face-analysis scripts"
  - "MVP HTML report generator"
  - "build_mvp_html mvp_pipeline"
  - "pre-FastAPI baseline"
related_modules:
  - "backend"
depends_on: []
used_by: []
---

# Root Pipeline (Legacy) — Índice

> **Última atualização:** 2026-05-24
> **Status:** em evolução — superado pela arquitetura DDD em `backend/`, mantido para relatórios MVP avulsos.

## Documentos

| Arquivo | Cobre |
|---|---|
| [01-legacy-scripts.md](01-legacy-scripts.md) | Inventário dos scripts da raiz e papéis atuais |
| [99-changelog.md](99-changelog.md) | Histórico |

## Status

Scripts mantidos porque `build_mvp_html.py` e `mvp_pipeline.py` ainda geram relatórios standalone. Nova lógica deve ir em [backend/](../backend/00-index.md), não aqui.

## Cross-refs

- Sucessor arquitetural: [backend/00-index.md](../backend/00-index.md)
