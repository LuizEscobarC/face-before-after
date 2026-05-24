---
tenant_id: "face-before-after"
project: "face-before-after"
module: "superseded/client-side-mediapipe-landmark-payload-2026-05-07"
file_path: ".claude/plans/archive/superseded/client-side-mediapipe-landmark-payload-2026-05-07.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Date: 2026-05-07 Model: sonnet Parent plan: agora-vamos-planejar-em-ethereal-thimble.md Prompt 3
tags:
  - "planning"
  - "landmark"
rag_keywords:
  - "MediaPipe FaceMesh"
  - "archive"
  - "client"
  - "dlib 68 landmarks"
  - "landmark"
  - "mediapipe"
  - "payload"
  - "plans"
  - "side"
  - "superseded"
related_modules: []
depends_on: []
used_by: []
---
# Plan — Prompt 3: Client-side MediaPipe Tasks Vision + LandmarkPayload

**Date:** 2026-05-07
**Model:** sonnet
**Parent plan:** `agora-vamos-planejar-em-ethereal-thimble.md` (Prompt 3)

---

## Goal

Process facial landmarks in the browser via `@mediapipe/tasks-vision` (FaceLandmarker, Web Worker via comlink), send a `LandmarkPayload` to NestJS, which forwards to FastAPI `/vision/metrics` without calling `/vision/landmarks`. Server-side detection is skipped when a valid client payload is received.

---

## Pre-flight (already validated)

- `face_landmarker.task` model already exists server-side — same model can be served as static asset for frontend.
- FastAPI `/vision/metrics` endpoint exists and accepts `landmarks: number[][]` (MetricsRequestDto).
- NestJS `VisionClient` already has `metrics()` method calling FastAPI `/vision/metrics`.
- `processing_mode` field already propagated in `LandmarkPayload` schema and all DTOs.

---

## Architecture

```
Browser
  └─ CaptureSourceTabs (user clicks "capture")
       ├─ DeviceCapabilityDetector.supportsWASM() → true/false
       └─ ClientPhotoProcessor (Web Worker via comlink)
            ├─ validateRealtimeFeedback() — runningMode VIDEO, N frames, pose+light only
            └─ runMediaPipe() — single-shot IMAGE mode, full 478 landmarks
                 └─ returns LandmarkPayload {landmarks, pose, processing_mode: CLIENT_SIDE}

Frontend api.ts
  └─ submitLandmarkPayload(payload) → POST /v1/vision/submit-landmarks

NestJS VisionController
  └─ POST /v1/vision/submit-landmarks
       └─ VisionClient.submitLandmarks(payload) → POST /vision/metrics (FastAPI)

FastAPI /vision/metrics
  └─ accepts ClientLandmarkPayloadDto (landmarks + quality_context)
       └─ returns MetricsResponseDto
```

---

## Files to CREATE

### 1. `frontend/src/vision/DeviceCapabilityDetector.ts`

```typescript
export class DeviceCapabilityDetector {
  static supportsWASM(): boolean
  static async meetsPerformanceThreshold(): Promise<boolean>  // 1-frame benchmark <200ms
  static async shouldFallback(): Promise<boolean>  // !supportsWASM || !meetsPerformance
}
```

### 2. `frontend/src/vision/mediapipe.worker.ts`

Web Worker file (loaded via comlink). Contains the actual MediaPipe initialization and detection calls. Never imported directly by React components — only accessed via comlink proxy.

```typescript
// Exposed via comlink:
export async function initialize(modelUrl: string): Promise<void>
export async function detectLandmarks(imageData: ImageData): Promise<LandmarkPayload | null>
export async function startVideoFeedback(imageData: ImageData): Promise<FeedbackResult | null>
```

### 3. `frontend/src/vision/ClientPhotoProcessor.ts`

Main facade, used by React components:

```typescript
export class ClientPhotoProcessor {
  private worker: Remote<typeof import('./mediapipe.worker')>

  static async create(): Promise<ClientPhotoProcessor>
  async runMediaPipe(canvas: HTMLCanvasElement): Promise<LandmarkPayload | null>
  async validateRealtimeFeedback(imageData: ImageData): Promise<FeedbackResult | null>
  dispose(): void
}

export type LandmarkPayload = {
  landmarks: number[][]  // 478 × 2
  pose: { yaw: number; pitch: number; roll: number }
  processing_mode: 'CLIENT_SIDE'
}

export type FeedbackResult = {
  face_detected: boolean
  pose_ok: boolean
  light_ok: boolean
}
```

### 4. `nest/src/modules/vision/dto/client-landmark-payload.dto.ts`

```typescript
export class ClientLandmarkPayloadDto {
  @IsArray() landmarks: number[][]
  @IsObject() pose: { yaw: number; pitch: number; roll: number }
  @IsString() processing_mode: 'CLIENT_SIDE'
  @IsOptional() @IsString() session_id?: string
}
```

---

## Files to UPDATE

### 5. `frontend/package.json`

Add:
- `@mediapipe/tasks-vision: ^0.10.18`
- `comlink: ^4.4`

### 6. `frontend/src/api.ts`

Add `submitLandmarkPayload(payload: LandmarkPayload): Promise<PhotoQualityDecision>` — POST to `/v1/vision/submit-landmarks`.

### 7. `frontend/src/types.ts`

Add `LandmarkPayload` and `FeedbackResult` types (re-exported from api.ts or duplicated for UI layer).

### 8. `frontend/src/components/CaptureSourceTabs.tsx`

On capture (both webcam and upload):
1. Call `DeviceCapabilityDetector.shouldFallback()`.
2. If false: run `ClientPhotoProcessor.runMediaPipe(canvas)`, call `submitLandmarkPayload()`.
3. If true: pass file directly to existing `onPhotoReady()` (Prompt 4 fallback handles the rest).
4. Show real-time feedback ring (green/red) during video mode from `validateRealtimeFeedback()`.

### 9. `nest/src/modules/vision/vision.controller.ts`

Add:
```typescript
@Post('submit-landmarks')
@HttpCode(200)
submitLandmarks(@Body() body: ClientLandmarkPayloadDto): Promise<MetricsResponseDto>
```

### 10. `nest/src/modules/vision/vision.client.ts`

Add:
```typescript
submitLandmarks(payload: ClientLandmarkPayloadDto): Promise<MetricsResponseDto>
```
Calls FastAPI `POST /vision/metrics` with `{ landmarks: payload.landmarks, quality_context: { quality_score: 1.0, regional_penalties: {} }, session_id: payload.session_id }`.

---

## Files to ADD (assets)

### 11. `frontend/public/models/face_landmarker.task`

Copy from `backend/models/face_landmarker.task` — served as static asset, NOT fetched from Google CDN.

Add `Dockerfile.frontend` / `docker-compose.yml` note: COPY the model file during build if needed.

---

## Critical constraints

- **Video feedback (real-time):** `RunningMode.VIDEO`, only pose angle + rough face box computed — NO full 478-point mesh.
- **Capture:** `RunningMode.IMAGE`, full 478-point detection once.
- **Model URL:** Always `window.location.origin + '/models/face_landmarker.task'` — no external CDN.
- **Worker:** Use `new Worker(new URL('./mediapipe.worker.ts', import.meta.url))` (Vite native worker syntax) wrapped with comlink.
- **`processing_mode: 'CLIENT_SIDE'`** must be present in every payload sent to NestJS.
- **Fallback:** When `shouldFallback() === true`, component falls back to existing server-side path (Prompt 4 will handle gracefully).

---

## Execution order

1. Add `@mediapipe/tasks-vision` and `comlink` to `frontend/package.json`.
2. Copy `face_landmarker.task` to `frontend/public/models/`.
3. Create `DeviceCapabilityDetector.ts`.
4. Create `mediapipe.worker.ts`.
5. Create `ClientPhotoProcessor.ts`.
6. Update `frontend/src/api.ts` — add `submitLandmarkPayload()`.
7. Update `frontend/src/types.ts` — add types.
8. Update `CaptureSourceTabs.tsx` — integrate processor.
9. Create NestJS DTO `client-landmark-payload.dto.ts`.
10. Update `vision.client.ts` — add `submitLandmarks()`.
11. Update `vision.controller.ts` — add `POST submit-landmarks` endpoint.

---

## Verification

```bash
# Frontend build passes (TypeScript + Vite)
cd frontend && npm install && npm run build

# NestJS compiles
cd nest && npm run build

# E2E: open browser, capture photo → Network tab shows POST /v1/vision/submit-landmarks
# Response has processing_mode: CLIENT_SIDE (not SERVER_FALLBACK)

# Fallback smoke: disable WASM in Chrome (--js-flags="--noexpose-wasm")
# → payload has image_base64 (Prompt 4 path, currently passes through onPhotoReady)
```

---

## Recommended Execution Model

- **Model:** sonnet
- **Reason:** Well-scoped TypeScript feature across 3 layers (React + NestJS + minimal FastAPI change). No algorithmic ambiguity. Comlink Web Worker pattern is standard. No metric calculation risk. Sonnet handles it accurately.
