# M3_OVERLAYS.md — Marco 3: overlays SVG + heatmaps + composição before/ideal

> Plano detalhado do **Marco 3 — overlays visuais (SVG cliente + raster server) + heatmaps + composição before/ideal**.
> Releia junto com `../PLAN_METRICS.md` e `./M2_BACKLOG.md`.
> Atualização: 2026-05-08 (split do PLAN_METRICS §7, ainda não iniciado).

---

## 0. Quando iniciar

**Pré-requisito duro:** PRs 13–22 do M2 fechados. Especificamente:

- ≥60 `metric_definition` com ideais calibrados.
- `region_metric_weights_version v2.0` ativa.
- Calibração com fotos reais validada em staging.

Antes disso, qualquer overlay vai ser **enganoso**: vai destacar geometria contra um ideal não-validado, e o usuário vai assumir que o sistema "sabe" o que é correto. Isso é dívida ética + legal séria.

---

## 1. Princípios duros

### 1.1 Cascata de supressão por confiança (DEC-7 / DEC-8 estendidos)

> **Aviso do prompt do usuário:**
> *"Heatmaps e composição before/ideal — interpolação espacial, griddata, mapeamento de cor, e principalmente a decisão de quando suprimir overlay por baixa confiança em cascata. Tem armadilhas finas que Sonnet pode passar batido."*

A regra é: **não desenhar pior do que não desenhar**. Se um overlay seria enganoso, ele não renderiza.

Cascata em 3 níveis:

| Nível | Regra | Ação |
|-------|-------|------|
| **L1 — métrica individual** | `confidence_final < min_confidence_to_display_metric (0.4)` | overlay que depende **exclusivamente** dessa métrica é suprimida. |
| **L2 — overlay com múltiplas dependências** | ≥1 dependência **crítica** (`overlay_metric_dependency.is_critical=TRUE`) com `confidence_final < 0.4` | overlay inteira é suprimida. |
| **L3 — overlay com dependências não-críticas** | dependência não-crítica abaixo do threshold | overlay **renderiza degradada** (sem o componente afetado, com legenda explicando). |

Defesa de implementação:
- `OverlayRenderer` carrega `overlay_metric_dependency` no início.
- Para cada overlay, calcula `is_renderable` ∈ {`full`, `degraded`, `suppressed`}.
- Suppressed ⇒ não emite asset; emite `processing_note` no `analysis_report`.
- Degraded ⇒ emite asset + flag `degraded_components: ['canthal_tilt_l']`.

**Anti-padrão**: NUNCA renderizar interpolação heatmap quando densidade local de pontos confiáveis for < 3 vizinhos válidos no raio de 2× distância intercanthal. `griddata` extrapola horrivelmente fora do convex hull dos pontos de entrada — em região de baixa densidade, vira ruído colorido sem semântica.

### 1.2 SVG no cliente vs raster no servidor

| Caso | Tecnologia | Onde |
|------|------------|------|
| Visualização interativa (toggles, hover, zoom) | SVG | React (frontend) |
| Export PDF/PNG, share via link | Raster (PNG) | Pillow/OpenCV no Python via `POST /vision/render` |
| Heatmap | Raster | Python (scipy.griddata + matplotlib colormap) |
| Composição before/ideal | Vetorial primeiro (M3.1), warp depois (M3.2 ou M4) | Python (raster) ou SVG (cliente) |

**Por que dois caminhos:** SVG no cliente é interativo e leve; raster no servidor garante reprodutibilidade pixel-exata para PDF e share.

### 1.3 Phi/golden + outras `presentation_only` (DEC-6 reforçado em overlay)

Overlay decorativa (golden ratio mask, phi grid) **DEVE** carregar legenda explícita: *"Referência estética histórica — não usado no cálculo do score."* Isso vive em `overlay_definition.legend_text` e o renderer obriga a desenhar.

---

## 2. Backlog de PRs do M3

### Sub-marco M3.1 — infra + overlays simples (axis, grid, contour)

| PR | Escopo | Modelo |
|----|--------|--------|
| **PR-30** | Migration `0010_OverlayCatalog`: tabelas `overlay_definition`, `overlay_metric_dependency`, `overlay_catalog_version`, `rendered_asset` (`expires_at`!). Seed v1.0 com 5 overlays básicos: `axis_vertical`, `axis_intercanthal`, `grid_thirds`, `grid_fifths`, `outline_face`. | Sonnet |
| **PR-31** | Frontend: componente React `<OverlayLayer>` que consome `analysis_report.regional_scores` + dependências e renderiza SVG sobre a foto. Toggle UI por overlay. | Sonnet |
| **PR-32** | Python: `POST /vision/render` (multipart) que recebe `(landmarks, overlay_ids, image_bytes_or_url)` e devolve PNG. Pillow only — sem heatmap ainda. | Sonnet |
| **PR-33** | Nest: `RenderedAssetService` que orquestra: chama `/vision/render`, salva em MinIO em `/rendered/single/{report_id}.png`, persiste `rendered_asset` row. Endpoint `POST /api/analysis/:id/render`. | Sonnet |

### Sub-marco M3.2 — overlays com setas (improvement vector)

| PR | Escopo | Modelo |
|----|--------|--------|
| **PR-34** | Python `MetricCalculator` ganha campo opcional `improvement_vector: (dx, dy)` quando aplicável (ex: `chin_projection_index` → seta apontando para projeção desejada). DTO Nest expande. | Sonnet |
| **PR-35** | Migration `0011_AlterMetricEvalAddImprovementVector`: colunas `improvement_vector_x/y` em `metric_evaluation_against_ideal`. | Sonnet |
| **PR-36** | Frontend: SVG render de setas baseado nos vetores acima. Cor por severidade (mild=green, moderate=yellow, strong=orange, extreme=red). | Sonnet |

### Sub-marco M3.3 — heatmaps (assimetria + aderência ao ideal) ✅ COMPLETO (2026-05-08)

> **Atenção máxima** a esta sub-fase. Requer judgment denso. Modelo recomendado: **Opus**.

| PR | Escopo | Modelo | Status |
|----|--------|--------|--------|
| **PR-37** | Python `HeatmapRenderer` (asymmetry): para cada landmark do lado esquerdo, calcula `delta = ||lm_l - mirror(lm_r)||` em coordenadas normalizadas. Interpola via `scipy.interpolate.griddata` com método `cubic` dentro do convex hull facial. Mascara fora do hull. Gradiente azul → branco → vermelho. | **Opus** | ✅ `8d5e4e2` |
| **PR-38** | Python `HeatmapRenderer` (ideal_adherence): para cada região, calcula `(1 - |deviation_normalized|)` ponderado por confiança, projeta em landmarks da região, interpola igual. Suppression por densidade (regra L1+L2 da §1.1). | **Opus** | ✅ `8d5e4e2` (mesmo módulo) + wiring `2a4a830` |
| **PR-39** | Nest: novo `overlay_id`s (`heatmap_asymmetry`, `heatmap_ideal_adherence`) em `overlay_definition`. Rota `POST /api/analysis/:id/render?overlay=heatmap_*`. | Sonnet | ✅ `3d18a5b` |
| **PR-40** | Frontend: toggle de heatmap + legenda colormap inline. | Sonnet | ✅ `494ca75` |

**Notas de execução M3.3** (sessão Opus 2026-05-08):

- **`backend/app/vision/services/heatmap_renderer.py`** — módulo puro (sem matplotlib).
  Colormaps coolwarm e adherence_sequential implementados em numpy. Cascata de
  supressão L1 (`<3` vizinhos em `0.5×ICD`) + L2 (`HeatmapSuppressedError` se
  `<8` amostras totais ou triangulação Qhull falha). Convex-hull mask via
  `scipy.spatial.ConvexHull` + ray-casting vectorizado. Resolução interna 512².
- **`backend/app/vision/routers/render.py`** — dispatch dos heatmaps ANTES das
  linhas (DEC-25). Novo form field `region_adherence_json`. `HeatmapSuppressedError`
  → HTTP 422 com `{overlay_id, suppressed, samples}`.
- **PR-39 enums já existiam** desde PR-30 (`1746000160000-M3OverlayCatalog`):
  `overlay_category_enum` inclui `'heatmap'`; `rendered_asset_type_enum` inclui
  `'heatmap_asymmetry'` + `'heatmap_ideal_adherence'`. Migration 1746000190000
  é puro INSERT (2 overlay_definition + 11 overlay_metric_dependency).
- **PR-40 frontend**: novo `<HeatmapImageLayer>` PNG `<img>` posicionado entre
  a foto base e o `<OverlayLayer>` SVG. Plumbing do `heatmapAssetUrls` para o
  endpoint Nest fica como follow-up Sonnet (UI scaffolding é a parte Opus).
- **Tests**: 12 unit tests em `backend/tests/unit/test_heatmap_renderer.py`
  (anchor stops dos 2 colormaps, NaN→transparente, perfect-face near-white nos
  pixels renderizados, perturbação aumenta redness, fora do hull transparente,
  L2 suppression raise, ICD degenerado raise, adherence região alta > baixa,
  confidence<0.4 ignora região, região desconhecida ignora). Suite: 1100 ✓ + 48
  skipped. Frontend: tsc --noEmit clean, vite build clean.

**Fontes/Referências (para auditoria futura)**:

- scipy.interpolate.griddata — https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.griddata.html
- scipy.spatial.ConvexHull (Qhull) — https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.ConvexHull.html
- Moreland 2009 — *Diverging Color Maps for Scientific Visualization* (coolwarm anchors): https://www.kennethmoreland.com/color-advice/
- Crameri, Shephard & Heron 2020 — *The misuse of colour in science communication* (Nature Communications): https://www.nature.com/articles/s41467-020-19160-7
- Naini, F.B. (2011) — *Facial Aesthetics: Concepts and Clinical Diagnosis* §2 (regiões + simetria)
- Powell & Humphreys (1984) — *Proportions of the Aesthetic Face* (terços/quintos)
- MediaPipe Face Mesh-478 (mirror pairs): https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md

### Sub-marco M3.4 — composição before/ideal (vetorial) — ✅ ENTREGUE

| PR | Escopo | Modelo | Status |
|----|--------|--------|--------|
| **PR-41** | Python `BeforeIdealComposer` (vetorial): renderiza side-by-side: foto original + esboço vetorial do "ideal" (silhueta de landmarks deslocados para `ideal_central_value` quando aplicável). **Sem warp** — só wireframe sobreposto. | **Opus** | ✅ `2140a7e` |
| **PR-42** | Nest: `POST /v1/vision/compose-before-ideal` (proxy PNG stateless) + `POST /v1/overlays/:reportId/compose-before-ideal` (persist `rendered_asset.asset_type='before_ideal_composition'`). `composeBeforeIdealAndPersist()` em overlays.service.ts. | Sonnet | ✅ `d95e218` |
| **PR-43** | Frontend: ViewMode `"before_ideal"` em PremiumResultPage.tsx. Sidebar "Vetores ideais" (📏). `buildComposeOffsets()` a partir de `improvement_vector_x/y`. Toggle linhas guia + wireframe. Cleanup `URL.revokeObjectURL`. | Sonnet | ✅ `d861a4e` |

**Notas de execução M3.4 / PR-41** (sessão Opus 2026-05-08):

- **`backend/app/vision/services/before_ideal_composer.py`** — módulo puro. API:
  `compose_before_ideal(image, landmarks, offsets, *, show_actual_wireframe=True,
  show_guide_lines=True, gutter_px=8) -> Image.Image`. Retorna RGBA double-width
  (2 × W + gutter). Left pane é byte-identical ao input photo (no-warp promise
  per DEC-15). Right pane = photo + actual wireframe (gray solid alpha 160) +
  ideal wireframe (cyan `#22d3ee` dashed 4/2 per DEC-26) + guide lines opcionais
  (vertical midline + horizontal intercanthal em cyan faint).
- **`IdealLandmarkOffset(landmark_index, dx_icu, dy_icu, metric_id="")`** —
  dataclass frozen+slots. Cada offset desloca o landmark `landmark_index` no
  wireframe ideal por `(dx_icu, dy_icu)` ICU. Magnitude cap ±0.3 ICU
  (mirror dos calculadores PR-34 em `backend/app/services/metrics/symmetry.py` etc).
  `metric_id` é tag de traceability — não é desenhado.
- **Wireframe** = `LM_JAWLINE` + `LM_LEFT_BROW` + `LM_RIGHT_BROW` + `LM_LEFT_EYE`
  (closed) + `LM_RIGHT_EYE` (closed) + `LM_OUTER_MOUTH` (closed) +
  `LM_NOSE_BRIDGE`. Anatomicamente cobre todas as regiões alvo de
  `improvement_vector` do PR-34 (midline, chin, brows) + região circundante
  para silhueta legível.
- **`BeforeIdealComposeError`** com `reason ∈ {invalid_landmark_shape,
  insufficient_landmarks, intercanthal_distance_degenerate,
  invalid_landmark_index}`. Caller (router/Nest) converte em HTTP 422 +
  `processing_note`.
- **Endpoint `POST /vision/compose-before-ideal`** em
  `backend/app/vision/routers/compose.py`. Multipart fields: `image`,
  `landmarks_json`, `offsets_json` (default `"[]"`),
  `show_actual_wireframe` (form bool, default `"true"`),
  `show_guide_lines` (form bool, default `"true"`). Wired em
  `backend/app/vision/router.py`.
- **Tests**: 10 unit tests em `backend/tests/unit/test_before_ideal_composer.py`
  (output dimensions/mode, left pane byte-identical, empty offsets renders cyan,
  single offset shifts only right pane, magnitude cap clipping, degenerate ICD
  raises, insufficient landmarks raises, invalid landmark_index raises,
  show_actual_wireframe toggle, show_guide_lines toggle). Suite: **1110 ✓ + 48
  skipped** (PR-37/38 base era 1100, +10 desta entrega).
- **Decisão de design — por que side-by-side e não overlay direto na foto**:
  o overlay direto convida o usuário a interpretar como "antes/depois" cosmético.
  A composição lado-a-lado preserva a foto original intocada (left pane) e
  apresenta o ideal como esboço técnico (right pane), reforçando o caráter
  geométrico-analítico vs. promessa estética.
- **PR-42 (Sonnet — `d95e218`)** — Nest wiring:
  - **`vision.dto.ts`**: `OffsetDto` (`landmark_index`, `dx_icu`, `dy_icu`, `metric_id?`) +
    `ComposeBeforeIdealRequestDto` (`runId`, `landmarks[][]`, `offsets?`, `showGuideLines?`,
    `showActualWireframe?`). `class-validator` decorators.
  - **`vision.client.ts`**: `composeBeforeIdeal()` — fetches annotated image via
    `fetchAnnotated(runId)`, then POSTs native `fetch + FormData + Blob` multipart to
    `${baseUrl}/vision/compose-before-ideal`. Returns `{data: Buffer, contentType: 'image/png'}`.
    `AbortSignal.timeout(30_000)`.
  - **`vision.controller.ts`**: `POST /v1/vision/compose-before-ideal` — streams PNG back
    via `reply.header('Content-Type','image/png').send(file.data)`. Used by frontend (PR-43).
  - **`overlays.service.ts`**: `composeBeforeIdealAndPersist(reportId, generatedAt, imageUrl,
    offsets, showGuideLines, showActualWireframe)` — loads `LandmarkPayloadEntity` from DB,
    downloads `imageUrl`, calls Python via multipart, uploads PNG to MinIO at
    `rendered/{reportId}/{uuid}_before_ideal.png`, persists `RenderedAssetEntity` with
    `assetType='before_ideal_composition'`. Error: `NotFoundException` if no landmark payload.
  - **`overlays.controller.ts`**: `POST /v1/overlays/:reportId/compose-before-ideal` with
    `ComposeBeforeIdealBodyDto` (`generatedAt`, `imageUrl`, `offsets?`, `showGuideLines?`,
    `showActualWireframe?`). Returns `RenderedAssetDto.from(asset)` (HTTP 201).
  - **Pattern**: native Node.js 18 `fetch` + `FormData` + `new Blob([new Uint8Array(buffer)])` —
    mirrors `overlays.service.ts renderAndPersist()` pattern.
  - **Fontes**: Nest Fastify docs https://docs.nestjs.com/techniques/http-module,
    FormData+Blob Node.js 18 https://nodejs.org/api/globals.html#class-formdata,
    MinIO JS SDK https://github.com/minio/minio-js,
    rendered_asset DDL migration 1746000160000-M3OverlayCatalog,
    PLAN_M3_OVERLAYS §2 PR-42, DEC-15, DEC-26.

- **PR-43 (Sonnet — `d861a4e`)** — Frontend comparison view:
  - **`PremiumResultPage.tsx`**: ViewMode `"before_ideal"` added.
  - **`COMPOSE_ANCHOR`**: `{ midline_deviation: 1, chin_height_ratio: 152, brow_height_l: 107,
    brow_height_r: 336 }` — MediaPipe Mesh-478 landmark indices (mirrors `IMPROVEMENT_ANCHOR`
    in `OverlayLayer.tsx`).
  - **`buildComposeOffsets(evals)`**: filters `metric_evaluations` by `COMPOSE_ANCHOR` membership
    + non-null `improvement_vector_x/y`, maps to `{landmark_index, dx_icu, dy_icu, metric_id}`.
  - **`fetchCompose()`** (`useCallback`): `POST /v1/vision/compose-before-ideal` (JSON body:
    `runId, landmarks, offsets, showGuideLines, showActualWireframe`) → blob →
    `URL.createObjectURL(blob)`. Revokes previous URL before creating new one.
  - **Sidebar button** "Vetores ideais" (📏): visible when `hasBeforeIdeal` = `run_id +
    landmarks + ≥1 metric with improvement vector + COMPOSE_ANCHOR entry`.
  - **Toggles in sidebar**: "Linhas guia" (`showGuideLines`) + "Wireframe atual"
    (`showActualWireframe`) — each flip triggers `fetchCompose` via `useEffect` dep array.
  - **View body**: loading spinner (⏳) | `<img src={beforeIdealUrl}>` | empty state.
  - **Cleanup**: `URL.revokeObjectURL(beforeIdealUrl)` on component unmount / URL change.
  - **TypeScript**: validated via `npx tsc --noEmit` — zero errors.
  - **Fontes**: MediaPipe Mesh-478 https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md,
    MDN URL.createObjectURL https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL,
    PLAN_M3_OVERLAYS §2 PR-42/PR-43, DEC-26.

**PR-42 (Sonnet)** vai persistir o PNG retornado em
  `rendered_asset.asset_type='before_ideal_composition'` (enum já existe desde
  PR-30). Wiring entre `OrchestratorService` e o novo endpoint.
- **PR-43 (Sonnet)** vai construir a tela de comparação no frontend, consumindo
  o asset persistido + montando o `offsets_json` a partir de
  `metric_evaluations[].improvement_vector_x/y` (ICU já vem capped do Python).

**Fontes/Referências (para auditoria futura)**:

- PLAN_M3_OVERLAYS §2 PR-41, §3 DEC-15, DEC-26
- PLAN_METRICS §2 DEC-15 (vector first, warp later)
- Naini, F.B. (2011) *Facial Aesthetics: Concepts and Clinical Diagnosis* —
  Ch. 4 (vertical/horizontal proportions), Ch. 6 (mid-sagittal axis)
- Powell, N. & Humphreys, B. (1984) *Proportions of the Aesthetic Face*
- Farkas, L.G. (1994) *Anthropometry of the Head and Face*
- MediaPipe Face Mesh-478 — https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md
- Pillow `ImageDraw` — https://pillow.readthedocs.io/en/stable/reference/ImageDraw.html
- ANSI/ISO ergonomic guidelines on side-by-side comparison (cognitive load) —
  consulted but not cited in code.

### Sub-marco M3.5 (opcional, pós-M3) — warp before/ideal

Adiado para depois do M4. Envolve `cv2.warpAffine` ou TPS warp dos pixels reais para o ideal. Pesado em judgment ético: warp pode distorcer expressão e gerar imagem que "parece a pessoa mas com a face alterada", o que tem implicação séria em consentimento. **NÃO** entregar antes de validação legal.

---

## 3. Decisões a travar antes do PR-30

| ID | Decisão | Default sugerido |
|----|---------|------------------|
| DEC-21 | **Densidade mínima local para heatmap interpolar** | ≥3 landmarks confiáveis dentro de raio = 0.5 × distância intercanthal |
| DEC-22 | **Colormap padrão** | `coolwarm` (matplotlib) — neutro, daltônico-friendly. Escala fixa para comparabilidade entre fotos. |
| DEC-23 | **Resolução do raster server-side** | 1024×1024 max (PDF), 512×512 (preview web) |
| DEC-24 | **TTL do `rendered_asset`** | igual a `photo_storage` (30 dias opt-in, 7 dias default) |
| DEC-25 | **Ordem de renderização (z-order)** | image base (z=0) → grids (z=10) → contours (z=20) → heatmaps (z=30, alpha=0.55) → vectors/arrows (z=40) → labels/legends (z=50) |
| DEC-26 | **Composição before/ideal: cor da silhueta ideal** | `--accent2` (#22d3ee — cyan) com `stroke-dasharray: 4 2` para diferenciar de linha real |

---

## 4. Armadilhas listadas

1. **`griddata` cubic extrapola fora do hull** — sempre clipar com máscara facial.
2. **Heatmap em foto de baixa qualidade** — supressão L2 não é opcional; é obrigatória.
3. **Setas de improvement vector apontando para fora da foto** — clipar magnitude no bbox.
4. **Overlay phi sem disclaimer** — viola DEC-6 mesmo sem entrar em score; legenda obrigatória.
5. **Render server-side pesado** — fila assíncrona (Redis/BullMQ) caso o tempo subir; M3 não otimiza, M3.5 sim.
6. **Asset não expira** — privacidade. `rendered_asset.expires_at` checado em CRON.
7. **Frontend renderiza overlay sem checar `is_displayable`** — rule: SVG component recebe `regional_scores[]` e filtra antes do render. Bug fácil.

---

## 5. Critérios de saída do M3

- [ ] PRs 30–43 mergeados.
- [ ] Em ≥30 fotos reais, distribuição de overlays renderizadas vs suprimidas é **explicável** (operador valida).
- [ ] Heatmap nunca extrapola fora do face hull (test visual em fixtures).
- [ ] Phi/golden overlay tem legenda em 100% das renderizações.
- [ ] PDF export funciona end-to-end.

Após isso → **abrir M4** (`./M4_NARRATIVE.md`).
