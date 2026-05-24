---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/api-endpoints"
file_path: ".claude/local/context/backend/10-api-endpoints.md"
doc_type: "api"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Catálogo dos 8 endpoints do router legado em backend/app/api/endpoints/
  (analysis, compare, meta, results). ATENÇÃO: este router NÃO está montado em
  backend/main.py — o serviço em execução serve exclusivamente vision/routers/.
  Endpoints documentados aqui são código morto/desmontado, mantidos como
  referência de design original e para eventual reativação.
tags:
  - "backend"
  - "api"
  - "rest"
  - "legacy"
rag_keywords:
  - "POST /api/analyze/free teaser mode pipeline"
  - "POST /api/analyze/premium full analysis run_id"
  - "run_id uuid4 hex12 filesystem resultado_api_dir"
  - "CompareRequest run_id_before run_id_after compare_json"
  - "simulation types symmetrized ideal_proportions comparison_grid"
  - "MinIO upload face analysis optional"
  - "capture-guidelines glossary meta endpoints"
  - "unmounted legacy router api endpoints"
related_modules:
  - "backend/01-architecture"
depends_on:
  - "backend/12-pipeline"
used_by: []
---

# Backend — REST API Endpoints (Router Legado, Desmontado)

> **Última atualização:** 2026-05-24
> **Status:** ⚠️ LEGADO — este router NÃO está montado em `backend/main.py`.
> O serviço ativo expõe apenas `/vision/*` (ver [11-api-vision.md](11-api-vision.md) quando criado).

## Arquitetura do mounting

`backend/main.py` inclui somente `vision_router`:

```python
from app.vision.router import router as vision_router
app.include_router(vision_router)
```

O arquivo `backend/app/api/router.py` existe e monta os 4 sub-routers abaixo,
mas **nenhum entry point** o importa. Rotas a seguir são inacessíveis no container.

| Sub-router | Prefix | Endpoints |
|---|---|---|
| `meta.router` | (nenhum) | 3 |
| `analysis.router` | `/api/analyze` | 2 |
| `results.router` | `/api/result` | 2 |
| `compare.router` | `/api` | 1 |

---

## GET /

**Arquivo:** `backend/app/api/endpoints/meta.py:24`

**Request:** sem body, sem parâmetros

**Response:** `200 dict`
```json
{
  "service": "face-before-after-api",
  "status": "ok",
  "endpoints": ["/api/analyze/free", "/api/analyze/premium", "/api/capture-guidelines"]
}
```

**Observação:** service name `"face-before-after-api"` (o serviço ativo se chama `"face-vision-service"` em `main.py`).

---

## GET /api/capture-guidelines

**Arquivo:** `backend/app/api/endpoints/meta.py:37`

**Request:** sem body

**Response:** `200 dict` — guidelines para captura de foto estilo 3x4:
```json
{
  "title": "Guia de Captura (estilo 3x4)",
  "distance_meters": "0.5m a 0.8m",
  "zoom": "2x quando possível",
  "tips": ["Use iluminação frontal...", "..."]
}
```

**Duplicação:** equivalente a `GET /vision/capture-guidelines` (montado e ativo).

---

## GET /api/glossary

**Arquivo:** `backend/app/api/endpoints/meta.py:42`

**Request:** sem body

**Response:** `200 dict` — estrutura `GLOSSARY` de `domain/layers/glossary.py`.
Cada chave é um termo (ex.: `"ipd"`, `"fwhr"`) com campos:
`termo`, `unidade`, `descricao`, `como_medido`, `faixas`, `problemas_comuns`, `referencias`.

**Sem equivalente** ativo em `vision/routers/` — este endpoint não tem par canônico.

---

## POST /api/analyze/free

**Arquivo:** `backend/app/api/endpoints/analysis.py:69`

**Request:** `multipart/form-data`
- `photo: UploadFile` — formatos aceitos: `.png`, `.jpg`, `.jpeg`; limite `15 MB`

**Response:** `200 dict` — retorno de `pipeline.run(image_path, output_dir, mode="teaser")` enriquecido com:
- `run_id: str` — `uuid4().hex[:12]` (12 hex chars)
- `output_dir: str` — path local `settings.resultado_api_dir/{run_id}/`
- `photo_url: str | None` — `"minio://uploads/{run_id}/{filename}"` ou `null` se upload falhou

**Side-effects:**
1. Gera `run_id = uuid4().hex[:12]`
2. Cria `resultado_api_dir/{run_id}/` e grava imagem de input
3. Persiste no disco: `{base}_mvp_report.json`, `{base}_mvp_report.txt`, `{base}_mvp_annotated.jpg`
4. Upload opcional MinIO `uploads/{run_id}/{filename}` — falha silenciosa (warning no log)

**Errors:**
- `400 InvalidImageError` — extensão inválida ou arquivo vazio
- `413 FileTooLargeError` — `> 15 MB`
- `400 SystemExit` — pipeline retornou falha
- `500` — exceção inesperada no pipeline

**curl:**
```bash
# ATENÇÃO: endpoint não acessível (router desmontado em main.py)
curl -X POST http://localhost:8000/api/analyze/free -F "photo=@face.jpg"
```

---

## POST /api/analyze/premium

**Arquivo:** `backend/app/api/endpoints/analysis.py:77`

Idêntico a `POST /api/analyze/free`, com diferença de:
- `mode="premium"` passado para `pipeline.run()` (análise completa vs teaser)

**Equivalente ativo:** `POST /vision/full-pipeline` em `vision/routers/full_pipeline.py`.

---

## GET /api/result/{run_id}/annotated

**Arquivo:** `backend/app/api/endpoints/results.py:27`

**Request:** path param `run_id: str`

**Response:** `FileResponse` (JPEG) — busca `{run_id}/*_mvp_annotated.jpg` ou fallback `*_annotated.jpg`

**Errors:**
- `404 RunNotFoundError` — diretório `resultado_api_dir/{run_id}/` não existe
- `404 SimulationNotFoundError("annotated")` — arquivo não encontrado no diretório

**Duplicação:** equivalente a `GET /vision/results/{run_id}/annotated` (ativo).

---

## GET /api/result/{run_id}/simulation/{sim_type}

**Arquivo:** `backend/app/api/endpoints/results.py:36`

**Request:** path params `run_id: str`, `sim_type: str`

**`sim_type` válidos** (definidos em `_SIM_PATTERNS`):
- `symmetrized` → `*_symmetrized.jpg`
- `ideal_proportions` → `*_ideal_proportions.jpg`
- `comparison_grid` → `*_comparison_grid.jpg`

**Response:** `FileResponse` (JPEG)

**Errors:**
- `404 RunNotFoundError` — run_id não existe
- `404 SimulationNotFoundError(sim_type)` — arquivo não encontrado
- `400 InvalidSimulationTypeError` — sim_type fora dos 3 válidos

**Duplicação:** equivalente a `GET /vision/results/{run_id}/simulation/{sim_type}` (ativo).

---

## POST /api/compare

**Arquivo:** `backend/app/api/endpoints/compare.py:36`

**Request:** JSON body — `CompareRequest(BaseModel)`:
```json
{ "run_id_before": "abc123def456", "run_id_after": "fed654cba321" }
```
- `run_id` válido: regex `^[a-f0-9]{12}$`

**Response:** `200 dict` — retorno de `reports.compare.compare_json()`:
```json
{
  "score_before": 72,
  "score_after": 81,
  "score_delta": 9,
  "tier_before": "Bronze",
  "tier_after": "Silver",
  "metrics": [
    {
      "key": "overall_asymmetry_score_pct_ipd",
      "label": "Assimetria geral",
      "before": 2.4,
      "after": 1.8,
      "delta": 0.6,
      "improved": true
    }
  ],
  "improved_count": 8,
  "worsened_count": 3,
  "top_improvements": [...],
  "top_regressions": [...]
}
```

**Métricas comparadas** (13 campos de `COMPARE_KEYS`): `overall_asymmetry_score_pct_ipd`, `eye_level_difference_pct_ipd`, `eye_horizontal_asymmetry_pct_ipd`, `nose_deviation_pct_ipd`, `mouth_deviation_pct_ipd`, `chin_deviation_pct_ipd`, `fwhr`, `canthal_tilt_mean_deg`, `lower_third_ratio`, `jawline_definition_score`, `marquardt_deviation_pct_ipd`, `under_eye_darkness_left`, `under_eye_darkness_right`.

**`HIGHER_IS_BETTER`:** `jawline_definition_score`, `canthal_tilt_mean_deg` (delta invertido).

**Errors:**
- `400` — `run_id` inválido (não bate `^[a-f0-9]{12}$`)
- `404 RunNotFoundError` — JSON de report não encontrado em `resultado_api_dir/{run_id}/`

**Duplicação:** equivalente a `POST /vision/compare` (ativo).

---

## Resumo de duplicações com `vision/routers/` (canônico)

| Endpoint legado (`api/`) | Equivalente ativo (`vision/`) | Status |
|---|---|---|
| `GET /api/capture-guidelines` | `GET /vision/capture-guidelines` | Duplicado — vision canônico |
| `GET /api/glossary` | — | **Sem equivalente** — único endpoint sem par |
| `POST /api/analyze/free` | `POST /vision/full-pipeline` (mode inferido) | Duplicado — vision canônico |
| `POST /api/analyze/premium` | `POST /vision/full-pipeline` | Duplicado — vision canônico |
| `GET /api/result/{run_id}/annotated` | `GET /vision/results/{run_id}/annotated` | Duplicado — vision canônico |
| `GET /api/result/{run_id}/simulation/{sim_type}` | `GET /vision/results/{run_id}/simulation/{sim_type}` | Duplicado — vision canônico |
| `POST /api/compare` | `POST /vision/compare` | Duplicado — vision canônico |
| `GET /` (root) | `GET /` (vision main.py root) | Duplicado — vision canônico |

**Único valor residual deste router:** `GET /api/glossary` — sem equivalente em vision/.
Se ativar este router, considerar mover glossário para `GET /vision/glossary`.
