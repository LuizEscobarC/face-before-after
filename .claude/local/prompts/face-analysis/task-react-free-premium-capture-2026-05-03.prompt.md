# Task: React + Free/Premium + Upload/Câmera

**Module:** face-analysis  
**Type:** feature  
**Slug:** react-free-premium-capture  
**Date:** 2026-05-03  
**Model:** sonnet  
**Plan:** `.claude/local/plans/react-free-premium-capture-2026-05-03.md`

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
