# Task B3 — PhotoQualityModule: POST /v1/photo-quality/validate
**Created**: 2026-05-07
**Status**: ✅ CONCLUÍDO
**Stack**: NestJS 11, TypeScript ESM

---

## 0. O que foi feito

Implementação do `PhotoQualityModule` — gate Module 0 exposto como endpoint NestJS. Recebe uma imagem base64, chama `/vision/landmarks` na vision-service e mapeia o grade retornado para uma decisão `ACCEPT | WARN | REJECT`.

---

## 1. Arquivos criados

```
nest/src/modules/photo-quality/
  photo-quality.module.ts
  photo-quality.controller.ts   ← POST /v1/photo-quality/validate
  photo-quality.service.ts      ← orquestra VisionClient + mapeamento grade→decision
  dto/
    photo-quality.dto.ts        ← ValidatePhotoDto + PhotoQualityDecisionDto
```

---

## 2. Lógica de decisão

```typescript
private gradeToDecision(grade): 'ACCEPT' | 'WARN' | 'REJECT' {
  switch (grade) {
    case 'ALTA':      return 'ACCEPT';
    case 'MEDIA':     return 'WARN';
    case 'BAIXA':
    case 'REJEITADA': return 'REJECT';
  }
}
```

---

## 3. `PhotoQualityDecisionDto` — campos retornados

```typescript
{
  decision:          'ACCEPT' | 'WARN' | 'REJECT'
  grade:             'ALTA' | 'MEDIA' | 'BAIXA' | 'REJEITADA'
  quality_score:     number
  recommendations:   string[]
  fingerprint:       string
  subscore_breakdown: Record<string, number>
  flags:             Record<string, boolean>
  pose:              { yaw: number; pitch: number; roll: number }
  sharpness_score:   number
  lighting_asymmetry: number
  session_id:        string
  processing_mode:   string
}
```

---

## 4. Fluxo

```
POST /v1/photo-quality/validate
  → PhotoQualityService.validate()
    → VisionClient.landmarks({ image_base64, session_id? })
      → POST http://vision-service:8000/vision/landmarks
    ← LandmarkResponseDto
  → gradeToDecision(quality_grade) → decision
  ← PhotoQualityDecisionDto (200)
```

O serviço usa `VisionClient` injetado do `VisionModule` (que é exportado via `exports: [VisionClient]`).

---

## 5. Verificação

```bash
# Validar foto real
curl -s -X POST http://localhost:9020/v1/photo-quality/validate \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\"}" \
  | jq '{decision, grade, quality_score, recommendations}'

# Esperado: decision em {ACCEPT, WARN, REJECT}; grade de ALTA a REJEITADA

# Foto sem rosto → REJECT
curl -s -X POST http://localhost:9020/v1/photo-quality/validate \
  -H "Content-Type: application/json" \
  -d '{"image_base64":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="}' \
  | jq '{decision, grade}'
# Esperado: {decision: "REJECT", grade: "REJEITADA"}
```
