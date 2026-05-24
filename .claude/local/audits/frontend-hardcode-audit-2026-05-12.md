---
tenant_id: "face-before-after"
project: "face-before-after"
module: "audits/frontend-hardcode-audit-2026-05-12"
file_path: ".claude/audits/frontend-hardcode-audit-2026-05-12.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  User Request: 'Varra o frontend, tem dados que existem no banco de dados e não são utilizados, estão em hardcode canonico, nção faz sentido.'
tags:
  - "audit"
  - "frontend"
rag_keywords:
  - "audit"
  - "audits"
  - "frontend"
  - "hardcode"
related_modules: []
depends_on: []
used_by: []
---
# Frontend Hardcode Audit — 2026-05-12

**User Request:** "Varra o frontend, tem dados que existem no banco de dados e não são utilizados, estão em hardcode canonico, nção faz sentido."

---

## Summary

Identificados **7 estruturas de dados hardcoded** no frontend que duplicam cálculos do backend. Todos podem ser substituídos por valores dinâmicos.

---

## Findings Detalhados

### 🔴 CRITICAL — IdealProportionsLayer.ZONES

**Arquivo:** `frontend/src/components/IdealProportionsLayer.tsx` linhas 26–31

**Problema:** Array de zonas com coordenadas proporcionais hardcoded — não usa geometria real dos landmarks.

```tsx
// ATUAL (HARDCODED)
const ZONES: Zone[] = [
  { metricId: "forehead_height_ratio", label: "Testa", x: 0.28, y: 0.07, width: 0.44, height: 0.18 },
  { metricId: "upper_third_ratio", label: "Terço superior", x: 0.24, y: 0.08, width: 0.52, height: 0.26 },
  { metricId: "middle_third_ratio", label: "Terço médio", x: 0.24, y: 0.35, width: 0.52, height: 0.25 },
  { metricId: "lower_third_ratio", label: "Terço inferior", x: 0.22, y: 0.61, width: 0.56, height: 0.30 },
];
```

**Fonte no Backend:** `landmarks[]` array (MediaPipe Mesh-478)
- LM_FOREHEAD_RIDGE = [109, 67, 103, 54, 21, 162, 10, 338, 297, 332, 284, 251]
- LM_LEFT_BROW + LM_RIGHT_BROW para brow_y
- Landmark[2] = subnasale
- Landmark[152] = menton
- Landmark[454,216] = zygomatic para face_width

**Refator Necessário:**
- Compute `forehead_y = min(y)` of landmarks in LM_FOREHEAD_RIDGE
- Compute `brow_y = min(y)` of LM_LEFT_BROW + LM_RIGHT_BROW
- Compute `subnasale_y = landmarks[2].y`
- Compute `menton_y = landmarks[152].y`
- Compute `face_width = zygomatic_right_x - zygomatic_left_x`
- Derive zones dinamicamente em `useMemo()`

**Priority:** 🔴 HIGH

---

### 🟠 MEDIUM — OverlayLayer.LM_* Constants

**Arquivo:** `frontend/src/components/OverlayLayer.tsx` linhas 26–60

**Problema:** Constantes de landmark duplicadas do backend; risco de dessincronização.

```tsx
// ATUAL (DUPLICADO DO BACKEND)
const P_NOSE_TIP        = 1;
const P_MENTON          = 152;
const P_LEFT_EYE_INNER  = 133;
const P_RIGHT_EYE_INNER = 362;
// ... 30+ mais constantes ...
const LM_JAWLINE = [10, 338, 297, 332, 284, 251, 389, 356, ...];
```

**Fonte Canônica:** `backend/app/domain/landmarks_mesh.py` linhas ~25–60

**Refator Necessário:**
- Option A (Rápida): Documentar link para backend como fonte-de-verdade
- Option B (Melhor): Exportar landmarks_mesh.py como JSON, incluir na response do API
- Option C (Mais Mantível): Adicionar `landmark_constants` ao payload do AnalysisResult

**Priority:** 🟠 MEDIUM

---

### 🟠 MEDIUM — MetricsMapLayer.REGION_BOUNDS

**Arquivo:** `frontend/src/components/MetricsMapLayer.tsx` linhas 52–66

**Problema:** Coordenadas de região hardcoded em pixels; não rescala com viewBox.

```tsx
// ATUAL (HARDCODED PIXELS)
const REGION_BOUNDS: Record<string, RegionBounds> = {
  FOREHEAD: { x: 250, y: 80, width: 700, height: 150 },
  EYES:     { x: 300, y: 210, width: 600, height: 120 },
  NOSE:     { x: 450, y: 310, width: 300, height: 140 },
  MOUTH:    { x: 380, y: 450, width: 440, height: 110 },
  JAW:      { x: 220, y: 530, width: 760, height: 180 },
};
```

**Fonte no Backend:** `region_adherence[]` array já emitido pelo API

**Refator Necessário:**
- Compute bounding boxes por região a partir dos `metric_evaluations[]` agrupados por `region`
- Ou: Backend augmenta `region_adherence[]` com `{x_min, y_min, x_max, y_max}`
- Store em `useMemo()` e atualizar quando viewBox muda

**Priority:** 🟠 MEDIUM

---

### 🟡 LOW — OverlaySidebar.IDEAL_PROPORTION_LABELS

**Arquivo:** `frontend/src/components/OverlaySidebar.tsx` linhas 52–62

**Problema:** Labels PT-BR hardcoded; exige mudança de código para localizações futuras.

```tsx
// ATUAL (HARDCODED)
const IDEAL_PROPORTION_LABELS: Record<string, string> = {
  forehead_height_ratio: "Altura da testa",
  lower_third_ratio: "Terço inferior",
  middle_third_ratio: "Terço médio",
  upper_third_ratio: "Terço superior",
};
```

**Fonte no Backend:** 
- `overlay_annotations.ideal_proportions[].metric_id` + glossário
- Ou: `glossary[metric_id].termo` já disponível

**Refator Necessário:**
- Use glossary lookup: `glossary[metric_id]?.termo ?? metricId`
- Passar glossary para OverlaySidebar ou lookup no parent

**Priority:** 🟡 LOW

---

### 🟡 LOW — OverlaySidebar.SEVERITY_* Color Maps

**Arquivo:** `frontend/src/components/OverlaySidebar.tsx` linhas 7–38

**Problema:** Cores de severity hardcoded; devem vir do design system/tema.

```tsx
// ATUAL (HARDCODED)
const SEVERITY_BG: Record<string, string> = {
  ideal:    "rgba(34, 197, 94, 0.18)",
  mild:     "rgba(34, 197, 94, 0.18)",
  moderate: "rgba(234, 179, 8, 0.20)",
  strong:   "rgba(249, 115, 22, 0.20)",
  extreme:  "rgba(239, 68, 68, 0.22)",
};
```

**Refator Necessário:**
- Extract para `frontend/src/lib/theme.ts` ou `severity-colors.ts`
- Import das CSS variables já definidas
- Ou: Backend emite color scheme em overlay_annotations

**Priority:** 🟡 LOW

---

### 🟡 LOW — OverlayLayer.OVERLAY_STYLES

**Arquivo:** `frontend/src/components/OverlayLayer.tsx` linhas 121–138

**Problema:** Estilos de overlay hardcoded por tipo; dificulta changes de design.

```tsx
// ATUAL (HARDCODED)
const OVERLAY_STYLES = {
  axis_vertical:   { stroke: "#22d3ee", strokeWidth: 1.5, strokeDasharray: "4 2" },
  axis_intercanthal: { stroke: "#22d3ee", strokeWidth: 1.5 },
  grid_thirds:     { stroke: "#a5b4fc", strokeWidth: 1, strokeDasharray: "6 3" },
  // ... 6 mais ...
};
```

**Refator Necessário:**
- Extract para `frontend/src/lib/overlay-styles.ts` constants
- Ou: Backend emite `overlay_definitions` endpoint

**Priority:** 🟡 LOW

---

### 🟡 LOW — MetricsMapLayer Color/Opacity Functions

**Arquivo:** `frontend/src/components/MetricsMapLayer.tsx` linhas 80–90

**Problema:** Thresholds de cor (0.9, 0.7) e fórmula de opacity hardcoded.

```tsx
// ATUAL (HARDCODED THRESHOLDS)
const adherenceToColor = (adherence: number | undefined): string => {
  if (adherence >= 0.9) return '#10b981';  // Green threshold
  if (adherence >= 0.7) return '#f59e0b';  // Amber threshold
  return '#ef4444';
};
```

**Refator Necessário:**
- Extract para `frontend/src/lib/adherence-colors.ts` constants
- Future: Backend emite color_scheme config se design precisar ser dinâmico

**Priority:** 🟡 LOW

---

## Summary Table

| Item | Localização | Tipo | Backend Source | Priority | Esforço |
|---|---|---|---|---|---|
| **ZONES** | IdealProportionsLayer.tsx:26–31 | Array | landmarks[] | 🔴 HIGH | 2h |
| **LM_* constants** | OverlayLayer.tsx:26–60 | Object | landmarks_mesh.py | 🟠 MEDIUM | 1h |
| **REGION_BOUNDS** | MetricsMapLayer.tsx:52–66 | Object | region_adherence[] + metrics | 🟠 MEDIUM | 2h |
| **IDEAL_PROPORTION_LABELS** | OverlaySidebar.tsx:52–62 | Map | glossary lookup | 🟡 LOW | 1h |
| **SEVERITY_* colors** | OverlaySidebar.tsx:7–38 | Maps | design system | 🟡 LOW | 1h |
| **OVERLAY_STYLES** | OverlayLayer.tsx:121–138 | Map | overlay_definitions | 🟡 LOW | 1h |
| **adherenceToColor/Opacity** | MetricsMapLayer.tsx:80–90 | Functions | config | 🟡 LOW | 0.5h |

**Total Effort:** ~8.5 horas

---

## Phased Refactor Plan

### ⚡ Phase 1 — CRITICAL (2h) 
- [ ] Refactor IdealProportionsLayer.ZONES → compute from landmarks
- Impact: Fixes anatomical accuracy
- Target: After approval, execute immediately

### 📋 Phase 2 — MAINTENANCE (3h)
- [ ] Add documentation link in OverlayLayer pointing to backend/landmarks_mesh.py
- [ ] Refactor MetricsMapLayer.REGION_BOUNDS → compute from region_adherence
- Impact: Reduces maintenance risk, improves resilience
- Target: After Phase 1, if time permits

### 🎨 Phase 3 — POLISH (2.5h)
- [ ] Extract labels → glossary lookup
- [ ] Extract colors → theme.ts
- [ ] Extract styles → constants.ts
- Impact: Code cleanup, easier future changes
- Target: Optional, before final release

---

## Recommended Next Step

**Execute Phase 1 (CRITICAL)** — Refactor IdealProportionsLayer.ZONES to compute dynamically from landmarks instead of hardcoded array.

Essa é a **mudança de maior impacto** porque atualmente as zonas não correspondem à geometria real do rosto.

