---
slug: bisenet-hairline-integration
date: 2026-05-12
module: backend/app/services (segmentation + landmarks + metrics)
type: feature + infra
---

# Plan — BiSeNet Hairline Integration

## Goal
Substituir o uso de `lm[10]` (P_FOREHEAD_CROWN do MediaPipe) como proxy de hairline por um **trichion virtual** derivado de máscara de cabelo do BiSeNet (face parsing). Métricas de terço superior (`upper_third_ratio` para `bradpitt-reference.jpg` hoje = 0.20; alvo ≈ 0.33) devem refletir a hairline real, com fallback geométrico quando confidence < 0.8.

Arquitetura de referência: `.claude/plans/plan-hairline/BiSeNet-hair-line.md`.

## Scope
- **Backend Python** (FastAPI / `backend/app`): segmentação, landmarks virtuais, fusion layer, integração no pipeline e em `thirds.py`.
- **Infra** (`Dockerfile.api`): adicionar `onnxruntime` + baixar modelo BiSeNet ONNX.
- **Frontend** (`frontend/src/components/OverlayLayer.tsx`): label dinâmico "Trichion (BiSeNet)" vs "Trichion (mesh)".
- **Tests** (`backend/tests/`): unit + integration cobrindo fallback e bradpitt-reference.

Fora do escopo: retreino do modelo, GPU, métricas além de thirds (apenas trichion alimenta upper third nesta entrega).

## Decomposed steps

### 1. Infra — Dockerfile + modelo ONNX
- Editar `Dockerfile.api`:
  - Adicionar `"onnxruntime>=1.17.0"` na lista do `pip install`.
  - Adicionar etapa `RUN curl -fsSL <bisenet_onnx_url> -o /app/backend/models/bisenet_face_parsing.onnx`.
  - URL preferida: release oficial de `yakhyo/face-parsing` (ONNX, ~6 MB, 19 classes CelebAMask-HQ, classe `hair=17`).
- Verificar caching de layer (pyproject não muda).

### 2. Segmentation service
- Criar `backend/app/services/segmentation/__init__.py`.
- Criar `backend/app/services/segmentation/bisenet_segmenter.py`:
  - Class `BiSeNetSegmenter(model_path, providers=["CPUExecutionProvider"])` com `ort.InferenceSession` lazy-load (singleton por processo).
  - Método `segment(image_bgr) -> dict` retornando `{"hair_mask": np.ndarray[H,W] bool, "face_mask": ..., "raw_label_map": ..., "elapsed_ms": float}`.
  - Pré-processamento: resize 512×512, BGR→RGB, normalização ImageNet, NCHW.
  - Pós-processamento: `argmax`, upsample bilinear de volta ao tamanho original, classes mapeadas.
  - Tratamento de erro: se `ort` indisponível → `RuntimeError` capturado pelo fusion layer (fallback).

### 3. Virtual landmarks
- Criar `backend/app/services/landmarks/virtual_landmarks.py`:
  - Função `extract_hairline_points(hair_mask, face_landmarks) -> dict`:
    - Recorte horizontal pela faixa frontal (entre `P_TEMPLE_LEFT` e `P_TEMPLE_RIGHT`, projetado).
    - Para cada coluna `x` na faixa, primeira linha onde `hair_mask[y,x] == True` descendo do topo da imagem.
    - Suavização com `scipy.signal.savgol_filter` (janela 21, polyord 3).
    - Retorno: `trichion (x,y)`, `hairline_left/center/right`, `forehead_top_estimate`, `temple_left/right`, e `confidence` por ponto (1 − fração de colunas vazias na vizinhança).
  - Fallback geométrico se `mask` vazia ou confidence < 0.8: usa `lm[10]` direto.

### 4. Fusion layer
- Criar `backend/app/services/landmarks/fusion_layer.py`:
  - Função `fuse(image, mp_landmarks) -> FusedLandmarks` (dataclass):
    - Roda BiSeNet (try/except → fallback).
    - Extrai virtuais.
    - Constrói dict final: `{"face_landmarks": mp_landmarks, "virtual_landmarks": {...}, "trichion_source": "bisenet"|"mesh", "trichion_confidence": float, "segmentation": {...}}`.
  - Threshold global `TRICHION_CONFIDENCE_THRESHOLD = 0.8`.

### 5. Pipeline integration
- Localizar router de full-pipeline (`backend/app/api/endpoints/analysis.py` e/ou `compare.py`).
- Após detecção MediaPipe, chamar `fusion_layer.fuse(...)` antes de calcular métricas.
- Anexar `virtual_landmarks` + `trichion_source` ao payload retornado e persistido (`mvp_report.json`).

### 6. Metrics — thirds.py
- Em `backend/app/services/metrics/thirds.py`:
  - Aceitar opcionalmente `virtual_landmarks` no contexto do calculator.
  - Substituir `P_FOREHEAD_CROWN` por `trichion` virtual quando `trichion_confidence >= 0.8`.
  - Manter assinatura/registry — apenas usar fonte alternativa via contexto compartilhado (sem quebrar 92 outras métricas).
  - Confidence final do calculator multiplicada por `trichion_confidence` quando origem = bisenet.

### 7. Tests
- `backend/tests/services/segmentation/test_bisenet_segmenter.py`: smoke test com fixture pequena, valida shape e classes.
- `backend/tests/services/landmarks/test_virtual_landmarks.py`: máscara sintética → trichion no topo da região marcada.
- `backend/tests/services/landmarks/test_fusion_layer.py`: imagem real (`bradpitt-reference.jpg` reduzida para fixture) → `trichion_source == "bisenet"` e confidence ≥ 0.8.
- `backend/tests/services/metrics/test_thirds_with_bisenet.py`: confirma `upper_third_ratio` ∈ [0.30, 0.36] para bradpitt; sem máscara → fallback igual ao baseline atual.
- Garantir que `pytest backend/tests` continue 1394+ passed (sem regressões).

### 8. Frontend
- `frontend/src/components/OverlayLayer.tsx`:
  - Receber `trichion_source` no payload (já passado por props).
  - Label do `FaceExtents` topo: `"Trichion (BiSeNet)"` quando `trichion_source === "bisenet"`, senão `"Trichion (mesh)"`.
  - `npx tsc --noEmit` zero erros.

### 9. Validação manual
- Rebuild: `docker compose build api && docker compose up -d api`.
- POST `bradpitt-reference.jpg` no `/v1/vision/full-pipeline`.
- Verificar `upper_third_ratio` ≈ 0.33 no `mvp_report.json`.
- Inspecionar overlay renderizado.

### 10. Docs
- Atualizar `.claude/face-analysis/00-index.md` com nova entrada.
- Criar `.claude/face-analysis/09-bisenet-hairline.md` (architecture + fallback + thresholds + métricas afetadas).

## Files to create/modify

| Status | Path |
|---|---|
| modify | `Dockerfile.api` |
| create | `backend/app/services/segmentation/__init__.py` |
| create | `backend/app/services/segmentation/bisenet_segmenter.py` |
| create | `backend/app/services/landmarks/__init__.py` (se não existir) |
| create | `backend/app/services/landmarks/virtual_landmarks.py` |
| create | `backend/app/services/landmarks/fusion_layer.py` |
| modify | `backend/app/api/endpoints/analysis.py` (e/ou `compare.py`) |
| modify | `backend/app/services/metrics/thirds.py` |
| create | `backend/tests/services/segmentation/test_bisenet_segmenter.py` |
| create | `backend/tests/services/landmarks/test_virtual_landmarks.py` |
| create | `backend/tests/services/landmarks/test_fusion_layer.py` |
| create | `backend/tests/services/metrics/test_thirds_with_bisenet.py` |
| modify | `frontend/src/components/OverlayLayer.tsx` |
| modify | `.claude/face-analysis/00-index.md` |
| create | `.claude/face-analysis/09-bisenet-hairline.md` |

## Verification

- `pytest backend/tests -q` — todos passam, +4 novos.
- `npx tsc --noEmit` (cwd `frontend`) — zero erros.
- Smoke manual com `bradpitt-reference.jpg`: `upper_third_ratio ∈ [0.30, 0.36]`, `trichion_source == "bisenet"`.
- Latência p95 do `/full-pipeline` aceita ≤ +1000 ms (CPU-only).

## Risks & mitigations

| Risco | Mitigação |
|---|---|
| ONNX model URL muda / 404 | Hospedar mirror em MinIO interno, fallback no Dockerfile |
| Latência > 1.5 s | Cachear resultado por hash de imagem; rodar BiSeNet em thread |
| Hair mask falsa em calvos / cabelo claro | Threshold 0.8 + fallback geométrico já cobrem |
| Quebra das outras 92 métricas | thirds.py é o único calculator alterado; contexto opcional |

## Recommended Execution Model

- **Model:** sonnet
- **Reason:** feature multi-arquivo (~12 arquivos, infra + Python + TS), com integração de modelo ML novo, mas sem decisões arquiteturais profundas (padrão MediaPipe + fusão já definido pelo plano fonte). Sonnet equilibra throughput e qualidade.

Justificativa estendida: feature multi-arquivo (~12 arquivos, infra + Python + TS), com integração de modelo ML novo, mas sem decisões arquiteturais profundas (padrão MediaPipe + fusão já definido pelo plano fonte). Sonnet equilibra throughput e qualidade. Opus seria overkill; haiku insuficiente para a fusion layer + testes.
