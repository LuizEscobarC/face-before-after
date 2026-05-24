---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/architecture"
file_path: ".claude/local/context/backend/01-architecture.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Arquitetura do backend Python: FastAPI app em backend/app expõe rotas /api/v1 que
  delegam a um pipeline domain.pipeline.run_pipeline. O pipeline carrega imagem, extrai
  landmarks (dlib 68 + MediaPipe FaceMesh quando habilitado), aplica canonical_frame,
  calcula métricas via services/metrics, segmenta hairline via BiSeNet ONNX em
  services/segmentation, e devolve um DTO consumido pelo nest e pelo frontend.
tags:
  - "backend"
  - "architecture"
  - "fastapi"
  - "face-pipeline"
rag_keywords:
  - "canonical frame normalization"
  - "MediaPipe FaceMesh 468 landmarks"
  - "dlib 68 landmark predictor"
  - "BiSeNet ONNX hair mask"
  - "FastAPI router dependency injection"
  - "pydantic-settings config"
  - "MinIO bucket photos"
  - "uvicorn ASGI server"
related_modules:
  - "backend"
  - "face-analysis"
depends_on: []
used_by:
  - "nest"
---

# Backend — Arquitetura

## Visão geral

`face-analysis-api` é uma aplicação FastAPI que executa o pipeline de análise facial
end-to-end: recebe imagem (multipart) ou referência a objeto em MinIO, extrai landmarks,
calcula métricas geométricas/proporcionais, produz overlays SVG e devolve um relatório
estruturado. O Nest gateway orquestra chamadas e adiciona policy/quality/diagnosis.

Server entrypoint: [backend/main.py](../../../../backend/main.py). Configuração via
[backend/app/core/config.py](../../../../backend/app/core/config.py) com `pydantic-settings`.

## Camadas

```
HTTP request
  │
  ▼
[api/router.py] ──► registra routers de api/endpoints/*
  │
  ▼
[services/*] ──► orquestra landmarks → normalization → metrics → overlays → segmentation
  │
  ▼
[domain/pipeline.py] ──► run_pipeline(image, params) — função core
  │
  ▼
[domain/{face_metrics,face_asymmetry,landmarks_mesh,canonical_frame,simulate}.py]
  │
  ▼
[infra/storage.py] ──► MinIO put/get
  │
  ▼
HTTP response (Pydantic schema)
```

## Componentes detalhados

| Componente | Arquivo | Contrato |
|---|---|---|
| Router agregador | [backend/app/api/router.py](../../../../backend/app/api/router.py) | Inclui sub-routers por feature |
| Dependências | [backend/app/api/deps.py](../../../../backend/app/api/deps.py) | Injeta Settings, storage client |
| Pipeline | [backend/app/domain/pipeline.py](../../../../backend/app/domain/pipeline.py) | `run_pipeline(...) -> dict` — entry point puro do domínio |
| Canonical frame | [backend/app/domain/canonical_frame.py](../../../../backend/app/domain/canonical_frame.py) | Normaliza yaw/roll/pitch para frame canônico antes de medir |
| Métricas | [backend/app/domain/face_metrics.py](../../../../backend/app/domain/face_metrics.py) | Cálculo de proporções, simetria, tércios, quintos |
| Asymmetry | [backend/app/domain/face_asymmetry.py](../../../../backend/app/domain/face_asymmetry.py) | Mirror + diff entre hemifaces |
| Landmarks mesh | [backend/app/domain/landmarks_mesh.py](../../../../backend/app/domain/landmarks_mesh.py) | Wrapper sobre MediaPipe FaceMesh (468 pontos) |
| Simulate | [backend/app/domain/simulate.py](../../../../backend/app/domain/simulate.py) | Geração de "depois" sintético (no-IA) por deformação |
| Landmarks service | [backend/app/services/landmarks](../../../../backend/app/services/landmarks) | Bridge entre vision e domain |
| Normalization | [backend/app/services/normalization](../../../../backend/app/services/normalization) | Pré-processamento (resize, align) antes do landmark |
| Overlays | [backend/app/services/overlays](../../../../backend/app/services/overlays) | Geração de overlays SVG (linhas guia, ideais, zonas) |
| Segmentation | [backend/app/services/segmentation](../../../../backend/app/services/segmentation) | BiSeNet ONNX para hairline/skin mask |
| Stability | [backend/app/services/landmark_stability.py](../../../../backend/app/services/landmark_stability.py) | Confidence/jitter de landmarks |
| Storage | [backend/app/infra/storage.py](../../../../backend/app/infra/storage.py) | Cliente MinIO (`minio>=7.2.0`) |
| Reports | [backend/app/reports](../../../../backend/app/reports) | `compare.py` + `html_builder.py` — HTML/PDF |

## Vision sub-app

[backend/app/vision/router.py](../../../../backend/app/vision/router.py) expõe rotas isoladas
de vision (resíduo da refactor A1: vision como microserviço lógico interno). Mantém routers/
schemas/services próprios. Frontend faz chamadas client-side de MediaPipe e envia landmark
payload; o backend ainda suporta server-side para fallback.

## Fluxo principal — /analyze (típico)

1. Cliente envia imagem via multipart ou `image_key` (MinIO).
2. Router resolve `Settings` + `storage` via `Depends`.
3. Service carrega bytes → `services/normalization` resize/align.
4. Landmarks extraídos por `services/landmarks` (dlib 68 + FaceMesh 468).
5. `canonical_frame.transform(landmarks)` projeta para frame canônico.
6. `face_metrics.compute(landmarks)` calcula proporções, tércios, quintos, phi/golden.
7. `services/segmentation` roda BiSeNet ONNX → hairline polygon.
8. `services/overlays` produz SVGs (zonas ideais, vetores de melhoria).
9. Response JSON com `metrics`, `landmarks`, `overlays`, `confidence`.

## Decisões arquiteturais

- **Domain puro em `domain/`** — sem dependências de FastAPI/storage; testável em isolamento.
  Ver `backend/tests/unit/*` (todas as métricas têm test unit).
- **Services como bridge** — orquestra IO + domain; recebe deps por argumento (sem global state).
- **`metric_value.py`** — value object para `(value, confidence, evidence)` propagar incerteza.
- **`normalized_landmarks.py`** — value object para landmarks já canônicos (não-canônicos não
  entram em métricas).
- **BiSeNet em ONNX runtime** — escolhido sobre PyTorch para reduzir footprint do container.
- **MinIO** — armazenamento de fotos antes/depois separadas por prefix de tenant.

## Configuração

Settings em [backend/app/core/config.py](../../../../backend/app/core/config.py) carrega de
`.env` via pydantic-settings. Vars principais:

| Var | Default | Uso |
|---|---|---|
| `MINIO_ENDPOINT` | — | Host MinIO |
| `MINIO_ACCESS_KEY` | — | Auth |
| `MINIO_SECRET_KEY` | — | Auth |
| `MINIO_BUCKET` | — | Bucket de fotos |
| `MEDIAPIPE_ENABLED` | `true` | Liga FaceMesh 468 |
| `BISENET_MODEL_PATH` | `models/bisenet.onnx` | ONNX hair seg |
| `LOG_LEVEL` | `INFO` | logging |

## Testes

[backend/tests/](../../../../backend/tests) cobre métricas, simetria, pipeline integration,
landmarks stability, pdf builder. Convenção: `tests/unit/test_<metric>.py` para domain puro,
`tests/test_<pipeline_part>.py` para integration.

## Não-objetivos

- Não fornece autenticação — Nest gateway é responsável.
- Não persiste relatórios — apenas MinIO para fotos; relatórios são re-gerados.
- Não roda IA generativa — pipeline é determinístico (CV clássico + redes pré-treinadas).
