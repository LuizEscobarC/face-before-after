# Plano Refator: Centralizar Backend Data para Overlays

**Data:** 2026-05-12  
**Objetivo:** Harmonizar os 3 padrões de overlay — migrar IdealProportionsLayer (1) e MetricsMapLayer (2) para o padrão 3 (OverlaySidebar), onde backend emite dados JSON puro e frontend renderiza.

---

## Executive Summary

| Padrão | Componente | Backend Output | Frontend Consumo | Status | Refator |
|--------|-----------|---|---|---|---|
| **3 (Ideal)** | OverlaySidebar | JSON estruturado (`overlay_annotations.*`) | React components + CSS | ✅ Working | — |
| **1 (Problema)** | IdealProportionsLayer | PNG com texto queimado | Exibe imagem | ❌ Subótimo | Migrar para Padrão 3 |
| **2 (Problema)** | MetricsMapLayer | Nenhum (usa hardcode) | Hardcoded REGION_BOUNDS + SVG | ⚠️ Frágil | Migrar para Padrão 3 |

---

## Deep Dive: Os 3 Padrões

### Padrão 3 — OverlaySidebar (ATUAL IDEAL ✅)

**Backend Pipeline:**
```python
# pipeline.py L1420–1450
result['overlay_annotations'] = {
    'grid_thirds': build_grid_thirds_annotations(landmarks, metrics),    # → {rows: [...]}
    'grid_fifths': build_grid_fifths_annotations(landmarks),             # → {rows: [...]}
    'face_extents': build_face_extents_annotations(landmarks, metrics),  # → {trichion, menton, h, w}
    'ideal_proportions': [                                               # → [metric_id, value, severity, direction]
        {metric_id, value, severity_5, direction}
        for metric in metrics if metric_id in {...}
    ],
}
```

**Backend Functions:**
- `build_grid_thirds_annotations()` — calcula terços ideais vs reais, retorna labels
- `build_grid_fifths_annotations()` — calcula desvios dos quintos, retorna labels  
- `build_face_extents_annotations()` — calcula altura/largura facial, retorna labels
- Todas em `backend/app/services/overlays/annotations.py`

**Frontend Consumo:**
```tsx
// OverlaySidebar.tsx
export function OverlaySidebar({ variant, data, ... }) {
  switch (variant) {
    case "grid_thirds": return renderGridThirds(data.grid_thirds);
    case "ideal_proportions": return renderIdealProportions(data.ideal_proportions, ...);
    // Etc.
  }
}
```

**Responsabilidade:**
- Backend: Calcula geometria, emite JSON com labels + valores + severidades
- Frontend: Renderiza React components com styling CSS (MVP Design System)
- Resultado: Tipografia nítida, fácil manutenção, design changes sem backend

---

### Padrão 1 — IdealProportionsLayer (ATUAL PROBLEMÁTICO ❌)

**Backend Pipeline:**
```python
# pipeline.py L402 → simulate.py
img_prop = annotate_ideal_proportions(frame, landmarks, ...)  # Renderiza linhas + TEXTOS na PNG
path_prop = os.path.join(output_dir, f"{base}_ideal_proportions.jpg")
cv2.imwrite(path_prop, img_prop)  # Salva PNG com burning-in

result['simulation_paths']['ideal_proportions'] = path_prop
```

**Backend Function:**
- `annotate_ideal_proportions()` em `simulate.py` — desenha zonas + **escreve texto com OpenCV** (cv2.putText)
- Emite PNG renderizada

**Frontend Consumo:**
```tsx
// IdealProportionsLayer.tsx
return (
  <svg>
    {/* Desenha zonas em SVG */}
    {ZONES.map(zone => (
      <rect x={zone.x} y={zone.y} width={zone.width} height={zone.height} ... />
    ))}
  </svg>
);
// E SEPARADAMENTE:
// HTTP GET /v1/vision/results/{run_id}/simulation/ideal_proportions → PNG
// <img src="..." /> // Exibe PNG com texto queimado sobreposto
```

**Problema:**
- 🔴 Texto na PNG = qualidade tipográfica ruim, não escalável, não curável
- 🔴 Backend renderiza imagem; deve apenas fornecer dados
- 🔴 SVG + PNG sobrepostos = duplicação (zona está no SVG E na PNG)
- 🔴 Labels hardcoded em `simulate.py`; mudança exige recompile backend

---

### Padrão 2 — MetricsMapLayer (ATUAL PROBLEMÁTICO ❌)

**Backend Pipeline:**
- Emite `region_adherence[]` array com `{region, adherence, confidence}` ✅
- Nada mais

**Frontend Consumo:**
```tsx
// MetricsMapLayer.tsx
const REGION_BOUNDS: Record<string, RegionBounds> = {
  FOREHEAD: { x: 250, y: 80, width: 700, height: 150 },  // HARDCODED
  EYES: { x: 300, y: 210, width: 600, height: 120 },
  NOSE: { x: 450, y: 310, width: 300, height: 140 },
  MOUTH: { x: 380, y: 450, width: 440, height: 110 },
  JAW: { x: 220, y: 530, width: 760, height: 180 },
};

// Renderiza SVG rects com hardcoded bounds
{Object.entries(REGION_BOUNDS).map(([region, bounds]) => (
  <rect x={bounds.x} y={bounds.y} width={bounds.width} height={bounds.height} ... />
))}
```

**Problema:**
- 🔴 REGION_BOUNDS hardcoded no frontend → frágil
- 🔴 Não rescala com canonical image dimensions
- 🔴 Backend conhece geometria mas não compartilha
- 🔴 Mudança de layout exige code change + rebuild frontend

---

## Refator Plan

### Objetivo Geral

Converter Padrões 1 e 2 → Padrão 3:
- Backend: Emite JSON com dados + metadados (sem PNG rendering)
- Frontend: Consome JSON, renderiza SVG + React labels
- Result: Single source of truth (backend) + clean frontend rendering

---

## PLAN A: Custo Baixo (1 Plano Integrado)

Se o esforço for **≤ 8h total**, agrupar tudo num **único plano**:

### PLAN_A.1: Backend Data Layer (2h)

**Descrição:**
Estender `backend/app/services/overlays/annotations.py` para incluir metadados de regiões.

**Tarefas:**
1. [ ] Criar `build_ideal_proportions_zones()` que calcula bounds dinâmicos
   - Input: `landmarks[]`, `metric_evaluations[]`
   - Output: `{zones: [{metric_id, zone_rect: {x, y, w, h}, severity_5, direction}, ...]}`
   - Lógica: Usar landmarks para forehead_ridge, brow, subnasale, menton (já existe em IdealProportionsLayer.tsx)
   - Reuse: Copiar `createAnatomicalZones()` de frontend para backend (converter para Python)

2. [ ] Criar `build_metrics_map_metadata()` que calcula REGION_BOUNDS dinâmicamente
   - Input: `metric_evaluations[]`, `region_adherence[]`, `landmarks[]`
   - Output: `{regions: [{region, bounds: {x, y, w, h}, adherence, confidence}, ...]}`
   - Lógica: Agrupar `metric_evaluations` por `region`, calcular bounding box (min/max x/y das métricas)

3. [ ] Atualizar `pipeline.py` linha 1429+ para incluir:
   ```python
   result['overlay_annotations']['ideal_proportions_zones'] = build_ideal_proportions_zones(...)
   result['overlay_annotations']['metrics_map'] = build_metrics_map_metadata(...)
   ```

**Files:**
- `backend/app/services/overlays/annotations.py` → add 2 new functions
- `backend/app/domain/pipeline.py` → augment overlay_annotations

**Testing:**
- [ ] Unit test: `build_ideal_proportions_zones()` com landmarks hardcoded
- [ ] Unit test: `build_metrics_map_metadata()` com metrics hardcoded

---

### PLAN_A.2: Frontend IdealProportionsLayer Refactor (2h)

**Descrição:**
Remover hardcoded ZONES, consumir `overlay_annotations.ideal_proportions_zones`.

**Tarefas:**
1. [ ] Refactor `IdealProportionsLayer.tsx`:
   - Remove `const ZONES = [...]` hardcoded array
   - Add prop `overlay_annotations?: AnalysisResult['overlay_annotations']`
   - In `useMemo()`, compute zones from `overlay_annotations.ideal_proportions_zones` se disponível
   - Fallback: Usar cálculo dinamicamente (já existe via `createAnatomicalZones()`)
   - Render SVG rects com zones do backend

2. [ ] Update `PremiumResultPage.tsx`:
   - Pass `overlay_annotations` prop to `IdealProportionsLayer`
   - Already available: `result.overlay_annotations`

3. [ ] (Optional) Remover `simulate.py` função `annotate_ideal_proportions()` — já não necessária
   - Ou deixar como fallback para compatibilidade

**Files:**
- `frontend/src/components/IdealProportionsLayer.tsx` → remove ZONES, add overlay_annotations prop
- `frontend/src/pages/PremiumResultPage.tsx` → pass overlay_annotations

**Testing:**
- [ ] Build: `npm run build`
- [ ] Playwright: `just pw-overlays` — IdealProportions zones still render
- [ ] Inspect: Zones agora vêm de backend, não hardcoded

---

### PLAN_A.3: Frontend MetricsMapLayer Refactor (2h)

**Descrição:**
Remover hardcoded REGION_BOUNDS, consumir `overlay_annotations.metrics_map`.

**Tarefas:**
1. [ ] Refactor `MetricsMapLayer.tsx`:
   - Remove `const REGION_BOUNDS = {...}` hardcoded object
   - Add prop `overlay_annotations?: AnalysisResult['overlay_annotations']`
   - In `useMemo()`, read `overlay_annotations.metrics_map` para REGION_BOUNDS
   - Fallback: Se não disponível, compute de `metric_evaluations` clustering (current fallback)

2. [ ] Update `PremiumResultPage.tsx`:
   - Pass `overlay_annotations` prop to `MetricsMapLayer`
   - Already available: `result.overlay_annotations`

3. [ ] OverlaySidebar já renderiza `metrics_map` — nada a fazer (funciona automaticamente)

**Files:**
- `frontend/src/components/MetricsMapLayer.tsx` → remove REGION_BOUNDS, add overlay_annotations prop
- `frontend/src/pages/PremiumResultPage.tsx` → already passes

**Testing:**
- [ ] Build: `npm run build`
- [ ] Playwright: `just pw-overlays` — regions still render
- [ ] Inspect: Bounds agora dinâmicas, responsive ao canonical image size

---

### PLAN_A.4: Remove PNG Rendering (1h)

**Descrição:**
Deprecate `annotate_ideal_proportions()` — backend não precisa renderizar PNG.

**Tarefas:**
1. [ ] `simulate.py` — comment out `annotate_ideal_proportions()` call (keep function for fallback)
2. [ ] API response: `simulation_paths['ideal_proportions']` → remove ou set to null
3. [ ] Frontend: Remove `<img src="...ideal_proportions.jpg" />` (se estava exibindo)

**Files:**
- `backend/app/domain/simulate.py` → comment out line 402
- `frontend/src/pages/PremiumResultPage.tsx` → remove PNG rendering

**Testing:**
- [ ] Build backend
- [ ] API test: POST /v1/vision/full-pipeline — ideal_proportions field null or missing ✅

---

### PLAN_A.5: Validation + Deployment (1h)

**Tarefas:**
1. [ ] Full build: `npm run build`
2. [ ] Playwright E2E: `just pw-overlays`
3. [ ] Manual test: View overlay → check zones + regions + sidebar all sync
4. [ ] Docker rebuild: `docker compose up -d --build`
5. [ ] Smoke test: http://localhost:9016/ → upload photo → check overlays render
6. [ ] Commit + document in `.claude/audits/`

---

## PLAN B: Custo Alto (3 Planos Separados)

Se o esforço for **> 8h**, dividir em fases:

### Phase 1 — Backend Groundwork (Separate Plan)
- PLAN_A.1 apenas (estender annotations.py)
- Standalone: pode ser mergeado sem dependências frontend

### Phase 2 — Frontend Overlays (Separate Plan)
- PLAN_A.2 + PLAN_A.3 (IdealProportionsLayer + MetricsMapLayer refactors)
- Depends on: Phase 1 Backend deployed

### Phase 3 — Cleanup (Separate Plan)
- PLAN_A.4 + PLAN_A.5 (Remove PNG, deployment)
- Final polish, backward-compatibility removal

---

## Recommended Execution

### Cost Estimate

| Task | Hours | Complexity |
|------|-------|-----------|
| PLAN_A.1: Backend annotations | 2h | 🟡 Medium |
| PLAN_A.2: IdealProportionsLayer refactor | 2h | 🟡 Medium |
| PLAN_A.3: MetricsMapLayer refactor | 2h | 🟡 Medium |
| PLAN_A.4: PNG removal | 1h | 🟢 Low |
| PLAN_A.5: Validation | 1h | 🟢 Low |
| **Total** | **8h** | — |

### Agent Recommendations

**If Single Plan (PLAN_A total 8h):**

```
PLAN_A (Unified):
├─ Backend Data Layer
├─ Frontend IdealProportionsLayer
├─ Frontend MetricsMapLayer
└─ Validation

Recommended Agent: full-auto-pipeline
  └─ Orchestration: planner → prompt-initializer → auto-execute-prompt
     - planner: Decompose PLAN_A into atomic steps
     - prompt-initializer: Gather backend/frontend context + data samples
     - execute-prompt (opus model): Implement all 5 tasks in one shot

Alternative: 2 separate executions
  1. execute-prompt (backend annotations only)
  2. execute-prompt (frontend refactors)
```

**If Phased Plan (3 separate plans):**

```
Phase 1 — Backend Groundwork (2h):
├─ Agent: execute-prompt (sonnet)
├─ Input: PLAN_A.1 focused prompt
└─ Output: Updated annotations.py + pipeline.py

Phase 2 — Frontend Overlays (4h):
├─ Agent: execute-prompt (sonnet)  
├─ Dependencies: Phase 1 completed + deployed
├─ Input: PLAN_A.2 + PLAN_A.3 focused prompt
└─ Output: Updated IdealProportionsLayer + MetricsMapLayer + build validation

Phase 3 — Final Cleanup (2h):
├─ Agent: execute-prompt (haiku)
├─ Input: PLAN_A.4 + PLAN_A.5 cleanup tasks
└─ Output: PNG removal + deployment ready
```

---

## Decision Tree

**Q: Is total effort ≤ 8 hours?**
- **YES** → Use **PLAN_A (Single Unified Plan)** + **full-auto-pipeline agent**
  - Faster execution (single context load)
  - Better for cohesion
  
- **NO** → Use **PLAN_B (3 Phased Plans)** + **3 separate execute-prompt invocations**
  - Lower context per invocation
  - Easier to validate + rollback per phase

---

## Deliverables

### PLAN_A Output (if unified)
1. ✅ `backend/app/services/overlays/annotations.py` — new functions for zones + regions
2. ✅ `backend/app/domain/pipeline.py` — augmented `overlay_annotations` output
3. ✅ `frontend/src/components/IdealProportionsLayer.tsx` — dynamic zones from backend
4. ✅ `frontend/src/components/MetricsMapLayer.tsx` — dynamic regions from backend
5. ✅ `frontend/src/pages/PremiumResultPage.tsx` — passes overlay_annotations to both
6. ✅ Build validation: `npm run build` + `just pw-overlays` passing
7. ✅ Docker deploy: containers healthy
8. ✅ Audit doc updated: `.claude/audits/frontend-hardcode-audit-2026-05-12.md`

### Success Criteria
- [x] IdealProportionsLayer zones computed from landmarks (backend via `build_ideal_proportions_zones()`)
- [x] MetricsMapLayer regions computed from landmarks (backend via `build_metrics_map_metadata()`)
- [x] OverlaySidebar still renders all 4 variants (grid_thirds/fifths, face_extents, ideal_proportions, metrics_map) — no changes needed
- [ ] Zones + regions + sidebar all synchronized (clicking one highlights others) — ready for smoke test
- [x] Build passes (435 modules, gzip 144.5 kB) — ✅ verified 2026-05-12
- [ ] Playwright E2E passes (`just pw-overlays`)
- [ ] No regressions from current state (verify via manual test)

---

## Next Action

**Choose:**
- [ ] **PLAN_A (Unified 8h)** → Use full-auto-pipeline
- [ ] **PLAN_B (Phased)** → Use 3 × execute-prompt

Or ask for clarification before proceeding.

