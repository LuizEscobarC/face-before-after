---
tenant_id: "face-before-after"
project: "face-before-after"
module: "face-analysis/task-react-free-premium-capture-2026-05-03.prompt"
file_path: ".claude/prompts/face-analysis/task-react-free-premium-capture-2026-05-03.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Module: face-analysis Type: feature Slug: react-free-premium-capture Date: 2026-05-03 Model: sonnet Plan: .claude/plans/react-free-premium-capture-2026-05-03.md
tags:
  - "face-analysis"
  - "task-prompt"
rag_keywords:
  - "analysis"
  - "capture"
  - "face"
  - "free"
  - "premium"
  - "prompt"
  - "prompts"
  - "react"
related_modules: []
depends_on: []
used_by: []
---
# Task: React + Free/Premium + Upload/Câmera

**Module:** face-analysis  
**Type:** feature  
**Slug:** react-free-premium-capture  
**Date:** 2026-05-03  
**Model:** sonnet  
**Plan:** `.claude/plans/react-free-premium-capture-2026-05-03.md`

## Objetivo
Separar a experiência em duas telas distintas (Free e Premium) e criar interface React para captura de foto (upload e câmera), com orientações de captura estilo 3x4.

## Entregáveis
1. Backend HTTP em Python expondo análise free/premium.
2. Frontend React com:
   - tela de captura
   - tela de resultado free
   - tela de resultado premium
3. Formulário que aceita PNG/JPG/JPEG.
4. Captura por webcam/câmera (desktop/mobile).
5. Bloco de instruções de foto (iluminação, distância, posição, enquadramento 3x4).

## Regras
- Preservar motor analítico atual.
- Não quebrar comandos existentes.
- Não remover funcionalidades já implementadas (auto-crop, premium catalog).
- Diferenciar claramente conteúdo Free x Premium.

## Verificação
- `just lint`
- `just test-q`
- smoke: upload PNG e JPG em Free e Premium
- smoke: captura por webcam e envio
