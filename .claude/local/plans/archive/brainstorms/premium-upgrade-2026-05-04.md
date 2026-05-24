---
tenant_id: "face-before-after"
project: "face-before-after"
module: "brainstorms/premium-upgrade-2026-05-04"
file_path: ".claude/plans/archive/brainstorms/premium-upgrade-2026-05-04.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  ---
tags:
  - "planning"
rag_keywords:
  - "archive"
  - "brainstorms"
  - "plans"
  - "premium"
  - "upgrade"
related_modules: []
depends_on: []
used_by: []
---
# Plan: Premium Features — Full Upgrade
**Data:** 2026-05-04

## Recommended Execution Model
- **Model:** sonnet
- **Reason:** Implementação de múltiplos arquivos frontend + backend de médio porte, sem lógica de negócio complexa nova — padrão service/component/types.

## TL;DR
Surfacear para o usuário todos os dados que o backend já computa mas não são exibidos, adicionar plano de ação detalhado por métrica (recommendations.recommend()), fluxo de comparação antes/depois, glossário interativo e radar chart. Dividido em 4 fases progressivas.

---

## Fase 1 — Tipos + Dados Existentes (zero backend novo)

### 1.1 Corrigir types.ts (adicionar campos que já estão no JSON)

Arquivo: `frontend/src/types.ts`

- Adicionar na raiz de `AnalysisResult`: `capture_confidence?: number`
- Adicionar em `first_impression`: `tags?: string[]`
- Adicionar em `top3_actions_v2[]`: `tier?: number`, `metric_key?: string`
- Adicionar em `evolution_path`: `skin_alert?: boolean`, `mutable_metrics?: string[]`
- Adicionar em `EvolutionPhase`: `confidence_score?: number`, `requires_professional?: boolean`
- Adicionar na raiz de `AnalysisResult`: `measurements?: Record<string, number | string | boolean | null>`

### 1.2 Renderizar dados ausentes em PremiumResultPage.tsx

Arquivo: `frontend/src/pages/PremiumResultPage.tsx`

- **Tags de percepção**: pill badges abaixo do `headline-text` — `first_impression.tags[]`
- **Risco principal**: card vermelho `⚠️ main_risk` abaixo do `positive_signal`
- **Tier badge nas ações**: badge ⚡Hoje / 🎯Semanas / 🏅Meses em cada `action-card`, baseado em `tier` (0/1/2)
- **Capture confidence bar**: barra de progresso "Confiança da captura: 87%" no bloco de warnings de captura, usando `capture_confidence * 100`
- **Skin alert banner**: quando `evolution_path.skin_alert === true`, mostrar banner indigo antes da seção de evolução: "🌞 Alerta de pele: SPF diário + hidratação noturna são prioritários"
- **Requires professional badge**: quando `phase.requires_professional === true`, mostrar badge "🏥 Requer avaliação profissional" no phase-card da fase 3
- **confidence_score**: mini barra de progresso no cabeçalho de cada phase-card, usando `phase.confidence_score * 100`
- **metric_label nas ações de fase**: mostrar `a.metric_label` (já tipado em EvolutionPhase.actions) como tag abaixo de cada ação
- **Mutable metrics count**: linha "X métricas mutáveis identificadas" no topo da seção de evolução, usando `evolution_path.mutable_metrics.length`

### 1.3 Assimetria regional

- Novo sub-bloco dentro da seção "Primeira Impressão" ou como seção separada
- Dados já em `measurements`: `eye_level_difference_pct_ipd`, `eye_horizontal_asymmetry_pct_ipd`, `nose_deviation_pct_ipd`, `mouth_deviation_pct_ipd`, `chin_deviation_pct_ipd`
- Renderizar como 5 barras horizontais com severityClass, ícone emoji por região

### 1.4 Card Forma Facial + Pele

- Novo bloco logo após "Primeira Impressão"
- `face_shape_label` → exibir com explicação: o que significa para corte de cabelo/barba
- `under_eye_darkness_left` + `under_eye_darkness_right` → média → card "Olheiras" com severity
- `skin_uniformity_std_lab_left` + `skin_uniformity_std_lab_right` → card "Uniformidade de pele"
- `marquardt_deviation_pct_ipd` → card em destaque: "Desvio da Máscara Áurea"

---

## Fase 2 — Backend: Recommendations + Glossário no payload

### 2.1 Adicionar recommendations ao JSON (mvp_pipeline.py)

Arquivo: `mvp_pipeline.py` — função `run()`

- Após `capture_recommendations = build_capture_recommendations(...)`, adicionar:
  ```python
  rec_plan = rec.recommend(measurements) if analysis_mode == "premium" else []
  ```
- Adicionar ao dict `result`: `'recommendations': rec_plan`

### 2.2 Novo endpoint /api/glossary

Arquivo: `api_server.py`

- `GET /api/glossary` → retorna `glossary.GLOSSARY` serializado como JSON
- Não requer parâmetros

### 2.3 Novos tipos para recommendations e glossary

Arquivo: `frontend/src/types.ts`

```typescript
type RecommendationAction = {
  tipo: string; // "habito" | "postura" | "exercicio" | "profissional"
  titulo: string;
  descricao: string;
  frequencia: string;
  fonte?: { titulo: string; url: string };
};

type MetricRecommendation = {
  metric_key: string;
  metric_label: string;
  severity: string;
  value: any;
  ideal: string;
  what_is: string;
  how_measured: string;
  why_matters: string;
  actions: RecommendationAction[];
  references: { titulo: string; url: string }[];
};

type GlossaryTerm = {
  termo: string;
  unidade: string;
  descricao: string;
  como_medido: string;
  faixas: string;
  problemas_comuns: string[];
  referencias: { titulo: string; url: string }[];
};
```

Adicionar em `AnalysisResult`: `recommendations?: MetricRecommendation[]`

### 2.4 Fetch glossário em PremiumResultPage

- `useEffect` que chama `GET /api/glossary` ao montar o componente
- Guarda em state local `glossary: Record<string, GlossaryTerm>`
- Usado na seção de Glossário (Fase 3)

---

## Fase 3 — Novas seções na UI

### 3.1 Plano Detalhado por Métrica

Arquivo: `frontend/src/pages/PremiumResultPage.tsx`

- Nova seção "🎯 Plano de Ação Detalhado" abaixo de "Top 3 Ações"
- Renderizar apenas métricas com severity != "excelente" de `recommendations[]`
- Cada métrica: `<details>` expansível com:
  - Header: `metric_label` + severity pill
  - Corpo: `what_is`, `why_matters`, lista de `actions` com tipo/título/frequência
  - Rodapé: `references[]` como links `<a target="_blank" rel="noopener noreferrer">`
- Dependência: Fase 2.1

### 3.2 Radar Chart SVG (Percepção Visual)

Arquivo: `frontend/src/pages/PremiumResultPage.tsx`

- Novo componente `<RadarChart scores={{ dominance, attractiveness, freshness }} />`
- SVG puro, triângulo equilateral com 3 eixos 0–10
- Plotar ponto e área preenchida em `rgba(99,102,241,0.3)`
- Substituir ou complementar as 3 barras lineares atuais
- Sem deps externas (só React + SVG)

### 3.3 Glossário interativo

Arquivo: `frontend/src/pages/PremiumResultPage.tsx`

- Nova seção colapsável no rodapé: "📖 Glossário de Métricas"
- Cada termo: `<details>` com `termo + descricao + como_medido + faixas + problemas_comuns + referencias`
- Dependência: Fase 2.2 + 2.4

---

## Fase 4 — Fluxo Antes/Depois

### 4.1 Função compare_json() em compare_report.py

Arquivo: `compare_report.py`

- Nova função `compare_json(report_before, report_after)` → `dict`
- Retorna delta estruturado:
  ```python
  {
    "score_before": int, "score_after": int, "score_delta": int,
    "tier_before": str, "tier_after": str,
    "metrics": [{"key": str, "label": str, "before": float, "after": float, "delta": float, "improved": bool}],
    "improved_count": int, "worsened_count": int,
    "top_improvements": [...],  # 3 métricas com maior delta positivo
    "top_regressions": [...]    # 3 métricas com maior delta negativo
  }
  ```

### 4.2 Novo endpoint /api/compare

Arquivo: `api_server.py`

- `POST /api/compare` com body `{ "run_id_before": str, "run_id_after": str }`
- Lê os JSONs salvos em `resultado_api/{run_id}/`
- Chama `compare_report.compare_json()`
- Retorna delta estruturado

### 4.3 Comparação no CapturePage (modo "2 fotos")

Arquivo: `frontend/src/pages/CapturePage.tsx`

- Adicionar 3ª opção de modo: `"compare"` em `AnalyzeMode`
- No modo compare: upload de 2 arquivos (Foto Antes + Foto Depois)
- `submit()` analisa as 2 fotos sequencialmente, guarda `run_id_before` e `run_id_after`, chama `/api/compare`
- Navega para `/resultado/compare` com `{ compareResult }` em state

### 4.4 Nova CompareResultPage

Arquivo: `frontend/src/pages/CompareResultPage.tsx` (arquivo novo)

- Seções:
  1. **Score Δ Hero**: dois ScoreArc lado a lado (antes/depois) + seta delta
  2. **Resumo**: `improved_count` vs `worsened_count` cards
  3. **Top melhorias**: 3 métricas com maior progresso positivo
  4. **Top regressões**: 3 métricas que pioraram (se houver)
  5. **Tabela completa**: todas as métricas comparadas

### 4.5 Rota + tipo

Arquivo: `frontend/src/App.tsx` — adicionar `<Route path="/resultado/compare" element={<CompareResultPage />} />`

Arquivo: `frontend/src/types.ts` — adicionar `AnalyzeMode = "free" | "premium" | "compare"` e `CompareResult` type

---

## Arquivos modificados

| Arquivo | Fases |
|---------|-------|
| `frontend/src/types.ts` | 1.1, 2.3, 4.5 |
| `frontend/src/pages/PremiumResultPage.tsx` | 1.2, 1.3, 1.4, 3.1, 3.2, 3.3 |
| `frontend/src/pages/CapturePage.tsx` | 4.3 |
| `frontend/src/App.tsx` | 4.5 |
| `mvp_pipeline.py` | 2.1 |
| `api_server.py` | 2.2, 4.2 |
| `compare_report.py` | 4.1 |
| `frontend/src/pages/CompareResultPage.tsx` | 4.4 (arquivo novo) |
| `frontend/src/api.ts` | 2.4, 4.2 |

---

## Dependências entre fases

- Fase 1 → independente, pode iniciar imediatamente
- Fase 2 → independente de Fase 1 (backend puro), pode iniciar em paralelo
- Fase 3.1 → depende de Fase 2.1 (recommendations no payload)
- Fase 3.2 → independente
- Fase 3.3 → depende de Fase 2.2 + 2.4
- Fase 4 → independente das demais (novo fluxo isolado)

---

## Verificação

### Fase 1
- Analisar uma foto premium e inspecionar `result.tags`, `result.capture_confidence`, `result.evolution_path.skin_alert`, `result.top3_actions_v2[0].tier` no DevTools
- Ver que a UI renderiza tags pills, tier badge nas ações, barra de confiança, alerta de pele

### Fase 2
- `curl http://localhost:9015/api/glossary` retorna JSON com 15 termos
- `result.recommendations` tem ≥1 item com `what_is`, `actions` e `references` preenchidos

### Fase 3
- Seção "Plano Detalhado" aparece apenas para métricas não-excelentes
- RadarChart renderiza sem erro em todos os scores (incluindo undefined → 0)
- Glossário abre/fecha corretamente; links de referência abrem em nova aba

### Fase 4
- Upload de 2 fotos em modo compare → 2 run_ids criados → `/api/compare` retorna `score_delta`
- `CompareResultPage` mostra os 2 arcos de score lado a lado

---

## Escopo excluído (deliberado)

- Nenhuma IA generativa de imagem
- Nenhuma autenticação / pagamentos (produto usa pay-per-use externo)
- Nenhuma persistência de histórico além dos arquivos em `resultado_api/`
- Sem internacionalização (somente português)
