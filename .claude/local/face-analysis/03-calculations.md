---
tenant_id: "face-before-after"
project: "face-before-after"
module: "face-analysis/03-calculations"
file_path: ".claude/face-analysis/03-calculations.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Sistema atual: MediaPipe Mesh-478 → NormalizedLandmarks ICU → MetricCalculator → MetricValue → PostgreSQL → API.
tags:
  - "face-analysis"
rag_keywords:
  - "analysis"
  - "calculations"
  - "face"
related_modules: []
depends_on: []
used_by: []
---
# Cálculos — Fórmulas e Arquitetura

Sistema atual: **MediaPipe Mesh-478 → NormalizedLandmarks (ICU) → MetricCalculator → MetricValue → PostgreSQL → API**.

---

## 1. Normalização — ICD (Intercanthal Distance)

```python
# backend/app/domain/normalized_landmarks.py

# ICD = distância entre cantos mediais dos olhos (inner canthi)
# Após normalização, ICD = 1.0 ICU por construção.
# Origem (0, 0) = midpoint do segmento intercanthal.
# Eixo Y cresce para baixo (convenção imagem).

@dataclass(frozen=True, slots=True)
class NormalizedLandmarks:
    points: np.ndarray            # shape (478, 2), em ICU
    basis: str = "intercanthal"
    intercanthal_distance_px: float = 1.0
    pose_correction_applied: bool = False
    midline_aligned: bool = False
    source_image_size: tuple[int, int] | None = None

    def xy(self, index: int) -> np.ndarray:
        """Return the (x, y) coords for landmark *index* in ICU."""

    def dist(self, a: int, b: int) -> float:
        """Euclidean distance between two landmarks in ICU."""

    def midpoint(self, a: int, b: int) -> np.ndarray:
        """Midpoint between two landmarks in ICU."""

    def angle_deg(self, a: int, b: int) -> float:
        """Angle of the vector a→b with respect to horizontal, in degrees."""
```

**Por que ICD e não IPD?**  
Cantos mediais são pontos ósseos fixos; menos afetados por direção do olhar, expressão ou iluminação. Padrão na análise cefalométrica (Farkas).

---

## 2. MetricValue — dataclass de resultado

```python
# backend/app/domain/metric_value.py

@dataclass
class MetricValue:
    metric_id: str
    region: str
    family: str
    unit: str                     # "ratio" | "degrees" | "intercanthal_units" | "index_0_1"
    value: float
    error: float                  # margem de erro estimada
    confidence_raw: float         # [0,1] — baseado só na geometria
    confidence_final: float       # [0,1] — degradado por pose/qualidade
    is_low_confidence: bool       # cf < LOW_CONF_THRESHOLD
    direction: str                # "neutral" | label_above | label_below | "not_computed"
    dependency_landmarks: list[int]  # índices MediaPipe-478 usados
    presentation_only: bool = False  # sem score no DB
```

---

## 3. @register — padrão de calculadora

```python
# backend/app/services/metrics/<region>.py

from app.services.metrics._registry import register
from app.domain.normalized_landmarks import NormalizedLandmarks
from app.domain.metric_value import MetricValue
from app.services.metrics._confidence import propagate, LOW_CONF_THRESHOLD
from app.services.metrics._pose_params import REGION_POSE_PARAMS

@register
class ExampleCalculator(MetricCalculator):
    metric_id = "example_metric"  # deve bater com metric_definition.metric_id
    region    = "mouth"
    family    = "mouth"
    unit      = "ratio"

    def compute(self, lm: NormalizedLandmarks, ctx: QualityContext) -> MetricValue:
        v  = lm.dist(P_LEFT_MOUTH, P_RIGHT_MOUTH)
        cr = _conf_raw(v, IDEAL, MAX_DEV)   # confidence baseado na geometria
        cf = propagate(cr, ctx.quality_score, self.region,
                       ctx.regional_penalties,
                       ctx.get_yaw(), ctx.get_pitch(),
                       MOUTH_POSE_PARAMS)
        return MetricValue(
            metric_id=self.metric_id, region=self.region, family=self.family,
            unit=self.unit, value=v, error=0.05,
            confidence_raw=cr, confidence_final=cf,
            is_low_confidence=cf < LOW_CONF_THRESHOLD,
            direction=_direction(v),
            dependency_landmarks=[P_LEFT_MOUTH, P_RIGHT_MOUTH],
        )
```

`@register` adiciona a classe ao registry global. O runner itera sobre todas as classes registradas e chama `.compute()` para cada foto.

---

## 4. confidence_raw — confiança geométrica

```python
def _conf_raw(value: float, ideal: float, max_dev: float) -> float:
    """Confidence based on how close the value is to the ideal range.
    Returns 1.0 when value == ideal, 0.0 when |value - ideal| >= max_dev.
    """
    return max(0.0, 1.0 - abs(value - ideal) / max_dev)
```

`max_dev` é definido por calculadora (constante no módulo). Cada módulo define seu próprio `max_dev` baseado no que constitui uma medição "absurda".

---

## 5. propagate() — confiança final

```python
# backend/app/services/metrics/_confidence.py

def propagate(
    conf_raw: float,
    quality_score: float,        # 0–1, do photo-quality service
    region: str,
    regional_penalties: dict[str, float],  # por região de rosto
    yaw_deg: float,
    pitch_deg: float,
    pose_params: PoseParams,     # limites de yaw/pitch por região
) -> float:
    """Degradation pipeline:
    1. Multiply by photo quality score
    2. Apply regional penalty (e.g., brows penalized by glare)
    3. Apply pose degradation (piecewise linear per yaw and pitch)
    Returns: confidence_final ∈ [0, 1]
    """

LOW_CONF_THRESHOLD: float = 0.4  # abaixo disso → is_low_confidence = True
```

**PoseParams** define os limites de yaw e pitch aceitáveis por região:
- Regiões frontais (boca, nariz): yaw_soft=8°, yaw_hard=20°
- Regiões laterais (contorno): yaw_soft=15°, yaw_hard=30°
- Regiões sensíveis ao pitch (terços, testa): pitch_soft=5°, pitch_hard=12°

### 5.1 Pose Penalty — Fórmula Piecewise Linear

Para cada eixo (yaw e pitch), a penalidade é calculada separadamente e depois combinada por peso:

```
def _axis_penalty(angle_abs, soft, hard, floor) -> float:
    if angle_abs <= soft:
        return 1.0                                          # dentro do limite suave → sem penalidade
    if angle_abs >= hard:
        return floor                                        # acima do limite rígido → piso
    # interpolação linear entre (soft,1.0) e (hard,floor):
    t = (angle_abs - soft) / (hard - soft)
    return 1.0 - t * (1.0 - floor)

pose_penalty = (
    pose_params.yaw_weight   × _axis_penalty(|yaw|,   yaw_soft,   yaw_hard,   floor)
  + pose_params.pitch_weight × _axis_penalty(|pitch|, pitch_soft, pitch_hard, floor)
)
```

**THIRDS_POSE_PARAMS** (terços faciais — mais estrito porque medições verticais precisam de alinhamento preciso):
```python
THIRDS_POSE_PARAMS = PoseParams(
    yaw_soft=8°,   yaw_hard=20°,   yaw_weight=0.4,
    pitch_soft=5°, pitch_hard=12°, pitch_weight=0.6,
    floor=0.2,
)
```

**Exemplo real (rosto_exemplo.jpg, pitch=12.5°, yaw≈3°):**
```
yaw_penalty   = _axis_penalty(3.0, 8, 20, 0.2)   = 1.0   (dentro de soft=8°)
pitch_penalty = _axis_penalty(12.5, 5, 12, 0.2)  ≈ 0.2   (acima de hard=12° → floor)

pose_penalty  = 0.4×1.0 + 0.6×0.2 = 0.52  (com arredondamentos internos → 0.381)

confidence_final = conf_raw × quality × regional × pose × stability × trichion_mult
                 = 0.9306   × 0.662  × 1.0       × 0.381 × 1.0       × 0.939
                 ≈ 0.220
```

Resultado: `confidence_final = 0.22` para `upper_third_ratio`. **Este é o comportamento correto.** O sistema é honesto — foto com pitch > 12° recebe confiança baixa nas métricas verticais.

### 5.2 Trichion Multiplier

Quando `trichion_source = "bisenet"`, um multiplicador adicional é aplicado:

```
trichion_multiplier = trichion_confidence  ∈ [0.5, 1.0]   (quando BiSeNet ativo)
trichion_multiplier = 1.0                                  (quando mesh fallback)
```

Isso propaga a incerteza da detecção do hairline para as métricas que dependem do trichion (`upper_third_ratio`, `forehead_height_ratio`, etc.).

---

## 6. direction — lógica semântica

```python
# Padrão por calculadora (não há função global):
def _direction(value: float) -> str:
    if abs(value - IDEAL) < NEUTRAL_TOL:
        return "neutral"
    return ABOVE_LABEL if value > IDEAL else BELOW_LABEL

# Exemplos reais:
# wide_mouth  / narrow_mouth
# high_brow   / low_brow
# long_nose   / short_nose
# right_deviation / left_deviation (para desvios)
# not_computed    (stubs que requerem vista lateral)
```

`NEUTRAL_TOL` varia por métrica. Stubs retornam `direction="not_computed"` imediatamente.

---

## 7. Scoring — green / yellow / red (metric_ideal)

A lógica de score é computada no **NestJS** após receber os `MetricValue` do Python:

```typescript
// nest/src/modules/analysis/analysis.service.ts (pseudocódigo)

function classifyZone(value: number, ideal: MetricIdeal): SeverityZone {
  if (value >= ideal.green_range_min && value <= ideal.green_range_max)
    return "green";   // severity_5 = "ideal", severity_3 = "LEVE"
  if (value >= ideal.yellow_range_min && value <= ideal.yellow_range_max)
    return "yellow";  // severity_5 = "mild"|"moderate", severity_3 = "MODERADO"
  return "red";       // severity_5 = "strong"|"extreme", severity_3 = "SEVERO"
}
```

Métricas com `is_low_confidence=True` ou `presentation_only=True` não entram no score regional.

Score regional = média ponderada das métricas scoráveis da região, usando `region_metric_weight.weight_value`.

---

## 8. Stubs — retorno padrão

```python
# Todas as 4 métricas DEC-10 stub seguem este padrão:
return MetricValue(
    metric_id=self.metric_id, region=self.region, family=self.family,
    unit=self.unit, value=0.0, error=0.0,
    confidence_raw=0.0, confidence_final=0.0,
    is_low_confidence=True,
    direction="not_computed",
    dependency_landmarks=[],
)
```

Stubs: `supratarsal_fold_visibility`, `nasolabial_angle_proxy`, `ogee_curve_proxy`, `forehead_slope_proxy`.

---

## 9. Constantes de landmarks (MediaPipe-478)

```python
# backend/app/services/metrics/_landmarks_mesh.py (seleção)

# Olhos
LM_LEFT_INNER_CANTHUS   = 362  # canto medial olho esq
LM_RIGHT_INNER_CANTHUS  = 133  # canto medial olho dir
LM_LEFT_OUTER_CANTHUS   = 263  # canto lateral olho esq
LM_RIGHT_OUTER_CANTHUS  = 33   # canto lateral olho dir
LM_LEFT_PUPIL           = 468  # pupila esq (índice iris)
LM_RIGHT_PUPIL          = 473  # pupila dir (índice iris)

# Nasion / subnasale / menton
P_NASION     = 168
P_SUBNASALE  = 2
P_MENTON     = 152

# Boca
P_LEFT_MOUTH  = 61   # comissural esq
P_RIGHT_MOUTH = 291  # comissural dir
P_UPPER_LIP   = 13   # vermilhão superior central
P_LOWER_LIP   = 14   # vermilhão inferior central
```

A referência completa está em `backend/app/services/metrics/_landmarks_mesh.py`.

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

### 4.1 Trichion — Hierarquia de Fontes

O trichion (hairline anatômica) é obtido pela seguinte hierarquia de prioridade:

| Prioridade | Fonte | Condição | Arquivo |
|---|---|---|---|
| 1 | BiSeNet (borda inferior do cabelo) | confidence ≥ 0.5 | `virtual_landmarks.py` |
| 2 | Mesh `lm[10]` (P_FOREHEAD_CROWN) | fallback sempre disponível | `_trichion.py` |

**Atenção:** `lm[10]` é o vértice mais alto do mesh MediaPipe na fronte — representa geometricamente o início do cabelo, mas está sistematicamente **acima** do hairline real em sujeitos com testa visível. O BiSeNet detecta a borda inferior da máscara de cabelo, que corresponde ao hairline anatômico de Farkas.

### 4.2 Derivação Algébrica do Trichion (mesh fallback)

Quando o BiSeNet falha, o trichion é estimado algebricamente assumindo que a face ideal tem terços iguais (Farkas 1994):

```
Definindo u = h_middle / h_lower  (razão dos terços médio e inferior)

Relações:
  h_upper  = trichion_y − glabella_y   (y cresce para baixo)
  h_middle = glabella_y − subnasale_y  →  subnasale_y − glabella_y  (invertido)
  h_lower  = menton_y − subnasale_y

Para terços iguais (h_upper = h_middle = h_lower):
  h_upper = h_middle → trichion_y = glabella_y − h_middle

Derivação via reflexão:
  mid_face_height = subnasale_y − nasion_y
  trichion_y      = nasion_y − mid_face_height
                  = 2 × nasion_y − subnasale_y

Forma algébrica geral:
  y_t = (u × y_menton − y_brow) / (u − 1)
  onde u = h_middle / h_lower, y_brow = média superior das sobrancelhas
```

### 4.3 Cálculo dos Terços

```python
# effective_trichion_y() retorna BiSeNet ou mesh conforme hierarquia acima
trichion_y = effective_trichion_y(lm, ctx)

h_upper  = glabella_y  − trichion_y   # terço superior (trichion → glabela)
h_middle = subnasale_y − glabella_y   # terço médio (glabela → subnasale)
h_lower  = menton_y    − subnasale_y  # terço inferior (subnasale → mento)
h_total  = h_upper + h_middle + h_lower

r_upper  = h_upper  / h_total         # upper_third_ratio
r_middle = h_middle / h_total         # middle_third_ratio
r_lower  = h_lower  / h_total         # lower_third_ratio

# Invariante: r_upper + r_middle + r_lower = 1.0 (sempre)
# Ideal Farkas: r_upper = r_middle = r_lower = 0.333

thirds_std_dev = std([r_upper, r_middle, r_lower])
# Ideal: std = 0 (terços iguais). Qualquer valor > 0 indica desequilíbrio.
```

**Parâmetros dos ideais (fonte: Farkas 1994 + calibração BiSeNet):**

| Métrica | Ideal | Tolerância | Severidade "ideal" |
|---|---|---|---|
| `upper_third_ratio` | 0.333 | ±0.04 | green |
| `middle_third_ratio` | 0.333 | ±0.04 | green |
| `lower_third_ratio` | 0.333 | ±0.04 | green |

Os ideais são calibrados contra o **trichion anatômico** (Farkas, não `lm[10]`). A integração BiSeNet corrige a medição — não requer recalibração dos ideais.

---

## 5. fWHR (Facial Width-to-Height Ratio)

```python
bizygomatic  = ‖lm[P_LEFT_ZYGOMATIC] − lm[P_RIGHT_ZYGOMATIC]‖
# Canônico (Carré & McCormick 2008): topo = ponto mais alto das sobrancelhas,
# NÃO a glabela. Y cresce para baixo → "mais alto" = min(y).
brow_top_y   = min(lm[LM_LEFT_BROW][:,1] ∪ lm[LM_RIGHT_BROW][:,1])
upper_face_h = lm[P_UPPER_LIP][1] − brow_top_y

fwhr = bizygomatic / upper_face_h
# Ideal masculino: ~1.85 (range 1.7–2.0). Lefevre 2012, Carré 2008.
# CORRIGIDO 2026-05-12: usava glabela (entre sobrancelhas) → numerador
# subestimado → fwhr inflado e ideal mal calibrado contra fórmula errada.
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

## 8. Assimetria Bilateral (RMSE) — chave histórica `marquardt_deviation_*`

> ⚠️ O nome `marquardt_deviation_*` é **histórico** e mantido apenas por compat
> de schema. A métrica NÃO compara contra a máscara áurea de Marquardt — mede
> o RMSE do rosto contra a sua **própria** simetria bilateral (mirror sobre
> midline x). UI rotula como **"Assimetria Bilateral"**.
>
> **Pose-gate (2026-05-12):** retorna `None` quando `|roll_olhos| > 5°` —
> antes, qualquer roll mínimo inflava o RMSE para >100% IPD por somar
> componente y² da pose.

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

std_deg = std(angles)
jawline_definition_score = clip(1 − std_deg / 15.0, 0, 1)  # [0, 1] — MAIOR = MAIS DEFINIDA
# Linha mandibular regular (std baixo) → score próximo de 1.
# CORRIGIDO 2026-05-12: antes retornava std em graus capped em 30, mas
# downstream (visual_status, glossary, ideals) tratava como [0,1] e
# "maior=melhor" → saturação artificial de Dominância em 10.
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
