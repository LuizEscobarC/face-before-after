---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/metrics-other-families"
file_path: ".claude/local/context/backend/16-metrics-cheekbones-forehead-thirds-fifths-symmetry-global-phi.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Catálogo de 38 métricas em 7 famílias: cheekbones (5), forehead (4), thirds (4),
  fifths (6), symmetry (5), global_shape (4), phi_golden (4). Inclui constantes ideais
  de Farkas 1994 e Naini 2011, severity scales para symmetry, e _PHI=1.618 para
  phi_golden. Todas as famílias usam PosePenaltyParams dedicados.
tags:
  - "backend"
  - "metrics"
  - "cheekbones"
  - "forehead"
  - "thirds"
  - "fifths"
  - "symmetry"
  - "phi"
  - "golden-ratio"
rag_keywords:
  - "zygomatic_width_ratio 4.0 ICU malar_projection_index 1.33 cheekbone"
  - "midface_height_ratio 1.50 cheekbone_to_jaw_ratio 1.25 submalar_hollow_index 0.10"
  - "forehead_height_ratio 1.90 ICU forehead_width_ratio 0.70 temporal_width_ratio 0.75"
  - "upper_third_ratio middle_third_ratio lower_third_ratio 0.333 ideal"
  - "dominant_third thirds presentation_only"
  - "fifth_1_ratio fifth_5_ratio 0.20 ideal intercanthal_to_eye_width_ratio"
  - "midline_deviation eye_height_asymmetry brow_height_asymmetry lip_canting_angle"
  - "global_asymmetry_index weighted composite"
  - "face_height_to_width_ratio 1.35 Farkas total_facial_convexity 0.98"
  - "face_shape_classification oval square diamond heart"
  - "e_line_deviation 0.0 ideal"
  - "phi_face_height_to_width phi_lower_face_segments phi_eye_to_mouth phi_nose_to_lip"
  - "PHI 1.618 phi_proportionate above_phi below_phi Marquardt"
  - "SYMMETRY_POSE_PARAMS _MIDLINE_SCALE_ICU 0.15 _EYE_SCALE_ICU 0.10"
related_modules:
  - "backend/metrics-eyes-brows-nose-jaw-mouth"
  - "backend/normalization-confidence"
depends_on:
  - "backend/normalization-confidence"
used_by:
  - "backend/pipeline"
  - "backend/api-vision"
---

# Backend — Métricas: Cheekbones, Forehead, Thirds, Fifths, Symmetry, Global Shape, Phi

> **Última atualização:** 2026-05-24

---

## Family: cheekbones (5 métricas) — `cheekbones.py`

Pose params: `CHEEKBONE_POSE_PARAMS` (yaw 5/15°, pitch 6/18°, floor 0.17)

| metric_id | unit | ideal | max_dev | directions |
|---|---|---|---|---|
| `zygomatic_width_ratio` | `icu` | 4.0 | 1.50 | `wide_cheeks`, `narrow_cheeks`, `normal` |
| `malar_projection_index` | `ratio` | 1.33 | 0.50 | `prominent_cheekbones`, `flat_cheekbones`, `normal` |
| `midface_height_ratio` | `icu` | 1.50 | 1.00 | proporção altura do médio-face |
| `cheekbone_to_jaw_ratio` | `ratio` | 1.25 | 0.40 | bizygomatic / bigonial |
| `submalar_hollow_index` | `ratio` | 0.10 | 0.30 | profundidade do côncavo submalar |

Referência: Farkas 1994.

---

## Family: forehead (4 métricas) — `forehead.py`

Pose params: `FOREHEAD_POSE_PARAMS` (yaw 5/15°, pitch 6/16°, floor 0.17, yaw_w=0.60)

| metric_id | unit | ideal | max_dev | directions |
|---|---|---|---|---|
| `forehead_height_ratio` | `icu` | 1.90 | 1.00 | `tall_forehead`, `short_forehead`, `normal` |
| `forehead_width_ratio` | `ratio` | 0.70 | 0.30 | `wide_forehead`, `narrow_forehead`, `normal` |
| `temporal_width_ratio` | `ratio` | 0.75 | 0.30 | `wide_temporal`, `narrow_temporal`, `normal` |
| `hairline_curvature_index` | `ratio` | 0.48 | 0.35 | curvatura linha do cabelo |

Nota `forehead_height_ratio`: usa `_trichion` de BiSeNet (quando disponível) para ponto anatômico correto. Referência: Farkas 1994.

---

## Family: thirds (4 métricas) — `thirds.py`

Pose params: `THIRDS_POSE_PARAMS` (yaw 8/20°, pitch 5/12°, floor 0.2, yaw_w=0.40, pitch_w=0.60)

Ideal: todos os terços = `1/3 ≈ 0.3333`. `_MAX_DEVIATION = 0.5`.

| metric_id | unit | ideal | notes |
|---|---|---|---|
| `upper_third_ratio` | `ratio` | 0.333 | trichion→glabella / altura total face |
| `middle_third_ratio` | `ratio` | 0.333 | glabella→subnasale / altura total face |
| `lower_third_ratio` | `ratio` | 0.333 | subnasale→menton / altura total face |
| `dominant_third` | `category` | — | qual terço é mais longo (`upper`, `middle`, `lower`, `balanced`) |

`dominant_third` é `presentation_only` — sem `confidence_final` numérico.

---

## Family: fifths (6 métricas) — `fifths.py`

Pose params: `FIFTHS_POSE_PARAMS` (yaw 5/12°, pitch 8/20°, floor 0.2, yaw_w=0.90)

| metric_id | unit | ideal | max_dev | notes |
|---|---|---|---|---|
| `fifth_1_ratio` | `ratio` | 0.20 | 0.40 | 5º lateral esquerdo / largura facial total |
| `fifth_2_ratio` | `ratio` | 0.20 | 0.40 | 4º (olho esquerdo) |
| `fifth_3_ratio` | `ratio` | 0.20 | 0.40 | 3º (centro: nariz) |
| `fifth_4_ratio` | `ratio` | 0.20 | 0.40 | 2º (olho direito) |
| `fifth_5_ratio` | `ratio` | 0.20 | 0.40 | 1º lateral direito |
| `intercanthal_to_eye_width_ratio` | `icu` | 1.0 | 1.0 | ICD / largura do olho (ideal = olhos com 1 ICD de espaçamento) |

Direções: `wide`, `narrow`, `normal` para cada quinto; `wide_set`/`close_set` para `intercanthal_to_eye_width_ratio`.

---

## Family: symmetry (5 métricas) — `symmetry.py`

Pose params: `SYMMETRY_POSE_PARAMS` (yaw 5/15°, pitch 8/20°, floor 0.2, yaw_w=0.80)

**Severity scales** (ICU): valor a partir do qual componente = 1.0 (severo):
- `_MIDLINE_SCALE_ICU = 0.15` — desvio da linha média grave
- `_EYE_SCALE_ICU = 0.10` — diferença de altura ocular grave
- `_BROW_SCALE_ICU = 0.12` — diferença de altura de sobrancelha grave
- `_LIP_SCALE_DEG = 5.0` — inclinação labial grave (°)

| metric_id | unit | base | notes |
|---|---|---|---|
| `midline_deviation` | `intercanthal_units` | média `|x|` de 4 pontos midline (nasion, nariz, subnasale, menton) | ideal=0 |
| `eye_height_asymmetry` | `intercanthal_units` | `|mean_y(olho_E) − mean_y(olho_D)|` | ideal=0 |
| `brow_height_asymmetry` | `intercanthal_units` | `|peak_y(sobrancelha_E) − peak_y(sobrancelha_D)|` | ideal=0 |
| `lip_canting_angle` | `degrees` | ângulo do eixo comissuras vs horizontal | positivo = comissura D mais baixa; ideal=0° |
| `global_asymmetry_index` | `index_0_1` | composto ponderado dos 4 acima | escala 0=perfeito, 1=severo |

---

## Family: global_shape (4 métricas) — `global_shape.py`

Pose params: `GLOBAL_SHAPE_POSE_PARAMS` (yaw 6/18°, pitch 6/18°, floor 0.20, yaw_w=0.50)

| metric_id | unit | ideal | max_dev | notes |
|---|---|---|---|---|
| `face_height_to_width_ratio` | `ratio` | 1.35 | 0.50 | aspect ratio face — Farkas 1994 / Naini 2011 |
| `face_shape_classification` | `category` | — | — | `oval`, `square`, `diamond`, `heart`, etc. — usa `face_height_to_width_ratio` |
| `total_facial_convexity` | `ratio` | 0.98 | 0.20 | convexidade frontal — próxima de 1 = oval convexo |
| `e_line_deviation` | `icu` | 0.0 | 0.08 | desvio do lábio superior em relação à linha nariz-mento (2D) |

---

## Family: phi_golden (4 métricas) — `phi_golden.py`

Pose params: `PHI_POSE_PARAMS` (yaw 8/22°, pitch 7/20°, floor **0.25** — mais relaxado, overlay de apresentação)

`_PHI = (1 + √5) / 2 ≈ 1.6180`  
`_PHI_TOLERANCE = _PHI × 0.05 ≈ 0.0809`  
Direções: `phi_proportionate` (dentro da tolerância), `above_phi`, `below_phi`

| metric_id | unit | ideal | notes |
|---|---|---|---|
| `phi_face_height_to_width` | `ratio` | φ ≈ 1.618 | altura / largura da face |
| `phi_lower_face_segments` | `ratio` | φ ≈ 1.618 | segmentos verticais do terço inferior (Marquardt) |
| `phi_eye_to_mouth` | `ratio` | φ ≈ 1.618 | distância olho–boca vertical |
| `phi_nose_to_lip` | `ratio` | φ ≈ 1.618 | boca ≈ φ × largura nariz (Marquardt phi mask) |

Todas são `presentation_only` — registradas para overlay; Nest pode exibi-las no painel phi/golden.
