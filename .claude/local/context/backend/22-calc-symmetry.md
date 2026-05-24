---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-symmetry"
file_path: ".claude/local/context/backend/22-calc-symmetry.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 5 métricas de simetria facial em `services/metrics/symmetry.py`.
  Usa `SYMMETRY_POSE_PARAMS` (yaw_soft=5, yaw_hard=15, floor=0.20, yaw_weight=0.80)
  e `LOW_CONF_THRESHOLD=0.4`. Métricas: `midline_deviation`, `eye_height_asymmetry`,
  `brow_height_asymmetry`, `lip_canting_angle`, `global_asymmetry_index` (composto
  ponderado com pesos 0.30/0.25/0.25/0.20). Unidades em `intercanthal_units` ou `degrees`.
  `midline_deviation` possui `improvement_vector`.
tags:
  - "backend"
  - "symmetry"
  - "metrics"
rag_keywords:
  - "midline_deviation eye_height_asymmetry brow_height_asymmetry lip_canting_angle global_asymmetry_index"
  - "intercanthal_units symmetry asymmetry ICU degrees"
  - "SYMMETRY_POSE_PARAMS LOW_CONF_THRESHOLD 0.4"
  - "_MIDLINE_SCALE_ICU _EYE_SCALE_ICU _BROW_SCALE_ICU _LIP_SCALE_DEG improvement_vector"
  - "assimetria facial simetria desvio linha média inclinação lábio"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Symmetry (5 métricas)

> **Última atualização:** 2026-05-24

---

## midline_deviation

**Arquivo:** `backend/app/services/metrics/symmetry.py:~60`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.50` (conf_raw → 0 neste desvio)
- **directions:** `neutral` | `right_deviation` | `left_deviation`
- **pose_params:** `SYMMETRY_POSE_PARAMS`
- **dep lm:** `P_NASION` (topo dorso nasal), `P_NOSE_TIP=1`, `P_SUBNASALE=2`, `P_MENTON=152`
- **improvement_vector:** presente — push residual do midline para x=0

Fórmula real (código `_midline_components()`):
```python
xs = [lm.xy(i)[0] for i in (P_NASION, P_NOSE_TIP, P_SUBNASALE, P_MENTON)]
value = mean(|x_i|)   # média dos desvios absolutos em ICU
conf_raw = max(0.0, 1.0 - value / 0.5)
```

`_MIDLINE_SCALE_ICU = 0.15` é usado apenas pelo `global_asymmetry_index` (normalização do componente composto), não pela conf_raw desta métrica.

---

## eye_height_asymmetry

**Arquivo:** `backend/app/services/metrics/symmetry.py:~100`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.30`
- **directions:** `neutral` | `left_higher` | `right_higher`
- **pose_params:** `SYMMETRY_POSE_PARAMS`
- **dep lm:** centro vertical da fissura palpebral esquerda (lm 159, 145) e direita (lm 386, 374)

Escala: `_EYE_SCALE_ICU = 0.10`.

```
raw = (eye_center_y_left - eye_center_y_right) / intercanthal_distance
```

---

## brow_height_asymmetry

**Arquivo:** `backend/app/services/metrics/symmetry.py:~135`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.40`
- **directions:** `neutral` | `left_higher` | `right_higher`
- **pose_params:** `SYMMETRY_POSE_PARAMS`
- **dep lm:** pico de arco superciliar esquerdo (~lm 66) e direito (~lm 296)

Escala: `_BROW_SCALE_ICU = 0.12`.

---

## lip_canting_angle

**Arquivo:** `backend/app/services/metrics/symmetry.py:~170`

- **unit:** `degrees`
- **ideal:** `0.0`
- **max_dev:** `30.0`
- **directions:** `neutral` | `left_higher` | `right_higher`
- **pose_params:** `SYMMETRY_POSE_PARAMS`
- **dep lm:** comissuras labiais esquerda (lm 61) e direita (lm 291)

Escala de normalização: `_LIP_SCALE_DEG = 5.0`.

```
angle = atan2(y_right_commissure - y_left_commissure,
              x_right_commissure - x_left_commissure) * 180 / π
```

---

## global_asymmetry_index

**Arquivo:** `backend/app/services/metrics/symmetry.py:~210`

- **unit:** `index_0_1`
- **ideal:** `0.0`
- **max_dev:** `composite` (determinado pelas 4 componentes)
- **directions:** `neutral` | `asymmetric`
- **pose_params:** `SYMMETRY_POSE_PARAMS`
- **dep lm:** herdados das 4 métricas componentes

Índice composto ponderado. Pesos normalizados somam 1.0:

```python
value = min(1.0, 0.30 × (midline / _MIDLINE_SCALE_ICU)
                + 0.25 × (eye    / _EYE_SCALE_ICU)
                + 0.25 × (brow   / _BROW_SCALE_ICU)
                + 0.20 × (lip    / _LIP_SCALE_DEG))

# confidence_raw = MÉDIA PONDERADA (não mínimo)
conf_raw = 0.30 × conf_midline + 0.25 × conf_eye
         + 0.25 × conf_brow   + 0.20 × conf_lip
```

`confidence_final` segue o mesmo `propagate()` das outras métricas. Não é o mínimo — é média ponderada pelos mesmos pesos.
