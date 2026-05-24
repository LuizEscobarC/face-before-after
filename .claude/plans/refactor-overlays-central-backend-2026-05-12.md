# Plano Refator: Centralizar Backend Data para Overlays

**Data:** 2026-05-12  
**Objetivo:** Todos os overlays seguem o Padrão 3: backend emite JSON puro com coordenadas/labels, frontend renderiza SVG. Nenhuma imagem sai do backend com texto ou linhas queimadas via OpenCV.

---

## Mapa dos 4 Padrões (estado real)

| # | Componente / View | Backend hoje | Frontend hoje | Status | Plano |
|---|---|---|---|---|---|
| **3 ✅** | OverlaySidebar | JSON `overlay_annotations.*` | React + CSS | Correto | — |
| **1 ⚠️** | IdealProportionsLayer | `ideal_proportions_zones` JSON (backend pronto) | Hardcoded `ZONES` + `createAnatomicalZones()` — ignora backend | Backend OK, frontend pendente | **PLAN_A.2** |
| **2 ⚠️** | MetricsMapLayer | `overlay_annotations.metrics_map` JSON | Prefere backend, fallback hardcoded — sem filtro por métrica individual | Falta seletor por métrica | **PLAN_D** |
| **4 ❌** | View "landmarks" | `*_mvp_annotated.jpg` — Frankfort, midline, dots, desvios **queimados via OpenCV** | Exibe a PNG como imagem | Errado | **PLAN_B** |

---

## Evidência do Problema (Padrão 4)

### GET /v1/vision/results/{run_id}/annotated

Serve `*_mvp_annotated.jpg` — imagem gerada por `face_asymmetry.py:draw_annotations()` com OpenCV.

**O que está queimado na imagem:**

| Elemento | Cor | Técnica |
|---|---|---|
| 478 landmarks (pontos verdes) | `(0,255,0)` | `cv2.circle()` raio 2 |
| Frankfort Horizontal (linha + label) | `(0,255,255)` amarelo | `cv2.line()` + `_put_text_with_background()` |
| Facial Midline (linha vertical + label) | `(255,0,0)` azul | `cv2.line()` + `_put_text_with_background()` |
| 5 desvios (nose, chin, lip, mouth×2) | `(0,0,255)` vermelho | `cv2.line()` + `cv2.circle()` + texto |
| Caixa "Asymmetry Analysis" | texto branco / fundo preto | `_put_text_with_background()` canto superior |

**Onde é usada no frontend:**
- `PremiumResultPage.tsx` view `"landmarks"` usa `annotatedUrl` = `/v1/vision/results/{run_id}/annotated` como `<img src=...>` de fundo
- Não há nenhuma SVG layer sobre essa imagem — o que o usuário vê É a PNG com texto queimado

**O que deveria ser:**
- Fundo: `/v1/vision/results/{run_id}/canonical` (imagem limpa)
- Overlay: `<AsymmetryAnalysisLayer>` — componente SVG novo
- Dados: `overlay_annotations.asymmetry_analysis` JSON emitido pelo backend

---

## Histórico: O que foi feito

- ✅ **PLAN_A.1** — `build_ideal_proportions_zones()` e `build_metrics_map_metadata()` em `annotations.py`; emitidos em `pipeline.py`
- ✅ **PLAN_A.3** — `MetricsMapLayer.tsx` consome `overlay_annotations.metrics_map` com fallback
- ✅ **PLAN_A.4** — `simulate.py` retorna `ideal_proportions: None` (PNG deprecated)
- ✅ **Bug fix (2026-05-12)** — `pipeline.py:build_shareable_report()` crashava com `os.path.basename(None)`

---

## Planos Restantes

### PLAN_A.2 — Frontend IdealProportionsLayer (pendente)

**Problema:** `IdealProportionsLayer.tsx` ainda usa `const ZONES` hardcoded e `createAnatomicalZones()` para geometria. Não consome `overlay_annotations.ideal_proportions_zones` mesmo que o backend já emita.

**Tarefas:**

1. `IdealProportionsLayer.tsx` — adicionar prop:
   ```ts
   overlay_zones?: { zones: Array<{ metric_id: string; rect: { x: number; y: number; w: number; h: number }; severity_5?: string; direction?: string }> }
   ```
2. No `useMemo()`: se `overlay_zones` disponível → montar `zonesByMetric` direto; senão → fallback para `createAnatomicalZones()` + `ZONES` hardcoded
3. `PremiumResultPage.tsx` → passar `overlay_zones={result.overlay_annotations?.ideal_proportions_zones}`

**Files:**
- `frontend/src/components/IdealProportionsLayer.tsx`
- `frontend/src/pages/PremiumResultPage.tsx`

**Esforço:** ~1.5h

---

### PLAN_B — Asymmetry Analysis: JSON + SVG (novo)

**Objetivo:** Eliminar `*_mvp_annotated.jpg` como output primário da pipeline. Todos os dados visuais de assimetria (Frankfort, midline, desvios, landmarks) saem como JSON em `overlay_annotations.asymmetry_analysis`. O frontend renderiza SVG.

#### PLAN_B.1 — Backend: `build_asymmetry_analysis_annotations()`

**Arquivo:** `backend/app/services/overlays/annotations.py`

**Função nova:**
```python
def build_asymmetry_analysis_annotations(
    landmarks: np.ndarray,         # 478×2 float32
    asymmetry_measurements: dict,  # output de analyzer.measure_asymmetry()
    image_size: tuple[int, int],   # (width, height) da canonical
) -> dict:
```

**Output JSON:**
```json
{
  "frankfort_horizontal": {
    "y": 245.3,
    "eye_left": {"x": 180.5, "y": 245.3},
    "eye_right": {"x": 420.2, "y": 245.3}
  },
  "facial_midline": {
    "x_top": 300.5, "y_top": 80.0,
    "x_bottom": 295.3, "y_bottom": 480.0
  },
  "deviations": [
    { "label": "Ponta do nariz", "landmark_idx": 4, "x": 305.2, "y": 280.1, "deviation_px": 4.7 },
    { "label": "Mento",         "landmark_idx": 152, "x": 302.1, "y": 420.3, "deviation_px": 2.1 },
    { "label": "Lábio superior","landmark_idx": 13, "x": 303.8, "y": 310.5, "deviation_px": 3.8 },
    { "label": "Canto E. boca", "landmark_idx": 61, "x": 285.2, "y": 360.1, "deviation_px": 14.8 },
    { "label": "Canto D. boca", "landmark_idx": 291, "x": 318.6, "y": 361.3, "deviation_px": 18.6 }
  ],
  "asymmetry_score": 72,
  "overall_pct_ipd": 3.2
}
```

**Pipeline integration (`pipeline.py` ~linha 1463):**
```python
result['overlay_annotations']['asymmetry_analysis'] = build_asymmetry_analysis_annotations(
    canonical.landmarks,
    asymmetry_measurements,
    image_size=(canonical.width, canonical.height),
)
```

**Deprecation:** `pipeline.py` pode parar de salvar `*_mvp_annotated.jpg` (ou manter como debug artefato, mas não usar como dado primário).

**Tarefas:**
1. [ ] Criar `build_asymmetry_analysis_annotations()` em `annotations.py`
   - Extrair Frankfort y-line dos landmarks de olho (LM_LEFT_EYE, LM_RIGHT_EYE)
   - Extrair midline (topo → mento)
   - Calcular desvios dos 5 pontos-chave em relação à midline
2. [ ] Adicionar chamada em `pipeline.py` → `overlay_annotations['asymmetry_analysis']`
3. [ ] Manter `draw_annotations()` e `*_mvp_annotated.jpg` como artefato de debug (não remover — só não usar como dado primário no frontend)

**Esforço:** ~1.5h

---

#### PLAN_B.2 — Frontend: `AsymmetryAnalysisLayer.tsx`

**Novo componente SVG** (pattern idêntico ao `IdealProportionsLayer.tsx`):

```tsx
interface AsymmetryAnalysisLayerProps {
  viewBoxWidth: number;
  viewBoxHeight: number;
  landmarks: Array<[number, number]>;        // 478 pontos
  asymmetry_analysis: OverlayAsymmetryData;  // overlay_annotations.asymmetry_analysis
  selectedPoint?: string | null;
  onSelectPoint?: (label: string) => void;
}
```

**O que renderiza (SVG puro, sem imagem):**
- `<circle>` verde (r=2) para cada um dos 478 landmarks — ou subset dos 68 principais
- `<line>` amarelo tracejado — Frankfort horizontal (`y` fixo, largura total)
- `<circle>` amarelo (r=4) nos centros dos olhos
- `<line>` azul — Facial Midline (x_top,y_top → x_bottom,y_bottom)
- Para cada desvio: `<line>` vermelho do ponto até midline + `<circle>` vermelho + `<text>` com label e valor
- `<rect>` + `<text>` — sumário "Asymmetry Analysis" no canto

**Esforço:** ~2h

---

#### PLAN_B.3 — Frontend: atualizar view "landmarks"

**Arquivo:** `frontend/src/pages/PremiumResultPage.tsx`

Substituir:
```tsx
// view "landmarks" — antes
<img src={annotatedUrl} ... />
```

Por:
```tsx
// view "landmarks" — depois
<img src={canonicalUrl} ... />
{result.overlay_annotations?.asymmetry_analysis && (
  <AsymmetryAnalysisLayer
    viewBoxWidth={dims?.naturalW || 1200}
    viewBoxHeight={dims?.naturalH || 800}
    landmarks={result.landmarks ?? []}
    asymmetry_analysis={result.overlay_annotations.asymmetry_analysis}
  />
)}
```

**Esforço:** ~0.5h

---

### PLAN_D — MetricsMapLayer: Dropdown de Seleção de Métricas + Sidebar Explicativo

**Objetivo:** O usuário pode filtrar quais métricas individuais ficam visíveis no SVG heatmap, via dropdown multi-select. O sidebar ao lado mostra as informações de cada métrica selecionada (severity, valor, desvio, label) vindas do backend.

---

#### Estado atual

- `MetricsMapLayer` renderiza **regiões** (FOREHEAD, EYES, NOSE, MOUTH, JAW) como retângulos coloridos por adherence.
- `OverlaySidebar variant="metrics_map"` lista regiões com % adherence e confidence.
- Nenhum filtro por métrica individual existe — é sempre "tudo ou nada" por região.

#### O que será adicionado

**Componente novo: `MetricsMapFilterPanel.tsx`**

UI panel com:
1. **Dropdown multi-select** — lista todas as métricas disponíveis do backend (`result.metric_evaluations`), agrupadas por região. Opções:
   - "Todas as métricas" (default)
   - Por região: checkbox group por `FOREHEAD / EYES / NOSE / MOUTH / JAW`
   - Por métrica: cada `metric_id` com seu label legível
2. **Badges de severidade** ao lado de cada métrica no dropdown (`ideal | mild | moderate | strong | extreme`)
3. **Info card** ao lado: quando uma métrica está selecionada, exibe:
   - Nome da métrica (label humanizado)
   - Valor atual vs ideal
   - Desvio normalizado
   - Severity badge colorido
   - `direction_label` (ex: "nariz muito largo" / "levemente estreito")

**Integração com `MetricsMapLayer`**

Adicionar prop:
```ts
selectedMetrics?: string[] | null   // null = todas; [] = nenhuma; ['metric_id1', ...] = filtro
```

Quando `selectedMetrics` estiver setado:
- Regiões onde NENHUMA métrica selecionada pertence ficam com opacity muito baixa (0.05)
- Regiões com pelo menos uma métrica selecionada ficam normais + marca visual (borda brilhante)
- Cada métrica selecionada pode ter um indicador de ponto no SVG (small dot/circle na posição `anchor_landmark_index` se disponível)

**Integração com `OverlaySidebar variant="metrics_map"`**

Quando uma métrica individual está selecionada, o sidebar mostra:
- Seção "Métricas selecionadas" com card detalhado por métrica (não só por região)
- Dados: `metric_id`, valor, `severity_5`, `deviation_normalized`, `direction_label`
- Fonte: `result.metric_evaluations` (já disponível)

---

#### Arquivos

| Arquivo | Mudança |
|---|---|
| `frontend/src/components/MetricsMapFilterPanel.tsx` | Novo — dropdown multi-select + info card |
| `frontend/src/components/MetricsMapLayer.tsx` | + prop `selectedMetrics`; fade regiões sem métricas selecionadas |
| `frontend/src/components/OverlaySidebar.tsx` | `renderMetricsMap()` aceita `metric_evaluations` + exibe detalhes por métrica selecionada |
| `frontend/src/pages/PremiumResultPage.tsx` | Estado `selectedMetrics`; renderiza `MetricsMapFilterPanel` acima do overlay |

---

#### UX/UI spec

```
┌─────────────────────────────────────────────────────────────────┐
│  Mapa de Métricas                          [Todas ▼]            │ ← dropdown
│  ┌──────────────────┐  ┌──────────────────────────────────────┐ │
│  │  SVG heatmap     │  │  FOREHEAD ████ 85%                   │ │ ← sidebar
│  │  (regions fade   │  │   ↳ forehead_height_ratio   +2.1pp   │ │
│  │   se não seleção)│  │   ↳ upper_third_ratio        ideal   │ │
│  │                  │  │  NOSE ████ 62%                       │ │
│  │                  │  │   ↳ nose_width_ratio    moderate ⚠️  │ │
│  └──────────────────┘  └──────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘

Dropdown aberto:
  ✅ Todas as métricas
  ── FOREHEAD ──
  ☑ forehead_height_ratio    ideal
  ☑ upper_third_ratio        ideal
  ── NOSE ──
  ☑ nose_width_ratio         moderate ⚠️
  ☑ alar_base_width          mild
  ── ... ──
```

**Interações:**
- Clicar numa região no SVG → seleciona todas as métricas daquela região no dropdown
- Clicar em métrica individual no dropdown → destaca a região correspondente no SVG
- "Todas" = nenhum filtro ativo (comportamento default atual)
- `ESC` ou click fora fecha dropdown

---

#### Esforço

| Sub-task | Esforço |
|---|---|
| `MetricsMapFilterPanel.tsx` (dropdown + info card) | ~2h |
| `MetricsMapLayer.tsx` (+`selectedMetrics` prop + fade) | ~0.5h |
| `OverlaySidebar.tsx` renderMetricsMap detalhado | ~0.5h |
| `PremiumResultPage.tsx` estado + layout | ~0.5h |
| **Total PLAN_D** | **~3.5h** |

---

### PLAN_C — Validação + Deploy

**Tarefas:**
1. [ ] `npm run build` — zero erros TypeScript
2. [ ] Smoke test: upload foto → ver view "landmarks" com SVG limpo sobre canonical
3. [ ] Smoke test: ver IdealProportionsLayer com zones do backend
4. [ ] `just frontend-deploy` (ou `docker compose up -d --build`)
5. [ ] Containers healthy — `docker compose ps`

**Esforço:** ~0.5h

---

## Agrupamento e Custo Total

| Plano | Tarefas | Esforço | Pode agrupar? |
|---|---|---|---|
| PLAN_A.2 | IdealProportionsLayer → backend zones | 1.5h | ✅ com B |
| PLAN_B.1 | Backend `build_asymmetry_analysis_annotations()` | 1.5h | ✅ com A.2 |
| PLAN_B.2 | Novo `AsymmetryAnalysisLayer.tsx` | 2h | ✅ com A.2 |
| PLAN_B.3 | PremiumResultPage view landmarks | 0.5h | ✅ trivial |
| PLAN_D | MetricsMapFilterPanel + dropdown seleção de métricas | 3.5h | ✅ com A.2+B |
| PLAN_C | Build + deploy | 0.5h | ✅ sempre último |
| **Total** | | **9.5h** | **Um único plano** |

**→ Custo ≤ 8h: agrupar tudo em um único plano de execução.**

---

## Agente Recomendado

```
Plano único (6h):
├─ Backend: build_asymmetry_analysis_annotations() em annotations.py
│            + integração em pipeline.py
├─ Frontend: AsymmetryAnalysisLayer.tsx (novo componente SVG)
│            + IdealProportionsLayer.tsx (consumir overlay_zones)
│            + PremiumResultPage.tsx (2 pequenas alterações)
└─ Validação: build + smoke test + deploy

Agente recomendado: /execute-prompt (modelo opus)
  - Motivo: task multi-arquivo (5 files), backend + frontend, requer coerência entre
    shapes de dados Python e tipos TypeScript
  - Alternativa: /full-auto-pipeline se não houver .prompt.md já criado
    └─ planner → prompt-initializer → auto-execute-prompt
```

---

## Deliverables

| Arquivo | Mudança | Status |
|---|---|---|
| `backend/app/services/overlays/annotations.py` | + `build_asymmetry_analysis_annotations()` | ❌ pendente |
| `backend/app/domain/pipeline.py` | `overlay_annotations['asymmetry_analysis']` | ❌ pendente |
| `frontend/src/components/AsymmetryAnalysisLayer.tsx` | Novo componente SVG | ❌ pendente |
| `frontend/src/components/IdealProportionsLayer.tsx` | Consome `overlay_zones` prop | ❌ pendente |
| `frontend/src/components/MetricsMapFilterPanel.tsx` | Novo — dropdown multi-select + info card de métricas | ❌ pendente |
| `frontend/src/components/MetricsMapLayer.tsx` | + prop `selectedMetrics`; fade de regiões sem seleção | ❌ pendente |
| `frontend/src/components/OverlaySidebar.tsx` | `renderMetricsMap()` com detalhes por métrica selecionada | ❌ pendente |
| `frontend/src/pages/PremiumResultPage.tsx` | `canonical` em vez de `annotated`; passa `overlay_zones`, `asymmetry_analysis`, `selectedMetrics` | ❌ pendente |
| Build + deploy | `npm run build` + `just frontend-deploy` | ❌ pendente |

---

## Success Criteria

- [x] View "landmarks": background é `canonical` (sem texto/linhas queimadas), SVG layer renderiza Frankfort, midline, desvios, landmarks como elementos SVG
- [x] `IdealProportionsLayer`: zones vêm de `overlay_annotations.ideal_proportions_zones` (não de `createAnatomicalZones()`)
- [x] `MetricsMapLayer`: dropdown multi-select filtra por métrica individual; sidebar exibe detalhes (valor, severity, desvio, direction_label) da métrica selecionada; dados vindos de `metric_evaluations` do backend
- [x] Nenhum `<img>` no resultado aponta para a imagem annotated como dado primário de overlay
- [x] `npm run build` passa sem erros TypeScript
- [x] `docker compose ps` — todos containers healthy



--------------


# Plan — Mover "Mapa de Métricas" para o sidebar esquerdo + corrigir SVG não renderizando

## Context

Na view `landmarks` ("Mapa de métricas"), o usuário vê na coluna direita um painel `OverlaySidebar variant="metrics_map"` com:

- 🔍 dropdown "Todas as métricas (93)"
- legenda "Clique em uma região para destacar no SVG"

Mas **nada é desenhado sobre a foto** — nem regiões coloridas, nem polígonos. Resultado: a legenda promete uma interação que não existe.

Investigação revelou **duas causas**:

### 1. Bug de renderização (`MetricsMapLayer` ausente na view `landmarks`)

`MetricsMapLayer` só é montado em duas views ([PremiumResultPage.tsx:931](frontend/src/pages/PremiumResultPage.tsx#L931) e [PremiumResultPage.tsx:1062](frontend/src/pages/PremiumResultPage.tsx#L1062)):

| View | Montagem | Condição |
|---|---|---|
| `ideal` | linha 931 | `result.metric_evaluations?.length > 0` (renderiza sempre) |
| `overlays` | linha 1062 | `activeOverlays.includes("heatmap_ideal_adherence")` (toggle off por default) |
| **`landmarks`** | **— não monta —** | (mas é a view onde o sidebar `metrics_map` aparece, [linha 948](frontend/src/pages/PremiumResultPage.tsx#L948)) |

Por isso o sidebar promete um SVG que não existe: na view padrão (`landmarks`), o `MetricsMapLayer` simplesmente não está no DOM.

### 2. Localização do painel

O usuário quer que esse painel "Mapa de métricas" (filtro + lista de regiões + sub-rows de métricas) viva na **coluna sidebar esquerda** ([PremiumResultPage.tsx:684](frontend/src/pages/PremiumResultPage.tsx#L684) `<aside className="view-sidebar">`), no mesmo padrão visual do [`OverlayToggleBar`](frontend/src/components/OverlayLayer.tsx) que aparece ali quando `view === "overlays"` ([linha 755](frontend/src/pages/PremiumResultPage.tsx#L755)).

Hoje esse sidebar esquerdo contém: label "Visualizações", botões de view (`.view-btn`), e — quando aplicável — toggles auxiliares (`OverlayToggleBar`). É um espaço vertical com `position: sticky` perfeito para receber controles contextuais por view.

### Resultado desejado

1. Quando `view === "landmarks"`, o painel `OverlaySidebar variant="metrics_map"` aparece **dentro de `.view-sidebar`** (esquerda), não mais à direita da imagem.
2. O `MetricsMapLayer` SVG é montado na coluna principal (direita) sobre a imagem canônica, recebendo `selectedRegion` / `selectedMetrics` para responder aos cliques no painel à esquerda.
3. Visual do painel adaptado ao slot esquerdo: largura ~220px (igual aos `view-btn`), tipografia compacta, `--surface` para combinar com os botões de view.

---

## Mudanças

### A. Frontend — `PremiumResultPage.tsx`

**1. Montar `MetricsMapLayer` na view `landmarks`** (próximo às linhas onde o `<img canonicalUrl>` da view landmarks já é renderizado — provavelmente entre as linhas 920–945, mesma região do `AsymmetryAnalysisLayer`):

```tsx
{view === "landmarks" && result.metric_evaluations && result.metric_evaluations.length > 0 && (
  <MetricsMapLayer
    viewBoxWidth={imgDims?.naturalW || 1200}
    viewBoxHeight={imgDims?.naturalH || 800}
    metric_evaluations={result.metric_evaluations}
    region_adherence={result.region_adherence || []}
    overlay_metrics_map={result.overlay_annotations?.metrics_map}
    onRegionClick={(region) => setSelectedRegion(prev => prev === region ? null : region)}
    selectedRegion={selectedRegion}
    selectedMetrics={selectedMetrics}
  />
)}
```

**2. Mover `<OverlaySidebar variant="metrics_map">` da coluna direita para dentro de `.view-sidebar`** (perto da linha 757, junto do `OverlayToggleBar`):

```tsx
{view === "landmarks" && result.overlay_annotations && result.metric_evaluations?.length > 0 && (
  <OverlaySidebar
    variant="metrics_map"
    data={result.overlay_annotations}
    regionAdherence={buildRegionAdherence(result)}
    selectedKey={selectedRegion}
    onSelectKey={(key) => setSelectedRegion(prev => prev === key ? null : key)}
    metricEvaluations={result.metric_evaluations}
    selectedMetrics={selectedMetrics}
    onChangeMetrics={setSelectedMetrics}
  />
)}
```

**3. Remover** a montagem antiga do `OverlaySidebar variant="metrics_map"` na coluna direita ([linhas 946–959](frontend/src/pages/PremiumResultPage.tsx#L946)) — agora vive só no sidebar esquerdo.

**4. Manter** as outras montagens do sidebar (`grid_thirds`, `grid_fifths`, etc. nas views `overlays` e `ideal`) intocadas — escopo é só o `metrics_map`.

### B. Frontend — `OverlaySidebar.tsx`

Adicionar prop opcional `compact?: boolean` que, quando `true`, ajusta o estilo para o slot estreito do sidebar esquerdo:

- Reduz `padding` do `cardStyle` (de 16 → 12)
- Reduz `fontSize` base (13 → 12)
- `background: var(--surface)` em vez de `var(--surface2)` para harmonizar com `.view-btn`
- O dropdown de filtro (`MetricsMapFilterPanel`) deve continuar funcional em largura ~196px (220 − padding)

Passar `compact` apenas na invocação da view `landmarks` (sidebar esquerdo). As outras invocações (sidebars à direita da imagem nas views `overlays`/`ideal`) ficam sem `compact` — preservando o visual atual.

### C. Frontend — `styles.css`

Caso `MetricsMapFilterPanel` precise de ajuste de width para caber em ~196px, adicionar regra escopada:

```css
.view-sidebar .metrics-map-filter-panel { width: 100%; min-width: 0; }
```

Verificar primeiro se já cabe — pode não ser necessário.

### D. Verificação rápida (não-mudança)

Confirmar que `buildRegionAdherence(result)` ([PremiumResultPage.tsx:44](frontend/src/pages/PremiumResultPage.tsx#L44)) já retorna corretamente. O `MetricsMapLayer` precisa de `region_adherence` para colorir as regiões — se vier vazio, o SVG renderiza polígonos sem cor de aderência (degradado).

---

## Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| [frontend/src/pages/PremiumResultPage.tsx](frontend/src/pages/PremiumResultPage.tsx) | Montar `MetricsMapLayer` na view `landmarks`; mover `OverlaySidebar metrics_map` para dentro de `.view-sidebar`; remover montagem antiga à direita |
| [frontend/src/components/OverlaySidebar.tsx](frontend/src/components/OverlaySidebar.tsx) | Adicionar prop `compact?: boolean` e ajustar estilos quando `true` |
| [frontend/src/styles.css](frontend/src/styles.css) | (Eventual) regra para o filter panel caber no slot estreito |

---

## Funções/utilitários reutilizados (sem reescrever)

- [`buildRegionAdherence()`](frontend/src/pages/PremiumResultPage.tsx#L44) — já existe e funciona
- [`MetricsMapLayer`](frontend/src/components/MetricsMapLayer.tsx) — já recebe todas as props necessárias, não precisa mexer
- [`MetricsMapFilterPanel`](frontend/src/components/MetricsMapFilterPanel.tsx) — usado dentro do `OverlaySidebar`, não precisa mexer
- Estado `selectedRegion`, `selectedMetrics` — já existem em `PremiumResultPage`
- `overlay_annotations.metrics_map.regions[]` — backend já popula via `build_metrics_map_metadata()` ([annotations.py:240](backend/app/services/overlays/annotations.py#L240))

---

## Verificação end-to-end

1. **Build:** `cd frontend && npm run build` — zero erros TypeScript.
2. **Dev server:** `just frontend-deploy` (ou `cd frontend && npm run dev`).
3. **Navegação:** abrir uma análise premium existente, clicar em "Mapa de métricas" no sidebar esquerdo.
4. **Esperado:**
   - Painel com dropdown de filtro + lista de regiões agora aparece **abaixo do botão "Mapa de métricas"** no sidebar esquerdo.
   - Sobre a foto à direita, regiões faciais (testa, olhos, nariz, etc.) aparecem coloridas por aderência.
   - Clique em "Nariz" no painel: borda ciano destaca a região "Nariz" no SVG.
   - Segundo clique: deseleciona.
   - Filtrar uma métrica no dropdown: regiões sem essa métrica ficam dimmed (`opacity: 0.35`).
5. **Regressão:** views `overlays` e `ideal` continuam mostrando seus respectivos sidebars à direita da imagem (intocados).
6. **Mobile (≤640px):** sidebar esquerdo já colapsa; o painel `metrics_map` deve aparecer no fluxo natural sem quebrar layout.

---

## Fora de escopo

- Não consertar a montagem do `MetricsMapLayer` na view `overlays` (o toggle `heatmap_ideal_adherence` continua existindo, é outro caso).
- Não mexer nos sidebars `grid_thirds`, `grid_fifths`, `face_extents`, `ideal_proportions`.
- Não criar nova rota nem novo endpoint backend.
