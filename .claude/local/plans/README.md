---
tenant_id: "face-before-after"
project: "face-before-after"
module: "plans/README"
file_path: ".claude/plans/README.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Onde o agente deve começar quando precisa entender o estado do produto.
tags:
  - "planning"
rag_keywords:
  - "plans"
  - "readme"
related_modules: []
depends_on: []
used_by: []
---
# Plans — índice

> Onde o agente deve começar quando precisa entender o estado do produto.

## Comece aqui

1. **[`PLAN_METRICS.md`](./PLAN_METRICS.md)** — plano-mestre. Tabela de PRs (1 → 50+), seção §0 = "estado atual" sempre atualizada. **Releia §0 no início de cada sessão.**
2. **[`DDL_REVIEW.md`](./DDL_REVIEW.md)** — review transversal do schema (gap de tabelas faltando: factor, metric_evaluation, overlay, etc.). Não é cronograma — é checklist arquitetural.
3. **[`CLAUDE_CONTEXT.md`](./CLAUDE_CONTEXT.md)** — meta-doc de prompt engineering. Reler só quando configurar nova sessão.

## Marcos ativos

Detalhamento por marco em [`marcos/`](./marcos/):

| Marco | Estado | Doc | Resumo |
|-------|--------|-----|--------|
| **M0–M1** | ✅ done | (em `PLAN_METRICS` §0, PRs 1–12) | Postgres + DDL + 21 métricas + scoring |
| **M2** | 🟡 em curso | [`marcos/M2_BACKLOG.md`](./marcos/M2_BACKLOG.md) | Famílias 13–20 + multi-foto + scoring v1.5 entregues. Falta **PR-22 (humano)** + **PR-21 v2.0** |
| ↳ PR-21 v1.5→v2.0 | bloqueado em PR-22 | [`marcos/M2_PR21_v15_to_v20.md`](./marcos/M2_PR21_v15_to_v20.md) | Roadmap de promoção dos pesos quando houver dados reais |
| ↳ PR-22 fotos reais | ⏳ tarefa humana | [`marcos/M2_PR22_real_photos.md`](./marcos/M2_PR22_real_photos.md) | ≥30 fotos, datasets sugeridos, planilha de override |
| **M3** | 🟡 em curso | [`marcos/M3_OVERLAYS.md`](./marcos/M3_OVERLAYS.md) | M3.1–M3.4 ✅ entregues (overlays + heatmaps + before/ideal). Próximo: integração final |
| **M4** | ⏳ aberto | [`marcos/M4_NARRATIVE.md`](./marcos/M4_NARRATIVE.md) | M4.1 (templates infra) ✅. Falta catálogo full + PDF |

## Convenções

- **Plano ativo** vive na raiz (`PLAN_METRICS.md`, `DDL_REVIEW.md`) ou em `marcos/`. Sempre tem header `## 0. Estado atual` ou equivalente.
- **Histórico** vive em [`archive/`](./archive/) — **não ler salvo arqueologia**:
  - `archive/superseded/` — planos antigos substituídos por `PLAN_METRICS` (ex: `plan-0-ddd-nest+python`, `review-phase3`, primeiras tentativas de migração mediapipe).
  - `archive/sessions/` — dumps de sessões longas que viraram contexto compactado.
  - `archive/brainstorms/` — ideias soltas de produto/preço/UX (assinatura, premium, MVP venda rápida). Útil para retomar discussões de produto, não para implementar.
- **Atualizar PR entregue:** uma linha na tabela §0 de `PLAN_METRICS.md` + atualizar status no `README.md` aqui.
- **Citações de plano em prosa** (ex: "PLAN_M3_OVERLAYS §1.1") são identificadores semânticos — mantenha mesmo após mover/renomear, só atualize links `[texto](path)` clicáveis.

## Para podar contexto

Em sessões cheias, dá pra ignorar com segurança:
- Tudo em `archive/`.
- `CLAUDE_CONTEXT.md` (só releia em onboarding).
- Marcos já fechados (linhas ✅ de `PLAN_METRICS.md` §0 — descrevem entrega passada, não trabalho a fazer).

O mínimo que **sempre** carrega valor:
- `PLAN_METRICS.md` §0 (tabela de PRs) + §"Próximas fatias".
- O `marcos/MX_*.md` do marco em curso.
