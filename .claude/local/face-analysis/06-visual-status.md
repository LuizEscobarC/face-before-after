---
tenant_id: "face-before-after"
project: "face-before-after"
module: "face-analysis/06-visual-status"
file_path: ".claude/face-analysis/06-visual-status.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > ⚠️ LEGADO — Este documento descreve impressionlayer.py e visualstatus.py localizados na raiz do projeto pipeline antigo dlib-68. As métricas referenciadas fwhr, overallasymmetryscorepctipd, canthaltiltmeandeg, eyeaspectratiomean, jawlinedefinitionscore pertencem ao pipeline leg
tags:
  - "face-analysis"
rag_keywords:
  - "analysis"
  - "face"
  - "status"
  - "visual"
related_modules: []
depends_on: []
used_by: []
---
# Status Visual e Percepção Social

> **⚠️ LEGADO** — Este documento descreve `impression_layer.py` e `visual_status.py` localizados na **raiz do projeto** (pipeline antigo dlib-68). As métricas referenciadas (`fwhr`, `overall_asymmetry_score_pct_ipd`, `canthal_tilt_mean_deg`, `eye_aspect_ratio_mean`, `jawline_definition_score`) pertencem ao pipeline legado e **não existem** como IDs no sistema atual (MediaPipe-478 + NestJS + PostgreSQL).
>
> O sistema NestJS atual **não possui** módulo de `visual_status` ou `first_impression` implementado — é um próximo passo do produto.

---

Estes módulos traduzem métricas técnicas em linguagem de percepção humana.

---

## 1. Primeira Impressão (`impression_layer.py`)

`build_first_impression(metrics) → dict`

### Campos retornados

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `headline` | str | Frase principal de benefício social |
| `tags` | list[str] | Adjetivos de percepção (ex: "assimetria visível") |
| `main_risk` | str | Fator que mais derruba a impressão atual |
| `positive_signal` | str | Ponto forte da face (sempre presente) |

### Regras de risco (em ordem de prioridade)

Cada regra é avaliada na ordem abaixo; **todas que passarem** geram tags:

| ID | Condição | Risk | Tag |
|----|----------|------|-----|
| `tired_eyes` | `canthal_tilt_mean_deg < 0` E olheiras médias > 0.15 | "Olhar transmite cansaço — olhos caídos e área escura..." | "aparência cansada" |
| `low_dominance` | `fwhr < 1.6` E `jawline_definition_score < 0.3` | "Estrutura facial suave reduz percepção de presença..." | "presença suave" |
| `skin_care` | Média uniformidade pele (esq+dir) > 20 | "Irregularidade de tom de pele visível..." | "pele irregular" |
| `visible_asymmetry` | `overall_asymmetry_score_pct_ipd > 3.0` | "Assimetria facial no nível perceptível..." | "assimetria visível" |
| `low_ear` | `eye_aspect_ratio_mean < 0.22` | "Abertura ocular reduzida — olhos pouco abertos..." | "olhos pouco abertos" |

### Sinais positivos (primeiro match vira `positive_signal`)

| ID | Condição | Signal |
|----|----------|--------|
| `high_symmetry` | `overall_asymmetry_score_pct_ipd < 1.0` | "Alta simetria facial — ativo visual forte e raro" |
| `good_canthal` | `canthal_tilt_mean_deg ≥ 3.0` | "Olhar jovial e energético — ângulo do olhar favorável..." |
| `strong_presence` | `fwhr ≥ 1.85` | "Presença marcante — proporção facial associada a autoridade..." |
| `fresh_skin` | Média uniformidade pele < 12 | "Tom de pele uniforme — transmite cuidado e saúde..." |
| `default` | sempre | "Equilíbrio facial consistente — nenhum ponto de atenção dominante" |

### Lógica do headline

```python
if no risks:
    headline = "Primeira impressão equilibrada. Oportunidades existem, mas nenhuma urgente."
    # ou se sinal positivo forte: "Primeira impressão sólida. {positive_signal}."
elif 1 risk:
    headline = "{positive_short}. Ponto a refinar: {risk_short}."
else:
    headline = "{positive_short}. Mais de um ponto — o principal: {risk_short}."
```

---

## 2. Scores de Status Visual (`visual_status.py`)

`build_visual_status(metrics) → dict`

### Campos retornados

| Campo | Tipo | Intervalo | Descrição |
|-------|------|-----------|-----------|
| `dominance_score` | float | 0–10 | Percepção de força/autoridade |
| `attractiveness_score` | float | 0–10 | Percepção de atratividade/harmonia |
| `freshness_score` | float | 0–10 | Percepção de cuidado/saúde/energia |
| `narrative` | str | — | Frase interpretativa combinando os 3 scores |

---

### Curva de score — gaussiana centrada no ideal (CORRIGIDO 2026-05-12)

Os três sub-scores usam `_bell(value, ideal, sigma) = exp(-((v−μ)/σ)²) × 10`.
Substitui rampas lineares monótonas anteriores, que saturavam em 10 mesmo
para valores irreais (e.g. `under_eye_darkness=0` ainda dava score 12.5 →
clamped 10, destruindo discriminação).

### Score de Dominância (0–10)

Baseado em: Lefevre 2012, Hammond 2018, Carré 2008

```python
fwhr_score = _bell(fwhr, ideal=1.85, sigma=0.25)            # pico em fwhr=1.85
jaw_score  = _bell(jawline_definition_score, ideal=1.0, sigma=0.35)
bzg_score  = _bell(bizygomatic_to_bigonial_ratio, ideal=1.30, sigma=0.18)

dominance_score = fwhr_score × 0.50 + jaw_score × 0.35 + bzg_score × 0.15
```

**Pesos**: fWHR (50%), jawline (35%), zigomático/bigonial (15%)

---

### Score de Atratividade (0–10)

Baseado em: Rhee 2012, Rhodes 2006

```python
tilt_score   = _bell(canthal_tilt_mean_deg, ideal=5.0, sigma=6.0)
sym_score    = _bell(overall_asymmetry_score_pct_ipd, ideal=0.0, sigma=3.0)
thirds_score = _bell(thirds_std_dev, ideal=0.0, sigma=0.04)

attractiveness_score = tilt_score × 0.45 + sym_score × 0.40 + thirds_score × 0.15
```

**Pesos**: canthal tilt (45%), simetria (40%), equilíbrio terços (15%)

---

### Score de Frescor (0–10)

Baseado em: Axelsson 2010 (Stockholm Sleep)

```python
skin_std_mean = (skin_uniformity_left + skin_uniformity_right) / 2
skin_score    = _bell(skin_std_mean, ideal=8.0, sigma=10.0)

eye_dark_mean = (under_eye_darkness_left + under_eye_darkness_right) / 2
dark_score    = _bell(eye_dark_mean, ideal=0.0, sigma=0.12)

ear_score     = _bell(eye_aspect_ratio_mean, ideal=0.30, sigma=0.08)

freshness_score = skin_score × 0.45 + dark_score × 0.35 + ear_score × 0.20
```

**Pesos**: uniformidade pele (45%), olheiras (35%), abertura ocular (20%)

---

### Narrativa interpretativa

Combina o score mais alto ("forte") e o mais baixo ("fraco") para gerar texto específico:

| Forte → Fraco | Narrativa |
|--------------|-----------|
| dominancia → frescor | "Presença e estrutura são seus pontos fortes. Recuperar a aparência de energia visual é o próximo passo..." |
| dominancia → atratividade | "Você transmite autoridade. Ajustar o ângulo do olhar e a simetria amplia ainda mais..." |
| atratividade → dominancia | "Você tem harmonia e equilíbrio visual. Aumentar a percepção de força facial é o passo que mais soma." |
| atratividade → frescor | "Harmonia facial forte. Aparência de descanso e cuidado com a pele é o que mais impacta agora." |
| frescor → dominancia | "Você transmite saúde e cuidado. Fortalecer a percepção de presença é a alavanca disponível." |
| frescor → atratividade | "Aparência saudável e descansada. Trabalhar simetria e proporções amplia o impacto." |

**Alerta de frescor crítico** (appended ao narrative se freshness_score < 4.0):
> "Olheiras e irregularidade de tom são os sinais que mais envelhecem a percepção visual — e os que melhor respondem a hábito simples."

---

## 3. Alavancagem (`top_leverage.py`)

### `get_top_leverage_recommendation(metrics, max_tier=1)`

Calcula `leverage_score = social_perception_weight × normalized_deviation` para cada métrica do `REC_CATALOG` dentro do `max_tier`, e retorna a de maior score.

```python
normalized_deviation = min(abs(value − ideal) / tolerance / 4.0, 1.0)
# 4× tolerance → desvio máximo normalizado (1.0)

confidence_score = clamp(0.65 × capture_confidence + 0.35 × leverage_score)
```

**Saída**:
```json
{
  "metric_key": "canthal_tilt_mean_deg",
  "short_action": "Consulta com oftalmoplástico",
  "why_it_matters": "aumenta a percepção de juventude e energia...",
  "time_to_result": "semanas",
  "tier": 1,
  "deviation_score": 0.423,
  "confidence_score": 0.701
}
```

### `get_top3_actions(metrics, max_tier=2)`

Garante 1 ação de cada tier (0, 1, 2) por maior `leverage_score` dentro de cada tier:
- Tier 0: hábito/postura (grátis, imediato)
- Tier 1: exercício / skincare (semanas/meses)
- Tier 2: profissional (meses)

### `social_perception_weight` por métrica

| Métrica | Peso SPW |
|---------|---------|
| `overall_asymmetry_score_pct_ipd` | 0.90 |
| `canthal_tilt_mean_deg` | 0.85 |
| `jawline_definition_score` | 0.80 |
| `fwhr` | 0.75 |
| `marquardt_deviation_pct_ipd` | 0.70 |
| `skin_spf_protocol` | 0.70 |
| `jaw_width_pct_ipd` | 0.65 |
| `nasal_to_mouth_width_ratio` | 0.65 |
| `bizygomatic_to_bigonial_ratio` | 0.65 |
| `intercanthal_to_eyewidth_ratio` | 0.60 |
| `thirds_std_dev` | 0.55 |
| `lower_third_ratio` | 0.50 |
| `fifths_std_dev` | 0.40 |
| `philtrum_length_pct_ipd` | 0.40 |
| `upper_lower_lip_ratio` | 0.45 |
| `mouth_to_ipd_ratio` | 0.45 |
| `face_shape_label` | 0.30 |
