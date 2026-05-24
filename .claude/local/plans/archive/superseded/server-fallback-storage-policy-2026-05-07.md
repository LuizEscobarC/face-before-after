---
tenant_id: "face-before-after"
project: "face-before-after"
module: "superseded/server-fallback-storage-policy-2026-05-07"
file_path: ".claude/plans/archive/superseded/server-fallback-storage-policy-2026-05-07.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Date: 2026-05-07 Model: sonnet Parent plan: agora-vamos-planejar-em-ethereal-thimble.md Prompt 4
tags:
  - "planning"
rag_keywords:
  - "archive"
  - "fallback"
  - "plans"
  - "policy"
  - "server"
  - "storage"
  - "superseded"
related_modules: []
depends_on: []
used_by: []
---
# Plan — Prompt 4: Server-side Fallback + Storage Policy

**Date:** 2026-05-07
**Model:** sonnet
**Parent plan:** `agora-vamos-planejar-em-ethereal-thimble.md` (Prompt 4)

---

## Goal

Implement PhotoStoragePolicy guard (MinIO only with consent), fix `fingerprint_parts` missing from NestJS DTO, add `user_consented` field to ValidatePhotoDto. The fallback flow (server-side landmarks when client WASM fails) is already working — no frontend changes needed.

---

## Pre-flight (already done)

- `processing_mode` propagated through entire stack ✅
- FastAPI `/vision/landmarks` returns `processing_mode: SERVER_FALLBACK` ✅
- Frontend fallback: when `processorRef.current` is null → `onPhotoReady` → parent calls `validatePhotoQuality` → server path ✅
- `PhotoQualityDecisionDto.processing_mode` already present ✅

---

## Actual gap analysis

| Gap | File | Action |
|---|---|---|
| `fingerprint_parts` in frontend type but absent from NestJS DTO | `photo-quality.dto.ts` | Add field |
| No consent signal in request DTO | `photo-quality.dto.ts` ValidatePhotoDto | Add optional `user_consented?: boolean` |
| No storage policy guard | new `photo-storage-policy.ts` | Create class |
| Service doesn't use policy | `photo-quality.service.ts` | Inject + log decision |
| Module doesn't register policy | `photo-quality.module.ts` | Add provider |
| `api.ts` doesn't pass consent | `frontend/src/api.ts` | Add optional `userConsented` param |

---

## Files to CREATE

### 1. `nest/src/modules/photo-quality/photo-storage-policy.ts`

```typescript
import { Injectable } from '@nestjs/common';

interface StorageDecisionInput {
  userConsented: boolean;
  purpose: 'quality-validation' | 'analysis' | 'audit';
}

@Injectable()
export class PhotoStoragePolicy {
  shouldStore({ userConsented, purpose }: StorageDecisionInput): boolean {
    // Raw photo bytes reach MinIO only when user explicitly consented.
    // quality-validation never needs storage (result is a LandmarkPayload, not the image).
    if (purpose === 'quality-validation') return false;
    return userConsented;
  }
}
```

---

## Files to UPDATE

### 2. `nest/src/modules/photo-quality/dto/photo-quality.dto.ts`

- `ValidatePhotoDto` — add `@IsOptional() @IsBoolean() user_consented?: boolean`
- `PhotoQualityDecisionDto` — add `fingerprint_parts!: string[]`

### 3. `nest/src/modules/photo-quality/photo-quality.service.ts`

- Inject `PhotoStoragePolicy`
- Call `this.storagePolicy.shouldStore({ userConsented: payload.user_consented ?? false, purpose: 'quality-validation' })`
- Log the decision alongside existing log line
- Add `fingerprint_parts` to return object

### 4. `nest/src/modules/photo-quality/photo-quality.module.ts`

- Add `PhotoStoragePolicy` to `providers`

### 5. `frontend/src/api.ts`

- `validatePhotoQuality(file, sessionId?, userConsented?)` — add optional third param; include in request body

---

## Execution order

1. Create `photo-storage-policy.ts`
2. Update `photo-quality.dto.ts` (fingerprint_parts + user_consented)
3. Update `photo-quality.service.ts` (inject policy, propagate fingerprint_parts)
4. Update `photo-quality.module.ts` (register provider)
5. Update `frontend/src/api.ts` (add userConsented param)
6. `tsc --noEmit` on nest + frontend

---

## Verification

```bash
# NestJS builds clean
cd nest && npx tsc --noEmit

# Frontend builds clean
cd frontend && npx tsc --noEmit

# E2E: POST /v1/photo-quality/validate with user_consented=false
# → processing_mode: SERVER_FALLBACK in response
# → fingerprint_parts: [...] in response
# → MinIO not written (by policy: purpose=quality-validation always returns false)
```

---

## Recommended Execution Model

- **Model:** sonnet
- **Reason:** 5 small files, additive changes only, no algorithmic risk.
