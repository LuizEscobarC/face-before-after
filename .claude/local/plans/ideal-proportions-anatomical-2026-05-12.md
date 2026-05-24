---
tenant_id: "face-before-after"
project: "face-before-after"
module: "plans/ideal-proportions-anatomical-2026-05-12"
file_path: ".claude/plans/ideal-proportions-anatomical-2026-05-12.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Date: 2026-05-12 Task: Migrar as zonas do IdealProportionsLayer de proporções canônicas para geometria baseada em landmarks reais Mesh-478.
tags:
  - "planning"
  - "ideal-proportions"
rag_keywords:
  - "anatomical"
  - "golden ratio facial"
  - "ideal"
  - "ideal proportions"
  - "plans"
  - "proportions"
related_modules: []
depends_on: []
used_by: []
---
# Plano — IdealProportionsLayer com Geometria Anatômica

Date: 2026-05-12
Task: Migrar as zonas do IdealProportionsLayer de proporções canônicas para geometria baseada em landmarks reais (Mesh-478).

## Goal
Substituir retângulos proporcionais fixos por zonas derivadas da anatomia detectada na imagem, mantendo seleção sincronizada com sidebar.

## Scope
- frontend/src/components/IdealProportionsLayer.tsx
- frontend/src/pages/PremiumResultPage.tsx
- validação com build + Playwright overlays

## Steps
1. Derivar limites anatômicos (x/y) de landmarks: forehead ridge, brow, subnasale, menton, bizigomatic.
2. Construir zonas upper/middle/lower/forehead em pixel-space do viewBox usando esses limites.
3. Preservar interação (click/select) e estilos por severidade.
4. Passar landmarks da página para a camada SVG.
5. Validar compilação e regressão visual.

## Recommended Execution Model
- **Model:** sonnet
- **Reason:** mudança de complexidade média em 2 arquivos de frontend com ajuste geométrico e validação local.
