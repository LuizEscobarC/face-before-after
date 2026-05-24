# Plano — Documentação RAG: Cálculos Python + REST APIs (v3, calibrado ao pipeline ai-first)

## Contexto

Monorepo `face-before-after` já tem cobertura forte de **face-analysis** em `.claude/local/face-analysis/` (00→09) e auditorias em `.claude/local/docs/calcs/round2/`. Faltam, para o tenant RAG `face-before-after-backend`:

1. **Catálogo canônico das 23 REST APIs** (8 em `api/endpoints/`, 15 em `vision/routers/`) — com **duplicação funcional** real entre os dois.
2. **Docs fatiados por família de cálculo** consumíveis em chunks.

Princípio: **não duplicar** `face-analysis/*` nem `docs/calcs/*` — referenciar.

## Restrições reais do pipeline ai-first (validadas em 2026-05-24)

Estas restrições **moldam o formato dos docs** e não são negociáveis se quisermos retrieval bom.

### R1 — Pipeline de ingestão para `face-before-after-backend` é MD-only

`scripts/ingest-all.ts` em ai-first define `STEPS_BY_PROJECT`. `face-before-after-backend` cai no `DEFAULT_STEPS = ['md', 'md-docs', 'schema', 'samples', 'semantic-map', 'routes', 'code-php']`. **Não há `code-py`.** Logo: classes/funções/métodos Python **NÃO** serão entities indexadas — só `heading` extraído de `## ...` em Markdown.

**Consequência:** todo identificador Python relevante (`run_pipeline`, `NormalizedLandmarks`, `metric_id="phi_face_height"`, etc.) **precisa aparecer no corpo do MD**, em prosa ou em listas — não pode depender de extração automática. Citar em backticks `` `Identificador` `` para BM25 ranquear bem.

### R2 — Cross-encoder reranker trunca candidates em 3000 caracteres

Default ON (`RERANKER_ENABLED`). Cap de 3000 chars no candidate antes do rerank. Conteúdo de uma seção `##` que ultrapasse esse limite é **ignorado pelo cross-encoder** — o início ranqueia, o fim some.

**Consequência:** cada `##` deve caber em ~3000 chars ≈ 75-100 linhas Markdown. **Esse é o teto duro.** Se uma família tem mais conteúdo, quebrar em `##` separados (uma métrica = um `##`).

### R3 — `doc_type`, `module`, `tags` são filtros WHERE no Neo4j

`SearchFilters` aplica no Cypher antes do score — não é pós-processamento. Classificação errada **remove** o doc da query filtrada.

**Consequência:** taxonomia rígida:
- `doc_type: api` → etapas 1-2 (catálogos de endpoint).
- `doc_type: schema` → contratos puros (Pydantic DTOs).
- `doc_type: architecture` → etapas 3-4, 9, 11 (pipeline, primitives, rendering, reports).
- `doc_type: code` → cálculos com fórmula explícita (etapas 5-8).
- `doc_type: concept` → glossários, layers de output (etapa 10).
- `doc_type: decision` → ADRs (path próprio via `DECISIONS_RETRIEVAL_ENABLED`).

### R4 — GraphRAG default OFF + multitenant filtrado

`GRAPHRAG_ENABLED` default = false. Mesmo quando ON, traversal carrega `project` filter — arestas cross-tenant não atravessam. `related_modules: ["frontend/overlay-system"]` em doc de backend **nunca** vira aresta navegável (tenant diferente).

**Consequência:** `related_modules` cross-tenant é apenas anotação humana. Para retrieval real, depender de:
- (a) Matchar jargão no body via dense+sparse.
- (b) Garantir `rag_keywords` com termo cruzado entre tenants (ex.: `"overlay_annotations payload"` em ambos).

### R5 — Entity extraction só ancora `heading` em docs MD

`extractEntities` cria `:Entity` a partir de `heading` (MD), `class_name`/`method_name`/`table_name` (code-* — que não roda para Python aqui). Logo, `##` descritivo vira nó de grafo navegável.

**Consequência:** títulos de `##` devem ser **identificadores reais ou jargão estável** — `## metric_id phi_face_height` é melhor que `## Cálculo da altura facial`. Headings genéricos perdem ancoragem.

## Pré-flight (1× antes da etapa 1)

```bash
# 1) Tabela canônica de rotas
grep -rn "^@router\." backend/app/api/endpoints/ backend/app/vision/routers/

# 2) Tabela canônica de metric_id reais
grep -rn 'metric_id\s*=' backend/app/services/metrics/

# 3) Contagem por família (total 93, já validado)
for f in backend/app/services/metrics/{symmetry,thirds,fifths,eyes,brows,nose,mouth,jaw,cheekbones,forehead,phi_golden,global_shape,wave_c2,wave_c3}.py; do
  echo "$(basename $f .py): $(grep -c '^@register$' $f)"
done

# 4) DTOs de schemas
ls backend/app/schemas/
```

Status em 2026-05-24:
- ai-first em `localhost:3099` **online** (RAG operacional).
- 23 endpoints (8 + 15) confirmados.
- 93 métricas em 14 famílias.

## Etapas

### Etapa 1 — REST API: `api/endpoints/` (8 endpoints)
**Arquivo:** `.claude/local/context/backend/10-api-endpoints.md` · **`doc_type: api`**  
Um `##` por endpoint. Body: path+method em backticks, `arquivo:linha`, request DTO, response DTO, side-effects, curl mínimo.

### Etapa 2 — REST API: `vision/routers/` (15) + duplicações
**Arquivo:** `11-api-vision.md` · **`doc_type: api`**  
Um `##` por endpoint + um final **"Duplicações com `/api/`"** decidindo canônico/legacy para:
- `capture-guidelines`, `results/{run_id}/{annotated,simulation}`, `compare` (em ambos os routers).
- `metrics` vs `metrics-v2` (intra-vision).

Decisão por `grep -rn '/vision/capture-guidelines' frontend nest`.

### Etapa 3 — Pipeline orchestration
**Arquivo:** `12-pipeline.md` · **`doc_type: architecture`**  
`run_pipeline`, `canonical_frame`, `simulate`, `face_metrics`, `face_asymmetry`. Um `##` por estágio.

### Etapa 4 — Vision services primitives
**Arquivo:** `13-vision-primitives.md` · **`doc_type: architecture`**  
7 serviços de `vision/services/` (face_detection, face_landmarker, pose_estimator, quality_evaluator, metric_calculator, image_codec, fingerprint). Um `##` por serviço.

### Etapa 5 — Normalization & ICU
**Arquivo:** `20-calc-normalization.md` · **`doc_type: code`**  
ICD→ICU, midline align, pose correction, thresholds frontais. Referencia `face-analysis/03-calculations.md`.

### Etapa 6 — Confidence & Stability
**Arquivo:** `21-calc-confidence.md` · **`doc_type: code`**  
Propagation fórmula completa, `LOW_CONF_THRESHOLD=0.35`, multi-capture jitter. Referencia `docs/calcs/round2/02-confidence-propagation.md`.

### Etapa 7 — Famílias de métricas (1 arquivo por família, `doc_type: code`)

| Arquivo | Família | Métricas | Módulo |
|---|---|---|---|
| `22-calc-symmetry.md` | Symmetry | 5 | `metrics/symmetry.py` |
| `23-calc-thirds.md` | Thirds | 4 | `metrics/thirds.py` |
| `24-calc-fifths.md` | Fifths | 6 | `metrics/fifths.py` |
| `25-calc-eyes.md` | Eyes | 10 | `metrics/eyes.py` |
| `26-calc-brows.md` | Brows | 9 | `metrics/brows.py` |
| `27-calc-nose.md` | Nose | 9 | `metrics/nose.py` |
| `28-calc-mouth.md` | Mouth | 7 | `metrics/mouth.py` |
| `29-calc-jaw.md` | Jaw | 6 | `metrics/jaw.py` |
| `2A-calc-cheekbones.md` | Cheekbones | 5 | `metrics/cheekbones.py` |
| `2B-calc-forehead.md` | Forehead | 4 | `metrics/forehead.py` |
| `2C-calc-phi.md` | Phi | 4 | `metrics/phi_golden.py` |
| `2D-calc-global-shape.md` | Global shape | 4 | `metrics/global_shape.py` |
| `2E-calc-wave-c2.md` | Wave C2 | 10 | `metrics/wave_c2.py` |
| `2F-calc-wave-c3.md` | Wave C3 | 10 | `metrics/wave_c3.py` |

**Regra de heading (aplica R5):** cada métrica = um `##` cujo título é o **`metric_id` real**, ex.: `## phi_face_height`, não `## Altura facial Phi`. O `metric_id` vira `:Entity` navegável.

**Body por métrica (≤3000 chars — R2):** fórmula em bloco código, landmarks (`LM_*` constants citadas em backticks), faixa ideal numérica, severity bins, callsite (`services/metrics/<file>.py:<linha>`).

### Etapa 8 — Trichion & Segmentation
**Arquivo:** `30-trichion-bisenet.md` · **`doc_type: code`**

### Etapa 9 — Overlays, Heatmaps & Composer
**Arquivo:** `31-overlays-rendering.md` · **`doc_type: architecture`**  
Payload `overlay_annotations`, heatmap coolwarm, before/ideal composer. **`rag_keywords` replica jargão usado no tenant frontend** (R4): `"overlay_annotations payload"`, `"SVG layer"`, `"region_adherence"`.

### Etapa 10 — Output layers & Improvement Vectors
**Arquivo:** `32-output-layers.md` · **`doc_type: concept`**  
`domain/layers/` (6 módulos: visual_status, top_leverage, impression, recommendations, evolution_path, glossary). Improvement vectors documentado como **conceito transversal** com origens explícitas em `domain/metric_value.py`, `domain/pipeline.py`, `services/metrics/{brows,symmetry,jaw}.py`, `vision/services/before_ideal_composer.py`. Sem inventar `services/scoring/`.

### Etapa 11 — PDF & Reports
**Arquivo:** `33-reports.md` · **`doc_type: architecture`**  
`reports/{compare,html_builder}.py`, `vision/services/pdf_builder.py`, endpoints `compare` e `generate-pdf`.

## Padrões de execução (toda etapa)

- **Frontmatter:** `tenant_id: face-before-after-backend`, `doc_type` per R3, `summary_context` denso (2-3 frases com identificadores reais), `rag_keywords` (jargão + acronyms + traduções PT↔EN — não palavras genéricas).
- **Headings (R5):** `##` é identificador real, não título estético.
- **Tamanho (R2):** cada `##` ≤ ~3000 chars.
- **Identificadores em backticks (R1):** classes/funções/`metric_id` em `` ` ` `` para BM25.
- **Cross-tenant (R4):** referenciar via `rag_keywords` compartilhado, não via `related_modules`.
- A cada etapa: bumpar `99-changelog.md` de `backend/`, atualizar `backend/00-index.md`, bumpar `_meta/00-index.md` (`updated_at`).

## Verificação por etapa (queries concretas)

```bash
TOKEN="${AI_INTERNAL_TOKEN:-test-token-123}"

# 1) Ingestão
bash .claude/local/scripts/ingest-project.sh face-before-after-backend

# 2) Smoke — query com identificador específico
curl -s -X POST http://localhost:3099/api/rag \
  -H "Content-Type: application/json" -H "x-internal-token: $TOKEN" \
  -d '{"query":"<identificador-real>","project":"face-before-after-backend","limit":3}' \
  | jq '.chunks[] | {file_path, heading, rerankScore}'

# 3) Filtro doc_type
curl -s -X POST http://localhost:3099/api/rag \
  -H "Content-Type: application/json" -H "x-internal-token: $TOKEN" \
  -d '{"query":"<termo>","project":"face-before-after-backend","filters":{"doc_type":"<tipo>"},"limit":5}'
```

**Critério de aceitação por etapa:**
- Doc novo no top-3 para query com identificador real.
- `heading` retornado bate com algum `##` do doc (R5).
- Filtro `doc_type` retorna o doc com o tipo declarado.
- Chunks médios ≤ 3000 chars (`jq '.chunks[].text | length'` mediana abaixo de 3000).

## Política de falha do ai-first

Online confirmado em 2026-05-24. Se cair:
- Continuar escrevendo docs.
- Acumular pendência em changelog do `_meta/`.
- Rodar batch quando voltar.

## Escopo explicitamente fora

- frontend/, nest/, database/, infra/, root-pipeline/ — etapas futuras.
- Refactor de código.
- Mudar `face-analysis/` ou `docs/calcs/`.

## Changelog deste plano

- **2026-05-24 v3** — Calibrado ao pipeline real do ai-first (consultado via `/api/rag` tenant=ai-first). Restrições R1-R5 adicionadas: MD-only para Python, cap 3000 chars do reranker, filtros WHERE de `doc_type`, GraphRAG OFF + multitenant isolado, entity extraction só pega `heading`. Taxonomia `doc_type` rígida por etapa. Headings ancorados em `metric_id` real. Verificação por etapa com queries `/api/rag` concretas + critérios de aceitação mensuráveis.
- **2026-05-24 v2** — Pós-verificação crítica do código. Paths corrigidos (`api/endpoints/`, `vision/routers/`), contagens validadas (93 métricas), etapa scoring/improvement_vectors refeita como conceito transversal (etapa 10), novas etapas 4 (vision primitives) e 10 (output layers), duplicação api↔vision endereçada.
- **2026-05-24 v1** — Versão inicial.
