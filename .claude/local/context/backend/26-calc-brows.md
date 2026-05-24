---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-brows"
file_path: ".claude/local/context/backend/26-calc-brows.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 9 métricas de sobrancelhas em `services/metrics/brows.py`.
  Usa `BROW_POSE_PARAMS` (yaw_soft=5, yaw_hard=15, pitch_soft=8, pitch_hard=20, floor=0.17,
  yaw_weight=0.65). Métricas: `brow_height_l/r` (ideal 0.35 ICU), `brow_arch_peak_l/r`
  (ideal 0.67 ratio), `brow_thickness_l/r` (ideal 0.20 ICU), `brow_tail_drop_l/r`
  (ideal -0.05 ICU), `interbrow_distance_ratio` (ideal 1.0 ICU).
tags:
  - "backend"
  - "brows"
  - "metrics"
rag_keywords:
  - "brow_height brow_arch_peak brow_thickness brow_tail_drop interbrow_distance_ratio"
  - "BROW_POSE_PARAMS intercanthal_units ratio sobrancelha"
  - "ICU 0.35 0.67 0.20 -0.05 pico arco espessura queda cauda distância intersobrancelha"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Brows (9 métricas)

> **Última atualização:** 2026-05-24

---

## brow_height_l

**Arquivo:** `backend/app/services/metrics/brows.py:~60`

- **unit:** `intercanthal_units` (ICU)
- **ideal:** `0.35`
- **max_dev:** `0.20`
- **directions:** `neutral` | `high` | `low`
- **pose_params:** `BROW_POSE_PARAMS`
- **dep lm:** pico da sobrancelha esquerda (~lm 66), canto interno olho esquerdo (lm 133)

```
height = (y_inner_canthus_l - y_brow_peak_l) / intercanthal_distance
```

---

## brow_height_r

**Arquivo:** `backend/app/services/metrics/brows.py:~85`

- **unit:** `intercanthal_units` (ICU)
- **ideal:** `0.35`
- **max_dev:** `0.20`
- **directions:** `neutral` | `high` | `low`
- **pose_params:** `BROW_POSE_PARAMS`
- **dep lm:** pico da sobrancelha direita (~lm 296), canto interno olho direito (lm 362)

Espelho de `brow_height_l`.

---

## brow_arch_peak_l

**Arquivo:** `backend/app/services/metrics/brows.py:~110`

- **unit:** `ratio`
- **ideal:** `0.67`
- **max_dev:** `0.27`
- **directions:** `neutral` | `medial` | `lateral`
- **pose_params:** `BROW_POSE_PARAMS`
- **dep lm:** pontos da sobrancelha esquerda (lm 46, 53, 52, 65, 55 — head to tail)

```
peak_pos = (x_brow_peak - x_brow_head) / (x_brow_tail - x_brow_head)
```

Ideal 0.67 = pico no 2/3 lateral da sobrancelha (estética clássica feminina/masculina).

---

## brow_arch_peak_r

**Arquivo:** `backend/app/services/metrics/brows.py:~135`

- **unit:** `ratio`
- **ideal:** `0.67`
- **max_dev:** `0.27`
- **directions:** `neutral` | `medial` | `lateral`
- **pose_params:** `BROW_POSE_PARAMS`
- **dep lm:** pontos da sobrancelha direita (lm 276, 283, 282, 295, 285 — head to tail)

Espelho de `brow_arch_peak_l`.

---

## brow_thickness_l

**Arquivo:** `backend/app/services/metrics/brows.py:~160`

- **unit:** `intercanthal_units` (ICU)
- **ideal:** `0.20`
- **max_dev:** `0.20`
- **directions:** `neutral` | `thick` | `thin`
- **pose_params:** `BROW_POSE_PARAMS`
- **dep lm:** borda superior (~lm 70) e inferior (~lm 46) da sobrancelha esquerda

```
thickness = (y_brow_inferior - y_brow_superior) / intercanthal_distance
```

---

## brow_thickness_r

**Arquivo:** `backend/app/services/metrics/brows.py:~185`

- **unit:** `intercanthal_units` (ICU)
- **ideal:** `0.20`
- **max_dev:** `0.20`
- **directions:** `neutral` | `thick` | `thin`
- **pose_params:** `BROW_POSE_PARAMS`
- **dep lm:** borda superior (~lm 300) e inferior (~lm 276) da sobrancelha direita

Espelho de `brow_thickness_l`.

---

## brow_tail_drop_l

**Arquivo:** `backend/app/services/metrics/brows.py:~210`

- **unit:** `intercanthal_units` (ICU)
- **ideal:** `-0.05`
- **max_dev:** `0.20`
- **directions:** `neutral` | `elevated_tail` | `dropped_tail`
- **pose_params:** `BROW_POSE_PARAMS`
- **dep lm:** cauda da sobrancelha esquerda (~lm 46 lateral), pico da sobrancelha esquerda

```
tail_drop = (y_brow_tail - y_brow_peak) / intercanthal_distance
```

Ideal -0.05 = cauda levemente acima do pico (brow lift leve). Positivo = cauda caída.

---

## brow_tail_drop_r

**Arquivo:** `backend/app/services/metrics/brows.py:~235`

- **unit:** `intercanthal_units` (ICU)
- **ideal:** `-0.05`
- **max_dev:** `0.20`
- **directions:** `neutral` | `elevated_tail` | `dropped_tail`
- **pose_params:** `BROW_POSE_PARAMS`
- **dep lm:** cauda da sobrancelha direita (~lm 276 lateral), pico da sobrancelha direita

Espelho de `brow_tail_drop_l`.

---

## interbrow_distance_ratio

**Arquivo:** `backend/app/services/metrics/brows.py:~260`

- **unit:** `intercanthal_units` (ICU)
- **ideal:** `1.0`
- **max_dev:** `0.45`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `BROW_POSE_PARAMS`
- **dep lm:** cabeça (início medial) da sobrancelha esquerda (~lm 55) e direita (~lm 285)

```
ratio = |x_brow_head_r - x_brow_head_l| / intercanthal_distance
```

Ideal 1.0 = distância entre cabeças das sobrancelhas igual ao ICD. Valores > 1.0 = sobrancelhas afastadas; < 1.0 = sobrancelhas aproximadas (aspecto raivoso).
