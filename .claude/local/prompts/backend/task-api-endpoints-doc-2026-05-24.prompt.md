# Documentar REST API — `api/endpoints/` (10-api-endpoints.md)

> **Type:** doc
> **Module:** backend
> **Date:** 2026-05-24
> **Stack:** Python 3.12 · FastAPI · Pydantic v2
> **Quality gate:** nenhum lint configurado para Python neste projeto — verificar que o MD é válido e que grep confirma todos os identificadores.

---

## Context

Criar `.claude/local/context/backend/10-api-endpoints.md` documentando os **8 endpoints** do router `api/endpoints/` (legacy/raiz) com `doc_type: api`, `tenant_id: face-before-after-backend`.

**Arquivo de mounting:** `backend/app/api/router.py` — prefixes reais:

| Router | Prefix montado | Endpoints finais |
|---|---|---|
| `meta.router` | (nenhum) | `GET /`, `GET /api/capture-guidelines`, `GET /api/glossary` |
| `analysis.router` | `/api/analyze` | `POST /api/analyze/free`, `POST /api/analyze/premium` |
| `results.router` | `/api/result` | `GET /api/result/{run_id}/annotated`, `GET /api/result/{run_id}/simulation/{sim_type}` |
| `compare.router` | `/api` | `POST /api/compare` |

**Fonte:** `backend/app/api/endpoints/{analysis,compare,meta,results}.py`

**Schemas (`backend/app/schemas/` está vazio — DTOs são inline nos endpoints):**
- `CompareRequest(BaseModel)`: `run_id_before: str`, `run_id_after: str` (em `compare.py`)
- `analysis.py`: sem DTO de request — usa `UploadFile = File(...)` diretamente
- `results.py`: sem DTO — path params apenas
- `meta.py`: sem DTO — sem body

**Exceptions mapeadas** (`backend/app/core/exceptions.py`):
- `InvalidImageError` → 400
- `FileTooLargeError` → 413
- `FaceNotDetectedError` → 400
- `RunNotFoundError` → 404
- `SimulationNotFoundError` → 404
- `InvalidSimulationTypeError` → 400

**Side-effects de `POST /api/analyze/*`:**
- Gera `run_id = uuid4().hex[:12]`
- Cria `settings.resultado_api_dir/{run_id}/` e escreve imagem de input
- Persiste ao disco: `{base}_mvp_report.json`, `{base}_mvp_report.txt`, `{base}_mvp_annotated.jpg`
- Upload opcional para MinIO em `uploads/{run_id}/{filename}`

**`sim_type` válidos** (em `results.py`):
- `symmetrized`, `ideal_proportions`, `comparison_grid`

**Injected context:**
- `backend/00-index.md` (já existente — atualizar com link para o novo doc)
- `_meta/00-index.md` (bumpar `updated_at`)
- Plano-pai: `.claude/local/plans/crystalline-growing-sundae.md` §Etapa 1

---

## Restrições de formato (do plano-pai R1-R5)

| Restrição | Regra |
|---|---|
| R1 (MD-only) | Todos os identificadores Python citados em `` `backticks` `` para BM25 |
| R2 (reranker cap) | Cada `##` ≤ 3000 chars (≈ 75-100 linhas) |
| R3 (filtros WHERE) | `doc_type: api` no frontmatter — taxonomia rígida |
| R4 (cross-tenant) | `related_modules` cross-tenant apenas como anotação; usar `rag_keywords` para jargão cruzável |
| R5 (entity heading) | Heading de cada `##` = path canônico do endpoint (ex.: `## POST /api/analyze/premium`) |

---

## Dependency Map (Layer 2 — todos verificados por grep/Read)

| Símbolo | Arquivo | Linha (aprox.) |
|---|---|---|
| `analyze_free` / `analyze_premium` | `api/endpoints/analysis.py` | 68–78 |
| `_run_analysis(upload, mode, storage)` | `api/endpoints/analysis.py` | 33–57 |
| `pipeline.run(image_path, output_dir, mode)` | `domain/pipeline.py` | 1021 |
| `resultado_api_dir` | `core/config.py` | 10 |
| `CompareRequest` | `api/endpoints/compare.py` | 18 |
| `compare_runs(req)` | `api/endpoints/compare.py` | 36 |
| `cr.compare_json(report_before, report_after)` | `reports/compare.py` | (a confirmar) |
| `capture_guidelines()` | `api/endpoints/meta.py` | 42 |
| `GLOSSARY` | `domain/layers/glossary.py` | (a confirmar) |
| `_SIM_PATTERNS` | `api/endpoints/results.py` | 18 |
| `get_annotated_image(run_id)` | `api/endpoints/results.py` | 28 |
| `get_simulation_image(run_id, sim_type)` | `api/endpoints/results.py` | 35 |
| `RunNotFoundError`, `SimulationNotFoundError`, etc. | `core/exceptions.py` | vários |

**⚠️ Unresolved:** `cr.compare_json` retorno — confirmar shape antes de documentar response. Idem `GLOSSARY` — estrutura não inspecionada.

---

## Steps / Checks

### Pre-implementation

- [ ] Ler `backend/app/reports/compare.py` — confirmar shape do retorno de `compare_json`
- [ ] Ler `backend/app/domain/layers/glossary.py` — confirmar estrutura de `GLOSSARY`
- [ ] Confirmar que `backend/app/api/router.py` é o único mounting (não há main.py com prefixes adicionais)
- [ ] Grep: `grep -rn "include_router" backend/app/main.py` — verificar se o APIRouter `api/router.py` é montado com prefix ou sem

### Implementation

1. **Criar frontmatter** do doc com todos os campos obrigatórios:
   ```yaml
   tenant_id: "face-before-after-backend"
   project: "face-before-after-backend"
   module: "backend/api-endpoints"
   file_path: ".claude/local/context/backend/10-api-endpoints.md"
   doc_type: "api"
   created_at: "2026-05-24"
   updated_at: "2026-05-24"
   version: "1.0.0"
   summary_context: >
     [2-3 frases factuais: 8 endpoints do router /api/* montado em backend/app/api/router.py,
     cobrindo análise de face (free/premium), resultados (annotated, simulation), compare de runs
     e meta (capture-guidelines, glossary). Router legacy — vision/routers/ tem endpoints canônicos mais completos.]
   tags:
     - "backend"
     - "api"
     - "rest"
   rag_keywords:
     - "POST /api/analyze/free teaser mode"
     - "POST /api/analyze/premium full pipeline"
     - "run_id hex12 uuid"
     - "resultado_api_dir filesystem"
     - "CompareRequest run_id_before run_id_after"
     - "simulation types symmetrized ideal_proportions comparison_grid"
     - "MinIO upload face analysis"
   ```

2. **Escrever 8 seções `##`** — uma por endpoint. Ordem lógica (meta → analysis → results → compare).

   **Template por `##`:**
   ```markdown
   ## METHOD /canonical/path

   **Arquivo:** `backend/app/api/endpoints/<file>.py:<linha>`
   
   **Request:**
   - Body: `CompareRequest` (`run_id_before: str`, `run_id_after: str`) | ou `multipart/form-data: photo: UploadFile` | ou sem body
   - Path params: `{run_id: str}`, `{sim_type: str}` (quando aplicável)
   - Validação: formato `.png/.jpg/.jpeg`, tamanho ≤ 15MB
   
   **Response:** `200 dict` — descrever campos principais
   
   **Side-effects:**
   - (quando aplicável) Gera `run_id = uuid4().hex[:12]`, cria `resultado_api_dir/{run_id}/`
   - Persiste `{base}_mvp_report.json`, `{base}_mvp_report.txt`, `{base}_mvp_annotated.jpg`
   - Upload opcional MinIO `uploads/{run_id}/{filename}` (falha silenciosa)
   
   **Errors:** 400 `InvalidImageError`, 413 `FileTooLargeError`, 500 pipeline error
   
   **curl:**
   ```bash
   curl -X POST .../api/analyze/premium -F "photo=@face.jpg"
   ```
   ```

3. **Seção final `## Duplicações com vision/routers/`** — declarar que:
   - `/api/capture-guidelines` (meta) tem equivalente em `GET /vision/capture-guidelines`
   - `/api/result/{run_id}/annotated` tem equivalente em `GET /vision/results/{run_id}/annotated`
   - `/api/result/{run_id}/simulation/{sim_type}` tem equivalente em `GET /vision/results/{run_id}/simulation/{sim_type}`
   - `/api/compare` tem equivalente em `POST /vision/compare`
   - **Canônico:** `vision/routers/` é o canônico (implementação mais completa, exposta pelo NestJS orchestrator)
   - Este router (`api/endpoints/`) é legacy/standalone (acesso direto sem nest)

4. **Atualizar `backend/99-changelog.md`:** linha datada `- 2026-05-24 — Adicionado 10-api-endpoints.md: catálogo dos 8 endpoints REST de api/endpoints/ (legacy/standalone router).`

5. **Atualizar `backend/00-index.md`:** adicionar linha na tabela de docs apontando para `10-api-endpoints.md`.

6. **Bumpar `_meta/00-index.md`:** apenas `updated_at: "2026-05-24"` no frontmatter.

### Post-implementation

- [ ] Verificar tamanho de cada `##`: `awk '/^## /{if(buf) print length(buf), section; section=$0; buf=""} {buf=buf"\n"$0} END{if(buf) print length(buf), section}' 10-api-endpoints.md` — todas < 3000
- [ ] Grep todos os identificadores citados existem: `grep -rn "compare_json\|GLOSSARY\|_run_analysis\|_SIM_PATTERNS" backend/app/`
- [ ] Confirmar que `cr.compare_json` response shape está documentado corretamente (não inventado)

### Verificação (ingestão + smoke)

```bash
# 1) Ingestar
bash .claude/local/scripts/ingest-project.sh face-before-after-backend

# 2) Smoke 1 — análise premium
TOKEN="${AI_INTERNAL_TOKEN:-test-token-123}"
curl -s -X POST http://localhost:3099/api/rag \
  -H "Content-Type: application/json" -H "x-internal-token: $TOKEN" \
  -d '{"query":"POST /api/analyze/premium full pipeline run_id","project":"face-before-after-backend","limit":3}' \
  | jq '.chunks[] | {file_path, heading, rerankScore}'

# 3) Smoke 2 — simulation types
curl -s -X POST http://localhost:3099/api/rag \
  -H "Content-Type: application/json" -H "x-internal-token: $TOKEN" \
  -d '{"query":"simulation symmetrized ideal_proportions comparison_grid","project":"face-before-after-backend","limit":3}' \
  | jq '.chunks[] | {file_path, heading, rerankScore}'

# 4) Smoke 3 — filtro doc_type
curl -s -X POST http://localhost:3099/api/rag \
  -H "Content-Type: application/json" -H "x-internal-token: $TOKEN" \
  -d '{"query":"capture guidelines face analysis","project":"face-before-after-backend","filters":{"doc_type":"api"},"limit":5}' \
  | jq '.chunks[] | {file_path, heading}'

# 5) Verificar tamanhos de chunk
curl -s -X POST http://localhost:3099/api/rag \
  -H "Content-Type: application/json" -H "x-internal-token: $TOKEN" \
  -d '{"query":"api endpoints backend","project":"face-before-after-backend","limit":10}' \
  | jq '[.chunks[] | select(.file_path | contains("10-api")) | .text | length]'
```

**Critério de aceite:**
- `10-api-endpoints.md` no top-3 das queries 1-2 com rerankScore > 0.5
- `heading` retornado bate com algum `## METHOD /path` do doc
- Query 3 (filtro `doc_type: api`) retorna o doc
- Query 5: todos os valores < 3000

---

## Commits (não executar — sugestão)

```bash
git add .claude/local/context/backend/10-api-endpoints.md
git add .claude/local/context/backend/00-index.md
git add .claude/local/context/backend/99-changelog.md
git add .claude/local/context/_meta/00-index.md
git commit -m "docs(backend): add REST API catalog for api/endpoints/ router (etapa 1)"
```
