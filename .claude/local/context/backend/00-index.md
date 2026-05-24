---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/index"
file_path: ".claude/local/context/backend/00-index.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Backend Python (FastAPI 0.112+, Python 3.12) implementa face-analysis-api — pipeline de
  análise facial com MediaPipe + dlib 68 landmarks + BiSeNet hair segmentation. Camadas DDD
  internas em backend/app/{api,domain,services,vision,reports,infra,core}. Roda em container
  backend-api via uvicorn, expõe endpoints REST sob /api/v1.
tags:
  - "backend"
  - "python"
  - "fastapi"
  - "face-analysis"
rag_keywords:
  - "FastAPI 0.112"
  - "MediaPipe FaceMesh"
  - "dlib 68 landmarks"
  - "BiSeNet segmentation"
  - "uvicorn ASGI"
  - "Python 3.12 face pipeline"
  - "MinIO storage"
  - "ONNX runtime"
related_modules: []
depends_on: []
used_by:
  - "nest"
---

# Backend — Índice

> **Última atualização:** 2026-05-24

Backend Python que serve a face-analysis-api. Camadas seguem padrão DDD-lite:
api (transport) → services (orchestration) → domain (rules) → infra (storage/IO).

## Componentes

| Camada | Path | Responsabilidade |
|---|---|---|
| API REST | [backend/app/api](../../../../backend/app/api) | Routers FastAPI, deps, schemas de request |
| Vision | [backend/app/vision](../../../../backend/app/vision) | Sub-API isolada para vision tasks (legacy A1) |
| Domain | [backend/app/domain](../../../../backend/app/domain) | Pipeline, métricas, asymmetry, canonical frame |
| Services | [backend/app/services](../../../../backend/app/services) | Landmarks, metrics, normalization, overlays, segmentation |
| Reports | [backend/app/reports](../../../../backend/app/reports) | HTML/PDF builders |
| Infra | [backend/app/infra](../../../../backend/app/infra) | Storage (MinIO) |
| Core | [backend/app/core](../../../../backend/app/core) | Config (pydantic-settings), logging, exceptions, json_utils |

## Documentos

| Arquivo | Cobre |
|---|---|
| [01-architecture.md](01-architecture.md) | Layers, fluxo principal, contratos de borda |
| 99-changelog.md | Histórico de mudanças (criar conforme PRs) |

## Cross-refs

Domínio funcional (regras de análise, calibrações): ver [.claude/local/face-analysis/](../../face-analysis/00-index.md).
Camada NestJS que consome esta API: ver [nest/](../nest/00-index.md).
