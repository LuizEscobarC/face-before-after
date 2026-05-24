---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-fifths"
file_path: ".claude/local/context/backend/24-calc-fifths.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 6 métricas de quintos faciais em `services/metrics/fifths.py`.
  Usa `FIFTHS_POSE_PARAMS` com `yaw_weight=0.90` — família mais sensível a yaw entre todas.
  Métricas: `fifth_1_ratio` a `fifth_5_ratio` (ideal 0.20 cada, eixo horizontal) e
  `intercanthal_to_eye_width_ratio` (ideal 1.0). Unidade `ratio`. Directions:
  `neutral/wide/narrow`. Quintos laterais (1, 5) colapsam com yaw elevado.
tags:
  - "backend"
  - "fifths"
  - "metrics"
rag_keywords:
  - "fifth_1_ratio fifth_2_ratio fifth_3_ratio fifth_4_ratio fifth_5_ratio intercanthal_to_eye_width_ratio"
  - "FIFTHS_POSE_PARAMS yaw_weight 0.90 quintos faciais"
  - "ratio 0.20 ideal neutral wide narrow"
  - "canto lateral medial canthal intercanthal face width quintos"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Fifths (6 métricas)

> **Última atualização:** 2026-05-24

---

## fifth_1_ratio

**Arquivo:** `backend/app/services/metrics/fifths.py:~60`

- **unit:** `ratio`
- **ideal:** `0.20`
- **max_dev:** `0.10`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `FIFTHS_POSE_PARAMS` (`yaw_weight=0.90`)
- **dep lm:** borda lateral do rosto esquerda (aprox lm 234) até canto externo do olho esquerdo (lm 33)

Quinto mais periférico — maior colapso com yaw. `confidence_final` cai rapidamente com rotação lateral.

---

## fifth_2_ratio

**Arquivo:** `backend/app/services/metrics/fifths.py:~80`

- **unit:** `ratio`
- **ideal:** `0.20`
- **max_dev:** `0.10`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `FIFTHS_POSE_PARAMS`
- **dep lm:** canto externo olho esquerdo (lm 33) até canto interno olho esquerdo (lm 133)

Largura do olho esquerdo como fração da largura facial total.

---

## fifth_3_ratio

**Arquivo:** `backend/app/services/metrics/fifths.py:~100`

- **unit:** `ratio`
- **ideal:** `0.20`
- **max_dev:** `0.10`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `FIFTHS_POSE_PARAMS`
- **dep lm:** canto interno olho esquerdo (lm 133) até canto interno olho direito (lm 362)

Quinto central = distância intercantal. Referência de normalização para famílias em ICU.

---

## fourth_4_ratio

**Arquivo:** `backend/app/services/metrics/fifths.py:~120`

- **unit:** `ratio`
- **ideal:** `0.20`
- **max_dev:** `0.10`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `FIFTHS_POSE_PARAMS`
- **dep lm:** canto interno olho direito (lm 362) até canto externo olho direito (lm 263)

Largura do olho direito como fração da largura facial total.

---

## fifth_5_ratio

**Arquivo:** `backend/app/services/metrics/fifths.py:~140`

- **unit:** `ratio`
- **ideal:** `0.20`
- **max_dev:** `0.10`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `FIFTHS_POSE_PARAMS`
- **dep lm:** canto externo olho direito (lm 263) até borda lateral do rosto direita (aprox lm 454)

Quinto mais periférico direito — mesmo colapso com yaw que `fifth_1_ratio`.

---

## intercanthal_to_eye_width_ratio

**Arquivo:** `backend/app/services/metrics/fifths.py:~165`

- **unit:** `ratio`
- **ideal:** `1.0`
- **max_dev:** `0.40`
- **directions:** `neutral` | `wide_set` | `close_set`
- **pose_params:** `FIFTHS_POSE_PARAMS`
- **dep lm:** lm 133, lm 362 (cantos internos), lm 33 e lm 263 (cantos externos)

```
ratio = intercanthal_distance / mean(eye_width_left, eye_width_right)
```

Ideal = 1.0 (distância intercantal igual à largura média dos olhos). Valores > 1.0 indicam olhos afastados (`wide_set`); < 1.0 indica olhos aproximados (`close_set`).

**Nota de design:** `yaw_weight=0.90` em `FIFTHS_POSE_PARAMS` é o maior valor entre todas as famílias — quintos laterais colapsam assimetricamente com rotação lateral, tornando as métricas 1 e 5 não confiáveis em yaw > 10°.
