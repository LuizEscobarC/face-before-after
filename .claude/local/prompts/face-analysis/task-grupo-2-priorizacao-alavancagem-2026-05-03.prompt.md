---
tenant_id: "face-before-after"
project: "face-before-after"
module: "face-analysis/task-grupo-2-priorizacao-alavancagem-2026-05-03.prompt"
file_path: ".claude/prompts/face-analysis/task-grupo-2-priorizacao-alavancagem-2026-05-03.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Module: face-analysis Type: refactor Slug: grupo-2-priorizacao-alavancagem Date: 2026-05-03 Model: sonnet Depends On: task-grupo-1-fundacao-personalizacao-2026-05-03.prompt.md
tags:
  - "face-analysis"
  - "task-prompt"
rag_keywords:
  - "alavancagem"
  - "analysis"
  - "face"
  - "grupo"
  - "priorizacao"
  - "prompt"
  - "prompts"
related_modules: []
depends_on: []
used_by: []
---
# Task: Grupo 2 — Motor Unico de Priorizacao e Alavancagem

**Module:** face-analysis  
**Type:** refactor  
**Slug:** grupo-2-priorizacao-alavancagem  
**Date:** 2026-05-03  
**Model:** sonnet  
**Depends On:** `task-grupo-1-fundacao-personalizacao-2026-05-03.prompt.md`

---

## Objetivo

Consolidar o motor de priorizacao para que a narrativa de produto tenha uma unica hierarquia oficial de acoes, mantendo consistencia tecnica e social.

---

## Escopo

1. Calibrar cobertura de ideais/tolerancias em `face_metrics.py` (`ADVANCED_IDEALS`) para todas as metricas usadas por:
- `top_leverage.py`
- `visual_status.py`
2. Manter formula de alavancagem:
- `social_perception_weight × normalized_deviation`
3. Adicionar `confidence_score` na recomendacao principal em `top_leverage.py`.
4. Tornar `top3_actions_v2` a hierarquia oficial no output de produto.
5. Manter `top_3_actions` antigo apenas como debug interno (sem competir na narrativa final).

---

## Arquivos-alvo

- `face_metrics.py`
- `top_leverage.py`
- `mvp_pipeline.py`

---

## Regras

- Nao quebrar testes existentes de `top_leverage`.
- Preservar estrutura de retorno para compatibilidade; adicionar campos sem remover os antigos.
- Se uma metrica nao tiver ideal confiavel, explicitar fallback e nao inflar score.

---

## Criterios de Aceite

- Uma unica narrativa de priorizacao no output final (sem conflito entre ranking antigo e novo).
- `top_leverage` retorna `confidence_score`.
- `top3_actions_v2` orienta o ranking principal exibido para usuario.
- `pytest tests/` passa sem regressao.

---

## Verificacao

```bash
source .venv/bin/activate
python -m pytest tests/test_top_leverage.py -v
python -m pytest tests/test_visual_status.py -v
python -m pytest tests/ -q
```
