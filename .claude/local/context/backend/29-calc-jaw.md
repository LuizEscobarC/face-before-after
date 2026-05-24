---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-jaw"
file_path: ".claude/local/context/backend/29-calc-jaw.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 6 métricas mandibulares em `services/metrics/jaw.py`.
  Usa `JAW_POSE_PARAMS` com `floor=0.15` — o mais restritivo de todas as famílias,
  pois `P_LEFT_GONION=58` e `P_RIGHT_GONION=288` são landmarks aproximados (TODO).
  Métricas: `jaw_width_ratio` (0.80), `gonial_angle_l/r` (125.0°),
  `gonial_angle_asymmetry` (0.0°), `mandibular_plane_angle` (27.0°),
  `chin_height_ratio` (0.50).
tags:
  - "backend"
  - "jaw"
  - "metrics"
rag_keywords:
  - "jaw_width_ratio gonial_angle_l gonial_angle_r gonial_angle_asymmetry mandibular_plane_angle chin_height_ratio"
  - "JAW_POSE_PARAMS floor 0.15 P_LEFT_GONION P_RIGHT_GONION aproximados TODO"
  - "mandíbula ângulo gonial plano mandibular queixo largura mandibular"
  - "degrees ratio intercanthal_units jaw mandible chin"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Jaw (6 métricas)

> **Última atualização:** 2026-05-24

> **Nota de qualidade:** `P_LEFT_GONION=58` e `P_RIGHT_GONION=288` são pontos aproximados no MediaPipe FaceMesh-478 (marcados como TODO para refinamento). Por isso `JAW_POSE_PARAMS.floor=0.15` — confiança nunca supera 85% mesmo em pose frontal perfeita.

---

## jaw_width_ratio

**Arquivo:** `backend/app/services/metrics/jaw.py:~65`

- **unit:** `ratio`
- **ideal:** `0.80`
- **max_dev:** `0.30`
- **directions:** `neutral` | `wide` | `narrow`
- **pose_params:** `JAW_POSE_PARAMS`
- **dep lm:** ângulos mandibulares esq/dir (`P_LEFT_GONION=58`, `P_RIGHT_GONION=288`), borda do rosto (~lm 234/454)

```
ratio = jaw_width / face_width
```

---

## gonial_angle_l

**Arquivo:** `backend/app/services/metrics/jaw.py:~90`

- **unit:** `degrees`
- **ideal:** `125.0`
- **max_dev:** `30.0`
- **directions:** `neutral` | `acute` | `obtuse`
- **pose_params:** `JAW_POSE_PARAMS`
- **dep lm:** `P_LEFT_GONION=58`, pontos inferiores da mandíbula esq (~lm 172, 136)

```
angle = interior_angle(gonion, ramus_point, body_point)
```

Ângulo gonial = ângulo entre ramo e corpo mandibular. Ideal 125° (oclusão Classe I).

---

## gonial_angle_r

**Arquivo:** `backend/app/services/metrics/jaw.py:~115`

- **unit:** `degrees`
- **ideal:** `125.0`
- **max_dev:** `30.0`
- **directions:** `neutral` | `acute` | `obtuse`
- **pose_params:** `JAW_POSE_PARAMS`
- **dep lm:** `P_RIGHT_GONION=288`, pontos inferiores da mandíbula dir (~lm 397, 365)

Espelho de `gonial_angle_l`.

---

## gonial_angle_asymmetry

**Arquivo:** `backend/app/services/metrics/jaw.py:~140`

- **unit:** `degrees`
- **ideal:** `0.0`
- **max_dev:** `15.0`
- **directions:** `neutral` | `left_acute` | `right_acute`
- **pose_params:** `JAW_POSE_PARAMS`
- **dep lm:** derivado de `gonial_angle_l` e `gonial_angle_r`

```
asymmetry = |gonial_angle_l - gonial_angle_r|
```

---

## mandibular_plane_angle

**Arquivo:** `backend/app/services/metrics/jaw.py:~165`

- **unit:** `degrees`
- **ideal:** `27.0`
- **max_dev:** `25.0`
- **directions:** `neutral` | `steep` | `flat`
- **pose_params:** `JAW_POSE_PARAMS`
- **dep lm:** plano mandibular (gonion → mento, lm 152) vs plano de Frankfurt (estimado via órbita → tragus)

Ângulo entre o plano mandibular e o plano horizontal de Frankfurt. Ideal 27° (norma cefalométrica de Steiner/McNamara).

---

## chin_height_ratio

**Arquivo:** `backend/app/services/metrics/jaw.py:~195`

- **unit:** `ratio`
- **ideal:** `0.50`
- **max_dev:** `0.30`
- **directions:** `neutral` | `tall` | `short`
- **pose_params:** `JAW_POSE_PARAMS`
- **dep lm:** ponto mento-labial (~lm 17), mento (lm 152), subnasale (lm 2)

```
ratio = (y_mentolabial - y_menton) / lower_face_height
```

Altura do mento como fração do terço inferior. Ideal 0.50 = mento ocupa metade do terço inferior.
