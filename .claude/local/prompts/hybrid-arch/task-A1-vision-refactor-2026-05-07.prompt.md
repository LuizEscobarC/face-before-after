---
tenant_id: "face-before-after"
project: "face-before-after"
module: "hybrid-arch/task-A1-vision-refactor-2026-05-07.prompt"
file_path: ".claude/prompts/hybrid-arch/task-A1-vision-refactor-2026-05-07.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  ---
tags:
  - "task-prompt"
rag_keywords:
  - "arch"
  - "hybrid"
  - "prompt"
  - "prompts"
  - "refactor"
  - "vision"
related_modules: []
depends_on: []
used_by: []
---
# Task A1 — Refactor vision-service: separação em módulos
**Created**: 2026-05-07
**Status**: ✅ CONCLUÍDO
**Stack**: FastAPI / Python 3.12

---

## 0. O que foi feito

O código de análise facial estava estruturado como scripts avulsos (`face_metrics.py`, `face_asymmetry.py`, `face.py`, etc.) na raiz do projeto. Esta fase organizou tudo dentro de um módulo Python coeso: `backend/app/vision/`.

---

## 1. Estrutura criada

```
backend/
  main.py                        ← Monta apenas o vision_router, CORS, /
  app/
    vision/
      __init__.py
      router.py                  ← APIRouter(prefix="/vision") agrega sub-routers
      routers/
        __init__.py
        landmarks.py             ← POST /vision/landmarks
        metrics.py               ← POST /vision/metrics
        full_pipeline.py         ← POST /vision/full-pipeline + /upload
        compare.py               ← POST /vision/compare
        results.py               ← GET  /vision/results/{run_id}/{file_type}
        meta.py                  ← GET  /vision/capture-guidelines + /health
      schemas/
        __init__.py
        landmark_payload.py      ← LandmarkPayload, LandmarkRequest, PoseAngles, QualityFlags, etc.
        metric_result.py         ← MetricResult
        pipeline.py              ← FullPipelineRequest, FullPipelineResponse
      services/
        __init__.py
        face_detection.py        ← dlib HOG detector + 68-point extractor
        image_codec.py           ← decode_base64_image()
        pose_estimator.py        ← solvePnP → {yaw, pitch, roll}
        quality_evaluator.py     ← Module 0 (A2)
        fingerprint.py           ← session fingerprint (A2)
        metric_calculator.py     ← wraps face_metrics.compute_all → MetricResult[]
```

---

## 2. Contratos definidos

### `GET /vision/capture-guidelines`
Retorna orientações de captura (distância, iluminação, pose) como JSON.

### `GET /vision/health`
`{"status": "ok"}`

### `POST /vision/landmarks`
- Input: `{image_base64: str, session_id?: str}`
- Output: `LandmarkPayload` (68 pontos + pose + quality_score + grade + flags + fingerprint)
- Rejeita se zero ou múltiplas faces

### `POST /vision/metrics`
- Input: `{landmarks, quality_context: {quality_score, regional_penalties}, image_base64?}`
- Output: `{metrics: MetricResult[], raw: {...}}`

### `POST /vision/full-pipeline`
- Input JSON: `{image_base64, mode?, session_id?, filename?}` ou multipart upload
- Output: `{run_id, output_dir, photo_url?, result}`
- Modos válidos: `"premium"` | `"teaser"`

### `POST /vision/compare`
- Input: `{run_id_before, run_id_after}`
- Output: delta de métricas

### `GET /vision/results/{run_id}/{file_type}`
- `file_type` válidos: `annotated`, `symmetrized`, `ideal_proportions`, `comparison_grid`
- Retorna JPEG binário

---

## 3. `backend/main.py`

```python
from app.vision.router import router as vision_router

app = FastAPI(title="Face Vision Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], ...)
app.include_router(vision_router)
```

Rotas legadas (`/api/*`) em `backend/app/api/` ficaram no disco como dead code — não são montadas.

---

## 4. Schemas principais

### `LandmarkPayload`
```python
class LandmarkPayload(BaseModel):
    session_id: str
    landmarks: list[list[float]]   # Nx2
    pose: PoseAngles               # {yaw, pitch, roll}
    quality_score: float
    quality_grade: Literal["ALTA","MEDIA","BAIXA","REJEITADA"]
    flags: QualityFlags
    regional_penalties: RegionalPenalties
    recommendations: list[str]
    fingerprint: str
    processing_mode: Literal["CLIENT_SIDE","SERVER_FALLBACK"]
    sharpness_score: float
    lighting_asymmetry: float
    subscore_breakdown: SubscoreBreakdown | None
```

---

## 5. Verificação

```bash
# Serviço up
docker compose up -d vision-service

# Health
curl http://localhost:9015/vision/health

# Guidelines
curl http://localhost:9015/vision/capture-guidelines | jq .

# Landmarks
curl -s -X POST http://localhost:9015/vision/landmarks \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\"}" \
  | jq '{session_id, quality_grade, quality_score}'
```
