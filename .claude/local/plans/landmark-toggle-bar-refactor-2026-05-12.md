# Plan: Refatorar view "landmarks" com LandmarkToggleBar

**Data:** 2026-05-12  
**Módulo:** frontend/overlays  
**Tipo:** refactor  

## Contexto

A view "Mapa de métricas" (view="landmarks") usava um dropdown de filtro de métricas (`MetricsMapFilterPanel`) e um `OverlaySidebar variant="metrics_map"` no sidebar esquerdo. O padrão adotado nas outras views é o `OverlayToggleBar` — botões individuais por camada SVG. Essa refatoração alinha a view "landmarks" ao mesmo padrão.

## Passos executados

1. **Deletado** `frontend/src/components/MetricsMapFilterPanel.tsx`
2. **Limpo** `OverlaySidebar.tsx` — removidas props `selectedMetrics`, `onChangeMetrics`, `compact` e toda lógica de dropdown/filtro
3. **Adicionado** `LandmarkToggleBar` em `OverlayLayer.tsx`:
   - Constante `LANDMARKS_OVERLAY_LABELS` com 5 camadas: `metrics_regions`, `asymmetry_midline`, `asymmetry_frankfort`, `asymmetry_points`, `asymmetry_scores`
   - Constante `DEFAULT_LANDMARKS_OVERLAYS = ["metrics_regions", "asymmetry_midline", "asymmetry_frankfort"]`
   - Componente `LandmarkToggleBar` seguindo o mesmo padrão visual do `OverlayToggleBar`
4. **Modificado** `AsymmetryAnalysisLayer.tsx` — prop `activeOverlays?: string[]`; cada camada SVG (frankfort, midline, points, scores) renderiza condicionalmente
5. **Refatorado** `PremiumResultPage.tsx`:
   - Removido state `selectedMetrics`
   - Adicionado state `activeLandmarkOverlays` com default `DEFAULT_LANDMARKS_OVERLAYS`
   - Handler `handleLandmarkToggle`
   - Sidebar left view="landmarks": `OverlaySidebar metrics_map` → `LandmarkToggleBar`
   - `AsymmetryAnalysisLayer` recebe `activeOverlays={activeLandmarkOverlays}`
   - `MetricsMapLayer` condicional em `activeLandmarkOverlays.includes("metrics_regions")`
   - Removidas ambas as montagens de `OverlaySidebar variant="metrics_map"` (sidebar left + view overlays)

## Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `frontend/src/components/MetricsMapFilterPanel.tsx` | Deletado |
| `frontend/src/components/OverlaySidebar.tsx` | Removidas props de filtro |
| `frontend/src/components/OverlayLayer.tsx` | Adicionado `LandmarkToggleBar`, constantes |
| `frontend/src/components/AsymmetryAnalysisLayer.tsx` | Adicionada prop `activeOverlays` |
| `frontend/src/pages/PremiumResultPage.tsx` | Refatorado estado e wiring |

## Verificação

```bash
cd frontend && npm run build  # zero erros ✅
```

## Recommended Execution Model

`sonnet`
