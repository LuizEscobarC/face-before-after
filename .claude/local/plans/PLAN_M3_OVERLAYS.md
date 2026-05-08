# PLAN_M3_OVERLAYS.md

> Plano detalhado do **Marco 3 — overlays visuais (SVG cliente + raster server) + heatmaps + composição before/ideal**.
> Releia junto com `PLAN_METRICS.md` e `PLAN_M2_BACKLOG.md`.
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

### Sub-marco M3.3 — heatmaps (assimetria + aderência ao ideal)

> **Atenção máxima** a esta sub-fase. Requer judgment denso. Modelo recomendado: **Opus**.

| PR | Escopo | Modelo |
|----|--------|--------|
| **PR-37** | Python `HeatmapRenderer` (asymmetry): para cada landmark do lado esquerdo, calcula `delta = ||lm_l - mirror(lm_r)||` em coordenadas normalizadas. Interpola via `scipy.interpolate.griddata` com método `cubic` dentro do convex hull facial. Mascara fora do hull. Gradiente azul → branco → vermelho. | **Opus** |
| **PR-38** | Python `HeatmapRenderer` (ideal_adherence): para cada região, calcula `(1 - |deviation_normalized|)` ponderado por confiança, projeta em landmarks da região, interpola igual. Suppression por densidade (regra L1+L2 da §1.1). | **Opus** |
| **PR-39** | Nest: novo `overlay_id`s (`heatmap_asymmetry`, `heatmap_ideal_adherence`) em `overlay_definition`. Rota `POST /api/analysis/:id/render?overlay=heatmap_*`. | Sonnet |
| **PR-40** | Frontend: toggle de heatmap + legenda colormap inline. | Sonnet |

### Sub-marco M3.4 — composição before/ideal (vetorial)

| PR | Escopo | Modelo |
|----|--------|--------|
| **PR-41** | Python `BeforeIdealComposer` (vetorial): renderiza side-by-side: foto original + esboço vetorial do "ideal" (silhueta de landmarks deslocados para `ideal_central_value` quando aplicável). **Sem warp** — só wireframe sobreposto. | **Opus** |
| **PR-42** | Nest: persiste `rendered_asset.asset_type='before_ideal_composition'`. | Sonnet |
| **PR-43** | Frontend: tela de comparação. Toggle "ver linhas guia". | Sonnet |

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

Após isso → **abrir M4** (`PLAN_M4_NARRATIVE.md`).
