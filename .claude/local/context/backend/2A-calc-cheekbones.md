---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-cheekbones"
file_path: ".claude/local/context/backend/2A-calc-cheekbones.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 5 métricas de maçãs do rosto em `services/metrics/cheekbones.py`.
  Usa `CHEEKBONE_POSE_PARAMS` (yaw_soft=5, yaw_hard=15, pitch_soft=6, pitch_hard=18,
  floor=0.17, yaw_weight=0.75). Métricas: `zygomatic_width_ratio` (4.00 ICU),
  `malar_projection_index` (1.33), `midface_height_ratio` (1.50 ICU),
  `cheekbone_to_jaw_ratio` (1.25), `submalar_hollow_index` (0.10).
tags:
  - "backend"
  - "cheekbones"
  - "metrics"
rag_keywords:
  - "zygomatic_width_ratio malar_projection_index midface_height_ratio cheekbone_to_jaw_ratio submalar_hollow_index"
  - "CHEEKBONE_POSE_PARAMS intercanthal_units ratio maçã do rosto zigoma malar"
  - "projeção malar largura zigomática altura meia-face relação malar-mandibular hollow submalar"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Cheekbones (5 métricas)

> **Última atualização:** 2026-05-24

---

## zygomatic_width_ratio

**Arquivo:** `backend/app/services/metrics/cheekbones.py:~60`

- **unit:** `intercanthal_units`
- **ideal:** `4.00`
- **max_dev:** `1.50`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `CHEEKBONE_POSE_PARAMS`
- **dep lm:** projeção zigomática esq/dir (estimada via lm 234 e lm 454, ajustada para arco zigomático)

```
ratio = zygomatic_width / intercanthal_distance
```

---

## malar_projection_index

**Arquivo:** `backend/app/services/metrics/cheekbones.py:~85`

- **unit:** `ratio`
- **ideal:** `1.33`
- **max_dev:** `0.50`
- **directions:** `neutral` | `projected` | `flat`
- **pose_params:** `CHEEKBONE_POSE_PARAMS`
- **dep lm:** ponto de maior projeção malar lateral (estimado) vs largura orbitária

```
index = malar_width / orbital_width
```

Relação entre a largura na região malar e a largura orbitária. Ideal 1.33 = maçã projeta ~33% além da órbita.

---

## midface_height_ratio

**Arquivo:** `backend/app/services/metrics/cheekbones.py:~110`

- **unit:** `intercanthal_units`
- **ideal:** `1.50`
- **max_dev:** `1.00`
- **directions:** `neutral` | `tall` | `short`
- **pose_params:** `CHEEKBONE_POSE_PARAMS`
- **dep lm:** glabela (~lm 9), subnasale (lm 2), ICD (lm 133/362)

```
ratio = (y_glabella - y_subnasale) / intercanthal_distance
```

Altura do terço médio em ICU.

---

## cheekbone_to_jaw_ratio

**Arquivo:** `backend/app/services/metrics/cheekbones.py:~135`

- **unit:** `ratio`
- **ideal:** `1.25`
- **max_dev:** `0.40`
- **directions:** `neutral` | `dominant_cheek` | `dominant_jaw`
- **pose_params:** `CHEEKBONE_POSE_PARAMS`
- **dep lm:** largura zigomática (lm 234/454), largura mandibular (`P_LEFT_GONION=58`, `P_RIGHT_GONION=288`)

```
ratio = zygomatic_width / jaw_width
```

Ideal 1.25 = maçãs 25% mais largas que mandíbula (rosto em V/oval/coração).

---

## submalar_hollow_index

**Arquivo:** `backend/app/services/metrics/cheekbones.py:~160`

- **unit:** `ratio`
- **ideal:** `0.10`
- **max_dev:** `0.30`
- **directions:** `neutral` | `hollow` | `full`
- **pose_params:** `CHEEKBONE_POSE_PARAMS`
- **dep lm:** região submalar estimada entre ponto malar e ângulo mandibular (lm 58/288)

Índice proxy de concavidade submalar. Calculado como desvio do contorno facial abaixo do ponto malar em relação à linha reta malar→gonion. Valores > 0.10 = hollow submalar progressivo; < 0.10 = face cheia.
