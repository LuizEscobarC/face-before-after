---
tenant_id: "face-before-after"
project: "face-before-after"
module: "hybrid-arch/task-B5-ddd-stubs-2026-05-07.prompt"
file_path: ".claude/prompts/hybrid-arch/task-B5-ddd-stubs-2026-05-07.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  ---
tags:
  - "task-prompt"
rag_keywords:
  - "arch"
  - "hybrid"
  - "prompt"
  - "prompts"
  - "stubs"
related_modules: []
depends_on: []
used_by: []
---
# Task B5 — DDD Stubs: Diagnosis / Decision / Execution / Tracking / Identity
**Created**: 2026-05-07
**Status**: ✅ CONCLUÍDO (stubs) — E4 implementa DiagnosisService real
**Stack**: NestJS 11, TypeScript ESM, EventEmitter2

---

## 0. O que foi feito

Criação dos módulos DDD restantes como stubs que escutam eventos do `EventBus` e logam debug. Eles completam a árvore de módulos do `AppModule` sem lançar erros, garantindo que a arquitetura esteja no lugar antes de qualquer implementação real.

---

## 1. Módulos criados

### `DiagnosisModule` (diagnosis)
**Evento ouvido**: `analysis.completed`
**Futuro (E4)**: DiagnoseFaceUseCase → `DiagnosisReport` (top-3 concerns + summary)

```typescript
@OnEvent('analysis.completed')
onAnalysisCompleted(payload: unknown): void {
  this.logger.debug(`(stub) diagnosing analysis: ${JSON.stringify(payload)}`);
}
```

### `DecisionModule` (decision)
**Evento ouvido**: `analysis.compared`
**Futuro**: `PrioritizeImprovementsUseCase` — top_leverage.py → recomendações de tratamento

```typescript
@OnEvent('analysis.compared')
onCompared(payload: unknown): void {
  this.logger.debug(`(stub) deciding next steps: ${JSON.stringify(payload)}`);
}
```

### `ExecutionModule` (execution)
**Sem listeners** — stub vazio.
**Futuro**: `GenerateReportUseCase` (HTML/PDF + MinIO upload), `SendReportEmailUseCase`

### `TrackingModule` (tracking)
**Eventos ouvidos**: `photo.quality.rejected`, `photo.quality.accepted`, `analysis.completed`
**Futuro**: persiste eventos em storage para analytics; registra fingerprint vs grade ao longo do tempo

```typescript
@OnEvent('photo.quality.rejected')  → track rejection
@OnEvent('photo.quality.accepted')  → track acceptance
@OnEvent('analysis.completed')      → track completion
```

### `IdentityModule` (identity)
**Sem listeners** — stub vazio.
**Futuro**: `SessionAggregate`, `SessionRepository`, JWT guards

---

## 2. Registro em `AppModule`

Todos importados em `app.module.ts`:
```typescript
imports: [
  EventEmitterModule.forRoot({ wildcard: true }),
  LoggerModule, HealthModule, VisionModule,
  PhotoQualityModule, AnalysisModule,
  DiagnosisModule, DecisionModule, ExecutionModule, TrackingModule, IdentityModule,
]
```

---

## 3. EventBus — mapa completo de eventos

| Evento | Emitido por | Ouvido por |
|--------|-------------|------------|
| `photo.quality.rejected` | AnalysisService | TrackingModule |
| `photo.quality.accepted` | AnalysisService | TrackingModule |
| `analysis.completed` | AnalysisService | DiagnosisModule, TrackingModule |
| `analysis.compared` | AnalysisService | DecisionModule |
| `diagnosis.completed` | DiagnosisService (E4) | — (DecisionModule futuro) |

---

## 4. Verificação

```bash
# Todos módulos sobem sem erro
docker compose up -d orchestrator
docker compose logs orchestrator | grep -E "(Starting|Listening|ERROR)"

# Eventos logados (debug level — pode precisar LOG_LEVEL=debug)
docker compose logs orchestrator | grep "stub"
# Após POST /v1/analysis, deve ver: "(stub) diagnosing analysis: ..."
```
