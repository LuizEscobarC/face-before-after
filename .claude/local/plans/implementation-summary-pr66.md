---
tenant_id: "face-before-after"
project: "face-before-after"
module: "plans/implementation-summary-pr66"
file_path: ".claude/plans/implementation-summary-pr66.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Data: 12 mai 2026 Status: ✅ CONCLUÍDO — Migrations executadas, type-check limpo
tags:
  - "planning"
rag_keywords:
  - "implementation"
  - "plans"
  - "pr66"
  - "summary"
related_modules: []
depends_on: []
used_by: []
---
# PR-66: Backend Glossary + Paginated Findings/Recommendations — Implementação Completa

**Data:** 12 mai 2026  
**Status:** ✅ CONCLUÍDO — Migrations executadas, type-check limpo

---

## Resumo Executivo

Removido todas as dependências frontend de arquivos estáticos (`glossary.ts`, `feynman.ts`). Backend agora expõe:
- Glossário editorial (12 conceitos base + 54 métricas após alias resolution)
- Findings pagináveis (filtro por severidade mínima)
- Recommendations pagináveis (filtro por categoria)
- Diagnósticos persistem em `diagnosis_report` table

---

## Alterações Backend (NestJS)

### 1. **MetricContentEntity + Seed Migration**
- **Arquivo:** `nest/src/modules/catalog/infrastructure/entities/metric-content.entity.ts`
- **Tipo:** Nova entity TypeORM
- **Schema:** `metric_content (metric_id, locale)` PK composta
- **Campos:** feynman_text, description, how_measured, ranges_text, common_issues (jsonb), references (jsonb)

- **Arquivo:** `nest/src/database/migrations/1746000400000-MetricContent.ts`
- **Tipo:** Migration com DDL + seed inline
- **Seed:** Extrai verbatim de `glossary.ts` (12 conceitos) + `feynman.ts` (50 analogias)
- **Aliasing:** Resolve mapeamento (ex: `canthal_tilt_{left,right,mean}_deg` → 3 linhas de `metric_content` com mesma descrição)
- **Registros:** 54 linhas (union de FEYNMAN keys + ALIAS_TO_GLOSSARY_KEY keys)

### 2. **CatalogModule Wiring**
- Registrou `MetricContentEntity` em `TypeOrmModule.forFeature`
- Adicionou `GlossaryEntryDto` + `GlossaryResponseDto` em `catalog.dto.ts`
- Implementou `CatalogService.getGlossary(locale)`:
  - Join `metric_definition` + `metric_content`
  - Retorna `Record<metric_id, GlossaryEntryDto>` (chaveado por ID concreto)
- Adicionou `@Get('glossary')` endpoint no `CatalogController`

### 3. **Paginated Findings + Recommendations (Narrative)**
- **Arquivo:** `nest/src/modules/diagnosis/narrative.service.ts`
- **Métodos novos:**
  - `getAllFindings(reportId, opts: {limit?, minSeverity?})` — todos os findings não-ideal, filtro por severidade, cap 50 (máx 200)
  - `getRecommendations(reportId, opts: {limit?, category?})` — recommendation_link join catalog, cap 20 (máx 100)

- **Arquivo:** `nest/src/modules/diagnosis/narrative.controller.ts`
- **Endpoints novos:**
  - `GET /v1/analysis/:id/findings?limit&minSeverity`
  - `GET /v1/analysis/:id/recommendations?limit&category`

### 4. **DiagnosisReport Persistence (B3)**
- **Arquivo:** `nest/src/modules/diagnosis/infrastructure/entities/diagnosis-report.entity.ts`
- **Entity:** PK `run_id` (text), campos: `top_concerns` (jsonb), `summary` (text), `timestamp` (text), `created_at` (timestamptz)

- **Arquivo:** `nest/src/database/migrations/1746000410000-DiagnosisReport.ts`
- **DDL:** CREATE TABLE diagnosis_report

- **Arquivo:** `nest/src/modules/diagnosis/diagnosis.service.ts`
- **Refactor:**
  - Removeu `private readonly reports = new Map<>()`
  - Injetou `DiagnosisReportEntity` repository
  - `handleAnalysisCompleted()` agora `async` — persiste row via `repo.save()`
  - `getReport()` agora `async` — lê do DB (throws 404 se não encontrado)

- **Arquivo:** `nest/src/modules/diagnosis/diagnosis.controller.ts`
- **Ajuste:** `getReport()` retorna `Promise<DiagnosisReportDto>` (era síncrono)

- **Arquivo:** `nest/src/modules/diagnosis/diagnosis.module.ts`
- **Registrou:** `DiagnosisReportEntity` em `TypeOrmModule.forFeature`

---

## Alterações Frontend (React)

### 1. **GlossaryTerm Type Update**
- **Arquivo:** `frontend/src/types.ts`
- **Mudança:** Tornadas campos opcionais (exceto `termo` + `unidade` obrigatórios)
- **Campos:** `feynman?`, `descricao?`, `como_medido?`, `faixas?`, `problemas_comuns?`, `referencias?`
- **Motivo:** Progressive disclosure — campos null quando sem seed editorial

### 2. **API Layer**
- **Arquivo:** `frontend/src/api.ts`
- **Alteração:** `fetchGlossary()` agora consome `GET /v1/catalog/glossary` (real endpoint)
- **Adicionados:** 
  - `fetchFindings(reportId, opts)` → `GET /v1/analysis/:id/findings`
  - `fetchReportRecommendations(reportId, opts)` → `GET /v1/analysis/:id/recommendations`
  - Types: `NarrativeFinding`, `NarrativeRecommendation`
- **Removido:** `import { GLOSSARY } from "./data/glossary"`

### 3. **MetricExplainer Cleanup**
- **Arquivo:** `frontend/src/components/MetricExplainer.tsx`
- **Removido:**
  - `glossaryKeyFor()` function (L15-45)
  - `import { feynmanFor }`
- **Lógica:** Usa `glossary[metricKey]` direto (backend já resolveu aliases ao gravar)
- **Feynman:** Lê `term?.feynman` em vez de `feynmanFor(metricKey)`

### 4. **PremiumResultPage Refactor**
- **Arquivo:** `frontend/src/pages/PremiumResultPage.tsx`
- **Removido:** `import { feynmanFor } from "../data/feynman"`
- **Alteração L918-921:** Substitui `feynmanFor(result.main_insight.metric_key)` por `glossary[result.main_insight.metric_key]?.feynman`
- **Inline IIFE:** Lê feynman da glossary com fallback null

### 5. **Deletados Arquivos Estáticos**
- `frontend/src/data/glossary.ts` — ✅ DELETADO
- `frontend/src/data/feynman.ts` — ✅ DELETADO

---

## Verificações

### Type-check
- ✅ `npm run tsc --noEmit` (frontend) — EXIT=0
- ✅ `npm run tsc --noEmit -p tsconfig.build.json` (nest) — EXIT=0

### Migrations Executadas
```
[X] 41 MetricContent1746000400000     — 54 rows seeded
[X] 42 DiagnosisReport1746000410000   — table created, empty
```

### Database Verification
```
postgres=# SELECT COUNT(*) FROM metric_content;
 count 
-------
    54
```

---

## Endpoints Live

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/v1/catalog/glossary?locale=pt-BR` | Editorial glossary (54 entries) |
| GET | `/v1/analysis/:id/findings?limit&minSeverity` | Paginated findings (all non-ideal) |
| GET | `/v1/analysis/:id/recommendations?limit&category` | Paginated recommendations (full long copy) |
| GET | `/v1/diagnosis/:runId` | Diagnosis report (now persisted in DB) |

---

## Future Considerations

- **Locales:** Backend supports multi-locale (default pt-BR); add more seeds if needed
- **Glossary Completeness:** Currently 54 metrics covered; add missing ones via new seed migrations
- **Findings/Recommendations:** Endpoints ready for frontend pagination UI; no caps enforced yet
- **DiagnosisReport:** Persists top-3 concerns + summary; consider archival strategy for old reports

