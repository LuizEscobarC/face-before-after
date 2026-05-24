---
tenant_id: "face-before-after-frontend"
project: "face-before-after-frontend"
module: "frontend/data-flow"
file_path: ".claude/local/context/frontend/data-flow.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Mapa de origem de cada campo visual do PremiumResultPage: documenta como o JSON
  AnalysisResult de POST /v1/vision/full-pipeline alimenta OverlayLayer, MetricsMapLayer,
  IdealProportionsLayer e OverlaySidebar. Resolve a dúvida "de onde vem este overlay" em
  bugs de renderização ligando campo do JSON ao arquivo backend que o produz.
tags:
  - "frontend"
  - "data-flow"
  - "overlays"
  - "analysis-result"
rag_keywords:
  - "AnalysisResult JSON contract"
  - "overlay_annotations payload"
  - "metric_evaluations improvement_vector"
  - "canonical_url Frankfort alignment"
  - "region_adherence derivation"
  - "buildRegionAdherence helper"
related_modules: []
depends_on: []
used_by: []
---
# Fluxo de Dados — Backend → Componentes

**Última revisão:** 2026-05-12

---

## Pipeline completo

```
POST /v1/vision/full-pipeline
    └─ backend processa imagem → landmarks → métricas → scores
    └─ retorna AnalysisResult JSON

PremiumResultPage (recebe via router state)
    ├── result.overlay_annotations  → OverlaySidebar, MetricsMapLayer, IdealProportionsLayer
    ├── result.landmarks[]          → OverlayLayer (SVG geométrico)
    ├── result.metric_evaluations[] → OverlaySidebar (metrics_map), MetricsMapLayer
    ├── result.region_adherence[]   → buildRegionAdherence() → MetricsMapLayer + OverlaySidebar
    └── result.canonical_url        → <img> base de todos os overlays
```

---

## Origem de cada campo visual

| O que aparece na tela | Campo no JSON | Quem o produz (backend) |
|---|---|---|
| Linhas dos terços faciais (SVG) | `landmarks[]` | `app/vision/mediapipe_mesh.py` |
| Labels dos terços (sidebar) | `overlay_annotations.grid_thirds` | `app/services/overlays/annotations.py` |
| Regiões do mapa de métricas (SVG) | `overlay_annotations.metrics_map.regions[]` | `annotations.build_metrics_map_metadata()` |
| % aderência por região (sidebar) | `region_adherence[]` ou derivado de `metric_evaluations` | `app/domain/pipeline.py` |
| Zonas de proporções ideais (SVG) | `overlay_annotations.ideal_proportions_zones.zones[]` | `annotations.build_ideal_proportions_zones()` |
| Setas de melhoria (SVG) | `metric_evaluations[].improvement_vector_x/y` + `anchor_landmark_index` | `app/services/scoring/improvement_vectors.py` |
| Análise de assimetria (SVG) | `overlay_annotations.asymmetry_analysis` | `app/services/overlays/asymmetry.py` |
| Imagem base | `canonical_url` | `app/domain/pipeline.py` (salva após Frankfort alignment) |

---

## Espaço de coordenadas

Tudo que envolve posição visual usa **espaço natural-pixel** do `canonical.jpg`:

```
canonical.jpg (ex: 1200×800 px)
    ↓ mesmo espaço
landmarks[]              (coordenadas px do canonical.jpg)
overlay_annotations.*    (rect, bounds em px do canonical.jpg)
    ↓ SVG viewBox = "0 0 1200 800"
    ↓ SVG width/height = "100%" (CSS → escala automática)
Renderizado na tela
```

**Regra:** nunca misturar CSS pixels com natural pixels em cálculos de coordenadas SVG.

---

## `AnalysisResult` — campos mais usados pelos overlays

```ts
type AnalysisResult = {
  canonical_url?:         string                          // imagem base
  landmarks?:             Array<[number, number]>         // 478 pontos MediaPipe
  landmarks_ideal?:       Array<[number, number]>         // wireframe ideal (Task 4, M3.5)
  metric_evaluations?:    MetricEvaluationResult[]        // avaliação por métrica
  region_adherence?:      Array<{region, adherence, confidence}>
  overlay_annotations?:   { ... }                         // ver overlay-system.md §2a
}
```

## `MetricEvaluationResult` — campos usados no overlay

```ts
type MetricEvaluationResult = {
  metric_id:              string
  region:                 string          // chave de agrupamento no sidebar
  severity_5:             string | null   // ideal | mild | moderate | strong | extreme
  deviation_normalized:   number | null   // em σ (desvio-padrão); exibido como ±Xσ
  confidence_final:       number | null   // usado no peso de buildRegionAdherence
  improvement_vector_x:   number | null   // ICU (intercanthal units)
  improvement_vector_y:   number | null   // ICU; positivo = para baixo
  anchor_landmark_index:  number | null   // índice MediaPipe-478 do ponto âncora da seta
}
```

---

## Prop drilling em `PremiumResultPage`

`PremiumResultPage` não usa Context API — props são passadas diretamente.

```
PremiumResultPage
├── estado: activeOverlays, selectedRegion, selectedIdealMetric, selectedMetrics
│
├─→ OverlayLayer
│       props: landmarks, viewBoxWidth, viewBoxHeight, activeOverlays, selectedRegion
│
├─→ MetricsMapLayer
│       props: landmarks, viewBoxWidth, viewBoxHeight,
│              overlay_metrics_map, activeOverlays,
│              metric_evaluations, selectedRegion
│
├─→ IdealProportionsLayer
│       props: landmarks, viewBoxWidth, viewBoxHeight,
│              rows (ideal_proportions[]), overlay_zones,
│              selectedKey (selectedIdealMetric)
│
├─→ AsymmetryAnalysisLayer
│       props: viewBoxWidth, viewBoxHeight, data (asymmetry_analysis)
│
└─→ OverlaySidebar
        props: variant, data (overlay_annotations), regionAdherence,
               selectedKey, onSelectKey, metricEvaluations,
               selectedMetrics, onChangeMetrics
```

---

## Referências

- Tipos completos: `frontend/src/types.ts`
- Sistema de overlays: [`overlay-system.md`](./overlay-system.md)
- Módulos backend de annotations: `backend/app/services/overlays/annotations.py`
