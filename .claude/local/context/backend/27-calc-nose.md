---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-nose"
file_path: ".claude/local/context/backend/27-calc-nose.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 9 métricas nasais em `services/metrics/nose.py`.
  Usa `NOSE_POSE_PARAMS` (yaw_soft=5, yaw_hard=15, pitch_soft=8, pitch_hard=20, floor=0.18,
  yaw_weight=0.70). Métricas: `nose_length_to_icd` (1.5 ICU), `nose_width_to_icd` (1.0 ICU),
  `alar_to_face_width_ratio` (0.20), `nose_to_mouth_width_ratio` (0.65),
  `dorsum_deviation` (0.0 ICU), `nasal_tip_deviation` (0.0 ICU),
  `alar_base_asymmetry` (0.0 ICU), `nasal_dorsum_straightness` (0.0 ICU),
  `columella_show` (0.05 ICU).
tags:
  - "backend"
  - "nose"
  - "metrics"
rag_keywords:
  - "nose_length_to_icd nose_width_to_icd alar_to_face_width_ratio nose_to_mouth_width_ratio dorsum_deviation nasal_tip_deviation alar_base_asymmetry nasal_dorsum_straightness columella_show"
  - "NOSE_POSE_PARAMS intercanthal_units ratio nariz"
  - "dorsum desvio nasal ponta nasal base alar columela projeção"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Nose (9 métricas)

> **Última atualização:** 2026-05-24

---

## nose_length_to_icd

**Arquivo:** `backend/app/services/metrics/nose.py:~60`

- **unit:** `intercanthal_units`
- **ideal:** `1.5`
- **max_dev:** `0.60`
- **directions:** `neutral` | `long` | `short`
- **pose_params:** `NOSE_POSE_PARAMS`
- **dep lm:** nasion (~lm 6), subnasale (lm 2), lm 133 e 362 (ICD)

```
length = (y_nasion - y_subnasale) / intercanthal_distance
```

---

## nose_width_to_icd

**Arquivo:** `backend/app/services/metrics/nose.py:~85`

- **unit:** `intercanthal_units`
- **ideal:** `1.0`
- **max_dev:** `0.40`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `NOSE_POSE_PARAMS`
- **dep lm:** base alar esquerda (~lm 129), base alar direita (~lm 358)

```
width = |x_alar_r - x_alar_l| / intercanthal_distance
```

---

## alar_to_face_width_ratio

**Arquivo:** `backend/app/services/metrics/nose.py:~110`

- **unit:** `ratio`
- **ideal:** `0.20`
- **max_dev:** `0.12`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `NOSE_POSE_PARAMS`
- **dep lm:** base alar esq/dir (~lm 129/358), borda lateral do rosto (aprox lm 234/454)

```
ratio = alar_width / face_width
```

---

## nose_to_mouth_width_ratio

**Arquivo:** `backend/app/services/metrics/nose.py:~135`

- **unit:** `ratio`
- **ideal:** `0.65`
- **max_dev:** `0.30`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `NOSE_POSE_PARAMS`
- **dep lm:** base alar (~lm 129/358), comissuras labiais (lm 61/291)

```
ratio = alar_width / mouth_width
```

---

## dorsum_deviation

**Arquivo:** `backend/app/services/metrics/nose.py:~160`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.15`
- **directions:** `neutral` | `right_deviation` | `left_deviation`
- **pose_params:** `NOSE_POSE_PARAMS`
- **dep lm:** nasion (~lm 6), ponta nasal (~lm 4), mid-face axis

Desvio lateral do dorso nasal em relação à linha média facial.

---

## nasal_tip_deviation

**Arquivo:** `backend/app/services/metrics/nose.py:~185`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.15`
- **directions:** `neutral` | `right_deviation` | `left_deviation`
- **pose_params:** `NOSE_POSE_PARAMS`
- **dep lm:** ponta nasal (lm 4), linha média calculada entre lm 2 e lm 152

---

## alar_base_asymmetry

**Arquivo:** `backend/app/services/metrics/nose.py:~210`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.15`
- **directions:** `neutral` | `left_wider` | `right_wider`
- **pose_params:** `NOSE_POSE_PARAMS`
- **dep lm:** base alar esq (lm 129) e dir (lm 358), linha média facial

```
asym = (x_midface - x_alar_l) - (x_alar_r - x_midface)
```

---

## nasal_dorsum_straightness

**Arquivo:** `backend/app/services/metrics/nose.py:~235`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.07`
- **directions:** `neutral` | `deviated`
- **pose_params:** `NOSE_POSE_PARAMS`
- **dep lm:** nasion (lm 6), dorso médio (~lm 195), ponta nasal (lm 4)

Mede a curvatura lateral do dorso (desvio do ponto médio em relação à linha reta nasion→tip).

---

## columella_show

**Arquivo:** `backend/app/services/metrics/nose.py:~260`

- **unit:** `intercanthal_units`
- **ideal:** `0.05`
- **max_dev:** `0.15`
- **directions:** `neutral` | `excessive` | `hidden`
- **pose_params:** `NOSE_POSE_PARAMS`
- **dep lm:** subnasale (lm 2), base alar inferior (~lm 129/358), estimativa de columela

Exposição da columela em relação às asas nasais. Ideal = pequena exposição (0.05 ICU). Sensível a pitch; `NOSE_POSE_PARAMS` penaliza pitch elevado.
