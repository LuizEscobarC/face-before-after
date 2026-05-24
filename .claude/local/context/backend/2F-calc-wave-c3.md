---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-wave-c3"
file_path: ".claude/local/context/backend/2F-calc-wave-c3.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Calculadora de 10 métricas de refinamento avançado (wave C3) em `services/metrics/wave_c3.py`.
  Métricas de detalhe orbital, malar, curva ogee e antropométrico: `mentolabial_fold_proxy`
  (0.40 ICU), `brow_arch_peak_position_l/r` (0.50 index_0_1), `intersuperciliary_distance_ratio`
  (1.00), `buccal_fat_index` (0.45), `ogee_curve_proxy` (sem ideal calibrado),
  `infraorbital_hollow_index` (0.08 ICU), `forehead_slope_proxy` (sem ideal calibrado),
  `glabella_prominence_proxy` (0.50 ICU), `facial_index_anthropometric` (87.5 Martin index).
tags:
  - "backend"
  - "wave-c3"
  - "metrics"
rag_keywords:
  - "mentolabial_fold_proxy brow_arch_peak_position intersuperciliary_distance_ratio buccal_fat_index ogee_curve_proxy infraorbital_hollow_index forehead_slope_proxy glabella_prominence_proxy facial_index_anthropometric"
  - "wave_c3 Martin index mesoprosopic curva ogee infraorbital hollow"
  - "prega mentolabial glabela fronte índice facial antropométrico"
  - "index_0_1 intercanthal_units ratio degrees"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# Backend — Cálculo: Wave C3 (10 métricas)

> **Última atualização:** 2026-05-24

---

## mentolabial_fold_proxy

**Arquivo:** `backend/app/services/metrics/wave_c3.py:~55`

- **unit:** `intercanthal_units`
- **ideal:** `0.40`
- **max_dev:** `0.15`
- **directions:** `neutral` | `deep` | `shallow`
- **dep lm:** borda inferior do lábio inferior (~lm 17), ponto de mento-labial (~lm 18), pogonion (lm 152)

```
proxy = (y_mentolabial - y_lower_lip_base) / intercanthal_distance
```

Profundidade da prega mentolabial. Ideal 0.40 = prega bem definida. Valores > 0.55 = prega muito profunda (mentolabial fold pronunciada).

---

## brow_arch_peak_position_l

**Arquivo:** `backend/app/services/metrics/wave_c3.py:~80`

- **unit:** `index_0_1`
- **ideal:** `0.50`
- **max_dev:** `0.30`
- **directions:** `neutral` | `medial_peak` | `lateral_peak`
- **dep lm:** pontos do arco superciliar esq (lm 46–55)

Posição horizontal do pico da sobrancelha normalizada pelo comprimento total da sobrancelha (0=medial, 1=lateral). Diferença de `brow_arch_peak_l` em `brows.py`: aqui usa índice 0-1 em vez de ratio 0.67 com escala ICU.

---

## brow_arch_peak_position_r

**Arquivo:** `backend/app/services/metrics/wave_c3.py:~105`

- **unit:** `index_0_1`
- **ideal:** `0.50`
- **max_dev:** `0.30`
- **directions:** `neutral` | `medial_peak` | `lateral_peak`
- **dep lm:** pontos do arco superciliar dir (lm 276–285)

Espelho de `brow_arch_peak_position_l`.

---

## intersuperciliary_distance_ratio

**Arquivo:** `backend/app/services/metrics/wave_c3.py:~130`

- **unit:** `ratio`
- **ideal:** `1.00`
- **max_dev:** `0.20`
- **directions:** `neutral` | `wide` | `narrow`
- **dep lm:** cabeças mediais das sobrancelhas (~lm 55/285)

```
ratio = intersuperciliary_distance / intercanthal_distance
```

Análogo a `interbrow_distance_ratio` em brows.py — versão com escala de `ratio` em vez de ICU.

---

## buccal_fat_index

**Arquivo:** `backend/app/services/metrics/wave_c3.py:~155`

- **unit:** `index_0_1`
- **ideal:** `0.45`
- **max_dev:** `0.20`
- **directions:** `neutral` | `full` | `hollow`
- **dep lm:** região bucal (~lm 172/397), ponto submalar, largura facial

Proxy de volume da bola de Bichat. Estimado como a fullness relativa da bochecha entre o arco zigomático e o ângulo mandibular.

---

## ogee_curve_proxy

**Arquivo:** `backend/app/services/metrics/wave_c3.py:~180`

- **unit:** `index_0_1`
- **ideal:** — (não calibrado)
- **max_dev:** —
- **directions:** `neutral` | `defined` | `flat`
- **dep lm:** pontos ao longo do contorno lateral do rosto (lm 234 → 172 → 58)

> **Gap de calibração:** ideal ainda não estabelecido. Mede a presença da curva em S entre zigoma e mandíbula.

---

## infraorbital_hollow_index

**Arquivo:** `backend/app/services/metrics/wave_c3.py:~205`

- **unit:** `intercanthal_units`
- **ideal:** `0.08`
- **max_dev:** `0.07`
- **directions:** `neutral` | `hollow` | `full`
- **dep lm:** borda orbitária inferior (~lm 110/339), região malar inferior

```
index = infraorbital_depth / intercanthal_distance
```

Profundidade da região infraorbitária (olheiras/hollow tear trough). Ideal = levemente presente (0.08). Valores > 0.15 = hollow infraorbitário pronunciado.

---

## forehead_slope_proxy

**Arquivo:** `backend/app/services/metrics/wave_c3.py:~230`

- **unit:** `index_0_1`
- **ideal:** — (não calibrado)
- **max_dev:** —
- **directions:** `neutral` | `steep` | `reclined`
- **dep lm:** glabela (~lm 9), trichion (BiSeNet ou lm 10), perfil da testa

> **Gap de calibração:** ideal dependente de gênero e origem étnica. Calculado como ângulo entre o plano da testa e o plano vertical.

---

## glabella_prominence_proxy

**Arquivo:** `backend/app/services/metrics/wave_c3.py:~255`

- **unit:** `intercanthal_units`
- **ideal:** `0.50`
- **max_dev:** `0.20`
- **directions:** `neutral` | `prominent` | `flat`
- **dep lm:** glabela (lm 9), nasion (~lm 6), testa superior (~lm 10)

```
proxy = (x_glabella - x_nasion) / intercanthal_distance  # perfil sagital proxy
```

---

## facial_index_anthropometric

**Arquivo:** `backend/app/services/metrics/wave_c3.py:~280`

- **unit:** — (índice adimensional, escala Martin)
- **ideal:** `87.5` (mesoprosopic, índice de Martin)
- **max_dev:** `12.5`
- **directions:** `mesoprosopic` | `euryprosopic` | `leptoprosopic` | `hyperleptoprosopic`
- **dep lm:** altura morfológica facial (nasion → mento), largura bigoníaca (lm 58/288)

```
martin_index = (face_height / face_width) * 100
```

| Faixa | Classificação Martin |
|---|---|
| < 79.9 | `hypeuryprosopic` |
| 80–84.9 | `euryprosopic` |
| 85–89.9 | `mesoprosopic` (ideal) |
| 90–94.9 | `leptoprosopic` |
| ≥ 95 | `hyperleptoprosopic` |

Índice cefalométrico clássico — usado para contexto antropométrico no relatório.
