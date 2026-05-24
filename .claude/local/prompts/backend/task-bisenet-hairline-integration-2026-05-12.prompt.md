---
tenant_id: "face-before-after"
project: "face-before-after"
module: "backend/task-bisenet-hairline-integration-2026-05-12.prompt"
file_path: ".claude/local/prompts/backend/task-bisenet-hairline-integration-2026-05-12.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Type: feature + infra > Module: backend segmentation + landmarks + metrics + frontend overlays > Date: 2026-05-12 > Stack: FastAPI · Python 3.12 · MediaPipe Mesh-478 · ONNX Runtime CPU · Docker · React/TS > Plan: .claude/local/plans/bisenet-hairline-integration-2026-05-12.md >
tags:
  - "task-prompt"
  - "bisenet"
  - "backend"
rag_keywords:
  - "BiSeNet"
  - "backend"
  - "bisenet"
  - "hair segmentation"
  - "hairline"
  - "integration"
  - "local"
  - "prompt"
  - "prompts"
related_modules: []
depends_on: []
used_by: []
---
# BiSeNet Hairline Integration

> **Type:** feature + infra
> **Module:** backend (segmentation + landmarks + metrics) + frontend (overlays)
> **Date:** 2026-05-12
> **Stack:** FastAPI · Python 3.12 · MediaPipe Mesh-478 · ONNX Runtime (CPU) · Docker · React/TS
> **Plan:** `.claude/local/plans/bisenet-hairline-integration-2026-05-12.md`
> **Reference:** `.claude/plans/plan-hairline/BiSeNet-hair-line.md`

---

## Context

**Problem.** Hoje a régua de terços usa `lm[10]` do MediaPipe (`P_FOREHEAD_CROWN`) como hairline. Esse landmark é o **topo da malha**, não o **trichion** (linha real do cabelo). Em `bradpitt-reference.jpg` isso produz `upper_third_ratio ≈ 0.20` quando o ideal anatômico é `≈ 0.33`. O label do overlay já foi corrigido para "Trichion (mesh)" para não enganar, mas a métrica continua errada na origem.

**Solution.** Adicionar um **segundo sensor**: BiSeNet (face parsing ONNX, CelebAMask-HQ, classe `hair=17`). Combinar com MediaPipe via fusion layer. Quando a máscara de cabelo tem confidence ≥ 0.8 → usar trichion virtual extraído da máscara. Senão → fallback geométrico para `lm[10]`.

**Affected pipeline:**
- `Dockerfile.api` (deps + asset)
- `backend/app/services/segmentation/` (novo módulo)
- `backend/app/services/landmarks/` (novo módulo: virtual + fusion)
- `backend/app/services/metrics/thirds.py` (consumir trichion virtual)
- `backend/app/api/endpoints/analysis.py` (chamar fusion no pipeline)
- `frontend/src/components/OverlayLayer.tsx` (label dinâmico)
- `backend/tests/services/...` (4 arquivos novos)

**Success criterion.** `POST /v1/vision/full-pipeline` com `bradpitt-reference.jpg` → `upper_third_ratio ∈ [0.30, 0.36]` e `trichion_source == "bisenet"`. Pytest e tsc zero regressões.

---

## Business Rules

- **Trichion threshold:** `TRICHION_CONFIDENCE_THRESHOLD = 0.8`. Abaixo disso, fallback obrigatório para `lm[10]` (mesh).
- **Determinismo:** mesma imagem → mesma máscara → mesmo trichion (singleton ORT, sem RNG no caminho).
- **Side-effect-free:** BiSeNet é um *consumer* de imagem; nunca grava no disco fora de logs/cache opcional.
- **Compatibilidade:** as outras 92 métricas NÃO podem mudar de valor. Apenas `thirds.upper_third_*` (e dependentes) mudam.
- **Confidence propagation:** quando trichion vem do BiSeNet, `confidence_final` do calculator de upper third é multiplicada por `trichion_confidence`.
- **Latência:** orçamento +1000 ms p95 sobre o pipeline atual. Se exceder, mover BiSeNet para thread/cache.

**Isolation rules:**
- [ ] Sem GPU disponível → forçar `providers=["CPUExecutionProvider"]`.
- [ ] BiSeNet falha (modelo ausente, `ort` import error, máscara vazia) → log warning + fallback geométrico, NUNCA propagar 500.
- [ ] Modelo é asset versionado no Docker; nunca baixar em runtime.

---

## Dependency Map

**Existing identifiers (verified):**

| Identifier | Path | Notes |
|---|---|---|
| `P_FOREHEAD_CROWN` | `backend/app/domain/landmarks_mesh.py` | landmark index 10 — substituído quando trichion BiSeNet disponível |
| `_THIRDS_DEP_LM` | `backend/app/services/metrics/thirds.py` | tupla com landmarks usados em terços |
| `register` decorator | `backend/app/services/metrics/__init__.py` | registry pattern para calculadores |
| `propagate()` | `backend/app/services/confidence_propagation.py` | propaga confidence final |
| MediaPipe mesh-478 detection | (já no pipeline) | retorna `(478, 3)` antes da fusão |
| `analysis.py` router | `backend/app/api/endpoints/analysis.py` | endpoint full-pipeline |

**New identifiers (to create):**

| Identifier | Path |
|---|---|
| `BiSeNetSegmenter` | `backend/app/services/segmentation/bisenet_segmenter.py` |
| `extract_hairline_points()` | `backend/app/services/landmarks/virtual_landmarks.py` |
| `FusedLandmarks` (dataclass) | `backend/app/services/landmarks/fusion_layer.py` |
| `fuse()` | `backend/app/services/landmarks/fusion_layer.py` |
| `TRICHION_CONFIDENCE_THRESHOLD` | `backend/app/services/landmarks/fusion_layer.py` |

**External assets:**
- BiSeNet ONNX (~6 MB) — preferir release de `yakhyo/face-parsing` (CelebAMask-HQ, 19 classes). Hospedar mirror em MinIO interno como contingência.

**Cross-boundary warnings:**
- `numpy` vs `mediapipe` shape conventions — máscaras BiSeNet voltam HxW; landmarks MediaPipe são (N,3). Manter conversão explícita.

---

## Reasoning Patterns (per phase)

- **ReAct (act → observe → next):** após cada fase implementada, rodar o subset de testes pytest correspondente antes de avançar. Não bater fase 5 sem fase 4 verde.
- **Chain-of-Thought na fusion layer:** documentar (em comentários *curtos* e nos docstrings dos métodos) o porquê do score de confidence (fração de colunas válidas, regularidade vertical, distância ao `lm[10]`). Sem comentar o óbvio.

---

## Steps / Checks

### Pré-implementação (baseline)
- [ ] Rodar baseline pytest: `cd backend && pytest -q` — anotar X/Y passando atual.
- [ ] Snapshot do `mvp_report.json` atual de `bradpitt-reference.jpg` (referência: `resultado_api/82cd331ab8ed/`).
- [ ] Confirmar que `lm[10]` continua sendo o origem da hairline no pipeline atual.

### Fase 1 — Infra
- [ ] Editar `Dockerfile.api`:
  - [ ] Adicionar `"onnxruntime>=1.17.0"` no bloco `pip install`.
  - [ ] Bloco `RUN curl -fsSL <BISENET_ONNX_URL> -o /app/backend/models/bisenet_face_parsing.onnx` (após o do MediaPipe).
- [ ] Adicionar `onnxruntime>=1.17.0` em `backend/pyproject.toml` (dev/install local).
- [ ] Build local: `docker compose build api`.
- [ ] Smoke import: `docker compose run --rm api python -c "import onnxruntime; print(onnxruntime.__version__)"`.

### Fase 2 — Segmentation
- [ ] Criar `backend/app/services/segmentation/__init__.py`.
- [ ] Criar `backend/app/services/segmentation/bisenet_segmenter.py`:
  - [ ] Singleton `InferenceSession` (lazy, thread-safe).
  - [ ] `segment(image_bgr) -> {"hair_mask": bool[H,W], "face_mask": ..., "raw_label_map": ..., "elapsed_ms": float}`.
  - [ ] Pré-proc: resize 512×512, BGR→RGB, normalização ImageNet (mean=[0.485,0.456,0.406], std=[0.229,0.224,0.225]), NCHW.
  - [ ] Pós-proc: `argmax`, upsample bilinear ao tamanho original.
  - [ ] Erro: try/except em torno do `ort.InferenceSession(...)` → propaga `RuntimeError` capturado pela fusion.
- [ ] Criar `backend/tests/services/segmentation/__init__.py` + `test_bisenet_segmenter.py`:
  - [ ] Smoke com fixture pequena (gerar PNG sintético no fixture).
  - [ ] Valida shape e que classe `hair` é válida.

### Fase 3 — Virtual landmarks
- [ ] Criar `backend/app/services/landmarks/__init__.py` (se não existir).
- [ ] Criar `backend/app/services/landmarks/virtual_landmarks.py`:
  - [ ] `extract_hairline_points(hair_mask, face_landmarks) -> dict`.
  - [ ] Faixa horizontal entre projeções de `P_TEMPLE_LEFT` e `P_TEMPLE_RIGHT`.
  - [ ] Para cada coluna, primeira linha onde `hair_mask[y,x]` descendo do topo.
  - [ ] Suavização `scipy.signal.savgol_filter(window=21, polyorder=3)`.
  - [ ] Saída: `trichion`, `hairline_left/center/right`, `forehead_top_estimate`, `temple_left/right` + `confidence` por ponto (1 − fração de colunas vazias na vizinhança).
- [ ] Criar `backend/tests/services/landmarks/__init__.py` + `test_virtual_landmarks.py`:
  - [ ] Máscara sintética retangular → trichion no topo da região.

### Fase 4 — Fusion layer
- [ ] Criar `backend/app/services/landmarks/fusion_layer.py`:
  - [ ] `TRICHION_CONFIDENCE_THRESHOLD = 0.8`.
  - [ ] `@dataclass FusedLandmarks(face_landmarks, virtual_landmarks, trichion_source, trichion_confidence, segmentation)`.
  - [ ] `fuse(image_bgr, mp_landmarks) -> FusedLandmarks` — try BiSeNet → except (RuntimeError, ImportError, ValueError) → fallback (`trichion_source="mesh"`, confidence baseada na qualidade do landmark mesh).
  - [ ] CoT em docstring: cálculo do score (fração colunas válidas × regularidade vertical × penalidade se distância ao `lm[10]` > 1.5×ICD).
- [ ] Criar `backend/tests/services/landmarks/test_fusion_layer.py`:
  - [ ] Bradpitt fixture → `trichion_source == "bisenet"` e confidence ≥ 0.8.
  - [ ] Sem `onnxruntime` (monkeypatch import) → fallback `trichion_source == "mesh"`.

### Fase 5 — Pipeline + métricas
- [ ] Localizar pipeline em `backend/app/api/endpoints/analysis.py` (e/ou `compare.py`).
- [ ] Após detecção MediaPipe, chamar `fusion_layer.fuse(image, mp_landmarks)`.
- [ ] Anexar `virtual_landmarks` + `trichion_source` + `trichion_confidence` ao payload e `mvp_report.json`.
- [ ] Editar `backend/app/services/metrics/thirds.py`:
  - [ ] Aceitar `virtual_landmarks` via contexto opcional do calculator.
  - [ ] Quando `trichion_confidence >= 0.8` → usar `virtual_landmarks["trichion"]` no lugar de `lm[P_FOREHEAD_CROWN]`.
  - [ ] Multiplicar `confidence_final` por `trichion_confidence` quando origem = bisenet.
  - [ ] **Não alterar** assinatura nem registry.
- [ ] Criar `backend/tests/services/metrics/test_thirds_with_bisenet.py`:
  - [ ] Bradpitt fixture: `upper_third_ratio ∈ [0.30, 0.36]`, `trichion_source == "bisenet"`.
  - [ ] Fallback: sem máscara → valores idênticos ao baseline atual.

### Fase 6 — Frontend
- [ ] `frontend/src/components/OverlayLayer.tsx`:
  - [ ] Receber `trichion_source` via props (já trafegado no payload).
  - [ ] Label do `FaceExtents` topo:
    - `trichion_source === "bisenet"` → `"Trichion (BiSeNet)"`
    - else → `"Trichion (mesh)"`
- [ ] `cd frontend && npx tsc --noEmit` — zero erros.

### Fase 7 — Validação manual
- [ ] `docker compose up -d api`.
- [ ] `curl -F file=@bradpitt-reference.jpg http://localhost:8000/v1/vision/full-pipeline`.
- [ ] Inspecionar `mvp_report.json`: `upper_third_ratio ≈ 0.33`, `trichion_source == "bisenet"`.
- [ ] Inspeção visual do overlay (gerar imagem composta como em `/tmp/overlay_final_v2.jpg`).

### Fase 8 — Docs
- [ ] Atualizar `.claude/face-analysis/00-index.md` com nova entrada (linha + tabela).
- [ ] Criar `.claude/face-analysis/09-bisenet-hairline.md`: arquitetura, fallback, threshold, métricas afetadas, latência observada.

### Pós-implementação
- [ ] Pytest verde: `cd backend && pytest -q` — sem regressões.
- [ ] tsc verde: `cd frontend && npx tsc --noEmit`.
- [ ] Marcar todos os checks [x] e atualizar este prompt com tempos medidos (latência, deltas).

---

## Verification

**Pre-conditions:**
- Docker rebuild da imagem `api` com BiSeNet ONNX presente em `/app/backend/models/bisenet_face_parsing.onnx`.
- `bradpitt-reference.jpg` na raiz do projeto.

**Test cases:**

```bash
# Smoke ONNX
docker compose run --rm api python -c "import onnxruntime, os; print(onnxruntime.__version__); print(os.path.exists('/app/backend/models/bisenet_face_parsing.onnx'))"

# Pipeline com bradpitt
curl -s -F "file=@bradpitt-reference.jpg" http://localhost:8000/v1/vision/full-pipeline \
  | jq '.metrics[] | select(.name=="upper_third_ratio") | {value, confidence_final}, .virtual_landmarks.trichion_source'
# Expected: value ∈ [0.30, 0.36], trichion_source == "bisenet"

# Fallback sintético (rodar suíte específica)
cd backend && pytest -q tests/services/landmarks/test_fusion_layer.py::test_fallback_when_onnxruntime_missing
```

**Known issues & quick solutions:**

| Error | Cause | Fix |
|---|---|---|
| `ImportError: onnxruntime` em runtime | Imagem antiga | `docker compose build api && up -d` |
| `FileNotFoundError: bisenet_face_parsing.onnx` | URL do modelo mudou | atualizar URL no Dockerfile / mirror MinIO |
| `upper_third_ratio` continua 0.20 | thirds.py não está lendo `virtual_landmarks` | conferir contexto opcional do calculator |
| Latência > 1500 ms | BiSeNet inline | mover para thread + cache por hash de imagem |
| Cabelo claro/calvo: confidence < 0.8 | esperado | fallback acionado, label vira "(mesh)" |

---

## Validation Report

```
Layer 1 (Context Retrieval): ✓ plano + arquitetura referência carregados
Layer 2 (LSP Hovering):     ✓ identifiers existentes verificados (P_FOREHEAD_CROWN, thirds.py, analysis.py)
Layer 3 (Schema Pruning):   N/A (sem DB SQL — backend Python puro)
Layer 4 (Instance Sampling): ✓ bradpitt-reference + mvp_report.json baseline
Layer 5 (Guardrails):        ✓ fallback obrigatório, sem mutação de outras métricas, CPU-only
Layer 6 (ReAct Reflection):  ✓ deps de fase respeitadas, asset versionado, sem 500 propagado

🔒 Integrity Check: PASSED
🚀 Ready for execution.
```
