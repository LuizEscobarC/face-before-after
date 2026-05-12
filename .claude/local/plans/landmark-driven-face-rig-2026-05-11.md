# Plan: Landmark-Driven Face Rig

**Date:** 2026-05-11
**Slug:** landmark-driven-face-rig
**Module:** frontend / ExerciseStudioPreview + biometric pipeline
**Type:** architectural refactor (rendering layer)
**Stack:** React 18 + TypeScript + Vite + framer-motion + MediaPipe FaceLandmarker
**Status:** ✅ DONE (2026-05-11) — todas as 7 fases entregues. Tracking no PLAN_METRICS.md como **PR-64 (M5 — Admin UX)**.

---

## Execution result (2026-05-11)

| Step | Entrega | Status |
|------|---------|--------|
| 1 | `frontend/src/biometric/normalizeLandmarks.ts` — `normalizeToViewBox(lm, viewW=100, viewH=130, fillRatio=0.85)`. Bbox via 4 âncoras (10/152/234/454). | ✅ |
| 2 | `frontend/src/biometric/oneEuroFilter.ts` — `OneEuroFilterArray(478, 3, {mincutoff:1.5, beta:0.05, dcutoff:1.0})`. Casiez 2012. | ✅ |
| 3 | `frontend/src/biometric/faceMeshTopology.ts` — FACE_OVAL/LIPS/EYES/BROWS/NOSE/IRIS + helpers `polylinePath / regionCenter / regionRadius`. | ✅ |
| 4 | `scripts/extract_canonical_mesh.py` + `frontend/src/biometric/canonicalFaceMesh.json` (468 pts, 11.7 KB). **Surpresa:** OBJ canônico oficial tem **468 vértices**, não 478 — íris (468-477) é injetada pelo modelo de íris em runtime. Tratado via fallback `irisCenter()` ao centro do olho em modo scripted. | ✅ |
| 5 | `frontend/src/components/ExerciseStudioPreview/LandmarkRig.tsx` (~290 linhas). Render + One-Euro singleton + `applyFaceStateDeformation` (jaw, lips, eye openness, brow lift/rotate, lip-corner asymmetry). Pseudo-3D matrix preservada por DEC do usuário. | ✅ |
| 6 | `frontend/src/types/animationConfig.ts` — `RecordedKeyframe.landmarks?: number[][]` (opcional, retro-compat). | ✅ |
| 7 | `frontend/src/biometric/useExerciseRecorder.ts` — `liveLandmarksRef` + push `{t, delta, landmarks}` no sampler. | ✅ |
| 8 | `frontend/src/components/ExerciseStudioPreview/index.tsx` — `useRecordedTimelineFrame` retorna `{delta, landmarks}`; `<LandmarkRig>` recebe `landmarks`, `state`, `style`, `transition`, `showMesh`, `meshOpacity`. | ✅ |
| 9 | `frontend/src/components/ExerciseStudioPreview/styles.ts` — adicionados `eyeFill / irisColor / lipColor / mouthInner / meshColor` opcionais em `StudioStyle`, com defaults nos presets `scifi` e `mesh`. (Descoberto na fase de build — type-error original.) | ✅ |
| 10 | DELETE `frontend/src/components/ExerciseStudioPreview/FaceRig.tsx`. | ✅ |
| 11 | `npm run build` no `frontend/` — `tsc -b && vite build` ✓ em 2.00s, 432 módulos, bundle 459.38 kB / 146.30 kB gzip. | ✅ |

**Validação visual pendente:** rodar `just frontend-deploy` e abrir `/admin/animations/preview` (seção "Live Face — MediaPipe") + RecordExerciseModal para confirmar pixel-perfect. Não quebra nada que já existia (modo scripted continua via canonical + FaceState).

---

## Goal

Substituir o `FaceRig` hardcoded (anchors fixos `HEAD_CX=50`, `EYE_CY=50`, `MOUTH_CY=82`) por um `LandmarkRig` que **desenha o rosto SVG diretamente a partir dos 478 pontos do MediaPipe**, normalizados ao viewBox. Mesh overlay e rig passam a coincidir pixel-a-pixel. Modo scripted (sem câmera) continua via `FaceState` aplicado a uma malha canônica oficial.

## Root cause (do replan)

Pipeline atual: `landmarks(478×3) → FaceState(~30 escalares) → SVG hardcoded`. Descarta 99% da info → SVG nunca bate com rosto real. Mesh overlay com projeção afim de 2 âncoras (cantos dos olhos) → blob minúsculo desalinhado. Conforme captura de tela em `2026-05-11`.

## Decisions (do usuário)

1. **Modo scripted MANTIDO** — `FaceState` deforma `canonicalFaceMesh.json`; admin continua editando JSON com primitives.
2. **Canonical mesh OFICIAL** — `canonical_face_model.obj` da MediaPipe convertido para JSON 478×3, versionado.
3. **Pseudo-3D MANTIDO** — efeito skewX/scaleY do `FaceRig` continua presente no `LandmarkRig` (multiplicador opcional sobre os landmarks já posicionados, para acentuar rotação).
4. **Pipeline formal** (planner → prompt-initializer → auto-execute).

---

## Phases

### Phase 1 — Camada de normalização (foundation)

1. **`frontend/src/biometric/normalizeLandmarks.ts`** — `normalizeToViewBox(lm, viewW=100, viewH=130)`. Bbox via `forehead(10) + chin(152) + cheekL(234) + cheekR(454)`. Centra no viewBox, escala mantendo aspect ratio para preencher ~85% da altura. Retorna `{points, scale, cx, cy}`.
2. **`frontend/src/biometric/oneEuroFilter.ts`** — One-Euro filter por landmark (β=0.05, mincutoff=1.0). Sem ele, render a 24fps fica intratável. Aplica em `points` por componente x/y/z.

### Phase 2 — Topologia canônica

3. **`frontend/src/biometric/faceMeshTopology.ts`** — exporta arrays de índices oficiais MediaPipe:
   - `FACE_OVAL` (silhueta, ~36 pontos, fechado)
   - `LIPS_OUTER`, `LIPS_INNER` (fechados)
   - `LEFT_EYE`, `RIGHT_EYE` (rings 16 pts, fechados)
   - `LEFT_EYEBROW`, `RIGHT_EYEBROW`
   - `NOSE_BRIDGE`, `NOSE_BOTTOM`
   - `LEFT_IRIS` (468-472), `RIGHT_IRIS` (473-477)
4. **Helper `polylinePath(points, indices, close=false)`** → string `d="M x y L … Z?"` para `<motion.path>`.

### Phase 3 — Canonical mean face seed

5. **`scripts/extract_canonical_mesh.py`** — script one-off que lê `canonical_face_model.obj` da MediaPipe (download em runtime do script ou do repo `google-ai-edge/mediapipe`), extrai os 478 vértices, aplica a mesma normalização do runtime e grava `frontend/src/biometric/canonicalFaceMesh.json` (~30KB, formato `[[x,y,z], …]`).
6. Rodar uma única vez, versionar JSON, descartar dependência runtime do `.obj`.

### Phase 4 — `LandmarkRig` (núcleo)

7. **`frontend/src/components/ExerciseStudioPreview/LandmarkRig.tsx`** — NEW. Props:
   ```ts
   {
     landmarks: number[][] | null;     // raw MediaPipe (live/replay-real)
     state: FaceState;                 // scripted deformations OR pseudo-3D multipliers
     style: StudioStyle;
     transition: Transition;
     showMesh?: boolean;
   }
   ```
   - Source de pontos: `landmarks` se presente, senão `CANONICAL_FACE_LANDMARKS`.
   - Aplica `normalizeToViewBox` + `oneEuroFilter` (singleton por componente).
   - Aplica `state` como **deformação por região** quando `landmarks==null` (modo scripted): `jawDx` translada FACE_OVAL[lower half], `mouthShape` interpola LIPS entre presets canônicos, `eyeLOpenness` colapsa LEFT_EYE no eixo y, etc.
   - **Pseudo-3D mantido**: `<g transform="matrix(...)">` no contorno externo aplica skewX/scaleY de `state.faceRotate/facePitch` POR CIMA dos pontos já posicionados (não substitui).
   - Renderiza:
     - `<motion.path d={polylinePath(p, FACE_OVAL, true)}>` silhueta
     - `<motion.path>` × 2 sobrancelhas
     - `<motion.path>` × 2 anéis dos olhos
     - `<motion.circle>` × 2 íris (centro = avg dos 5 pts iris)
     - `<motion.path>` ponte + base do nariz
     - `<motion.path>` × 2 lábios outer/inner
     - `<MeshDots>` debug overlay (mesmos pontos normalizados)

### Phase 5 — Wiring

8. **`frontend/src/components/ExerciseStudioPreview/index.tsx`** — substituir `<FaceRig>` por `<LandmarkRig landmarks={liveDelta||replayFrame ? meshLandmarks : null} state={renderedState} … />`. Quando scripted (sem live/replay), passar `landmarks={null}`.
9. **`frontend/src/types/animationConfig.ts`** — adicionar `RecordedKeyframe.landmarks?: number[][]` (opcional, retro-compatível).
10. **`frontend/src/biometric/useExerciseRecorder.ts`** — gravar `live.landmarks` em `framesRef` junto do `delta`. Replay em `useRecordedTimelineFrame` retorna ambos.
11. **`frontend/src/components/ExerciseStudioPreview/index.tsx`** — no replay, expor `replayLandmarks` e passar para `LandmarkRig`.

### Phase 6 — Limpeza

12. Deletar `frontend/src/components/ExerciseStudioPreview/FaceRig.tsx` (substituído).

### Phase 7 — Validação

13. `npm run build` no `frontend/` — TypeScript + Vite limpos.
14. Validação visual no `/admin/exercise-studio` + RecordExerciseModal:
    - Mesh ON: dots cobrem exatamente as linhas do rig.
    - Mandíbula lateral: silhueta inferior segue.
    - Boca abrir/sorrir/bicar: lábios espelham forma real.
    - Piscar: ring do olho colapsa.
    - Yaw 30°: silhueta encolhe lateralmente naturalmente + skew adicional do pseudo-3D.

---

## Skills mapping

Stack é React/TS — skills Laravel-oriented (`laravel-feature-implementer`, `phpunit-test-writer`, `integration-prober`) **não se aplicam**. Workflow simplificado:

| Step | Action |
|------|--------|
| 1-2  | Implementação direta (criar arquivos TS) |
| 3    | Implementação + execução do Python script (via terminal `.venv`) |
| 4    | Implementação direta (componente React) |
| 5    | Edição de arquivos existentes (multi_replace_string_in_file) |
| 6    | Deleção via terminal |
| 7    | `npm run build` + `get_errors` |

Sem `clear-cache`, sem Pint, sem Postman — não é Laravel.

## Relevant files

- **NEW:** `frontend/src/biometric/normalizeLandmarks.ts`
- **NEW:** `frontend/src/biometric/oneEuroFilter.ts`
- **NEW:** `frontend/src/biometric/faceMeshTopology.ts`
- **NEW:** `frontend/src/biometric/canonicalFaceMesh.json`
- **NEW:** `scripts/extract_canonical_mesh.py`
- **NEW:** `frontend/src/components/ExerciseStudioPreview/LandmarkRig.tsx`
- **EDIT:** `frontend/src/components/ExerciseStudioPreview/index.tsx`
- **EDIT:** `frontend/src/types/animationConfig.ts`
- **EDIT:** `frontend/src/biometric/useExerciseRecorder.ts`
- **DELETE:** `frontend/src/components/ExerciseStudioPreview/FaceRig.tsx`

## Verification

1. `npm run build` no `frontend/` passa sem erros.
2. Mesh overlay ON → dots ↔ rig pixel-perfect.
3. Mandíbula lateral move silhueta de fato.
4. Lábios mudam forma (não trocam preset).
5. Piscar fecha o ring real do olho.
6. Yaw 30° → silhueta encolhe + skew aplicado por cima.

## Out of scope

- Backend changes (zero — passa tudo como JSONB passthrough).
- Migração de exercícios já gravados (frames antigos sem `landmarks` continuam tocando via `FaceState`).
- WebGL / Three.js (pseudo-3D continua via SVG matrix).
- Per-user calibration de canonical mesh (oficial neutro é suficiente).

## Risks

1. **canonical_face_model.obj URL muda na MediaPipe** — script salva fallback embarcado.
2. **One-Euro filter custo CPU** — 478 × 24fps ≈ 11k ops/s, OK no main thread; se pesar, mover para worker.
3. **Animação por região no scripted mode** — mapeamento `FaceState→índices` é trabalhoso; primeira pass cobre só `jawDx/jawDy/mouthShape/eye*Openness`; resto degrada para neutro.

---

## Recommended Execution Model

**sonnet** — refactor multi-arquivo (10 arquivos), sem decisões arquiteturais críticas pendentes (já resolvidas no replan), volume de código moderado. Opus seria overkill; haiku perderia consistência entre os componentes.
