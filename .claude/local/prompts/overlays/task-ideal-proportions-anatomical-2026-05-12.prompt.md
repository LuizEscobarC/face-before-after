---
tenant_id: "face-before-after"
project: "face-before-after"
module: "overlays/task-ideal-proportions-anatomical-2026-05-12.prompt"
file_path: ".claude/prompts/overlays/task-ideal-proportions-anatomical-2026-05-12.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Type: feature > Module: overlays > Date: 2026-05-12 > Stack: React 18 + TypeScript + SVG Overlay Layer
tags:
  - "task-prompt"
  - "overlays"
  - "ideal-proportions"
rag_keywords:
  - "SVG overlay"
  - "anatomical"
  - "face overlay"
  - "golden ratio facial"
  - "ideal"
  - "ideal proportions"
  - "overlays"
  - "prompt"
  - "prompts"
  - "proportions"
related_modules: []
depends_on: []
used_by: []
---
# Ideal Proportions Anatomical Zones

> Type: feature
> Module: overlays
> Date: 2026-05-12
> Stack: React 18 + TypeScript + SVG Overlay Layer

## Context
Atualmente o IdealProportionsLayer usa zonas canônicas proporcionais (x/y/width/height relativos).
Objetivo: tornar as zonas anatômicas com base em landmarks reais da face para acompanhar variações reais de enquadramento e anatomia.

## Requirements
1. Usar landmarks reais (Mesh-478) para calcular limites verticais dos terços:
   - topo: ridge/trichion proxy
   - brow line
   - subnasale
   - menton
2. Usar landmarks reais para limites laterais (bizigomatic).
3. Manter seleção interativa por metric_id e sincronização com sidebar.
4. Evitar regressão visual e de build.

## Files
- frontend/src/components/IdealProportionsLayer.tsx
- frontend/src/pages/PremiumResultPage.tsx

## Steps / Checks
- [ ] Refatorar IdealProportionsLayer para receber landmarks e calcular zonas anatômicas.
- [ ] Integrar passagem de landmarks em PremiumResultPage.
- [ ] npm run build sem erros.
- [ ] just pw-overlays passando.

## Verification
- As zonas acompanham a anatomia facial no render final.
- Clique em item da sidebar destaca zona correspondente.
- Clique na zona destaca item correspondente.
