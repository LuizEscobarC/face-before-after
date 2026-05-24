---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-mouth"
file_path: ".claude/local/context/backend/28-calc-mouth.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 7 métricas labiais em `services/metrics/mouth.py`.
  Usa `MOUTH_POSE_PARAMS` (yaw_soft=6, yaw_hard=16, pitch_soft=8, pitch_hard=20, floor=0.18,
  yaw_weight=0.60). Métricas: `mouth_width_to_icd` (1.50 ICU), `mouth_to_face_width_ratio`
  (0.30), `upper_lip_height_ratio` (0.40), `lower_lip_height_ratio` (0.60),
  `vermilion_height_total` (0.55 ICU), `lip_corner_canting` (0.0 ICU),
  `mouth_midline_deviation` (0.0 ICU).
tags:
  - "backend"
  - "mouth"
  - "metrics"
rag_keywords:
  - "mouth_width_to_icd mouth_to_face_width_ratio upper_lip_height_ratio lower_lip_height_ratio vermilion_height_total lip_corner_canting mouth_midline_deviation"
  - "MOUTH_POSE_PARAMS intercanthal_units ratio boca lábio"
  - "vermilion altura lábio comissura desvio linha média labial"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Mouth (7 métricas)

> **Última atualização:** 2026-05-24

---

## mouth_width_to_icd

**Arquivo:** `backend/app/services/metrics/mouth.py:~60`

- **unit:** `intercanthal_units`
- **ideal:** `1.50`
- **max_dev:** `0.60`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `MOUTH_POSE_PARAMS`
- **dep lm:** comissura labial esquerda (lm 61), comissura labial direita (lm 291)

```
width = |x_commissure_r - x_commissure_l| / intercanthal_distance
```

---

## mouth_to_face_width_ratio

**Arquivo:** `backend/app/services/metrics/mouth.py:~85`

- **unit:** `ratio`
- **ideal:** `0.30`
- **max_dev:** `0.16`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `MOUTH_POSE_PARAMS`
- **dep lm:** lm 61, lm 291, bordas laterais do rosto (~lm 234/454)

```
ratio = mouth_width / face_width
```

---

## upper_lip_height_ratio

**Arquivo:** `backend/app/services/metrics/mouth.py:~110`

- **unit:** `ratio`
- **ideal:** `0.40`
- **max_dev:** `0.20`
- **directions:** `neutral` | `tall` | `short`
- **pose_params:** `MOUTH_POSE_PARAMS`
- **dep lm:** columela base (~lm 2), tubérculo labial superior (~lm 0), junção vermilhão-pele superior

```
upper_ratio = upper_vermilion_height / total_vermilion_height
```

---

## lower_lip_height_ratio

**Arquivo:** `backend/app/services/metrics/mouth.py:~135`

- **unit:** `ratio`
- **ideal:** `0.60`
- **max_dev:** `0.20`
- **directions:** `neutral` | `tall` | `short`
- **pose_params:** `MOUTH_POSE_PARAMS`
- **dep lm:** junção vermilhão-pele inferior, mento (~lm 17)

```
lower_ratio = lower_vermilion_height / total_vermilion_height
```

Complemento de `upper_lip_height_ratio` (somam 1.0).

---

## vermilion_height_total

**Arquivo:** `backend/app/services/metrics/mouth.py:~160`

- **unit:** `intercanthal_units`
- **ideal:** `0.55`
- **max_dev:** `0.40`
- **directions:** `neutral` | `tall` | `short`
- **pose_params:** `MOUTH_POSE_PARAMS`
- **dep lm:** borda superior vermilhão (~lm 0/13), borda inferior vermilhão (~lm 14/17)

```
total = (y_vermilion_lower - y_vermilion_upper) / intercanthal_distance
```

---

## lip_corner_canting

**Arquivo:** `backend/app/services/metrics/mouth.py:~185`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.15`
- **directions:** `neutral` | `left_higher` | `right_higher`
- **pose_params:** `MOUTH_POSE_PARAMS`
- **dep lm:** lm 61 (comissura esq), lm 291 (comissura dir)

```
canting = (y_commissure_l - y_commissure_r) / intercanthal_distance
```

Análogo a `lip_canting_angle` da família symmetry, porém em ICU em vez de graus.

---

## mouth_midline_deviation

**Arquivo:** `backend/app/services/metrics/mouth.py:~210`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.15`
- **directions:** `neutral` | `right_deviation` | `left_deviation`
- **pose_params:** `MOUTH_POSE_PARAMS`
- **dep lm:** ponto médio entre lm 61/291, linha média facial (via lm 2, 4, 152)

```
dev = x_mouth_center - x_midface_axis
```

Desvio lateral do centro da boca em relação à linha média facial.
