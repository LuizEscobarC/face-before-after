# Limiares de Severidade

## Escala de severidade

O sistema usa 5 níveis de severidade, aplicados uniformemente a todas as métricas:

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
| Excelente | 22% – 30% |
| Leve | 18% – 34% |
| Moderada | 14% – 38% |

---

## Jawline definition score (regra especial)

Ao contrário das demais, esta métrica usa regra "maior = melhor":

```python
if   value >= 7: sev = "excelente"
elif value >= 5: sev = "leve"
elif value >= 3: sev = "moderada"
else:            sev = "acentuada"
```

---

## Score de simetria → tier

| Score | Tier | Descrição |
|-------|------|-----------|
| ≥ 80 | Alta | Simetria excelente — assimetria praticamente imperceptível |
| ≥ 60 | Boa | Assimetria leve — dentro da variação natural |
| ≥ 40 | Moderada | Assimetria moderada — perceptível em análise detalhada |
| < 40 | Baixa | Assimetria marcada — perceptível a olho nu |

---

## Qualidade da captura — alertas

| Condição | Alerta gerado |
|----------|---------------|
| `|yaw| > 7° ou |pitch| > 7°` | "Pose facial fora do limite frontal (|yaw|=X°, |pitch|=Y°). Métricas podem estar enviesadas." |
| `focal_ratio > 0.55` | "Possível distorção por lente curta (nariz/bizigomática=X.XX)." |
| `face_pixel_width < 200` | "Resolução facial baixa (Xpx). Use foto >= 400px." |
| `sharpness < 50` | "Foto pouco nítida (variância do laplaciano=X)." |

---

## Designação das classes CSS no relatório HTML

Usadas para colorir badges/pills de severidade no `relatorio.html`:

```css
.sev-excelente { background: rgba(63,185,80,0.15);  color: #3fb950; border-color: rgba(63,185,80,0.4); }
.sev-leve      { background: rgba(210,153,34,0.15); color: #d29922; border-color: rgba(210,153,34,0.4); }
.sev-moderada  { background: rgba(219,109,40,0.15); color: #db6d28; border-color: rgba(219,109,40,0.4); }
.sev-acentuada { background: rgba(248,81,73,0.15);  color: #f85149; border-color: rgba(248,81,73,0.4); }
.sev-severa    { background: rgba(248,81,73,0.20);  color: #f85149; border-color: rgba(248,81,73,0.5); }
```
