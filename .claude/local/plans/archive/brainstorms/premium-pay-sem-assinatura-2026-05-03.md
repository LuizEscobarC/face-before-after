---
tenant_id: "face-before-after"
project: "face-before-after"
module: "brainstorms/premium-pay-sem-assinatura-2026-05-03"
file_path: ".claude/plans/archive/brainstorms/premium-pay-sem-assinatura-2026-05-03.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  1. Prompt orchestration - Skill: prompt-initializer - Ação: gerar prompt de implementação com contexto do módulo de análise facial - Saída esperada: novo .prompt.md em .claude/prompts/face-analysis/
tags:
  - "planning"
rag_keywords:
  - "archive"
  - "assinatura"
  - "brainstorms"
  - "plans"
  - "premium"
related_modules: []
depends_on: []
used_by: []
---
# Plano: Premium Pay-Per-Report (Sem Assinatura)

## Objetivo
Implementar duas experiências no produto com base no pipeline atual:
1. Teaser gratuito (entrada e conversão)
2. Relatório Premium pago (one-shot) com todas as métricas atualmente calculadas no projeto

## Escopo
- Separar claramente modo `teaser` e modo `premium` no pipeline principal
- Expor no premium 100% dos campos existentes em `measurements` + `measurements_blocks`
- Ajustar relatório TXT e HTML para render condicional por modo
- Adicionar comandos de execução no justfile para fluxo comercial
- Manter retrocompatibilidade dos comandos já existentes

## Skills e Sequência de Execução

1. Prompt orchestration
- Skill: `prompt-initializer`
- Ação: gerar prompt de implementação com contexto do módulo de análise facial
- Saída esperada: novo `.prompt.md` em `.claude/prompts/face-analysis/`

2. Implementação de contrato de modos
- Skill: `execute-prompt` (modelo recomendado abaixo)
- Arquivo-alvo: `mvp_pipeline.py`
- Mudanças:
  - adicionar argumento CLI de modo (`teaser|premium`), default `premium`
  - adicionar metadados no JSON (`analysis_mode`, `access_tier`)
  - bloquear no teaser blocos premium (simulações, top3 completos, evolução completa e apêndice de métricas)

3. Premium full metrics payload
- Skill: `execute-prompt`
- Arquivo-alvo: `mvp_pipeline.py`
- Mudanças:
  - criar estrutura categorizada de métricas premium usando dados já calculados
  - incluir metadados de apresentação (label, unidade, ideal, classificação estrutural/mutável/captura)
  - preservar `measurements` e `measurements_blocks` intactos para compatibilidade

4. Render web por modo
- Skill: `execute-prompt`
- Arquivo-alvo: `build_mvp_html.py`
- Mudanças:
  - teaser: HTML curto e persuasivo (score + insight + CTA)
  - premium: HTML completo com seção “Métricas Completas” agrupada por categoria
  - fallback robusto para campos opcionais

5. Comandos de produto
- Skill: `execute-prompt`
- Arquivo-alvo: `justfile`
- Mudanças:
  - adicionar `mvp-free`, `mvp-free-web`, `mvp-premium`, `mvp-premium-web`
  - manter `mvp-foto` e `mvp-web` como alias premium

6. Quality gates
- Skill: `execute-prompt`
- Arquivo-alvo: `tests/test_pipeline_integration.py`
- Mudanças:
  - testes para contrato teaser vs premium
  - validação de presença/ausência de blocos por modo
  - validação de não-regressão no modo default

## Verificações de Aceite
1. `just mvp-free-web foto.png` gera saída enxuta sem blocos premium
2. `just mvp-premium-web foto.png` gera HTML premium com métricas completas
3. `just test-q` passa sem regressão
4. comandos antigos continuam funcionais e equivalentes ao premium

## Riscos e Mitigação
- Risco: sobrecarga cognitiva no premium
  - Mitigação: resumo no topo + bloco avançado expandível
- Risco: quebra de contrato JSON consumido por scripts legados
  - Mitigação: apenas adição de chaves novas, sem remoção/renomeação
- Risco: confusão comercial entre grátis e pago
  - Mitigação: `analysis_mode` explícito e CTA de upgrade no teaser

## Decisões
- Premium é one-shot (sem assinatura)
- Escopo não inclui novas métricas com ML externo
- Escopo não inclui backend de pagamento nesta fase

## Recommended Execution Model
- **Model:** sonnet
- **Reason:** Task de média-alta complexidade com mudanças coordenadas em pipeline Python, render HTML, CLI e testes, exigindo equilíbrio entre precisão técnica, velocidade e baixo risco de regressão.
