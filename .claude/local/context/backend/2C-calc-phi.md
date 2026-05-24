---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-phi"
file_path: ".claude/local/context/backend/2C-calc-phi.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 4 métricas de proporção áurea em `services/metrics/phi_golden.py`.
  Usa `PHI_POSE_PARAMS` com `floor=0.25` — o mais relaxado, pois todas as métricas são
  `presentation_only=True` (DEC-6) e nunca entram no score agregado. `_PHI = 1.6180`,
  `_PHI_TOLERANCE = 0.0809` (~5%). Métricas: `phi_face_height_to_width`,
  `phi_lower_face_segments`, `phi_eye_to_mouth`, `phi_nose_to_lip`.
tags:
  - "backend"
  - "phi"
  - "golden-ratio"
  - "metrics"
rag_keywords:
  - "phi_face_height_to_width phi_lower_face_segments phi_eye_to_mouth phi_nose_to_lip"
  - "PHI_POSE_PARAMS _PHI 1.6180 _PHI_TOLERANCE 0.0809 presentation_only DEC-6"
  - "proporção áurea phi golden ratio phi_proportionate above_phi below_phi"
  - "floor 0.25 never aggregate score"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Phi / Golden Ratio (4 métricas)

> **Última atualização:** 2026-05-24

> **IMPORTANTE — DEC-6:** Todas as métricas desta família são `presentation_only=True`. Nunca entram no cálculo do score agregado ou tier. São exibidas apenas no relatório como contexto cultural/estético.

---

## Constantes globais

**Arquivo:** `backend/app/services/metrics/phi_golden.py:~10`

```python
_PHI = (1 + 5**0.5) / 2        # ≈ 1.6180339887
_PHI_TOLERANCE = _PHI * 0.05   # ≈ 0.0809  (±5% aceito como phi_proportionate)
```

`PHI_POSE_PARAMS`: `floor=0.25`, `yaw_weight=0.45` — mais permissivo que outras famílias.

---

## phi_face_height_to_width

**Arquivo:** `backend/app/services/metrics/phi_golden.py:~55`

- **unit:** `ratio`
- **ideal:** `1.6180` (φ)
- **max_dev:** `0.0809` (≈ `_PHI_TOLERANCE`)
- **directions:** `phi_proportionate` | `above_phi` | `below_phi`
- **pose_params:** `PHI_POSE_PARAMS`
- **dep lm:** altura facial total (trichion via BiSeNet ou lm 10 → lm 152), largura zigomática (lm 234/454)
- **presentation_only:** `True`

```
ratio = face_height / face_width
```

---

## phi_lower_face_segments

**Arquivo:** `backend/app/services/metrics/phi_golden.py:~85`

- **unit:** `ratio`
- **ideal:** `1.6180` (φ)
- **max_dev:** `0.0809`
- **directions:** `phi_proportionate` | `above_phi` | `below_phi`
- **pose_params:** `PHI_POSE_PARAMS`
- **dep lm:** subnasale (lm 2), stomion (~lm 13/14), mento (lm 152)
- **presentation_only:** `True`

```
ratio = (subnasale_y - menton_y) / (stomion_y - menton_y)
```

Relação φ entre o terço inferior total e a porção abaixo do stomion.

---

## phi_eye_to_mouth

**Arquivo:** `backend/app/services/metrics/phi_golden.py:~115`

- **unit:** `ratio`
- **ideal:** `1.6180` (φ)
- **max_dev:** `0.0809`
- **directions:** `phi_proportionate` | `above_phi` | `below_phi`
- **pose_params:** `PHI_POSE_PARAMS`
- **dep lm:** centros oculares (médias de lm 159/145 esq, 386/374 dir), stomion (~lm 13)
- **presentation_only:** `True`

```
ratio = (eye_center_y - stomion_y) / intercanthal_distance
```

---

## phi_nose_to_lip

**Arquivo:** `backend/app/services/metrics/phi_golden.py:~145`

- **unit:** `ratio`
- **ideal:** `1.6180` (φ)
- **max_dev:** `0.0809`
- **directions:** `phi_proportionate` | `above_phi` | `below_phi`
- **pose_params:** `PHI_POSE_PARAMS`
- **dep lm:** subnasale (lm 2), borda superior do lábio superior (~lm 0), vermilhão inferior (~lm 17)
- **presentation_only:** `True`

```
ratio = nose_base_to_upper_lip / upper_lip_to_lower_lip_base
```

**Todas as métricas phi**: `confidence_final` calculado normalmente mas nunca propaga para score. Floor=0.25 garante que mesmo com pose moderada as métricas permaneçam visíveis no relatório.
