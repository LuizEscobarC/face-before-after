---
tenant_id: "face-before-after"
project: "face-before-after"
module: "database/entities"
doc_type: "schema"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Mapeamento completo dos 29 TypeORM entities do Nest para nomes de tabela PostgreSQL,
  chaves primárias, colunas-chave de negócio e relacionamentos. Cobre módulos: analysis
  (16 entities), catalog (1), diagnosis (6), overlays (4), admin (2).
  Complementa 01-schema.md (migration waves) com estrutura real de colunas.
tags:
  - "database"
  - "typeorm"
  - "entities"
  - "schema"
rag_keywords:
  - "TypeORM entity table names"
  - "analysis_report session_id"
  - "metric_evaluation metric_id"
  - "recommendation_catalog invasiveness_level"
  - "overlay_definition z_order rendering_hints"
  - "priority_score_audit ISCARE scoring"
  - "diagnosis_report run_id"
  - "metric_content feynman_text"
related_modules:
  - "nest"
depends_on:
  - "database/schema"
used_by:
  - "nest"
---

# Database — TypeORM Entities

Mapeamento de todas as entities TypeORM para tabelas PostgreSQL. Fonte: `nest/src/modules/*/infrastructure/entities/*.entity.ts` e `nest/src/modules/admin/entities/*.entity.ts`.

---

## Módulo: analysis

### `AnalysisReportEntity` → `analysis_report`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `session_id` | text | identificador da sessão de captura |
| `photo_reference` | text nullable | referência MinIO da foto |
| `pose_correction_applied` | boolean | default false |
| `midline_aligned` | boolean | default false |
| `metric_registry_version` | text nullable | versão do catálogo de métricas |
| `ideals_version` | text nullable | versão dos ideais |
| `threshold_config_version` | text nullable | |
| `severity_collapse_version` | text nullable | |
| `region_metric_weights_version` | text nullable | |
| `global_weights_version` | text nullable | |
| `locale` | text | default `pt-BR` |
| `user_context` | jsonb nullable | contexto do usuário |
| `disclaimer_text_snapshot` | text nullable | |
| `status` | text | default `complete` |
| `generated_at` | timestamptz | |
| `created_at` | timestamptz | |

Relacionamentos:
- `OneToMany` → `MetricEvaluationEntity` (via `analysis_report_id`)

---

### `AnalysisThresholdConfigEntity` → `analysis_threshold_config`

PK: `version` (text, PrimaryColumn)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `version` | text PK | |
| `min_confidence_to_display_metric` | numeric(10,6) | default 0.4 |
| `min_confidence_to_show_global_score` | numeric(10,6) | default 0.5 |
| `score_band_no_number_max` | numeric(10,6) | default 50.0 |
| `score_band_refine_max` | numeric(10,6) | default 70.0 |
| `score_band_good_max` | numeric(10,6) | default 85.0 |
| `disclaimer_text_snapshot` | text | |
| `is_active` | boolean | default false |
| `created_at` | timestamptz | |

---

### `GlobalScoreEntity` → `global_score`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `analysis_report_id` | uuid FK | |
| `analysis_report_generated_at` | timestamptz | composite FK companion |
| `is_displayable` | boolean | default false |
| `global_weights_version` | text nullable | |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `AnalysisReportEntity`

---

### `GlobalWeightEntity` → `global_weight`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `version` | text FK | → `global_weights_version.version` |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `GlobalWeightsVersionEntity`

---

### `GlobalWeightsVersionEntity` → `global_weights_version`

PK: `version` (text, PrimaryColumn)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `version` | text PK | |
| `description` | text nullable | |
| `is_active` | boolean | default false |
| `is_provisional` | boolean | default false |
| `created_at` | timestamptz | |

Relacionamentos:
- `OneToMany` → `GlobalWeightEntity`

---

### `IdealsVersionEntity` → `ideals_version`

PK: `version` (text, PrimaryColumn)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `version` | text PK | |
| `description` | text nullable | |
| `is_active` | boolean | default false |
| `created_at` | timestamptz | |

Relacionamentos:
- `OneToMany` → `MetricIdealEntity`

---

### `LandmarkPayloadEntity` → `landmark_payload`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `analysis_report_id` | uuid FK | composite |
| `analysis_report_generated_at` | timestamptz | composite FK companion |
| `raw_landmarks` | jsonb | payload bruto de 478 pontos |
| `normalized_landmarks` | jsonb nullable | |
| `capture_count` | int | default 1 |
| `created_at` | timestamptz | |

---

### `MetricDefinitionEntity` → `metric_definition`

PK composta: `(metric_id, version)` (implícito via JoinColumn + PrimaryColumn — verificar migration)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `version` | text FK | → `metric_registry_version.version` |
| `family` | text | ex: `jaw`, `nose`, `mouth` |
| `region` | enum | região facial |
| `unit` | enum | unidade de medida |
| `display_name` | jsonb | i18n |
| `presentation_only` | boolean | default false |
| `requires_pixel_analysis` | boolean | default false |
| `dependency_landmarks` | jsonb | lista de pontos necessários |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `MetricRegistryVersionEntity`

---

### `MetricEvaluationAgainstIdealEntity` → `metric_evaluation_against_ideal`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `metric_evaluation_id` | uuid FK | composite |
| `metric_evaluation_generated_at` | timestamptz | composite FK companion |
| `metric_ideal_id` | uuid FK | |
| `deviation_raw` | numeric(10,6) nullable | |
| `deviation_normalized` | numeric(10,6) nullable | |
| `direction_label` | jsonb | |
| `improvement_vector_x` | numeric(10,6) nullable | |
| `improvement_vector_y` | numeric(10,6) nullable | |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `MetricIdealEntity`

---

### `MetricEvaluationEntity` → `metric_evaluation`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `analysis_report_id` | uuid FK | composite |
| `analysis_report_generated_at` | timestamptz | composite FK companion |
| `metric_id` | text | id canônico da métrica |
| `metric_definition_version` | text | versão usada |
| `value` | numeric(10,6) nullable | valor medido |
| `error` | text nullable | mensagem de erro se falhou |
| `confidence_raw` | numeric(10,6) nullable | |
| `confidence_final` | numeric(10,6) nullable | |
| `is_low_confidence` | boolean | default false |
| `displayable` | boolean | default true |
| `direction` | text nullable | acima/abaixo do ideal |
| `generated_at` | timestamptz | |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `AnalysisReportEntity`

---

### `MetricIdealEntity` → `metric_ideal`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `metric_id` | text FK | |
| `metric_definition_version` | text | |
| `ideals_version` | text FK | → `ideals_version.version` |
| `ideal_central_value` | numeric(10,6) nullable | |
| `green_range_min` / `green_range_max` | numeric(10,6) nullable | faixa verde |
| `yellow_range_min` / `yellow_range_max` | numeric(10,6) nullable | faixa amarela |
| `direction_label_above` | jsonb | i18n |
| `direction_label_below` | jsonb | i18n |
| `population_reference_note` | text nullable | |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `MetricDefinitionEntity`
- `ManyToOne` → `IdealsVersionEntity`

---

### `MetricRegistryVersionEntity` → `metric_registry_version`

PK: `version` (text, PrimaryColumn)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `version` | text PK | |
| `description` | text nullable | |
| `is_active` | boolean | default false |
| `created_at` | timestamptz | |

Relacionamentos:
- `OneToMany` → `MetricDefinitionEntity`

---

### `RegionMetricWeightEntity` → `region_metric_weight`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `version` | text FK | → `region_metric_weights_version.version` |
| `metric_id` | text | |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `RegionMetricWeightsVersionEntity`

---

### `RegionMetricWeightsVersionEntity` → `region_metric_weights_version`

PK: `version` (text, PrimaryColumn)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `version` | text PK | |
| `description` | text nullable | |
| `is_active` | boolean | default false |
| `is_provisional` | boolean | default false |
| `created_at` | timestamptz | |

Relacionamentos:
- `OneToMany` → `RegionMetricWeightEntity`

---

### `RegionalScoreEntity` → `regional_score`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `analysis_report_id` | uuid FK | composite |
| `analysis_report_generated_at` | timestamptz | composite FK companion |
| `weights_version` | text nullable | |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `AnalysisReportEntity`

---

### `SeverityCollapsePolicyEntity` → `severity_collapse_policy`

PK: `version` (text, PrimaryColumn)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `version` | text PK | |
| `mapping` | jsonb | mapeamento de severidade → colapsado |
| `is_active` | boolean | default false |
| `created_at` | timestamptz | |

---

## Módulo: catalog

### `MetricContentEntity` → `metric_content`

PK composta: `(metric_id, locale)`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `metric_id` | text PK | |
| `locale` | text PK | ex: `pt-BR` |
| `feynman_text` | text nullable | explicação leiga |
| `description` | text nullable | |
| `how_measured` | text nullable | |
| `ranges_text` | text nullable | |
| `common_issues` | jsonb | default `[]` |
| `references` | jsonb | default `[]` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

## Módulo: diagnosis

### `DiagnosisReportEntity` → `diagnosis_report`

PK: `run_id` (text, PrimaryColumn)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `run_id` | text PK | id do pipeline Python |
| `top_concerns` | jsonb | default `[]` |
| `summary` | text | |
| `timestamp` | text | |

---

### `DiagnosticTemplateEntity` → `diagnostic_template`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `version` | text | versão do template |
| `metric_id` | text | |
| `direction` | text | `above` / `below` / `any` |
| `size` | text | tamanho do template (`short` / `long`) |
| `template_pt` | text | texto do template em PT |
| `placeholders_used` | jsonb | default `[]` |
| `created_at` | timestamptz | |

---

### `PriorityScoreAuditEntity` → `priority_score_audit`

PK: `id` (uuid generated)

Implementa scoring ISCARE (Invasiveness, Severity, Confidence, Actionability, Risk, Evidence).

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `recommendation_link_id` | uuid unique FK | |
| `analysis_report_id` | uuid | |
| `analysis_report_generated_at` | timestamptz | |
| `I` / `S` / `C` / `A` / `E` / `R` | numeric(6,5) nullable | fatores ISCARE |
| `raw_score` | numeric(8,6) | |
| `penalized_score` | numeric(8,6) | |
| `final_score` | numeric(8,6) | |
| `dec38_rank_position` | integer nullable | posição no ranking |
| `suppression_reason` | text nullable | |
| `invasiveness_level_applied` | smallint nullable | |
| `severity_source_against_ideal_id` | uuid nullable | |
| `confidence_source_evaluation_id` | uuid nullable | |
| `risk_source_recommendation_id` | text nullable | |
| `scored_at` | timestamptz | |
| `service_version` | text | default `pr-58.v1` |

---

### `RecommendationCatalogEntity` → `recommendation_catalog`

PK: `id` (text — implícito, verificar entity completa)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `version` | text FK | → `recommendation_catalog_version.version` |
| `display_text_short_pt` | text | |
| `display_text_long_pt` | text | |
| `priority_default` | smallint | |
| `effort_estimate` | text | |
| `requires_professional` | boolean | default false |
| `professional_type` | text nullable | |
| `invasiveness_level` | smallint | |
| `clinical_pathway_required` | boolean | default false |
| `references_jsonb` | jsonb | default `[]` |
| `disclaimer_template` | text nullable | |
| `animation_config` | jsonb nullable | config do rig animado |
| `biometric_config` | jsonb nullable | config biométrica |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `RecommendationCatalogVersionEntity`
- `OneToMany` → `RecommendationTriggerEntity`
- `OneToMany` → `RecommendationLinkEntity`

---

### `RecommendationCatalogVersionEntity` → `recommendation_catalog_version`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `version` | text unique | |
| `is_active` | boolean | default false |
| `notes` | text nullable | |
| `created_at` | timestamptz | |

Relacionamentos:
- `OneToMany` → `RecommendationCatalogEntity`

---

### `RecommendationLinkEntity` → `recommendation_link`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `analysis_report_id` | uuid FK | composite |
| `analysis_report_generated_at` | timestamptz | composite FK companion |
| `recommendation_id` | text FK | → `recommendation_catalog.id` |
| `final_priority_in_session` | smallint nullable | |
| `is_displayed_to_user` | boolean | default false |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `RecommendationCatalogEntity`

---

### `RecommendationTriggerEntity` → `recommendation_trigger`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `recommendation_id` | text FK | → `recommendation_catalog.id` |
| `metric_id` | text | métrica que dispara |
| `direction` | text | default `any` |
| `additional_conditions` | jsonb nullable | |
| `min_invasiveness_level` | smallint nullable | |
| `clinical_pathway_required` | boolean | default false |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `RecommendationCatalogEntity`

---

## Módulo: overlays

### `OverlayCatalogVersionEntity` → `overlay_catalog_version`

PK: `version` (text, PrimaryColumn)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `version` | text PK | |
| `description` | text nullable | |
| `is_active` | boolean | default false |
| `created_at` | timestamptz | |

Relacionamentos:
- `OneToMany` → `OverlayDefinitionEntity`

---

### `OverlayDefinitionEntity` → `overlay_definition`

PK: composta via JoinColumn (`id` + `version` — verificar migration)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `version` | text FK | → `overlay_catalog_version.version` |
| `display_name` | jsonb | i18n |
| `description` | jsonb | i18n |
| `default_visible` | boolean | default true |
| `z_order` | int | default 10 |
| `legend_text` | jsonb | i18n |
| `is_decorative` | boolean | default false |
| `rendering_hints` | jsonb | hints para o renderer |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `OverlayCatalogVersionEntity`
- `OneToMany` → `OverlayMetricDependencyEntity`

---

### `OverlayMetricDependencyEntity` → `overlay_metric_dependency`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `overlay_id` | text FK | composite |
| `overlay_version` | text | composite FK companion |
| `metric_id` | text FK | composite |
| `metric_definition_version` | text | composite FK companion |
| `is_critical` | boolean | default false |
| `notes` | text nullable | |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `OverlayDefinitionEntity`
- `ManyToOne` → `MetricDefinitionEntity`

---

### `RenderedAssetEntity` → `rendered_asset`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `analysis_report_id` | uuid FK | composite |
| `analysis_report_generated_at` | timestamptz | composite FK companion |
| `region` | text nullable | região facial do asset |
| `overlay_ids_applied` | jsonb | default `[]` |
| `overlay_catalog_version` | text nullable | |
| `storage_url` | text | URL MinIO |
| `dimensions` | jsonb nullable | `{width, height}` |
| `byte_size` | bigint nullable | |
| `generated_at` | timestamptz | |
| `expires_at` | timestamptz | TTL do asset |
| `is_expired` | boolean | default false |
| `processing_notes` | jsonb nullable | |
| `created_at` | timestamptz | |

Relacionamentos:
- `ManyToOne` → `AnalysisReportEntity` (CASCADE delete)
- `ManyToOne` → `OverlayCatalogVersionEntity` (nullable)

---

## Módulo: admin

### `TemplateBlacklistVersionEntity` → `template_blacklist_version`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `version` | text unique | |
| `notes` | text nullable | |
| `created_at` | timestamptz | |

---

### `TemplateBlacklistTermEntity` → `template_blacklist_term`

PK: `id` (uuid generated)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | uuid PK | |
| `version` | text FK | → `template_blacklist_version.version` |
| `term` | text | termo bloqueado |
| `category` | text | categoria do termo |
| `notes` | text nullable | |

Relacionamentos:
- `ManyToOne` → `TemplateBlacklistVersionEntity` (RESTRICT on delete)

---

## Padrão de chaves compostas

Várias tabelas transacionais usam **PKs compostas** `(id, generated_at)` ou `(id, version)` como estratégia de particionamento por tempo — ex: `analysis_report`, `metric_evaluation`, `global_score`. O campo `_generated_at` é sempre carregado junto nas JoinColumns para suportar queries de range temporal eficientes.

## Tabelas sem entity TypeORM (somente migration)

Tabelas criadas por migrations mas sem entity Nest correspondente detectada:
- `animation_config` / `biometric_config` — referenciadas como jsonb embutido em `recommendation_catalog`
- `aesthetic_procedures` (Wave 5: `M56bAestheticProcedures`) — catálogo de procedimentos estéticos

Verificar migrations `M44AnimationConfig` e `M56bAestheticProcedures` para estrutura exata.
