---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-eyes"
file_path: ".claude/local/context/backend/25-calc-eyes.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 10 métricas oculares em `services/metrics/eyes.py`.
  Usa `EYES_POSE_PARAMS` (yaw_soft=5, yaw_hard=15, pitch_soft=5, pitch_hard=15, floor=0.20,
  yaw_weight=0.60). Métricas: `eye_aperture_ratio_l/r` (ideal 0.30), `interpupillary_distance`
  (2.0 ICU), `intercanthal_distance` (1.0 ICU), `canthal_tilt_l/r` (0.0°),
  `scleral_show_lower_l/r` (0.0 ICU), `palpebral_fissure_inclination` (2.0°),
  `supratarsal_fold_visibility` (stub DEC-10, requires_pixel_analysis=True).
tags:
  - "backend"
  - "eyes"
  - "metrics"
rag_keywords:
  - "eye_aperture_ratio intercanthal_distance interpupillary_distance canthal_tilt scleral_show palpebral_fissure supratarsal_fold"
  - "EYES_POSE_PARAMS intercanthal_units degrees ratio"
  - "fissura palpebral inclinação cantal show escleral dobra supratarsal"
  - "requires_pixel_analysis DEC-10 stub presentation_only"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Eyes (10 métricas)

> **Última atualização:** 2026-05-24

---

## eye_aperture_ratio_l

**Arquivo:** `backend/app/services/metrics/eyes.py:~65`

- **unit:** `ratio`
- **ideal:** `0.30`
- **max_dev:** `0.30`
- **directions:** `neutral` | `open` | `narrow`
- **pose_params:** `EYES_POSE_PARAMS`
- **dep lm:** lm 159 (pálpebra sup esq), lm 145 (pálpebra inf esq), lm 33 e lm 133 (cantos horizontais esq)

```
aperture = vertical_fissure_height / horizontal_fissure_width
```

---

## eye_aperture_ratio_r

**Arquivo:** `backend/app/services/metrics/eyes.py:~90`

- **unit:** `ratio`
- **ideal:** `0.30`
- **max_dev:** `0.30`
- **directions:** `neutral` | `open` | `narrow`
- **pose_params:** `EYES_POSE_PARAMS`
- **dep lm:** lm 386 (pálpebra sup dir), lm 374 (pálpebra inf dir), lm 362 e lm 263 (cantos horizontais dir)

Espelho de `eye_aperture_ratio_l` para o olho direito.

---

## interpupillary_distance

**Arquivo:** `backend/app/services/metrics/eyes.py:~115`

- **unit:** `intercanthal_units`
- **ideal:** `2.0`
- **max_dev:** `1.0`
- **directions:** `neutral` | `wide_set` | `close_set`
- **pose_params:** `EYES_POSE_PARAMS`
- **dep lm:** centros pupilares estimados como ponto médio horizontal da fissura palpebral (lm 33+133)/2 esq e (lm 362+263)/2 dir

```
ipd = |x_pupil_left - x_pupil_right| / intercanthal_distance
```

---

## intercanthal_distance

**Arquivo:** `backend/app/services/metrics/eyes.py:~140`

- **unit:** `intercanthal_units`
- **ideal:** `1.0`
- **max_dev:** `0.20`
- **directions:** `neutral` | `dilated` | `compressed`
- **pose_params:** `EYES_POSE_PARAMS`
- **dep lm:** lm 133 (canto interno esq), lm 362 (canto interno dir)

ICD é a própria referência de normalização em ICU; ao medir em ICU, sempre = 1.0 por definição — a métrica aqui monitora a validade da normalização cruzada.

---

## canthal_tilt_l

**Arquivo:** `backend/app/services/metrics/eyes.py:~165`

- **unit:** `degrees`
- **ideal:** `0.0`
- **max_dev:** `20.0`
- **directions:** `neutral` | `positive` | `negative`
- **pose_params:** `EYES_POSE_PARAMS`
- **dep lm:** lm 33 (canto externo esq), lm 133 (canto interno esq)

```
tilt = atan2(y_medial - y_lateral, x_lateral - x_medial) * 180 / π
```

Positivo = canto externo mais alto (fox-eye). Negativo = canto externo mais baixo.

---

## canthal_tilt_r

**Arquivo:** `backend/app/services/metrics/eyes.py:~190`

- **unit:** `degrees`
- **ideal:** `0.0`
- **max_dev:** `20.0`
- **directions:** `neutral` | `positive` | `negative`
- **pose_params:** `EYES_POSE_PARAMS`
- **dep lm:** lm 362 (canto interno dir), lm 263 (canto externo dir)

Espelho de `canthal_tilt_l`.

---

## scleral_show_lower_l

**Arquivo:** `backend/app/services/metrics/eyes.py:~215`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.05`
- **directions:** `neutral` | `scleral_show`
- **pose_params:** `EYES_POSE_PARAMS`
- **dep lm:** lm 145 (pálpebra inf esq), estimativa de posição da íris inferior

Mede exposição escleral inferior esquerda. Valores > 0 indicam show escleral.

---

## scleral_show_lower_r

**Arquivo:** `backend/app/services/metrics/eyes.py:~235`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.05`
- **directions:** `neutral` | `scleral_show`
- **pose_params:** `EYES_POSE_PARAMS`
- **dep lm:** lm 374 (pálpebra inf dir), estimativa de posição da íris inferior

Espelho de `scleral_show_lower_l`.

---

## palpebral_fissure_inclination

**Arquivo:** `backend/app/services/metrics/eyes.py:~260`

- **unit:** `degrees`
- **ideal:** `2.0`
- **max_dev:** `8.0`
- **directions:** `neutral` | `upward` | `downward`
- **pose_params:** `EYES_POSE_PARAMS`
- **dep lm:** média dos canthal tilts esquerdo e direito

Média aritmética de `canthal_tilt_l` e `canthal_tilt_r`. Ideal = 2° (leve inclinação positiva é considerada estética).

---

## supratarsal_fold_visibility

**Arquivo:** `backend/app/services/metrics/eyes.py:~285`

- **unit:** `index_0_1`
- **ideal:** — (não calibrado)
- **max_dev:** — (não calibrado)
- **directions:** — (stub)
- **pose_params:** `EYES_POSE_PARAMS`
- **dep lm:** região palpebral superior — requer análise de pixel

> **STUB DEC-10** — `requires_pixel_analysis=True`. Não calculado no pipeline atual (landmark-only). Retorna `MetricValue` com `is_low_confidence=True` e `confidence_final=0.0`. Reservado para futura integração com segmentação de pálpebra.
