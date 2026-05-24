---
tenant_id: "face-before-after"
project: "face-before-after"
module: "backend/task-bisenet-ideal-proportions-zones-fix-2026-05-12.prompt"
file_path: ".claude/local/prompts/backend/task-bisenet-ideal-proportions-zones-fix-2026-05-12.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Módulo: backend/overlays Tipo: bugfix Data: 2026-05-12 Plano: .claude/local/plans/bisenet-ideal-proportions-zones-fix-2026-05-12.md Modelo recomendado: haiku
tags:
  - "task-prompt"
  - "bisenet"
  - "backend"
  - "ideal-proportions"
rag_keywords:
  - "BiSeNet"
  - "backend"
  - "bisenet"
  - "golden ratio facial"
  - "hair segmentation"
  - "ideal"
  - "ideal proportions"
  - "local"
  - "prompt"
  - "prompts"
  - "proportions"
  - "zones"
related_modules: []
depends_on: []
used_by: []
---
# Task: Fix — IdealProportionsLayer zones ignoravam trichion BiSeNet

**Módulo:** backend/overlays  
**Tipo:** bugfix  
**Data:** 2026-05-12  
**Plano:** `.claude/local/plans/bisenet-ideal-proportions-zones-fix-2026-05-12.md`  
**Modelo recomendado:** haiku  

## Problema

Na view "Proporções Ideais", os seletores interativos (Testa, Terço superior, Terço médio, Terço inferior) mostram valores BiSeNet corretos nas métricas mas os retângulos SVG ficam posicionados errados — o `y_top` é calculado com landmarks MediaPipe Face Mesh em vez do trichion BiSeNet.

## Localização exata

Arquivo: `backend/app/services/overlays/annotations.py`  
Função: `build_ideal_proportions_zones()` — linhas 207-210.

## Fix

Substituir:
```python
ridge_ys = [_xy(lm, idx)[1] for idx in _FOREHEAD_RIDGE if idx < len(lm)]
y_top    = min(ridge_ys) if ridge_ys else _xy(lm, P_FOREHEAD_CROWN)[1]
y_top    = max(0.0, min(y_top, y_brow - 1))
```

Por:
```python
# Deriva y_top de upper_third_ratio — que já usa BiSeNet via effective_trichion_y
y_top = _derive_trichion_y_px(lm, metric_evals)
y_top = max(0.0, min(y_top, y_brow - 1))
```

`_derive_trichion_y_px` já existe no mesmo arquivo (linha 78) e `metric_evals` já é passado como parâmetro na chamada em `pipeline.py`.

## Por que funciona

`_derive_trichion_y_px` extrai o valor de `upper_third_ratio` do JSON de métricas e resolve algebricamente `y_top = (u * y_men - y_brow) / (u - 1)`. Como `upper_third_ratio` foi calculado com `effective_trichion_y` (que usa BiSeNet quando confiança ≥ 0.4), os retângulos ficam geometricamente consistentes com os valores exibidos.

## Verificação

```bash
python -c "from backend.app.services.overlays.annotations import build_ideal_proportions_zones; print('OK')"
```
