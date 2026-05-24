---
tenant_id: "face-before-after"
project: "face-before-after"
module: "hybrid-arch/task-E4-diagnosis-module-2026-05-07.prompt"
file_path: ".claude/prompts/hybrid-arch/task-E4-diagnosis-module-2026-05-07.prompt.md"
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
  - "diagnosis"
  - "hybrid"
  - "module"
  - "prompt"
  - "prompts"
related_modules: []
depends_on: []
used_by: []
---
# Task E4 — DiagnosisModule: Lógica Real + DiagnosisReport
**Created**: 2026-05-07
**Stack**: NestJS 11, TypeScript ESM, EventEmitter2
**Depende de**: nada (events `analysis.completed` já são emitidos por `AnalysisService`)
**Status**: ✅ IMPLEMENTADO

---

## 0. Contexto

O `DiagnosisModule` existe como stub em um único arquivo (`diagnosis.module.ts`):

```typescript
// Atual — tudo em diagnosis.module.ts (stub)
@Injectable()
class DiagnosisListener {
  @OnEvent('analysis.completed')
  onAnalysisCompleted(payload: unknown): void {
    this.logger.debug(`(stub) diagnosing analysis: ${JSON.stringify(payload)}`);
  }
}
```

O `AnalysisService.analyze()` emite:
```typescript
this.events.emit('analysis.completed', {
  session_id: payload.session_id,
  run_id: pipelineResponse.run_id,
  mode: payload.mode ?? 'premium',
});
```

O payload do evento **não inclui** os `metrics` diretamente — `pipelineResponse.result` contém o JSON completo do Python pipeline, que inclui um campo `metrics` (array de objetos com `metric_id`, `score`, `region`, `direction`, etc.).

---

## 1. Arquivos a Criar / Modificar

| Arquivo | Ação |
|---------|------|
| `nest/src/modules/diagnosis/diagnosis.module.ts` | Refatorar: mover listener para service próprio, adicionar controller |
| `nest/src/modules/diagnosis/diagnosis.service.ts` | CRIAR — lógica real: top-3 concerns + DiagnosisReport |
| `nest/src/modules/diagnosis/diagnosis.controller.ts` | CRIAR — `GET /v1/diagnosis/:runId` |
| `nest/src/modules/analysis/analysis.service.ts` | Emitir `pipelineResponse.result` junto no evento |

---

## 2. Implementação

### 2.1 Enriquecer evento em `analysis.service.ts`

Para que `DiagnosisService` acesse os metrics sem re-chamar a vision-service, passar o `result` no evento:

```typescript
// Antes
this.events.emit('analysis.completed', {
  session_id: payload.session_id,
  run_id: pipelineResponse.run_id,
  mode: payload.mode ?? 'premium',
});

// Depois
this.events.emit('analysis.completed', {
  session_id: payload.session_id,
  run_id: pipelineResponse.run_id,
  mode: payload.mode ?? 'premium',
  result: pipelineResponse.result,   // ← adicionar
});
```

### 2.2 `diagnosis.service.ts` (CRIAR)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface MetricItem {
  metric_id: string;
  score: number;
  region: string;
  direction?: string;
  confidence?: number;
}

export interface DiagnosisReport {
  run_id: string;
  session_id?: string;
  top_concerns: Array<{ metric_id: string; score: number; region: string }>;
  summary: string;
  timestamp: string;
}

@Injectable()
export class DiagnosisService {
  private readonly logger = new Logger(DiagnosisService.name);
  private readonly reports = new Map<string, DiagnosisReport>();

  constructor(private readonly events: EventEmitter2) {}

  @OnEvent('analysis.completed')
  handleAnalysisCompleted(payload: {
    session_id?: string;
    run_id: string;
    mode: string;
    result?: Record<string, unknown>;
  }): void {
    const { run_id, session_id, result } = payload;

    const metrics = this._extractMetrics(result);
    if (metrics.length === 0) {
      this.logger.debug(`diagnosis skipped for run_id=${run_id} — no metrics in result`);
      return;
    }

    const top_concerns = this._topConcerns(metrics);
    const summary = this._buildSummary(top_concerns);

    const report: DiagnosisReport = {
      run_id,
      session_id,
      top_concerns,
      summary,
      timestamp: new Date().toISOString(),
    };

    this.reports.set(run_id, report);
    this.events.emit('diagnosis.completed', report);

    this.logger.log(`diagnosis run_id=${run_id} top=${top_concerns.map((c) => c.metric_id).join(',')}`);
  }

  getReport(run_id: string): DiagnosisReport | null {
    return this.reports.get(run_id) ?? null;
  }

  // --------------------------------------------------------------------------

  private _extractMetrics(result?: Record<string, unknown>): MetricItem[] {
    if (!result) return [];
    const raw = result['metrics'];
    if (!Array.isArray(raw)) return [];
    return (raw as unknown[])
      .filter((m): m is MetricItem =>
        typeof m === 'object' &&
        m !== null &&
        'metric_id' in m &&
        'score' in m &&
        'region' in m,
      )
      .map((m) => ({
        metric_id: String(m.metric_id),
        score: Number(m.score),
        region: String(m.region),
        direction: m.direction ? String(m.direction) : undefined,
        confidence: m.confidence !== undefined ? Number(m.confidence) : undefined,
      }));
  }

  private _topConcerns(metrics: MetricItem[], n = 3) {
    return [...metrics]
      .sort((a, b) => a.score - b.score)
      .slice(0, n)
      .map(({ metric_id, score, region }) => ({ metric_id, score, region }));
  }

  private _buildSummary(concerns: Array<{ metric_id: string; score: number; region: string }>): string {
    if (concerns.length === 0) return 'Nenhuma preocupação identificada.';

    const regionMap: Record<string, string> = {
      jaw: 'mandíbula',
      eye: 'orbital',
      brow: 'supraciliar',
      nose: 'nasal',
      mouth: 'labial',
      face: 'facial',
    };

    const regionLabels = [...new Set(concerns.map((c) => regionMap[c.region] ?? c.region))];
    const worstScore = concerns[0].score;

    const severity =
      worstScore < 0.4 ? 'significativa' : worstScore < 0.65 ? 'moderada' : 'leve';

    const regionText =
      regionLabels.length === 1
        ? `região ${regionLabels[0]}`
        : `regiões ${regionLabels.slice(0, -1).join(', ')} e ${regionLabels[regionLabels.length - 1]}`;

    return `Assimetria ${severity} detectada na ${regionText}.`;
  }
}
```

### 2.3 `diagnosis.controller.ts` (CRIAR)

```typescript
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DiagnosisService } from './diagnosis.service.js';

@ApiTags('diagnosis')
@Controller('v1/diagnosis')
export class DiagnosisController {
  constructor(private readonly diagnosis: DiagnosisService) {}

  @Get(':runId')
  @ApiOperation({ summary: 'Retorna DiagnosisReport de um run' })
  @ApiParam({ name: 'runId', type: String })
  getReport(@Param('runId') runId: string) {
    const report = this.diagnosis.getReport(runId);
    if (!report) {
      throw new NotFoundException(`Diagnóstico não encontrado para run_id=${runId}`);
    }
    return report;
  }
}
```

### 2.4 Refatorar `diagnosis.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DiagnosisService } from './diagnosis.service.js';
import { DiagnosisController } from './diagnosis.controller.js';

@Module({
  providers: [DiagnosisService],
  controllers: [DiagnosisController],
  exports: [DiagnosisService],
})
export class DiagnosisModule {}
```

---

## 3. Regras de Negócio

- `top_concerns` ordena por `score` **crescente** — menor score = maior preocupação
- `summary` em pt-BR — será exibida no frontend
- Persiste em `Map<run_id, DiagnosisReport>` em memória — sem banco de dados por ora
- Se o evento chega sem `result` ou sem `metrics`, logar e ignorar (não lançar erro)
- Após emitir `diagnosis.completed`, o `DecisionModule` pode reagir (já está com stub em `@OnEvent`)

---

## 4. Verificação

```bash
# Rebuild orchestrator
just nest-docker-build && docker compose up -d orchestrator

# Rodar análise e capturar run_id
RUN_ID=$(curl -s -X POST http://localhost:9020/v1/analysis \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\",\"mode\":\"premium\",\"skip_quality_gate\":true}" \
  | jq -r '.run_id')
echo "run_id=$RUN_ID"

# Consultar DiagnosisReport
curl -s http://localhost:9020/v1/diagnosis/$RUN_ID | jq .
# Esperado:
# {
#   "run_id": "...",
#   "top_concerns": [{"metric_id":"...","score":0.42,"region":"jaw"}, ...],
#   "summary": "Assimetria moderada detectada na região mandíbula e nasal.",
#   "timestamp": "2026-05-07T..."
# }

# Se run_id não existir ainda:
curl -s http://localhost:9020/v1/diagnosis/nao-existe | jq .
# Esperado: 404 com mensagem

# TypeScript build clean
cd nest && npm run build
```

---

## 5. Checklist

- [x] `diagnosis.service.ts` criado com `handleAnalysisCompleted()` + `getReport()`
- [x] `diagnosis.controller.ts` criado com `GET /v1/diagnosis/:runId`
- [x] `diagnosis.module.ts` refatorado para usar os arquivos separados
- [x] `analysis.service.ts` passa `result: pipelineResponse.result` no evento `analysis.completed`
- [x] `DiagnosisReport` retornado com `top_concerns` (top 3), `summary` em pt-BR, `timestamp`
- [x] `GET /v1/diagnosis/:runId` retorna 404 quando não encontrado
- [x] TypeScript compila sem erros
- [ ] `diagnosis.completed` emitido após report gerado (para DecisionModule reagir)
