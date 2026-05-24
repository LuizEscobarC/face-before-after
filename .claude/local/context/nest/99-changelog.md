---
tenant_id: "face-before-after-nest"
project: "face-before-after-nest"
module: "nest/changelog"
file_path: ".claude/local/context/nest/99-changelog.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Changelog do subsistema nest. Uma linha por mudanca documentada, mais recente primeiro.
tags:
  - "nest"
  - "changelog"
rag_keywords: []
related_modules: []
depends_on: []
used_by: []
---
# nest — Changelog

- **2026-05-24** — Criado `03-modules-analysis-tracking.md`: módulos analysis, tracking, identity — serviços, DTOs, entidades DB.

- **2026-05-24** — Criado `02-modules-diagnosis-catalog.md`: DiagnosisService, RecommendationEngine (PR-57 ladder rule), CatalogService, AccEntry, invasiveness ladder 3 gates.

- **2026-05-24** — PR-57: `RecommendationEngine._applyLadderRule()` — invasiveness ladder rule (3 gates: 4b block, max 2 categories, re-sort by invasivenessLevel ASC). 8 unit tests in `recommendation-engine.service.spec.ts`. `AccEntry` interface promoted to module scope.

- **2026-05-24** — Pass geral de frontmatter: tenant_id corrigido por subprojeto (rag-map.md), file_path realinhado a `.claude/local/context/`, summary_context e rag_keywords reescritos para densidade factual. Sem mudanca de codigo.
