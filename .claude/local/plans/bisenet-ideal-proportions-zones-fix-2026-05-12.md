# Plan: Fix — IdealProportionsLayer zones ignoravam trichion BiSeNet

**Data:** 2026-05-12  
**Módulo:** backend/overlays + frontend/IdealProportionsLayer  
**Tipo:** bugfix  

## Contexto

Na view "Proporções Ideais", os seletores interativos (Testa, Terço superior, Terço médio, Terço inferior) são retângulos SVG gerados pela função `build_ideal_proportions_zones()` no backend. Essa função calculava `y_top` (topo da testa) como o `min` dos y de 12 landmarks da crista MediaPipe Face Mesh — ignorando o trichion BiSeNet que já estava sendo usado nas métricas (`upper_third_ratio`, `forehead_height_ratio`) via `effective_trichion_y` / `_derive_trichion_y_px`.

**Sintoma:** Os retângulos visuais ficavam desalinhados com os valores das métricas (o valor mostrava a testa BiSeNet, o retângulo mostrava a crista MediaPipe).

## Root cause

`build_ideal_proportions_zones()` em `annotations.py` linha 207-210:
```python
# ANTES (errado)
ridge_ys = [_xy(lm, idx)[1] for idx in _FOREHEAD_RIDGE if idx < len(lm)]
y_top    = min(ridge_ys) if ridge_ys else _xy(lm, P_FOREHEAD_CROWN)[1]
y_top    = max(0.0, min(y_top, y_brow - 1))
```

## Fix aplicado

```python
# DEPOIS (correto)
y_top = _derive_trichion_y_px(lm, metric_evals)
y_top = max(0.0, min(y_top, y_brow - 1))
```

`_derive_trichion_y_px` deriva `y_top` algebricamente de `upper_third_ratio` — que já contém o trichion BiSeNet — garantindo consistência entre os valores e a geometria visual.

## Arquivos modificados

| Arquivo | Ação |
|---------|------|
| `backend/app/services/overlays/annotations.py` | `build_ideal_proportions_zones`: substituído cálculo forehead ridge por `_derive_trichion_y_px` |

## Verificação

```bash
python -c "from backend.app.services.overlays.annotations import build_ideal_proportions_zones; print('OK')"
# OK ✅
```

## Recommended Execution Model

`haiku`
