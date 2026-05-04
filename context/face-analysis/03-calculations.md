# Cálculos — Fórmulas Completas

---

## 1. IPD — Distância Interpupilar

```python
# Centro de cada olho = média dos 6 landmarks
left_eye_center  = lm[36:42].mean(axis=0)   # pontos 36, 37, 38, 39, 40, 41
right_eye_center = lm[42:48].mean(axis=0)   # pontos 42, 43, 44, 45, 46, 47

IPD = ‖right_eye_center − left_eye_center‖  # norma euclidiana em pixels
```

Toda métrica "% IPD" = `(valor_px / IPD) × 100`.

---

## 2. Score de simetria (0–100)

```python
MAX_ASYMMETRY_REFERENCE = 15.0  # % IPD

def asymmetry_to_score(overall_pct_ipd: float) -> int:
    clamped = min(overall_pct_ipd, MAX_ASYMMETRY_REFERENCE)
    score = int(round((1.0 - clamped / MAX_ASYMMETRY_REFERENCE) * 100))
    return score
```

Exemplos:
| % IPD | Score |
|-------|-------|
| 0.0% | 100 |
| 1.5% | 90 |
| 3.0% | 80 |
| 7.5% | 50 |
| 12.0% | 20 |
| ≥15.0% | 0 |

---

## 3. Tiers de score

```python
SCORE_TIERS = [
    (80, "Alta",     "Simetria excelente — assimetria praticamente imperceptível"),
    (60, "Boa",      "Assimetria leve — dentro da variação natural"),
    (40, "Moderada", "Assimetria moderada — perceptível em análise detalhada"),
    ( 0, "Baixa",    "Assimetria marcada — perceptível a olho nu"),
]

# Uso: primeiro tier cujo limiar ≤ score
tier_label = next(label for threshold, label, _ in SCORE_TIERS if score >= threshold)
```

---

## 4. Terços faciais (proporções verticais)

```python
# Estimativa do trichion (sem landmark real):
mid_face_height = subnasale_y − nasion_y
trichion_y      = nasion_y − mid_face_height   # reflexão acima do nasion

h_upper  = glabella_y − trichion_y    # terço superior
h_middle = subnasale_y − glabella_y   # terço médio
h_lower  = menton_y − subnasale_y     # terço inferior
h_total  = h_upper + h_middle + h_lower

r_upper  = h_upper  / h_total
r_middle = h_middle / h_total
r_lower  = h_lower  / h_total

thirds_std_dev = std([r_upper, r_middle, r_lower])
# Ideal: std ≈ 0 (terços iguais = 1/3 cada)
```

---

## 5. fWHR (Facial Width-to-Height Ratio)

```python
bizygomatic = ‖lm[1] − lm[15]‖            # largura zigomática
upper_face_h = lm[P_UPPER_LIP][1] − glabella_y  # p51 → linha das sobrancelhas

fwhr = bizygomatic / upper_face_h
# Ideal masculino: ~1.85 (range: 1.7–2.0)
# Associado a percepção de dominância (Lefevre 2012)
```

---

## 6. Canthal Tilt

```python
# Para cada olho: ângulo da reta canto medial → canto lateral
# Eixo Y cresce para baixo em coords de imagem → invertemos sinal
def canthal_tilt(inner_idx, outer_idx):
    dx = abs(lm[outer_idx][0] − lm[inner_idx][0])
    dy =     lm[outer_idx][1] − lm[inner_idx][1]
    return −degrees(atan2(dy, dx))  # positivo = lateral mais alto

canthal_tilt_left  = canthal_tilt(P_LEFT_EYE_INNER=39,  P_LEFT_EYE_OUTER=36)
canthal_tilt_right = canthal_tilt(P_RIGHT_EYE_INNER=42, P_RIGHT_EYE_OUTER=45)
canthal_tilt_mean  = (canthal_tilt_left + canthal_tilt_right) / 2
# Ideal: ~+5° (Rhee 2012)
```

---

## 7. Eye Aspect Ratio (EAR)

```python
# Soukupová & Čech, 2016
def ear(eye_pts):  # eye_pts: 6 landmarks do olho
    a = ‖eye_pts[1] − eye_pts[5]‖  # altura vertical 1
    b = ‖eye_pts[2] − eye_pts[4]‖  # altura vertical 2
    c = ‖eye_pts[0] − eye_pts[3]‖  # largura horizontal
    return (a + b) / (2 × c)

# Aberto: 0.25–0.35 | Fechado: < 0.20
```

---

## 8. Desvio Marquardt (bilateral RMSE)

```python
# Pares espelhados dos 68 landmarks:
pairs = [
    (0,16), (1,15), (2,14), (3,13), (4,12), (5,11), (6,10), (7,9),
    (17,26), (18,25), (19,24), (20,23), (21,22),
    (36,45), (37,44), (38,43), (39,42), (40,47), (41,46),
    (31,35), (32,34),
    (48,54), (49,53), (50,52), (59,55), (58,56), (60,64), (61,63), (67,65),
]

# Linha média: média entre midpoint dos olhos e glabela
midline_x = ((le_x + re_x)/2 + glabella_x) / 2

sq = []
for (li, ri) in pairs:
    r_mirrored = [2×midline_x − lm[ri][0], lm[ri][1]]
    sq.append(‖lm[li] − r_mirrored‖²)

rmse_px         = sqrt(mean(sq))
rmse_pct_ipd    = rmse_px / IPD × 100
```

---

## 9. Ângulo Gonial

```python
def gonial_angle(idx_g, idx_up, idx_down):
    v1 = lm[idx_up]   − lm[idx_g]   # vetor para cima (ramus)
    v2 = lm[idx_down] − lm[idx_g]   # vetor para baixo (corpo mandibular)
    cos = dot(v1, v2) / (‖v1‖ × ‖v2‖)
    return degrees(acos(clamp(cos, −1, 1)))

# Esquerdo: gonial_angle(4, 2, 6)
# Direito:  gonial_angle(12, 14, 10)
# Típico masculino: 110–130°; mais agudo = mandíbula mais definida
```

---

## 10. Definição da linha mandibular

```python
jaw = lm[0:17]  # 17 pontos do contorno mandibular

angles = []
for i in range(1, len(jaw) − 1):
    v1 = jaw[i]   − jaw[i−1]
    v2 = jaw[i+1] − jaw[i]
    a  = abs(degrees(atan2(v2[1], v2[0]) − atan2(v1[1], v1[0])))
    angles.append(a)

jawline_definition_score = std(angles)
# Maior desvio → curva mais acentuada (mandíbula mais definida)
```

---

## 11. Estimativa de pose (solvePnP)

Pontos de imagem usados (6): nariz (30), queixo (8), canto olho esq (36), canto olho dir (45), canto boca esq (48), canto boca dir (54).

Modelo 3D genérico em mm (sistema coordenado: X=direita, Y=baixo, Z=atrás):
```
Nariz tip:   (  0.0,   0.0,   0.0)
Menton:      (  0.0,  63.6, −12.5)
Olho esq:   (−43.3, −32.7, −26.0)
Olho dir:   ( 43.3, −32.7, −26.0)
Boca esq:   (−28.9,  28.9, −24.1)
Boca dir:   ( 28.9,  28.9, −24.1)
```

```python
focal = image_width  # aproximação sem calibração
ok, rvec, tvec = cv2.solvePnP(model_3d, image_pts, cam_matrix, dist)
rot_mat, _ = cv2.Rodrigues(rvec)
(pitch, yaw, roll), *_ = cv2.RQDecomp3x3(rot_mat)

# Normaliza para [−180, 180]
# Resolve ambiguidade quando |roll| > 90°
frontal = (|yaw| ≤ 7°) AND (|pitch| ≤ 7°)
```

---

## 12. Sharpness (Laplaciana)

```python
face_crop = image[y_min:y_max, x_min:x_max]
gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
sharpness = cv2.Laplacian(gray, cv2.CV_64F).var()

# < 50: foto muito borrada → warning
# 50–500: aceitável
# > 500: nítida
```

---

## 13. Distorção focal

```python
alar      = ‖lm[31] − lm[35]‖   # largura alar
bizyg     = ‖lm[1]  − lm[15]‖   # largura bizigomática
focal_ratio = alar / bizyg

focal_distortion_warning = (focal_ratio > 0.55)
# > 0.55 → selfie próxima ou lente curta → nariz parece mais largo
```

---

## 14. ΔE de iluminação (Lab)

```python
# ROIs: bochechas (triângulos de 3 pontos cada)
mean_left  = mean_LAB(image, bochecha_esq_polygon)
mean_right = mean_LAB(image, bochecha_dir_polygon)
delta_e = ‖mean_left − mean_right‖   # distância euclidiana no espaço CIE Lab

# < 2: imperceptível | 2–10: perceptível | > 10: muito visível (iluminação lateral)
```

---

## 15. Olheiras

```python
# ROI infra-orbital: retângulo abaixo dos 2 pontos inferiores do olho
offset = IPD × 0.12
ue_poly = [bottom − offset, bottom + offset, ...]

L_under = mean_LAB(image, ue_poly)[0]   # canal L* (luminância)
L_cheek = mean_LAB(image, cheek_poly)[0]

under_eye_darkness = max(0.0, 1 − L_under / L_cheek)
# 0 = sem diferença | > 0.2 = olheira visível | > 0.25 = marcada
```

---

## 16. Confiança da captura

```python
# Componentes normalizados individualmente para [0, 1]
frontal_score  = 1.0 if frontal_ok else 0.0
sharpness_score = clamp((sharpness − 50) / 450, 0, 1)  # 50 → 0, 500 → 1
lighting_score  = 1 − min(delta_e / 20, 1)              # ΔE=0 → 1, ΔE≥20 → 0
focal_score     = 0.0 if focal_distortion_warning else 1.0

capture_confidence = (
    0.45 × frontal_score
  + 0.25 × sharpness_score
  + 0.20 × lighting_score
  + 0.10 × focal_score
)
```

---

## 17. Severidade genérica (face_metrics.severity_for)

```python
# ADVANCED_IDEALS[key] = (ideal, tolerance)
# tolerance = "desvio aceitável de 1×"

def severity_for(key, value):
    ideal, tol = ADVANCED_IDEALS[key]
    diff = abs(value − ideal)
    if diff ≤ tol:       return "excelente"
    if diff ≤ tol × 2:   return "leve"
    if diff ≤ tol × 3:   return "moderada"
    if diff ≤ tol × 4:   return "acentuada"
    return "severa"
```

**Ideais e tolerâncias (`ADVANCED_IDEALS`)**:

| Chave | Ideal | Tolerância |
|-------|-------|-----------|
| `overall_asymmetry_score_pct_ipd` | 0.0 | 1.0 |
| `fwhr` | 1.85 | 0.10 |
| `lower_third_ratio` | 0.56 | 0.05 |
| `canthal_tilt_mean_deg` | 5.0 | 3.0 |
| `intercanthal_to_eyewidth_ratio` | 1.0 | 0.10 |
| `nasal_to_mouth_width_ratio` | 0.70 | 0.10 |
| `mouth_to_ipd_ratio` | 1.50 | 0.20 |
| `thirds_std_dev` | 0.0 | 0.03 |
| `fifths_std_dev` | 0.0 | 0.03 |
| `bizygomatic_to_bigonial_ratio` | 1.30 | 0.15 |
| `eye_aspect_ratio_mean` | 0.30 | 0.04 |
| `skin_uniformity_std_lab_left/right` | 0.0 | 10.0 |
| `under_eye_darkness_left/right` | 0.0 | 0.05 |
| `marquardt_deviation_pct_ipd` | 0.0 | 3.0 |
| `jaw_width_pct_ipd` | 155.0 | 20.0 |
| `jawline_definition_score` | 0.65 | 0.20 |
| `upper_lower_lip_ratio` | 0.65 | 0.15 |
| `philtrum_length_pct_ipd` | 26.0 | 4.0 |
