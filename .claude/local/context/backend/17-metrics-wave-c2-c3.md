---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/metrics-wave-c2-c3"
file_path: ".claude/local/context/backend/17-metrics-wave-c2-c3.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Catálogo de 20 métricas de segunda e terceira onda em wave_c2.py (10) e wave_c3.py (10).
  wave_c2 cobre nariz/boca/mandíbula avançados: nasolabial_angle_proxy, alar_flare_index,
  cupids_bow_definition, lip_volume_ratio, oral_commissure_height_asym, philtrum_width_ratio,
  smile_line_curvature, chin_projection_proxy, mandibular_corpus_length_ratio, masseteric_prominence_proxy.
  wave_c3 cobre mentolabial/sobrancelhas/bochechas/testa: mentolabial_fold_proxy, brow_arch_peak_position_l/r,
  intersuperciliary_distance_ratio, buccal_fat_index, ogee_curve_proxy, infraorbital_hollow_index,
  forehead_slope_proxy, glabella_prominence_proxy, facial_index_anthropometric.
tags:
  - "backend"
  - "metrics"
  - "wave-c2"
  - "wave-c3"
rag_keywords:
  - "nasolabial_angle_proxy degrees nose wave_c2"
  - "alar_flare_index 1.0 ICU wide_alar narrow_alar"
  - "cupids_bow_definition 0.05 prominent_bow flat_bow"
  - "lip_volume_ratio 0.625 upper_dominant lower_dominant"
  - "oral_commissure_height_asym 0.0 ICU"
  - "philtrum_width_ratio 0.30 Naini"
  - "smile_line_curvature 0.08 ratio"
  - "chin_projection_proxy 0.33 ratio Farkas"
  - "mandibular_corpus_length_ratio 0.25"
  - "masseteric_prominence_proxy 0.55"
  - "mentolabial_fold_proxy 0.40 ICU jaw"
  - "brow_arch_peak_position_l brow_arch_peak_position_r 0.50"
  - "intersuperciliary_distance_ratio 1.0 ICD brows"
  - "buccal_fat_index 0.45 cheekbones"
  - "ogee_curve_proxy infraorbital_hollow_index 0.08"
  - "forehead_slope_proxy glabella_prominence_proxy 0.50"
  - "facial_index_anthropometric 87.5 Martin mesoprosopic"
related_modules:
  - "backend/metrics-eyes-brows-nose-jaw-mouth"
  - "backend/metrics-other-families"
  - "backend/normalization-confidence"
depends_on:
  - "backend/normalization-confidence"
used_by:
  - "backend/pipeline"
  - "backend/api-vision"
---

# Backend — Métricas: Wave C2 e C3

> **Última atualização:** 2026-05-24

---

## wave_c2.py (10 métricas)

Arquivo: `backend/app/services/metrics/wave_c2.py`

| metric_id | region/family | unit | ideal | max_dev | directions |
|---|---|---|---|---|---|
| `nasolabial_angle_proxy` | nose | `degrees` | — | — | ângulo nasolabial (proxy) |
| `alar_flare_index` | nose | `icu` | 1.0 | 0.30 | `wide_alar`, `narrow_alar`, `normal` |
| `cupids_bow_definition` | mouth | `index_0_1` | 0.05 | 0.10 | `prominent_bow`, `flat_bow`, `normal` |
| `lip_volume_ratio` | mouth | `ratio` | 0.625 | 0.25 | `upper_dominant`, `lower_dominant`, `balanced` |
| `oral_commissure_height_asym` | mouth | `icu` | 0.0 | 0.07 | assimetria vertical das comissuras |
| `philtrum_width_ratio` | mouth | `ratio` | 0.30 | 0.15 | `wide_philtrum`, `narrow_philtrum`, `normal` |
| `smile_line_curvature` | mouth | `index_0_1` | 0.08 | 0.10 | curvatura da linha do sorriso |
| `chin_projection_proxy` | jaw | `ratio` | 0.33 | 0.07 | projeção do queixo / terço inferior |
| `mandibular_corpus_length_ratio` | jaw | `ratio` | 0.25 | 0.10 | comprimento do corpus mandibular |
| `masseteric_prominence_proxy` | jaw | `ratio` | 0.55 | 0.15 | proeminência do masseter |

**Notas:**
- `lip_volume_ratio` = `upper_vermilion / lower_vermilion` — ideal 0.625 = proporção 1:1.6 (lábio inferior 60% mais alto)
- `alar_flare_index` — Naini: base alar ≈ ICD (1.0 ICU)
- `philtrum_width_ratio` — `philtrum_width / mouth_width`; ideal 0.30 (Naini)

---

## wave_c3.py (10 métricas)

Arquivo: `backend/app/services/metrics/wave_c3.py`

| metric_id | region/family | unit | ideal | max_dev | directions |
|---|---|---|---|---|---|
| `mentolabial_fold_proxy` | jaw | `icu` | 0.40 | 0.15 | `long_lip_chin`, `short_lip_chin`, `normal` |
| `brow_arch_peak_position_l` | brows | `index_0_1` | 0.50 | 0.30 | `outer_peak`, `inner_peak`, `normal` |
| `brow_arch_peak_position_r` | brows | `index_0_1` | 0.50 | 0.30 | idem |
| `intersuperciliary_distance_ratio` | brows | `ratio` | 1.0 | 0.20 | `wide_set_brows`, `close_set_brows`, `normal` |
| `buccal_fat_index` | cheekbones | `index_0_1` | 0.45 | 0.20 | `low_cheek_fat`, `high_cheek_fat`, `normal` |
| `ogee_curve_proxy` | cheekbones | `index_0_1` | — | — | qualidade da curva ogival facial |
| `infraorbital_hollow_index` | cheekbones | `icu` | 0.08 | 0.07 | índice de sulco infraorbital |
| `forehead_slope_proxy` | forehead | `ratio` | — | — | inclinação/slope da testa |
| `glabella_prominence_proxy` | forehead | `icu` | 0.50 | 0.20 | proeminência da glabela |
| `facial_index_anthropometric` | global_shape | `ratio` | 87.5 | 12.5 | índice de Martin (mesoprosópico = 82-88) |

**Notas:**
- `brow_arch_peak_position` escala 0 = pico interno (medial), 1 = pico externo (lateral); ideal=0.50 (pico central)
- `buccal_fat_index` = posição vertical da gordura bucal entre linha dos olhos (0) e gonion (1); ideal=0.45
- `facial_index_anthropometric` = índice de Martin: face_height / face_width × 100; 87.5 = centro mesoprosópico
- `intersuperciliary_distance_ratio` = espaçamento inter-sobrancelha / ICD; ideal=1.0 (Naini)

---

## Visão geral dos 93 `metric_id` registrados

| Arquivo | Métricas | Famílias cobertas |
|---|---|---|
| `eyes.py` | 10 | eyes |
| `brows.py` | 9 | brows |
| `nose.py` | 9 | nose |
| `jaw.py` | 6 | jaw |
| `mouth.py` | 7 | mouth |
| `cheekbones.py` | 5 | cheekbones |
| `forehead.py` | 4 | forehead |
| `thirds.py` | 4 | thirds |
| `fifths.py` | 6 | fifths |
| `symmetry.py` | 5 | symmetry |
| `global_shape.py` | 4 | global_shape |
| `phi_golden.py` | 4 | phi |
| `wave_c2.py` | 10 | nose/mouth/jaw avançados |
| `wave_c3.py` | 10 | jaw/brows/cheekbones/forehead/global |
| **Total** | **93** | 14 famílias |
