# Task: quality_evaluator.py — UX Fixes #7 #8 #9
**Date:** 2026-05-07
**Module:** vision-service / quality_evaluator
**Type:** fix / UX improvement
**Recommended Execution Model:** sonnet
**Status:** ✅ IMPLEMENTADO

---

## Context

Arquivo alvo: `backend/app/vision/services/quality_evaluator.py`

Três problemas de UX identificados na revisão dos cálculos de `/landmarks`:

### Fix #7 — Score multiplicativo severo: comunicar worst subscore

**Problema:** `pose=0.6 × sharp=0.6 × light=0.6 = 0.216` → REJEITADA, sem explicar ao usuário qual fator derrubou a nota.

**Fix:** Em `_build_recommendations()`, ao final, se a foto foi REJEITADA ou BAIXA, adicionar uma mensagem final identificando qual subscore está mais baixo:
```
"Fator crítico: Nitidez (38%) — mova-se para o local mais iluminado ou estabilize o celular."
```

Mapa de labels por subscore:
- `pose_score` → "Pose"
- `sharpness_score` → "Nitidez"  
- `lighting_score` → "Iluminação"
- `occlusion_score` → "Oclusão"
- `expression_score` → "Expressão"

Só adicionar se o worst subscore < 0.6 **e** o overall_score < 0.55 (BAIXA ou REJEITADA).

---

### Fix #8 — Smile: comunicar que expressão neutra é necessária

**Problema:** `expression_score = 0.85 if smile else 1.0` penaliza sorriso mas não avisa o usuário.

**Fix:** Em `_build_recommendations()`, quando `flags.get("smile")` for True, adicionar antes do `tips[:3]` final:
```
"Mantenha expressão neutra para análise mais precisa."
```

Esta mensagem deve ser **inserida APENAS se não ultrapassar o cap de 3 recomendações** (prioridade baixa — só entra se ainda houver slot).

A função `_build_recommendations` precisa receber `flags: dict` como parâmetro adicional.

---

### Fix #9 — Lighting asymmetry: ramp gradual 15→35

**Problema:** `LIGHTING_ASYM_FLOOR = 35` — score permanece em 1.0 até delta=35, depois cai abruptamente. Mas a recomendação textual já dispara em delta≥15. Inconsistência.

**Fix:** Em `compute_lighting()`, substituir o cliff por ramp gradual:

```python
# Antes (cliff):
if lighting_asymmetry_delta >= LIGHTING_ASYM_FLOOR:
    symmetry_score = 0.0
else:
    symmetry_score = float(1.0 - lighting_asymmetry_delta / LIGHTING_ASYM_FLOOR)

# Depois (ramp gradual a partir de LIGHTING_ASYM_WARN = 15):
LIGHTING_ASYM_WARN = 15.0  # começa a penalizar aqui
# [0, 15] → score = 1.0
# (15, 35] → score linear de 1.0 a 0.0
# > 35 → score = 0.0
```

Adicionar a constante `LIGHTING_ASYM_WARN = 15.0` ao bloco Tunables.

---

## Files affected

| File | Change type |
|------|-------------|
| `backend/app/vision/services/quality_evaluator.py` | modify |

---

## Checklist

- [x] Fix #7: worst subscore identificado em recommendations (só quando score < 0.55)
- [x] Fix #8: mensagem "expressão neutra" quando smile=true (baixa prioridade, se houver slot)
- [x] Fix #9: `LIGHTING_ASYM_WARN = 15.0` + ramp gradual em `compute_lighting()`
- [x] `_build_recommendations()` recebe `flags: dict` adicional
- [x] `evaluate()` passa `flags` para `_build_recommendations()`
- [x] `ast.parse` sem erros após mudanças
- [x] Nenhuma mudança de schema/interface — apenas lógica interna

---

## Acceptance criteria

```bash
cd /home/luizescobal/study/face-before-after && source .venv/bin/activate
python3 -c "
import ast, pathlib
src = pathlib.Path('backend/app/vision/services/quality_evaluator.py').read_text()
ast.parse(src)
# Verify key changes present
assert 'LIGHTING_ASYM_WARN' in src, 'Missing LIGHTING_ASYM_WARN constant'
assert 'Mantenha expressão neutra' in src, 'Missing smile recommendation'
assert 'Fator crítico' in src, 'Missing worst subscore message'
assert 'flags' in src.split('def _build_recommendations')[1][:100], '_build_recommendations must accept flags'
print('✅ All acceptance criteria passed')
"
```
