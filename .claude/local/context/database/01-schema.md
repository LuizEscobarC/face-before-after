---
tenant_id: "face-before-after-nest"
project: "face-before-after-nest"
module: "database/schema"
file_path: ".claude/local/context/database/01-schema.md"
doc_type: "schema"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  PostgreSQL 16 schema do Nest, gerido por TypeORM com 47 migrations versionadas em
  nest/src/database/migrations/. synchronize=false e migrationsRun=false são invariantes
  (toda mudança vai por migration CLI-driven). Schema cobre catálogos de métricas
  (Jaw/Nose/Mouth/Brow/Cheekbones/Forehead/GlobalShape/Phi/Cheeks), pesos regionais e globais,
  overlays, diagnostic templates, recommendation ladder, exercise catalog (270 itens),
  animation config e biometric config.
tags:
  - "database"
  - "postgres"
  - "typeorm"
  - "schema"
  - "migrations"
rag_keywords:
  - "TypeORM DataSource configuration"
  - "PostgreSQL 16 migrations"
  - "metric catalog versioning"
  - "diagnostic template seed"
  - "exercise ladder recommendation"
  - "global weights rebalance"
  - "evaluation persistence"
  - "DATABASE_URL connection string"
related_modules:
  - "nest"
depends_on: []
used_by:
  - "nest"
---

# Database — Schema

## Visão geral

Banco PostgreSQL 16, conexão via `DATABASE_URL`, gerido inteiramente por TypeORM com 47
migrations sequenciais nomeadas `<epoch>-<descrição>.ts` em
[nest/src/database/migrations](../../../../nest/src/database/migrations).

Invariantes (codificadas em [nest/src/database/database.module.ts](../../../../nest/src/database/database.module.ts)):

| Flag | Valor | Por quê |
|---|---|---|
| `synchronize` | `false` | Nunca derivar schema de entities — quebra histórico |
| `migrationsRun` | `false` | Migrations só rodam via CLI (`npm run migration:run`) |
| `autoLoadEntities` | `true` | Entities descobertas via `@Module` |
| `ssl` | conditional | Liga via `DB_SSL=true` |
| `logging` | conditional | Liga via `DB_LOGGING=true` |

## Estrutura por waves de migrations

### Wave 0 — bootstrap (`1746000000000`–`1746000030000`)

- `Extensions` — extensões Postgres (uuid-ossp etc.)
- `Catalogs` — tabelas-base de catálogo
- `SeedInitialCatalogs` — seed inicial
- `EvaluationsAndRoot` — tabelas de avaliação

### Wave 1 — metric catalog v1 + families (`040000`–`130000`)

Seed do catálogo canônico de métricas, separado por família facial:

| Família | Migration |
|---|---|
| MetricCatalogV1 | `SeedMetricCatalogV1` |
| Jaw | `SeedJawFamily` |
| Nose | `SeedNoseFamily` |
| Mouth | `SeedMouthFamily` |
| Brow | `SeedBrowFamily` |
| Cheekbones | `SeedCheekbonesFamily` (+ `AddCheekbonesEnumValue`) |
| Forehead | `SeedForeheadFamily` |
| GlobalShape | `SeedGlobalShapeFamily` |
| Phi/Golden | `SeedPhiGoldenFamily` |

Cada família contribui um conjunto de `metric_id`s usados pelo backend Python ao reportar
métricas. Catálogo cruzado com os ideais em [.claude/local/face-analysis/02-metrics.md](../../face-analysis/02-metrics.md).

### Wave 2 — scoring + overlays (`140000`–`200000`)

- `RegionalAndGlobalScoring` — tabelas de scoring por região e global
- `RebalanceWeightsV15` — rebalance de pesos
- `M3OverlayCatalog` + `M32AddImprovementVector` + `M33HeatmapOverlays` — catálogo de overlays
- `M41DiagnosticTemplates` — primeira leva de templates de narrative

### Wave 3 — recommendations + ladder (`210000`–`260000`)

- `M43RecommendationCatalog` (+ seed) — catálogo de recomendações
- `M44LadderEnumValues` + `M44RecommendationLadder` — ladder de evolução
- `M44SeedExerciseCatalog` + `M44SeedFullCatalog100` + `M44SeedFullCatalog270` —
  seed do exercício catalog (270 itens). Ver [solucoes-para-rotina-de-exercicios.md](../../../../solucoes-para-rotina-de-exercicios.md).
- `M42DiagnosticTemplatesV1` + `M42bDiagnosticTemplatesShortLong` +
  `M42cTemplateBlacklistExtensionV02` — refinos de templates
- `M44AnimationConfig` (+ seed) — config do face rig animado. Ver
  [ANIMATION_CONFIG_REFERENCE.md](../../../../ANIMATION_CONFIG_REFERENCE.md).
- `M44BiometricConfig` (+ POC seed) — config biométrica
- `M44PriorityScoreAudit` — auditoria de priority score

### Wave 4 — landmarks + waves C1/C2/C3 (`270000`–`320000`)

- `AddLandmarkStabilityColumns` — colunas de confidence/jitter
- `M64RecordedTimeline` — timeline gravada
- `SeedMetricsWaveC1`, `SeedMetricsWaveC2`, `SeedMetricsWaveC3` — três waves adicionais
  de métricas (Wave C). Tests em `backend/tests/unit/test_metrics_c{1,2,3}_wave.py`.

### Wave 5 — content + reports (`400000`–`470000+`)

- `MetricContent` + `M66RemapMetricContentIds` + `M66bMetricContentBackfill` —
  conteúdo textual por métrica (descrição humana, links de glossário)
- `DiagnosisReport` — persistência de relatórios de diagnóstico
- `M56bAestheticProcedures` — catálogo de procedimentos estéticos
- `M53cTemplateBackfill` — backfill de templates
- `M67RecalibrateMetricIdeals` — recalibração de ideais (referência:
  [.claude/local/face-analysis/CALIBRATION_AUDIT_2026-05-12.md](../../face-analysis/CALIBRATION_AUDIT_2026-05-12.md))

## Convenção de migration

- Nome: `<13-digit-epoch>-<PascalCase>.ts`.
- Numeração agrupada por wave (epoch + offset de 10000 entre migrations adjacentes deixa
  espaço para inserir hotfixes — ex.: `1746000095000` entre `90000` e `100000`).
- Seeds vivem como migrations (não em script separado) — garantem ordem e idempotência via
  TypeORM tracking.
- Up obrigatório; down opcional (mas recomendado em mudanças destrutivas).

## Operação

```bash
# Gerar nova migration (manual)
npm run migration:generate -- nest/src/database/migrations/<Name>

# Rodar pendentes
npm run migration:run

# Reverter última
npm run migration:revert
```

Scripts reais em `nest/package.json` (verificar antes de usar — convenção pode mudar).

## Não-objetivos

- Não usar `synchronize` mesmo em dev — `false` é absoluto.
- Não rodar seeds fora de migration — quebra reprodutibilidade.
- Não armazenar foto/blob — fica no MinIO.
