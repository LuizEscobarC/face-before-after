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
