---
tenant_id: "face-before-after"
project: "face-before-after"
module: "vision/task-dlib-to-mediapipe-mesh-2026-05-07.prompt"
file_path: ".claude/prompts/vision/task-dlib-to-mediapipe-mesh-2026-05-07.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Type: refactor > Module: vision backend/app/vision > Date: 2026-05-07 > Stack: Python 3.10 · FastAPI · OpenCV · MediaPipe new > Plan source: .claude/plans/migrate-dlib-to-mediapipe-mesh-2026-05-07.md > Parent plan: .claude/plans/agora-vamos-planejar-em-ethereal-thimble.md Promp
tags:
  - "task-prompt"
rag_keywords:
  - "dlib"
  - "mediapipe"
  - "mesh"
  - "prompt"
  - "prompts"
  - "vision"
related_modules: []
depends_on: []
used_by: []
---
# Migrate Server-side Landmarks: dlib → MediaPipe Face Mesh (subset 68)

> **Type:** refactor
> **Module:** vision (`backend/app/vision`)
> **Date:** 2026-05-07
> **Stack:** Python 3.10 · FastAPI · OpenCV · MediaPipe (new)
> **Plan source:** `.claude/plans/migrate-dlib-to-mediapipe-mesh-2026-05-07.md`
> **Parent plan:** `.claude/plans/agora-vamos-planejar-em-ethereal-thimble.md` (Prompt 1)

---

## Context

Trocar a fonte de landmarks server-side de **dlib (68 pts)** para **MediaPipe Face Mesh (468 pts)**, mantendo o layout de saída `(68, 2)` idêntico ao dlib via tabela determinística `MEDIAPIPE_TO_DLIB_68`. Objetivo: não quebrar `quality_evaluator.py` nem `face_metrics.py`, que indexam pontos como `landmarks[8]` (queixo), `landmarks[27]` (ponte do nariz), `landmarks[36:48]` (olhos), `landmarks[48:68]` (boca).

Pré-validações já feitas:
- **Arch:** x86_64 (MediaPipe wheel oficial disponível).
- **Native libs:** `Dockerfile.api` e `Dockerfile.local.api` já têm `libglib2.0-0`, `libsm6`, `libxext6`. `libgl1` coberto por `opencv-python-headless`.
- **Pins críticos faltando:** `numpy>=1.24.0` solto e `opencv-python-headless>=4.8.0` solto — bloqueador silencioso (MediaPipe 0.10.x quebra com numpy 2.x e exige OpenCV 4.8.x ABI).

---

## Business Rules

- API pública atual deve ser **preservada**: `detect_faces`, `extract_landmarks`, `detect_and_extract`. Callers em `routers/landmarks.py`, `routers/full_pipeline.py` e `tests/test_quality_evaluator.py` **não devem ser editados** neste prompt.
- Callers passam um objeto retornado por `detect_faces` (hoje `dlib.rectangle`) de volta para `extract_landmarks`. Substituir por uma classe leve `FaceRect` que expõe `.width() .height() .left() .top() .right() .bottom()` para compat.
- `refine_landmarks=True` no MediaPipe adiciona 10 pts de íris (índices 468–477) — usar **só os primeiros 468** para o mapping.
- Cache singleton da instância `FaceMesh` (custosa de instanciar) via module-level ou `@lru_cache`.
- Flag `USE_DLIB_FALLBACK=true` (env var) deve manter o caminho dlib funcionando 1 sprint para A/B.
- Critério de aceite: para a mesma foto, `quality_score` ±0.05 e mesmo `quality_grade` em ≥95% das fotos.

**Isolation Rules:**
- [x] Sem mutação de dados (refactor local).
- [x] Sem cross-DB / multi-tenancy.
- [x] Backward compat dos callers preservada.

---

## Dependency Map (verified)

**Public API of `face_detection.py`** (todos verificados em `grep`):

| Symbol | Signature atual | Callers |
|---|---|---|
| `detect_faces(image_bgr)` | `→ list[dlib.rectangle]` | `routers/landmarks.py:30`, `routers/full_pipeline.py:90` |
| `extract_landmarks(image_bgr, face_rect)` | `→ np.ndarray(68,2)` | `routers/landmarks.py:70`, `routers/full_pipeline.py:92` |
| `detect_and_extract(image_bgr)` | `→ (landmarks, rect) \| (None, None)` | `tests/test_quality_evaluator.py:28,41,43` |

**Novo símbolo a adicionar:**
- `class FaceRect` — substituto de `dlib.rectangle` com mesmos métodos chamados.
- (interno) `_face_mesh()` — singleton de `mp.solutions.face_mesh.FaceMesh(static_image_mode=True, refine_landmarks=True, max_num_faces=2, min_detection_confidence=0.5)`.

**Indexes consumidos por `quality_evaluator.py` (não tocar, apenas garantir paridade):**
- `landmarks[5:12]` — jaw lateral
- `landmarks[27]` — nose bridge
- `landmarks[8]` — chin tip
- `landmarks[36:48]` — eyes
- `landmarks[48:68]` — mouth
- `landmarks[57]` — bottom lip center

**MediaPipe → dlib-68 mapping table:** usar a tabela pública [iBUG-300W ↔ MediaPipe Mesh](https://github.com/google/mediapipe/issues/1615) (referência amplamente validada na comunidade). Documentar fonte como comentário no `landmark_mapping.py`.

**⚠️ Unresolved:** nenhum.

---

## Steps / Checks

### Pré-implementação
- [ ] Confirmar arch do servidor (já validado x86_64 — apenas re-confirmar antes do build).
- [ ] Listar fixtures disponíveis em `backend/tests/fixtures/` — se não houver fotos reais, smoke test fica como TODO + skip pytest mark.

### Implementação

1. [ ] **Pin deps em `backend/pyproject.toml`:**
   - `numpy>=1.24.0` → `numpy>=1.24,<2.0`
   - `opencv-python-headless>=4.8.0` → `opencv-python-headless>=4.8.0,<4.11`
   - Adicionar `mediapipe>=0.10.18`
   - **Manter** `dlib>=19.24.0` (fallback A/B).

2. [ ] **Criar `backend/app/vision/services/landmark_mapping.py`:**
   - Constante `MEDIAPIPE_TO_DLIB_68: list[int]` (68 índices, posições correspondem ao layout dlib).
   - Comentário no topo citando a fonte da tabela.
   - Função utilitária `mesh_to_dlib68(mesh_points: np.ndarray) -> np.ndarray` — recebe `(468|478, 2)`, devolve `(68, 2)`.

3. [ ] **Reescrever `backend/app/vision/services/face_detection.py`:**
   - Manter assinaturas públicas: `detect_faces`, `extract_landmarks`, `detect_and_extract`.
   - Adicionar classe `FaceRect` com `.left()/.top()/.right()/.bottom()/.width()/.height()`.
   - Implementação default (MediaPipe):
     - `_face_mesh()` singleton via `@lru_cache(1)`.
     - Em `detect_faces`: roda mesh, para cada face detectada extrai bbox a partir dos 468 pts, cria `FaceRect`, retorna lista ordenada por área desc (`max_num_faces=2`).
     - Em `extract_landmarks`: já roda mesh internamente (idempotente — se já rodou em `detect_faces`, pode-se cachear por `id(image_bgr)` ou simplesmente rodar de novo — começar com simples, otimizar só se virar gargalo). Aplica `mesh_to_dlib68` e devolve `(68, 2)`.
   - Implementação fallback (`USE_DLIB_FALLBACK=true`): branch que delega ao código dlib antigo (manter funções `_detect_dlib`, `_extract_dlib` privadas).
   - Lazy import de `mediapipe` e `dlib` para não quebrar import-time.

4. [ ] **Criar `backend/tests/test_mediapipe_parity.py`:**
   - Se houver fixtures: parametrizar por imagem; rodar pipeline com `USE_DLIB_FALLBACK=true` e default; comparar `quality_score` (delta ≤0.05) e `quality_grade`.
   - Se não houver fixtures: smoke test simples (gerar imagem sintética com OpenCV, rodar `detect_faces`, garantir que retorna `[]` ou lista válida sem exceção).
   - Marcar `@pytest.mark.skipif(not fixtures_dir.exists(), reason="no fixtures")` para o teste de paridade.

5. [ ] **Build e validar:**
   - `docker compose build api`
   - `docker compose up -d api`
   - `docker compose exec api python -c "from app.vision.services import face_detection; print(face_detection.detect_faces.__doc__)"`

6. [ ] **Smoke E2E:**
   - `curl -F "file=@<foto>" http://localhost:9015/vision/full-pipeline | jq '.quality_score, .quality_grade'`
   - Repetir com `USE_DLIB_FALLBACK=true` (rebuild ou env override).
   - Comparar valores manualmente.

### Pós-implementação
- [ ] Confirmar que `tests/test_quality_evaluator.py` ainda passa (`pytest backend/tests/test_quality_evaluator.py`).
- [ ] Marcar TODO no plano-pai (Prompt 2) para nativizar Mesh-468 nas métricas.
- [ ] **Não remover dlib** ainda — só após Prompt 2 validar paridade total.

---

## Verification

**Pre-conditions:**
- Container `api` buildado com nova `pyproject.toml`.
- Foto de teste com rosto único frontal disponível.

**Test cases:**

```bash
# Default path (MediaPipe)
curl -s -F "file=@./fixtures/sample-frontal.jpg" \
  http://localhost:9015/vision/full-pipeline | jq '{score: .quality_score, grade: .quality_grade}'

# Fallback path (dlib)
docker compose stop api
USE_DLIB_FALLBACK=true docker compose up -d api
curl -s -F "file=@./fixtures/sample-frontal.jpg" \
  http://localhost:9015/vision/full-pipeline | jq '{score: .quality_score, grade: .quality_grade}'

# Parity test
docker compose exec api pytest tests/test_mediapipe_parity.py -v
```

**Expected:** delta de `quality_score` ≤0.05 entre os dois caminhos; `quality_grade` idêntico.

**Known issues & fixes:**

| Erro | Causa | Fix |
|---|---|---|
| `ImportError: numpy.core.multiarray failed to import` | numpy 2.x instalado por engano | Confirmar pin `<2.0` no pyproject e rebuild com `--no-cache` |
| `ImportError: libGL.so.1: cannot open shared object` | `libgl1` faltando | Adicionar `libgl1` ao apt-get install do Dockerfile |
| `MediaPipe FaceMesh returns no detections` | imagem muito escura ou rosto cortado | Esperado — pipeline já trata `face_count=0` |
| Tabela de mapeamento errada (boca/olhos deslocados) | índices Mesh diferentes do esperado | Validar visualmente desenhando os 68 pts em foto de teste; corrigir índices na tabela |

---

## Risks

- Tabela `MEDIAPIPE_TO_DLIB_68` errada em 1–2 índices invisíveis até foto real cair no critério ±0.05.
- Build do `mediapipe` adiciona ~500MB à imagem Docker — esperado, plano-pai já avisou.
- Performance: MediaPipe `static_image_mode=True` é mais lento que dlib em CPU pequena. Aceitável (server tem CPU suficiente). Se virar gargalo, mudar para `False` e gerenciar estado.

---

## Commits (sugeridos — não executar agora)

```bash
git add backend/pyproject.toml \
        backend/app/vision/services/landmark_mapping.py \
        backend/app/vision/services/face_detection.py \
        backend/tests/test_mediapipe_parity.py
git commit -m ":sparkles: feat(vision): migrate landmarks from dlib to MediaPipe Face Mesh

- Adds mediapipe>=0.10.18 with dlib-68 layout via MEDIAPIPE_TO_DLIB_68 table
- Pins numpy<2.0 and opencv<4.11 (MediaPipe 0.10.x ABI compat)
- Keeps USE_DLIB_FALLBACK=true env flag for A/B
- Preserves public API of face_detection (detect_faces / extract_landmarks)
- quality_evaluator and face_metrics untouched"
```

---

## Recommended Execution Model

**sonnet** — herdado do plano. Refactor cirúrgico, escopo fechado, baixa ambiguidade.

---

## ✅ Validation Report

| Layer | Status |
|---|---|
| L1 Context Retrieval | ✅ — face_detection.py + callers lidos |
| L2 LSP Hovering | ✅ — 0 unresolved identifiers |
| L3 Schema Pruning | ✅ — não há schema DB; pruning N/A |
| L4 Instance Sampling | ✅ — N/A para refactor de visão |
| L5 Guardrails | ✅ — backward compat + lazy import + flag fallback |
| L6 ReAct Reflection | ✅ — riscos mapeados, mitigations documentados |
