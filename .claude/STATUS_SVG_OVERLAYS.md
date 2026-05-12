# Status: Geração de SVG no Face Before/After

**Data:** 2026-05-08  
**Última atualização:** PR-41 concluído (BeforeIdealComposer)

---

## 🎯 Resposta direta

**SVG está sendo gerado?** ✅ **SIM**, mas em contextos diferentes:

1. **No FreeResultPage** → **1 SVG simples** (score arc)
2. **No PremiumResultPage** → **5 componentes SVG + 2 heatmaps PNG** (overlays + improvement vectors)
3. **Backend Python** → **2 geradores de PNG** (heatmaps + before/ideal composer)

---

## 📊 As 3 imagens que você vê no Free

No `FreeResultPage.tsx` você vê:
- **Imagem 1:** Score Arc SVG (donut chart animado) — renderizado inline via `<ScoreArc>` component
- **Imagem 2:** Foto anotada com landmarks (`/v1/vision/results/{run_id}/annotated`)
- **Imagem 3:** Maior alavanca (card com texto + emoji)

**Não tem mais** porque a view é minimalista. Os overlays (eixos, grids, heatmaps) ficam no Premium.

---

## 🔍 Onde está o SVG sendo gerado?

### Frontend SVG Components (React/TypeScript)

#### 1. **Score Arc** (`FreeResultPage.tsx` linhas 13-48)
```tsx
function ScoreArc({ score }: { score: number }) {
  // SVG <path> com arco animado + gradiente linear
  // Renderizado via <svg viewBox="0 0 200 110">
  // Cores: #6366f1 (indigo) → #22d3ee (cyan)
}
```
**Status:** ✅ ATIVA (visível em ambas as páginas)

---

#### 2. **OverlayLayer.tsx** (componente principal de overlays — PR-31/36/40)

Arquivo: `frontend/src/components/OverlayLayer.tsx`

**Sub-componentes SVG:**

| SVG Component | Overlay ID | Tipo | Descrição | Status |
|---|---|---|---|---|
| `AxisVertical` | `axis_vertical` | Linha SVG dashed | Eixo vertical pelo centro dos olhos (midline) | ✅ |
| `AxisIntercanthal` | `axis_intercanthal` | Linha SVG sólida | Eixo horizontal pelos olhos (intercanthal) | ✅ |
| `GridThirds` | `grid_thirds` | 2 linhas dashed | Divisões de terços faciais (Naini 2011 §4) | ✅ |
| `GridFifths` | `grid_fifths` | 4 linhas dashed | Divisões de quintos faciais (Naini 2011 §6) | ✅ |
| `OutlineFace` | `outline_face` | Polyline | Contorno da mandíbula (17 landmarks) | ✅ |
| `ImprovementVectors` | `improvement_vectors` | Arrows | Setas de melhoria com cores por severity | ✅ |

**Referências:**
- Cores: Palette do `relatorio_mvp.html` (claude.md)
- Landmarks: MediaPipe Mesh-478 (índices hardcoded)
- Z-order: DEC-25 (heatmap z=30 < lines z=10/20 < vectors z=40)

**Status:** ✅ ATIVAS (condicionadas a `view === "overlays"` no Premium)

---

#### 3. **HeatmapImageLayer.tsx** (PR-40, M3.3)

Arquivo: `frontend/src/components/OverlayLayer.tsx` (linhas ~101-138)

```tsx
export function HeatmapImageLayer({
  imageWidth, imageHeight, activeOverlays, heatmapAssetUrls
}: HeatmapImageLayerProps) {
  // Renderiza <img> PNG server-rendered
  // NÃO é SVG — é PNG gerado pelo backend
}
```

**Heatmaps disponíveis:**
- `heatmap_asymmetry` → Python Marquardt mirror-distance (PR-37)
- `heatmap_ideal_adherence` → Python per-region adherence projection (PR-38)

**Status:** ⚠️ **SCAFFOLDED** — UI pronta, mas fetch do endpoint Nest ainda **NÃO está wired**

---

### Backend SVG/PNG Generators (Python)

#### **Renderer 1: `/vision/render` — Overlay Lines (PR-32)**

Arquivo: `backend/app/vision/routers/render.py`

**Entrada:** image + landmarks_json + overlay_ids_json  
**Saída:** PNG com linhas Pillow desenhadas

**Overlays renderizados:**
- axis_vertical (#22d3ee dashed)
- axis_intercanthal (#22d3ee sólido)
- grid_thirds (#a5b4fc dashed)
- grid_fifths (#a5b4fc dashed)
- outline_face (#67e8f9)

**Status:** ✅ ATIVA

---

#### **Renderer 2: Heatmap Asymmetry (PR-37)**

Arquivo: `backend/app/vision/services/heatmap_renderer.py`

**Entrada:** photo + landmarks + overlay_id  
**Saída:** PNG com mapa de calor coolwarm

**Método:** Marquardt mirror-distance → scipy.interpolate.griddata → colormap hot-end #b40426

**Status:** ✅ ATIVA (10 unit tests, suite 1110✓+48⏭)

---

#### **Renderer 3: Heatmap Ideal Adherence (PR-38)**

**Entrada:** photo + landmarks + region_adherence_samples  
**Saída:** PNG com mapa de calor adherence_sequential (red→amber→green)

**Status:** ✅ ATIVA (com cascata L3 de degradação)

---

#### **Renderer 4: Before/Ideal Composer (PR-41)**

Arquivo: `backend/app/vision/services/before_ideal_composer.py`

**Entrada:** image + landmarks + offsets_json  
**Saída:** RGBA double-width (left=original, right=with ideal wireframe + guide lines)

**Método:**
- Left: byte-identical original (no warp — testado via `np.array_equal`)
- Right: wireframe cinza + wireframe ideal dashed cyan + guide lines opcionais
- Gutter: 8px between

**Endpoint:** `POST /vision/compose-before-ideal` (multipart)

**Status:** ✅ ATIVA (10 unit tests, 1110 Python tests total)

**Próximas etapas:** PR-42 (Nest persist `rendered_asset`) + PR-43 (frontend comparison screen) **deferidas a Sonnet**

---

## 📍 Onde você vê os SVGs?

### ✅ Frontend SIM renderiza SVG:

| Localização | Componentes | Onde ativar |
|---|---|---|
| **FreeResultPage** | ScoreArc SVG | Sempre visível (hero section) |
| **PremiumResultPage** | 5 SVG overlays + 2 PNG heatmaps | Sidebar → "Overlays" → toggle |
| **CompareResultPage** | (não implementado ainda) | Deferido a PR-43 |

### ❌ Backend PNG (não SVG):

Backend gera **PNG renderizados** (Pillow), não SVG:
- `/vision/render` → PNG com linhas overlay
- `/vision/heatmaps` → PNG com mapas de calor
- `/vision/compose-before-ideal` → PNG double-width

---

## 🚧 O que falta?

### **PR-42** (Nest Side) — **EM FALTA**
- Persistir `rendered_asset` com `asset_type='before_ideal_composition'`
- Wiring da chamada a `/vision/render` e `/vision/compose-before-ideal`
- Endpoint `POST /v1/overlays/:reportId/render` (para heatmaps + improvements)
- Storage MinIO para assets renderizados

**Status:** Deferido a Sonnet (Opus required por complexidade de orquestração)

---

### **PR-43** (Frontend Comparison Screen) — **EM FALTA**
- Tela de comparação `CompareResultPage.tsx` renderizando o composer PNG side-by-side
- Deferido a Sonnet

---

## 📋 Checklista para Documentação

### SVG Generators
- ✅ ScoreArc (FreeResultPage)
- ✅ AxisVertical, AxisIntercanthal, GridThirds, GridFifths, OutlineFace (OverlayLayer)
- ✅ ImprovementVectors (OverlayLayer + MetricEvaluationResult)
- ✅ Pillow line overlays (backend `/vision/render`)

### PNG Generators  
- ✅ Heatmap Asymmetry (backend `heatmap_renderer.py`)
- ✅ Heatmap Ideal Adherence (backend `heatmap_renderer.py`)
- ✅ Before/Ideal Composer (backend `before_ideal_composer.py`)

### Componentes React  
- ✅ OverlayLayer.tsx (SVG container)
- ✅ HeatmapImageLayer.tsx (PNG layer)
- ✅ OverlayToggleBar (controls)

### Endpoints  
- ✅ `POST /vision/render` (Python)
- ✅ `POST /vision/compose-before-ideal` (Python)
- ❌ `POST /v1/overlays/:reportId/render` (Nest — PR-42)
- ❌ `GET /v1/overlays/:reportId/assets` (Nest — PR-42)

### Database  
- ✅ Migration `1746000160000-M3OverlayCatalog` (overlay_definition + rendered_asset)
- ✅ Migration `1746000190000-M33HeatmapOverlays` (heatmap seeds)
- ❌ Persist rendered_asset rows (PR-42)

---

## 🎨 Cores (CSS Variables)

Todas as SVGs usam o palette do `relatorio_mvp.html`:

```css
:root {
  --accent: #6366f1;       /* Indigo — eixos */
  --accent2: #22d3ee;      /* Cyan — overlay primário */
  --accent-light: #a5b4fc; /* Indigo claro — grids */
  --info-light: #67e8f9;   /* Cyan claro — contorno */
}
```

**Severity colors (improvement vectors):**
- Mild: #22c55e (verde)
- Moderate: #eab308 (amber)
- Strong: #f97316 (orange)
- Extreme: #ef4444 (red)

---

## 📖 Documentos de Referência

| Documento | Status | Onde |
|---|---|---|
| PLAN_METRICS.md | ✅ Atualizado até PR-41 | `.claude/plans/` |
| PLAN_M3_OVERLAYS.md | ✅ Spec completa de M3.1–M3.4 | (não encontrado, deve ser integrado) |
| DEC-25 | ✅ Z-order e specs | Histórico Claude |
| relatorio_mvp.html | ✅ Palette de cores | Root `./ ` |
| OverlayLayer.tsx | ✅ Código com comentários PR-ref | `frontend/src/components/` |

---

## 🔗 Como Acessar

### Para ver os SVGs:
1. Acesse **PremiumResultPage** (após fazer análise premium)
2. Sidebar → "Overlays" (ícone 🔬)
3. Toggle em "OverlayToggleBar" para ligar/desligar cada overlay
4. SVGs renderizados em tempo real sobre a foto

### Para ver heatmaps:
**Ainda não funciona** — HeatmapImageLayer está scaffolded, aguarda PR-42 (Nest wiring)

---

## ✅ Conclusão

- **SVG está sendo gerado:** ✅ SIM, 5 componentes ativos no Frontend + Pillow backend
- **Por que só 3 imagens no Free:** Free tem score SVG + foto anotada + card com insight. Os overlays estão no Premium.
- **Next steps:** PR-42 (Nest asset persistence) + PR-43 (comparison screen UI)

---

**Nota final:** Todos os SVGs estão codificados em TypeScript direto, não gerados por bibliotecas externas. Isso permite controle fino de cores, z-order e performance conforme spec do projeto.
