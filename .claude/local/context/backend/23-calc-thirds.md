---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-thirds"
file_path: ".claude/local/context/backend/23-calc-thirds.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 4 métricas de terços faciais em `services/metrics/thirds.py`.
  Usa `THIRDS_POSE_PARAMS` (yaw_soft=8, yaw_hard=20, pitch_soft=5, pitch_hard=12, floor=0.20,
  yaw_weight=0.40). Integra BiSeNet via `effective_trichion_y()` — substitui lm `P_FOREHEAD_CROWN=10`
  quando `trichion_confidence >= 0.40`. `confidence_final` multiplicado por `trichion_confidence_multiplier()`.
  Métricas: `upper_third_ratio`, `middle_third_ratio`, `lower_third_ratio`, `dominant_third`.
tags:
  - "backend"
  - "thirds"
  - "metrics"
  - "bisenet"
rag_keywords:
  - "upper_third_ratio middle_third_ratio lower_third_ratio dominant_third"
  - "THIRDS_POSE_PARAMS effective_trichion_y trichion_confidence_multiplier"
  - "P_FOREHEAD_CROWN P_BROW_LEFT_INNER P_BROW_RIGHT_INNER P_SUBNASALE P_MENTON"
  - "BiSeNet trichion fusion hairline terços faciais proporção"
  - "ratio 0.333 balanced upper middle lower"
related_modules:
  - "backend/trichion-bisenet"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
  - "backend/trichion-bisenet"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Thirds (4 métricas)

> **Última atualização:** 2026-05-24

---

## upper_third_ratio

**Arquivo:** `backend/app/services/metrics/thirds.py:~75`

- **unit:** `ratio`
- **ideal:** `0.333`
- **max_dev:** `0.15` (conf_raw → 0 neste desvio)
- **directions:** `neutral` | `long` | `short`
- **pose_params:** `THIRDS_POSE_PARAMS`
- **dep lm:** `P_FOREHEAD_CROWN=10` (ou `effective_trichion_y()` quando BiSeNet ativo), `P_BROW_LEFT_INNER`, `P_BROW_RIGHT_INNER`

BiSeNet: quando `trichion_confidence >= 0.40`, `effective_trichion_y()` substitui `lm[10].y`. `confidence_final` multiplicado por `trichion_confidence_multiplier()`.

```
upper = (trichion_y - glabella_y) / total_face_height
```

---

## middle_third_ratio

**Arquivo:** `backend/app/services/metrics/thirds.py:~100`

- **unit:** `ratio`
- **ideal:** `0.333`
- **max_dev:** `0.15`
- **directions:** `neutral` | `long` | `short`
- **pose_params:** `THIRDS_POSE_PARAMS`
- **dep lm:** `P_BROW_LEFT_INNER`, `P_BROW_RIGHT_INNER`, `P_SUBNASALE=2`

```
middle = (glabella_y - subnasale_y) / total_face_height
```

---

## lower_third_ratio

**Arquivo:** `backend/app/services/metrics/thirds.py:~125`

- **unit:** `ratio`
- **ideal:** `0.333`
- **max_dev:** `0.15`
- **directions:** `neutral` | `long` | `short`
- **pose_params:** `THIRDS_POSE_PARAMS`
- **dep lm:** `P_SUBNASALE=2`, `P_MENTON=152`

```
lower = (subnasale_y - menton_y) / total_face_height
```

---

## dominant_third

**Arquivo:** `backend/app/services/metrics/thirds.py:~155`

- **unit:** `ratio`
- **ideal:** `0.333`
- **max_dev:** `0.15`
- **directions:** `balanced` | `upper` | `middle` | `lower`
- **pose_params:** `THIRDS_POSE_PARAMS`
- **dep lm:** derivado das 3 métricas acima

Métrica derivada: identifica o terço com maior desvio positivo em relação ao ideal 0.333. Se nenhum terço desvia mais que threshold (~0.02), direction = `balanced`. `confidence_final` = mínimo das 3 confianças componentes. Não possui `improvement_vector`.

**Landmarks MediaPipe principais:**
| Constante | Índice | Região |
|---|---|---|
| `P_FOREHEAD_CROWN` | 10 | Glabela/frontal (fallback sem BiSeNet) |
| `P_BROW_LEFT_INNER` | ~55 | Sobrancelha esquerda medial |
| `P_BROW_RIGHT_INNER` | ~285 | Sobrancelha direita medial |
| `P_SUBNASALE` | 2 | Base do nariz |
| `P_MENTON` | 152 | Mento/queixo |
