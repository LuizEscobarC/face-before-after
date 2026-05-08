Read [](file:///home/luizescobal/study/face-before-after/backend/app)

Read [](file:///home/luizescobal/study/face-before-after/.claude/database)

Read [](file:///home/luizescobal/study/face-before-after/backend/app/vision)

Read [](file:///home/luizescobal/study/face-before-after/backend/app/api)

Read [](file:///home/luizescobal/study/face-before-after/backend/app/schemas)

Read [](file:///home/luizescobal/study/face-before-after/backend/app/infra)

Read [](file:///home/luizescobal/study/face-before-after/backend/app/vision/services)

Read [](file:///home/luizescobal/study/face-before-after/backend/app/vision/schemas)

Read [](file:///home/luizescobal/study/face-before-after/backend/app/vision/routers)

Read [](file:///home/luizescobal/study/face-before-after/backend/tests)

Read [](file:///home/luizescobal/study/face-before-after/backend/app/vision/services/metric_calculator.py#1-1), lines 1 to 80

Read [](file:///home/luizescobal/study/face-before-after/backend/app/vision/schemas/metric_result.py)

Read [](file:///home/luizescobal/study/face-before-after/backend/app/vision/routers/metrics.py)

Read [](file:///home/luizescobal/study/face-before-after/backend/app/vision/schemas/landmark_payload.py#1-1), lines 1 to 60

Read [](file:///home/luizescobal/study/face-before-after/backend/tests/conftest.py)

Read [](file:///home/luizescobal/study/face-before-after/backend/pyproject.toml)

Searched for regex `alembic|psycopg|sqlalchemy|asyncpg` (`**/backend/**`), no results

Searched for regex `typeorm|prisma|postgres|knex|migration` (`**/nest/**`), 1 result

Read [](file:///home/luizescobal/study/face-before-after/docker-compose.yml#1-1), lines 1 to 40

Searched for regex `postgres|database` (`**/docker-compose.yml`), no results

Decisões travadas. Antes do plano, dois fatos que mudam o desenho do M1 e que descobri olhando o código:

- **Não existe Postgres no projeto ainda** — docker-compose.yml só tem MinIO; backend FastAPI não usa nenhum ORM/cliente DB; nenhuma migração rodando. O DDL em ddl.sql está **só como referência**, não está aplicado em lugar nenhum.
- **Já existe um pipeline de métricas legado** em metric_calculator.py que envelopa `app.domain.face_metrics.compute_all` (código pré-existente do MVP) e infere `region`/`direction` por heurística de string. Esse legado **não** segue a "carteira de identidade" do plano (sem `error`, sem `dependency_set`, sem `presentation_only`, sem normalização intercanthal explícita).

Isso significa que o M1 precisa decidir uma coisa adicional **agora**, antes de eu codar: como conviver com o legado.

### Decisão extra a travar (DEC-19)

**Como tratar o `metric_calculator` legado e o endpoint `/vision/metrics`?** Três caminhos:

- **(A) Greenfield paralelo** (recomendo): novos módulos em `app/services/metrics/` + novo endpoint `POST /vision/analyze`. O legado fica intocado servindo `/vision/metrics` para debug e backward-compat (como o próprio PLAN_METRICS.md sugere). Quando `/vision/analyze` estabilizar (M4), depreca o legado.
- **(B) Refactor in-place**: reescrever metric_calculator.py para devolver `MetricEvaluation` rico. Quebra contratos existentes do orchestrator e do frontend.
- **(C) Adapter**: chamar `compute_all` legado e enriquecer no caminho. Junta o pior dos dois mundos (mantém heurística de string + esconde dívida).

Vou assumir **(A)** no plano abaixo. Se discordar, me avisa e eu reordeno. Também assumo **DEC-20: Postgres entra agora** (sem ele não há `metric_definition`/`metric_evaluation`, e sem isso o "JSON cru" do M1 fica voando — perde versionamento, perde rastro, perde o snapshot do `metric_definition_version` que travamos na DEC-12).

---

# Plano detalhado — Marco 1: Núcleo Analítico

**Critério de "feito"**: `POST /vision/analyze` recebe `landmarks + quality_context`, retorna `AnalysisReport` com 20 métricas calibradas das 4 famílias prioritárias (simetria, terços, quintos, olhos), cada métrica com `value/error/confidence/region/direction/dependency_set/severity vs ideal`, persistido em Postgres com snapshot de `metric_registry_version` + `ideals_version`. Sem texto de diagnóstico, sem overlay, sem score regional/global ainda (esses são M2). Testes unitários por família passando com 3 fixtures sintéticas cada.

---

## 0. Infraestrutura — antes de qualquer código de métrica

### 0.1 Postgres no compose
- Adicionar serviço `postgres:16-alpine` em docker-compose.yml + healthcheck + volume nomeado.
- Vars: `POSTGRES_DB=face_analysis`, `POSTGRES_USER`, `POSTGRES_PASSWORD` (env file).
- Wire `vision-service` (FastAPI) `depends_on: postgres: condition: service_healthy`.

### 0.2 Stack de DB no FastAPI
- Adicionar em pyproject.toml: `sqlalchemy>=2.0`, `asyncpg`, `alembic`, `pyyaml` (carregar `metric_ideals.yaml`).
- Criar `backend/app/infra/db/` com:
  - `engine.py` — async engine + session factory.
  - `base.py` — `DeclarativeBase`.
  - `session.py` — dependency `get_session` para FastAPI.
- Criar `backend/alembic/` com `alembic.ini`, `env.py` configurado para async + autogenerate olhando `app.infra.db.base.Base`.

### 0.3 Política de migração
- Toda mudança de schema vira uma migration Alembic numerada. Sem `create_all` em runtime.
- Migration **0001** = leva 1 do `PLAN_DDL_REVIEW.md` (catálogos).
- Migration **0002** = leva 2 (avaliações + `analysis_report` mínimo).

---

## 1. Migrações DDL (levas 1 e 2 antes do M1)

### Migration 0001 — catálogos (sem dados de sessão)

Tabelas (versão **mínima utilizável**, conforme decisões travadas):

- `metric_registry_version` (`version PK TEXT`, `description`, `is_active BOOL`, `created_at`).
- `metric_definition` (composite PK `(metric_id, version)`, FK `version → metric_registry_version`):
  - `region`, `family`, `unit`, `presentation_only BOOL`, `requires_pixel_analysis BOOL`,
  - `dependency_landmarks JSONB`, `default_weight_in_region FLOAT`, `min_confidence_to_display FLOAT`,
  - `display_name JSONB` (mapa `{locale: text}`, default `{"pt-BR": "..."}`) — **DEC-4 i18n**.
- `ideals_version` (`version PK`, `is_active`, `created_at`).
- `metric_ideal` (PK uuid; FK `metric_id` para `metric_definition`; FK `version → ideals_version`):
  - `ideal_type ENUM('canonical','population_statistical','presentation_only')`,
  - `ideal_central_value`, `green_range_min/max`, `yellow_range_min/max`,
  - `direction_label_above JSONB` (i18n), `direction_label_below JSONB` (i18n),
  - `population_reference_note TEXT` (livre — Farkas etc.).
- `analysis_threshold_config` (versionada; estende a ideia de `quality_threshold_config`):
  - `min_confidence_to_display_metric FLOAT DEFAULT 0.4`,
  - `min_confidence_to_show_global_score FLOAT DEFAULT 0.5`,
  - `score_band_no_number_max FLOAT DEFAULT 50`,
  - `score_band_refine_max FLOAT DEFAULT 70`,
  - `score_band_good_max FLOAT DEFAULT 85`. — **DEC-7 + DEC-9**.
- `severity_collapse_policy` (1 linha, versionada): mapeia 5→3 níveis. — **DEC-3**.

### Migration 0002 — avaliações + raiz (preparada para M2/M3)

- `analysis_report` (PK uuid, particionada por `RANGE (generated_at)` mensal — **DEC-17**):
  - `session_id`, `user_id NULL`,
  - FK opcional para `photo_quality_report_id`, `landmark_payload_id`, `diagnostic_report_id`, `decision_output_id` (tudo NULL no M1; coexistência — **DEC-5**),
  - snapshots: `metric_registry_version`, `ideals_version`, `threshold_config_version`,
  - `status ENUM('PROCESSING','COMPLETE','FAILED')`,
  - `disclaimer_text_snapshot TEXT NOT NULL`,
  - `generated_at TIMESTAMPTZ`,
  - **particionamento**: criar partições para os 3 próximos meses no manualmente; pg_partman fica para depois.
- `landmark_payload` (espelha o DDL de referência mas sem PhotoQuality FK no M1):
  - `id UUID PK`, `session_id`,
  - `landmarks_normalized JSONB`, `normalization_basis TEXT DEFAULT 'intercanthal'` — **DEC-1 grava o que foi usado**,
  - `normalization_applied BOOL DEFAULT TRUE`,
  - `capture_count INT DEFAULT 1` — **DEC-11 reservado**,
  - `processing_mode TEXT`, `fingerprint_hash`, `created_at`.
- `metric_evaluation` (PK uuid, particionada por `RANGE (generated_at)` mensal):
  - FK `analysis_report_id`, FK composta `(metric_id, metric_definition_version) → metric_definition`,
  - `value FLOAT`, `error FLOAT`, `confidence_raw FLOAT`, `confidence_final FLOAT`,
  - `regional_penalty_applied FLOAT`, `pose_penalty_applied FLOAT`,
  - `is_low_confidence BOOL` (generated column = `confidence_final < 0.4`),
  - `direction TEXT`, `dependency_landmarks JSONB`, `generated_at`,
  - índice composto `(analysis_report_id, metric_id)`.
- `metric_evaluation_against_ideal` (PK uuid, FK 1:1 `metric_evaluation_id`):
  - FK `metric_ideal_id`,
  - `deviation_raw FLOAT`, `deviation_normalized FLOAT`,
  - `direction_label JSONB` (snapshot já interpolado por locale),
  - `severity_5 ENUM('ideal','mild','moderate','strong','extreme')`,
  - `severity_3 ENUM('LEVE','MODERADO','SEVERO')` (derivado pela `severity_collapse_policy` do snapshot — calculado em código no M1, trigger SQL fica pra depois),
  - `improvement_vector_x/y FLOAT NULL`.

**Não no M1**: `factor_*`, `regional_score`, `global_score`, `region_metric_weight`, `global_weight`, overlays, templates, recomendações.

---

## 2. Estrutura de pastas — `services/metrics/` e adjacências

```
backend/app/
├── config/
│   ├── metric_ideals.yaml              # 20 entradas calibradas para M1
│   └── metric_registry.yaml            # cadastro declarativo das 20 métricas (espelho do que vai pro DB)
├── infra/db/
│   ├── engine.py
│   ├── base.py
│   └── session.py
├── infra/repositories/
│   ├── analysis_report_repo.py
│   ├── metric_evaluation_repo.py
│   └── metric_definition_repo.py       # leitura cacheada do catálogo
├── domain/                              # value objects puros (sem ORM)
│   ├── metric_evaluation.py            # dataclass MetricEvaluation
│   ├── metric_ideal.py                 # dataclass MetricIdeal
│   └── normalized_landmarks.py         # dataclass NormalizedLandmarks (com basis="intercanthal")
├── services/
│   ├── normalization/
│   │   ├── __init__.py
│   │   ├── pose_correction.py          # aplica yaw/pitch/roll → planar
│   │   ├── intercanthal_scaler.py      # escala usando ‖L_inner_l - L_inner_r‖ = 1.0
│   │   ├── midline_aligner.py          # roda para deixar linha intercanthal horizontal
│   │   └── normalizer.py               # orquestra os três acima → NormalizedLandmarks
│   ├── metrics/
│   │   ├── __init__.py
│   │   ├── base.py                     # ABC MetricFamily + decorator @register_metric
│   │   ├── registry.py                 # MetricRegistry (loader + lookup por id/region/family)
│   │   ├── confidence_propagation.py   # aplica regional_penalty + pose_penalty (sigmóide)
│   │   ├── symmetry.py                 # família 1
│   │   ├── thirds.py                   # família 2
│   │   ├── fifths.py                   # família 3
│   │   └── eyes.py                     # família 4
│   ├── ideals/
│   │   ├── loader.py                   # carrega config/metric_ideals.yaml + valida schema
│   │   └── comparator.py               # MetricEvaluation × MetricIdeal → EvaluationAgainstIdeal
│   └── pipeline/
│       └── analyze_orchestrator.py     # normaliza → calcula → compara → persiste → devolve
├── vision/
│   └── routers/
│       └── analyze.py                  # POST /vision/analyze
└── alembic/
    └── versions/
        ├── 0001_catalogs.py
        └── 0002_evaluations_and_root.py

backend/tests/
├── fixtures/
│   ├── synthetic_perfect_face.py       # 468 landmarks gerados proceduralmente, simétrico
│   ├── known_asymmetric_face.py        # variação do perfeito com offset bilateral conhecido
│   └── posed_face.py                   # perfeito + rotação 12° yaw para validar normalização
├── unit/
│   ├── normalization/
│   │   ├── test_intercanthal_scaler.py
│   │   ├── test_midline_aligner.py
│   │   └── test_normalizer_idempotent.py
│   ├── metrics/
│   │   ├── test_symmetry_family.py
│   │   ├── test_thirds_family.py
│   │   ├── test_fifths_family.py
│   │   └── test_eyes_family.py
│   ├── ideals/
│   │   └── test_comparator_severity_buckets.py
│   └── confidence/
│       └── test_pose_penalty_curve.py
└── integration/
    ├── test_analyze_endpoint_perfect_face.py
    ├── test_analyze_endpoint_asymmetric.py
    └── test_analyze_endpoint_persists_report.py
```

---

## 3. Ordem das 4 famílias (simetria → terços → quintos → olhos)

Cada família = **1 PR pequeno** com: módulo Python + entradas no `metric_registry.yaml` + entradas no `metric_ideals.yaml` + testes nas 3 fixtures.

### 3.1 Família **simetria** (5 métricas no M1)
- `midline_deviation` (testa, ponta nasal, philtrum, mentum vs eixo vertical médio).
- `eye_height_asymmetry`.
- `brow_height_asymmetry`.
- `lip_canting_angle`.
- `global_asymmetry_index` (média ponderada das 4 anteriores).
- Region: `symmetry`. Unit: `intercanthal_units` ou `degrees`.
- **Teste com fixtures**:
  - `synthetic_perfect_face` → cada métrica retorna `value≈0`, `severity=ideal`.
  - `known_asymmetric_face` (offset 0.05 unidades intercanthais nos olhos) → `eye_height_asymmetry.value≈0.05` (tolerância ±0.005).
  - `posed_face` (yaw 12°) → `confidence_final < 0.5` em todas (penalidade pose mata simetria), mas `value` ainda bate aproximado do perfeito (porque normalização corrige).

### 3.2 Família **terços** (4 métricas)
- `upper_third_ratio`, `middle_third_ratio`, `lower_third_ratio`, `dominant_third` (categórica via texto: `upper`/`middle`/`lower`).
- Ideal canônico: 0.333 cada, `green=±0.02`, `yellow=±0.05`.
- **Teste**: perfeito → 0.333±. Fixture asymmetric não afeta (vertical), confiança alta. Posed → `pitch>10°` aplica penalty mas `value` ok.

### 3.3 Família **quintos** (5 métricas)
- 5 ratios `fifth_{1..5}_ratio` + `intercanthal_to_eye_width_ratio`.
- Ideal canônico: 0.20 cada, `green=±0.02`.
- **Teste**: idem padrão acima.

### 3.4 Família **olhos** (6 métricas)
- `eye_aperture_ratio_l/r`, `interpupillary_distance` (em unidades intercanthais), `intercanthal_distance` (= 1.0 por construção, vira sanity check), `canthal_tilt_l/r`.
- **Teste**: perfeito → tilt 0°, aperture igual L/R. Asymmetric → tilt diferente entre lados, validar `direction='left_dominant'` ou `right_dominant`.

**Total M1: 20 métricas** (5+4+5+6). Bate com o critério do M1.

---

## 4. Fixtures sintéticas — desenho

Crio um gerador procedural em `tests/fixtures/synthetic_perfect_face.py`:

- Modelo geométrico simplificado: posiciono 468 landmarks em coordenadas canônicas (espaço normalizado já intercanthal-escalado, midline em x=0). Os índices respeitam a topologia MediaPipe Face Mesh, mas só os pontos consumidos pelas 20 métricas precisam estar "anatomicamente certos" — o resto é interpolação suave.
- `synthetic_perfect_face()` → simétrico, 100% canônico (terços iguais, quintos iguais, tilt 0°).
- `known_asymmetric_face(offset_y=0.05)` → desloca olho esquerdo +0.05 em y. Valor exato esperado pelas métricas é determinístico → asserts duros.
- `posed_face(yaw_deg=12)` → aplica matriz de rotação 3D nas coordenadas do perfeito antes de projetar 2D. Valida que o `normalizer.py` desfaz e recupera o perfeito (com erro < 1%).

**Vantagem**: testes não dependem de fotos reais nem do MediaPipe. Rápido, determinístico, executável em CI sem GPU.

---

## 5. Endpoint `POST /vision/analyze` — contrato M1

```json
// Request
{
  "session_id": "uuid",
  "landmarks": [[x,y], ...],            // 468 pontos, espaço de pixels
  "quality_context": {
    "quality_score": 0.86,
    "regional_penalties": {"jaw": 0.1, "eye": 0.0, ...},
    "pose": {"yaw": 5.2, "pitch": -1.0, "roll": 0.8}
  },
  "ideals_version": "v1.0",            // opcional, default = is_active
  "user_context": {"sex": null, "age_band": null}  // aceito mas IGNORADO no M1 (DEC-13)
}
```

```json
// Response (M1 — sem texto, sem overlay, sem score regional)
{
  "analysis_report_id": "uuid",
  "metric_registry_version": "v1.0",
  "ideals_version": "v1.0",
  "threshold_config_version": "v1.0",
  "normalization": {"basis": "intercanthal", "applied": true},
  "metrics": [
    {
      "metric_id": "eye_height_asymmetry",
      "region": "symmetry",
      "family": "symmetry",
      "unit": "intercanthal_units",
      "value": 0.048,
      "error": 0.005,
      "confidence_final": 0.82,
      "is_low_confidence": false,
      "direction": "left_dominant",
      "dependency_landmarks": [33, 133, 263, 362],
      "presentation_only": false,
      "against_ideal": {
        "ideal_central_value": 0.0,
        "deviation_raw": 0.048,
        "deviation_normalized": 1.6,
        "severity_5": "moderate",
        "severity_3": "MODERADO",
        "direction_label": {"pt-BR": "olho esquerdo mais alto"}
      }
    }
    // ... 19 outras
  ],
  "processing_notes": [
    "user_context.sex provided but ignored in M1 (no demographic-segmented ideals yet)"
  ],
  "disclaimer": "Análise estética geométrica baseada em uma foto. Não substitui avaliação profissional."
}
```

Persistência: 1 row em `analysis_report`, 1 em `landmark_payload`, 20 em `metric_evaluation`, 20 em `metric_evaluation_against_ideal`. Tudo em uma transação.

`/vision/metrics` (legado) **fica vivo intocado**.

---

## 6. Sequência executável (ordem de PRs)

1. **PR-1 Infra**: postgres no compose + sqlalchemy/alembic instalado + esqueleto vazio em `infra/db/`. Smoke test: `alembic current` roda no container.
2. **PR-2 DDL leva 1**: migration `0001_catalogs.py` + seed YAML→DB (script `app/cli/seed_catalogs.py`) + repositório `metric_definition_repo`. Sem métricas ainda, só schema vivo + 20 entradas-fantasma cadastradas.
3. **PR-3 DDL leva 2**: migration `0002_evaluations_and_root.py` + repositórios `analysis_report_repo` / `metric_evaluation_repo`.
4. **PR-4 Normalização**: `services/normalization/` completo + testes (3 fixtures) verificando idempotência e correção de pose.
5. **PR-5 Família simetria** + 5 ideais YAML + 5 testes.
6. **PR-6 Família terços** + 4 ideais + 4 testes.
7. **PR-7 Família quintos** + 5 ideais + 5 testes.
8. **PR-8 Família olhos** + 6 ideais + 6 testes.
9. **PR-9 Comparator + propagação de confiança**: `services/ideals/comparator.py` + `services/metrics/confidence_propagation.py` + testes do colapso 5→3 e da curva de pose-penalty.
10. **PR-10 Endpoint `/vision/analyze`**: orquestrador + router + 3 testes de integração end-to-end (perfeito / asymmetric / persistência).

Cada PR é mergeable independentemente. Rollback de qualquer um não trava os anteriores.

---

## Pendências para você confirmar antes do PR-1

- **DEC-19** (legado): A — paralelo, OK?
- **DEC-20** (Postgres entra no M1): OK?
- **Disclaimer canônico em PT-BR**: me passa o texto exato que vai congelado em `disclaimer_text_snapshot`, ou eu proponho um e você revisa?
- **Tabela Farkas como fonte**: você tem acesso à compilação ou eu uso valores de literatura aberta (e cito link interno)?
- **`min_confidence_to_show_metric` calibrado em 0.4**: confirma que abaixo disso a métrica **não vai pra response** (some), ou aparece com flag `hidden_low_confidence=true`? (Plano dizia "não vai pra UI", mas no MVP isso pode acontecer no NestJS — vale deixar no JSON cru?).


Plano excelente. As duas descobertas no código (ausência de Postgres e legado por heurística de string) são exatamente o tipo de coisa que justifica um modelo explorar antes de codar — sem isso o M1 entrava em rota de colisão. Respostas para travar:

## DEC-19 — Legado paralelo (A), confirmado

Greenfield em `services/metrics/` + novo `/vision/analyze`. Legado intocado em `/vision/metrics`. Os argumentos contra B e C estão corretos: refactor in-place quebra orchestrator/frontend; adapter perpetua a heurística de string. Quando `/vision/analyze` estabilizar (provável M3 ou M4, não M1), marca o legado como deprecated com aviso no log e remove em release próprio.

## DEC-20 — Postgres entra no M1, confirmado

Sem ele, `metric_registry_version` e `ideals_version` viram metadados imaginários — o JSON cru sai com snapshots que apontam para nada. Persistência incremental desde já. Bônus que o modelo não citou: isso destrava o Módulo 0 (PhotoQuality) também passar a persistir, já que as tabelas dele estão no DDL mas aparentemente nunca foram aplicadas. Vale criar uma migration `0000_extensions.py` antes da 0001 só para `CREATE EXTENSION IF NOT EXISTS pgcrypto` ficar isolado.

## Disclaimer canônico em PT-BR

Usa este texto (pode ajustar tom, mas mantém os elementos):

> "Esta análise é uma observação estética e geométrica produzida a partir de uma única foto. Não constitui diagnóstico médico, odontológico, fisioterapêutico ou de qualquer natureza clínica, e não substitui avaliação profissional presencial. Os resultados são sensíveis à qualidade da foto, ângulo, iluminação e expressão capturados. Se você apresenta dor, dificuldade funcional (na mastigação, respiração ou postura) ou desconforto persistente, procure um profissional habilitado."

Cinco elementos obrigatórios: (1) "observação estética e geométrica" — não "diagnóstico"; (2) explicita "uma única foto" para enquadrar limite epistêmico; (3) lista os campos profissionais que ela não substitui; (4) reconhece variabilidade por captura; (5) chama profissional para sintoma funcional, não estético. Congela isso em `disclaimer_text_snapshot` e versiona junto com `threshold_config_version` (qualquer mudança gera nova versão de config).

## Farkas — não precisa pagar agora

Para as 20 métricas do M1 você não precisa de Farkas. Tudo é canônico ou trivial:

- **Terços**: 1/3 cada (Vitruviano/da Vinci, sem citação acadêmica necessária).
- **Quintos**: 1/5 cada (canônico estético, idem).
- **Simetria**: zero é o ideal por construção.
- **Olhos**: intercanthal ≈ largura de um olho (canônico); tilt cantal positivo médio 4–6° (documentado em literatura aberta — Rhee & Lee 2012 e similares); aperture ratio ~0.30 (literatura oftalmológica aberta).

Use literatura aberta no M1 e preenche `population_reference_note` com link/citação por entrada. Farkas só faz diferença real no M2, quando entram mandíbula, nariz e boca com referências populacionais absolutas. Aí você decide entre comprar acesso, pegar valores citados em papers que referenciam Farkas, ou fazer parceria com alguém de ortodontia/cirurgia que tenha o livro. Não bloqueia o M1.

## Confiança baixa — aparece com flag, não some

Resposta à última pendência: **mantém na response com `is_low_confidence=true` e adiciona `displayable=false`**. Três motivos:

A response do `/vision/analyze` é o "JSON cru" do contrato — filtragem é responsabilidade da camada que consome (NestJS aplica política de exibição, frontend renderiza). Filtrar no FastAPI cria inconsistência entre o que está em `metric_evaluation` (todas as 20 métricas) e o que o NestJS recebe (subset). Calibrar o threshold depois (mover de 0.4 para 0.35) sem reprocessar exige que o dado bruto tenha chegado lá. E auditoria: você quer saber que a métrica foi calculada e por que foi suprimida — não que ela "desapareceu".

A regra fica: FastAPI sempre devolve as 20, com flags. NestJS aplica `displayable=false` antes de mandar pro frontend. Frontend nunca vê métrica abaixo do threshold, mas o histórico tem tudo.

---

Pode começar pelo PR-1.


# Plano consolidado — Marco 1 (Núcleo Analítico)

Status: APROVADO pelo usuário em 2026-05-07. Próximo passo = PR-1 (modo implementação).

## Decisões travadas (DEC-1 a DEC-20)

1. Normalização: **intercanthal**, congelado.
2. Ideal: **híbrido**; M1 só canônico + literatura aberta (Farkas só M2+).
3. Severidade: 5 níveis em `metric_evaluation_against_ideal` (`ideal|mild|moderate|strong|extreme`); 3 em `diagnostic_candidate` (`LEVE|MODERADO|SEVERO`). Colapso: ideal+mild→LEVE, moderate→MODERADO, strong+extreme→SEVERO. Persistido em tabela `severity_collapse_policy`.
4. i18n: campo `locale` desde já, default `pt-BR`. Display names em JSONB `{locale: text}`.
5. Aggregate root: `analysis_report` novo, FK opcional p/ `diagnostic_report` e `decision_output` (coexistência).
6. `presentation_only`: regra DURA em código — `regional_scorer`/`global_scorer` recusam por assertion.
7. Thresholds em `analysis_threshold_config` (versionada). Defaults: 0.4 metric display, 0.5 global score.
8. Regiões críticas p/ gating do score global: olhos, simetria, proporção_vertical, **mandíbula**.
9. Bandas de score: `<50` sem número ("oportunidades de harmonização"); 50–70 + texto; 70–85 "boa harmonia"; >85 "alta harmonia".
10. Pixel-dependent: cadastra em `metric_definition` com `requires_pixel_analysis=true`, MAS pipeline pula (não emite `metric_evaluation`).
11. Multi-captura adiada. `landmark_payload.capture_count INT DEFAULT 1` reservado.
12. Versionamento: 7 tabelas `*_version` independentes agora; agregador (`analysis_versioning_set`) depois.
13. `user_context` (sex/age) aceito mas IGNORADO no M1; registrado em `processing_notes`.
14. MinIO: paths `/rendered/single/{report_id}.png`, `/rendered/region/{report_id}/{region}.png`, `/rendered/before-ideal/{report_id}.png`, `/reports/pdf/{report_id}.pdf`. TTL + opt-in (mesma policy de `photo_storage`). Assets sensíveis = mesma retenção da foto bruta.
15. Before/ideal: M3 vetorial (sem warp); warp pós-M3.
16. `metric_id` snake_case inglês; `display_name` JSONB i18n.
17. `metric_evaluation` e `analysis_report` particionadas RANGE mensal por `generated_at` desde o CREATE.
18. DDL incremental por marco (levas 1+2 antes do M1).
19. Legado: paralelo (A). `services/metrics/` novo + `/vision/analyze`. Legado `/vision/metrics` intocado, deprecation só em M3-M4.
20. Postgres entra no M1 (sem ele snapshots de versão são metadata fantasma). Migration 0000 isolada para `CREATE EXTENSION pgcrypto`.

## Disclaimer canônico (congelar em `disclaimer_text_snapshot` v1)

> "Esta análise é uma observação estética e geométrica produzida a partir de uma única foto. Não constitui diagnóstico médico, odontológico, fisioterapêutico ou de qualquer natureza clínica, e não substitui avaliação profissional presencial. Os resultados são sensíveis à qualidade da foto, ângulo, iluminação e expressão capturados. Se você apresenta dor, dificuldade funcional (na mastigação, respiração ou postura) ou desconforto persistente, procure um profissional habilitado."

Versionado junto com `threshold_config_version`.

## Política de confiança baixa

FastAPI SEMPRE devolve as 20 métricas. Cada uma com `is_low_confidence` (bool, =confidence_final<0.4) e `displayable` (bool). Filtragem é responsabilidade do NestJS antes de mandar ao frontend. Persistência preserva tudo (auditoria + recalibração futura).

## Sequência de PRs (M1)

1. **PR-1 Infra**: postgres no docker-compose; sqlalchemy/asyncpg/alembic/pyyaml em pyproject; `app/infra/db/{engine,base,session}.py`; alembic init; smoke test `alembic current`.
2. **PR-2 DDL leva 1**: migration `0000_extensions.py` (pgcrypto), `0001_catalogs.py`. Tabelas: `metric_registry_version`, `metric_definition`, `ideals_version`, `metric_ideal`, `analysis_threshold_config`, `severity_collapse_policy`. Seed via `app/cli/seed_catalogs.py` lendo `config/metric_registry.yaml` + `config/metric_ideals.yaml`. Repo `metric_definition_repo`.
3. **PR-3 DDL leva 2**: migration `0002_evaluations_and_root.py`. Tabelas: `analysis_report` (partitioned monthly), `landmark_payload`, `metric_evaluation` (partitioned monthly), `metric_evaluation_against_ideal`. Repos `analysis_report_repo`, `metric_evaluation_repo`. 3 partições futuras criadas manualmente.
4. **PR-4 Normalização**: `services/normalization/` (pose_correction, intercanthal_scaler, midline_aligner, normalizer). Domain `NormalizedLandmarks` (basis="intercanthal"). 3 fixtures sintéticas + testes de idempotência e correção de pose.
5. **PR-5 Família simetria** (5 métricas): midline_deviation, eye_height_asymmetry, brow_height_asymmetry, lip_canting_angle, global_asymmetry_index. + ideais YAML + testes nas 3 fixtures.
6. **PR-6 Família terços** (4): upper/middle/lower_third_ratio + dominant_third.
7. **PR-7 Família quintos** (5): fifth_1..5_ratio + intercanthal_to_eye_width_ratio.
8. **PR-8 Família olhos** (6): eye_aperture_ratio_l/r, interpupillary_distance, intercanthal_distance (sanity), canthal_tilt_l/r.
9. **PR-9 Comparator + propagação confiança**: `services/ideals/comparator.py`, `services/metrics/confidence_propagation.py` (sigmóide pose-penalty), severity collapse 5→3. Testes.
10. **PR-10 Endpoint /vision/analyze**: `vision/routers/analyze.py` + `services/pipeline/analyze_orchestrator.py`. Tx única persiste analysis_report + landmark_payload + 20 metric_evaluation + 20 against_ideal. 3 testes integração (perfeito / asymmetric / persistência).

## Estrutura de pastas alvo

```
backend/app/
├── config/{metric_registry.yaml, metric_ideals.yaml}
├── infra/db/{engine,base,session}.py
├── infra/repositories/{analysis_report,metric_evaluation,metric_definition}_repo.py
├── domain/{metric_evaluation,metric_ideal,normalized_landmarks}.py
├── services/normalization/{pose_correction,intercanthal_scaler,midline_aligner,normalizer}.py
├── services/metrics/{base,registry,confidence_propagation,symmetry,thirds,fifths,eyes}.py
├── services/ideals/{loader,comparator}.py
├── services/pipeline/analyze_orchestrator.py
├── vision/routers/analyze.py
├── cli/seed_catalogs.py
└── alembic/versions/{0000_extensions,0001_catalogs,0002_evaluations_and_root}.py

backend/tests/
├── fixtures/{synthetic_perfect_face,known_asymmetric_face,posed_face}.py
├── unit/{normalization,metrics,ideals,confidence}/...
└── integration/test_analyze_endpoint_*.py
```

## Contrato `/vision/analyze` (M1)

Request: session_id, landmarks, quality_context (quality_score+regional_penalties+pose), ideals_version opcional, user_context (ignorado).

Response: analysis_report_id, snapshots de versão, normalization (basis, applied), metrics[20] cada com value/error/confidence_final/is_low_confidence/displayable/direction/dependency_landmarks/presentation_only/against_ideal{deviation_raw,deviation_normalized,severity_5,severity_3,direction_label{locale}}, processing_notes, disclaimer.

Sem score regional/global, sem texto, sem overlay (esses são M2/M3/M4).

## Fora do escopo M1 (não codar)

Factor_*, regional_score, global_score, region_metric_weight, global_weight, overlays, diagnostic_template, recommendations, PDF export, warp before/ideal, multi-captura, demografia, Farkas populacional.

