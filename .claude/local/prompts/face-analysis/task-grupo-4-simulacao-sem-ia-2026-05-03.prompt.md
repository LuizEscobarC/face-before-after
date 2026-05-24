---
tenant_id: "face-before-after"
project: "face-before-after"
module: "face-analysis/task-grupo-4-simulacao-sem-ia-2026-05-03.prompt"
file_path: ".claude/prompts/face-analysis/task-grupo-4-simulacao-sem-ia-2026-05-03.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Module: face-analysis Type: feature Slug: grupo-4-simulacao-sem-ia Date: 2026-05-03 Model: sonnet Depends On: task-grupo-1-fundacao-personalizacao-2026-05-03.prompt.md
tags:
  - "face-analysis"
  - "task-prompt"
rag_keywords:
  - "analysis"
  - "face"
  - "grupo"
  - "prompt"
  - "prompts"
  - "simulacao"
related_modules: []
depends_on: []
used_by: []
---
# Task: Grupo 4 — Antes/Depois Simulado Sem IA Paga no Pipeline

**Module:** face-analysis  
**Type:** feature  
**Slug:** grupo-4-simulacao-sem-ia  
**Date:** 2026-05-03  
**Model:** sonnet  
**Depends On:** `task-grupo-1-fundacao-personalizacao-2026-05-03.prompt.md`

---

## Objetivo

Integrar o modulo `simulate_before_after.py` no fluxo principal sem dependencia de IA paga, com fallback robusto e orientacoes automaticas de captura.

---

## Escopo

1. Integrar `simulate_before_after.py` em `mvp_pipeline.py`.
2. Persistir no JSON os paths de:
- `symmetrized`
- `ideal_proportions`
- `comparison_grid`
3. Adicionar tratamento robusto de erro:
- se simulacao falhar, pipeline continua e registra erro controlado
4. Gerar recomendacoes automaticas de captura (iluminacao, enquadramento, pose) com base em `photo_quality`.

---

## Arquivos-alvo

- `mvp_pipeline.py`
- `simulate_before_after.py` (somente se precisar ajustes de interface)

---

## Regras

- Simulacao nao pode bloquear entrega principal.
- Evitar excecoes nao tratadas na camada de orquestracao.
- Manter sem IA externa, sem APIs pagas.

---

## Criterios de Aceite

- Pipeline gera simulacao quando possivel.
- Em falha, pipeline nao quebra e retorna fallback seguro.
- JSON final contem paths de simulacao ou erro controlado.
- `pytest tests/` continua passando.

---

## Verificacao

```bash
source .venv/bin/activate
./mvp_pipeline.py depois.png
python -m pytest tests/ -q
```
