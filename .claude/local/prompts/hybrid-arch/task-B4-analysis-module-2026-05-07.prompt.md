---
tenant_id: "face-before-after"
project: "face-before-after"
module: "hybrid-arch/task-B4-analysis-module-2026-05-07.prompt"
file_path: ".claude/prompts/hybrid-arch/task-B4-analysis-module-2026-05-07.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  ---
tags:
  - "task-prompt"
rag_keywords:
  - "analysis"
  - "arch"
  - "hybrid"
  - "module"
  - "prompt"
  - "prompts"
related_modules: []
depends_on: []
used_by: []
---
# Task B4 — AnalysisModule: Quality Gate + EventBus + Pipeline Orquestrado
**Created**: 2026-05-07
**Status**: ✅ CONCLUÍDO
**Stack**: NestJS 11, TypeScript ESM, EventEmitter2

---

## 0. O que foi feito

Implementação do `AnalysisModule` — orquestrador principal que une o quality gate (Module 0) ao full-pipeline, emite eventos DDD e expõe dois endpoints: `POST /v1/analysis` e `POST /v1/analysis/compare`.

---

## 1. Arquivos criados

```
nest/src/modules/analysis/
  analysis.module.ts
  analysis.controller.ts   ← POST /v1/analysis + POST /v1/analysis/compare
  analysis.service.ts      ← orchestração + quality gate + EventEmitter
  dto/
    analysis.dto.ts        ← AnalyzePhotoDto + CompareRunsDto
```

---

## 2. Fluxo `analyze()`

```
POST /v1/analysis
  → AnalysisService.analyze(AnalyzePhotoDto)

  [SE skip_quality_gate === false]
    → PhotoQualityService.validate({ image_base64, session_id })
      → VisionClient.landmarks(...)
    ← PhotoQualityDecisionDto

    SE decision === 'REJECT':
      → emit('photo.quality.rejected', { session_id, grade, recommendations })
      ← throw BadRequestException { code: PHOTO_QUALITY_REJECTED, grade, quality_score, recommendations }

    SE decision !== 'REJECT':
      → emit('photo.quality.accepted', { session_id, grade })

  → VisionClient.fullPipeline({ image_base64, mode, session_id, filename })
  ← FullPipelineResponseDto { run_id, output_dir, photo_url, result }

  → emit('analysis.completed', { session_id, run_id, mode })

  ← AnalysisResultDto { run_id, output_dir, photo_url, result, quality? }
```

---

## 3. Fluxo `compare()`

```
POST /v1/analysis/compare
  → VisionClient.compare({ run_id_before, run_id_after })
  ← delta de métricas
  → emit('analysis.compared', { run_id_before, run_id_after })
  ← resultado
```

---

## 4. Eventos emitidos

| Evento | Payload |
|--------|---------|
| `photo.quality.rejected` | `{ session_id, grade, recommendations }` |
| `photo.quality.accepted` | `{ session_id, grade }` |
| `analysis.completed` | `{ session_id, run_id, mode }` |
| `analysis.compared` | `{ run_id_before, run_id_after }` |

---

## 5. `AnalyzePhotoDto`

```typescript
image_base64:      string     // obrigatório
mode?:             'premium' | 'teaser'  // default 'premium'
session_id?:       string
filename?:         string
skip_quality_gate?: boolean   // default false — NUNCA true em produção
```

---

## 6. Resposta de erro quality gate

```json
{
  "success": false,
  "message": "A foto enviada não atende aos requisitos mínimos de qualidade.",
  "error": {
    "statusCode": 400,
    "code": "PHOTO_QUALITY_REJECTED",
    "metadata": {
      "grade": "REJEITADA",
      "quality_score": 0.12,
      "recommendations": ["Reduza o desfoque..."]
    }
  }
}
```

---

## 7. Verificação

```bash
# Com quality gate (foto boa) → deveria passar
curl -s -X POST http://localhost:9020/v1/analysis \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\",\"mode\":\"premium\"}" \
  | jq '{run_id, "quality.decision": .quality.decision}'

# Com quality gate (foto borrada) → 400
curl -s -X POST http://localhost:9020/v1/analysis \
  -H "Content-Type: application/json" \
  -d '{"image_base64":"iVBORw...","mode":"premium"}' \
  | jq '{success, "code": .error.code}'
# Esperado: success=false, code="PHOTO_QUALITY_REJECTED"

# Skip quality gate (debug)
curl -s -X POST http://localhost:9020/v1/analysis \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\",\"mode\":\"premium\",\"skip_quality_gate\":true}" \
  | jq '.run_id'

# Compare
curl -s -X POST http://localhost:9020/v1/analysis/compare \
  -H "Content-Type: application/json" \
  -d "{\"run_id_before\":\"$RUN1\",\"run_id_after\":\"$RUN2\"}" | jq .
```
