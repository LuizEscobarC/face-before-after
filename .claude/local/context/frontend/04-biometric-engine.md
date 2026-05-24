---
tenant_id: "face-before-after-frontend"
project: "face-before-after-frontend"
module: "frontend/biometric-engine"
file_path: ".claude/local/context/frontend/04-biometric-engine.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Vision pipeline do frontend: ClientPhotoProcessor delega para mediapipe.worker.ts via Comlink,
  expondo detectLandmarks (IMAGE mode) e analyzeVideoFrame/detectVideoLandmarks (VIDEO mode).
  DeviceCapabilityDetector guarda WASM+RAM+concurrency. normalizeLandmarks projeta pixels para
  viewBox SVG 100x130. engine.ts (biometric/engine.ts) compila BiometricExerciseConfig em
  CompiledStep[] e amostra malha completa. Nao existe frontend/src/vision/engine.ts — o Engine
  principal fica em biometric/engine.ts.
tags:
  - "frontend"
  - "mediapipe"
  - "vision"
  - "landmarks"
  - "wasm"
  - "worker"
  - "biometric"
rag_keywords:
  - "ClientPhotoProcessor"
  - "DeviceCapabilityDetector"
  - "mediapipe.worker"
  - "LandmarkPayload"
  - "FeedbackResult"
  - "normalizeLandmarks"
  - "BiometricEngine"
  - "CompiledStep"
  - "FaceLandmarker"
  - "Comlink"
  - "sampleFullMesh"
  - "toSvgPath"
related_modules:
  - "frontend/biometric-exercise"
depends_on:
  - "frontend/data-flow"
used_by:
  - "frontend/biometric-exercise"
---

# Frontend — Biometric Engine

## Visão Geral

O pipeline de visão do cliente é composto por dois sub-grupos:

1. **`frontend/src/vision/`** — captura e extração de landmarks via MediaPipe (Worker thread).
2. **`frontend/src/biometric/engine.ts`** — compilação e animação de exercícios biométricos.

> ⚠️ **Símbolo não resolvido**: `frontend/src/vision/engine.ts` **não existe** no repositório.
> O orquestrador principal reside em `frontend/src/biometric/engine.ts` (`BiometricEngine`).

---

## `ClientPhotoProcessor` (`frontend/src/vision/ClientPhotoProcessor.ts`)

Fachada síncrona para o Worker MediaPipe. Construída via factory estático `ClientPhotoProcessor.create()` (async).

| Método | Entrada | Saída | Descrição |
|---|---|---|---|
| `static create()` | — | `Promise<ClientPhotoProcessor>` | Instancia Worker + Comlink, baixa modelo de `/models/face_landmarker.task`, resolve promise após `initialize()`. |
| `runMediaPipe(imageData)` | `ImageData` | `Promise<LandmarkPayload \| null>` | Delega `detectLandmarks` (mode IMAGE) ao worker. |
| `validateRealtimeFeedback(imageData)` | `ImageData` | `Promise<FeedbackResult \| null>` | Delega `analyzeVideoFrame` (mode VIDEO) ao worker — retorna apenas flags booleanas. |
| `dispose()` | — | `void` | Termina o Worker. |

**Tipos exportados:**

```ts
type LandmarkPayload = {
  landmarks: number[][];               // [x_px, y_px, z_norm][] — 478 pontos
  pose: { yaw: number; pitch: number; roll: number }; // graus
  processing_mode: 'CLIENT_SIDE';
};

type FeedbackResult = {
  face_detected: boolean;
  pose_ok: boolean;       // |yaw|<15°, |pitch|<15°, |roll|<10°
  light_ok: boolean;      // TODO: sempre true — brightness não implementado
};
```

---

## `DeviceCapabilityDetector` (`frontend/src/vision/DeviceCapabilityDetector.ts`)

Classe estática sem instância. Três verificações:

| Método | Critério de fallback |
|---|---|
| `supportsWASM()` | `WebAssembly` ausente ou sem `instantiate` |
| `meetsPerformanceThreshold()` | `deviceMemory < 2 GB` **ou** `hardwareConcurrency < 2` |
| `shouldFallback()` | WASM não suportado **ou** threshold não atingido |

**Flags não gravadas em estado** — resultado é calculado sob demanda a cada chamada.

> ⚠️ **GPU e câmera não detectados** neste módulo. O MediaPipe usa `delegate: 'GPU'` direto no worker sem consultar `DeviceCapabilityDetector`. O detector de câmera (`getUserMedia`) é responsabilidade de `useLiveFaceState`.

---

## `mediapipe.worker.ts` (`frontend/src/vision/mediapipe.worker.ts`)

Worker thread exposto via **Comlink** (`expose({...})`). Carrega WASM de `/wasm/` (nginx local, sem CDN).

### Protocolo de mensagens (via Comlink)

| Função exposta | Entrada | Saída | Modo FaceLandmarker |
|---|---|---|---|
| `initialize(modelUrl)` | `string` (URL do `.task`) | `Promise<void>` | Cria `imageLandmarker` (IMAGE) + `videoLandmarker` (VIDEO) |
| `detectLandmarks(imageData)` | `ImageData` | `Promise<LandmarkPayload \| null>` | IMAGE |
| `analyzeVideoFrame(imageData)` | `ImageData` | `Promise<FeedbackResult \| null>` | VIDEO (timestamp-guarded) |
| `detectVideoLandmarks(imageData)` | `ImageData` | `Promise<LandmarkPayload \| null>` | VIDEO — retorna landmarks completos p/ `useLiveFaceState` |

**Estimativa de pose** (`estimatePose`): usa 4 âncoras (nose tip 1, menton 152, left eye outer 33, right eye outer 263) — mesmas do servidor Python. Fórmula heurística (não PnP real); graus aproximados.

**Guardrail de timestamp**: `analyzeVideoFrame` e `detectVideoLandmarks` rejeitam frames onde `Date.now() <= lastVideoTimestamp` (evita reprocessar mesmo timestamp).

**Configurações dos dois landmarkers:**

| Parâmetro | IMAGE | VIDEO |
|---|---|---|
| `delegate` | GPU | GPU |
| `minFaceDetectionConfidence` | 0.5 | 0.4 |
| `outputFaceBlendshapes` | false | false |
| `numFaces` | 1 | 1 |

---

## `normalizeLandmarks.ts` (`frontend/src/biometric/normalizeLandmarks.ts`)

Projeta landmarks em pixels brutos para o espaço do viewBox SVG (`100 × 130` por padrão).

**Estratégia de normalização:**

1. Extrai bbox da face usando 4 âncoras estáveis: forehead (10), chin (152), cheek-L (234), cheek-R (454).
2. Calcula `scale = (viewH × fillRatio) / srcH` (escala uniforme, `fillRatio = 0.85`).
3. Centraliza na origem `(viewW/2, viewH/2)`.
4. Preserva `z` sem alteração.

```ts
function normalizeToViewBox(
  lm: number[][],
  viewW = 100,
  viewH = 130,
  fillRatio = 0.85,
): NormalizedLandmarks
// → { points: number[][], scale: number, cx: number, cy: number }
```

**Alinhamento com backend Python**: a mesma estratégia de normalização é usada por `scripts/extract_canonical_mesh.py` (seed do canonical mean face), garantindo que o JSON canônico (`canonicalFaceMesh.json`) seja compatível com frames live.

> ⚠️ **ICU-based normalization**: não — não usa ICU (Inter-Commissure Unit). Usa **IOD** (inter-ocular distance) em `landmarkToFaceState.ts` como baseline de escala, e bbox forehead-chin em `normalizeLandmarks.ts`. Distinção importante: são dois espaços diferentes para dois propósitos distintos.

---

## `BiometricEngine` (`frontend/src/biometric/engine.ts`)

Orquestrador de exercícios. Não envolve MediaPipe diretamente — consome landmarks já extraídos.

### `BiometricEngine.compile(config, landmarks)`

Transforma `BiometricExerciseConfig` em array de `CompiledStep[]`. Se `landmarks` for null, usa `AVATAR_LANDMARKS` (canonical fallback).

```ts
type CompiledStep = {
  step: BiometricStep;
  centroid: Pt;
  pivot: Pt;
  zoneIndices: ReadonlyArray<number>;
  hullIndices: ReadonlyArray<number>;
  basePoints: Pt[];
  sample: (t: number) => Pt[];   // aplica verb à zona em t ∈ [0,1]
};
```

### `BiometricEngine.sampleFullMesh(config, landmarks, t)`

Aplica todos os steps sobre a malha 478 completa a um dado `t`. Para `rotate_around_pivot`, expande automaticamente o conjunto de índices para todos os landmarks **abaixo do pivot Y** (mandíbula como osso rígido).

### `BiometricEngine.toSvgPath(points, viewBoxSize)`

Converte array de `Pt[]` para string `d` de SVG path (polígono fechado com `Z`). Para menos de 3 pontos, gera círculo mínimo.

---

## Fluxo de dados resumido

```
Camera (getUserMedia)
  └─► useLiveFaceState
        └─► mediapipe.worker (Comlink)
              └─► detectVideoLandmarks()
                    └─► LandmarkPayload { landmarks[478][3], pose }
                          └─► landmarkToFaceState()  → Partial<FaceState>
                          └─► normalizeLandmarks()   → viewBox coords
                          └─► BiometricEngine.compile() → CompiledStep[]
```
