# PLAN_METRICS.md

> Plano mestre da expansão de métricas, ideais, overlays e diagnóstico.
> Documento de referência permanente. Releia no início de cada sessão.
> Última atualização: 2026-05-08 (após PR-37/38/39/40 — M3.3 heatmaps completo).

---

## 0. Estado atual do projeto

| PR | Escopo | Status |
|----|--------|--------|
| PR-1 | Postgres no compose + TypeORM no Nest + DataSource standalone + scripts CLI | ✅ DONE |
| PR-2 | Migrations `0000_extensions`, `0001_catalogs`, `0002_seed_initial_catalogs` + 6 entidades + seed v1.0 | ✅ DONE |
| PR-3 | Migration `0003_evaluations_and_root` + 4 entidades particionadas + FKs compósitas | ✅ DONE |
| PR-4 | FastAPI: camada de normalização (`services/normalization/`) + 3 fixtures sintéticas + 32 testes | ✅ DONE |
| PR-5 | FastAPI: `MetricValue` domain + `MetricCalculator` ABC + registry + `confidence_propagation` + família simetria (5 métricas) + 68 testes | ✅ DONE |
| PR-6 | FastAPI: família terços (4 métricas) + fixtures `perfect_thirds` + 61 testes (248 total) | ✅ DONE |
| PR-7 | FastAPI: família quintos (6 métricas: `fifth_1_ratio`…`fifth_5_ratio` + `intercanthal_to_eye_width_ratio`) + 96 testes (344 total) | ✅ DONE |
| PR-8 | FastAPI: família olhos (6 métricas: `eye_aperture_ratio_l/r`, `interpupillary_distance`, `intercanthal_distance`, `canthal_tilt_l/r`) + 82 testes (426 total) | ✅ DONE |
| PR-9 | Nest: `IdealComparator` + `SeverityClassifier` + `metric_ideals.yaml` + Vitest (62 testes) | ✅ DONE |
| **PR-10** | **Nest: `AnalysisOrchestrator` + endpoint `POST /v1/analysis/evaluate` + Python `/vision/metrics-v2`** | ✅ DONE |
| **PR-11** | **Migration `0004_SeedMetricCatalogV1`: 21 `metric_definition` + 20 `metric_ideal` rows (ideals_version=v1.0)** | ✅ DONE |
| **PR-12** | **M2 first slice: `RegionalScorer` + `GlobalScorer` + `ScoreBander` + 6 entidades + migration `0005_RegionalAndGlobalScoring` + YAMLs `region_metric_weights.yaml`/`global_weights.yaml` + 42 testes Vitest novos** | ✅ DONE |
| **PR-13** | **Família `jaw` (mandíbula): 6 métricas (`jaw_width_ratio`, `gonial_angle_l/r`, `gonial_angle_asymmetry`, `mandibular_plane_angle`, `chin_height_ratio`) + `JAW_POSE_PARAMS` (yaw-sensitive) + migration `0006_SeedJawFamily` + 53 testes Python novos + YAMLs atualizados** | ✅ DONE |
| **PR-14** | **Família `nose`: 7 métricas (`nose_length_to_icd`, `nose_width_to_icd`, `alar_to_face_width_ratio`, `nose_to_mouth_width_ratio`, `dorsum_deviation`, `nasal_tip_deviation`, `alar_base_asymmetry`) + `NOSE_POSE_PARAMS` + migration `0007_SeedNoseFamily` + 63 testes Python novos + YAMLs atualizados. Substituições vs plano original: `nasal_tip_projection` e `nasolabial_angle` (sagital) movidas para PR-23 (multi-foto)** | ✅ DONE |
| **PR-15** | **Família `mouth/lips`: 7 métricas (`mouth_width_to_icd`, `mouth_to_face_width_ratio`, `upper_lip_height_ratio`, `lower_lip_height_ratio`, `vermilion_height_total`, `lip_corner_canting`, `mouth_midline_deviation`) + `MOUTH_POSE_PARAMS` + migration `0008_SeedMouthFamily` + 64 testes Python novos + YAMLs atualizados. Substituições: `cupids_bow_definition` → `mouth_midline_deviation`; `philtrum_width_ratio` adiada para PR-23** | ✅ DONE |
| **PR-16** | **Família `brows`: 8 métricas (`brow_height_l/r`, `brow_arch_peak_l/r`, `brow_thickness_l/r` *(presentation_only)*, `brow_tail_drop_l`, `interbrow_distance_ratio`) + `BROW_POSE_PARAMS` (yaw_weight=0.65) + migration `1746000090000-SeedBrowFamily` + 108 testes Python novos + YAMLs atualizados. `brow_tail_drop_r` adiada para PR-21; `brow_thickness_l/r` presentation_only por DEC-6/DEC-10** | ✅ DONE |
| **PR-17** | **Família `cheekbones / midface`: 5 métricas (`zygomatic_width_ratio`, `malar_projection_index`, `midface_height_ratio`, `cheekbone_to_jaw_ratio`, `submalar_hollow_index`) + `CHEEKBONE_POSE_PARAMS` + migrations `1746000095000-AddCheekbonesEnum` + `1746000100000-SeedCheekbonesFamily` (split para ADD VALUE) + 75 testes Python novos + YAMLs atualizados** | ✅ DONE |
| **PR-18** | **Família `forehead`: 4 métricas (`forehead_height_ratio`, `forehead_width_ratio`, `temporal_width_ratio`, `hairline_curvature_index` *(requires_pixel_analysis=True, stub DEC-10)*) + `FOREHEAD_POSE_PARAMS` (yaw_weight=0.60) + migration `1746000110000-SeedForeheadFamily` (sem ALTER TYPE — 'forehead' já no enum) + 3 metric_ideal + 3 region_metric_weight + 75 testes Python + YAMLs atualizados** | ✅ DONE |
| **PR-19** | **Família `global_shape`: 4 métricas (`face_height_to_width_ratio`, `face_shape_classification` *(presentation_only=True, DEC-6)*, `total_facial_convexity` *(scipy ConvexHull 8-pt)*, `e_line_deviation` *(requires_pixel_analysis=True, stub DEC-10)*) + `GLOBAL_SHAPE_POSE_PARAMS` (yaw_weight=pitch_weight=0.50 — balanceado) + migration `1746000120000-SeedGlobalShapeFamily` (sem ALTER TYPE — 'global' já no enum) + 3 metric_ideal + 2 region_metric_weight + 77 testes Python + YAMLs atualizados** | ✅ DONE |
| **PR-20** | **Família `phi/golden-ratio`: 4 métricas (`phi_face_height_to_width`, `phi_lower_face_segments`, `phi_eye_to_mouth`, `phi_nose_to_lip`) — TODAS `presentation_only=True` (DEC-6) — φ ≠ média populacional (Farkas 1994) + `PHI_POSE_PARAMS` (pitch_weight=0.55, floor=0.25) + migration `1746000130000-SeedPhiGoldenFamily` (0 ideais, 0 pesos) + ~60 testes Python + YAMLs atualizados (comentários DEC-6)** | ✅ DONE |
| **PR-23** | **Multi-foto / Consistência Longitudinal**: `landmark_stability.py` (compute_stability, STABILITY_SLOPE=5.0, LandmarkStabilityResult) + `QualityContext` ampliado (landmark_stability_scores, capture_count) + `confidence_propagation` passo 4 (landmark_stability_penalty, propagate() signature backward-compat) + schemas `MetricsV2Request/Response` (landmark_frames, LandmarkStabilitySchema) + router post-processing de confidence_final + migration `1746000140000-AddLandmarkStabilityColumns` (landmark_stability_scores JSONB + normalization_applied BOOLEAN + partial index) + 54 testes Python. pytest: 1088 passed / 48 skipped.** | ✅ DONE |
| **PR-21 (v1.5 PROVISIONAL)** | **Rebalance estrutural sem fotos reais**: migration `1746000150000-RebalanceWeightsV15` adiciona coluna `is_provisional BOOLEAN DEFAULT FALSE` em `region_metric_weights_version` + `global_weights_version`. Seeda `region_metric_weight v1.5` (cópia de v1.0, sound) e `global_weight v1.5` com **9 regiões** (vs 2 em v1.0 — bug estrutural: jaw/nose/mouth/brows/cheekbones/forehead/global contribuíam ZERO ao global_score). Allocation: symmetry=0.18, eyes=0.16, jaw=0.14, nose=0.12, mouth=0.12, brows=0.10, cheekbones=0.08, forehead=0.05, global=0.05 (Σ=1.0). Critical regions extendidas para `{symmetry,eyes,jaw,nose}` (Naini §10 + Bashour 2006). v1.5 entra como `is_active=FALSE, is_provisional=TRUE` — **v1.0 segue ativa em produção**. Entidades `region-metric-weights-version.entity.ts` + `global-weights-version.entity.ts` ganham campo `isProvisional`. YAMLs `*.v1_5.yaml` criados como mirror declarativo. **Não-empírico — promoção a v2.0 requer PR-22**. Vitest: 116/116 passed; pytest: 1088/48. Roadmap promotion: [`PLAN_PR21_V15_TO_V20_PROMOTION.md`](./PLAN_PR21_V15_TO_V20_PROMOTION.md).** | ✅ DONE (provisional) |
| **PR-24** | **GET endpoints para recuperação de AnalysisReport**: `ReportReaderService` (`getReportById`, `listBySession`) + `GET /v1/analysis/reports/:id` + `GET /v1/analysis/reports?session_id=X&limit=N`. Resposta = mesmo shape do `EvaluateResponseDto` (POST /evaluate). Queries com partition-pruning via `generatedAt` em todas as tabelas filhas. Enriquece `region/family/unit` via join com `MetricDefinitionEntity`. Fallback null-safe para `global_score` ausente. Vitest: 11 novos testes (127/127 passed total).** | ✅ DONE |
| **PR-25** | **Catalog read API — GET /v1/catalog/***. `CatalogModule` novo. 6 rotas: `GET /metrics` (?region/family/version), `GET /metrics/:metricId` (+ideal ativo), `GET /ideals` (?version/region), `GET /versions` (6 dimensões ativas + histórico), `GET /score-bands` (DEC-9 thresholds + disclaimer), `GET /regions` (métricas por região). `CatalogService` lê `metric_definition` (66 rows), `metric_ideal` (59 rows) + 6 tabelas de versão. Sem novas migrations. Fontes documentadas: Farkas 1994, Naini 2011, Powell & Humphreys 1984, Bashour 2006, Sarver & Jacobson 2014, Edler 2001. Vitest: 23 novos testes (150/150 passed total). Commit: `e276fcb`.** | ✅ DONE |
| **PR-30 (M3.1)** | **Overlay Catalog DDL+seed — abertura do Marco 3**. Migration `1746000160000-M3OverlayCatalog` cria 4 tabelas: `overlay_catalog_version` (v1.0 ativa), `overlay_definition` (composite PK overlay_id+version, JSONB display_name/description/legend_text/rendering_hints, enum `overlay_category_enum`), `overlay_metric_dependency` (N:N overlay↔metric_definition + `is_critical` para cascata L1/L2/L3 de PLAN_M3_OVERLAYS §1.1) e `rendered_asset` (composite FK em analysis_report partitioned, `expires_at` NOT NULL, CHECK expires_at>generated_at, partial index on is_expired=FALSE para CRON sweep, enums `rendered_asset_type_enum`/`rendered_asset_format_enum`). Seed v1.0 com 5 overlays baseline: `axis_vertical`, `axis_intercanthal`, `grid_thirds` (3 deps críticas: upper/middle/lower_third_ratio), `grid_fifths` (5 deps críticas: fifth_1..5_ratio), `outline_face` (1 dep não-crítica: global_asymmetry_index) — total 11 overlay_metric_dependency rows. Novo módulo `OverlaysModule` registrando 4 entities. Bug fix colateral: `toVersionEntry()` em `catalog.service.ts` agora aceita `description` opcional. Commit: `7afb545`. | ✅ DONE |
| **PR-32 (M3.1)** | **Python `POST /vision/render` — Pillow overlay renderer**. `backend/app/vision/routers/render.py`: multipart (image, landmarks_json, overlay_ids_json) → PNG `StreamingResponse`. Draws 5 overlays: `axis_vertical` (vertical midline #22d3ee dashed), `axis_intercanthal` (horizontal intercanthal #22d3ee), `grid_thirds` (brow+subnasale horizontals #a5b4fc dashed, Naini 2011 §4), `grid_fifths` (4 vertical canthus lines #a5b4fc dashed, Naini 2011 §6), `outline_face` (#67e8f9, LM_JAWLINE 17pts). Dashed-line PIL helper. L1 guard (≥478 pts). No heatmaps (PR-37/38, Opus). Fontes: Naini 2011 §4-6, Powell & Humphreys 1984, Farkas 1994. Commit: `bb600bf`. | ✅ DONE |
| **PR-31 (M3.1)** | **Frontend `<OverlayLayer>` SVG component + toggle UI**. `frontend/src/components/OverlayLayer.tsx`: SVG absolutely-positioned over photo, renders per-overlay lines (AxisVertical, AxisIntercanthal, GridThirds, GridFifths, OutlineFace). `OverlayToggleBar` com swatches de cor. `DEFAULT_OVERLAYS = ['axis_vertical', 'axis_intercanthal']`. Guards: null se landmarks < 478. Tipo `AnalysisResult` extendido com `landmarks?: Array<[number, number]>`. `PremiumResultPage.tsx`: novo ViewMode `'overlays'`, sidebar toggle, `imgDims` tracking via onLoad. Gated em `result.landmarks` — ativado quando análise retornar landmarks. z-order DEC-25. Commit: `70d5402`. | ✅ DONE |
| **PR-33 (M3.1)** | **Nest `RenderedAssetService` + `POST /v1/overlays/:id/render`**. `MinioStorageService` (SDK minio@^8, uploadPng → `minio://{bucket}/{path}`). `RenderedAssetService.renderAndPersist(reportId, generatedAt, overlayIds, imageUrl)`: load LandmarkPayload → download photo → POST multipart (native FormData Node 24) para Python `/vision/render` → upload PNG MinIO → persist RenderedAssetEntity (expiresAt = now+7d, DEC-24). `OverlaysController`: `POST /v1/overlays/:reportId/render` + `GET /v1/overlays/:reportId/assets`. `OverlaysModule` updated com LandmarkPayloadEntity (cross-module), MinioStorageService, RenderedAssetService, OverlaysController. Commit: `46305d9`. | ✅ DONE |
| **PR-35 (M3.2)** | **DDL `improvement_vector_x/y` em `metric_evaluation_against_ideal`**. Migration `1746000170000-M32AddImprovementVector`: `ADD COLUMN improvement_vector_x NUMERIC(10,6)` + `improvement_vector_y NUMERIC(10,6)` (NULLABLE, IF NOT EXISTS). `MetricEvaluationAgainstIdealEntity`: dois campos `improvementVectorX / improvementVectorY` com `numericTransformer`. Sem FK ou constraint especial — colunas simples. Commit: `749f3ff`. Fontes: PLAN_M3_OVERLAYS §2, DEC-25, Naini 2011 §4-6. | ✅ DONE |
| **PR-34 (M3.2)** | **`improvement_vector` de ponta a ponta: Python calculadores → Nest contrato → DB**. Python: `MetricValue.improvement_vector: tuple[float,float]\|None` (frozen+slots, default=None). 4 calculadores emitem vetores em ICU (normalised intercanthal units), capped ±0.3: `MidlineDeviationCalculator` (vec_x = −mean_signed_x), `ChinHeightRatioCalculator` (vec_y = −(val−ideal)×0.8), `BrowHeightLeft/RightCalculator` (vec_y = −(val−ideal)). Nest: `RawMetricV2.improvement_vector?: [number,number]\|null`, `MetricEvaluationResultDto.improvement_vector_x/y: number\|null`, `OrchestratorService` persiste via `against.improvementVectorX/Y = raw.improvement_vector?.[0/1] ?? null`, `ReportReaderService` expõe campo do entity. 229 testes Python pass. Commit: `61dba5b`. Fontes: PLAN_M3_OVERLAYS §2, DEC-25. | ✅ DONE |
| **PR-36 (M3.2)** | **Frontend SVG `ImprovementVectors` arrows com cores por severity**. `OverlayLayer.tsx`: novo sub-componente `ImprovementVectors` renderiza setas SVG por métrica com `improvement_vector != null`. Âncora por `metric_id`: `midline_deviation→1`, `chin_height_ratio→152`, `brow_height_l→107`, `brow_height_r→336` (hardcoded, MediaPipe Mesh-478). Direção `(vec_x × icd_px, vec_y × icd_px)`. Cores por severity5: mild=#22c55e, moderate=#eab308, strong=#f97316, extreme=#ef4444. z=40 per DEC-25 (renderizado por último no SVG). `OVERLAY_LABELS/STYLES` extendidos com `improvement_vectors`. `OverlayLayerProps` + `metricEvaluations?: MetricEvaluationResult[]`. `types.ts`: novo tipo `MetricEvaluationResult` + campo `metric_evaluations?` em `AnalysisResult`. `PremiumResultPage.tsx` passa `metricEvaluations={result.metric_evaluations}`. Commit: `2f0106a`. Fontes: PLAN_M3_OVERLAYS §2, DEC-25, PLAN_METRICS §5. | ✅ DONE |
| **PR-37 (M3.3)** | **Python `render_asymmetry_heatmap` — Marquardt mirror-distance heatmap (Opus)**. `backend/app/vision/services/heatmap_renderer.py` (novo módulo puro, sem matplotlib). Para cada par em `MIRROR_PAIRS_{JAWLINE,BROWS,EYES}` (8+5+6=19 pares) calcula `||lm_l - mirror(lm_r)|| / icd` em ICU, deposita amostra em ambos endpoints. Interpola via `scipy.interpolate.griddata` cubic (com fallback NaN). Convex-hull mask via `scipy.spatial.ConvexHull(478 mesh)` + ray-casting vectorizado. Colormap coolwarm em pure-numpy (5 anchor stops blue→white→red, baseline visual Moreland 2009). Cascata de supressão: L1 pixel-mask (`<3` vizinhos em `0.5×ICD`), L2 `HeatmapSuppressedError` (`<8` amostras OU `QhullError`). Resolução interna 512², bilinear-upsample para tamanho da foto. Default alpha=0.55 (DEC-25). Composito alpha sobre foto. **12 unit tests** em `backend/tests/unit/test_heatmap_renderer.py` (anchors dos 2 colormaps, NaN→transparente, perfect-face near-white nos pixels renderizados, perturbação aumenta redness, fora do hull transparente, L2 raise, ICD degenerado raise). Suite total: **1100 ✓ + 48 skipped**. Commit: `8d5e4e2`. Fontes: scipy.interpolate.griddata (https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.griddata.html), scipy.spatial.ConvexHull/Qhull (https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.ConvexHull.html), Moreland 2009 coolwarm (https://www.kennethmoreland.com/color-advice/), Crameri et al. 2020 Nature Comm (https://www.nature.com/articles/s41467-020-19160-7), MediaPipe Face Mesh-478 (https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md), Naini 2011 §2, PLAN_M3_OVERLAYS §1.1/§2/§3 DEC-21..26. | ✅ DONE |
| **PR-38 (M3.3)** | **Python `render_ideal_adherence_heatmap` — per-region adherence projection (Opus)**. Mesmo módulo `heatmap_renderer.py` (commit `8d5e4e2`). API: `render_ideal_adherence_heatmap(photo, lm, region_samples: list[RegionAdherenceSample], *, alpha=0.55)`. Cada `RegionAdherenceSample(region, adherence: 0..1, confidence: 0..1)` projeta adherence em todos os landmarks da região (dict `_REGION_ANCHOR_LANDMARKS` cobre eyes/brows/nose/mouth/jaw/chin/midface/cheekbones/forehead/global/symmetry). Regiões com `confidence < 0.4` são silenciosamente puladas (L3 degraded — PLAN_M3_OVERLAYS §1.1). Colormap sequencial `red→amber→green` (3 anchor stops). Mesma cascata L1/L2 + hull mask que asymmetry. Wiring `/vision/render` (commit `2a4a830`): novo dispatch dos 2 overlay_ids ANTES das line overlays, novo form field `region_adherence_json: str | None`, `HeatmapSuppressedError` → HTTP 422 `{overlay_id, suppressed, samples}`. Commit: `8d5e4e2` (renderer) + `2a4a830` (endpoint). Fontes: PLAN_M3_OVERLAYS §1.1 (cascata) + §2 PR-38, Naini 2011 §2, mesmas refs scipy/colormap do PR-37. | ✅ DONE |
| **PR-39 (M3.3)** | **Nest seed `overlay_definition` para `heatmap_asymmetry` + `heatmap_ideal_adherence`**. Migration `1746000190000-M33HeatmapOverlays`. Enums já existiam desde PR-30 (`overlay_category_enum` inclui `'heatmap'`; `rendered_asset_type_enum` inclui ambos overlay_ids), portanto migration é puro INSERT. Ambos overlays: category=`heatmap`, z_order=30, default_visible=FALSE, alpha=0.55. **heatmap_asymmetry** rendering_hints: `colormap=coolwarm, saturation_icu=0.10, density_radius_icu=0.5, min_neighbours=3, grid_resolution=512`; deps CRÍTICAS: `midline_deviation`, `global_asymmetry_index`. **heatmap_ideal_adherence** rendering_hints: `colormap=adherence_sequential, alpha=0.55, confidence_threshold=0.4, density_radius_icu=0.5, min_neighbours=3, grid_resolution=512`; 9 deps NÃO-críticas (region tag): eye_height_asymmetry (eyes), brow_height_asymmetry (brows), lip_canting_angle (mouth), global_asymmetry_index (jaw), upper/middle/lower_third_ratio (forehead/midface/chin), fifth_2/4_ratio (cheekbones). `down()` reverte ambas overlay_definition + 11 overlay_metric_dependency. Migration aplicada com sucesso em `face_analysis @ localhost:9019` (`SELECT category='heatmap'` retorna 2 rows). Commit: `3d18a5b`. Fontes: PLAN_M3_OVERLAYS §2 PR-39 + DEC-21..26. | ✅ DONE |
| **PR-40 (M3.3)** | **Frontend toggle de heatmap + `<HeatmapImageLayer>` PNG image layer**. `frontend/src/components/OverlayLayer.tsx`: `OVERLAY_LABELS`/`OVERLAY_STYLES`/`HEATMAP_OVERLAY_IDS` extendidos com os 2 heatmaps (swatch coolwarm hot end `#b40426` + sequential ideal end `#3cb45a`). Novo componente `HeatmapImageLayer({imageWidth, imageHeight, activeOverlays, heatmapAssetUrls?})` renderiza `<img>` PNG (server-rendered) absolutely-positioned **abaixo** do `<OverlayLayer>` SVG, garantindo que axes/grids/contornos/vetores fiquem legíveis por cima (z-order DEC-25: heatmap z=30 abaixo de lines z=10/20/40). `PremiumResultPage.tsx` importa e instancia `<HeatmapImageLayer>` ao lado do `<OverlayLayer>` no view `'overlays'`. Plumbing do `heatmapAssetUrls` (fetch ao endpoint Nest `POST /v1/overlays/:reportId/render`) deferido a follow-up Sonnet — toggle visível mas layer é no-op até então (UI scaffolding é a parte Opus). Frontend não tem suite Vitest; validado via `tsc --noEmit` (clean) + `vite build` (clean, 51 módulos, 234.75 kB bundle). Commit: `494ca75`. Fontes: PLAN_M3_OVERLAYS §2 PR-40 + DEC-25, palette do `relatorio_mvp.html`. |✅ DONE |
| **PR-50 (M4.1)** | **DiagnosticTemplates DDL+seed v0.1 — abertura do M4.1 (infra de templates)**. Migration `1746000180000-M41DiagnosticTemplates`: 4 tabelas não-particionadas — `diagnostic_template_version` (versionamento, partial unique index `is_active=TRUE`, mirror de `ideals_version`), `diagnostic_template` (composite UNIQUE `(version, metric_id, severity, direction, size)` + index de lookup, FK `version`→`diagnostic_template_version`, `severity` reusa `severity_5_enum` de PR-3, `direction` TEXT free-form, `size` CHECK `IN ('short','medium','long')`, `placeholders_used` JSONB array como contrato com renderer), `template_blacklist_version` (mesmo pattern), `template_blacklist_term` (FK `version`, `term` lowercase, `category` CHECK 5 valores, UNIQUE `(version, term)`). Seed v0.1 ativa: 5 templates exemplares (1 por região M1: midline_deviation/symmetry/moderate/right_dominant, upper_third_ratio/proportion/mild/longer, eye_aperture_ratio_l/eyes/moderate/shorter, jaw_width_ratio/jaw/mild/wider, brow_height_l/brows/moderate/shorter), todos `size='medium'`, com `placeholders_used` derivado de cada template. Blacklist v0.1 ativa: 10 termos baseline (diagnostico, diagnostica, patologia, deficiencia, disturbio, deformidade, anomalia, garantimos, vai melhorar, corrige). Tone source: PLAN_M4_NARRATIVE §1.1 + Naini 2011 §2-6 + Powell & Humphreys 1984 + Farkas 1994. DEC-30/31/39/40/41 persisted no header da migration. Catálogo full v1.0 (~300-500 templates) deferido a PR-53 (Opus). Migration aplicada com sucesso em DB local (face_analysis @ localhost:9019). | ✅ DONE |
| **PR-51 (M4.1)** | **`TemplateRendererService` com allowlist estrito + 4 falhas claras**. `nest/src/modules/diagnosis/template-renderer.service.ts`: `render({template, placeholdersUsed, context})` substitui tokens `{snake_case}` (regex `/\{([a-z_][a-z0-9_]*)\}/g`) e impõe 4 gates — (1) `placeholder_not_allowed`: cada item em `placeholdersUsed` deve estar em `ALLOWED_PLACEHOLDERS = ['value','ideal','deviation_pct','direction_label','region_pt']`; (2) `undeclared_placeholder`: cada `{x}` no template deve estar em `placeholdersUsed`; (3) `missing_context_value`: cada declarado deve ter valor em `context`; (4) `extraneous_context_key`: `context` não pode carregar chaves não-declaradas. Erros via `TemplateRenderError` com `code` enumerado. Service registrado em `DiagnosisModule.providers/exports`. **11 testes Vitest novos** (allowlist sanity, 5 happy paths, 4 falhas, regex safety: `{Uppercase}` e `{with-dash}` não substituem). Total: 161/161 Vitest passed. | ✅ DONE |
| **PR-52 (M4.1)** | **CI lint script `lint-templates.ts` para blacklist scan**. `nest/scripts/lint-templates.ts` + `npm run lint:templates` (tsx). Conecta via `AppDataSource`, carrega versão ativa de `diagnostic_template_version` + `template_blacklist_version`, faz substring match (template_pt lowercased) contra cada termo. Exit codes: 0 (clean ou sem versão ativa), 1 (violations), 2 (runtime error). Output detalhado por hit (metric_id/severity/direction/size + termo + categoria + excerpt ±30 chars). Validado contra DB local: 5 rows × 10 termos → 0 hits. CI integration deferida (workflow atual `deploy.yml` só roda deploy, sem step de test); comando documentado para futuro pipeline. | ✅ DONE |

**M1 completo**: `POST /v1/analysis/evaluate` recebe landmarks + quality_context, chama Python `/vision/metrics-v2`, compara contra ideais do banco, persiste `AnalysisReport` + `MetricEvaluation[]` + `MetricEvaluationAgainstIdeal[]` em transação única. **PR-24**: `GET /v1/analysis/reports/:id` + `GET /v1/analysis/reports?session_id=X` entregam recuperação de relatórios persistidos com shape idêntico ao POST response. **PR-25**: `CatalogModule` expõe 6 rotas GET /v1/catalog/* para descoberta de métricas, faixas de ideais, versões ativas e thresholds de score.

**M3.1 completo (PR-30..33)**: Overlay Catalog DDL+seed v1.0 (PR-30), Python `/vision/render` Pillow renderer (PR-32), Frontend `<OverlayLayer>` SVG (PR-31), Nest `RenderedAssetService` + `POST /v1/overlays/:id/render` + MinioStorageService (PR-33). Commits: `7afb545`, `bb600bf`, `70d5402`, `46305d9`.

**M3.2 completo (PR-34..36)**: Improvement vectors — DDL `improvement_vector_x/y` em `metric_evaluation_against_ideal` (PR-35, commit `749f3ff`), `MetricValue.improvement_vector` + 4 calculadores Python (`MidlineDeviationCalculator`, `ChinHeightRatioCalculator`, `BrowHeightLeft/RightCalculator`) + Nest `MetricEvaluationResultDto` + `OrchestratorService` persist + `ReportReaderService` expose (PR-34, commit `61dba5b`), Frontend `ImprovementVectors` SVG arrows com cores por severity + toggle "Vetores de melhoria" + `MetricEvaluationResult` type (PR-36, commit `2f0106a`). Convenção ICU (normalised intercanthal units), capped ±0.3, z=40 per DEC-25.

**M3.3 completo (PR-37..40)**: Heatmaps faciais (assimetria + aderência ao ideal) — Python `heatmap_renderer.py` puro (sem matplotlib), 2 renderers (asymmetry via Marquardt mirror distance + ideal_adherence via per-region adherence projection), interpolação `scipy.interpolate.griddata` cubic, convex-hull mask `scipy.spatial.ConvexHull` + ray-casting, colormaps coolwarm + adherence_sequential em pure-numpy, cascata L1 (density `<3` vizinhos em `0.5×ICD`) + L2 (`HeatmapSuppressedError`) + L3 (caller skip per-region) per PLAN_M3_OVERLAYS §1.1 (PR-37/38, commit `8d5e4e2` + wiring `2a4a830`). Nest seed: 2 overlay_definition rows com 11 overlay_metric_dependency (2 críticas + 9 não-críticas) via migration `1746000190000-M33HeatmapOverlays` (PR-39, commit `3d18a5b`); enums `'heatmap'`/`'heatmap_asymmetry'`/`'heatmap_ideal_adherence'` já existiam desde PR-30 (migration prescient). Frontend: toggle no `<OverlayToggleBar>` + novo `<HeatmapImageLayer>` PNG `<img>` posicionado abaixo do `<OverlayLayer>` SVG (z=30 per DEC-25), plumbing do fetch ao endpoint Nest deferido a follow-up Sonnet (PR-40, commit `494ca75`). 12 unit tests novos em `test_heatmap_renderer.py` (suite total: 1100 ✓ + 48 skipped Python; tsc + vite build clean no frontend). Fontes: scipy.interpolate.griddata (https://docs.scipy.org/doc/scipy/reference/generated/scipy.interpolate.griddata.html), scipy.spatial.ConvexHull/Qhull (https://docs.scipy.org/doc/scipy/reference/generated/scipy.spatial.ConvexHull.html), Moreland 2009 coolwarm (https://www.kennethmoreland.com/color-advice/), Crameri et al. 2020 *Nature Communications* (https://www.nature.com/articles/s41467-020-19160-7), MediaPipe Face Mesh-478 (https://github.com/google-ai-edge/mediapipe/blob/master/docs/solutions/face_mesh.md), Naini 2011 §2, Powell & Humphreys 1984, Farkas 1994, PLAN_M3_OVERLAYS §1.1/§2/§3 DEC-21..26. Próximos: M3.4 BeforeIdealComposer vetorial PR-41 (**Opus required**).

**M4.1 completo (PR-50..52)**: Infra de templates diagnósticos — DDL+seed v0.1 (PR-50: 4 tabelas `diagnostic_template_version` + `diagnostic_template` + `template_blacklist_version` + `template_blacklist_term`; 5 templates exemplares + 10 termos blacklist; severity reusa `severity_5_enum`; `placeholders_used` JSONB como contrato), `TemplateRendererService` (PR-51: render com 4 gates de allowlist + 11 testes Vitest), CI lint script (PR-52: `npm run lint:templates` valida `template_pt` contra blacklist ativa). Catálogo full v1.0 (~300-500 templates, judgment de tom) deferido a **PR-53 (Opus required)**. Fontes: PLAN_M4_NARRATIVE §1.1 (linha vermelha — verbos proibidos), §2 (M4.1 backlog), §3 (DEC-30..DEC-34 + DEC-39..DEC-41), Naini 2011 §2-6, Powell & Humphreys 1984, Farkas 1994.

**M2 (em andamento)**: PR-12 entregou scoring infra; PR-13 (`jaw`, 6 métricas), PR-14 (`nose`, 7 métricas), PR-15 (`mouth/lips`, 7 métricas), PR-16 (`brows`, 8 métricas), PR-17 (`cheekbones`, 5 métricas), PR-18 (`forehead`, 4 métricas — 3 activas + 1 pixel-dep stub), PR-19 (`global_shape`, 4 métricas — 2 activas + 1 presentation_only + 1 pixel-dep stub), PR-20 (`phi/golden`, 4 métricas — TODAS presentation_only=True, DEC-6, sem ideais, sem pesos), PR-23 (multi-foto / landmark stability — infra de confiança), PR-21 v1.5 PROVISIONAL (rebalance estrutural — 9 regiões em global_weight), PR-24 (GET report retrieval) e PR-25 (Catalog API) já entregues. Total: **150 testes Vitest, 1088 testes Python**. DB com 66 metric_definitions, 59 metric_ideals. Próximas fatias do M2: **PR-22 (calibração com fotos reais — tarefa humana, ≥30 fotos)** → habilita promoção PR-21 v1.5→v2.0 (ver [`PLAN_PR21_V15_TO_V20_PROMOTION.md`](./PLAN_PR21_V15_TO_V20_PROMOTION.md) e [`PLAN_PR22_REAL_PHOTOS.md`](./PLAN_PR22_REAL_PHOTOS.md)). Detalhe completo em [`PLAN_M2_BACKLOG.md`](./PLAN_M2_BACKLOG.md).

---

## 1. Separação Python ↔ Nest (regra dura — NÃO QUEBRAR)

A separação correta entre os dois serviços é a coisa mais importante deste plano. Quebrar em qualquer PR é defeito grave que vai contaminar tudo a jusante.

### FastAPI (Python) — só o que precisa de numpy/scipy/OpenCV

- Detecção de landmarks (fallback server-side via MediaPipe — já existe parcialmente)
- Normalização de landmarks (matrizes, geometria) — PR-4
- Cálculo das métricas atômicas (geometria com numpy) — PR-5..8
- Propagação de confiança (acoplada ao cálculo das métricas)
- Futuro (M3): renderização de overlays/heatmaps com Pillow/OpenCV
- **Não toca no Postgres. Não tem ORM. Não conhece nenhum YAML de configuração.**

### Nest (TypeScript) — orquestração, interpretação, persistência

- Ownership do Postgres + migrations TypeORM
- Todas as entities e repositórios
- Carregamento dos YAMLs de configuração
- `IdealComparator` (deviation, direction)
- `SeverityClassifier` (5→3 via `severity_collapse_policy`)
- Score regional + global + banding (M2+)
- Versionamento e snapshots em cada análise
- Aggregate root `AnalysisReport`
- Persistência transacional
- Endpoint exposto pro frontend (`POST /api/analyze`)

### Frontend (React/Next)

- MediaPipe WASM (modo padrão de captura)
- Render de overlays SVG (M3)
- Toggle UI

### YAMLs de configuração — todos no repo do Nest

Vivem em `nest/src/config/yaml/` (ou similar):

- `metric_ideals.yaml` — faixas verde/amarelo/vermelho por métrica
- `region_metric_weights.yaml` — peso de cada métrica na sua região (M2)
- `global_weights.yaml` — pesos por dimensão para score global (M2)
- `diagnostic_templates.yaml` — templates de texto por (metric_id, severity, direction, size) (M4)
- `recommendations_catalog.yaml` — catálogo de recomendações (M4)
- `overlay_definitions.yaml` — catálogo de overlays (M3)

Python não vê nenhum desses arquivos. Se em algum PR aparecer YAML em `backend/`, é defeito.

### `metric_registry` — caso especial

Python tem registry interno em código (uma função decorada por `metric_id`). A "carteira de identidade" canônica (região, peso, unit, presentation_only) vive no Nest na tabela `metric_definition`. Python expõe `GET /vision/capabilities` listando os `metric_id` que sabe calcular; Nest valida em CI que o catálogo bate com o que o Python oferece. Em runtime, Nest envia a lista de `metric_id` a calcular junto com os landmarks no request.

---

## 2. Decisões travadas (DEC-1 a DEC-20)

Mudar qualquer uma exige reabertura explícita. Algumas mudanças invalidam histórico.

### Bloqueantes (mudar invalida dados)

| ID | Decisão |
|----|---------|
| DEC-1 | **Base de normalização**: distância intercanthal (canto interno↔canto interno do olho). Toda métrica `unit=ratio` é relativa a ela. |
| DEC-2 | **Conceito de ideal**: híbrido. M1 só canônico + literatura aberta (Farkas só M2+). |
| DEC-3 | **Severidade**: 5 níveis em `metric_evaluation_against_ideal` (`ideal\|mild\|moderate\|strong\|extreme`); 3 em `diagnostic_candidate` (`LEVE\|MODERADO\|SEVERO`). Colapso: `ideal+mild→LEVE`, `moderate→MODERADO`, `strong+extreme→SEVERO`. Persistido em `severity_collapse_policy`. |
| DEC-4 | **i18n**: campo `locale` desde já, default `pt-BR`. Display names em JSONB `{locale: text}`. |
| DEC-5 | **Aggregate root**: `analysis_report` é a raiz unificada. FK opcional para `diagnostic_report` e `decision_output` (coexistência durante migração). |

### Estratégicas (afetam design, mas reversíveis)

| ID | Decisão |
|----|---------|
| DEC-6 | **`presentation_only` regra DURA em código**: `regional_scorer`/`global_scorer` recusam por assertion. Phi/golden ratio aparecem em overlay mas nunca em score. |
| DEC-7 | **Thresholds em `analysis_threshold_config`** (versionada). Defaults: `min_confidence_to_display_metric=0.4`, `min_confidence_to_show_global_score=0.5`. |
| DEC-8 | **Regiões críticas para gating do score global**: olhos, simetria, proporção_vertical, mandíbula. Se qualquer uma das quatro tiver `confidence < 0.5`, score global vira null. |
| DEC-9 | **Bandas de score**: `<50` mostra apenas "explore oportunidades de harmonização" sem número; `50–70` mostra número + "rosto com aspectos a refinar"; `70–85` "boa harmonia geral"; `>85` "alta harmonia". |
| DEC-10 | **Pixel-dependentes**: cadastra em `metric_definition` com `requires_pixel_analysis=true`, MAS pipeline pula (não emite `metric_evaluation`). |
| DEC-11 | **Multi-captura adiada**. `landmark_payload.capture_count INT DEFAULT 1` reservado. |
| DEC-12 | **Versionamento**: 7 tabelas `*_version` independentes agora; agregador (`analysis_versioning_set`) depois. |
| DEC-13 | **`user_context`** (sex/age) aceito mas IGNORADO no M1. Registrado em `processing_notes` quando presente. |
| DEC-14 | **MinIO** para assets renderizados. Paths: `/rendered/single/{report_id}.png`, `/rendered/region/{report_id}/{region}.png`, `/rendered/before-ideal/{report_id}.png`, `/reports/pdf/{report_id}.pdf`. TTL + opt-in (mesma policy de `photo_storage`). |
| DEC-15 | **Before/ideal**: M3 vetorial (sem warp). Warp pós-M3. |

### Operacionais

| ID | Decisão |
|----|---------|
| DEC-16 | **`metric_id` snake_case inglês** + `display_name` JSONB i18n. |
| DEC-17 | **`metric_evaluation` e `analysis_report` particionadas RANGE mensal** por `generated_at` desde o CREATE. |
| DEC-18 | **DDL incremental por marco**: levas 1+2 antes do M1; demais ao longo dos M2-M4. |
| DEC-19 | **Legado paralelo (A)**: `services/metrics/` novo no Python. `/vision/metrics` legado intocado, deprecation só em M3-M4. |
| DEC-20 | **Postgres entra no M1**. ✅ DONE no PR-1. Migration `0000_extensions` isolada para `pgcrypto`. ✅ DONE no PR-2. |

---

## 3. Disclaimer canônico (congelado em `disclaimer_text_snapshot` v1)

> "Esta análise é uma observação estética e geométrica produzida a partir de uma única foto. Não constitui diagnóstico médico, odontológico, fisioterapêutico ou de qualquer natureza clínica, e não substitui avaliação profissional presencial. Os resultados são sensíveis à qualidade da foto, ângulo, iluminação e expressão capturados. Se você apresenta dor, dificuldade funcional (na mastigação, respiração ou postura) ou desconforto persistente, procure um profissional habilitado."

Versionado junto com `threshold_config_version`. Nunca substitua sem incrementar versão.

---

## 4. Política de confiança baixa

FastAPI SEMPRE devolve as 20 métricas. Cada uma com:

- `is_low_confidence` (bool, derivado de `confidence_final < 0.4`)
- `displayable` (bool — adicional, NestJS aplica antes de mandar ao frontend)

Filtragem é responsabilidade do Nest. Persistência preserva tudo (auditoria + recalibração futura). Frontend nunca vê métrica abaixo do threshold, mas o histórico tem tudo.

---

## 5. Fase 1 — Catálogo expandido de métricas atômicas

### 5.1 Carteira de identidade obrigatória

Toda métrica calculada pelo Python carrega no JSON de saída:

- `metric_id` — snake_case inglês, estável (não muda em refactor)
- `region` — `eyes\|brows\|nose\|mouth\|jaw\|chin\|midface\|cheeks\|forehead\|global\|symmetry\|photo_quality`
- `family` — `symmetry\|thirds\|fifths\|eyes\|brows\|nose\|mouth\|jaw\|cheekbones\|forehead\|global_shape\|phi\|photogenia`
- `unit` — `intercanthal_units\|ratio\|degrees\|percent\|index_0_1`
- `value` — número bruto
- `error` — incerteza propagada
- `confidence_raw` — antes das penalidades regionais/pose
- `confidence_final` — após todas as penalidades
- `direction` — `neutral\|left_dominant\|right_dominant\|longer\|shorter\|wider\|narrower\|...`
- `dependency_landmarks` — array de índices MediaPipe consumidos
- `presentation_only` — boolean (decorativa, não entra em score)

Nada de `severity` ou `against_ideal` no Python — isso é Nest. Python devolve `value/error/confidence` e o Nest classifica.

### 5.2 Normalização (DEC-1, congelada)

Pipeline obrigatório antes de QUALQUER métrica:

1. **Pose correction**: aplica yaw/pitch/roll (vindos do Módulo 0) para projetar landmarks no plano frontal canônico
2. **Centralização**: centroide facial vai para origem
3. **Escala intercanthal**: distância entre cantos internos dos olhos vira 1.0
4. **Alinhamento de midline**: rotação 2D para deixar a linha intercanthal horizontal (corrige roll residual)

Saída: `NormalizedLandmarks` com `basis="intercanthal"`. Toda métrica downstream consome esse objeto.

Mudar a base de normalização depois invalida todo histórico. Não fazer.

### 5.3 Famílias do M1 — escopo das 20 métricas

#### Família simetria (5 métricas — PR-5)
- `midline_deviation` — desvio médio de testa/nariz/philtrum/mentum vs eixo vertical
- `eye_height_asymmetry` — diferença Y entre centros dos olhos
- `brow_height_asymmetry` — diferença Y entre picos das sobrancelhas
- `lip_canting_angle` — inclinação da linha que une cantos da boca
- `global_asymmetry_index` — média ponderada das 4 anteriores

Region: `symmetry`. Unit: `intercanthal_units` ou `degrees`.

#### Família terços (4 métricas — PR-6)
- `upper_third_ratio` — testa/comprimento total
- `middle_third_ratio` — sobrancelha→base do nariz / total
- `lower_third_ratio` — base do nariz→queixo / total
- `dominant_third` — categórica: `upper\|middle\|lower`

Ideal canônico: 0.333 cada. Green ±0.02, yellow ±0.05.

#### Família quintos (5 métricas — PR-7)
- `fifth_1_ratio` a `fifth_5_ratio` — largura de cada quinto / largura facial
- `intercanthal_to_eye_width_ratio` — espaçamento intercanthal / largura ocular média

Ideal canônico: 0.20 cada. Green ±0.02.

#### Família olhos (6 métricas — PR-8)
- `eye_aperture_ratio_l` / `eye_aperture_ratio_r` — altura/largura do olho
- `interpupillary_distance` — em unidades intercanthais
- `intercanthal_distance` — sanity check (deve ser 1.0 por construção)
- `canthal_tilt_l` / `canthal_tilt_r` — ângulo da linha canto interno→canto externo

**Total M1: 20 métricas (5+4+5+6).**

### 5.4 Famílias adiadas (M2)

mandíbula, nariz, boca/lábios, sobrancelhas, maçãs, testa, formato global. Cada uma vai virar PR no M2. Phi/golden é família opcional, marcada como `presentation_only=true`.

### 5.5 Pixel-dependentes (DEC-10)

Métricas que precisam de análise de pixel além de landmarks (acne, olheiras, qualidade da pele, espessura real de sobrancelha, densidade de barba) são cadastradas em `metric_definition` com `requires_pixel_analysis=true`. O pipeline as **pula** — não emite `metric_evaluation` nem `metric_evaluation_against_ideal`. Reservam o `metric_id` no contrato. Voltar a elas pós-M4 com módulo dedicado.

### 5.6 Propagação de confiança

Python aplica em cascata, em ordem:

1. Pega `quality_score` global do Módulo 0 — limita `confidence_raw`
2. Aplica `regional_penalties[region]` correspondente — ex: métrica de jaw multiplica por `(1 - regional_penalties.jaw)`
3. Aplica curva de pose (sigmóide invertida — pequenos desvios <5° quase não penalizam, ≥10° penalizam fortemente). Ajustar por região: terços sofrem menos com yaw que simetria.
4. Estabilidade de landmarks (multi-captura, M2+) entra como terceiro fator. M1 ignora.

`confidence_final = confidence_raw * regional_penalty * pose_penalty`, clipado em [0, 1].

---

## 6. Fase 2 — Engine de ideais e scoring (NO NEST, M2)

Resumo. Detalhamento em outro documento quando o M2 começar.

- `metric_ideals.yaml` no repo do Nest, indexado por `metric_id`
- `IdealComparator` (Nest) consome `metric_value` (vindo do Python) + `metric_ideal` → produz `deviation_raw`, `deviation_normalized`, `direction_label`
- `SeverityClassifier` (Nest) usa `severity_collapse_policy` para mapear 5→3
- Score por região: `(1 - |deviation_normalized|) * confidence_final`, ponderado por `region_metric_weights.yaml`
- Score global: combinação ponderada dos regionais via `global_weights.yaml`
- Banding (DEC-9) aplicado antes de devolver ao frontend

Fora do M1.

---

## 7. Fase 3 — Overlays (M3)

Resumo:

- SVG no cliente (interativo, com toggle de camadas)
- Raster server-side via `POST /vision/render` no Python (Pillow/OpenCV) para export PDF/PNG
- Heatmaps (assimetria, aderência ao ideal) gerados no Python via `scipy.interpolate.griddata`
- Composição "before/ideal" vetorial primeiro, warp pós-M3

Fora do M1 e M2.

---

## 8. Fase 4 — Diagnóstico textual e plano de ação (M4)

Resumo:

- `diagnostic_templates.yaml` indexado por `(metric_id, severity, direction, size)`, três tamanhos (short/medium/long)
- Priorização por severidade × confiança × peso × acionabilidade
- Catálogo de recomendações com categorias (`photo`, `posture`, `lifestyle`, `styling`, `professional_referral`, `presentation_only`)
- Disclaimer obrigatório no fim de todo relatório
- Geração de PDF como passo final

Fora do M1.

---

## 9. Estrutura de pastas — split correto

### FastAPI (Python) — `backend/app/`

```
backend/app/
├── core/config.py
├── domain/
│   ├── normalized_landmarks.py     # dataclass NormalizedLandmarks(basis="intercanthal")
│   └── metric_value.py             # dataclass do que sai pro Nest
├── services/
│   ├── normalization/              # PR-4 (próximo)
│   │   ├── pose_correction.py
│   │   ├── intercanthal_scaler.py
│   │   ├── midline_aligner.py
│   │   └── normalizer.py           # orquestra os 3 acima
│   └── metrics/                    # PR-5..8
│       ├── base.py                 # ABC + decorator @register_metric
│       ├── registry.py             # MetricRegistry interno
│       ├── confidence_propagation.py
│       ├── symmetry.py             # PR-5
│       ├── thirds.py               # PR-6
│       ├── fifths.py               # PR-7
│       └── eyes.py                 # PR-8
├── vision/
│   ├── routers/
│   │   ├── metrics.py              # legado, intocado (DEC-19)
│   │   ├── metrics_v2.py           # novo endpoint, M1
│   │   └── capabilities.py         # GET /vision/capabilities
│   └── schemas/
│       ├── normalize_request.py
│       ├── metrics_v2_request.py
│       └── metrics_v2_response.py
└── tests/
    ├── fixtures/
    │   ├── synthetic_perfect_face.py    # PR-4
    │   ├── known_asymmetric_face.py     # PR-4
    │   └── posed_face.py                # PR-4
    └── unit/
        ├── normalization/
        ├── metrics/
        └── confidence/
```

**O que NÃO existe no Python**: `infra/db/`, `alembic/`, `repositories/`, `services/ideals/`, `services/scoring/`, `services/diagnosis/`, qualquer YAML de configuração.

### Nest — `nest/src/`

```
nest/src/
├── database/
│   ├── data-source.ts
│   ├── database.module.ts
│   └── migrations/
│       ├── 1746000000000-Extensions.ts            # DONE
│       ├── 1746000010000-Catalogs.ts              # DONE
│       ├── 1746000020000-SeedInitialCatalogs.ts   # DONE
│       └── 1746000030000-EvaluationsAndRoot.ts    # DONE
├── modules/
│   ├── analysis/
│   │   ├── analysis.module.ts
│   │   ├── api/
│   │   │   └── analyze.controller.ts              # POST /api/analyze (PR-10)
│   │   ├── application/
│   │   │   └── analysis.orchestrator.ts           # PR-10
│   │   ├── domain/
│   │   │   ├── types/catalog.types.ts             # DONE
│   │   │   └── services/
│   │   │       ├── ideal-comparator.service.ts    # PR-9
│   │   │       └── severity-classifier.service.ts # PR-9
│   │   └── infrastructure/
│   │       ├── entities/                          # 10 entidades (6 do PR-2 + 4 do PR-3)
│   │       │   ├── metric-registry-version.entity.ts
│   │       │   ├── metric-definition.entity.ts
│   │       │   ├── ideals-version.entity.ts
│   │       │   ├── metric-ideal.entity.ts
│   │       │   ├── analysis-threshold-config.entity.ts
│   │       │   ├── severity-collapse-policy.entity.ts
│   │       │   ├── analysis-report.entity.ts
│   │       │   ├── landmark-payload.entity.ts
│   │       │   ├── metric-evaluation.entity.ts
│   │       │   └── metric-evaluation-against-ideal.entity.ts
│   │       └── repositories/
│   └── vision/
│       └── vision.client.ts                        # cliente HTTP pro FastAPI
└── config/
    └── yaml/                                       # carregados em runtime pelo Nest
        ├── metric_ideals.yaml                      # M1 (PR-9)
        ├── region_metric_weights.yaml              # M2
        ├── global_weights.yaml                     # M2
        ├── diagnostic_templates.yaml               # M4
        ├── recommendations_catalog.yaml            # M4
        └── overlay_definitions.yaml                # M3
```

---

## 10. Contratos de endpoint

### Python: `POST /vision/metrics-v2`

**Request:**
```json
{
  "session_id": "uuid",
  "landmarks": [[x, y], ...],
  "quality_context": {
    "quality_score": 0.86,
    "regional_penalties": {"jaw": 0.1, "eye": 0.0, "nose": 0.0, "...": 0.0},
    "pose": {"yaw": 5.2, "pitch": -1.0, "roll": 0.8}
  },
  "metric_ids_to_compute": ["midline_deviation", "..."]
}
```

**Response:**
```json
{
  "normalization": {"basis": "intercanthal", "applied": true},
  "metrics": [
    {
      "metric_id": "eye_height_asymmetry",
      "region": "symmetry",
      "family": "symmetry",
      "unit": "intercanthal_units",
      "value": 0.048,
      "error": 0.005,
      "confidence_raw": 0.95,
      "confidence_final": 0.82,
      "is_low_confidence": false,
      "direction": "left_dominant",
      "dependency_landmarks": [33, 133, 263, 362],
      "presentation_only": false
    }
  ]
}
```

Python NÃO devolve: comparação contra ideal, severidade, scores agregados, texto.

### Python: `GET /vision/capabilities`

Retorna lista de `metric_id` que o Python sabe calcular. Nest valida em CI que bate com `metric_definition` da versão ativa.

### Nest: `POST /api/analyze` (frontend chama esse)

**Orquestração interna:**
1. Lê `metric_definition` da versão ativa para descobrir lista de `metric_id` a calcular (filtrando `requires_pixel_analysis=false`)
2. Chama `POST /vision/metrics-v2` no Python com a lista
3. Carrega `metric_ideal` da versão ativa via `metric_ideals.yaml` e/ou DB
4. Aplica `IdealComparator` → `deviation_raw`, `deviation_normalized`, `direction_label`
5. Aplica `SeverityClassifier` → `severity_5`, `severity_3` (via `severity_collapse_policy`)
6. Persiste em transação única: `analysis_report` + `landmark_payload` + 20× `metric_evaluation` + 20× `metric_evaluation_against_ideal`
7. Devolve `AnalysisReport` ao frontend com snapshots de versão e disclaimer

**Response do `/api/analyze` (M1):**
```json
{
  "analysis_report_id": "uuid",
  "metric_registry_version": "v1.0",
  "ideals_version": "v1.0",
  "threshold_config_version": "v1.0",
  "normalization": {"basis": "intercanthal"},
  "metrics": [
    {
      "metric_id": "eye_height_asymmetry",
      "region": "symmetry",
      "value": 0.048,
      "confidence_final": 0.82,
      "is_low_confidence": false,
      "displayable": true,
      "direction": "left_dominant",
      "against_ideal": {
        "ideal_central_value": 0.0,
        "deviation_raw": 0.048,
        "deviation_normalized": 1.6,
        "severity_5": "moderate",
        "severity_3": "MODERADO",
        "direction_label": {"pt-BR": "olho esquerdo mais alto"}
      }
    }
  ],
  "processing_notes": [],
  "disclaimer": "Esta análise é uma observação estética..."
}
```

Sem score regional/global, sem texto, sem overlay no M1.

---

## 11. Marcos

- **M1** (✅ done): núcleo analítico — 21 métricas, comparação contra ideal, persistência. Sem texto, sem overlay, sem score regional/global.
- **M2** (🟡 em andamento, primeira fatia entregue no PR-12): famílias restantes (mandíbula, nariz, boca, sobrancelhas, maçãs, testa, global) → 60+ métricas. Score regional + global com banding (✅ PR-12). Calibração com 30-50 fotos reais. **Backlog detalhado em [`PLAN_M2_BACKLOG.md`](./PLAN_M2_BACKLOG.md)**.
- **M3**: overlays SVG no frontend + heatmaps + composição before/ideal vetorial + endpoint `POST /vision/render`. **Plano detalhado em [`PLAN_M3_OVERLAYS.md`](./PLAN_M3_OVERLAYS.md)**.
- **M4**: templates de texto + priorização + recomendações catalogadas + PDF do relatório + disclaimers. **Plano detalhado em [`PLAN_M4_NARRATIVE.md`](./PLAN_M4_NARRATIVE.md)**.

> **Reavaliação caso a caso a partir do M2**: cada marco próximo tem sub-marcos com PRs atômicos. Ver os arquivos específicos.
>
> **Modelos recomendados** (do prompt do usuário):
> - **M2 (calibração de ideais, PRs 21-22)**: Opus — julgamento sobre fontes (Farkas vs Naini), divergencias, variação por sexo/idade.
> - **M3.3 (heatmaps + before/ideal)**: Opus — supressão em cascata, interpolação `griddata`, mapeamento de cor.
> - **M4.2 (templates) e M4.3 (recomendações)**: Opus — implicação legal/ética do tom + classificação `lifestyle` vs `professional_referral`.
> - PRs de família de métrica (PR-13..20), infra de overlay (PR-30..36, 39..43), infra de template/PDF (PR-50..52, 55, 57..62): Sonnet com bom contexto basta.

---

## 12. Armadilhas a evitar

**Não trate landmarks ruins como bons.** A maior fonte de bug não é cálculo errado — é cálculo certo sobre landmarks instáveis. Sempre cheque a confiança que vem do Módulo 0 antes de qualquer coisa.

**Não cole pesos no código.** Todos os pesos, faixas ideais, templates, recomendações ficam em arquivos de configuração no Nest, versionados.

**Não venda como diagnóstico médico.** Linguagem do produto, dos templates, do disclaimer e do nome das métricas precisa refletir "análise estética geométrica", nunca "diagnóstico".

**Não tente entregar 80 métricas no M1.** Aprenda primeiro com 20 calibradas.

**Não monte overlays sem ideais calibrados.** Calibre antes (M2), desenhe depois (M3).

**Não esqueça de versionar os ideais.** Toda análise persistida grava `ideals_version`, `metric_registry_version`, `threshold_config_version`.

**Não meça pele com landmarks.** Métricas pixel-dependentes ficam em módulo separado, marcadas com `requires_pixel_analysis=true`.

**Não exponha o score global cedo demais.** Antes de ter 60+ métricas e calibração razoável (M2), score global é volátil. M1 mostra só métricas brutas.

**Não trate before/ideal com warp como produto da Fase 3 inicial.** Vetorial primeiro.

**Não acople o frontend ao schema interno do FastAPI.** Toda comunicação passa pelo Nest. Frontend chama `POST /api/analyze`, nunca `/vision/metrics-v2`.

**Não coloque persistência, YAML ou ideais no Python.** Se aparecer YAML em `backend/`, sqlalchemy/asyncpg/alembic em `pyproject.toml`, ou `services/ideals/` em Python — é regressão. Reverter imediatamente.

**Não esqueça da consistência longitudinal.** Cada `AnalysisReport` salvo precisa carregar `quality_score`, `consistency_score` (M2+), `ideals_version` e fingerprint da sessão.