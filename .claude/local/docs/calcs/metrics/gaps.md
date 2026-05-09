# Data Quality Gaps — Métricas faciais

> **Round 1 detectado em:** 2026-05-09 (1 gap menor)
> **Round 2 detectado em:** 2026-05-09 (1 bug + 2 fragilidades + 5 fallbacks)
> **Status global:** ver tabela abaixo

---

## Tabela mestre

| # | Severidade | Local | Resumo | Bloqueia PR-22? |
|---|---|---|---|---|
| 1 | ⚠️ menor | `jaw.py:271` | `mandibular_plane_angle` atan2 não-normalizado | não |
| 2 | ❌ alta | `confidence_propagation.py:267` | NaN propagation em `landmark_stability_penalty` | **SIM** |
| 3 | ⚠️ média | `heatmap_renderer.py` (cubic griddata) | Runge phenomenon sem clamp pós-interpolação | não |
| 4 | ⚠️ média | `before_ideal_composer.py:207-212` | Magnitude cap por componente vs por norma | não |
| 5 | ⚠️ alta | 5 calculadores (forehead/cheekbones/global_shape) | Fallback `value=0.0` com `confidence` moderada — mascara landmark ruim | recomendado |

---

## Summary

`MandibularPlaneAngleCalculator` usa `atan2(dy, dx)` que retorna em `[−π, π]` convertido para graus dá `[−180, 180]`. Para um ângulo de **linha** (não vetor direcional), o range correto é `[0, 180°]` ou tomar o valor absoluto. Como o valor ideal é 27° e a configuração geométrica força sempre quadrante positivo na prática, o bug não foi observado em testes — mas é uma fragilidade.

---

## Fields Affected

| Field | Expected | Actual | Diff | Type |
|-------|----------|--------|------|------|
| `mandibular_plane_angle` | range [0°, 180°] | range [−180°, 180°] | 0° em uso típico | ⚠️ structural gap |

---

## Root Cause

`atan2(dy, dx)` é a fórmula canônica para o ângulo de um **vetor** orientado (origem→destino). Usar para o ângulo de uma **linha** (sem orientação) precisa de `abs()` ou normalização modular para `[0, 180°]`. A literatura cefalométrica trata o plano mandibular como linha — Steiner reporta valores no intervalo `[20°, 35°]`, sempre positivos.

Em prática, a configuração `gonion → menton` em rosto normal (com pose neutra) sempre gera dy > 0 e dx pequeno (perto da vertical) → atan2 cai no primeiro quadrante. O bug só apareceria com landmarks invertidos (rosto de cabeça pra baixo) ou pose extrema.

---

## Impact

- **Funcional:** zero observado (1110 testes Python passam).
- **Robustez:** falha potencial em pose-anomalia ou landmark mal-detectado.
- **Confiança:** valor reportado pode virar negativo silenciosamente; o `confidence_propagation` atual não detecta.

---

## What Cannot Be Fixed

Pode ser corrigido — é trivial. Não foi corrigido neste audit porque:
1. Audit é read-only por escolha (`integration-prober` é quem corrige).
2. Risco zero observado.
3. Decisão do operador se vale uma migration de `metric_evaluation` re-roda.

---

## Workaround / Recommendation

**Fix proposto (1 linha):**
```python
angle_deg = abs(math.degrees(math.atan2(dy, dx)))
# ou
angle_deg = math.degrees(math.atan2(abs(dy), abs(dx)))
```

**Decisão recomendada:** aplicar em PR-22 (calibração), pois junto com 50 fotos reais qualquer caso atípico saltaria. Antes disso, baixa prioridade.

---

# Gap #2 — NaN propagation em `landmark_stability_penalty` ❌ (alta)

> **Round:** 2
> **Status:** bug real, **bloqueia PR-22**

## Summary

`backend/app/services/metrics/confidence_propagation.py:267` computa média aritmética de `stability_scores` sem nenhum guard contra NaN. Se algum elemento for NaN (cenário plausível em multi-foto PR-23 com par L/R sem amostras suficientes), o resultado propaga até `MetricEvaluation.confidence_final` no DB, e os gates DEC-7 / DEC-8 falham silenciosamente porque comparações com NaN nunca disparam.

## Fields Affected

| Field | Expected | Actual | Type |
|-------|----------|--------|------|
| `confidence_final` | float ∈ [0, 1] | NaN possível em multi-foto | ❌ bug |

## Root Cause

```python
# linha 267
return float(sum(valid) / len(valid))
```

`sum([0.9, NaN, 0.95])` = NaN → multiplica `conf` em `propagate()` linha 325 → clip final (linha 326) `max(0.0, min(1.0, NaN))` retorna NaN em Python.

## Por que bloqueia PR-22

50 fotos reais em multi-foto vão expor o branch. Operador calibra ideais com base em rows com `confidence_final = NaN`, contamina v2.0.

## Workaround

Fix de 1 linha:

```python
clean = [v for v in valid if not math.isnan(v)]
if not clean:
    return 1.0
return float(sum(clean) / len(clean))
```

Ou via numpy: `return float(np.nanmean(valid))` com guard.

## What Cannot Be Fixed

Nada — o fix é trivial. Apenas exige PR separado antes de PR-22.

---

# Gap #3 — Runge phenomenon em griddata cubic ⚠️ (média)

> **Round:** 2
> **Status:** fragilidade estrutural, fix opcional

## Summary

`heatmap_renderer.py` usa `scipy.interpolate.griddata(method='cubic')` sem clamp pós-interpolação. Cubic pode oscilar abaixo do mínimo das amostras — o colormap `adherence_sequential` (range [0, 1]) recebe `t < 0` e renderiza RGB indefinido.

## Fields Affected

| Field | Expected | Actual | Type |
|-------|----------|--------|------|
| pixel RGB do heatmap `adherence_sequential` | mapped from [0, 1] | possível t<0 → RGB indefinido | ⚠️ |

## Root Cause

Oscilação cúbica clássica de Runge entre amostras agrupadas. `fill_value=NaN` cobre extrapolação fora do convex hull, não cobre oscilação interna. Suite de 12 testes não cobre input com cluster denso de samples baixas.

## Workaround

Após griddata, antes do colormap:

```python
grid = np.clip(grid, lo, hi)
```

Custo: 1 linha por renderer.

---

# Gap #4 — Magnitude cap por componente vs por norma ⚠️ (média)

> **Round:** 2
> **Status:** ambiguidade de spec, decisão editorial

## Summary

`before_ideal_composer.py:207-212` (`_clip_offset`) aplica cap **por eixo** (`dx ∈ [-0.3, 0.3]`, `dy ∈ [-0.3, 0.3]`). Spec PLAN_M3_OVERLAYS DEC-26 diz "magnitude cap ±0.3 ICU" — leitura natural é norma euclidiana. Offset (0.3, 0.3) tem norma 0.424 > 0.3 mas passa íntegro.

## Fields Affected

| Field | Expected | Actual | Type |
|-------|----------|--------|------|
| offset magnitude no composer | norma ≤ 0.3 ICU | norma até ~0.424 ICU em casos diagonais | ⚠️ |

## Workaround

Decisão editorial:

(a) Atualizar spec para "per-axis cap" — código atual cumpre, sem mudança.

(b) Trocar para norma euclidiana:
```python
norm = math.hypot(dx, dy)
if norm > 0.3:
    scale = 0.3 / norm
    dx, dy = dx * scale, dy * scale
```

Não corrompe dado, só afeta cosmética em diagonais raras.

---

# Gap #5 — Fallback `value=0.0` mascara landmark ruim ⚠️ (alta)

> **Round:** 2
> **Status:** fragilidade estrutural, fix recomendado antes/junto com PR-22

## Summary

5 calculadores usam o padrão `v = a / b if b > 1e-9 else 0.0`. Quando o denominador colapsa (foto borrada, oclusão, hairline cortado), retornam `value=0.0` e `_conf_raw(0.0, ideal, tol)` produz confiança 0.7-0.95 — métrica passa pelos gates DEC-7/8 como se a região tivesse sido medida com sucesso.

## Fields Affected

| metric_id | arquivo:linha | conf_raw mascarado |
|---|---|---|
| `forehead_width_ratio` | `forehead.py:181` | 0.767 |
| `temporal_width_ratio` | `forehead.py:216` | 0.75 |
| `malar_projection_index` | `cheekbones.py:204` | 0.733 |
| `cheekbone_to_jaw_ratio` | `cheekbones.py:269` | ~0.94 |
| `face_height_to_width_ratio` | `global_shape.py:224` | 0.8 |

## Root Cause

Branch `else 0.0` no path degenerate seguido de cálculo de confiança que não conhece o contexto degenerate. Diferente de `phi_golden.py` (que retorna `_null_mv` com confidence=0).

## Workaround

Padrão de fix uniforme — replicar `_null_mv`:

```python
if denominator <= 1e-9:
    return _null_mv(...)   # value=None, confidence=0
v = numerator / denominator
```

## Por que recomendado antes/junto com PR-22

PR-22 vai rodar 50 fotos reais. Fotos com hairline cortado, ângulo lateral ou oclusão vão disparar esses branches. Score regional inclui valores fictícios, ideal calibrado contra outliers fantasma.
