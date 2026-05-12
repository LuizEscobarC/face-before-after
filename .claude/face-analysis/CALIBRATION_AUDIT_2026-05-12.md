# Calibration Audit — 2026-05-12

**Source face:** `/tmp/lms.json` (single-shot capture, 478 landmarks).
**Trigger:** user reported "todos os diagnósticos absurdos".

## A. Real index/formula bugs — FIXED

| Constant | Before | After | Reason |
|---|---|---|---|
| `P_LEFT_ZYGOMATIC` | jawline lateral idx | **234** | jawline list misaligned (FIXED earlier) |
| `P_RIGHT_ZYGOMATIC` | jawline lateral idx | **454** | mirror of 234 (FIXED earlier) |
| `P_UPPER_LIP_TOP` | 82 | **0** | old idx was at y≈479 (mid lip), 0 = cupid's bow (FIXED earlier) |
| `P_UPPER_LIP_BOT` | 312 | **13** | inner mouth-slit upper edge (FIXED earlier) |
| `P_LOWER_LIP_TOP` | (?) | **14** | inner mouth-slit lower edge (FIXED earlier) |
| `P_LOWER_LIP_BOT` | (?) | **17** | external lower lip border (FIXED earlier) |
| `P_NOSE_RIGHT` | **45** | **278** | **NEW FIX**: 45 was mid-bridge (x≈253), 278 is true mirror of 48 (x≈320) |

**Cascade after `P_NOSE_RIGHT 45→278`:**
- `phi_nose_to_lip`: 3.78 → **1.26** ✓
- `nose_to_mouth_width_ratio`: 0.265 → **0.79**
- `columella_show`: 0.35 → **0.26**

## B. Calibration mismatches — `metric_ideal` rows are anatomically off

For a typical European female face captured at MediaPipe FaceMesh-478, the
following ideals contradict published anthropometric norms (Farkas 1994,
Naini 2011, Powell & Humphreys 1984). These need DB recalibration, not code
changes.

| Metric | Measured | DB Ideal | Anatomic Norm | Action |
|---|---|---|---|---|
| `brow_height_l/r` | 0.73 / 0.76 ICU | 0.35 | 0.55–0.80 (Farkas: 18–25mm at ICD≈32mm) | recalibrate ideal=0.65, range 0.50–0.85 |
| `brow_tail_drop_l/r` | +0.17 | −0.05 | sign convention bug? (Farkas: tail rises 1–3mm) | recalibrate ideal=+0.05, range −0.05 to +0.15 |
| `columella_show` | 0.26 ICU | 0.05 | 0.10–0.20 (Naini: 2–4mm at 32mm ICD) | recalibrate ideal=0.15, range 0.05–0.25 |
| `mentolabial_fold_proxy` | 1.02 ICU | 0.40 | 1.0–1.4 (lower lip → menton ≈36mm) | recalibrate ideal=1.10, range 0.90–1.30 |
| `mandibular_corpus_length_ratio` | 0.585 | 0.25 | 0.50–0.65 | recalibrate ideal=0.55, range 0.45–0.65 |
| `forehead_height_ratio` | 0.97 | 1.90 | should match upper_third_ratio×3≈1.0 | recalibrate ideal=1.00, range 0.85–1.20 |
| `facial_index_anthropometric` | 127.4 | 87.5 | UNIT MISMATCH (face returns %, ideal in different unit) | code: divide by ICD; OR ideal=130 if code is right |
| `upper_third_ratio` | 0.178 | 0.333 | depends on hairline detection — likely formula bug if no hair |
| `masseteric_prominence_proxy` | 0.96 | 0.55 | needs anatomic verification | tentative ideal=0.85, range 0.70–1.00 |
| `mouth_midline_deviation` | 0.043 | 0.00 (max 0.03) | tighten range; 0.04 is mild asymmetry, not absurd | widen range to 0–0.06 |
| `nasal_tip_deviation` | 0.043 | 0.00 (max 0.03) | same — widen range to 0–0.06 |

## C. Real anatomic findings (not bugs)

These were correctly measured and **should** trigger triggers/templates:
- `global_asymmetry_index = 0.14` (mild–moderate asymmetry)
- `submalar_hollow_index = 0.29` (notable hollow)
- `infraorbital_hollow_index = 0.24` (visible tear-trough)
- `mandibular_plane_angle = 39.7°` (slightly steep)

## D. Display contract bug

`deviation_normalized` is currently a σ-multiple but rendered as `%` in the
report → -7.59σ shows as `-759%`. Either:
1. Cap rendering at ±100% with badge "±Nσ" suffix; OR
2. Change unit label in `RecommendationEngine` output.

## E. Pending — template gap audit

Per user "Gere templates explicativos para tudo oq tem no banco":
- 37 metrics still have **no** diagnostic_template
- 56 metrics have only `low/normal/high` but no `extreme` severity
- Total ~1300 templates needed for full coverage

---

## D. Display-panel audit — FIXED (2026-05-12, session 2)

Auditoria das 17 métricas do painel `PremiumResultPage` ("Percepção Visual" +
"Assimetria Regional" + "Perfil Facial Detalhado") encontrou 4 bugs estruturais
que saturavam Dominância/Vitalidade em 10.0 e inflavam o "Desvio Máscara Áurea"
para 120% IPD. Todos corrigidos em [face_metrics.py](../../backend/app/domain/face_metrics.py) e [visual_status.py](../../backend/app/domain/layers/visual_status.py).

### D1. `jawline_definition_score` — unidade errada
- **Antes:** retornava `std(angles)` em graus, capped em 30. Downstream
  (`visual_status.compute_dominance_score`, glossary, `face_metrics ideals`)
  tratavam como `[0,1]` "maior=melhor" → saturação artificial.
- **Depois:** `1 − clip(std/15°, 0, 1)` → `[0,1]`, maior=mais definida.
  Ideal=0.65 no banco continua coerente.

### D2. `marquardt_deviation_pct_ipd` — label engano + sem pose-gate
- **Antes:** label "Desvio Máscara Áurea" sugeria comparação contra máscara
  de Marquardt, mas o cálculo é simetria bilateral própria (mirror sobre
  midline x). Sem correção de pose → roll de 6° inflava o RMS para >100% IPD.
- **Depois:** pose-gate (retorna `None` se `|roll_olhos| > 5°`); frontend
  rotula como "Assimetria Bilateral". Chave persistida mantida para compat.

### D3. `fwhr` — fórmula desviada do canônico
- **Antes:** `bizygomatic / (glabella → upper_lip)`. Glabela é o ponto entre
  as sobrancelhas — numerador subestimado → fWHR inflado e ideal=1.85 calibrado
  contra fórmula errada.
- **Depois:** canônico Carré & McCormick 2008 — `bizygomatic / (brow_top →
  upper_lip)` onde `brow_top = min(y)` sobre `LM_LEFT_BROW ∪ LM_RIGHT_BROW`.
  Ideal=1.85 agora está bem calibrado.

### D4. Scores de percepção lineares → gaussianas centradas no ideal
- **Antes:** rampas lineares monotônicas (`(value − μ_min) / range * 10`) em
  `dominance/attractiveness/freshness`. Valores irreais (e.g.
  `under_eye_darkness=0`, `fwhr=2.5`) ainda pontuavam 10 após clamp,
  achatando a discriminação entre rostos.
- **Depois:** helper `_bell(value, ideal, sigma)` = `exp(-((v−μ)/σ)²) * 10`.
  Ideais e σ documentados em cada função. Valores fora da plausibilidade
  decaem em vez de saturar.

### Validação
- `tests/test_visual_status.py`: 14/14 ✓
- `tests/test_face_metrics.py`: 5/5 ✓
- Suite Python completa: 74 passed, 46 skipped ✓
- Frontend `tsc --noEmit`: clean ✓
