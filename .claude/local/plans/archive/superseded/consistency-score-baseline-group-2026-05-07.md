---
tenant_id: "face-before-after"
project: "face-before-after"
module: "superseded/consistency-score-baseline-group-2026-05-07"
file_path: ".claude/plans/archive/superseded/consistency-score-baseline-group-2026-05-07.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Data: 2026-05-07 Módulo: vision / analysis / frontend Tipo: feature
tags:
  - "planning"
rag_keywords:
  - "archive"
  - "baseline"
  - "consistency"
  - "group"
  - "plans"
  - "score"
  - "superseded"
related_modules: []
depends_on: []
used_by: []
---
# Plano — Prompt 5: ConsistencyScore + baselineGroupId

**Data:** 2026-05-07  
**Módulo:** vision / analysis / frontend  
**Tipo:** feature

---

## Contexto

A infraestrutura de consistência longitudinal já está parcialmente implementada:
- `fingerprint.py` tem `compute_consistency_score()` ✅
- `/vision/compare` já retorna `consistency_score`, `consistency_issues`, `is_comparable` ✅
- `ConsistencyWarning.tsx` existe mas não está integrado ao `CompareResultPage.tsx` ❌
- `CompareWithConsistency` está em `api.ts` mas não em `types.ts` ❌
- `baseline_group_id` não existe em nenhum lugar ❌
- NestJS `compare()` retorna `Record<string, unknown>` sem tipagem ❌

O escopo é cirúrgico: sem novo endpoint FastAPI (o `/vision/compare` já faz tudo), sem banco de dados de histórico. MVP de consistência baseado na comparação direta entre as duas fotos submetidas.

---

## Passos de Implementação

### Passo 1 — `fingerprint.py`: adicionar `generate_baseline_group_id(flags)`

Adicionar função que gera um ID determinístico baseado apenas nos flags categóricos (beard, glasses, hair_covering) — independente de pose/lighting/distance. Mesmo estado de condições faciais → mesmo group_id.

```python
def generate_baseline_group_id(flags: dict[str, bool]) -> str:
    key = f"beard:{flags.get('beard', False)}|glasses:{flags.get('glasses', False)}|hair:{flags.get('hair_covering', False)}"
    return hashlib.sha1(key.encode("utf-8"), usedforsecurity=False).hexdigest()[:12]
```

### Passo 2 — `compare.py`: incluir `baseline_group_id` na resposta

Carregar `baseline_group_id` do sidecar fingerprint JSON (ou gerar na hora se não existir). Incluir no dict de retorno do `compare_runs`.

Sidecar já salva `fingerprint_parts` — estender para salvar também `baseline_group_id` durante o `full_pipeline`.

### Passo 3 — `full_pipeline.py`: salvar `baseline_group_id` no sidecar

Ao salvar o sidecar `{run_id}_fingerprint.json`, incluir `baseline_group_id` gerado por `generate_baseline_group_id(flags)`.

### Passo 4 — `types.ts` (frontend): mover/estender `CompareWithConsistency`

Adicionar a `types.ts`:
```typescript
export type CompareWithConsistency = CompareResult & {
  consistency_score: number;
  consistency_issues: string[];
  is_comparable: boolean;
  baseline_group_id_before?: string;
  baseline_group_id_after?: string;
};
```
Remover `CompareWithConsistency` do `api.ts` (exportar de `types.ts`).

### Passo 5 — `api.ts` (frontend): `compareRuns` passa a retornar `CompareWithConsistency`

Mudar o tipo de retorno de `compareRuns` para `CompareWithConsistency` (FastAPI já retorna os campos; só faltava o tipo correto).

### Passo 6 — NestJS DTOs: `CompareWithConsistencyDto`

Criar/atualizar `nest/src/modules/analysis/dto/analysis.dto.ts` para incluir `CompareWithConsistencyDto`:
```typescript
export class CompareWithConsistencyDto {
  // ... campos de CompareResult
  consistency_score!: number;
  consistency_issues!: string[];
  is_comparable!: boolean;
  baseline_group_id_before?: string;
  baseline_group_id_after?: string;
}
```
Atualizar `AnalysisController.compare()` para retornar `CompareWithConsistencyDto` ao invés de `Record<string, unknown>`.

### Passo 7 — `CompareResultPage.tsx`: integrar `ConsistencyWarning`

Atualizar o `LocationState` para usar `CompareWithConsistency`. Renderizar `<ConsistencyWarning>` logo abaixo do hero (score arcs), antes das top melhorias. Só renderizar quando `consistency_score < 0.8` ou `!is_comparable`.

### Passo 8 — `CapturePage.tsx` (se necessário): propagar tipagem

Verificar se `CapturePage.tsx` usa `CompareResult` para o `navigate` state — atualizar para `CompareWithConsistency`.

---

## Arquivos Afetados

| Arquivo | Ação |
|---|---|
| `backend/app/vision/services/fingerprint.py` | Adicionar `generate_baseline_group_id()` |
| `backend/app/vision/routers/full_pipeline.py` | Salvar `baseline_group_id` no sidecar |
| `backend/app/vision/routers/compare.py` | Incluir `baseline_group_id` no response |
| `frontend/src/types.ts` | Adicionar `CompareWithConsistency` |
| `frontend/src/api.ts` | `compareRuns` retorna `CompareWithConsistency`; remover type duplicado |
| `nest/src/modules/analysis/dto/analysis.dto.ts` | `CompareWithConsistencyDto` |
| `nest/src/modules/analysis/analysis.controller.ts` | Tipagem do compare endpoint |
| `frontend/src/pages/CompareResultPage.tsx` | Integrar `ConsistencyWarning` |
| `frontend/src/pages/CapturePage.tsx` | Verificar tipagem do navigate state |

---

## Critério de Aceite

- `curl POST /vision/compare` retorna `baseline_group_id_before` e `baseline_group_id_after`.
- Duas fotos com barba: `baseline_group_id` igual nas duas.
- Foto com barba vs. sem barba: `baseline_group_id` diferente.
- `CompareResultPage` exibe `ConsistencyWarning` quando `consistency_score < 0.8` ou `!is_comparable`.
- `npx tsc --noEmit` verde em frontend e nest.

---

## Recommended Execution Model

- **Model:** sonnet
- **Reason:** Escopo pequeno (8 arquivos), lógica simples de hash + wiring de componente existente, sem algoritmo novo.
