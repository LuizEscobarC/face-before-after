---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/metrics-eyes-brows-nose-jaw-mouth"
file_path: ".claude/local/context/backend/15-metrics-eyes-brows-nose-jaw-mouth.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Catálogo de 41 métricas em 5 famílias: eyes (10), brows (9), nose (9), jaw (6),
  mouth (7). Cada entrada lista metric_id, unit, ideal, max_dev e direction labels.
  Todos os calculators herdam MetricCalculator e são registrados via @register.
  Valores ideais baseados em Naini 2011, literatura ortodôntica e referências de
  proporção facial clássica.
tags:
  - "backend"
  - "metrics"
  - "eyes"
  - "brows"
  - "nose"
  - "jaw"
  - "mouth"
rag_keywords:
  - "eye_aperture_ratio_l eye_aperture_ratio_r 0.30 ideal ratio"
  - "interpupillary_distance 2.0 ICU wide_set close_set"
  - "intercanthal_distance 1.0 ICU canthal_tilt_l canthal_tilt_r"
  - "scleral_show_lower_l scleral_show_lower_r 0.0 ideal"
  - "palpebral_fissure_inclination 2.0 degrees"
  - "supratarsal_fold_visibility stub DEC-10 requires_pixel_analysis"
  - "brow_height_l brow_height_r 0.35 ICU high_brow low_brow"
  - "brow_arch_peak_l brow_arch_peak_r 0.67 arch_lateral arch_medial"
  - "brow_thickness_l brow_thickness_r 0.20 ICU"
  - "interbrow_distance_ratio 1.0 ICU"
  - "nose_length_to_icd 1.5 nose_width_to_icd 1.0"
  - "alar_to_face_width_ratio 0.20 alar_base_asymmetry dorsum_deviation"
  - "jaw_width_ratio 0.80 gonial_angle 125 mandibular_plane_angle 27"
  - "chin_height_ratio 0.50 gonial_angle_asymmetry"
  - "mouth_width_to_icd 1.50 ICU upper_lip_height_ratio 0.40 lower_lip_height_ratio 0.60"
  - "vermilion_height_total 0.55 lip_corner_canting mouth_midline_deviation"
related_modules:
  - "backend/normalization-confidence"
  - "backend/metrics-other-families"
depends_on:
  - "backend/normalization-confidence"
used_by:
  - "backend/pipeline"
  - "backend/api-vision"
---

# Backend — Métricas: Eyes, Brows, Nose, Jaw, Mouth

> **Última atualização:** 2026-05-24  
> **Arquivo base:** `backend/app/services/metrics/`  
> **Padrão:** `@register class XxxCalculator(MetricCalculator)` com `metric_id`, `region`, `family`, `unit`

## Family: eyes (10 métricas) — `eyes.py`

Pose params: `EYES_POSE_PARAMS` (yaw 5/15°, pitch 5/15°, floor 0.2)

| metric_id | unit | ideal | max_dev | directions |
|---|---|---|---|---|
| `eye_aperture_ratio_l` | `ratio` | 0.30 | 0.30 | `open`, `narrow`, `normal` |
| `eye_aperture_ratio_r` | `ratio` | 0.30 | 0.30 | `open`, `narrow`, `normal` |
| `interpupillary_distance` | `icu` | 2.0 | 1.0 | `wide_set`, `close_set`, `normal` |
| `intercanthal_distance` | `icu` | 1.0 | 0.20 | `dilated`, `compressed`, `normal` |
| `canthal_tilt_l` | `degrees` | 0.0 | 20.0 | positivo = puxado lateral; negativo = puxado medial |
| `canthal_tilt_r` | `degrees` | 0.0 | 20.0 | idem |
| `scleral_show_lower_l` | `icu` | 0.0 | 0.05 | `visible`, `normal` |
| `scleral_show_lower_r` | `icu` | 0.0 | 0.05 | `visible`, `normal` |
| `palpebral_fissure_inclination` | `degrees` | 2.0 | 8.0 | `upward`, `downward`, `normal` |
| `supratarsal_fold_visibility` | `index_0_1` | — | — | **stub** (`requires_pixel_analysis=True`, DEC-10 — sempre `confidence_final=0`) |

**Nota `supratarsal_fold_visibility`:** registrado para `GET /vision/capabilities` (Nest seed), mas `compute()` retorna zero-confidence até implementação de segmentação de prega palpebral.

---

## Family: brows (9 métricas) — `brows.py`

Pose params: `BROW_POSE_PARAMS` (yaw 5/15°, pitch 8/20°, floor 0.17)

| metric_id | unit | ideal | max_dev | directions |
|---|---|---|---|---|
| `brow_height_l` | `icu` | 0.35 | 0.20 | `high_brow`, `low_brow`, `normal` |
| `brow_height_r` | `icu` | 0.35 | 0.20 | idem |
| `brow_arch_peak_l` | `ratio` | 0.67 | 0.27 | `arch_lateral`, `arch_medial`, `normal` |
| `brow_arch_peak_r` | `ratio` | 0.67 | 0.27 | idem |
| `brow_thickness_l` | `icu` | 0.20 | 0.20 | sinal proxy (loose) |
| `brow_thickness_r` | `icu` | 0.20 | 0.20 | idem |
| `brow_tail_drop_l` | `icu` | -0.05 | 0.20 | negativo = cauda levantada (ideal); positivo = cauda baixa |
| `brow_tail_drop_r` | `icu` | -0.05 | 0.20 | idem |
| `interbrow_distance_ratio` | `icu` | 1.0 | 0.45 | espaçamento inter-sobrancelha |

---

## Family: nose (9 métricas) — `nose.py`

Pose params: `NOSE_POSE_PARAMS` (yaw 5/15°, pitch 8/20°, floor 0.18)

| metric_id | unit | ideal | max_dev | notes |
|---|---|---|---|---|
| `nose_length_to_icd` | `icu` | 1.5 | 0.60 | comprimento nariz / ICD |
| `nose_width_to_icd` | `icu` | 1.0 | 0.40 | largura alar / ICD |
| `alar_to_face_width_ratio` | `ratio` | 0.20 | 0.12 | base alar / largura facial |
| `nose_to_mouth_width_ratio` | `ratio` | 0.65 | 0.30 | largura nariz / boca |
| `dorsum_deviation` | `icu` | 0.0 | 0.15 | desvio lateral do dorso em ICU |
| `nasal_tip_deviation` | `icu` | 0.0 | 0.15 | desvio da ponta em ICU |
| `alar_base_asymmetry` | `icu` | 0.0 | — | assimetria das asas nasais |
| `nasal_dorsum_straightness` | `icu` | 0.0 | — | desvio do dorso (ponte nasal) |
| `columella_show` | `icu` | 0.05 | — | exposição da columela em ICU |

---

## Family: jaw (6 métricas) — `jaw.py`

Pose params: `JAW_POSE_PARAMS` (yaw 4/12°, pitch 6/18°, floor **0.15** — mais restritivo)

| metric_id | unit | ideal | max_dev | directions |
|---|---|---|---|---|
| `jaw_width_ratio` | `ratio` | 0.80 | 0.30 | `wide_jaw`, `tapered_jaw`, `normal` |
| `gonial_angle_l` | `degrees` | 125.0 | 30.0 | `rounded` (>125), `sharp` (<125) |
| `gonial_angle_r` | `degrees` | 125.0 | 30.0 | idem |
| `gonial_angle_asymmetry` | `degrees` | 0.0 | 15.0 | diferença absoluta L/R |
| `mandibular_plane_angle` | `degrees` | 27.0 | 25.0 | ângulo plano mandibular |
| `chin_height_ratio` | `ratio` | 0.50 | 0.30 | proporção queixo/terço inferior |

**Aviso gonion:** landmarks gonion em Mesh-478 são aproximações (contorno da face) — `jaw_width_ratio` e ângulos goniais têm `floor=0.15` por isso.

---

## Family: mouth (7 métricas) — `mouth.py`

Pose params: `MOUTH_POSE_PARAMS` (yaw 6/16°, pitch 8/20°, floor 0.18)

| metric_id | unit | ideal | max_dev | notes |
|---|---|---|---|---|
| `mouth_width_to_icd` | `icu` | 1.50 | 0.60 | largura boca em ICU (Naini) |
| `mouth_to_face_width_ratio` | `ratio` | 0.30 | 0.16 | boca / largura facial |
| `upper_lip_height_ratio` | `ratio` | 0.40 | 0.20 | lábio superior / vermilhão total |
| `lower_lip_height_ratio` | `ratio` | 0.60 | 0.20 | lábio inferior / vermilhão total |
| `vermilion_height_total` | `icu` | 0.55 | 0.40 | altura total do vermilhão em ICU |
| `lip_corner_canting` | `icu` | 0.0 | 0.15 | diferença vertical comissuras |
| `mouth_midline_deviation` | `icu` | 0.0 | 0.15 | desvio da linha média da boca |
