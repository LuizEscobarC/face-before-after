# Métricas — Catálogo Completo (93 métricas)

Todas as métricas são calculadas sobre **478 landmarks MediaPipe Mesh-478**.
Métricas espaciais são normalizadas pela **ICD** (intercanthal distance — distância entre cantos mediais dos olhos).
Origem do sistema de coordenadas = midpoint intercantal; eixo Y cresce para baixo.

> Stubs DEC-10: métricas que requerem vista lateral/análise de pixel retornam
> `direction="not_computed"` e `confidence_final=0.0`. Não entram no score.

---

## Região: symmetry (5 métricas)

| metric_id | Unidade | Ideal | Direção acima / abaixo | Descrição |
|-----------|---------|-------|------------------------|-----------|
| `midline_deviation` | ICU | 0.0 | right_deviation / left_deviation | Desvio horizontal da linha média facial |
| `eye_height_asymmetry` | ICU | 0.0 | right_eye_higher / left_eye_higher | Assimetria de altura entre centros dos olhos |
| `brow_height_asymmetry` | ICU | 0.0 | right_brow_higher / left_brow_higher | Assimetria de altura entre centros das sobrancelhas |
| `lip_canting_angle` | degrees | 0.0 | right_lip_higher / left_lip_higher | Ângulo de inclinação do lábio (canting) |
| `global_asymmetry_index` | ICU | 0.0 | — | Score composto de assimetria global |

---

## Região: global (4 métricas de forma + 1 de C3)

| metric_id | Unidade | Ideal | Direção acima / abaixo | Descrição |
|-----------|---------|-------|------------------------|-----------|
| `face_height_to_width_ratio` | ratio | 1.35 | long_face / wide_face | Altura facial / largura bizigomática |
| `face_shape_classification` | index_0_1 | 0.5 | — | Classificação contínua forma (0=redondo, 1=oblongo) |
| `total_facial_convexity` | degrees | 175.0 | convex_face / concave_face | Ângulo de convexidade facial total |
| `e_line_deviation` | ICU | 0.0 | lips_anterior / lips_posterior | Desvio lábios em relação à E-line (nariz–mento) |
| `facial_index_anthropometric` | ratio | 87.5 | long_face / wide_face | Martin index = (altura / bizyg.) × 100 (C3) |

---

## Região: thirds (4 métricas)

| metric_id | Unidade | Ideal | Descrição |
|-----------|---------|-------|-----------|
| `upper_third_ratio` | ratio | 0.333 | Trichion→nasion / altura total |
| `middle_third_ratio` | ratio | 0.333 | Nasion→subnasale / altura total |
| `lower_third_ratio` | ratio | 0.333 | Subnasale→menton / altura total |
| `dominant_third` | index_0_1 | 0.5 | Qual terço domina (0=superior, 1=inferior) |

---

## Região: fifths (6 métricas)

| metric_id | Unidade | Ideal | Descrição |
|-----------|---------|-------|-----------|
| `fifth_1_ratio` | ratio | 0.20 | 1º quinto (margem lateral esq → canto lateral olho esq) |
| `fifth_2_ratio` | ratio | 0.20 | 2º quinto (largura olho esq) |
| `fifth_3_ratio` | ratio | 0.20 | 3º quinto (distância intercantal) |
| `fifth_4_ratio` | ratio | 0.20 | 4º quinto (largura olho dir) |
| `fifth_5_ratio` | ratio | 0.20 | 5º quinto (canto lateral dir → margem lateral dir) |
| `intercanthal_to_eye_width_ratio` | ratio | 1.00 | Distância intercantal / largura média de um olho |

---

## Região: eyes (10 métricas — inclui 1 stub C1)

| metric_id | Unidade | Ideal | Stub | Direção acima / abaixo | Descrição |
|-----------|---------|-------|------|------------------------|-----------|
| `eye_aperture_ratio_l` | ratio | 0.30 | — | wide_eye / narrow_eye | EAR olho esquerdo |
| `eye_aperture_ratio_r` | ratio | 0.30 | — | wide_eye / narrow_eye | EAR olho direito |
| `interpupillary_distance` | ICU | 2.50 | — | wide_set_eyes / close_set_eyes | Distância interpupilar / ICD |
| `intercanthal_distance` | ICU | 1.00 | — | wide_set_eyes / close_set_eyes | Distância canto-a-canto medial / ICD |
| `canthal_tilt_l` | degrees | +5.0 | — | positive_tilt / negative_tilt | Inclinação canthal esquerda |
| `canthal_tilt_r` | degrees | +5.0 | — | positive_tilt / negative_tilt | Inclinação canthal direita |
| `scleral_show_lower_l` | ICU | 0.0 | — | excess_scleral_show / — | Esclerótica inferior visível esq |
| `scleral_show_lower_r` | ICU | 0.0 | — | excess_scleral_show / — | Esclerótica inferior visível dir |
| `palpebral_fissure_inclination` | degrees | +5.0 | — | upward_inclination / downward_inclination | Inclinação média da fissura palpebral |
| `supratarsal_fold_visibility` | index_0_1 | — | **STUB** | not_computed | Visibilidade da dobra supratarsal (requer análise de pixel) |

---

## Região: jaw (7 métricas — inclui 1 de C3)

| metric_id | Unidade | Ideal | Direção acima / abaixo | Descrição |
|-----------|---------|-------|------------------------|-----------|
| `jaw_width_ratio` | ratio | 0.75 | wide_jaw / narrow_jaw | Largura bigonial / largura bizigomática |
| `gonial_angle_l` | degrees | 120.0 | obtuse_angle / acute_angle | Ângulo gonial esquerdo |
| `gonial_angle_r` | degrees | 120.0 | obtuse_angle / acute_angle | Ângulo gonial direito |
| `gonial_angle_asymmetry` | degrees | 0.0 | — | |gonial_l - gonial_r| |
| `mandibular_plane_angle` | degrees | 25.0 | steep_plane / flat_plane | Ângulo do plano mandibular |
| `chin_height_ratio` | ratio | 0.35 | long_chin / short_chin | Altura do queixo / terço inferior |
| `mentolabial_fold_proxy` | ICU | 0.40 | long_lip_chin / short_lip_chin | Distância lábio-inf→mento / ICD (C3) |

---

## Região: nose (9 métricas)

| metric_id | Unidade | Ideal | Direção acima / abaixo | Descrição |
|-----------|---------|-------|------------------------|-----------|
| `nose_length_to_icd` | ICU | 2.20 | long_nose / short_nose | Comprimento nasal (nasion→subnasale) / ICD |
| `nose_width_to_icd` | ICU | 1.00 | wide_nose / narrow_nose | Largura alar / ICD |
| `alar_to_face_width_ratio` | ratio | 0.25 | wide_alar_base / narrow_alar_base | Largura alar / largura bizigomática |
| `nose_to_mouth_width_ratio` | ratio | 0.70 | wide_nose / narrow_nose | Largura alar / largura boca |
| `dorsum_deviation` | ICU | 0.0 | right_deviation / left_deviation | Desvio lateral do dorso nasal |
| `nasal_tip_deviation` | ICU | 0.0 | right_deviation / left_deviation | Desvio da ponta nasal da linha média |
| `alar_base_asymmetry` | ICU | 0.0 | right_flaring / left_flaring | Assimetria entre bases alares |
| `nasal_dorsum_straightness` | index_0_1 | 1.0 | — | Retidão do dorso nasal (1 = reto) |
| `columella_show` | ICU | 0.05 | excess_show / no_show | Exposição da columela vista frontal |

---

## Região: mouth (7 métricas)

| metric_id | Unidade | Ideal | Direção acima / abaixo | Descrição |
|-----------|---------|-------|------------------------|-----------|
| `mouth_width_to_icd` | ICU | 1.60 | wide_mouth / narrow_mouth | Largura labial / ICD |
| `mouth_to_face_width_ratio` | ratio | 0.50 | wide_mouth / narrow_mouth | Largura labial / largura bizigomática |
| `upper_lip_height_ratio` | ratio | 0.40 | tall_upper_lip / flat_upper_lip | Altura vermilhão superior / soma vermilhões |
| `lower_lip_height_ratio` | ratio | 0.60 | tall_lower_lip / flat_lower_lip | Altura vermilhão inferior / soma vermilhões |
| `vermilion_height_total` | ICU | 0.45 | full_lips / thin_lips | Soma das alturas dos vermilhões / ICD |
| `lip_corner_canting` | degrees | 0.0 | right_corner_higher / left_corner_higher | Inclinação dos comissurais labiais |
| `mouth_midline_deviation` | ICU | 0.0 | right_deviation / left_deviation | Desvio da linha média da boca |

---

## Região: brows (12 métricas — 9 base + 3 de C3)

| metric_id | Unidade | Ideal | Direção acima / abaixo | Descrição |
|-----------|---------|-------|------------------------|-----------|
| `brow_height_l` | ICU | 0.50 | high_brow / low_brow | Altura sobrancelha esq (brow→canto medial) / ICD |
| `brow_height_r` | ICU | 0.50 | high_brow / low_brow | Altura sobrancelha dir / ICD |
| `brow_arch_peak_l` | ICU | 0.20 | high_arch / low_arch | Pico do arco sobrancelha esq / ICD |
| `brow_arch_peak_r` | ICU | 0.20 | high_arch / low_arch | Pico do arco sobrancelha dir / ICD |
| `brow_thickness_l` | ICU | 0.12 | thick_brow / thin_brow | Espessura sobrancelha esq / ICD |
| `brow_thickness_r` | ICU | 0.12 | thick_brow / thin_brow | Espessura sobrancelha dir / ICD |
| `brow_tail_drop_l` | ICU | 0.0 | drooping_tail / elevated_tail | Queda da cauda sobrancelha esq |
| `brow_tail_drop_r` | ICU | 0.0 | drooping_tail / elevated_tail | Queda da cauda sobrancelha dir |
| `interbrow_distance_ratio` | ratio | 1.00 | wide_set_brows / close_set_brows | Distância entre sobrancelhas / ICD |
| `brow_arch_peak_position_l` | index_0_1 | 0.50 | outer_peak / inner_peak | Posição do pico (inner=0, outer=1) sobrancelha esq (C3) |
| `brow_arch_peak_position_r` | index_0_1 | 0.50 | outer_peak / inner_peak | Posição do pico sobrancelha dir (C3) |
| `intersuperciliary_distance_ratio` | ratio | 1.00 | wide_set_brows / close_set_brows | Distância intersupercílio / ICD (C3) |

---

## Região: cheekbones (8 métricas — 5 base + 3 de C3)

| metric_id | Unidade | Ideal | Stub | Direção acima / abaixo | Descrição |
|-----------|---------|-------|------|------------------------|-----------|
| `zygomatic_width_ratio` | ratio | 1.30 | — | wide_cheekbones / narrow_cheekbones | Largura bizigomática / bigonial |
| `malar_projection_index` | ICU | 0.30 | — | prominent_malar / flat_malar | Projeção malar / ICD |
| `midface_height_ratio` | ratio | 0.35 | — | long_midface / short_midface | Altura do médio-face / altura total |
| `cheekbone_to_jaw_ratio` | ratio | 1.30 | — | dominant_cheekbones / dominant_jaw | Bizigomático / bigonial |
| `submalar_hollow_index` | ICU | 0.05 | — | deep_hollow / flat_hollow | Profundidade do sulco submalar |
| `buccal_fat_index` | index_0_1 | 0.45 | — | high_cheek_fat / low_cheek_fat | Posição da bochecha entre linha ocular e gonion (C3) |
| `ogee_curve_proxy` | index_0_1 | — | **STUB** | not_computed | Curva Ogee (requer vista lateral) (C3) |
| `infraorbital_hollow_index` | ICU | 0.08 | — | deep_hollow / shallow_hollow | Concavidade infraorbital / ICD (C3) |

---

## Região: forehead (6 métricas — 4 base + 2 de C3)

| metric_id | Unidade | Ideal | Stub | Direção acima / abaixo | Descrição |
|-----------|---------|-------|------|------------------------|-----------|
| `forehead_height_ratio` | ratio | 0.333 | — | high_forehead / low_forehead | Altura da testa / altura facial total |
| `forehead_width_ratio` | ratio | 0.90 | — | wide_forehead / narrow_forehead | Largura frontal / bizigomática |
| `temporal_width_ratio` | ratio | 0.85 | — | wide_temples / narrow_temples | Largura temporal / bizigomática |
| `hairline_curvature_index` | index_0_1 | 0.50 | — | rounded_hairline / flat_hairline | Curvatura da linha do cabelo (frontal) |
| `forehead_slope_proxy` | degrees | — | **STUB** | not_computed | Inclinação frontal (requer vista lateral) (C3) |
| `glabella_prominence_proxy` | ICU | 0.50 | — | broad_glabella / narrow_glabella | Largura lateral da glabela / ICD (C3) |

---

## Região: global / phi_golden (4 métricas)

| metric_id | Unidade | Ideal | Direção acima / abaixo | Descrição |
|-----------|---------|-------|------------------------|-----------|
| `phi_face_height_to_width` | ratio | 1.618 | too_long / too_wide | Razão altura:largura vs proporção áurea |
| `phi_lower_face_segments` | ratio | 1.618 | — | Razão segmentos do terço inferior vs φ |
| `phi_eye_to_mouth` | ratio | 1.618 | — | Distância olho→boca vs φ |
| `phi_nose_to_lip` | ratio | 1.618 | — | Razão nariz→lábio vs φ |

---

## Wave C2 — 10 métricas (nariz/boca/mandíbula avançado)

| metric_id | Região | Unidade | Ideal | Stub | Direção acima / abaixo | Descrição |
|-----------|--------|---------|-------|------|------------------------|-----------|
| `nasolabial_angle_proxy` | nose | degrees | — | **STUB** | not_computed | Ângulo nasolabial frontal (requer lateral) |
| `alar_flare_index` | nose | ICU | 1.00 | — | flared_alae / pinched_alae | Largura alar / ICD |
| `cupids_bow_definition` | mouth | ratio | 0.05 | — | prominent_bow / flat_bow | Definição do arco de Cupido |
| `lip_volume_ratio` | mouth | ratio | 0.625 | — | fuller_upper_lip / thinner_upper_lip | Razão volume lábio sup / inf |
| `oral_commissure_height_asym` | mouth | ICU | 0.0 | — | right_higher / left_higher | Assimetria de altura dos comissurais |
| `philtrum_width_ratio` | mouth | ratio | 0.30 | — | wide_philtrum / narrow_philtrum | Largura do filtro / largura da boca |
| `smile_line_curvature` | mouth | ratio | 0.08 | — | pronounced_curve / flat_smile | Curvatura da linha do sorriso |
| `chin_projection_proxy` | jaw | ratio | 0.33 | — | projected_chin / recessed_chin | Projeção do queixo (terço inferior) |
| `mandibular_corpus_length_ratio` | jaw | ratio | 0.25 | — | long_corpus / short_corpus | Razão comprimento do corpo mandibular |
| `masseteric_prominence_proxy` | jaw | ratio | 0.55 | — | prominent_masseter / flat_masseter | Proeminência do masseter / bizigomático |

---

## Stubs DEC-10 (requerem análise de pixel / vista lateral)

| metric_id | Região | Motivo |
|-----------|--------|--------|
| `supratarsal_fold_visibility` | eyes | Dobra palpebral — análise de pixel |
| `nasolabial_angle_proxy` | nose | Ângulo nasolabial — requer vista lateral |
| `ogee_curve_proxy` | cheekbones | Curva Ogee — requer vista lateral/oblíqua |
| `forehead_slope_proxy` | forehead | Inclinação frontal — requer vista lateral |

> Todos os stubs retornam: `value=0.0`, `confidence_final=0.0`, `direction="not_computed"`, `is_low_confidence=True`.
> Não entram no `metric_ideal` e não têm peso em `region_metric_weight`.


