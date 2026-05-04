# Métricas — Definições Completas

Todas as métricas são calculadas sobre 68 landmarks dlib extraídos da imagem alinhada.
Métricas espaciais são normalizadas pela **IPD** (distância interpupilar) para comparabilidade entre fotos com escalas diferentes.

---

## 1. Assimetria global (face_asymmetry.py)

| Chave JSON | Unidade | Descrição |
|------------|---------|-----------|
| `overall_asymmetry_score` | px | Desvio médio absoluto dos landmarks ao espelho — em pixels |
| `overall_asymmetry_score_pct_ipd` | % IPD | Mesmo desvio, normalizado pela IPD |
| `asymmetry_eyes` | px | Assimetria bilateral nos landmarks dos olhos (36–47) |
| `asymmetry_nose` | px | Assimetria nos landmarks do nariz (31–35) |
| `asymmetry_mouth` | px | Assimetria nos landmarks da boca (48–67) |
| `asymmetry_chin` | px | Assimetria no ponto do queixo (8) |
| `asymmetry_jaw` | px | Assimetria nos pontos da mandíbula (0–16) |

---

## 2. Proporções clássicas (face_metrics.proportions)

| Chave JSON | Unidade | Ideal | Descrição |
|------------|---------|-------|-----------|
| `thirds_upper_ratio` | razão | ~0.333 | Fração trichion→glabela / altura total |
| `thirds_middle_ratio` | razão | ~0.333 | Fração glabela→subnasale / altura total |
| `thirds_lower_ratio` | razão | ~0.333 | Fração subnasale→menton / altura total |
| `thirds_std_dev` | razão | 0 | Desvio padrão das 3 frações; ideal = 0 (terços iguais) |
| `fifths_std_dev` | razão | 0 | Desvio padrão das 5 larguras horizontais (quintos) |
| `lower_third_ratio` | razão | ~0.56 (masc.) | terço inferior / (glabela→menton) |
| `fwhr` | adimensional | ~1.85 | Largura bizigomática / altura superior (lábio→sobrancelha) |
| `bizygomatic_px` | px | — | Largura bizigomática em pixels |
| `bigonial_px` | px | — | Largura bigonial em pixels |

> **Nota sobre trichion**: Não existe landmark na linha do cabelo. Estimado por reflexão: trichion_y = nasion_y − (subnasale_y − nasion_y).

---

## 3. Dimorfismo masculino (face_metrics.masculinity)

| Chave JSON | Unidade | Ideal | Descrição |
|------------|---------|-------|-----------|
| `jaw_width_pct_ipd` | % IPD | ~155% | Largura bigonial (p4–p12) / IPD |
| `bizygomatic_to_bigonial_ratio` | adimensional | ~1.30 | Zigomático / bigonial (ideal: rosto mais largo em cima) |
| `gonial_angle_left_deg` | graus | 110–130° | Ângulo gonial esquerdo (p4: vetores p2→p4 e p4→p6) |
| `gonial_angle_right_deg` | graus | 110–130° | Ângulo gonial direito |
| `gonial_angle_mean_deg` | graus | ~120° | Média dos dois ângulos goniais |
| `chin_projection_pct_ipd` | % IPD | — | Distância vertical menton→lábio inferior / IPD |
| `jawline_definition_score` | adimensional | maior = melhor | Desvio padrão de ângulos sucessivos da mandíbula (0–16) |

---

## 4. Olhos (face_metrics.eyes)

| Chave JSON | Unidade | Ideal | Descrição |
|------------|---------|-------|-----------|
| `canthal_tilt_left_deg` | graus | +3° a +8° | Inclinação canto medial→lateral olho esq (positivo = lateral mais alto) |
| `canthal_tilt_right_deg` | graus | +3° a +8° | Idem olho direito |
| `canthal_tilt_mean_deg` | graus | ~+5° | Média dos dois canthal tilts |
| `eye_aspect_ratio_left` | adimensional | 0.26–0.35 | EAR (Eye Aspect Ratio) olho esquerdo |
| `eye_aspect_ratio_right` | adimensional | 0.26–0.35 | EAR olho direito |
| `eye_aspect_ratio_mean` | adimensional | ~0.30 | Média dos EAR |
| `intercanthal_to_eyewidth_ratio` | adimensional | ~1.0 | Distância intercantal / largura média de um olho |
| `brow_to_eyelid_left_pct_ipd` | % IPD | — | Espaço sobrancelha→pálpebra sup esquerda / IPD |
| `brow_to_eyelid_right_pct_ipd` | % IPD | — | Idem direito |
| `brow_to_eyelid_mean_pct_ipd` | % IPD | — | Média bilateral |
| `brow_tilt_left_deg` | graus | — | Inclinação lateral sobrancelha esquerda |
| `brow_tilt_right_deg` | graus | — | Idem direita |

**Fórmula EAR** (Soukupová & Čech, 2016):
```
EAR = (‖p1−p5‖ + ‖p2−p4‖) / (2 × ‖p0−p3‖)
```
onde p0–p5 são os 6 landmarks do olho (pontos 36–41 para olho esq).

---

## 5. Nariz (face_metrics.nose)

| Chave JSON | Unidade | Ideal | Descrição |
|------------|---------|-------|-----------|
| `nasal_to_mouth_width_ratio` | adimensional | ~0.70 | Largura alar / largura da boca (Regra de Ricketts) |
| `alar_intercanthal_alignment_pct` | % | — | Desvio % entre largura alar e intercantal |
| `nasal_length_pct_face_height` | % | — | Comprimento nasal (nasion→subnasale) / altura facial |
| `alar_width_pct_ipd` | % IPD | — | Largura alar / IPD |

---

## 6. Boca / Lábios (face_metrics.mouth)

| Chave JSON | Unidade | Ideal | Descrição |
|------------|---------|-------|-----------|
| `mouth_to_ipd_ratio` | adimensional | ~1.50 | Largura boca / IPD |
| `upper_lower_lip_ratio` | adimensional | ~0.62–0.65 (masc.) | Espessura lábio superior / inferior |
| `philtrum_length_pct_ipd` | % IPD | ~22–26% | Comprimento do fíltro nasolabial / IPD |
| `upper_lip_thickness_pct_ipd` | % IPD | — | Espessura lábio superior / IPD |
| `lower_lip_thickness_pct_ipd` | % IPD | — | Espessura lábio inferior / IPD |

---

## 7. Forma facial (face_metrics.face_shape)

| Chave JSON | Tipo | Valores possíveis |
|------------|------|------------------|
| `face_height_to_width_ratio` | adimensional | altura / largura bizigomática |
| `zygomatic_to_gonial_ratio` | adimensional | bizygomatic / bigonial |
| `face_shape_label` | string | oblongo, oval, retangular, quadrado, diamante, redondo |

**Regras de classificação**:
```
h/w ≥ 1.5            → oblongo
h/w ≥ 1.3            → oval
h/w ≥ 1.15, z/g<1.15 → retangular
h/w ≥ 1.15, z/g≥1.15 → oval
h/w ≥ 1.0,  z/g<1.15 → quadrado
h/w ≥ 1.0,  z/g≥1.15 → diamante
h/w < 1.0            → redondo
```

---

## 8. Desvio Marquardt (face_metrics.marquardt_deviation)

| Chave JSON | Unidade | Ideal | Descrição |
|------------|---------|-------|-----------|
| `marquardt_deviation_px` | px | 0 | RMSE entre landmarks e seus espelhos sobre x_midline |
| `marquardt_deviation_pct_ipd` | % IPD | 0% (excelente <1%) | Idem normalizado pela IPD |

**Metodologia**: Para cada par espelhado (li, ri) nos 68 landmarks, reflete ri sobre x_midline e calcula distância ao li correspondente. RMSE de todos os pares. Diferente do `overall_asymmetry_score_pct_ipd` (que foca em landmarks específicos com peso regional), este considera todos os pares.

---

## 9. Qualidade da foto (face_metrics.photo_quality)

| Chave JSON | Unidade | Limiar OK | Descrição |
|------------|---------|-----------|-----------|
| `head_pose_yaw_deg` | graus | ≤ ±7° | Rotação horizontal da cabeça |
| `head_pose_pitch_deg` | graus | ≤ ±7° | Inclinação vertical (cima/baixo) |
| `head_pose_roll_deg` | graus | ≤ ±5° | Inclinação lateral da cabeça |
| `frontal_ok` | bool | True | `|yaw| ≤ 7° AND |pitch| ≤ 7°` |
| `focal_distortion_ratio` | adimensional | ≤ 0.55 | Largura nariz / largura bizigomática |
| `focal_distortion_warning` | bool | False | True quando ratio > 0.55 (lente curta/selfie) |
| `lighting_asymmetry_delta_e` | unidades Lab | < 10 | ΔE entre bochechas esq e dir (iluminação assimétrica) |
| `face_pixel_width` | px | ≥ 200 | Largura do bounding box da face |
| `sharpness_laplacian_var` | adimensional | ≥ 50 | Variância do operador Laplaciano na região facial |
| `warnings` | list[str] | [] | Alertas gerados por cada limiar violado |

**Estimativa de pose** (solvePnP com 6 pontos: nariz, queixo, cantos olhos, cantos boca):
- Modelo 3D genérico em mm (sem calibração de câmera — focal ≈ largura da imagem)
- Decomposta via `cv2.RQDecomp3x3` → (yaw, pitch, roll) em graus

---

## 10. Pele (face_metrics.skin)

| Chave JSON | Unidade | Ideal | Descrição |
|------------|---------|-------|-----------|
| `skin_uniformity_std_lab_left` | Lab σ | < 10 | Desvio padrão da cor Lab na ROI bochecha esquerda |
| `skin_uniformity_std_lab_right` | Lab σ | < 10 | Idem bochecha direita |
| `skin_uniformity_std_lab_forehead` | Lab σ | < 10 | Idem testa |
| `skin_lighting_delta_e_lr` | unidades Lab | < 2 | ΔE perceptual entre bochecha esq e dir (mesma que lighting) |
| `under_eye_darkness_left` | 0–1 | < 0.05 | Escuridão infra-orbital esq vs bochecha (0=sem olheira, >0.2=visível) |
| `under_eye_darkness_right` | 0–1 | < 0.05 | Idem direito |

**ROIs de pele**:
- Bochecha esq: triângulo (centro_olho_esq, ala_nariz_esq, p3)
- Bochecha dir: triângulo (centro_olho_dir, ala_nariz_dir, p13)
- Testa: retângulo acima das sobrancelhas, altura = IPD × 0.6

**Olheiras**: razão luminância L* (Lab) da região infra-orbital vs bochecha.
`darkness = max(0, 1 − L_under / L_cheek)` — 0 = sem diferença, positivo = mais escuro.
