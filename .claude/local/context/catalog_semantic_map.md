---
tenant_id: "face-before-after"
project: "face-before-after"
module: "catalogs"
file_path: ".claude/local/context/catalog_semantic_map.md"
doc_type: "reference"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Semantic map of catalog tables: seeds parsed via ts-morph from Seed*.ts migrations, optionally diffed against live Postgres rows.
tags:
  - "catalogs"
  - "semantic-map"
  - "harvest"
rag_keywords:
  - "catalogs"
  - "seeds"
  - "metric-catalog"
  - "families"
  - "overlays"
  - "diagnostic-templates"
  - "semantic-map"
related_modules: []
depends_on:
  - "migrations_index"
  - "ai_context_master"
used_by:
  - "rag-ingest"
  - "business_logic_map"
---

# Catalog Semantic Map — face-before-after

Scanned **30** migration files for seed literals.

Catalogs extracted: 13.
Live DB diff: **disabled** (no PG_URL — static-only).

## `metric_definition`

- Seeded rows extracted (static AST): **36**
- Live diff skipped: db not available — static only

| source | metric_id | version | family | region | unit | display_name | presentation_only | requires_pixel_analysis |
|---|---|---|---|---|---|---|---|---|
| 1746000040000-SeedMetricCatalogV1.ts | $1 | $2 | $3 | $4 | $5 | $6::jsonb | $7 | $8 |
| 1746000040000-SeedMetricCatalogV1.ts | metric_id | version |  |  |  |  |  |  |
| 1746000040000-SeedMetricCatalogV1.ts | row.display_name |  |  |  |  |  |  |  |
| 1746000040000-SeedMetricCatalogV1.ts | row.dependency_landmarks |  |  |  |  |  |  |  |
| 1746000060000-SeedJawFamily.ts | $1 | $2 | $3 | $4 | $5 | $6::jsonb | $7 | $8 |
| 1746000060000-SeedJawFamily.ts | metric_id | version |  |  |  |  |  |  |
| 1746000060000-SeedJawFamily.ts | row.display_name |  |  |  |  |  |  |  |
| 1746000060000-SeedJawFamily.ts | row.dependency_landmarks |  |  |  |  |  |  |  |
| 1746000070000-SeedNoseFamily.ts | $1 | $2 | $3 | $4 | $5 | $6::jsonb | $7 | $8 |
| 1746000070000-SeedNoseFamily.ts | metric_id | version |  |  |  |  |  |  |
| 1746000070000-SeedNoseFamily.ts | row.display_name |  |  |  |  |  |  |  |
| 1746000070000-SeedNoseFamily.ts | row.dependency_landmarks |  |  |  |  |  |  |  |
| 1746000080000-SeedMouthFamily.ts | $1 | $2 | $3 | $4 | $5 | $6::jsonb | $7 | $8 |
| 1746000080000-SeedMouthFamily.ts | metric_id | version |  |  |  |  |  |  |
| 1746000080000-SeedMouthFamily.ts | row.display_name |  |  |  |  |  |  |  |
| 1746000080000-SeedMouthFamily.ts | row.dependency_landmarks |  |  |  |  |  |  |  |
| 1746000090000-SeedBrowFamily.ts | $1 | $2 | $3 | $4 | $5 | $6::jsonb | $7 | $8 |
| 1746000090000-SeedBrowFamily.ts | metric_id | version |  |  |  |  |  |  |
| 1746000090000-SeedBrowFamily.ts | row.display_name |  |  |  |  |  |  |  |
| 1746000090000-SeedBrowFamily.ts | row.dependency_landmarks |  |  |  |  |  |  |  |
| 1746000100000-SeedCheekbonesFamily.ts | $1 | $2 | $3 | $4 | $5 | $6::jsonb | $7 | $8 |
| 1746000100000-SeedCheekbonesFamily.ts | metric_id | version |  |  |  |  |  |  |
| 1746000100000-SeedCheekbonesFamily.ts | row.display_name |  |  |  |  |  |  |  |
| 1746000100000-SeedCheekbonesFamily.ts | row.dependency_landmarks |  |  |  |  |  |  |  |
| 1746000110000-SeedForeheadFamily.ts | $1 | $2 | $3 | $4 | $5 | $6::jsonb | $7 | $8 |
| 1746000110000-SeedForeheadFamily.ts | metric_id | version |  |  |  |  |  |  |
| 1746000110000-SeedForeheadFamily.ts | row.display_name |  |  |  |  |  |  |  |
| 1746000110000-SeedForeheadFamily.ts | row.dependency_landmarks |  |  |  |  |  |  |  |
| 1746000120000-SeedGlobalShapeFamily.ts | $1 | $2 | $3 | $4 | $5 | $6::jsonb | $7 | $8 |
| 1746000120000-SeedGlobalShapeFamily.ts | metric_id | version |  |  |  |  |  |  |
| 1746000120000-SeedGlobalShapeFamily.ts | row.display_name |  |  |  |  |  |  |  |
| 1746000120000-SeedGlobalShapeFamily.ts | row.dependency_landmarks |  |  |  |  |  |  |  |
| 1746000130000-SeedPhiGoldenFamily.ts | $1 | $2 | $3 | $4 | $5 | $6::jsonb | $7 | $8 |
| 1746000130000-SeedPhiGoldenFamily.ts | metric_id | version |  |  |  |  |  |  |
| 1746000130000-SeedPhiGoldenFamily.ts | row.display_name |  |  |  |  |  |  |  |
| 1746000130000-SeedPhiGoldenFamily.ts | row.dependency_landmarks |  |  |  |  |  |  |  |

## `metric_ideal`

- Seeded rows extracted (static AST): **32**
- Live diff skipped: db not available — static only

| source | metric_id | metric_definition_version | ideals_version | ideal_type | ideal_central_value | green_range_min | green_range_max | yellow_range_min |
|---|---|---|---|---|---|---|---|---|
| 1746000040000-SeedMetricCatalogV1.ts | $1 | $2 | $3 | $4::ideal_type_enum | $5 | $6 | $7 | $8 |
| 1746000040000-SeedMetricCatalogV1.ts | metric_id | metric_definition_version | ideals_version |  |  |  |  |  |
| 1746000040000-SeedMetricCatalogV1.ts | row.direction_label_above |  |  |  |  |  |  |  |
| 1746000040000-SeedMetricCatalogV1.ts | row.direction_label_below |  |  |  |  |  |  |  |
| 1746000060000-SeedJawFamily.ts | $1 | $2 | $3 | $4::ideal_type_enum | $5 | $6 | $7 | $8 |
| 1746000060000-SeedJawFamily.ts | metric_id | metric_definition_version | ideals_version |  |  |  |  |  |
| 1746000060000-SeedJawFamily.ts | row.direction_label_above |  |  |  |  |  |  |  |
| 1746000060000-SeedJawFamily.ts | row.direction_label_below |  |  |  |  |  |  |  |
| 1746000070000-SeedNoseFamily.ts | $1 | $2 | $3 | $4::ideal_type_enum | $5 | $6 | $7 | $8 |
| 1746000070000-SeedNoseFamily.ts | metric_id | metric_definition_version | ideals_version |  |  |  |  |  |
| 1746000070000-SeedNoseFamily.ts | row.direction_label_above |  |  |  |  |  |  |  |
| 1746000070000-SeedNoseFamily.ts | row.direction_label_below |  |  |  |  |  |  |  |
| 1746000080000-SeedMouthFamily.ts | $1 | $2 | $3 | $4::ideal_type_enum | $5 | $6 | $7 | $8 |
| 1746000080000-SeedMouthFamily.ts | metric_id | metric_definition_version | ideals_version |  |  |  |  |  |
| 1746000080000-SeedMouthFamily.ts | row.direction_label_above |  |  |  |  |  |  |  |
| 1746000080000-SeedMouthFamily.ts | row.direction_label_below |  |  |  |  |  |  |  |
| 1746000090000-SeedBrowFamily.ts | $1 | $2 | $3 | $4::ideal_type_enum | $5 | $6 | $7 | $8 |
| 1746000090000-SeedBrowFamily.ts | metric_id | metric_definition_version | ideals_version |  |  |  |  |  |
| 1746000090000-SeedBrowFamily.ts | row.direction_label_above |  |  |  |  |  |  |  |
| 1746000090000-SeedBrowFamily.ts | row.direction_label_below |  |  |  |  |  |  |  |
| 1746000100000-SeedCheekbonesFamily.ts | $1 | $2 | $3 | $4::ideal_type_enum | $5 | $6 | $7 | $8 |
| 1746000100000-SeedCheekbonesFamily.ts | metric_id | metric_definition_version | ideals_version |  |  |  |  |  |
| 1746000100000-SeedCheekbonesFamily.ts | row.direction_label_above |  |  |  |  |  |  |  |
| 1746000100000-SeedCheekbonesFamily.ts | row.direction_label_below |  |  |  |  |  |  |  |
| 1746000110000-SeedForeheadFamily.ts | $1 | $2 | $3 | $4::ideal_type_enum | $5 | $6 | $7 | $8 |
| 1746000110000-SeedForeheadFamily.ts | metric_id | metric_definition_version | ideals_version |  |  |  |  |  |
| 1746000110000-SeedForeheadFamily.ts | row.direction_label_above |  |  |  |  |  |  |  |
| 1746000110000-SeedForeheadFamily.ts | row.direction_label_below |  |  |  |  |  |  |  |
| 1746000120000-SeedGlobalShapeFamily.ts | $1 | $2 | $3 | $4::ideal_type_enum | $5 | $6 | $7 | $8 |
| 1746000120000-SeedGlobalShapeFamily.ts | metric_id | metric_definition_version | ideals_version |  |  |  |  |  |
| 1746000120000-SeedGlobalShapeFamily.ts | row.direction_label_above |  |  |  |  |  |  |  |
| 1746000120000-SeedGlobalShapeFamily.ts | row.direction_label_below |  |  |  |  |  |  |  |

## `region_metric_weight`

- Seeded rows extracted (static AST): **9**
- Live diff skipped: db not available — static only

| source | version | region | metric_id | weight |
|---|---|---|---|---|
| 1746000060000-SeedJawFamily.ts | $1 | jaw | $2 | $3 |
| 1746000070000-SeedNoseFamily.ts | $1 | nose | $2 | $3 |
| 1746000080000-SeedMouthFamily.ts | $1 | mouth | $2 | $3 |
| 1746000090000-SeedBrowFamily.ts | $1 | brows | $2 | $3 |
| 1746000100000-SeedCheekbonesFamily.ts | $1 | cheekbones | $2 | $3 |
| 1746000110000-SeedForeheadFamily.ts | $1 | forehead | $2 | $3 |
| 1746000120000-SeedGlobalShapeFamily.ts | $1 | global | $2 | $3 |
| 1746000150000-RebalanceWeightsV15.ts | $1 | $2::metric_region_enum | $3 | $4 |
| 1746000150000-RebalanceWeightsV15.ts | version | region | metric_id |  |

## `region_metric_weights_version`

- Seeded rows extracted (static AST): **4**
- Live diff skipped: db not available — static only

| source | version | description | is_active | is_provisional |
|---|---|---|---|---|
| 1746000150000-RebalanceWeightsV15.ts | $1 | $2 | FALSE | TRUE |
| 1746000150000-RebalanceWeightsV15.ts | version |  |  |  |
| 1746000150000-RebalanceWeightsV15.ts | PR-13..19 calibration preserved |  |  |  |
| 1746000150000-RebalanceWeightsV15.ts | real-photo calibration |  |  |  |

## `global_weights_version`

- Seeded rows extracted (static AST): **3**
- Live diff skipped: db not available — static only

| source | version | description | is_active | is_provisional | critical_regions |
|---|---|---|---|---|---|
| 1746000150000-RebalanceWeightsV15.ts | $1 | $2 | FALSE | TRUE | $3::jsonb |
| 1746000150000-RebalanceWeightsV15.ts | version |  |  |  |  |
| 1746000150000-RebalanceWeightsV15.ts | vs v1.0 which only had symmetry+eyes |  |  |  |  |

## `global_weight`

- Seeded rows extracted (static AST): **2**
- Live diff skipped: db not available — static only

| source | version | region | weight |
|---|---|---|---|
| 1746000150000-RebalanceWeightsV15.ts | $1 | $2::metric_region_enum | $3 |
| 1746000150000-RebalanceWeightsV15.ts | version | region |  |

## `overlay_catalog_version`

- Seeded rows extracted (static AST): **1**
- Live diff skipped: db not available — static only

| source | version | description | is_active |
|---|---|---|---|
| 1746000160000-M3OverlayCatalog.ts | v1.0 | 'M3.1 baseline — axis + grid + outline overlays. Sources: Na | Powell & Humphreys 1984 |

## `overlay_definition`

- Seeded rows extracted (static AST): **11**
- Live diff skipped: db not available — static only

| source | overlay_id | version | display_name | description | category | default_visible | z_order | legend_text |
|---|---|---|---|---|---|---|---|---|
| 1746000160000-M3OverlayCatalog.ts | linha média |  |  |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | midline |  |  |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | Farkas 1994 |  |  |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | Farkas 1994 |  |  |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | cabelo→sobrancelha |  |  |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | sobrancelha→base nariz |  |  |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | base nariz→queixo |  |  |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | Naini 2011 §6 |  |  |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | Naini 2011 §6 |  |  |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | face hull |  |  |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | face hull |  |  |  |  |  |  |  |

## `overlay_metric_dependency`

- Seeded rows extracted (static AST): **3**
- Live diff skipped: db not available — static only

| source | overlay_id | overlay_version | metric_id | metric_definition_version | is_critical | notes |
|---|---|---|---|---|---|---|
| 1746000160000-M3OverlayCatalog.ts | L2 per PLAN_M3_OVERLAYS §1.1 |  |  |  |  |  |
| 1746000160000-M3OverlayCatalog.ts | grid_thirds | v1.0 | ${metricId} | v1.0 | TRUE | Critical: grid line position is derived from the correspondi |
| 1746000160000-M3OverlayCatalog.ts | grid_fifths | v1.0 | ${metricId} | v1.0 | TRUE | Critical: vertical line at fifth boundary depends on this ra |

## `diagnostic_template_version`

- Seeded rows extracted (static AST): **1**
- Live diff skipped: db not available — static only

| source | version | is_active | notes |
|---|---|---|---|
| 1746000180000-M41DiagnosticTemplates.ts | one per M1 region: symmetry | proportion | eyes |

## `diagnostic_template`

- Seeded rows extracted (static AST): **5**
- Live diff skipped: db not available — static only

| source | version | metric_id | severity | direction | size | template_pt | placeholders_used |
|---|---|---|---|---|---|---|---|
| 1746000180000-M41DiagnosticTemplates.ts | v0.1 | midline_deviation | moderate | right_dominant | medium | A linha mediana facial apresenta desvio de {deviation_pct}%  | '["deviation_pct"]'::jsonb |
| 1746000180000-M41DiagnosticTemplates.ts | {deviation_pct}% acima do valor de referência {ideal} |  |  |  |  |  |  |
| 1746000180000-M41DiagnosticTemplates.ts | {deviation_pct}% abaixo da referência {ideal} |  |  |  |  |  |  |
| 1746000180000-M41DiagnosticTemplates.ts | v0.1 | jaw_width_ratio | mild | wider | medium | 'A largura mandibular relativa apresenta valor {value} | indicando linha de mandíbula visualmente mais larga que a re |
| 1746000180000-M41DiagnosticTemplates.ts | {deviation_pct}% abaixo da referência {ideal} |  |  |  |  |  |  |

## `template_blacklist_version`

- Seeded rows extracted (static AST): **2**
- Live diff skipped: db not available — static only

| source | version | is_active | notes |
|---|---|---|---|
| 1746000180000-M41DiagnosticTemplates.ts | v0.1 | TRUE | M4.1 PR-50 minimal blacklist. Curated against PLAN_M4_NARRAT |
| 1746000180000-M41DiagnosticTemplates.ts | version |  |  |

## `template_blacklist_term`

- Seeded rows extracted (static AST): **2**
- Live diff skipped: db not available — static only

| source | version | term | category | notes |
|---|---|---|---|---|
| 1746000180000-M41DiagnosticTemplates.ts | v0.1 | diagnostico | diagnostic_verb | Verbo diagnóstico: implica condição médica. |
| 1746000180000-M41DiagnosticTemplates.ts | v0.1 | diagnostica | diagnostic_verb | Verbo diagnóstico conjugado. |

