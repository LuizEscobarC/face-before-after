# Task: Grupo 3 — Diagnostico de Primeira Impressao + Status + Proximo Passo

**Module:** face-analysis  
**Type:** feature  
**Slug:** grupo-3-impressao-status-next-step  
**Date:** 2026-05-03  
**Model:** sonnet  
**Depends On:**
- `task-grupo-1-fundacao-personalizacao-2026-05-03.prompt.md`
- `task-grupo-2-priorizacao-alavancagem-2026-05-03.prompt.md`
- `.claude/local/plans/produto-proximo-passo.md`

---

## Objetivo

Ajustar a camada narrativa final para linguagem de beneficio (nao tecnica) e implementar o bloco `next_step` com continuidade natural de desejo.

---

## Escopo

1. Ajustar `mvp_pipeline.py` e o relatorio de saida para exibir:
- `first_impression`
- `visual_status`
2. Remover texto tecnico em px da camada principal apresentada ao usuario.
3. Implementar `next_step` com perfis:
- alto
- medio
- baixo
4. Basear `next_step` em score + evolucao (`evolution_path`) seguindo o plano `produto-proximo-passo.md`.
5. Garantir que JSON e TXT finais incluam os novos blocos.

---

## Arquivos-alvo

- `mvp_pipeline.py`
- opcional: novo helper para `build_next_step` (separado)

---

## Regras

- Linguagem orientada a beneficio e continuidade, sem tom agressivo de venda.
- Nao remover metricas tecnicas do JSON bruto; apenas nao exibir no topo narrativo do TXT.
- Manter compatibilidade com outputs existentes.

---

## Criterios de Aceite

- JSON e TXT finais incluem `first_impression`, `visual_status` e `next_step`.
- Relatorio principal nao usa linguagem tecnica em px para comunicacao principal.
- Fluxo de continuidade natural no CTA do proximo passo.
- `pytest tests/` passa sem regressao.

---

## Verificacao

```bash
source .venv/bin/activate
./mvp_pipeline.py depois.png
python -m pytest tests/ -q
```
