---
tenant_id: "face-before-after-frontend"
project: "face-before-after-frontend"
module: "frontend/biometric-exercise"
file_path: ".claude/local/context/frontend/05-biometric-exercise.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Camada biométrica de exercícios faciais: useLiveFaceState gerencia ciclo de vida do worker
  MediaPipe + câmera e expõe Partial<FaceState> live a 24fps. useBiometricExercise roda loop
  de animação framer-motion (useAnimationFrame) sobre CompiledStep[], produzindo MotionValues
  de SVG path, heat opacity e heat scale. landmarkToFaceState mapeia 478 landmarks para 22
  campos FaceState normalizados por IOD. oneEuroFilter (Casiez 2012) suaviza jitter dos
  landmarks preservando velocidade de movimento real. anatomicalZones define 20 zonas musculares
  + 5 pivots ancorados no mesh-478. movementVerbs define 5 kernels de deformação (stretch,
  compress, massage_circular, isometric_hold, rotate_around_pivot).
tags:
  - "frontend"
  - "biometric"
  - "exercise"
  - "landmarks"
  - "react-hooks"
  - "framer-motion"
  - "one-euro-filter"
  - "anatomical-zones"
rag_keywords:
  - "useLiveFaceState"
  - "useBiometricExercise"
  - "landmarkToFaceState"
  - "OneEuroFilterArray"
  - "ANATOMICAL_ZONES"
  - "VERBS"
  - "applyVerb"
  - "FaceState"
  - "LiveFaceStateResult"
  - "ExerciseFrame"
  - "CompiledStep"
  - "BiometricExerciseConfig"
  - "PIVOT_DEFINITIONS"
  - "resolvePivot"
  - "getCentroid"
related_modules:
  - "frontend/biometric-engine"
depends_on:
  - "frontend/biometric-engine"
used_by:
  - "frontend/overlay-system"
---

# Frontend — Biometric Exercise Layer

## Visão Geral

Esta camada conecta o pipeline MediaPipe (worker) à interface de exercícios guiados. Está dividida em:

- **`useLiveFaceState`** — câmera + worker → `Partial<FaceState>` ao vivo.
- **`useBiometricExercise`** — compilação + loop de animação → `MotionValue[]` prontos para SVG.
- **`landmarkToFaceState`** — mapeamento semântico de 478 landmarks para estado facial.
- **`oneEuroFilter`** — estabilização de landmarks em tempo real.
- **`anatomicalZones`** — dicionário anatômico de zonas musculares.
- **`movementVerbs`** — kernels de deformação para cada tipo de movimento.

---

## `useLiveFaceState` (`frontend/src/biometric/useLiveFaceState.ts`)

### Contrato

```ts
function useLiveFaceState(modelUrl?: string): LiveFaceStateResult
```

**Retorno `LiveFaceStateResult`:**

| Campo | Tipo | Descrição |
|---|---|---|
| `faceState` | `Partial<FaceState> \| null` | Último delta de estado facial convertido. null se sem face. |
| `landmarks` | `number[][] \| null` | Array raw de 478 pontos `[x_px, y_px, z_norm]`. |
| `isRunning` | `boolean` | True enquanto câmera + loop ativo. |
| `isInitializing` | `boolean` | True durante download/init do modelo MediaPipe. |
| `start` | `() => Promise<void>` | Solicita permissão de câmera + inicializa worker (uma vez). |
| `stop` | `() => void` | Para câmera e limpa recursos. |
| `error` | `string \| null` | Último erro de init ou captura. |

### Ciclo interno

1. **Worker (Comlink)** — instanciado em `start()` uma única vez (`initializedRef`). Usa `detectVideoLandmarks` (não `analyzeVideoFrame`).
2. **Camera** — `getUserMedia` com `{ width: 320, height: 240, facingMode: 'user' }`.
3. **Frame loop** — setTimeout a **42ms (~24fps)**. Captura para canvas offscreen `320×240`, extrai `ImageData`, transfere buffer via `Comlink.transfer`.
4. **Conversão** — `landmarkToFaceState(result.landmarks, result.pose)` → `Partial<FaceState>`.
5. **Cleanup** — `stop()` cancela timer, para todas as tracks, null-ifica refs. Unmount termina o Worker.

**Modelo default**: `/models/face_landmarker.task` (servido de `public/`).

---

## `useBiometricExercise` (`frontend/src/biometric/useBiometricExercise.ts`)

### Assinatura

```ts
function useBiometricExercise(
  config: BiometricExerciseConfig,
  landmarks: ReadonlyArray<Pt> | null,
  viewBoxSize?: number,           // default 100
): { frames: ExerciseFrame[]; phase: MotionValue<number> }
```

### Loop de exercício

Usa `useAnimationFrame` do framer-motion. A cada frame:

1. Calcula `cycleT = (elapsed % config.cycle_ms) / config.cycle_ms` → `phase.set(cycleT)`.
2. Para cada `CompiledStep` (máximo `MAX_STEPS = 8`):
   - Determina `t ∈ [0,1]` com base em `delay_ms`, `duration_ms`, `hold_ms` — envelope linear easeInOut com hold no pico.
   - Chama `cs.sample(t)` → pontos deformados.
   - Converte hull para SVG path via `BiometricEngine.toSvgPath`.
   - Atualiza `heatOpacity = intensity * (0.4 + 0.6*t) * (0.7 + 0.3*pulse)` (pulse = sin a 4Hz).
   - Atualiza `heatScale = 1 + 0.15*t`.

### Tipo `ExerciseFrame`

```ts
type ExerciseFrame = {
  step: CompiledStep;
  pathD: MotionValue<string>;       // SVG path da zona deformada
  heatOpacity: MotionValue<number>; // opacidade do heatmap visual
  heatScale: MotionValue<number>;   // escala do heatmap (pulsa)
};
```

**Regra de hooks**: `MotionValue[]` são declarados unrolled (p0–p7, o0–o7, s0–s7) para satisfazer `rules-of-hooks`. Steps além de 8 são ignorados com `console.warn`.

---

## `landmarkToFaceState` (`frontend/src/biometric/landmarkToFaceState.ts`)

Converte o array de 478 landmarks + ângulos de pose para um `Partial<FaceState>` normalizado.

### Normalização base

- **IOD** (inter-ocular distance): `dist(lm[33], lm[263])` em pixels.
- **pxToSvg**: `26 / iod` (SVG face tem IOD ≈ 26 unidades em viewBox de 100px).
- Retorna `{}` se `iod < 1` ou `landmarks.length < 468`.

### Campos mapeados (22 campos)

| Campo FaceState | Landmarks usados | Lógica |
|---|---|---|
| `browLDy` / `browRDy` | 65, 295 | Desvio do brow center vs. altura neutra (18% IOD acima dos olhos). Clamp `[-8, 4]`. |
| `browLRotate` / `browRRotate` | 55→52, 285→282 | Ângulo inner→outer em graus × 0.4. Clamp `[-5, 5]`. |
| `eyeLOpenness` / `eyeROpenness` | 159, 145, 33, 133 / 386, 374, 263, 362 | Razão vertical/horizontal do olho ÷ 0.28 (neutro). Range `[0, 1.8]`. |
| `eyeLDx/Dy` / `eyeRDx/Dy` | 468, 473 (iris refinado) | Deslocamento da íris em relação ao centro da abertura ocular. |
| `jawDy` | 13, 14 | Abertura da boca em SVG units. `min(14, mouthOpenPx * pxToSvg * 0.55)`. |
| `jawDx` | 1, 10, 152 | Desvio lateral do queixo vs. midline (nariz + testa). |
| `jawDz` | 1, 152 (z) | Protuberância do queixo: `(noseTip.z - chin.z) * 5`. Clamp `[-1, 1]`. |
| `mouthScaleX` | 61, 291 | Largura da boca / (55% IOD). |
| `lipCornerLDy` / `lipCornerRDy` | 61, 291 | Altura dos cantos vs. meia boca. |
| `mouthShape` | derivado | `'open'` (jawDy>6), `'pucker'` (mouthScaleX<0.85), `'smile'` (cantos subindo), `'flat'`. |
| `cheekLScale` / `cheekRScale` | 234, 454 | Largura da face / (1.5 × IOD). |
| `noseFlare` | 64, 294 | Largura das alares / (0.30 × IOD). |
| `faceRotate` | `pose.yaw` | Clamp `[-40, 40]`. |
| `faceTilt` | `pose.roll` | Clamp `[-30, 30]`. |
| `facePitch` | `pose.pitch` | Clamp `[-30, 30]`. |

---

## `oneEuroFilter` (`frontend/src/biometric/oneEuroFilter.ts`)

Implementação do **One-Euro Filter** (Casiez et al., 2012) para arrays de pontos N-dimensionais.

### Classe `OneEuroFilterArray`

```ts
new OneEuroFilterArray(count: number, dim?: number, params?: OneEuroParams)
```

| Parâmetro | Default | Efeito |
|---|---|---|
| `mincutoff` | 1.0 Hz | Corta buzz quando cabeça está parada |
| `beta` | 0.05 | Afrouxa cutoff proporcionalmente à velocidade |
| `dcutoff` | 1.0 Hz | Suaviza a estimativa de velocidade |

**Método principal**: `filter(points: number[][], tNow?: number): number[][]`  
Cada componente `(x, y, z)` de cada landmark tem seu próprio estado `LowPassState { hatX, hatDx }`.

**`reset()`**: zera todos os estados (útil em start/stop do exercício).

**Aplicação**: suaviza o array de 478 landmarks × 3 dimensões = 1434 estados de filtro em paralelo.

---

## `anatomicalZones` (`frontend/src/biometric/anatomicalZones.ts`)

### Tipo `ZoneDefinition`

```ts
type ZoneDefinition = {
  indices: ReadonlyArray<number>;         // landmarks da zona
  hull: ReadonlyArray<number>;            // subconjunto convex-hull para render
  centroidLandmark?: number;              // landmark preferido como centroide
  syntheticOffset?: { x: number; y: number; relativeTo?: number }; // zonas cervicais
};
```

### 20 zonas definidas em `ANATOMICAL_ZONES`

| Zona | Índices representativos | Observação |
|---|---|---|
| `frontalis` | 67, 109, 10, 338, 297 | Testa |
| `corrugator` | 9, 8, 168, 6 | Entre sobrancelhas |
| `orbicularis_oculi_l/r` | 33→133 / 263→362 | Anel do olho |
| `temporalis_l/r` | 162, 127, 234, 93, 132 | Têmpora |
| `zygomaticus_l/r` | 205–207, 187 / 425–427, 411 | Maçã do rosto |
| `masseter_l/r` | 172, 136, 150–149, 176, 148 | Mastigação |
| `orbicularis_oris` | 61→291 (16 pts) | Anel da boca |
| `mentalis` | 199, 175, 152 | Queixo |
| `buccinator_l/r` | 138, 215, 192 | Bucinador |
| `tmj_joint_l/r` | 234, 132 / 454, 361 | Articulação têmporo-mandibular |
| `platysma` | synthetic (offset y+0.15 de 152) | Pescoço — fora da malha facial |
| `scm_l/r` | synthetic (offset ±0.12 x de 152) | Esternocleidomastoideo |
| `suboccipital` | synthetic (offset y-0.12 de 10) | Suboccipital |

### 5 pivots em `PIVOT_DEFINITIONS`

| Pivot | Tipo | Referência |
|---|---|---|
| `tmj_l` | landmark | 234 |
| `tmj_r` | landmark | 454 |
| `tmj_center` | midpoint | (234 + 454) / 2 |
| `atlas_c1` | synthetic | y+0.18 de 152 |
| `occipital_c0` | synthetic | y-0.12 de 10 |

**Funções utilitárias**: `resolvePivot(pivot, landmarks): Pt`, `getCentroid(zone, landmarks): Pt`.

---

## `movementVerbs` (`frontend/src/biometric/movementVerbs.ts`)

Define 5 **kernels de deformação** (tipo `Kernel`) e o dispatcher `applyVerb`.

### Kernels

| Verb | Comportamento em `t ∈ [0,1]` |
|---|---|
| `stretch` | Desloca todos os pts na direção `vector * amplitude * t` |
| `compress` | Contrai pts em direção ao centroide com `amplitude * t` |
| `massage_circular` | Rotação circular: `dx = cos(t*2π)*amp`, `dy = sin(t*2π)*amp` |
| `isometric_hold` | Pulso: `sin(t*4π)*amp*0.5` — simula contração isométrica |
| `rotate_around_pivot` | Rotação 2D em torno do pivot por `angleRad * t` |

```ts
type MovementVerb = 'stretch' | 'compress' | 'massage_circular' | 'isometric_hold' | 'rotate_around_pivot';

function applyVerb(
  verb: MovementVerb,
  pts: ReadonlyArray<Pt>,
  ctx: { centroid: Pt; pivot: Pt; vector: Vec2; amplitude: number; angleRad: number },
  t: number,
): Pt[]
```

O switch em `applyVerb` é exaustivo com `never` — erros de tipo são detectados em compile time.

---

## Diagrama de dependências

```
useLiveFaceState
  ├─► mediapipe.worker (Comlink) ← detectVideoLandmarks
  └─► landmarkToFaceState → Partial<FaceState>

useBiometricExercise
  ├─► BiometricEngine.compile(config, landmarks) → CompiledStep[]
  │     ├─► ANATOMICAL_ZONES
  │     ├─► getCentroid / resolvePivot
  │     └─► applyVerb (movementVerbs)
  └─► useAnimationFrame → ExerciseFrame[] (MotionValues)

OneEuroFilterArray  ← (consumido externamente, não dentro dos hooks acima)
normalizeLandmarks  ← projetado para uso em LandmarkRig e scripts Python
```
