---
tenant_id: "face-before-after"
project: "face-before-after"
module: "frontend/task-landmark-toggle-bar-refactor-2026-05-12.prompt"
file_path: ".claude/local/prompts/frontend/task-landmark-toggle-bar-refactor-2026-05-12.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Módulo: frontend/overlays Tipo: refactor Data: 2026-05-12 Plano: .claude/local/plans/landmark-toggle-bar-refactor-2026-05-12.md Modelo recomendado: sonnet
tags:
  - "task-prompt"
  - "landmark"
  - "frontend"
rag_keywords:
  - "MediaPipe FaceMesh"
  - "dlib 68 landmarks"
  - "frontend"
  - "landmark"
  - "local"
  - "prompt"
  - "prompts"
  - "refactor"
  - "toggle"
related_modules: []
depends_on: []
used_by: []
---
# Task: Refatorar view "landmarks" com LandmarkToggleBar

**Módulo:** frontend/overlays  
**Tipo:** refactor  
**Data:** 2026-05-12  
**Plano:** `.claude/local/plans/landmark-toggle-bar-refactor-2026-05-12.md`  
**Modelo recomendado:** sonnet  

## Objetivo

Substituir o `MetricsMapFilterPanel` (dropdown de filtro) e o `OverlaySidebar variant="metrics_map"` da view "landmarks" por um `LandmarkToggleBar` — botões individuais por camada SVG, padrão idêntico ao `OverlayToggleBar` das outras views.

## Camadas a controlar

| key | Descrição |
|-----|-----------|
| `metrics_regions` | Regiões de métricas (MetricsMapLayer) |
| `asymmetry_midline` | Linha mediana facial |
| `asymmetry_frankfort` | Frankfort Horizontal |
| `asymmetry_points` | Pontos de desvio de assimetria |
| `asymmetry_scores` | Score box de assimetria |

Defaults ativos: `metrics_regions`, `asymmetry_midline`, `asymmetry_frankfort`.

## Passos

1. Deletar `frontend/src/components/MetricsMapFilterPanel.tsx`
2. Limpar `OverlaySidebar.tsx`: remover props `selectedMetrics`, `onChangeMetrics`, `compact` e toda lógica de filtro
3. Em `OverlayLayer.tsx`: exportar `LANDMARKS_OVERLAY_LABELS`, `DEFAULT_LANDMARKS_OVERLAYS`, `LandmarkToggleBar`
4. Em `AsymmetryAnalysisLayer.tsx`: adicionar `activeOverlays?: string[]`; tornar cada camada SVG condicional
5. Em `PremiumResultPage.tsx`:
   - Remover `selectedMetrics` state
   - Adicionar `activeLandmarkOverlays` state + `handleLandmarkToggle`
   - Sidebar left view="landmarks": montar `LandmarkToggleBar`
   - `AsymmetryAnalysisLayer`: passar `activeOverlays`
   - `MetricsMapLayer`: condicionar em `activeLandmarkOverlays.includes("metrics_regions")`; remover `selectedMetrics`
   - Remover ambas as instâncias de `OverlaySidebar variant="metrics_map"`
6. `npm run build` — verificar zero erros

## Verificação

```bash
cd frontend && npm run build
# Esperado: zero erros TypeScript e Vite build OK
```
