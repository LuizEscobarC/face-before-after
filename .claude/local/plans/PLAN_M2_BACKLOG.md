# PLAN_M2_BACKLOG.md

> Backlog detalhado do **Marco 2 — calibração + expansão de métricas + scoring rico**.
> Releia junto com `PLAN_METRICS.md` no início de cada sessão.
> Atualização: 2026-05-08 (após PR-12).

---

## 0. Contexto

PR-12 fechou a **primeira fatia do M2**: scoring regional + global + banding + 2 famílias com pesos ativos (symmetry com 14 métricas + eyes com 6). O endpoint `POST /v1/analysis/evaluate` já devolve `regional_scores[]` + `global_score` corretamente, com gating crítico e DEC-6 honrado em três camadas.

A partir daqui, M2 tem três frentes paralelas, sequenciadas em PRs:

1. **Famílias adicionais de métricas** (PRs 13–19) — leva o catálogo de 21 → 60+ `metric_id`.
2. **Expansão dos pesos + ideais** (a cada PR de família, +1 migration que estende `region_metric_weight`/`metric_definition`/`metric_ideal`).
3. **Calibração com fotos reais** (PR-22+) — exige UI mínima de captura + planilha de operador. Adiada até termos massa crítica de métricas.

> **Cuidado MUITO importante (do prompt do usuário):**
> *"M2 é calibração dos ideais. Definir faixas verde/amarelo de cada métrica envolve julgamento sobre fontes (literatura aberta vs sintético vs canônico), inconsistências entre referências, casos onde o ideal varia por sexo/idade. Opus pesa critérios melhor."*
>
> Toda PR de família carrega uma **mini-justificativa de ideal** no body do PR (ou no commit message): qual fonte, quando há divergência o que prevaleceu, e por que `presentation_only=true` (se for o caso). Isso vira input para o `population_reference_note` em `metric_ideal`.

---

## 1. Backlog de PRs do M2 (versão atual)

| PR | Escopo | Famílias / Métricas | Tabelas tocadas | Modelo recomendado |
|----|--------|---------------------|-----------------|--------------------|
| **PR-13** ✅ | Família **jaw** (mandíbula) — **DONE** | `jaw_width_ratio`, `gonial_angle_l/r`, `gonial_angle_asymmetry`, `mandibular_plane_angle`, `chin_height_ratio` (6) | `metric_definition`, `metric_ideal`, `region_metric_weight (region=jaw)` | **Sonnet** com contexto |
| **PR-14** ✅ | Família **nose** — **DONE** | `nose_length_to_icd`, `nose_width_to_icd`, `alar_to_face_width_ratio`, `nose_to_mouth_width_ratio`, `dorsum_deviation`, `nasal_tip_deviation`, `alar_base_asymmetry` (7) | idem (region=nose) | **Sonnet** |
| **PR-15** ✅ | Família **mouth/lips** — **DONE** | `mouth_width_to_icd`, `mouth_to_face_width_ratio`, `upper_lip_height_ratio`, `lower_lip_height_ratio`, `vermilion_height_total`, `lip_corner_canting`, `mouth_midline_deviation` (7) | idem (region=mouth) | **Sonnet** |
| **PR-16** ✅ | Família **brows** — **DONE** | `brow_height_l/r`, `brow_arch_peak_l/r`, `brow_thickness_l/r` *(presentation_only)*, `brow_tail_drop_l`, `interbrow_distance_ratio` (8 — 2 presentation_only). `brow_tail_drop_r` adiada para PR-21. | idem + flag `presentation_only` | **Sonnet** |
| **PR-17** | Família **cheekbones / midface** | `zygomatic_width_ratio`, `malar_projection_index`, `midface_height_ratio`, `cheekbone_to_jaw_ratio`, `submalar_hollow_index` (5) | idem | **Sonnet** |
| **PR-18** | Família **forehead** | `forehead_height_ratio`, `forehead_width_ratio`, `temporal_width_ratio`, `hairline_curvature_index` *(M frontal pixel-dep)* (4 — 1 `requires_pixel_analysis=true`) | idem + DEC-10 (skip pipeline) | **Sonnet** |
| **PR-19** | Família **global_shape** | `face_height_to_width_ratio`, `face_shape_classification` *(categórica: oval/round/square/heart/oblong)*, `total_facial_convexity`, `e_line_deviation` (4) | idem (region=global) | **Sonnet** |
| **PR-20** | Família **phi/golden** *(presentation_only HARD)* | `phi_face_height_to_width`, `phi_lower_face_segments`, `phi_eye_to_mouth`, `phi_nose_to_lip` (4 — todas `presentation_only=true`) | `metric_definition` (sem `metric_ideal`, sem peso) | **Sonnet** |
| **PR-21** | **Recalibração ampla** dos `region_metric_weight` quando todas as famílias estiverem dentro | rebalanceia pesos das 6 regiões (atualmente symmetry=14, eyes=6 dominam o score) | nova `region_metric_weights_version v2.0` + `global_weights_version v2.0` (DEC-12: snapshot, mantém v1.0 ativa em histórico) | **Opus** (julgamento de balanceamento) |
| **PR-22** | **Calibração com fotos reais** | coleta de 30–50 fotos (operador interno), planilha de override de `green_range_min/max` por métrica, `ideals_version v2.0` ativada | `ideals_version`, `metric_ideal` (rows nova versão), `metric_evaluation` re-rodada para auditoria | **Opus** (julgamento de fontes) |
| **PR-23** | **Consistência longitudinal** (multi-foto) | `landmark_payload.capture_count > 1`, `landmark_stability_scores`, ajuste de `confidence_propagation` | `landmark_payload` (já tem coluna), pipeline Python | **Sonnet** |

**Total esperado de métricas após PR-20**: 21 (M1) + 6+7+7+8+5+4+4+4 = **66 métricas** (≅ alvo de "60+").

---

## 2. Convenção dura para PR de família (PRs 13–19)

Todo PR dessa série **DEVE entregar exatamente esses 7 artefatos**, na mesma ordem:

1. **Calculator(s) Python** em `backend/app/services/metrics/<family>.py` com `@register_metric` por `metric_id`.
2. **Fixtures** em `backend/app/tests/fixtures/<family>_*.py` cobrindo: `perfect_<family>_face`, `asymmetric_<family>_face` (quando aplicável), `extreme_<family>_face`.
3. **Unit tests** Python em `backend/tests/unit/metrics/test_<family>.py` cobrindo:
   - Valor exato em fixture canônica (ideal value).
   - Comportamento em fixture com desvio conhecido.
   - Propagação de `confidence_final` quando pose/região penalizada.
   - Edge case: landmarks faltando ou colineares → `value=null` + `confidence_final=0`.
4. **Migration TypeORM `0006+N_SeedFamily<Name>.ts`** que insere:
   - N rows em `metric_definition` (com `region`, `family`, `unit`, `presentation_only`, `requires_pixel_analysis`, `dependency_landmarks`, `display_name` JSONB, `population_reference_note`).
   - N rows em `metric_ideal` (exceto métricas `presentation_only=true`).
   - M rows em `region_metric_weight` (versão ativa atual `v1.0` recebe linhas adicionais via `INSERT ... ON CONFLICT DO NOTHING` — **não cria nova versão**; isso só acontece em PR-21).
5. **Atualização do `metric_ideals.yaml`** (espelho declarativo do que está no DB, fonte de verdade para CI).
6. **Atualização do `region_metric_weights.yaml`** para a região da família (mesma justificativa: fonte de verdade declarativa, CI valida contra DB).
7. **Atualização da seção 5.4 do `PLAN_METRICS.md`** marcando a família como entregue.

> **Fora do escopo dos PRs 13–19** (NÃO mexer):
> - `RegionalScorer` / `GlobalScorer` / `ScoreBander` — já consomem qualquer região via lookup dinâmico.
> - DTO `EvaluateResponseDto` — já é genérico em `regional_scores[]`.
> - Orchestrator — já agrupa por `region` dinamicamente.

Se algo dessa lista parecer precisar de mudança em PR de família, é sinal de que o PR-12 deixou um buraco — abrir bug em vez de patchar a família.

---

## 3. Mini-protocolo de calibração de ideal (para cada métrica nova)

**Formato fixo no body do PR ou no `population_reference_note`:**

```
metric_id: jaw_width_ratio
ideal_central_value: 1.30
green_range: [1.25, 1.35]
yellow_range: [1.20, 1.40]
fonte_primaria: "Farkas (1994), tabela 4.7 — adultos caucasianos 18-30"
fontes_consultadas:
  - Farkas, Anthropometric Facial Proportions in Medicine (1994)
  - Naini, Facial Aesthetics (2011), §3.2
divergencias: |
  Naini sugere 1.32 ± 0.04. Adotado 1.30 (Farkas) por amostra maior.
  Não há diferença estatisticamente significativa por sexo na faixa 18-40.
varia_por_sexo: false
varia_por_idade: false  # ajustar para true em métricas de envelhecimento (jaw, midface)
varia_por_etnia: true   # nota: ideal v1.0 calibrado para população mista BR; expansão pós-M2.
presentation_only: false
requires_pixel_analysis: false
```

Esse formato vira o `population_reference_note` (TEXT em `metric_ideal`).

---

## 4. Critérios para promover `region_metric_weights_version` v1.0 → v2.0 (PR-21)

Não é feito até **todas as 6 regiões** terem ≥4 métricas e o operador ter rodado **PR-22 (calibração com fotos reais)**. Antes disso, o score global é dominado por symmetry+eyes (que têm 14+6 métricas vs ≤7 das demais). Isso é **intencional**: o gating DEC-8 protege contra exibir score injusto.

Critérios (todos obrigatórios):
- [ ] PRs 13–20 mergeados (catálogo com ≥60 métricas).
- [ ] Calibração com ≥30 fotos reais rodada em ambiente de staging.
- [ ] Operador validou que distribuição de scores em 30 fotos cobre as 4 bandas (não tudo `no_number` nem tudo `high`).
- [ ] Nova `global_weights_version v2.0` discutida com o produto: pesos por região explicitamente justificados.

**Defesa:** v1.0 nunca é desativada — mantida ativa para histórico via `is_active=TRUE`. v2.0 entra com `is_active=TRUE` e `idempotent migration` que faz `UPDATE ... is_active=FALSE WHERE version='v1.0'` apenas quando v2.0 começa a ser usada em `analysis_report`.

---

## 5. Sinais de que o M2 está "pronto" para fechar

- Catálogo de métricas estável (≥60).
- 100% das regiões críticas (`symmetry`, `eyes`, mais 2 a definir em PR-21) têm ≥3 métricas com `confidence_final` razoável em fotos de operador.
- Banding produz distribuição razoável em ≥30 fotos reais.
- `presentation_only` testado: phi/golden NUNCA aparece em `regional_score.contributing_metric_ids`.
- DEC-8 testado: foto com péssima iluminação → `global_score.is_displayable=FALSE`, banner `no_number`.
- Pytest verde, Vitest verde, migration log limpo.

Após isso → **abrir M3** (overlays). Ver `PLAN_M3_OVERLAYS.md`.

---

## 6. Histórico de execução

### PR-13 — jaw family (DONE)

**Data**: 2026-05-08. **Modelo**: Sonnet com contexto.

**Métricas entregues (6)**: `jaw_width_ratio`, `gonial_angle_l`, `gonial_angle_r`, `gonial_angle_asymmetry`, `mandibular_plane_angle`, `chin_height_ratio`.

**Desvio do plano original**: substituiu `chin_projection_index` (depende de perfil lateral, não disponível em foto frontal) e `lower_face_height_ratio` (já coberto indiretamente por `lower_third_ratio` da família thirds) por `mandibular_plane_angle` e `chin_height_ratio` — métricas mais fortes e independentes para frontal photo single-shot.

**Calibração**:
- `jaw_width_ratio = 0.80 (±0.05 verde)` — Farkas (1994) bigonial:bizygomatic, unified-sex BR.
- `gonial_angle = 125° (±5° verde)` — Tweed/Steiner cephalometric range. **Ressalva**: gonion no Mesh-478 é landmark aproximado; `JAW_POSE_PARAMS` aplica penalidade extra por yaw (`yaw_soft=4°`, `yaw_hard=12°`).
- `gonial_angle_asymmetry = 0° (±3° verde)` — derivada.
- `mandibular_plane_angle = 27° (±5° verde)` — Steiner. Cálculo 2D usa **média per-side** (não midpoint→menton, que é degenerado em faces simétricas).
- `chin_height_ratio = 0.50 (±0.05 verde)` — Farkas, lower-third subdivision.

**Pesos (region_metric_weight v1.0)**: jaw_width_ratio=1.5, gonial_angle_asymmetry=1.2, demais=1.0.

**Versão**: estendeu `region_metric_weights_version v1.0` (não bumpou, conforme regra deste plano). Bump fica para PR-21.

**Artefatos**:
- backend/app/services/metrics/jaw.py (~280 linhas, 6 calculators).
- backend/tests/fixtures/synthetic_landmarks.py (`perfect_jaw_face`, `asymmetric_jaw_face`).
- backend/tests/unit/test_jaw.py (53 tests, todos passing).
- backend/app/services/metrics/confidence_propagation.py (`JAW_POSE_PARAMS`).
- nest/src/database/migrations/1746000060000-SeedJawFamily.ts.
- nest/src/config/yaml/metric_ideals.yaml (+jaw section).
- nest/src/config/yaml/region_metric_weights.yaml (+jaw region).

**Validações**: pytest 479 passed (53 novos), vitest 116 passed, migration aplicada. DB: 27 metric_definitions, 26 metric_ideals, region_metric_weight (jaw=6, eyes=6, symmetry=14).

**Próximo PR**: PR-15 (mouth family).

### PR-14 — nose family (DONE)

**Data**: 2026-05-08. **Modelo**: Sonnet com contexto.

**Métricas entregues (7)**: `nose_length_to_icd`, `nose_width_to_icd`, `alar_to_face_width_ratio`, `nose_to_mouth_width_ratio`, `dorsum_deviation`, `nasal_tip_deviation`, `alar_base_asymmetry`.

**Desvio do plano original** (frontal-only constraint): substituiu:
- `nasal_tip_projection` (requer perfil sagital, indisponível em foto frontal) → `nasal_tip_deviation` (assimetria frontal: |tip.x - midline.x|).
- `nasolabial_angle` (requer perfil sagital) → `alar_base_asymmetry` (assimetria frontal vertical das asas nasais).
- `nose_width_ratio` desdobrado em 3 métricas com denominadores distintos: `nose_width_to_icd` (rule of fifths), `alar_to_face_width_ratio` (vs bizygomatic), `nose_to_mouth_width_ratio` (Naini).

`nasal_tip_projection` e `nasolabial_angle` movidos para PR-23 (multi-foto, quando o usuário enviar perfil lateral).

**Calibração**:
- `nose_length_to_icd = 1.50 (±0.15 verde)` — Farkas (1994) ~50mm:32mm = 1.56; Naini (2011) 1.45-1.65.
- `nose_width_to_icd = 1.00 (±0.10 verde)` — Rule of fifths.
- `alar_to_face_width_ratio = 0.20 (±0.03 verde)` — Rule of fifths (1/5 do bizygomatic).
- `nose_to_mouth_width_ratio = 0.65 (±0.08 verde)` — Naini (2011).
- `dorsum_deviation = 0 (±0.03 ICU verde)` — canonical.
- `nasal_tip_deviation = 0 (±0.03 ICU verde)` — canonical.
- `alar_base_asymmetry = 0 (±0.03 ICU verde)` — canonical.

**Pesos (region_metric_weight v1.0)**: dorsum_deviation=1.3, nasal_tip_deviation=1.3, nose_width_to_icd=1.2, alar_base_asymmetry=1.2, demais=1.0. Pesos elevados para deviations — assimetria nasal carrega forte sinal perceptual.

**Versão**: estendeu `region_metric_weights_version v1.0` (não bumpou).

**Artefatos**:
- backend/app/services/metrics/nose.py (~290 linhas, 7 calculators).
- backend/tests/fixtures/synthetic_landmarks.py (`perfect_nose_face`, `deviated_nose_face`).
- backend/tests/unit/test_nose.py (63 tests, todos passing).
- backend/app/services/metrics/confidence_propagation.py (`NOSE_POSE_PARAMS`: yaw_soft=5°, hard=15°, weight=0.7, floor=0.18).
- nest/src/database/migrations/1746000070000-SeedNoseFamily.ts.
- nest/src/config/yaml/metric_ideals.yaml (+nose section).
- nest/src/config/yaml/region_metric_weights.yaml (+nose region).

**Validações**: pytest 542 passed (+63 nose), vitest 116 passed, migration aplicada. DB: 34 metric_definitions, 33 metric_ideals, region_metric_weight (jaw=6, eyes=6, symmetry=14, nose=7).

**Próximo PR**: PR-16 (brows family).

### PR-15 — mouth/lips family (DONE)

**Data**: 2026-05-08. **Modelo**: Sonnet com contexto.

**Métricas entregues (7)**: `mouth_width_to_icd`, `mouth_to_face_width_ratio`, `upper_lip_height_ratio`, `lower_lip_height_ratio`, `vermilion_height_total`, `lip_corner_canting`, `mouth_midline_deviation`.

**Desvio do plano original** (frontal-only + Mesh-478 landmark availability):
- `mouth_width_ratio` desdobrado em `mouth_width_to_icd` (Naini ~1.5×ICD) + `mouth_to_face_width_ratio` (Naini ~0.30×bizygomatic). Mesmo padrão de PR-14 (mesmo numerador, denominadores diferentes).
- `lip_height_ratio_upper` / `_lower` renomeados para `upper_lip_height_ratio` / `lower_lip_height_ratio` (consistência com nomenclatura PR-14).
- `cupids_bow_definition` (requer picos do cupid's bow, instáveis em Mesh-478) → `mouth_midline_deviation` (assimetria frontal: |centro da boca − linha média|).
- `philtrum_width_ratio` (requer landmarks de pilares filtrais não disponíveis em Mesh-478 estável) → **DEFERIDO para PR-23** (multi-foto / detector refinado).

**Calibração**:
- `mouth_width_to_icd = 1.50 (±0.15 verde)` — Naini (2011).
- `mouth_to_face_width_ratio = 0.30 (±0.04 verde)` — Naini.
- `upper_lip_height_ratio = 0.40 (±0.05 verde)` — Naini U:L = 1:1.6 → 0.385; arredondado.
- `lower_lip_height_ratio = 0.60 (±0.05 verde)` — complemento.
- `vermilion_height_total = 0.55 (±0.10 verde) ICU` — Naini ~17 mm em ICD ~32 mm = 0.53; adotado 0.55.
- `lip_corner_canting = 0 (±0.03 ICU verde)` — canonical.
- `mouth_midline_deviation = 0 (±0.03 ICU verde)` — canonical.

**Pesos (region_metric_weight v1.0)**: lip_corner_canting=1.3, mouth_midline_deviation=1.2, vermilion_height_total=1.1, demais=1.0. Pesos elevados em assimetrias (DEC-8).

**Pose params (`MOUTH_POSE_PARAMS`)**: yaw_soft=6°, hard=16°, pitch_soft=8°, hard=20°, yaw_weight=0.6, pitch_weight=0.4, floor=0.18. Mais relaxado que nose — landmarks de boca em Mesh-478 são bem definidos e centrais.

**Versão**: estendeu `region_metric_weights_version v1.0` (não bumpou).

**Artefatos**:
- backend/app/services/metrics/mouth.py (~340 linhas, 7 calculators).
- backend/tests/fixtures/synthetic_landmarks.py (`perfect_mouth_face`, `deviated_mouth_face`).
- backend/tests/unit/test_mouth.py (64 tests, todos passing).
- backend/app/services/metrics/confidence_propagation.py (`MOUTH_POSE_PARAMS`).
- nest/src/database/migrations/1746000080000-SeedMouthFamily.ts.
- nest/src/config/yaml/metric_ideals.yaml (+mouth section).
- nest/src/config/yaml/region_metric_weights.yaml (+mouth region).

**Validações**: pytest 606 passed (+64 mouth), vitest 116 passed, migration aplicada. DB: 41 metric_definitions, 40 metric_ideals, region_metric_weight (jaw=6, eyes=6, symmetry=14, nose=7, mouth=7).

**Próximo PR**: ~~PR-16~~ **DONE** (ver abaixo).

### PR-16 — brows family (DONE)

**Data**: 2026-05-08. **Modelo**: Sonnet 4.6 com contexto.

**Métricas entregues (8)**: `brow_height_l`, `brow_height_r`, `brow_arch_peak_l`, `brow_arch_peak_r`, `brow_thickness_l` *(presentation_only)*, `brow_thickness_r` *(presentation_only)*, `brow_tail_drop_l`, `interbrow_distance_ratio`.

**Desvio do plano original**:
- `brow_arch_peak_x_l/r` → `brow_arch_peak_l/r` (nome simplificado; _x implícito na fração).
- `brow_tail_drop_r` → **DEFERIDA para PR-21** (conta de 8 métricas mantida; `interbrow_distance_ratio` incluída conforme plano original).
- `brow_thickness_l/r` marcadas `presentation_only=True` por DEC-10 (Mesh-478 não expõe bordas superior/inferior da sobrancelha de forma estável — proxy via span vertical).

**Calibração** (Farkas 1994 + Naini 2011 + Romo 2006):
- `brow_height_l/r = 0.35 ICU (±0.10 verde)` — Farkas: ~11 mm em ICD ~32 mm → 0.34.
- `brow_arch_peak_l/r = 0.67 (±0.10 verde)` — Romo/Farkas: ápice em 2/3 do arco (acima do limbo lateral).
- `brow_thickness_l/r = 0.20 ICU (±0.07 verde)` — proxy (presentation_only).
- `brow_tail_drop_l = -0.05 ICU (±0.08 verde)` — Naini: cauda levemente elevada (negativo = exterior acima do interior).
- `interbrow_distance_ratio = 1.0 ICU (±0.15 verde)` — Farkas: espaço = 1 ICD.

**Pesos (region_metric_weight v1.0, region=brows, 6 linhas — brow_thickness excluída por DEC-6)**:
- brow_tail_drop_l=1.2, interbrow_distance_ratio=1.1, demais=1.0.

**Pose params (`BROW_POSE_PARAMS`)**: yaw_soft=5°, hard=15°, pitch_soft=8°, hard=20°, yaw_weight=0.65, pitch_weight=0.35, floor=0.17.

**Versão**: estendeu `region_metric_weights_version v1.0` (não bumpou — DEC-12).

**Artefatos**:
- `backend/app/services/metrics/brows.py` (8 calculators, ~320 linhas).
- `backend/tests/fixtures/synthetic_landmarks.py` (`perfect_brow_face`, `drooping_brow_face`).
- `backend/tests/unit/test_brows.py` (108 tests, todos passing).
- `backend/app/services/metrics/confidence_propagation.py` (`BROW_POSE_PARAMS`).
- `backend/app/services/metrics/__init__.py` (import `brows`).
- `nest/src/database/migrations/1746000090000-SeedBrowFamily.ts`.
- `nest/src/config/yaml/metric_ideals.yaml` (+brows section).
- `nest/src/config/yaml/region_metric_weights.yaml` (+brows region).

**Validações**: pytest 714 passed (+108 brows), vitest 116 passed, migration **pendente** (Docker não estava rodando).

**Próximo PR**: PR-17 (cheekbones/midface family).
