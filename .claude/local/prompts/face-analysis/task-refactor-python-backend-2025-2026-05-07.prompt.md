---
tenant_id: "face-before-after"
project: "face-before-after"
module: "face-analysis/task-refactor-python-backend-2025-2026-05-07.prompt"
file_path: ".claude/prompts/face-analysis/task-refactor-python-backend-2025-2026-05-07.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Type: refactor > Module: face-analysis/backend > Date: 2026-05-07 > Stack: Python 3.12 · FastAPI · dlib · OpenCV · MinIO · Docker
tags:
  - "face-analysis"
  - "task-prompt"
  - "backend"
rag_keywords:
  - "analysis"
  - "backend"
  - "face"
  - "prompt"
  - "prompts"
  - "python"
  - "refactor"
related_modules: []
depends_on: []
used_by: []
---
# Refactor Python Backend — 2025 API Standards

> **Type:** refactor
> **Module:** face-analysis/backend
> **Date:** 2026-05-07
> **Stack:** Python 3.12 · FastAPI · dlib · OpenCV · MinIO · Docker

---

## Context

O backend atual tem 18 arquivos Python soltos no root do projeto, misturados com Dockerfiles, frontend e configs. A separação de responsabilidades é fraca: `api_server.py` acumula validação, orquestração, storage e rotas. O objetivo é reorganizar em estrutura de pacotes Python com separação clara de camadas, sem alterar nenhuma lógica de negócio existente.

**Arquivos afetados (todos os .py no root):**
- `api_server.py`, `mvp_pipeline.py`, `start_api.py`, `face.py`
- `face_asymmetry.py`, `face_metrics.py`, `impression_layer.py`
- `top_leverage.py`, `visual_status.py`, `evolution_path.py`
- `recommendations.py`, `simulate_before_after.py`, `compare_report.py`
- `build_mvp_html.py`, `build_html_report.py`, `glossary.py`, `minio_client.py`
- `tests/` (7 arquivos)

---

## Estrutura Alvo

```
backend/
├── pyproject.toml              # substituir requirements-api.txt
├── Dockerfile.api              # ajustar WORKDIR e paths
├── main.py                     # entry point uvicorn
├── app/
│   ├── api/
│   │   ├── deps.py             # Depends: get_pipeline, get_storage
│   │   ├── router.py           # APIRouter agregador
│   │   └── endpoints/
│   │       ├── analysis.py     # POST /api/analyze/free, /premium
│   │       ├── results.py      # GET /api/result/{run_id}/...
│   │       ├── compare.py      # POST /api/compare
│   │       └── meta.py         # GET /, /capture-guidelines, /glossary
│   ├── core/
│   │   ├── config.py           # pydantic-settings Settings
│   │   ├── logging.py          # JSON structured logger
│   │   └── exceptions.py       # FaceNotDetectedError, InvalidImageError, etc.
│   ├── domain/
│   │   ├── pipeline.py         # mvp_pipeline.py → class wrapper
│   │   ├── face_asymmetry.py
│   │   ├── face_metrics.py
│   │   ├── face.py
│   │   ├── simulate.py
│   │   └── layers/
│   │       ├── impression.py
│   │       ├── visual_status.py
│   │       ├── top_leverage.py
│   │       ├── evolution_path.py
│   │       ├── recommendations.py
│   │       └── glossary.py
│   ├── infra/
│   │   └── storage.py          # minio_client.py
│   ├── reports/
│   │   ├── compare.py
│   │   └── html_builder.py
│   └── schemas/
│       ├── analysis.py         # AnalyzeResponse, ScoreTier
│       ├── compare.py          # CompareRequest, CompareResponse
│       └── common.py           # RunId, GlossaryResponse
└── tests/                      # mover de /tests/
    ├── conftest.py
    └── test_*.py (7 arquivos)
```

---

## Business Rules

- **Zero alteração de lógica de negócio** — mover código, não reescrever algoritmos
- `FaceAsymmetryAnalyzer` permanece igual, apenas move de path
- JSON output structure permanece idêntica (compatibilidade com frontend React)
- `resultado_api/` continua sendo gerado no mesmo formato
- MinIO integration permanece opcional (falha graciosamente)

---

## Steps / Checks

### 1. Criar estrutura de diretórios
```bash
mkdir -p backend/app/{api/endpoints,core,domain/layers,infra,reports,schemas}
mkdir -p backend/tests
touch backend/app/__init__.py backend/app/api/__init__.py
touch backend/app/api/endpoints/__init__.py backend/app/core/__init__.py
touch backend/app/domain/__init__.py backend/app/domain/layers/__init__.py
touch backend/app/infra/__init__.py backend/app/reports/__init__.py
touch backend/app/schemas/__init__.py
```

### 2. `app/core/config.py`
```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    resultado_api_dir: str = "./resultado_api"
    minio_endpoint: str = ""
    minio_access_key: str = ""
    minio_secret_key: str = ""
    minio_bucket_name: str = "face-results"
    minio_use_ssl: bool = False
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
```

### 3. `app/core/exceptions.py`
```python
from fastapi import HTTPException

class FaceNotDetectedError(HTTPException):
    def __init__(self): super().__init__(400, "No face detected in the image")

class InvalidImageError(HTTPException):
    def __init__(self, reason: str): super().__init__(400, f"Invalid image: {reason}")

class RunNotFoundError(HTTPException):
    def __init__(self, run_id: str): super().__init__(404, f"Run '{run_id}' not found")
```

### 4. `app/core/logging.py`
```python
import logging, json, sys

class _JsonFormatter(logging.Formatter):
    def format(self, r):
        return json.dumps({"level": r.levelname, "msg": r.getMessage(), "logger": r.name})

def setup_logging() -> None:
    h = logging.StreamHandler(sys.stdout)
    h.setFormatter(_JsonFormatter())
    logging.root.setLevel(logging.INFO)
    logging.root.addHandler(h)
```

### 5. Mover arquivos de domínio (cp + ajustar imports)
- `face_asymmetry.py` → `backend/app/domain/face_asymmetry.py`
- `face_metrics.py` → `backend/app/domain/face_metrics.py`
- `face.py` → `backend/app/domain/face.py`
- `simulate_before_after.py` → `backend/app/domain/simulate.py`
- `mvp_pipeline.py` → `backend/app/domain/pipeline.py` (atualizar imports internos)
- `impression_layer.py` → `backend/app/domain/layers/impression.py`
- `visual_status.py` → `backend/app/domain/layers/visual_status.py`
- `top_leverage.py` → `backend/app/domain/layers/top_leverage.py`
- `evolution_path.py` → `backend/app/domain/layers/evolution_path.py`
- `recommendations.py` → `backend/app/domain/layers/recommendations.py`
- `glossary.py` → `backend/app/domain/layers/glossary.py`
- `minio_client.py` → `backend/app/infra/storage.py`
- `compare_report.py` → `backend/app/reports/compare.py`
- `build_mvp_html.py` → `backend/app/reports/html_builder.py`

### 6. `app/api/deps.py`
```python
from functools import lru_cache
from app.infra.storage import MinIOStorage

@lru_cache(maxsize=1)
def get_storage() -> MinIOStorage | None:
    try: return MinIOStorage()
    except Exception: return None
```

### 7. Dividir `api_server.py` em endpoints/
- `endpoints/analysis.py` — POST /api/analyze/free e /premium (com asyncio.to_thread)
- `endpoints/results.py` — GET /api/result/{run_id}/annotated e /simulation/{sim_type}
- `endpoints/compare.py` — POST /api/compare
- `endpoints/meta.py` — GET /, /api/capture-guidelines, /api/glossary

### 8. `app/api/router.py`
```python
from fastapi import APIRouter
from .endpoints import analysis, results, compare, meta

router = APIRouter()
router.include_router(analysis.router, prefix="/api/analyze", tags=["analysis"])
router.include_router(results.router, prefix="/api/result", tags=["results"])
router.include_router(compare.router, prefix="/api", tags=["compare"])
router.include_router(meta.router, tags=["meta"])
```

### 9. `backend/main.py`
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.router import router
from app.core.logging import setup_logging

setup_logging()

app = FastAPI(title="Face Analysis API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(router)
```

### 10. `backend/pyproject.toml`
Substituir `requirements-api.txt`. Adicionar `pydantic-settings>=2.0`.

### 11. Atualizar `Dockerfile.api` e `docker-compose.yml`
- Build context: `./backend`
- Entry point: `uvicorn main:app --host 0.0.0.0 --port 8000`

### 12. Mover e atualizar `tests/`
- `cp tests/* backend/tests/`
- Criar `backend/tests/conftest.py`
- Atualizar imports: `from face_asymmetry` → `from app.domain.face_asymmetry`

### 13. Deletar arquivos legacy do root
- `build_html_report.py` (substituído por `build_mvp_html.py`)
- `start_api.py` (incorporado em `main.py`)

---

## Verification

```bash
# 1. Testes unitários
cd backend && python -m pytest tests/ -v

# 2. Servidor sobe
uvicorn main:app --reload

# 3. Endpoint free
curl -s -F "photo=@/tmp/test.jpg" http://localhost:8000/api/analyze/free | python -m json.tool

# 4. OpenAPI renderiza com tags
curl -s http://localhost:8000/docs

# 5. Docker ainda funciona
just api-deploy
```

---

## Commits

```bash
git add backend/
git commit -m "refactor: reorganize Python backend into layered package structure (2025 API standards)"

git add Dockerfile.api docker-compose.yml
git commit -m "chore: update Docker config for new backend/ package layout"
```
