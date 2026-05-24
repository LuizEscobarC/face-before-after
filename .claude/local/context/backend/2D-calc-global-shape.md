---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-global-shape"
file_path: ".claude/local/context/backend/2D-calc-global-shape.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 4 métricas de forma global do rosto em `services/metrics/global_shape.py`.
  Usa `GLOBAL_SHAPE_POSE_PARAMS` (yaw_soft=6, yaw_hard=18, pitch_soft=6, pitch_hard=18,
  floor=0.20, yaw_weight=0.50). Métricas: `face_height_to_width_ratio` (1.35),
  `face_shape_classification` (direction = forma: oval/round/square/oblong/heart),
  `total_facial_convexity` (0.98 index_0_1), `e_line_deviation` (0.0 ICU).
tags:
  - "backend"
  - "global_shape"
  - "metrics"
rag_keywords:
  - "face_height_to_width_ratio face_shape_classification total_facial_convexity e_line_deviation"
  - "GLOBAL_SHAPE_POSE_PARAMS ratio index_0_1 intercanthal_units"
  - "forma rosto oval redondo quadrado oblongo coração classificação aspecto"
  - "linha E convexidade facial perfil E-line"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Global Shape (4 métricas)

> **Última atualização:** 2026-05-24

---

## face_height_to_width_ratio

**Arquivo:** `backend/app/services/metrics/global_shape.py:~60`

- **unit:** `ratio`
- **ideal:** `1.35`
- **max_dev:** `0.50`
- **directions:** `neutral` | `elongated` | `wide`
- **pose_params:** `GLOBAL_SHAPE_POSE_PARAMS`
- **dep lm:** altura: trichion (BiSeNet ou lm 10) → mento (lm 152); largura: lm 234 → lm 454

```
aspect = face_height / face_width
```

Base para `face_shape_classification`.

---

## face_shape_classification

**Arquivo:** `backend/app/services/metrics/global_shape.py:~90`

- **unit:** `ratio` (usa mesma escala de `face_height_to_width_ratio`)
- **ideal:** `1.35`
- **max_dev:** `0.50`
- **directions:** `oval` | `round` | `square` | `oblong` | `heart` | `diamond` | `pear`
- **pose_params:** `GLOBAL_SHAPE_POSE_PARAMS`
- **dep lm:** derivado de `face_height_to_width_ratio` + relação zigomática/mandibular/frontal

Não tem `metric_id` distinto — calculado em conjunto com `face_height_to_width_ratio`. A `direction` IS a classificação. Lógica de mapeamento:

```python
if aspect < 1.10:      direction = "round"
elif aspect < 1.25:    direction = "square"   # depende tb de jaw_ratio
elif aspect < 1.50:    direction = "oval"     # forma mais comum
elif aspect < 1.70:    direction = "oblong"
else:                  direction = "elongated"
# heart/diamond/pear: requerem relação malar-jaw-forehead adicional
```

---

## total_facial_convexity

**Arquivo:** `backend/app/services/metrics/global_shape.py:~135`

- **unit:** `index_0_1`
- **ideal:** `0.98`
- **max_dev:** `0.20`
- **directions:** `neutral` | `convex` | `concave`
- **pose_params:** `GLOBAL_SHAPE_POSE_PARAMS`
- **dep lm:** glabela (~lm 9), subnasale (lm 2), pogonion (~lm 152), perfil lateral se disponível

Mede a convexidade do perfil médio-sagital. Calculado como relação entre a distância real dos pontos do perfil e a linha reta entre extremos. Ideal 0.98 = perfil levemente convexo (norma ortognática). Métrica mais afetada por yaw (precisa de perfil aproximadamente frontal).

---

## e_line_deviation

**Arquivo:** `backend/app/services/metrics/global_shape.py:~170`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.08`
- **directions:** `neutral` | `left_deviation` | `right_deviation`
- **pose_params:** `GLOBAL_SHAPE_POSE_PARAMS`
- **dep lm:** `P_NOSE_TIP=1`, `P_MENTON=152`, `P_UPPER_LIP_TOP` (lm 0)

Proxy 2D frontal da linha E de Ricketts: desvio lateral do vermilhão superior em relação ao eixo ponta-nasal→mento.

```
t = (lip_y - tip_y) / (menton_y - tip_y)
axis_x = tip_x + t × (menton_x - tip_x)
deviation = |lip_x - axis_x|   # ICU
```

`left_deviation` se lábio à esquerda do eixo; `right_deviation` se à direita; `neutral` se desvio < 0.015 ICU.
