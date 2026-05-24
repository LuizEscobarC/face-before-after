---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-forehead"
file_path: ".claude/local/context/backend/2B-calc-forehead.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 4 métricas de testa em `services/metrics/forehead.py`.
  Usa `FOREHEAD_POSE_PARAMS` (yaw_soft=5, yaw_hard=15, pitch_soft=6, pitch_hard=16,
  floor=0.17, yaw_weight=0.60). `forehead_height_ratio` usa `effective_trichion_y()`
  (BiSeNet integration) idêntica à família thirds. Métricas: `forehead_height_ratio`
  (1.90 ICU), `forehead_width_ratio` (0.70), `temporal_width_ratio` (0.75),
  `hairline_curvature_index` (0.48).
tags:
  - "backend"
  - "forehead"
  - "metrics"
  - "bisenet"
rag_keywords:
  - "forehead_height_ratio forehead_width_ratio temporal_width_ratio hairline_curvature_index"
  - "FOREHEAD_POSE_PARAMS effective_trichion_y trichion_confidence_multiplier BiSeNet"
  - "testa linha do cabelo curvatura hairline largura temporal testa altura"
  - "intercanthal_units ratio 1.90 0.70 0.75 0.48"
related_modules:
  - "backend/trichion-bisenet"
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
  - "backend/trichion-bisenet"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Forehead (4 métricas)

> **Última atualização:** 2026-05-24

---

## forehead_height_ratio

**Arquivo:** `backend/app/services/metrics/forehead.py:~65`

- **unit:** `intercanthal_units`
- **ideal:** `1.90`
- **max_dev:** `1.00`
- **directions:** `neutral` | `tall` | `short`
- **pose_params:** `FOREHEAD_POSE_PARAMS`
- **dep lm:** `P_FOREHEAD_CROWN=10` (fallback) ou `effective_trichion_y()` (BiSeNet ativo), glabela (~lm 9)

BiSeNet: quando `trichion_confidence >= 0.40`, substitui `lm[10].y` pelo trichion segmentado. `confidence_final` multiplicado por `trichion_confidence_multiplier()` — idêntica ao mecanismo de `upper_third_ratio`.

```
height = (trichion_y - glabella_y) / intercanthal_distance
```

---

## forehead_width_ratio

**Arquivo:** `backend/app/services/metrics/forehead.py:~95`

- **unit:** `ratio`
- **ideal:** `0.70`
- **max_dev:** `0.30`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `FOREHEAD_POSE_PARAMS`
- **dep lm:** pontos temporais frontais (~lm 54/284), largura zigomática (lm 234/454)

```
ratio = forehead_width / zygomatic_width
```

Relação entre a largura da testa (na linha superciliar) e a largura zigomática.

---

## temporal_width_ratio

**Arquivo:** `backend/app/services/metrics/forehead.py:~120`

- **unit:** `ratio`
- **ideal:** `0.75`
- **max_dev:** `0.30`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `FOREHEAD_POSE_PARAMS`
- **dep lm:** borda temporal (~lm 54/284 superior), largura zigomática

```
ratio = temporal_width / zygomatic_width
```

Análogo a `forehead_width_ratio` mas medido na altura temporal (mais alta que a linha superciliar). Diferença entre as duas métricas caracteriza a forma da testa (cônica vs retangular).

---

## hairline_curvature_index

**Arquivo:** `backend/app/services/metrics/forehead.py:~150`

- **unit:** `ratio`
- **ideal:** `0.48`
- **max_dev:** `0.35`
- **directions:** `neutral` | `curved` | `flat`
- **pose_params:** `FOREHEAD_POSE_PARAMS`
- **dep lm:** pontos da linha do cabelo estimados via BiSeNet (quando disponível) ou fallback para landmarks superiores

Curvatura da linha de implantação capilar. Calculada como a razão entre a flecha máxima (desvio do arco em relação à corda temporal-temporal) e a largura temporal.

```
index = max_arc_deviation / temporal_width
```

Ideal 0.48 = curvatura levemente arredondada. Valores mais altos = hairline mais em arco (feminino); valores mais baixos = hairline reta/quadrada. Dependente de BiSeNet — `confidence_final` reduzido quando segmentação não está disponível.
