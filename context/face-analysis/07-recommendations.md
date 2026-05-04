# Recomendações, Trilha de Evolução e Glossário

---

## 1. Catálogo de Recomendações (`REC_CATALOG`)

### Campos por entrada do catálogo

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `label` | str | Nome legível da métrica |
| `ideal` | str | Valor ideal em linguagem humana |
| `what_is` | str | Explicação leiga do que é a métrica |
| `how_measured` | str | Explicação técnica de como é calculada |
| `why_matters` | str | Por que impacta a percepção social |
| `actions_by_severity` | dict | Ações por nível (leve/moderada/acentuada) |
| `references` | list | Fontes científicas e clínicas |
| `actionability_tier` | int | 0=grátis/imediato, 1=semanas/barato, 2=profissional |
| `time_to_result` | str | "imediato", "semanas", "meses" |
| `cost_level` | int | 0=grátis, 1=barato, 2=moderado, 3=caro |
| `mutable` | bool | Se a métrica pode mudar sem cirurgia |
| `social_perception_weight` | float | Peso de percepção social (0–1) |

### Tipos de ação

| Tipo | Tier inferido | Exemplos |
|------|---------------|---------|
| `habito` | 0 | mastigação bilateral, SPF diário, hidratação |
| `postura` | 0 | postura cefálica neutra, posição lingual |
| `exercicio` | 1 | retração cervical, Hammond facial protocol, mewing |
| `profissional` | 2 | dermato, fisio orofacial, bucomaxilo, cirurgia |

---

### Resumo do catálogo completo

| Métrica | Tier | SPW | Mutável |
|---------|------|-----|---------|
| `overall_asymmetry_score_pct_ipd` | 0 | 0.90 | Sim |
| `canthal_tilt_mean_deg` | 1 | 0.85 | Sim |
| `jawline_definition_score` | 1 | 0.80 | Sim |
| `fwhr` | 1 | 0.75 | Sim |
| `marquardt_deviation_pct_ipd` | 0 | 0.70 | Sim |
| `skin_spf_protocol` | 0 | 0.70 | Sim |
| `jaw_width_pct_ipd` | 1 | 0.65 | Sim |
| `nasal_to_mouth_width_ratio` | 0 | 0.65 | Não |
| `bizygomatic_to_bigonial_ratio` | 0 | — | — |
| `lower_third_ratio` | 1 | 0.50 | Sim |
| `intercanthal_to_eyewidth_ratio` | 0 | 0.60 | Não |
| `thirds_std_dev` | 0 | 0.55 | Sim |
| `fifths_std_dev` | 0 | 0.40 | Não |
| `mouth_to_ipd_ratio` | 0 | 0.45 | Sim |
| `upper_lower_lip_ratio` | 0 | 0.45 | Sim |
| `philtrum_length_pct_ipd` | 0 | 0.40 | Sim |
| `face_shape_label` | 0 | 0.30 | Não |

---

### Ações por métrica (resumo)

#### Assimetria global (overall_asymmetry_score_pct_ipd)

| Severidade | Ações |
|-----------|-------|
| Leve | Mastigação bilateral, postura neutra de cabeça |
| Moderada | Terapia mio-funcional orofacial, avaliação fisio orofacial |
| Acentuada | Bucomaxilo + ortodontista (cefalometria) |

#### fWHR

| Severidade | Ações |
|-----------|-------|
| Leve | Mastigar goma sem açúcar bilateralmente (hipertrofia masseter) |
| Moderada | Mewing (postura lingual), reduzir % gordura corporal |
| Acentuada | Consulta cirurgião plástico (preenchimento zigomático, bichectomia) |

#### Canthal tilt médio

| Severidade | Ações |
|-----------|-------|
| Leve | Sono adequado e hidratação (reduz edema periorbital) |
| Moderada | Consulta com oftalmoplástico (cantopexia, preenchimento de têmpora) |

#### Jawline definition

| Severidade | Ações |
|-----------|-------|
| Leve | Retração cervical (3×15 reps), reduzir BF% |
| Moderada | Hammond facial protocol (30 min/dia, 20 semanas), lipo/Kybella |

#### Lower third ratio

| Severidade | Ações |
|-----------|-------|
| Leve | Posição lingual alta (mewing) |
| Moderada | Ortodontia/ortognática consultiva |

#### Uniformidade pele / olheiras (skin_spf_protocol)

| Severidade | Ações |
|-----------|-------|
| Leve | SPF 30+ + hidratante noturno |
| Moderada | SPF 50+ + vitamina C tópica + niacinamida/retinol |
| Severa | Avaliação dermatológica (melasma, rosácea) |

---

## 2. Trilha de Evolução (`evolution_path.py`)

`build_evolution_path(metrics, catalog, capture_confidence) → dict`

### Fases

| Fase | Período | Tier | Confiança base |
|------|---------|------|----------------|
| Phase 1 | 0–7 dias | 0 (hábito/postura) | 0.88 |
| Phase 2 | 7–30 dias | 1 (exercício) | 0.72 |
| Phase 3 | 30–90 dias | 2 (profissional) | 0.58 |

### Cálculo de confiança por fase

```python
avg_rank = mean(severity_ranks)   # 1=leve, 2=moderada, 3=acentuada, 4=severa
severity_factor = max(0.45, 1.0 − (avg_rank − 1.0) × 0.15)
action_factor   = min(1.0, 0.60 + 0.15 × len(actions))

confidence = base_score × capture_confidence × severity_factor × action_factor
```

### Labels de confiança

| Score | Label |
|-------|-------|
| ≥ 0.75 | "muito provável" |
| ≥ 0.50 | "provável" |
| ≥ 0.30 | "possível" |
| < 0.30 | "desafiador" |

### Alerta de pele

Se `skin_uniformity_std_lab_mean > 20` OU `under_eye_darkness_mean > 0.15`, injeta ação SPF como primeira da Fase 1:
```json
{
  "titulo": "SPF 30+ diariamente + hidratante noturno",
  "descricao": "Aplicar SPF 30+ toda manhã; hidratante noturno antes de dormir.",
  "frequencia": "diário",
  "metric_label": "Protocolo SPF + hidratação"
}
```

### Métricas mutáveis

Apenas métricas com `mutable=True` no catálogo são incluídas na trilha. Filtra também métricas com severidade "excelente" (nada a fazer).

---

## 3. Geração do plano de ação (`recommendations.recommend`)

Ordena as recomendações por **severidade descendente**, depois por rótulo:

```python
out.sort(key=lambda r: (−SEV_RANK[r.severity], r.metric_label))

SEV_RANK = {
    "excelente": 0, "leve": 1, "moderada": 2,
    "acentuada": 3, "severa": 4,
}
```

Ações acumulativas por severidade:
- `excelente` → sem ações
- `leve` → ações["leve"]
- `moderada` → ações["leve"] + ações["moderada"]
- `acentuada` → ações["leve"] + ["moderada"] + ["acentuada"]
- `severa` → igual a acentuada

---

## 4. Glossário completo

| Termo | Unidade | Range típico | Fonte |
|-------|---------|-------------|-------|
| **IPD** | px / mm | 54–74 mm adulto | Dodgson 2004 |
| **fWHR** | adimensional | 1.7–2.0 masc. | Lefevre 2012 |
| **Canthal Tilt** | graus | +3° a +8° | Rhee 2012 |
| **Ângulo Gonial** | graus | 110–130° masc. | Naini 2011 |
| **Marquardt Deviation** | % IPD | < 1% excelente, > 8% severo | Marquardt |
| **ΔE Lab** | unidades CIE76 | < 2 imperceptível, > 10 visível | CIE |
| **Sharpness Laplaciana** | variância | < 100 borrado, > 500 nítido | Pech-Pacheco 2000 |
| **Pose solvePnP** | graus | frontal: \|yaw\|≤7°, \|pitch\|≤7° | OpenCV |
| **EAR** | adimensional | aberto: 0.25–0.35, fechado: <0.20 | Soukupová 2016 |
| **Terços/Quintos** | razão | std ≤ 0.03 ideal | Naini 2011 |
| **Face shape** | rótulo | oval, retangular, oblongo, etc. | Naini 2011 |

---

## 5. Referências científicas do domínio

| Fonte | Métricas relacionadas |
|-------|----------------------|
| Rhodes 2006 — Evolutionary Psych of Facial Beauty | Simetria, atratividade |
| Perrett 1999 — Symmetry and attractiveness | Simetria |
| Lefevre 2012 — fWHR e dominância | fWHR, dominância |
| Rhee 2012 — Lateral canthal tilt | Canthal tilt, atratividade |
| Farkas 1994 — Anthropometry of the Head and Face | Proporções neoclássicas |
| Naini 2011 — Facial Aesthetics | Terços, quintos, lower third, forma facial |
| Soukupová & Čech 2016 — Eye Blink Detection | EAR |
| Hammond et al. 2018 (JAMA Derm) — Facial exercise | Jawline definition |
| Axelsson 2010 — Stockholm Sleep Study | Frescor, olheiras, percepção cansaço |
| Marquardt — Phi Mask | Desvio bilateral global |
| AAD — American Academy of Dermatology | Skincare, SPF |
| SBD — Sociedade Brasileira de Dermatologia | Skincare, melasma |
| ISSN — Position Stand body comp | fWHR, jawline (BF%) |
| AAFPRS | Preenchimentos, cantopexia |
| SBCP — Cirurgia Plástica Brasil | Rinoplastia, bichectomia |
