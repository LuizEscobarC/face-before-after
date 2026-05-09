# SVG & Overlays — Checklist Completa

**Data:** 2026-05-08  
**Fase Atual:** M3 (Overlays) + M4.1 (Diagnostics) completas; M3.4 BeforeIdealComposer finalizado (PR-41)

---

## ✅ IMPLEMENTADO — SVGs Ativos

### Frontend SVG Components

- ✅ **ScoreArc** — donut chart animado com gradiente (indigo→cyan)
  - Localização: `FreeResultPage.tsx` linhas 13–48
  - Visível em: Free + Premium hero section
  - Cores: #6366f1 (indigo) → #22d3ee (cyan)
  - Animação: arco que cresce conforme score 0–100

- ✅ **AxisVertical** — linha vertical dashed pelo midline
  - Overlay ID: `axis_vertical`
  - Cor: #22d3ee (cyan)
  - Stroke: 1.5px, dashed (4 2)
  - Default: ativado

- ✅ **AxisIntercanthal** — linha horizontal pelos olhos
  - Overlay ID: `axis_intercanthal`
  - Cor: #22d3ee (cyan)
  - Stroke: 1.5px sólido
  - Default: ativado

- ✅ **GridThirds** — 2 linhas horizontais para terços
  - Overlay ID: `grid_thirds`
  - Cor: #a5b4fc (indigo claro)
  - Stroke: 1px dashed (6 3)
  - Referência: Naini 2011 §4
  - Landmarks: P_BROW_LEFT/RIGHT_INNER, P_SUBNASALE

- ✅ **GridFifths** — 4 linhas verticais para quintos
  - Overlay ID: `grid_fifths`
  - Cor: #a5b4fc (indigo claro)
  - Stroke: 1px dashed (6 3)
  - Referência: Naini 2011 §6
  - Landmarks: P_LEFT_EYE_OUTER/INNER, P_RIGHT_EYE_INNER/OUTER

- ✅ **OutlineFace** — contorno mandibular
  - Overlay ID: `outline_face`
  - Cor: #67e8f9 (cyan claro)
  - Stroke: 1.5px sólido
  - Tipo: polyline (17 landmarks da mandíbula)
  - LM_JAWLINE indices: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400]

- ✅ **ImprovementVectors** — arrows de melhoria (PR-36, M3.2)
  - Overlay ID: `improvement_vectors`
  - Cores por severity:
    - mild: #22c55e (verde)
    - moderate: #eab308 (amber)
    - strong: #f97316 (orange)
    - extreme: #ef4444 (red)
  - Stroke: 2px
  - Z-order: 40 (acima de tudo)
  - Anchor landmarks por métrica:
    - midline_deviation → P_NOSE_TIP (1)
    - chin_height_ratio → P_MENTON (152)
    - brow_height_l → P_BROW_LEFT_INNER (107)
    - brow_height_r → P_BROW_RIGHT_INNER (336)
  - Calcula: (vec_x, vec_y) em ICU × icd_px
  - Arrowhead: 9px tamanho base, asa 4px

### Backend Pillow Renderers

- ✅ **`POST /vision/render`** — Overlay Line Renderer (PR-32)
  - Multipart: image + landmarks_json + overlay_ids_json + show_actual_wireframe + show_guide_lines
  - Output: PNG RGB 8-bit
  - Overlays:
    - axis_vertical (#22d3ee dashed)
    - axis_intercanthal (#22d3ee)
    - grid_thirds (#a5b4fc dashed)
    - grid_fifths (#a5b4fc dashed)
    - outline_face (#67e8f9)
  - L1 guard: ≥478 landmarks
  - Arquivo: `backend/app/vision/routers/render.py`

- ✅ **`render_asymmetry_heatmap()`** — Marquardt Mirror-Distance Heatmap (PR-37)
  - Entrada: photo + landmarks + mirror_pairs
  - Método: `||lm_l - mirror(lm_r)|| / icd` em ICU → scipy.interpolate.griddata cubic
  - Colormap: coolwarm (blue→white→red), Moreland 2009
  - Hot end: #b40426
  - Convex-hull mask: scipy.spatial.ConvexHull + ray-casting
  - Cascata L1: pixel-mask < 3 vizinhos; L2: < 8 amostras ou QhullError raise
  - Alpha: 0.55 default
  - 12 unit tests, 1100✓+48⏭ total
  - Arquivo: `backend/app/vision/services/heatmap_renderer.py`

- ✅ **`render_ideal_adherence_heatmap()`** — Per-Region Adherence (PR-38)
  - Entrada: photo + landmarks + region_samples (region, adherence 0–1, confidence 0–1)
  - Método: per-region adherence projection → landmarks da região → griddata cubic
  - Colormap: sequential adherence (red→amber→green), 3 stops
  - Green end: #3cb45a
  - Skips: confidence < 0.4 (L3 degradation)
  - Mesma cascata L1/L2 + hull mask
  - Arquivo: mesmo `heatmap_renderer.py`

- ✅ **`compose_before_ideal()`** — Side-by-Side Before/Ideal (PR-41, M3.4)
  - Entrada: image + landmarks + offsets (IdealLandmarkOffset frozen dataclass) + show_actual_wireframe + show_guide_lines
  - Output: RGBA double-width (2×W + 8px gutter)
  - Left pane: byte-identical original (testado `np.array_equal`)
  - Right pane: wireframe cinza (alpha 160) + wireframe ideal cyan dashed (4/2) + guide lines opcionais
  - Endpoint: `POST /vision/compose-before-ideal` (multipart)
  - Wireframe: LM_JAWLINE + brows L/R + eyes closed L/R + outer mouth + nose bridge
  - Magnitude cap: ±0.3 ICU (mirror dos calculadores PR-34)
  - 10 unit tests
  - Arquivo: `backend/app/vision/services/before_ideal_composer.py`

### Database Migrations & Seeds

- ✅ **M3.1 Overlay Catalog** — `1746000160000-M3OverlayCatalog` (PR-30)
  - Tabelas: overlay_catalog_version + overlay_definition + overlay_metric_dependency + rendered_asset
  - Seed v1.0: 5 overlays (axis_vertical, axis_intercanthal, grid_thirds, grid_fifths, outline_face)
  - 11 overlay_metric_dependency rows (11 deps críticas/não-críticas)
  - Enums: overlay_category_enum, rendered_asset_type_enum, rendered_asset_format_enum

- ✅ **M3.3 Heatmap Overlays** — `1746000190000-M33HeatmapOverlays` (PR-39)
  - 2 overlay_definition rows: heatmap_asymmetry + heatmap_ideal_adherence
  - 11 overlay_metric_dependency rows (2 críticas + 9 não-críticas)
  - Rendering hints: colormap, saturation_icu, density_radius, grid_resolution, alpha

- ✅ **M3.2 Improvement Vector DDL** — `1746000170000-M32AddImprovementVector` (PR-35)
  - Colunas: improvement_vector_x NUMERIC(10,6) + improvement_vector_y NUMERIC(10,6) em metric_evaluation_against_ideal
  - Nullable (decorativo quando sem vetor)

### Tests

- ✅ **Python heatmap_renderer tests** — 12 unit tests
  - Colormap anchors (coolwarm + adherence)
  - NaN → transparent
  - Perfect face near-white
  - Perturbação → mais redness
  - Fora do hull → transparente
  - L2 raise
  - ICD degenerado raise

- ✅ **Python before_ideal_composer tests** — 10 unit tests
  - Output dimensions/mode
  - Left pane byte-identical
  - Empty offsets renderiza cyan
  - Single offset shifta right pane
  - Magnitude cap clipping
  - ICD degenerado raise
  - Insufficient landmarks raise
  - Invalid index raise
  - Toggle actual wireframe
  - Toggle guide lines

- ✅ **Frontend TypeScript compilation** — `tsc --noEmit`
  - Clean (no type errors)

- ✅ **Frontend Vite build** — 234.75 kB bundle
  - 51 modules, clean build

---

## ❌ NÃO IMPLEMENTADO — Próximas Etapas

### PR-42 (Nest Asset Persistence) — **Deferido a Sonnet**

- ❌ `RenderedAssetService.renderAndPersist()` — coordena Python render + MinIO upload + DB persist
  - Inputs: reportId, generatedAt, overlayIds, imageUrl
  - Processo: load LandmarkPayload → download photo → POST multipart /vision/render → upload PNG MinIO → persist RenderedAssetEntity
  - ExpiresAt: now + 7d (DEC-24)
  - `MinioStorageService`: SDK minio@^8, uploadPng → minio://{bucket}/{path}

- ❌ `POST /v1/overlays/:reportId/render` — endpoint Nest
  - Query: ?overlay_ids=heatmap_asymmetry,improvement_vectors
  - Response: { assets: [{ overlay_id, url, expires_at }] }

- ❌ `GET /v1/overlays/:reportId/assets` — retrieve rendered assets
  - Response: list de RenderedAssetEntity com status is_expired

- ❌ `OverlaysModule` no Nest
  - Providers: MinioStorageService, RenderedAssetService, OverlaysController
  - Cross-module: LandmarkPayloadEntity

### PR-43 (Frontend Comparison Screen) — **Deferido a Sonnet**

- ❌ **CompareResultPage.tsx** — screen dedicada para before/ideal side-by-side
  - Renderização do PNG do before_ideal_composer
  - BeforeAfterSlider: drag handle, clipPath animation

### Backend Endpoints Still Wired But Not Persisted

- ❌ `/vision/compose-before-ideal` endpoint exists, mas sem chamada de referência
  - Teste manual: curl multipart para verificar

---

## 📍 Interface & UX

### PremiumResultPage Sidebar (Active)

- ✅ View buttons: "Mapa de métricas" | "Proporções" | "Comparativo" | "Overlays"
- ✅ **OverlayToggleBar** — condicionado a `view === "overlays"`
  - Toggle para cada overlay_id
  - Swatches de cor per overlay
  - Labels em português

### Image Viewer Body (Active)

- ✅ View: "landmarks" → imagem anotada com landmarks
- ✅ View: "ideal" → imagem com proporções ideais simuladas
- ✅ View: "compare" → BeforeAfterSlider (original vs simetrizado)
- ✅ View: "overlays" → SVG OverlayLayer + PNG HeatmapImageLayer (scaffolded)

### Heatmap Image Layer (Scaffolded)

- ⚠️ UI pronta, fetch endpoint Nest **AINDA NÃO WIRED**
- ⚠️ Toggle "Mapa de calor — assimetria" + "Mapa de calor — aderência" funciona, mas layer é no-op
- ⚠️ Comentário no código: "heatmapAssetUrls deferido a follow-up Sonnet"

---

## 📐 Landmark Indices (MediaPipe Mesh-478)

Hardcoded em `OverlayLayer.tsx`:

- P_NOSE_TIP = 1
- P_MENTON = 152 (ponta do queixo)
- P_LEFT_EYE_INNER = 133
- P_RIGHT_EYE_INNER = 362
- P_LEFT_EYE_OUTER = 33
- P_RIGHT_EYE_OUTER = 263
- P_BROW_LEFT_INNER = 107
- P_BROW_RIGHT_INNER = 336
- P_SUBNASALE = 2
- LM_JAWLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400]

**Fonte:** `backend/app/domain/landmarks_mesh.py`

---

## 🎨 Palette Usado (CSS Variables)

```
--bg:           #0a0a12
--surface:      #13131f
--surface2:     #1c1c2e
--border:       rgba(255,255,255,0.07)
--text:         #e2e8f0
--muted:        #94a3b8
--accent:       #6366f1  (indigo — base)
--accent2:      #22d3ee  (cyan — overlay primário)
```

**Overlay-specific:**
- Grid lines: #a5b4fc (indigo 400)
- Contorno: #67e8f9 (cyan 300)
- Heatmap cool-warm hot: #b40426
- Heatmap adherence green: #3cb45a

---

## 📚 Referências no Código

| Métrica | Paper | Seção |
|---|---|---|
| Grid Thirds | Naini 2011 | §4 |
| Grid Fifths | Naini 2011 | §6 |
| Golden Ratio | Farkas 1994 | proporções canônicas |
| Mirror Distance | Marquardt 2002 | simetria facial |
| Improvement Vector | PLAN_M3_OVERLAYS | §2, DEC-25 |
| Heatmap Colormap | Moreland 2009 | coolwarm scientific color map |

---

## 🔗 Files Reference

| Arquivo | Tipo | Linhas | Status |
|---|---|---|---|
| `frontend/src/components/OverlayLayer.tsx` | Component | 1–400+ | ✅ Active |
| `frontend/src/pages/PremiumResultPage.tsx` | Page | ~290–320 | ✅ Active |
| `frontend/src/pages/FreeResultPage.tsx` | Page | 13–48 | ✅ Active |
| `backend/app/vision/routers/render.py` | Endpoint | TBD | ✅ Active |
| `backend/app/vision/services/heatmap_renderer.py` | Service | TBD | ✅ Active |
| `backend/app/vision/services/before_ideal_composer.py` | Service | TBD | ✅ Active |
| `backend/app/vision/routers/compose.py` | Endpoint | TBD | ✅ Active |
| `.claude/local/plans/PLAN_METRICS.md` | Doc | — | ✅ Reference |
| `.claude/local/plans/PLAN_DDL_REVIEW.md` | Doc | — | ✅ Reference |

---

## 💡 Key Decisions Locked

- ✅ **Overlay rendering:** SVG no Frontend (responsivo), PNG no Backend (heavy compute)
- ✅ **Landmark base:** Intercanthal distance (ICD) como normalização
- ✅ **Z-order:** heatmap (30) < lines (10/20) < vectors (40)
- ✅ **Severity colors:** 5 levels (ideal, mild, moderate, strong, extreme)
- ✅ **Composer format:** RGBA double-width (left original, right ideal)
- ✅ **No SVG in backend:** Apenas Pillow PNG rendering (performance)

---

**Última atualização:** 2026-05-08 · Próxima etapa: PR-42 (Nest orchestration) + PR-43 (comparison UI)
