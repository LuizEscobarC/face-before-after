---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/api-vision"
file_path: ".claude/local/context/backend/11-api-vision.md"
doc_type: "api"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Catálogo dos 15 endpoints ativos montados em /vision/* pelo vision_router de
  backend/app/vision/router.py — únicos endpoints acessíveis no container.
  Cobre landmarks, metrics-v2 (93 métricas), full-pipeline, render, compose,
  compare e results. Inclui tabela de duplicações com o router legado /api/.
tags:
  - "backend"
  - "api"
  - "rest"
  - "vision"
rag_keywords:
  - "POST /vision/landmarks LandmarkPayload base64"
  - "POST /vision/metrics-v2 MetricsV2Response 93 metrics"
  - "POST /vision/full-pipeline FullPipelineResponse run_id"
  - "POST /vision/render StreamingResponse overlay PNG"
  - "POST /vision/compose-before-ideal before_ideal canvas"
  - "POST /vision/generate-pdf PDF report"
  - "GET /vision/results run_id annotated canonical simulation"
  - "consistency_score compare baseline_group_id"
  - "quality_grade ALTA MEDIA BAIXA REJEITADA"
  - "landmark_frames multi-capture PR-23"
related_modules:
  - "backend/api-endpoints"
  - "backend/pipeline"
depends_on:
  - "backend/architecture"
used_by: []
---

# Backend — REST API Vision (Endpoints Ativos)

> **Última atualização:** 2026-05-24
> **Status:** ✅ ATIVO — todos os endpoints abaixo estão montados e acessíveis no container.

`backend/main.py` monta exclusivamente `vision_router` com `prefix="/vision"`:

```python
from app.vision.router import router as vision_router
app.include_router(vision_router)
```

`backend/app/vision/router.py` agrega 10 sub-routers — 15 endpoints no total.

---

## GET /vision/capture-guidelines

**Arquivo:** `backend/app/vision/routers/meta.py:28`

**Response:** `200 dict` — guia de captura estilo 3x4 (`title`, `distance_meters`, `zoom`, `tips[]`).

---

## GET /vision/health

**Arquivo:** `backend/app/vision/routers/meta.py:33`

**Response:** `200 {"status": "ok", "service": "face-vision-service"}`

---

## POST /vision/landmarks

**Arquivo:** `backend/app/vision/routers/landmarks.py:30`

**Request:** JSON — `LandmarkRequest` (`backend/app/vision/schemas/landmark_payload.py`):
- `image_base64: str` — imagem JPEG/PNG em base64
- `session_id: str | None`

**Response:** `200 LandmarkPayload`:
- `session_id: str`
- `landmarks: list[list[float]]` — 468 pontos MediaPipe FaceMesh `[x, y, z]`
- `pose: dict` — `yaw_deg`, `pitch_deg`, `roll_deg`
- `quality_score: float` — 0.0–1.0
- `quality_grade: Literal["ALTA","MEDIA","BAIXA","REJEITADA"]`
- `flags: list[str]` — ex.: `"excessive_yaw"`, `"low_sharpness"`
- `regional_penalties: dict[str, float]`
- `fingerprint: str` — hash de identidade da face
- `fingerprint_parts: dict`
- `processing_mode: str`
- `subscore_breakdown: dict | None`
- `face_bbox: list[float] | None`

**Errors:** `400` se nenhuma face detectada; `422` se base64 inválido.

```bash
curl -X POST http://localhost:8000/vision/landmarks \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "<base64>", "session_id": "sess-001"}'
```

---

## POST /vision/metrics

**Arquivo:** `backend/app/vision/routers/metrics.py:16`

> ⚠️ **LEGADO** — pipeline antigo de métricas. Preferir `POST /vision/metrics-v2`.

**Request:** JSON — `landmarks` + `quality_context`.

**Response:** `200 MetricsResponse` — subset de métricas (contagem inferior a `metrics-v2`).

---

## POST /vision/metrics-v2

**Arquivo:** `backend/app/vision/routers/metrics_v2.py:55`

> **Canônico** — 93 métricas registradas via `@register` em 14 famílias. Suporte a multi-capture (PR-23).

**Request:** JSON — `MetricsV2Request` (`backend/app/vision/schemas/metrics_v2.py`):
- `landmarks: list[list[float]]` — 468 pontos (output de `/vision/landmarks`)
- `landmark_frames: list[list[list[float]]] | None` — N frames para multi-capture (PR-23)
- `quality_context: dict` — `quality_score`, `quality_grade`, `flags`, `regional_penalties`
- `yaw_deg: float`
- `pitch_deg: float`
- `image_size: tuple[int,int] | None`

**Response:** `200 MetricsV2Response`:
- `session_id: str | None`
- `metrics: list[dict]` — cada item = `MetricValue.to_dict()` com `key`, `value`, `confidence`, `severity`, `narrative`
- `metric_count: int` — 93 em modo full
- `capture_count: int`
- `landmark_stability: dict | None` — variância entre frames (multi-capture)

```bash
curl -X POST http://localhost:8000/vision/metrics-v2 \
  -H "Content-Type: application/json" \
  -d '{"landmarks": [...], "quality_context": {"quality_score": 0.9, "quality_grade": "ALTA", "flags": [], "regional_penalties": {}}, "yaw_deg": 1.2, "pitch_deg": 0.5}'
```

---

## POST /vision/full-pipeline

**Arquivo:** `backend/app/vision/routers/full_pipeline.py:130`

**Request:** JSON — `FullPipelineRequest` (`backend/app/vision/schemas/pipeline.py`):
- `image_base64: str`
- `mode: str = "premium"`
- `session_id: str | None`
- `filename: str | None`

**Response:** `200 FullPipelineResponse`:
- `run_id: str` — `uuid4().hex[:12]`
- `output_dir: str` — `settings.resultado_api_dir/{run_id}/`
- `photo_url: str | None` — `"minio://uploads/{run_id}/{filename}"` ou `null`
- `result: dict` — saída completa do pipeline (landmarks + métricas + scores + narrative)

**Side-effects:** cria `resultado_api_dir/{run_id}/`, persiste `*_mvp_report.json`, `*_mvp_report.txt`, `*_mvp_annotated.jpg`; upload MinIO opcional (falha silenciosa).

```bash
curl -X POST http://localhost:8000/vision/full-pipeline \
  -H "Content-Type: application/json" \
  -d '{"image_base64": "<base64>", "mode": "premium"}'
```

---

## POST /vision/full-pipeline/upload

**Arquivo:** `backend/app/vision/routers/full_pipeline.py:142`

Idêntico a `POST /vision/full-pipeline`, mas aceita `multipart/form-data`:
- `photo: UploadFile` — `.png`, `.jpg`, `.jpeg`; limite `15 MB`

**Errors:** `400 InvalidImageError`, `413 FileTooLargeError`, `500`.

```bash
curl -X POST http://localhost:8000/vision/full-pipeline/upload \
  -F "photo=@face.jpg"
```

---

## POST /vision/compare

**Arquivo:** `backend/app/vision/routers/compare.py:44`

**Request:** JSON — `CompareRequest`:
```json
{ "run_id_before": "abc123def456", "run_id_after": "fed654cba321" }
```

**Response:** `200 dict` — mesmo shape de `POST /api/compare` (13 métricas, `score_delta`, tiers) mais campos adicionais:
- `consistency_score: float | None`
- `consistency_issues: list[str] | None`
- `is_comparable: bool`
- `baseline_group_id_before: str | None`
- `baseline_group_id_after: str | None`

**Errors:** `400` run_id inválido; `404 RunNotFoundError`.

---

## GET /vision/results/{run_id}/original

**Arquivo:** `backend/app/vision/routers/results.py:33`

**Request:** path param `run_id: str`

**Response:** `FileResponse` (JPEG) — imagem de input original gravada durante o pipeline.

**Errors:** `404 RunNotFoundError`, `404 SimulationNotFoundError("original")`.

---

## GET /vision/results/{run_id}/canonical

**Arquivo:** `backend/app/vision/routers/results.py:51`

**Response:** `FileResponse` (JPEG) — crop alinhado pelo plano de Frankfort (canonical face).

**Errors:** `404 RunNotFoundError`, `404 SimulationNotFoundError("canonical")`.

---

## GET /vision/results/{run_id}/annotated

**Arquivo:** `backend/app/vision/routers/results.py:69`

**Response:** `FileResponse` (JPEG) — imagem com landmarks e anotações desenhadas.

**Errors:** `404 RunNotFoundError`, `404 SimulationNotFoundError("annotated")`.

---

## GET /vision/results/{run_id}/simulation/{sim_type}

**Arquivo:** `backend/app/vision/routers/results.py:78`

**`sim_type` válidos:**
- `canonical` → `*_canonical.jpg`
- `symmetrized` → `*_symmetrized.jpg`
- `ideal_proportions` → `*_ideal_proportions.jpg`
- `comparison_grid` → `*_comparison_grid.jpg`

**Response:** `FileResponse` (JPEG)

**Errors:** `404 RunNotFoundError`, `404 SimulationNotFoundError(sim_type)`, `400 InvalidSimulationTypeError`.

> **Diferença vs legado:** `sim_type=canonical` existe aqui mas NÃO existe em `GET /api/result/{run_id}/simulation/{sim_type}`.

---

## POST /vision/render

**Arquivo:** `backend/app/vision/routers/render.py:210`

**Request:** `multipart/form-data`:
- `image: UploadFile` — imagem JPEG/PNG
- `landmarks_json: str` — JSON array de `[x, y]` pixel pairs (len=478)
- `overlay_ids_json: str` — JSON array de IDs (ver `SUPPORTED_OVERLAYS` em `render.py:69`):
  - Linhas: `"axis_vertical"`, `"axis_intercanthal"`, `"grid_thirds"`, `"grid_fifths"`, `"outline_face"`
  - Heatmaps: `"heatmap_asymmetry"`, `"heatmap_ideal_adherence"`

**Response:** `StreamingResponse` PNG — imagem com overlays renderizados.

**Errors:** `422` landmarks_json inválido ou overlay_id desconhecido.

```bash
curl -X POST http://localhost:8000/vision/render \
  -F "image=@face.jpg" \
  -F 'landmarks_json=[[100,200],...]' \
  -F 'overlay_ids_json=["axis_vertical","grid_thirds"]' \
  --output overlay.png
```

---

## POST /vision/compose-before-ideal

**Arquivo:** `backend/app/vision/routers/compose.py:92`

**Request:** JSON — parâmetros de composição before/ideal:
- `run_id: str` — análise já processada
- `layout: str | None` — ex.: `"side_by_side"`, `"overlay"`
- `canvas_options: dict | None`

**Response:** `StreamingResponse` PNG — canvas comparativo before vs ideal face.

---

## POST /vision/generate-pdf

**Arquivo:** `backend/app/vision/routers/pdf.py:85`

**Request:** JSON — `run_id` + opções de relatório.

**Response:** `Response` (PDF) com `Content-Type: application/pdf` — relatório completo da análise.

```bash
curl -X POST http://localhost:8000/vision/generate-pdf \
  -H "Content-Type: application/json" \
  -d '{"run_id": "abc123def456"}' \
  --output report.pdf
```

---

## Duplicações com `/api/` (router legado desmontado)

| Endpoint ativo (`vision/`) | Equivalente legado (`api/`) | Canônico |
|---|---|---|
| `GET /vision/capture-guidelines` | `GET /api/capture-guidelines` | **vision/** |
| `GET /vision/health` | `GET /` (root meta) | **vision/** |
| `POST /vision/full-pipeline/upload` | `POST /api/analyze/free` + `POST /api/analyze/premium` | **vision/** |
| `GET /vision/results/{run_id}/annotated` | `GET /api/result/{run_id}/annotated` | **vision/** |
| `GET /vision/results/{run_id}/simulation/{sim_type}` | `GET /api/result/{run_id}/simulation/{sim_type}` | **vision/** (adiciona `canonical`) |
| `POST /vision/compare` | `POST /api/compare` | **vision/** (adiciona `consistency_score`) |
| — | `GET /api/glossary` | **legado único** (sem par em vision/) |

**Endpoints exclusivos de `vision/` (sem par em legado):**
`POST /vision/landmarks`, `POST /vision/metrics-v2`, `POST /vision/full-pipeline` (JSON), `POST /vision/render`, `POST /vision/compose-before-ideal`, `POST /vision/generate-pdf`, `GET /vision/results/{id}/original`, `GET /vision/results/{id}/canonical`
