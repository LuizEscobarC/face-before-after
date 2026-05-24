---
tenant_id: "face-before-after"
project: "face-before-after"
module: "vision/task-landmark-driven-face-rig-2026-05-11.prompt"
file_path: ".claude/prompts/vision/task-landmark-driven-face-rig-2026-05-11.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Plan: .claude/plans/landmark-driven-face-rig-2026-05-11.md Module: vision Type: architectural refactor Slug: landmark-driven-face-rig Date: 2026-05-11 Recommended model: sonnet
tags:
  - "task-prompt"
  - "landmark"
rag_keywords:
  - "MediaPipe FaceMesh"
  - "dlib 68 landmarks"
  - "driven"
  - "face"
  - "landmark"
  - "prompt"
  - "prompts"
  - "vision"
related_modules: []
depends_on: []
used_by: []
---
# Prompt: Landmark-Driven Face Rig

**Plan:** `.claude/plans/landmark-driven-face-rig-2026-05-11.md`
**Module:** `vision`
**Type:** architectural refactor
**Slug:** landmark-driven-face-rig
**Date:** 2026-05-11
**Recommended model:** sonnet

---

## Context to load BEFORE coding

1. `.claude/plans/landmark-driven-face-rig-2026-05-11.md` — fonte de verdade do plano.
2. `frontend/src/components/ExerciseStudioPreview/FaceRig.tsx` — código a substituir (referência de estrutura SVG e estilos).
3. `frontend/src/biometric/landmarkToFaceState.ts` — para entender índices MediaPipe já usados (1, 10, 33, 133, 152, 234, 263, 362, 454, 468, 473…).
4. `frontend/src/vision/mediapipe.worker.ts` — confirmar formato `[x_px, y_px, z_norm][]` (z já preservado).
5. `frontend/src/components/SvgFaceInstructor/faceState.ts` — `FaceState` mantido para modo scripted.
6. `frontend/src/biometric/useExerciseRecorder.ts` — onde gravar landmarks brutos.

---

## Implementation steps (sequência fixa)

### Step 1 — `frontend/src/biometric/normalizeLandmarks.ts`
- Função `normalizeToViewBox(lm: number[][], viewW=100, viewH=130, fillRatio=0.85)`.
- Bbox via índices `10, 152, 234, 454`. Centra; escala uniforme (mantém aspect) para que `(chin-forehead)` ocupe `viewH * fillRatio`.
- Retorna `{ points: number[][], scale: number, cx: number, cy: number }`.
- Sem dependências.

### Step 2 — `frontend/src/biometric/oneEuroFilter.ts`
- Classe `OneEuroFilter1D({mincutoff=1, beta=0.05, dcutoff=1})` com `filter(value, timestamp)`.
- Wrapper `OneEuroFilterArray(N, dim=3, params)` que mantém N×dim filtros independentes; método `filter(points: number[][], timestamp: number): number[][]`.
- Algoritmo padrão Casiez 2012 (lowpass adaptativo). Sem libs externas.

### Step 3 — `frontend/src/biometric/faceMeshTopology.ts`
- Exportar arrays de índices oficiais (consultar `@mediapipe/tasks-vision` `FaceLandmarker.FACE_LANDMARKS_*` ou hardcode da spec 478):
  - `FACE_OVAL`, `LIPS_OUTER`, `LIPS_INNER`, `LEFT_EYE`, `RIGHT_EYE`, `LEFT_EYEBROW`, `RIGHT_EYEBROW`, `NOSE_BRIDGE`, `NOSE_BOTTOM`, `LEFT_IRIS`, `RIGHT_IRIS`.
- Função `polylinePath(points: number[][], indices: number[], close=false): string` → `"M x y L x y … Z?"`.
- Função `regionCenter(points, indices): [x,y]` (média).

### Step 4 — `scripts/extract_canonical_mesh.py`
- Baixar `canonical_face_model.obj` da MediaPipe (URL: `https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj`).
- Parse vértices `v x y z` (478 linhas).
- Aplicar mesma normalização que `normalizeLandmarks.ts` (centra em (50,65), escala para fillRatio 0.85, flip y se necessário).
- Salvar `frontend/src/biometric/canonicalFaceMesh.json` como `[[x,y,z], …]` array de 478.
- Rodar uma vez via `.venv/bin/python scripts/extract_canonical_mesh.py` e versionar JSON.

### Step 5 — `frontend/src/components/ExerciseStudioPreview/LandmarkRig.tsx`
- Imports: `motion` from framer-motion; topologia; normalize + filter; canonical JSON.
- `OneEuroFilterArray` em `useRef` para persistir entre renders.
- `points = useMemo`: se `landmarks` → normalize + filter; senão → `applyFaceStateDeformation(canonical, state)`.
- Pseudo-3D: outer `<g transform={matrix(...)}>` com skewX(faceRotate*0.6°) + scaleY(facePitch). MANTER (decisão do usuário).
- Render hierarquia (z-order):
  - silhueta (FACE_OVAL closed)
  - sobrancelhas (×2)
  - olhos rings (×2, fechados)
  - íris (`<motion.circle>` × 2, centro = `regionCenter(LEFT_IRIS)`/`RIGHT_IRIS`, r=2)
  - nariz (NOSE_BRIDGE + NOSE_BOTTOM)
  - lábios (LIPS_OUTER closed + LIPS_INNER closed, fill diferente)
  - `<MeshDots>` se `showMesh` (todos os 478 pontos como `r=0.35` circles)
- `applyFaceStateDeformation(canonical, state)` (interna):
  - `jawDx`: somar a `points[i][0]` para `i ∈ FACE_OVAL[lower-half]`.
  - `jawDy`: somar a `points[i][1]` para `i ∈ {chin region}`.
  - `mouthShape`: lerp `LIPS_OUTER`/`INNER` para presets pré-computados (apenas open/wide_smile/pucker/flat na primeira pass; demais → flat).
  - `eyeLOpenness/eyeROpenness`: escalar verticalmente os pontos do ring do olho ao redor do centro.
  - `browLDy/browRDy`: somar y aos índices de cada sobrancelha.
  - Resto dos campos: ignorar nesta primeira pass (degrada para neutro).

### Step 6 — `frontend/src/types/animationConfig.ts`
- Adicionar `landmarks?: number[][]` ao `RecordedKeyframe`. Comentar como opcional + retro-compat.

### Step 7 — `frontend/src/biometric/useExerciseRecorder.ts`
- No sampler, ler `live.landmarks` via novo ref `liveLandmarksRef` (paralelo a `liveDeltaRef`).
- Push `{ t, delta, landmarks: liveLandmarks }` em `framesRef`.
- Tipo do retorno: `framesRef.current` continua `RecordedKeyframe[]`.

### Step 8 — `frontend/src/components/ExerciseStudioPreview/index.tsx`
- Adicionar state `replayLandmarks` extraído do `replayFrame` (se presente).
- Substituir `<FaceRig … />` por `<LandmarkRig landmarks={liveDelta ? meshLandmarks : (replayFrame?.landmarks ?? null)} state={renderedState} style={style} transition={transition} showMesh={showMesh} />`.
- Quando scripted (sem live, sem replay): `landmarks={null}` → LandmarkRig usa canonical.

### Step 9 — `useRecordedTimelineFrame` (mesmo arquivo index.tsx)
- Atualizar para retornar `{ delta: Partial<FaceState>, landmarks: number[][] | null }` em vez de só delta.

### Step 10 — DELETAR
- `rm frontend/src/components/ExerciseStudioPreview/FaceRig.tsx` (substituído).

### Step 11 — Build
- `cd frontend && npm run build` → 0 erros TS, build Vite OK.

---

## Constraints / non-negotiable

- **Não** quebrar API pública de `ExerciseStudioPreview` — props existentes mantidas.
- **Não** mexer em backend/Nest — zero migração de schema.
- **Não** mudar `FaceState` interface (apenas usado nos novos rigs e legado).
- One-Euro filter **obrigatório** em modo live — sem ele tremor inviabiliza visualização.
- Pseudo-3D matrix **mantido** (decisão do usuário) — aplicar sobre os pontos já normalizados.

## Verification gates

1. `get_errors` em todos os arquivos modificados/criados → 0 erros.
2. `cd frontend && npm run build` → exit 0.
3. Validação visual manual: mesh ON cobre rig pixel-perfect (usuário confere).

## Out of scope

- Per-user mesh calibration.
- WebGL / Three.js.
- Migração de timelines antigas (frames sem landmarks degradam para `FaceState` apenas).
- Mapeamento completo `FaceState→índices` (primeira pass cobre 5 campos principais).
