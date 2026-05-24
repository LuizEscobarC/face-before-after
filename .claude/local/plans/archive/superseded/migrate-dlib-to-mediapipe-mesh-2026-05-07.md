---
tenant_id: "face-before-after"
project: "face-before-after"
module: "superseded/migrate-dlib-to-mediapipe-mesh-2026-05-07"
file_path: ".claude/plans/archive/superseded/migrate-dlib-to-mediapipe-mesh-2026-05-07.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Date: 2026-05-07 Source: .claude/plans/agora-vamos-planejar-em-ethereal-thimble.md Prompt 1 Stack: Python 3.10 / FastAPI no Laravel — generic planner template adapted
tags:
  - "planning"
rag_keywords:
  - "archive"
  - "dlib"
  - "mediapipe"
  - "mesh"
  - "migrate"
  - "plans"
  - "superseded"
related_modules: []
depends_on: []
used_by: []
---
# Plan — Migrate Server-side Landmarks: dlib → MediaPipe Face Mesh (subset 68)

**Date:** 2026-05-07
**Source:** `.claude/plans/agora-vamos-planejar-em-ethereal-thimble.md` (Prompt 1)
**Stack:** Python 3.10 / FastAPI (no Laravel — generic planner template adapted)

---

## Goal

Replace dlib (68 landmarks) with MediaPipe Face Mesh (468 landmarks) as the single server-side landmark source, exposing a 68-point projection in the **same layout as dlib** so `quality_evaluator.py` and `face_metrics.py` remain untouched. Also expose the full 468-point array under a separate field for future use (Prompt 2).

## Pre-flight checks (validated)

| Check | Status |
|---|---|
| Server arch x86_64 (MediaPipe wheel available) | ✅ x86_64 |
| Native libs in `Dockerfile.api` | ✅ `libglib2.0-0`, `libsm6`, `libxext6` already present |
| `libgl1` covered by `opencv-python-headless` | ✅ implicit |
| Current `pyproject.toml` has unpinned numpy/opencv | ⚠️ to fix in this plan |

---

## Decomposition

### 1. Pin transitive bloquers in `backend/pyproject.toml`

- `numpy>=1.24.0` → `numpy>=1.24,<2.0` (MediaPipe 0.10.x breaks with numpy 2.x)
- `opencv-python-headless>=4.8.0` → `opencv-python-headless>=4.8.0,<4.11` (MediaPipe compiled against 4.8.x ABI)
- Add `mediapipe>=0.10.18`
- Keep `dlib>=19.24.0` for now (fallback flag)

### 2. Create `MEDIAPIPE_TO_DLIB_68` mapping module

New file: `backend/app/vision/services/landmark_mapping.py`

Tabela determinística com os 68 índices Mesh-468 que correspondem ao layout dlib-68:
- jaw 0–16 (17 pts)
- right brow 17–21, left brow 22–26 (5+5)
- nose bridge 27–30, nose tip 31–35 (4+5)
- right eye 36–41, left eye 42–47 (6+6)
- outer mouth 48–59, inner mouth 60–67 (12+8)

Mapping conhecido — referência na docs do MediaPipe (`face_landmarker.task` keypoint indices). Usar tabela já validada da comunidade (e.g. tabela do mapeamento iBUG-300W ↔ Mesh-468).

### 3. Reescrever `backend/app/vision/services/face_detection.py`

Novo contrato:

```python
def detect_face_and_landmarks(image_bgr: np.ndarray) -> FaceDetectionResult:
    """Returns: face_count, landmarks_dlib68 (68,2), landmarks_mesh468 (468,2)|None, bbox."""
```

Comportamento:
- Default: roda MediaPipe Face Mesh (`static_image_mode=True`, `refine_landmarks=True`, `max_num_faces=2`).
- Converte landmarks normalizados (0..1) para pixel coords.
- Aplica `MEDIAPIPE_TO_DLIB_68` para produzir `landmarks_dlib68`.
- Expõe também `landmarks_mesh468` (raw).
- Se `os.getenv("USE_DLIB_FALLBACK") == "true"`: roda dlib em paralelo e usa o resultado dlib (sprint A/B).

### 4. Adaptar callers (mínimo)

Buscar `from app.vision.services.face_detection import` no codebase. Cada caller que hoje recebe `landmarks: np.ndarray` continua recebendo o mesmo array `(68, 2)` — sem mudança. Apenas o resultado type/dataclass pode precisar de ajuste se for um dataclass.

### 5. Dockerfile

- `Dockerfile.api` e `Dockerfile.local.api`: nada a adicionar (libs já presentes).
- Verificar build após `pip install mediapipe` — se falhar por `libgl1`, adicionar.

### 6. Smoke test

Script `backend/tests/test_mediapipe_parity.py`:
- Carrega 5–10 fotos de teste em `backend/tests/fixtures/` (se existirem; senão pular).
- Roda o pipeline com `USE_DLIB_FALLBACK=true` (dlib) e `false` (MediaPipe).
- Compara `quality_score` e `quality_grade` retornados por `evaluate()`.
- Aceita: ±0.05 de delta no score e mesmo grade em ≥95% das fotos.

Não exigir 100% — landmarks são geometricamente próximos mas não idênticos.

---

## Files affected

| File | Action |
|---|---|
| `backend/pyproject.toml` | Edit: pin numpy/opencv, add mediapipe |
| `backend/app/vision/services/landmark_mapping.py` | Create: tabela de mapeamento |
| `backend/app/vision/services/face_detection.py` | Rewrite: MediaPipe + flag dlib |
| `backend/tests/test_mediapipe_parity.py` | Create: smoke test |
| `backend/Dockerfile.api` | (Possibly) edit if build falha |

**Not touched:** `quality_evaluator.py`, `face_metrics.py`, `metric_calculator.py`, `pose_estimator.py`, todos os routers.

---

## Execution order

1. Pin deps em `pyproject.toml` + adicionar mediapipe.
2. Build da imagem para validar instalação.
3. Criar `landmark_mapping.py` com tabela.
4. Reescrever `face_detection.py` (com flag de fallback).
5. Rodar smoke test (`pytest backend/tests/test_mediapipe_parity.py`).
6. Curl manual em `/v1/photo-quality/...` (NestJS gateway) ou direto em `/vision/full-pipeline` (FastAPI) com 1 foto real.
7. Comparar `quality_score`/`quality_grade` antes/depois para a mesma foto.

---

## Verification (end-to-end)

```bash
# Build
docker compose build api

# Boot
docker compose up -d api

# Test default (MediaPipe)
curl -F "file=@./fixtures/sample-frontal.jpg" http://localhost:9015/vision/full-pipeline | jq '.quality_score, .quality_grade'

# Test fallback (dlib)
docker compose exec -e USE_DLIB_FALLBACK=true api python -c "from app.vision.services.face_detection import detect_face_and_landmarks; ..."

# Smoke parity
docker compose exec api pytest tests/test_mediapipe_parity.py -v
```

Aceite: scores dentro de ±0.05; grade idêntica em ≥95%.

---

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Wheel MediaPipe falha no build | Fallback: instalar via `pip install --no-cache mediapipe` em camada separada; arch já validada x86_64. |
| Mapping table errado em alguns índices (e.g. cantos da boca) | Validar visualmente desenhando os 68 pts em uma foto e comparando com dlib. |
| `quality_evaluator` falha por landmarks ligeiramente diferentes | Aceite ±0.05 cobre isso; se >5% das fotos divergirem, revisar tabela. |
| MediaPipe lento em CPU pequena | Cache de instância (`FaceMesh(static_image_mode=True)` é stateless mas cara de inicializar) — singleton no service. |

---

## Recommended Execution Model

- **Model:** sonnet
- **Reason:** tarefa de refactor cirúrgico com escopo bem definido, baixa ambiguidade, ~3 arquivos novos/editados, nenhuma decisão arquitetural pendente. Não justifica Opus. Haiku seria arriscado por causa da tabela de mapeamento (68 índices) — Sonnet equilibra precisão e custo.

---

## Tools / Skills used in execution

- File ops: `Read`, `Write`, `Edit`, `Bash`
- No Laravel-specific skills apply (no `clear-cache`, `pint`, `integration-prober`, `domain-context-updater`, `generate-postman` — projeto Python).
- Testes: `pytest` direto via Bash.
- Verificação manual: `curl` no endpoint `/vision/full-pipeline`.
