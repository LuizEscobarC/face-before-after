# Limiares de Severidade

Sistema atual: **3 zonas** (green/yellow/red) definidas por métrica na tabela `metric_ideal` do PostgreSQL.
Não existe mais a escala de 5 níveis uniforme do sistema dlib.

---

## Zonas de severity

| Zona | severity_5 | severity_3 | Descrição |
|------|------------|------------|-----------|
| **GREEN** | `ideal` | `LEVE` | Dentro do intervalo verde — resultado esperado |
| **YELLOW** | `mild` ou `moderate` | `MODERADO` | Fora do verde, dentro do amarelo |
| **RED** | `strong` ou `extreme` | `SEVERO` | Fora do intervalo amarelo |

**Classificação (NestJS):**
```typescript
if (value >= green_range_min && value <= green_range_max)  → GREEN
else if (value >= yellow_range_min && value <= yellow_range_max) → YELLOW
else → RED
```

> Métricas com `is_low_confidence=True` **não** recebem severity — são exibidas como `"confidence_low"`.  
> Métricas `presentation_only=True` exibem o valor, mas não entram no score regional.  
> Stubs (`direction="not_computed"`) não têm `metric_ideal` — severity = null.

---

## Limiares por região (seleção dos mais relevantes)

Fonte: migrations `1746000040000-SeedMetricCatalogV1.ts`, `1746000160000-SeedMetricsWaveC2.ts`, `1746000320000-SeedMetricsWaveC3.ts`.

### Região: symmetry

| metric_id | ideal | green_min | green_max | yellow_min | yellow_max |
|-----------|-------|-----------|-----------|------------|------------|
| `midline_deviation` | 0.0 | 0.0 | 0.03 | 0.0 | 0.08 |
| `eye_height_asymmetry` | 0.0 | 0.0 | 0.05 | 0.0 | 0.12 |
| `brow_height_asymmetry` | 0.0 | 0.0 | 0.05 | 0.0 | 0.12 |
| `lip_canting_angle` | 0.0 | -2.0 | 2.0 | -5.0 | 5.0 |
| `global_asymmetry_index` | 0.0 | 0.0 | 0.04 | 0.0 | 0.10 |

### Região: eyes

| metric_id | ideal | green_min | green_max | yellow_min | yellow_max |
|-----------|-------|-----------|-----------|------------|------------|
| `eye_aperture_ratio_l` | 0.30 | 0.25 | 0.35 | 0.18 | 0.42 |
| `eye_aperture_ratio_r` | 0.30 | 0.25 | 0.35 | 0.18 | 0.42 |
| `interpupillary_distance` | 2.0 | 1.8 | 2.2 | 1.5 | 2.5 |
| `intercanthal_distance` | 1.0 | 0.90 | 1.10 | 0.75 | 1.25 |
| `canthal_tilt_l` | 0.0 | -1.0 | 1.0 | -5.0 | 5.0 |
| `canthal_tilt_r` | 0.0 | -1.0 | 1.0 | -5.0 | 5.0 |

### Região: thirds

| metric_id | ideal | green_min | green_max | yellow_min | yellow_max |
|-----------|-------|-----------|-----------|------------|------------|
| `upper_third_ratio` | 0.333 | 0.30 | 0.37 | 0.25 | 0.42 |
| `middle_third_ratio` | 0.333 | 0.30 | 0.37 | 0.25 | 0.42 |
| `lower_third_ratio` | 0.333 | 0.30 | 0.37 | 0.25 | 0.42 |

### Região: nose

| metric_id | ideal | green_min | green_max | yellow_min | yellow_max |
|-----------|-------|-----------|-----------|------------|------------|
| `nose_width_to_icd` | 1.00 | 0.85 | 1.15 | 0.70 | 1.35 |
| `alar_to_face_width_ratio` | 0.25 | 0.22 | 0.28 | 0.18 | 0.33 |
| `dorsum_deviation` | 0.0 | 0.0 | 0.04 | 0.0 | 0.10 |
| `nasal_tip_deviation` | 0.0 | 0.0 | 0.04 | 0.0 | 0.10 |

### Região: mouth

| metric_id | ideal | green_min | green_max | yellow_min | yellow_max |
|-----------|-------|-----------|-----------|------------|------------|
| `mouth_width_to_icd` | 1.60 | 1.40 | 1.80 | 1.20 | 2.00 |
| `upper_lip_height_ratio` | 0.40 | 0.35 | 0.45 | 0.28 | 0.55 |
| `lower_lip_height_ratio` | 0.60 | 0.55 | 0.65 | 0.45 | 0.72 |

### Região: jaw

| metric_id | ideal | green_min | green_max | yellow_min | yellow_max |
|-----------|-------|-----------|-----------|------------|------------|
| `jaw_width_ratio` | 0.75 | 0.68 | 0.82 | 0.58 | 0.92 |
| `gonial_angle_l` | 120.0 | 110.0 | 130.0 | 100.0 | 140.0 |
| `gonial_angle_r` | 120.0 | 110.0 | 130.0 | 100.0 | 140.0 |
| `chin_height_ratio` | 0.35 | 0.30 | 0.40 | 0.24 | 0.46 |

### Região: brows

| metric_id | ideal | green_min | green_max | yellow_min | yellow_max |
|-----------|-------|-----------|-----------|------------|------------|
| `brow_height_l` | 0.50 | 0.40 | 0.60 | 0.30 | 0.72 |
| `brow_height_r` | 0.50 | 0.40 | 0.60 | 0.30 | 0.72 |
| `brow_arch_peak_l` | 0.20 | 0.14 | 0.26 | 0.08 | 0.34 |
| `brow_arch_peak_r` | 0.20 | 0.14 | 0.26 | 0.08 | 0.34 |
| `interbrow_distance_ratio` | 1.00 | 0.85 | 1.15 | 0.70 | 1.30 |

### Região: cheekbones

| metric_id | ideal | green_min | green_max | yellow_min | yellow_max |
|-----------|-------|-----------|-----------|------------|------------|
| `zygomatic_width_ratio` | 1.30 | 1.20 | 1.40 | 1.05 | 1.55 |
| `malar_projection_index` | 0.30 | 0.22 | 0.38 | 0.14 | 0.48 |
| `cheekbone_to_jaw_ratio` | 1.30 | 1.18 | 1.42 | 1.05 | 1.56 |

### Região: forehead

| metric_id | ideal | green_min | green_max | yellow_min | yellow_max |
|-----------|-------|-----------|-----------|------------|------------|
| `forehead_height_ratio` | 0.333 | 0.29 | 0.38 | 0.24 | 0.44 |
| `forehead_width_ratio` | 0.90 | 0.80 | 1.00 | 0.68 | 1.12 |

### global / phi_golden

| metric_id | ideal | green_min | green_max | yellow_min | yellow_max |
|-----------|-------|-----------|-----------|------------|------------|
| `face_height_to_width_ratio` | 1.35 | 1.20 | 1.50 | 1.05 | 1.70 |
| `phi_face_height_to_width` | 1.618 | 1.50 | 1.75 | 1.35 | 1.90 |

---

## Métricas scoráveis vs. não-scoráveis

| Categoria | Quantidade | Motivo |
|-----------|-----------|--------|
| Com `metric_ideal` (scoráveis) | 88 | Entram no score regional |
| Stubs DEC-10 | 4 | `direction="not_computed"`, `confidence_final=0` — sem ideal |
| `presentation_only=True` | alguns | Exibidos mas não somam score |

**Os 4 stubs** (`supratarsal_fold_visibility`, `nasolabial_angle_proxy`, `ogee_curve_proxy`, `forehead_slope_proxy`) nunca têm severity — sempre null.

---

## Score regional

```typescript
// Pseudocódigo NestJS (analysis.service.ts)
const regionalScore = weightedAverage(
  metricsInRegion
    .filter(m => !m.is_low_confidence && !m.presentation_only && m.severity_5 !== null)
    .map(m => ({ value: zoneToScore(m.severity_5), weight: m.weight_in_region }))
);

function zoneToScore(severity: string): number {
  switch (severity) {
    case "ideal":    return 1.0;
    case "mild":     return 0.75;
    case "moderate": return 0.50;
    case "strong":   return 0.25;
    case "extreme":  return 0.0;
  }
}
```


| Nível | Cor HTML | Css class | Significado |
|-------|----------|-----------|-------------|
| **excelente** | `#3fb950` (verde) | `.sev-excelente` | Dentro do ideal (desvio ≤ 1× tolerância) |
| **leve** | `#d29922` (amarelo) | `.sev-leve` | Desvio 1–2× tolerância |
| **moderada** | `#db6d28` (laranja) | `.sev-moderada` | Desvio 2–3× tolerância |
| **acentuada** | `#f85149` (vermelho) | `.sev-acentuada` | Desvio 3–4× tolerância |
| **severa** | `#f85149` (vermelho) | `.sev-severa` | Desvio > 4× tolerância |

---

## Limiares por métrica

A fórmula universal é:
```
diff = |valor − ideal|

excelente : diff ≤ tol × 1
leve      : diff ≤ tol × 2
moderada  : diff ≤ tol × 3
acentuada : diff ≤ tol × 4
severa    : diff > tol × 4
```

### Assimetria global

| Severidade | Intervalo % IPD |
|-----------|-----------------|
| Excelente | ≤ 1.0% |
| Leve | 1.0% – 2.0% |
| Moderada | 2.0% – 3.0% |
| Acentuada | 3.0% – 4.0% |
| Severa | > 4.0% |

### fWHR (ideal ~1.85, tol 0.10)

| Severidade | Intervalo |
|-----------|-----------|
| Excelente | 1.75 – 1.95 |
| Leve | 1.65 – 2.05 |
| Moderada | 1.55 – 2.15 |
| Acentuada | 1.45 – 2.25 |
| Severa | < 1.45 ou > 2.25 |

### Canthal tilt médio (ideal +5°, tol 3°)

| Severidade | Intervalo |
|-----------|-----------|
| Excelente | +2° a +8° |
| Leve | −1° a +11° |
| Moderada | −4° a +14° |
| Acentuada | −7° a +17° |
| Severa | < −7° ou > +17° |

### Desvio dos terços (ideal 0, tol 0.03)

| Severidade | Desvio padrão |
|-----------|---------------|
| Excelente | ≤ 0.030 |
| Leve | 0.030 – 0.060 |
| Moderada | 0.060 – 0.090 |
| Acentuada | 0.090 – 0.120 |
| Severa | > 0.120 |

### Desvio dos quintos (ideal 0, tol 0.03)

Mesma escala que terços.

### Lower third ratio (ideal 0.56, tol 0.05)

| Severidade | Intervalo |
|-----------|-----------|
| Excelente | 0.51 – 0.61 |
| Leve | 0.46 – 0.66 |
| Moderada | 0.41 – 0.71 |
| Acentuada | 0.36 – 0.76 |
| Severa | < 0.36 ou > 0.76 |

### Intercanthal / largura do olho (ideal 1.0, tol 0.10)

| Severidade | Intervalo |
|-----------|-----------|
| Excelente | 0.90 – 1.10 |
| Leve | 0.80 – 1.20 |
| Moderada | 0.70 – 1.30 |
| Acentuada | 0.60 – 1.40 |
| Severa | < 0.60 ou > 1.40 |

### Nariz / boca (ideal 0.70, tol 0.10)

| Severidade | Intervalo |
|-----------|-----------|
| Excelente | 0.60 – 0.80 |
| Leve | 0.50 – 0.90 |
| Moderada | 0.40 – 1.00 |
| Acentuada | 0.30 – 1.10 |
| Severa | < 0.30 ou > 1.10 |

### Boca / IPD (ideal 1.50, tol 0.20)

| Severidade | Intervalo |
|-----------|-----------|
| Excelente | 1.30 – 1.70 |
| Leve | 1.10 – 1.90 |
| Moderada | 0.90 – 2.10 |
| Acentuada | 0.70 – 2.30 |

### Marquardt deviation % IPD (ideal 0, tol 3.0)

| Severidade | Intervalo % IPD |
|-----------|-----------------|
| Excelente | ≤ 3.0% |
| Leve | 3.0% – 6.0% |
| Moderada | 6.0% – 9.0% |
| Acentuada | 9.0% – 12.0% |
| Severa | > 12.0% |

### Jaw width % IPD (ideal 155%, tol 20%)

| Severidade | Intervalo |
|-----------|-----------|
| Excelente | 135% – 175% |
| Leve | 115% – 195% |
| Moderada | 95% – 215% |

### EAR médio (ideal 0.30, tol 0.04)

| Severidade | Intervalo |
|-----------|-----------|
| Excelente | 0.26 – 0.34 |
| Leve | 0.22 – 0.38 |
| Moderada | 0.18 – 0.42 |

### Uniformidade da pele (ideal 0, tol 10 Lab σ)

| Severidade | Std Lab |
|-----------|---------|
| Excelente | ≤ 10 |
| Leve | 10 – 20 |
| Moderada | 20 – 30 |
| Acentuada | 30 – 40 |
| Severa | > 40 |

### Olheiras (ideal 0, tol 0.05)

| Severidade | Valor |
|-----------|-------|
| Excelente | ≤ 0.05 |
| Leve | 0.05 – 0.10 |
| Moderada | 0.10 – 0.15 |
| Acentuada | 0.15 – 0.20 |
| Severa | > 0.20 |

### Upper/lower lip ratio (ideal 0.65, tol 0.15)

| Severidade | Intervalo |
|-----------|-----------|
| Excelente | 0.50 – 0.80 |
| Leve | 0.35 – 0.95 |
| Moderada | 0.20 – 1.10 |

### Philtrum length % IPD (ideal 26%, tol 4%)

| Severidade | Intervalo |
|-----------|-----------|


## Designação das classes CSS no relatório HTML

Usadas para colorir badges/pills de severidade no `relatorio.html`:

```css
.sev-excelente { background: rgba(63,185,80,0.15);  color: #3fb950; border-color: rgba(63,185,80,0.4); }
.sev-leve      { background: rgba(210,153,34,0.15); color: #d29922; border-color: rgba(210,153,34,0.4); }
.sev-moderada  { background: rgba(219,109,40,0.15); color: #db6d28; border-color: rgba(219,109,40,0.4); }
.sev-acentuada { background: rgba(248,81,73,0.15);  color: #f85149; border-color: rgba(248,81,73,0.4); }
.sev-severa    { background: rgba(248,81,73,0.20);  color: #f85149; border-color: rgba(248,81,73,0.5); }
```
