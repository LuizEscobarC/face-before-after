# Task: Grupo 5 — Evolucao Curta com Confianca + Validacao Final

**Module:** face-analysis  
**Type:** hardening  
**Slug:** grupo-5-evolucao-confianca-validacao  
**Date:** 2026-05-03  
**Model:** sonnet  
**Depends On:**
- `task-grupo-2-priorizacao-alavancagem-2026-05-03.prompt.md`
- `task-grupo-3-impressao-status-next-step-2026-05-03.prompt.md`
- `task-grupo-4-simulacao-sem-ia-2026-05-03.prompt.md`
- `.claude/plans/produto-compartilhavel.md` (referencia de escopo fora)

---

## Objetivo

Enriquecer `evolution_path.py` com confianca por fase e fechar validacao tecnica completa do pipeline para estado de cobranca do produto de entrada.

---

## Escopo

1. Enriquecer `evolution_path.py` com `confidence` por fase:
- 7 dias
- 30 dias
- 90 dias
2. Calcular confianca combinando:
- severidade
- mutabilidade
- `capture_confidence`
3. Fechar com suite de testes:
- unitarios dos modulos alterados
- integracao end-to-end do pipeline
4. Garantir regressao zero.
5. Manter compartilhavel visual fora do escopo imediato (apenas referenciar plano existente).

---

## Arquivos-alvo

- `evolution_path.py`
- `mvp_pipeline.py`
- `tests/` (novos testes ou ajustes)

---

## Regras

- Nao introduzir dependencia externa desnecessaria.
- Todo campo novo deve ter fallback seguro.
- Nao iniciar implementacao do card compartilhavel visual nesta task.

---

## Criterios de Aceite

- `evolution_path` inclui confianca por fase usando mutabilidade + severidade + confianca de captura.
- Suíte de testes unitarios e integracao passa com regressao zero.
- Pipeline final consistente, testado e pronto para cobranca no produto de entrada.

---

## Verificacao

```bash
source .venv/bin/activate
python -m pytest tests/ -v
./mvp_pipeline.py depois.png
```

Validar no JSON final:
- `evolution_path.phase_1/2/3` com campos de confianca
- blocos finais consistentes (`first_impression`, `visual_status`, `top_leverage`, `top3_actions_v2`, `next_step`)
- referencia de escopo compartilhavel mantida em `.claude/plans/produto-compartilhavel.md`
