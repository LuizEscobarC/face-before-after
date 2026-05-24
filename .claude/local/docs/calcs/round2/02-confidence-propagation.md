---
tenant_id: "face-before-after"
project: "face-before-after"
module: "round2/02-confidence-propagation"
file_path: ".claude/docs/calcs/round2/02-confidence-propagation.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Audit em 2026-05-09. Foco: backend/app/services/metrics/confidencepropagation.py.
tags:
  - "calculations"
rag_keywords:
  - "calcs"
  - "confidence"
  - "docs"
  - "propagation"
  - "round2"
related_modules: []
depends_on: []
used_by: []
---
# Confidence propagation — round 2

> Audit em 2026-05-09. Foco: `backend/app/services/metrics/confidence_propagation.py`.

## Fórmula final (verificada — linha 320-326)

```
conf = confidence_raw
conf *= quality_score                                                        # passo 1
conf *= regional_penalty_factor(region, regional_penalties)                  # passo 2
conf *= pose_penalty(yaw_deg, pitch_deg, pose_params)                        # passo 3
conf *= landmark_stability_penalty(stability_scores, dependency_landmarks)   # passo 4 (PR-23)
conf  = max(0.0, min(1.0, conf))                                             # clip final
```

Composição: **multiplicativa pura** (4 fatores, todos em `[0, 1]`). Não é a forma `1 − Σpᵢ` (aditiva) nem `∏(1 − pᵢ)` (multiplicativa de complementos) — é direto `∏ fatorᵢ`. Cada `fatorᵢ` já entra como "fator de manutenção" (1.0 = sem penalidade, 0.0 = supressão total). Clip aplicado **uma vez**, no final. Esquema correto.

## ❌ Bug real — NaN propagation (severidade alta)

**Arquivo:** `backend/app/services/metrics/confidence_propagation.py`
**Função:** `landmark_stability_penalty` (linhas 233–269)
**Linha do problema:** 267 — `return float(sum(valid) / len(valid))`

### O bug

```python
def landmark_stability_penalty(stability_scores, dependency_landmarks):
    if stability_scores is None or not dependency_landmarks:
        return 1.0
    n = len(stability_scores)
    valid = [stability_scores[i] for i in dependency_landmarks if 0 <= i < n]
    if not valid:
        return 1.0
    return float(sum(valid) / len(valid))   # ← sem proteção contra NaN
```

A lista `valid` pode conter `NaN` em pelo menos um cenário PR-23: par L/R com 1 captura válida só, onde o cálculo upstream de stability gera NaN para o landmark sem amostra suficiente. Quando isso acontece, `sum(valid)` propaga NaN → `propagate()` linha 325 multiplica `conf *= NaN` → `conf = NaN` → linha 326 (`max(0.0, min(1.0, NaN))`) **continua NaN** porque `min(1.0, NaN)` retorna NaN em Python.

### Por que importa

`MetricEvaluation.confidence_final` recebe NaN → persiste em DB → DEC-7 (`< 0.4` suprime overlay) e DEC-8 (`< 0.5` suprime score regional) **falham silenciosamente** porque NaN não satisfaz nenhuma comparação. A métrica é renderizada como se tivesse confiança válida, mas o valor é literalmente "não-um-número".

### Por que não foi pego

- Suite Python (1110 testes) não cobre o branch NaN do PR-23. Os testes de `landmark_stability` injetam scores válidos `[0, 1]`.
- Em produção, NaN só aparece com `capture_count > 1` + landmarks específicos sem amostra. Single-capture sempre retorna 1.0 (linha 257-258, branch `is None`).

### Por que é blocker para PR-22

PR-22 vai rodar 50 fotos reais. Se qualquer uma cair em multi-foto + landmark instável, gera NaN na coluna `confidence_final`. Operador olha planilha de override sem perceber, calibra ideais com base em outliers fantasma, promove para v2.0 com dado contaminado.

### Fix proposto (1 linha, não aplicado nesta iteração)

```python
clean = [v for v in valid if not math.isnan(v)]
if not clean:
    return 1.0
return float(sum(clean) / len(clean))
```

Ou mais defensivo, usando numpy: `return float(np.nanmean(valid))` com guard se todos forem NaN.

## ✅ Outros pontos verificados

- **Floor de confiança:** não existe `min_confidence` (ex: 0.05). `conf` pode ir até 0.0 exato. Aceitável — quando 0.0, gates DEC-7/8 suprimem cleanly.
- **Clipping final** garante `conf ∈ [0, 1]` quando os fatores não geram NaN.
- **`stability_scores is None`** (single-capture) retorna 1.0 — backward compat correto, sem efeito em pipelines pré-PR-23.
- Constante `LOW_CONF_THRESHOLD = 0.4` (linha 33) bate com DEC-7.
