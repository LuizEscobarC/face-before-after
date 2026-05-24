---
tenant_id: "face-before-after"
project: "face-before-after"
module: "superseded/review-phase3"
file_path: ".claude/plans/archive/superseded/review-phase3.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Compacted conversation
tags:
  - "planning"
rag_keywords:
  - "archive"
  - "phase3"
  - "plans"
  - "review"
  - "superseded"
related_modules: []
depends_on: []
used_by: []
---
Compacted conversation

Explore pipeline output and report quality

Read [](file:///home/luizescobal/study/face-before-after/mvp_pipeline.py#1-1), lines 1 to 500

Read [](file:///home/luizescobal/study/face-before-after/impression_layer.py)

Read [](file:///home/luizescobal/study/face-before-after/resultado_mvp/depois_mvp_report.txt)

Read [](file:///home/luizescobal/study/face-before-after/resultado_mvp/depois_mvp_report.json)

Read [](file:///home/luizescobal/study/face-before-after/visual_status.py)

Read [](file:///home/luizescobal/study/face-before-after/top_leverage.py)

Read [](file:///home/luizescobal/study/face-before-after/evolution_path.py)

Read [](file:///home/luizescobal/study/face-before-after/recommendations.py#1-1), lines 1 to 500

Read [](file:///home/luizescobal/study/face-before-after/recommendations.py#500-500), lines 500 to 672

Read [](file:///home/luizescobal/.vscode-server/data/User/workspaceStorage/900737d4ff2e42db7c46bfab812d7c21/GitHub.copilot-chat/chat-session-resources/724b5d4c-df67-4044-adb3-a98ac8f1b958/toolu_bdrk_0198mjxn1hkk48V89V877SGY__vscode-1777841960279/content.txt)

Agora tenho um quadro completo. Deixa eu criar o plano. 

Created memory file [](file:///home/luizescobal/.vscode-server/data/User/workspaceStorage/900737d4ff2e42db7c46bfab812d7c21/GitHub.copilot-chat/memory-tool/memories/NzI0YjVkNGMtZGY2Ny00MDQ0LWFkYjMtYTk4YWM4ZjFiOTU4/plan.md)

## Plan: Refinamentos de Valor Percebido do Produto

**TL;DR:** O pipeline está tecnicamente completo. O output atual tem tom de laudo clínico em vez de produto de auto-melhoria. O usuário que pagou precisa sentir: *"isso foi feito para mim"*, *"aprendi algo que não sabia"*, *"sei exatamente o que fazer agora"*. As mudanças são majoritariamente de copy/narrativa + 2 pontos de lógica no TXT — sem alterar contratos entre módulos.

---

### Fase 1 — Linguagem e Emoção (maior impacto percebido)

**1. Score celebration copy** — mvp_pipeline.py · `build_shareable_report()`
- Hoje: `"87 / 100 — Muito boa"` + frase genérica de manutenção
- Novo: tier-aware com contexto comparativo
  - ≥80 → celebração + benchmarking suave ("resultado acima da média")
  - 60–79 → "base sólida, 2 ajustes mudam o jogo"
  - <60 → "diagnóstico revelou oportunidades concretas"
- Adicionar campo `benchmark_message` no JSON

**2. First impression fallback fix** — impression_layer.py
- Hoje: fallback do POSITIVE_SIGNALS = *"Face detectada com qualidade suficiente para análise completa"* (vazio de valor)
- Novo: `"Equilíbrio facial consistente — nenhum ponto de atenção dominante"`
- Ajustar threshold de `good_canthal` (hoje `>= 5°`, pode ignorar casos positivos leves)

**3. Wow moment de frescor baixo** — visual_status.py
- Quando `freshness_score < 4.0`: adicionar frase específica de skincare de alto impacto à narrativa
- Hoje é a métrica mais crítica no output de teste (2.5/10) mas não gera linguagem urgente

**4. `WHY_BENEFIT_MAP` de técnico para emocional** — top_leverage.py
- Hoje: `"define a estrutura facial — o que mais transmite força e saúde"` (frio)
- Novo: `"projeta presença antes mesmo de você falar — estrutura que transmite autoridade"`

---

### Fase 2 — Lógica Comercial e CTA

**5. CTA por perfil corrigido** — mvp_pipeline.py · `build_next_step()`
- Bug atual: profile "alto" recebe CTA de "acompanhar evolução" (passivo)
- Novo alinhamento:
  - alto → `"Ver minha simulação antes/depois"` | cta_type = `"simulacao"`
  - médio → `"Começar o plano de 7 dias"` | cta_type = `"plano_7d"`
  - baixo → `"Quero entender meus 3 pontos de melhoria"` | cta_type = `"detalhamento"`

**6. Phase confidence visível no TXT** — mvp_pipeline.py · `build_shareable_report()`
- Hoje: existe no JSON, invisível no TXT
- Novo: mostrar `[muito provável | provável | possível | desafiador]` ao lado de cada fase
- Quando fase 3 = "desafiador": nota explícita sobre necessidade de acompanhamento profissional

**7. Simulação mencionada no TXT**
- Quando `simulation_paths` não for None: bloco `📸 VISUALIZAÇÕES GERADAS` com os 3 filenames
- Hoje o usuário recebe imagens mas o TXT nunca menciona sua existência

---

### Fase 3 — Acionabilidade e Especificidade

**8. Foto ruim → aviso priorizado** — mvp_pipeline.py
- Hoje: `photo_warnings` fica no fundo do TXT
- Novo: quando `capture_confidence < 0.60`: mover aviso para **antes das 3 ações** com header `⚠️ ANTES DE AGIR, MELHORE A CAPTURA:`

**9. Skin alert no evolution path** — evolution_path.py + recommendations.py
- Se `skin_uniformity_std_lab_mean > 20` ou `under_eye_darkness_mean > 0.15`: forçar inclusão de "Protocolo SPF diário + hidratação" na Fase 1
- Nova entrada no `REC_CATALOG`; campo `skin_alert: bool` no retorno de `build_evolution_path`

**10. Score percentil + contexto** — mvp_pipeline.py
- Campo `score_context` no JSON e TXT com referência orientativa hardcoded por tier:
  - ≥90 → "top 5%"; 80–89 → "top 20%"; 60–79 → "top 45%"; <60 → acima da maioria que não analisou

---

### Arquivos a modificar

| Arquivo | Itens |
|---|---|
| mvp_pipeline.py | 1, 5, 6, 7, 8, 10 |
| impression_layer.py | 2 |
| visual_status.py | 3 |
| top_leverage.py | 4 |
| evolution_path.py | 9 |
| recommendations.py | 9 |

### Verificação

1. `pytest tests/ -v` → 114/114 (zero regressão)
2. `.mvp_pipeline.py depois.png` → TXT com celebration, simulação mencionada, CTA "Ver simulação", phase confidence visível
3. `.mvp_pipeline.py antes.png` → CTA de perfil correto, aviso de captura em destaque se baixo

### Exclusões de escopo
- Sem novos testes além dos existentes (114 passando)
- Sem APIs externas ou dependências
- Card compartilhável permanece fora (`produto-compartilhavel.md`)

---

**Perguntas antes de implementar:** 

Analyzing your answers...

Updated memory

Updated memory file [](file:///home/luizescobal/.vscode-server/data/User/workspaceStorage/900737d4ff2e42db7c46bfab812d7c21/GitHub.copilot-chat/memory-tool/memories/NzI0YjVkNGMtZGY2Ny00MDQ0LWFkYjMtYTk4YWM4ZjFiOTU4/plan.md)

Decisões capturadas. Plano final atualizado:

**`score_context`** → hardcoded por tier (✅)  
**`skin_alert`** → forçado como 1ª ação da Fase 1 no TXT (✅)  
**Execução** → Fase 1 + Fase 2 primeiro, Fase 3 depois (✅)

O plano está pronto. Quando quiser que eu execute, é só falar `execute-prompt` ou autorizar a implementação.You've used 55% of your weekly rate limit. Your weekly rate limit will reset on May 3 at 8:00 PM. [Learn More](https://aka.ms/github-copilot-rate-limit-error)