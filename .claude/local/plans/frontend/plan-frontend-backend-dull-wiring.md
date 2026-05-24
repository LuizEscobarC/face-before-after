---
tenant_id: "face-before-after"
project: "face-before-after"
module: "frontend/plan-frontend-backend-dull-wiring"
file_path: ".claude/plans/frontend/plan-frontend-backend-dull-wiring.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  TL;DR: O frontend tem dados hardcoded que já existem no backend, endpoints que existem mas são ignorados, endpoints que ainda precisam ser criados, e textos de diagnóstico não populados. O plano abaixo move tudo para o backend em ordem de dependência.
tags:
  - "planning"
  - "frontend"
  - "backend"
rag_keywords:
  - "backend"
  - "dull"
  - "frontend"
  - "plan"
  - "plans"
  - "wiring"
related_modules: []
depends_on: []
used_by: []
---
## Plan: Frontend ↔ Backend Full Wiring

**TL;DR:** O frontend tem dados hardcoded que já existem no backend, endpoints que existem mas são ignorados, endpoints que ainda precisam ser criados, e textos de diagnóstico não populados. O plano abaixo move tudo para o backend em ordem de dependência.

---

### Fase 1 — Wiring imediato (backend pronto, frontend ignora)

**S1 — Score bands** *(independente, pode fazer agora)*
- `FreeResultPage.tsx` L6-10 e `CompareResultPage.tsx` L20 hardcodam `>= 80`, `>= 60`, `>= 40`
- Backend já serve `GET /v1/catalog/score-bands` e `GET /v1/admin/threshold-configs`
- Fix: hook `useScoreBands()` que consome o endpoint + remover literais de `scoreColor()`

**S2 — Glossary via API** *(depende de B4)*
- `api.ts::fetchGlossary()` retorna import estático de `data/glossary.ts` (350 linhas hardcoded)
- Fix: trocar para fetch real de `GET /v1/diagnosis/glossary` (B4) + deletar `data/glossary.ts`

**S3 — Feynman explanations via API** *(depende de B4)*
- `data/feynman.ts`: 45 textos por métrica hardcoded no bundle
- Fix: adicionar `feynman_text_pt` em `MetricDefinitionDto` no backend + deletar `data/feynman.ts`

---

### Fase 2 — Endpoints faltando no backend

**B1 — All findings** *(depende de T1)*
- `GET /v1/analysis/:id/narrative` retorna só top-3. `PremiumResultPage` precisa de texto para todos os findings
- Fix: criar `GET /v1/analysis/:id/findings?limit=20&minSeverity=mild` → `NarrativeFindingDto[]` em `NarrativeController` + `NarrativeService`

**B2 — Recommendations paginadas** *(depende de T1)*
- `NarrativeResponseDto.recommendations` dá top-5 sem `display_text_long_pt`
- Fix: criar `GET /v1/analysis/:id/recommendations?limit=20&category=exercise` → `NarrativeRecommendationDto[]` com texto longo, `evidence_level`, `invasiveness_level`, `disclaimer_template`

**B3 — DiagnosisService persistência no DB** *(independente)*
- `DiagnosisService` usa `Map<>` em memória — dados perdidos no restart
- Fix: criar entidade `DiagnosisReportEntity` + TypeORM, manter compatibilidade de DTO

**B4 — Glossary endpoint** *(depende de T1)*
- Fix: criar `GET /v1/diagnosis/glossary` → join `metric_definition` + `diagnostic_template` (size='medium') retornando `{ metric_id, display_name, description_pt, feynman_text_pt, unit, how_measured_pt, references[] }`

---

### Fase 3 — Remover constantes duplicadas do frontend

**F1** *(independente)*: `COMPOSE_ANCHOR` + `IMPROVEMENT_ANCHOR` em `PremiumResultPage.tsx` e `OverlayLayer.tsx` → usar `improvement_vector_x/y` de `MetricEvaluationResultDto` (backend já emite)

**F2** *(depende de B4)*: `glossaryKeyFor()` aliases em `MetricExplainer.tsx` → chave direta `metric_id` via glossary API

**F3** *(independente)*: `TIER_LABEL` em `PremiumResultPage.tsx` → ler de `GlobalScoreResultDto.band`

---

### Fase 4 — Seeding de texto (PR-53)

**T1 — diagnostic_template completo** *(desbloqueia B1, B2, B4)*
- Estado: ✅ 504 templates short+medium+long entregues (PR-53b/PR-54, M42b/M42c). Cobertura de 30 métricas novas (fase C) DEFERRED.
- Ver `pr53b-pr54-30-metrics-2026-05-11.md` + STATUS_LEDGER_2026-05-24.md.

**T2 — aesthetic_procedure catalog (PR-56b)**
- ~15 entradas: botox masseter, preenchimento labial/malar/mento, fios PDO, rinomodelação
- Migration `SeedAestheticProcedures`

---

### Dependências

```
T1 (seed templates) ─────────────────────────┐
B3 (persist diagnosis) ──┐                   │
                          ├── B4 (glossary) ──┤── B1 (all findings) ── F2
                          │                  │
                          └────────────────── B2 (recs paginated)

S1 (score bands) ─── independente ← começa aqui
F1, F3 ──────────── independentes ← pode fazer junto com S1
S2 (glossary wire) ← após B4
S3 (feynman wire) ── após B4
```

---

### Arquivos principais

| Arquivo | O que muda |
|---------|-----------|
| FreeResultPage.tsx L6-10 | S1: `scoreColor()` do hook |
| CompareResultPage.tsx L20 | S1: score threshold do hook |
| PremiumResultPage.tsx L25-47 | F1 + F3 |
| MetricExplainer.tsx L15-45 | F2 |
| OverlayLayer.tsx L18-100 | F1 |
| api.ts | S2, S3 + novos `fetchFindings()`, `fetchReportRecommendations()` |
| glossary.ts | Deletar após S2 |
| feynman.ts | Deletar após S3 |
| `nest/.../narrative.controller.ts` | B1, B2 |
| `nest/.../narrative.service.ts` | B1, B2 |
| `nest/.../diagnosis.service.ts` | B3 |
| `nest/.../catalog.controller.ts` | B4 |

### Fora do escopo
- `anatomicalZones.ts` — engine client-side MediaPipe para exercícios, não é backend concern
- `OVERLAY_STYLES/LABELS/DEFAULT_OVERLAYS` — rendering config legítimo no frontend
- Landmark constants de SVG (`P_NOSE_TIP`, `LM_JAWLINE`, etc.) — rendering client-side necessário
- Fallback capture guidelines — ok como fallback, backend já serve o canônico

---

**Por onde começar:** S1 (score bands) + F1 + F3 são independentes e sem risco. Em paralelo, T1 (seed de templates) desbloqueia tudo na Fase 2 e é o gargalo crítico.