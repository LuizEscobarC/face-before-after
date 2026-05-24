---
tenant_id: "face-before-after"
project: "face-before-after"
module: "hybrid-arch/task-C1-frontend-2026-05-07.prompt"
file_path: ".claude/prompts/hybrid-arch/task-C1-frontend-2026-05-07.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  ---
tags:
  - "task-prompt"
  - "frontend"
rag_keywords:
  - "arch"
  - "frontend"
  - "hybrid"
  - "prompt"
  - "prompts"
related_modules: []
depends_on: []
used_by: []
---
# Task C1 — Frontend: api.ts + PhotoQualityCard + CapturePage + Vite Proxy
**Created**: 2026-05-07
**Status**: ✅ CONCLUÍDO
**Stack**: React 18, TypeScript, Vite 5, react-router-dom 6

---

## 0. O que foi feito

Repontamento do frontend React para o novo orquestrador NestJS (`/v1/*`). Criação do `api.ts` como camada de abstração HTTP, novo componente `PhotoQualityCard` e atualização do `CapturePage` para validar qualidade antes de prosseguir.

---

## 1. Arquivos modificados/criados

| Arquivo | Ação |
|---------|------|
| `frontend/vite.config.ts` | MODIFICADO — proxy `/v1` → orchestrator + `loadEnv()` |
| `frontend/tsconfig.node.json` | MODIFICADO — adicionado `"types": ["node"]` |
| `frontend/src/api.ts` | CRIADO — funções tipadas para todos os endpoints |
| `frontend/src/components/PhotoQualityCard.tsx` | CRIADO — card com score circular + subscores + recomendações |
| `frontend/src/pages/CapturePage.tsx` | MODIFICADO — gate Module 0 antes do submit |

---

## 2. `vite.config.ts` — fix crítico

**Problema**: `process.env` causava `TS2580: Cannot find name 'process'` no tsconfig estrito.

**Solução**:
```typescript
/// <reference types="node" />
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/v1": { target: env.VITE_ORCHESTRATOR_URL ?? "http://localhost:9020", changeOrigin: true },
        "/api": { target: env.VITE_LEGACY_API_URL  ?? "http://localhost:9015", changeOrigin: true },
      },
    },
  };
});
```

- `/// <reference types="node" />` resolve TS2580
- `loadEnv()` com env var `VITE_ORCHESTRATOR_URL` para configuração por ambiente
- `"types": ["node"]` em `tsconfig.node.json`

---

## 3. `api.ts` — funções exportadas

```typescript
// Tipos principais
export type PhotoQualityDecision = {
  decision: "ACCEPT" | "WARN" | "REJECT";
  grade: "ALTA" | "MEDIA" | "BAIXA" | "REJEITADA";
  quality_score: number;
  recommendations: string[];
  fingerprint: string;
  subscore_breakdown: Record<string, number>;
  flags: Record<string, boolean>;
  pose: { yaw: number; pitch: number; roll: number };
  sharpness_score: number;
  lighting_asymmetry: number;
  session_id: string;
  processing_mode: string;
}

// Funções
validatePhotoQuality(file: File, sessionId?: string): Promise<PhotoQualityDecision>
  → POST /v1/photo-quality/validate

fetchCaptureGuidelines(): Promise<CaptureGuidelines>
  → GET /v1/vision/capture-guidelines

analyzePhoto(mode: AnalyzeMode, file: File): Promise<AnalysisResult>
  → POST /v1/analysis { image_base64, mode, skip_quality_gate: true }

compareRuns(runBefore: string, runAfter: string): Promise<CompareResult>
  → POST /v1/analysis/compare

fetchGlossary(): Promise<{}>
  → retorna {} (não migrado ainda)
```

---

## 4. `PhotoQualityCard.tsx`

Props: `{ decision: PhotoQualityDecision, onContinue?, onRetake? }`

Seções:
- **Header**: badge decision (ACCEPT=cyan, WARN=âmbar, REJECT=vermelho) + grade label + score circular `conic-gradient`
- **Recommendations**: lista de dicas em pt-BR (quando `recommendations.length > 0`)
- **Subscores grid**: 5 tiles (Pose, Nitidez, Iluminação, Oclusão, Expressão) — valor numérico 0–100
- **Footer**: botão "Refazer captura" (sempre) + botão "Continuar análise" (apenas se `decision !== 'REJECT'`)

Paleta de cores por decision:
```typescript
ACCEPT → fg: "#67e8f9", bg: "rgba(34,211,238,0.12)"   // cyan
WARN   → fg: "#fcd34d", bg: "rgba(252,211,77,0.12)"   // âmbar
REJECT → fg: "#fca5a5", bg: "rgba(252,165,165,0.12)"  // vermelho
```

---

## 5. `CapturePage.tsx` — fluxo atualizado

```
1. Usuário seleciona foto → handlePhotoReady(file)
2. POST /v1/photo-quality/validate → setQuality(decision)
3. SE decision === 'REJECT' → setError(...) + exibir PhotoQualityCard com onRetake
4. SE decision !== 'REJECT' → exibir PhotoQualityCard com onContinue
5. submit():
   - SE mode === 'compare': analisar fileBefore + fileAfter → compareRuns → navigate('/resultado/compare')
   - SE quality?.decision === 'REJECT' → bloquear submit
   - Senão: analyzePhoto(mode, file) → navigate('/resultado/...')
```

---

## 6. Verificação

```bash
# Dev local
cd frontend && npm run dev
# Acessar http://localhost:5173

# Build para produção
cd frontend && npm run build

# TypeScript check
cd frontend && npx tsc --noEmit

# Proxy funcionando (dev server):
curl http://localhost:5173/v1/vision/capture-guidelines
# → deve proxy para http://localhost:9020/v1/vision/capture-guidelines
```
