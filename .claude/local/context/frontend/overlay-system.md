---
tenant_id: "face-before-after-frontend"
project: "face-before-after-frontend"
module: "frontend/overlay-system"
file_path: ".claude/local/context/frontend/overlay-system.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Arquitetura PLAN_A unified (commit b50b81e): dois sistemas paralelos sobre a mesma
  canonical_url — SVG Layer geométrico (OverlayLayer, MetricsMapLayer,
  IdealProportionsLayer, AsymmetryAnalysisLayer) e Sidebar textual (OverlaySidebar) —
  ambos alimentados pelo mesmo AnalysisResult com overlay_annotations pré-formatado
  pelo backend. Estado de orquestração vive em PremiumResultPage.
tags:
  - "frontend"
  - "overlays"
  - "svg"
  - "premium-result"
rag_keywords:
  - "PLAN_A unified overlay refactor"
  - "OverlayLayer SVG geometric"
  - "MetricsMapLayer regions adherence"
  - "IdealProportionsLayer zones"
  - "AsymmetryAnalysisLayer Frankfort midline"
  - "OverlaySidebar textual annotations"
  - "centralized backend overlay_annotations"
related_modules: []
depends_on: []
used_by: []
---
# Sistema de Overlays — Documentação Técnica

**Última revisão:** 2026-05-12  
**Commit de referência:** `b50b81e` (PLAN_A unified)

---

## 1. Visão Geral

Dois sistemas paralelos montados sobre a mesma imagem canônica:

```
canonical_url (imagem base)
    ├── SVG Layer (geométrico)   → OverlayLayer, MetricsMapLayer, IdealProportionsLayer, AsymmetryAnalysisLayer
    └── Sidebar (textual)        → OverlaySidebar
```

Ambos são alimentados pelos **mesmos dados do backend** (`AnalysisResult`), mas são componentes independentes. O estado que os conecta vive em `PremiumResultPage`.

---

## 2. Dados do Backend

`AnalysisResult` (types.ts) carrega os dados em dois blocos:

### 2a. `overlay_annotations` — dados pré-formatados para display

```ts
overlay_annotations?: {
  grid_thirds?:              { ideal_pct, rows[{id, label, pct, deviation_pct, severity_5}], legend }
  grid_fifths?:              { rows[{id, deviation_px}], legend }
  face_extents?:             { trichion_source, trichion_label, menton_label, face_height_px, face_width_px, legend }
  ideal_proportions?:        Array<{ metric_id, value, severity_5, direction }>
  ideal_proportions_zones?:  { zones: Array<{ metric_id, rect:{x,y,w,h}, severity_5, direction }> }
  metrics_map?:              { regions: Array<{ region, bounds:{x,y,w,h}, adherence, confidence }> }
  asymmetry_analysis?:       { image_size, frankfort_horizontal, facial_midline, deviations[], overall_asymmetry_score }
}
```

Esses campos são **computados no backend** a partir dos landmarks, nunca hardcoded no frontend.

### 2b. `metric_evaluations[]` — camada analítica bruta

Cada entrada tem: `metric_id`, `region`, `severity_5`, `deviation_normalized`, `improvement_vector_x/y`, `anchor_landmark_index`, `confidence_final`.

Usado pelo sidebar (`metrics_map` variant) e pelo `MetricsMapLayer` para colorir regiões.

### 2c. `landmarks[]` — coordenadas pixel dos 478 landmarks MediaPipe

Espaço: pixels naturais do `canonical.jpg`. Usados diretamente pelos componentes SVG.

### 2d. `region_adherence[]` — aderência por região (0..1)

Se ausente, `buildRegionAdherence()` em `PremiumResultPage` deriva da `metric_evaluations[]` via média ponderada por `confidence_final`.

---

## 3. Componentes SVG

### `OverlayLayer.tsx`

Renderiza os overlays geométricos clássicos via `<svg width="100%" height="100%" viewBox="0 0 {vbW} {vbH}">`.

**Regra crítica de coordenadas:**
- Landmarks: espaço natural-pixel (coordenadas do canonical.jpg)
- `viewBox`: sempre em espaço natural (`vbW × vbH`)
- `width/height` do SVG: sempre `"100%"` (nunca pixels fixos)
- Endpoints de linhas: devem usar `vbW/vbH`, **nunca** CSS pixels `w/h`

**Sub-componentes internos:**

| Componente | O que desenha |
|---|---|
| `OutlineFace` | Polígono do contorno facial (37 pts). Pontos `LM_FOREHEAD_RIDGE` (12 idx) nivelados ao `trichion_y` para evitar o "chifre" |
| `GridThirds` | 2 linhas horizontais dividindo face em 3 terços |
| `GridFifths` | Linhas tracejadas (ideal) + sólidas laranja (posição real dos olhos) |
| `AxisVertical` | Linha de simetria: média entre midpoint intercantal e nariz |
| `AxisIntercanthal` | Linha horizontal entre cantos internos dos olhos |
| `ImprovementVectors` | Setas do anchor_landmark → anchor + offset (ICU × ICD pixels) |

### `MetricsMapLayer.tsx`

Desenha regiões faciais (retângulos/polígonos) coloridas por aderência.

- **Fonte de geometria:** `overlay_annotations.metrics_map.regions[]` (backend, dinâmico)
- **Fallback:** `REGION_BOUNDS_FALLBACK` (hardcoded, mantido para compatibilidade)
- **Coloração:** `adherence` → verde ≥ 0.9 / amarelo ≥ 0.7 / vermelho < 0.7
- **Highlight:** prop `selectedRegion` — região selecionada recebe borda ciano mais espessa

### `IdealProportionsLayer.tsx`

Desenha zonas retangulares das proporções ideais sobre a imagem.

- **Fonte de geometria:** `overlay_annotations.ideal_proportions_zones.zones[]` (backend)
- Colorido por `severity_5` de cada zona

### `AsymmetryAnalysisLayer.tsx`

SVG de análise de assimetria.

- Usa `overlay_annotations.asymmetry_analysis`
- Desenha: linha de Frankfort, linha de simetria facial, marcadores de desvio por landmark

---

## 4. `OverlaySidebar.tsx`

Painel textual renderizado ao lado (não sobre) a imagem. Puro display — sem fetch, sem efeitos.

### Interface

```ts
interface Props {
  variant:            "grid_thirds" | "grid_fifths" | "face_extents" | "ideal_proportions" | "metrics_map"
  data:               AnalysisResult["overlay_annotations"]  // slice completo
  selectedKey?:       string | null      // chave selecionada (cross-highlight)
  onSelectKey?:       (key: string) => void
  regionAdherence?:   Array<{ region, adherence, confidence }>
  metricEvaluations?: MetricEvaluationResult[]
  selectedMetrics?:   string[] | null    // filtro de métricas
  onChangeMetrics?:   (ids: string[] | null) => void
}
```

### Switch de variants

```ts
switch (variant) {
  case "grid_thirds":       renderGridThirds(data.grid_thirds)
  case "grid_fifths":       renderGridFifths(data.grid_fifths)
  case "face_extents":      renderFaceExtents(data.face_extents)
  case "ideal_proportions": renderIdealProportions(data.ideal_proportions, selectedKey, onSelectKey)
  case "metrics_map":       renderMetricsMap(regionAdherence, selectedKey, onSelectKey,
                                             metricEvaluations, selectedMetrics, onChangeMetrics)
}
```

### Variant `metrics_map` — detalhe

É a variant mais complexa:
1. Renderiza dropdown de filtro (`MetricsMapFilterPanel`) quando `metricEvaluations` disponível
2. Ordena regiões por `REGION_ORDER` canônica
3. Para cada região: header com % aderência + sub-rows de métricas (agrupadas por `m.region`)
4. Regiões sem métricas visíveis ficam com `opacity: 0.35` (dimmed, não removidas)
5. Clique em região: dispara `onSelectKey(region)` → cross-highlight no SVG

### Mapa backend field → display

| Campo backend | O que o sidebar exibe |
|---|---|
| `grid_thirds.rows[i].severity_5` | Cor de fundo e texto do row |
| `grid_thirds.rows[i].pct` | Percentual principal |
| `grid_thirds.rows[i].deviation_pct` | Desvio com sinal (+/-) |
| `metric_evaluations[i].deviation_normalized` | Sub-row: `±Xσ` |
| `metric_evaluations[i].severity_5` | Cor da borda esquerda da sub-row |
| `region_adherence[i].adherence` | `%` na região (0→1 escalado para 0→100) |
| `region_adherence[i].confidence` | Sub-label "Confiança XX%" |

---

## 5. Cross-Highlight — Mecanismo

Estado compartilhado em `PremiumResultPage`. O sidebar e o SVG não se conhecem.

```
Clique no sidebar (ex: "Nariz")
    → onSelectKey("nose")
    → setSelectedRegion("nose")       [estado na página]
    → MetricsMapLayer recebe selectedRegion="nose"
    → SVG destaca polígono nose com borda ciano
```

Toggle: segundo clique na mesma chave → `null` (deseleciona).

```tsx
onSelectKey={(key) => setSelectedRegion(prev => prev === key ? null : key)}
```

Dois estados independentes por view:
- View `metrics_map` / `landmarks`: `selectedRegion`
- View `ideal_proportions` / `ideal`: `selectedIdealMetric`

---

## 6. Filtro de Métricas

`selectedMetrics: string[] | null` no estado de `PremiumResultPage`.

- `null` → mostra todas
- `["jaw_width", "nose_tip_projection"]` → mostra só essas

Controlado por `MetricsMapFilterPanel` (dropdown multi-select). Passado via prop para `OverlaySidebar` (afeta sub-rows visíveis e opacity das regiões) e para `MetricsMapLayer` (afeta quais setas de improvement vector são desenhadas).

---

## 7. Montagem em `PremiumResultPage`

### Views e o que montam

| View | SVG Layer | Sidebar |
|---|---|---|
| `overlays` | `OverlayLayer` (grid_thirds/fifths/face_extents/heatmap) | `OverlaySidebar` por overlay ativo |
| `ideal` | `IdealProportionsLayer` | `OverlaySidebar` variant `ideal_proportions` |
| `landmarks` | `MetricsMapLayer` + `AsymmetryAnalysisLayer` | `OverlaySidebar` variant `metrics_map` |
| `before_ideal` | `BeforeIdealOverlay` | — |
| `compare` | — | — |

### Condicional de montagem dos sidebars (view `overlays`)

```tsx
{activeOverlays.includes("grid_thirds")   && <OverlaySidebar variant="grid_thirds" ... />}
{activeOverlays.includes("grid_fifths")   && <OverlaySidebar variant="grid_fifths" ... />}
{activeOverlays.includes("face_extents")  && <OverlaySidebar variant="face_extents" ... />}
{activeOverlays.includes("metrics_map")   && <OverlaySidebar variant="metrics_map" ... />}
```

`activeOverlays: string[]` é controlado pelo `OverlayToggleBar` (botões de toggle).

---

## 8. `buildRegionAdherence()` — derivação de fallback

```ts
// PremiumResultPage.tsx:44
function buildRegionAdherence(result?: AnalysisResult) {
  // Prioridade 1: campo direto do backend
  if (result.region_adherence?.length > 0) return result.region_adherence;

  // Fallback: calcula de metric_evaluations
  // adherence = 1 - min(1, |deviation_normalized|)
  // weight    = confidence_final
  // resultado = média ponderada por região
}
```

---

## 9. Referências

- Audit completo de bugs e fixes: [`.claude/face-analysis/08-svg-overlays.md`](../../face-analysis/08-svg-overlays.md)
- Tipos TypeScript: `frontend/src/types.ts` — `AnalysisResult`, `MetricEvaluationResult`
- CSS do layout: [`layout-css.md`](./layout-css.md)
- Fluxo de dados detalhado: [`data-flow.md`](./data-flow.md)
