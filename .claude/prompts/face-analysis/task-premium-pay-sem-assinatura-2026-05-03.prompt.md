# Task: Premium Pay-Per-Report (Sem Assinatura)

**Module:** face-analysis  
**Type:** feature  
**Slug:** premium-pay-sem-assinatura  
**Date:** 2026-05-03  
**Model:** sonnet  
**Plan:** `.claude/plans/premium-pay-sem-assinatura-2026-05-03.md`

---

## Objetivo
Implementar dois modos de entrega no produto atual:
- `teaser` (grátis, foco conversão)
- `premium` (pago one-shot, com todas as métricas possíveis já calculadas)

Sem assinatura, sem backend de pagamento nesta etapa.

## Escopo de Implementação

1. `mvp_pipeline.py`
- Adicionar argumento CLI `--mode` com valores `teaser|premium` (default `premium`)
- Adicionar metadados no JSON:
  - `analysis_mode`
  - `access_tier`
- Em `teaser`, reduzir payload e texto para versão de entrada:
  - manter score/tier, first_impression, main_insight, next_step
  - ocultar blocos premium completos (simulação/evolution detalhado/top3 completos)
- Em `premium`, manter entrega completa atual e acrescentar catálogo estruturado de métricas:
  - `premium_metrics_catalog` por categoria
  - cada item com `key`, `label`, `value`, `unit`, `ideal`, `class`, `source_block`

2. `build_mvp_html.py`
- Render condicional por `analysis_mode`
- `teaser`: visual curto e persuasivo com CTA
- `premium`: manter layout atual e adicionar seção “Métricas Completas” (accordion por categoria)
- Exibir severidade visual para métricas com ideal conhecido (quando aplicável)

3. `justfile`
- Adicionar comandos:
  - `mvp-free foto`
  - `mvp-free-web foto`
  - `mvp-premium foto`
  - `mvp-premium-web foto`
- Preservar legados como alias premium:
  - `mvp-foto`
  - `mvp-web`

4. `tests/test_pipeline_integration.py`
- Manter validação do default (`premium`)
- Adicionar testes explícitos para `teaser` vs `premium`:
  - teaser sem blocos premium pesados
  - premium com catálogo completo de métricas

## Regras
- Não quebrar contratos existentes (somente adicionar campos)
- Não adicionar dependências externas
- Manter português no conteúdo exibido ao usuário
- Rodar testes ao final

## Verificação
1. `just mvp-free-web depois.png`
2. `just mvp-premium-web depois.png`
3. `just test-q`
4. `just lint`
