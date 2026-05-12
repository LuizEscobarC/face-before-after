
Created memory file [](file:///home/luizescobal/.vscode-server/data/User/workspaceStorage/900737d4ff2e42db7c46bfab812d7c21/GitHub.copilot-chat/memory-tool/memories/NDI2MWM2ZmYtMTNjZC00MmQ5LWFjNWMtOWI0NzA1Y2RhZTFh/plan.md)

## Plan: Correção Completa dos Overlays + Migração para SVG Interativo

Fechei o diagnóstico e já organizei um plano único para resolver os 5 pontos sem remendo parcial. Também salvei no session memory em /memories/session/plan.md.

### Escopo coberto (1 a 5)
2. Fazer heatmap de aderência funcionar de fato  
3. Fazer Vetores ideais funcionar (wireframe + linhas guia)  
4. Migrar Proporções ideais para SVG interativo com explicações ao lado  
5. Migrar Mapa de métricas para SVG interativo selecionável com UX lateral

### Fases de execução

1. Fase B: ativar heatmap de aderência (backend + nest + front)
2. Gerar regionAdherence no pipeline em pipeline.py.
3. Propagar contrato em vision.dto.ts e vision.client.ts.
4. Enviar regionAdherence no render-overlay pelo front em PremiumResultPage.tsx.
5. Manter validação explícita para casos inválidos em render.py.

6. Fase C: corrigir Vetores ideais (before vs ideal)
7. Adicionar estados/toggles reais de showGuideLines e showActualWireframe em PremiumResultPage.tsx.
8. Validar passthrough nest -> python em vision.controller.ts e vision.client.ts.
9. Adicionar assert de regeneração com toggle no Playwright.

10. Fase D: Proporções ideais como SVG selecionável
11. Criar camada SVG dedicada em frontend/src/components/IdealProportionsLayer.tsx.
12. Integrar na view ideal em PremiumResultPage.tsx.
13. Conectar seleção do sidebar em OverlaySidebar.tsx.
14. Preservar fallback PNG para compatibilidade.

15. Fase E: Mapa de métricas como SVG selecionável
16. Tornar regiões de thirds/fifths/extents selecionáveis em OverlayLayer.tsx.
17. Sincronizar clique no sidebar com highlight no SVG em OverlaySidebar.tsx e PremiumResultPage.tsx.

18. Fase F: validação final e rollout
19. Build e typecheck frontend.
20. Rodar playwright-overlays-e2e.mjs e playwright-overlays-matrix.mjs.
21. Validar compatibilidade para run_id antigo e endpoints legados.

### Resultado esperado após execução

2. Heatmap de aderência deixa de falhar por ausência de dados regionais.  
3. Vetores ideais passam a responder aos toggles de wireframe/linhas guia.  
4. Proporções ideais vira visualização SVG interativa com explicação lateral(varios selects igual aos selects de overlays/linhas de refeerência).  
5. Mapa de métricas vira visualização SVG selecionável com UX lateral sincronizada (igual aos selects de overlays/linhas de refeerência).