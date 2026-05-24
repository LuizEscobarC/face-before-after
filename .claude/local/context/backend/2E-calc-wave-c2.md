---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-wave-c2"
file_path: ".claude/local/context/backend/2E-calc-wave-c2.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 10 métricas de refinamento (wave C2) em `services/metrics/wave_c2.py`.
  Métricas de detalhe perioral, nasal e mandibular: `nasolabial_angle_proxy` (ideal não
  calibrado), `alar_flare_index` (1.00 ICU), `cupids_bow_definition` (0.05),
  `lip_volume_ratio` (0.625), `oral_commissure_height_asym` (0.0 ICU),
  `philtrum_width_ratio` (0.30), `smile_line_curvature` (0.08),
  `chin_projection_proxy` (0.33), `mandibular_corpus_length_ratio` (0.25),
  `masseteric_prominence_proxy` (0.55).
tags:
  - "backend"
  - "wave-c2"
  - "metrics"
rag_keywords:
  - "nasolabial_angle_proxy alar_flare_index cupids_bow_definition lip_volume_ratio oral_commissure_height_asym philtrum_width_ratio smile_line_curvature chin_projection_proxy mandibular_corpus_length_ratio masseteric_prominence_proxy"
  - "wave_c2 métricas refinamento perioral nasal mandibular"
  - "filtro cupido arco do cupido flare alar ângulo nasolabial curvatura sorriso"
  - "projeção mento masseter comprimento corpus mandibular"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Wave C2 (10 métricas)

> **Última atualização:** 2026-05-24

---

## nasolabial_angle_proxy

**Arquivo:** `backend/app/services/metrics/wave_c2.py:~146` — `region="nose"`, `family="nose"`

- **unit:** `degrees`
- **ideal:** — (stub permanente)
- **directions:** `"not_computed"` (sempre)
- **requires_pixel_analysis:** `True`

**STUB — não computado.** O ângulo nasolabial clínico é sagital (vista lateral). Em foto frontal Mesh-478 os vetores alar→subnasale→lábio são quase colineares → degenera em 2D. Retorna sempre `value=0.0, confidence_raw=0.0, confidence_final=0.0, is_low_confidence=True`. Implementação futura requer vista lateral ou sensor de profundidade.

```python
# Código real (wave_c2.py:154):
return MetricValue(value=0.0, error=0.0,
                   confidence_raw=0.0, confidence_final=0.0,
                   direction="not_computed", dependency_landmarks=())
```

---

## alar_flare_index

**Arquivo:** `backend/app/services/metrics/wave_c2.py:~80`

- **unit:** `intercanthal_units`
- **ideal:** `1.00`
- **max_dev:** `0.30`
- **directions:** `neutral` | `flared` | `pinched`
- **dep lm:** base alar lateral (~lm 129/358) vs base alar medial/sill

```
index = alar_outer_width / intercanthal_distance
```

---

## cupids_bow_definition

**Arquivo:** `backend/app/services/metrics/wave_c2.py:~105`

- **unit:** `index_0_1`
- **ideal:** `0.05`
- **max_dev:** `0.10`
- **directions:** `neutral` | `defined` | `flat`
- **dep lm:** tubérculos do arco do cupido (~lm 0, 267, 37), columela base

Profundidade do filtro em relação à altura do lábio superior. Valores maiores = arco mais marcado.

---

## lip_volume_ratio

**Arquivo:** `backend/app/services/metrics/wave_c2.py:~130`

- **unit:** `ratio`
- **ideal:** `0.625`
- **max_dev:** `0.25`
- **directions:** `neutral` | `upper_dominant` | `lower_dominant`
- **dep lm:** alturas do vermilhão superior e inferior (lm 0/13/14/17)

```
ratio = upper_vermilion_height / (upper + lower)  # ideal ~0.40 → invertido aqui
```

Nota: `0.625` expressa a relação lábio inferior / total (lábio inf levemente maior = ideal).

---

## oral_commissure_height_asym

**Arquivo:** `backend/app/services/metrics/wave_c2.py:~155`

- **unit:** `intercanthal_units`
- **ideal:** `0.0`
- **max_dev:** `0.07`
- **directions:** `neutral` | `left_higher` | `right_higher`
- **dep lm:** lm 61 (comissura esq), lm 291 (comissura dir)

Similar a `lip_corner_canting` em mouth.py, mas escala max_dev mais estrita (0.07 vs 0.15) — usada para análise de sorriso de alta resolução.

---

## philtrum_width_ratio

**Arquivo:** `backend/app/services/metrics/wave_c2.py:~180`

- **unit:** `ratio`
- **ideal:** `0.30`
- **max_dev:** `0.15`
- **directions:** `neutral` | `wide` | `narrow`
- **dep lm:** bordas do filtro (~lm 267/37), largura da boca (lm 61/291)

```
ratio = philtrum_width / mouth_width
```

---

## smile_line_curvature

**Arquivo:** `backend/app/services/metrics/wave_c2.py:~205`

- **unit:** `ratio`
- **ideal:** `0.08`
- **max_dev:** `0.10`
- **directions:** `neutral` | `curved_up` | `curved_down` | `flat`
- **dep lm:** comissuras (lm 61/291), ponto central da borda inferior do lábio superior (~lm 13)

Curvatura do arco do sorriso: flecha do arco entre as comissuras normalizada pela largura da boca.

---

## chin_projection_proxy

**Arquivo:** `backend/app/services/metrics/wave_c2.py:~230`

- **unit:** `ratio`
- **ideal:** `0.33`
- **max_dev:** `0.07`
- **directions:** `neutral` | `projected` | `recessed`
- **dep lm:** pogonion (lm 152), subnasale (lm 2), glabela (~lm 9)

```
proxy = chin_x_offset / face_depth_estimate
```

Proxy de projeção sagital do mento usando landmarks frontais. Sensível a pose — `confidence_final` decresce com pitch.

---

## mandibular_corpus_length_ratio

**Arquivo:** `backend/app/services/metrics/wave_c2.py:~255`

- **unit:** `ratio`
- **ideal:** `0.25`
- **max_dev:** `0.10`
- **directions:** `neutral` | `long` | `short`
- **dep lm:** `P_LEFT_GONION=58`, mento (lm 152), largura facial

```
ratio = corpus_length / face_width
```

---

## masseteric_prominence_proxy

**Arquivo:** `backend/app/services/metrics/wave_c2.py:~280`

- **unit:** `ratio`
- **ideal:** `0.55`
- **max_dev:** `0.15`
- **directions:** `neutral` | `prominent` | `flat`
- **dep lm:** região massetérica (~lm 172/397 lateral), largura zigomática

Proxy do volume massetérico estimado pela projeção lateral da mandíbula abaixo do arco zigomático.
