# PLAN_M2_BACKLOG.md

> Backlog detalhado do **Marco 2 — calibração + expansão de métricas + scoring rico**.
> Releia junto com `PLAN_METRICS.md` no início de cada sessão.
> Atualização: 2026-05-08 (após PR-23).

---

## 0. Contexto

**✅ PRs 13–20 + PR-23 entregues** — catálogo de 66 métricas (`metric_definition`) com 59 ideais (`metric_ideal`) e 56 pesos (`region_metric_weight` em 9 regiões). Pytest: 1088 passed / 48 skipped. DB verificado.

A expansão do catálogo (frente 1 e 2 do M2) está **concluída** e a infraestrutura de consistência longitudinal (PR-23) está entregue. As duas frentes remanescentes são:

1. **Calibração com fotos reais** (PR-22) — coleta de ≥30 fotos de operador + planilha de override de faixas. Operação humana; modelo Opus para decisões de calibração.
2. **Recalibração de pesos** (PR-21) — rebalanceia `region_metric_weight_version v2.0` + `global_weights_version v2.0` com base nos dados de PR-22. Bloqueia em PR-22. Modelo: **Opus**.

> PR-21 e PR-22 **requerem Opus** e PR-22 exige fotos reais (tarefa humana). Não há PR executável com Sonnet no backlog M2 atual.

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
| **PR-17** ✅ | Família **cheekbones / midface** — **DONE** | `zygomatic_width_ratio`, `malar_projection_index`, `midface_height_ratio`, `cheekbone_to_jaw_ratio`, `submalar_hollow_index` (5) | idem + `ALTER TYPE metric_region_enum ADD VALUE 'cheekbones'` (migration split para contornar PG commit constraint) | **Sonnet** |
| **PR-18** ✅ | Família **forehead** — **DONE** | `forehead_height_ratio`, `forehead_width_ratio`, `temporal_width_ratio`, `hairline_curvature_index` *(requires_pixel_analysis=True, stub DEC-10)* (4 — 1 pixel-dep) | `metric_definition` (+4), `metric_ideal` (+3), `region_metric_weight (region=forehead)` (+3). Sem ALTER TYPE — 'forehead' já no enum. `FOREHEAD_POSE_PARAMS` (yaw_weight=0.60, pitch_weight=0.40) | **Sonnet** |
| **PR-19** ✅ | Família **global_shape** — **DONE** | `face_height_to_width_ratio`, `face_shape_classification` *(presentation_only, DEC-6)*, `total_facial_convexity`, `e_line_deviation` *(requires_pixel_analysis=True, stub DEC-10)* (4) | `metric_definition` (+4), `metric_ideal` (+3), `region_metric_weight` (+2, region=global). Sem ALTER TYPE — 'global' já no enum. | **Sonnet** |
| **PR-20** ✅ | Família **phi/golden** *(presentation_only HARD)* — **DONE** | `phi_face_height_to_width`, `phi_lower_face_segments`, `phi_eye_to_mouth`, `phi_nose_to_lip` (4 — todas `presentation_only=true`) | `metric_definition` (+4, sem `metric_ideal`, sem `region_metric_weight`) | **Sonnet** |
| **PR-21** | **Recalibração ampla** dos `region_metric_weight` quando todas as famílias estiverem dentro | rebalanceia pesos das 6 regiões (atualmente symmetry=14, eyes=6 dominam o score) | nova `region_metric_weights_version v2.0` + `global_weights_version v2.0` (DEC-12: snapshot, mantém v1.0 ativa em histórico) | **Opus** (julgamento de balanceamento) |
| **PR-22** | **Calibração com fotos reais** | coleta de 30–50 fotos (operador interno), planilha de override de `green_range_min/max` por métrica, `ideals_version v2.0` ativada | `ideals_version`, `metric_ideal` (rows nova versão), `metric_evaluation` re-rodada para auditoria | **Opus** (julgamento de fontes) |
| **PR-23** ✅ | **Consistência longitudinal** (multi-foto) — **DONE** | `landmark_stability.py` (compute_stability, STABILITY_SLOPE=5.0), `QualityContext` +2 campos, `confidence_propagation` passo 4, schemas `MetricsV2Request/Response`, router post-processing, migration `1746000140000-AddLandmarkStabilityColumns`, 54 testes Python | `landmark_payload` + 2 colunas (landmark_stability_scores JSONB, normalization_applied BOOLEAN) + índice parcial | **Sonnet** |

**Total após PR-23**: 21 (M1) + 6+7+7+8+5+4+4+4 = **66 métricas** ✅ — alvo de "60+" atingido. DB: 66 `metric_definition`, 59 `metric_ideal`, 56 `region_metric_weight` (9 regiões), `landmark_payload` com colunas de estabilidade. pytest: 1088 passed / 48 skipped.

**Próximo executável com Sonnet**: Nenhum no M2. PR-21 e PR-22 **requerem Opus** e PR-22 exige fotos reais (tarefa humana).

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

**Validações**: pytest 714 passed (+108 brows), vitest 116 passed, migration aplicada.

---

### PR-17 — cheekbones/midface (5 métricas) ✅ DONE

**Arquivos modificados/criados**:
- `backend/app/services/metrics/confidence_propagation.py` (CHEEKBONE_POSE_PARAMS).
- `backend/app/services/metrics/cheekbones.py` (5 calculators).
- `backend/app/services/metrics/__init__.py` (registro do módulo).
- `backend/tests/fixtures/synthetic_landmarks.py` (`perfect_cheekbone_face`, `square_jaw_cheekbone_face`).
- `backend/tests/unit/test_cheekbones.py` (79 testes).
- `nest/src/database/migrations/1746000095000-AddCheekbonesEnumValue.ts` (ALTER TYPE, transaction=false).
- `nest/src/database/migrations/1746000100000-SeedCheekbonesFamily.ts` (5 defs + 5 ideals + 5 weights).
- `nest/src/database/data-source.ts` (migrationsTransactionMode: 'each').
- `nest/src/config/yaml/metric_ideals.yaml` (+cheekbones section).
- `nest/src/config/yaml/region_metric_weights.yaml` (+cheekbones region).

**Lição aprendida**: `metric_region_enum` não incluía 'cheekbones'. `ALTER TYPE ADD VALUE` precisa ser committed antes de ser usado → split em dois migrations (0095000 enum, 0100000 seed). `migrationsTransactionMode: 'each'` permite `transaction=false` por migration.

**Validações**: pytest 793 passed (+79 cheekbones), vitest 116 passed, migration aplicada. DB: 54 definitions, 53 ideals, cheekbones=5 weights.

---

### PR-18 — forehead family (4 métricas) ✅ DONE

**Data**: 2026-05-08. **Modelo**: Sonnet 4.6 com contexto.

**Métricas entregues (4)**: `forehead_height_ratio`, `forehead_width_ratio`, `temporal_width_ratio`, `hairline_curvature_index` *(requires_pixel_analysis=True, stub DEC-10)*.

**Desvio do plano original**:
- `hairline_curvature_index` cadastrado em `metric_definition` com `requires_pixel_analysis=True`. Pipeline pula — não emite `metric_evaluation` (DEC-10). Reserva `metric_id` para módulo de pixel pós-M4.
- `forehead_width_ratio` usa bizygomatic como denominador (Farkas §4.2), não face_width em sentido amplo.

**Calibração** (fontes primárias):
- `forehead_height_ratio = 1.90 ICU (±0.30 verde)` — Farkas (1994), tabela 1.1: ~62 mm / ~32 mm ≈ 1.94; Naini (2011) §2.3 upper-third ≈ 1/3 total ≈ 1.90. Não varia significativamente por sexo.
- `forehead_width_ratio = 0.70 (±0.07 verde)` — Farkas (1994) tabela 4.2: bizygomatic:forehead = 1.0:0.70. Naini (2011) §6 confirma.
- `temporal_width_ratio = 0.75 (±0.07 verde)` — temporal fossa width / bizygomatic. Romo et al. (2006): ideal ~75% do bizygomatic para contorno harmônico.
- `hairline_curvature_index` — sem ideal (pixel-dep).

**Fontes / links**:
- Farkas, L.G. (1994). *Anthropometry of the Head and Face*, 2nd ed. Raven Press. ISBN 0-7817-0082-8.
- Naini, F.B. (2011). *Facial Aesthetics: Concepts & Clinical Diagnosis*. Wiley-Blackwell. ISBN 978-1-4051-8192-1. Capítulos 2.3, 6.
- Romo T., Yalamanchili H., Sclafani A.P. (2006). "Forehead and brow rejuvenation." *Plast Reconstr Surg* 118(7):232S–244S. DOI: [10.1097/01.prs.0000242509.25985.c3](https://doi.org/10.1097/01.prs.0000242509.25985.c3).

**Pesos (region_metric_weight v1.0, region=forehead, 3 linhas)**:
- `forehead_height_ratio = 1.0`, `forehead_width_ratio = 1.0`, `temporal_width_ratio = 1.1` (temporal fossa percebida como mais discriminante). `hairline_curvature_index` excluída (pixel-dep + DEC-10).

**Pose params (`FOREHEAD_POSE_PARAMS`)**: yaw_soft=5°, hard=15°, pitch_soft=6°, hard=16°, yaw_weight=0.60, pitch_weight=0.40, floor=0.17.

**Artefatos**:
- `backend/app/services/metrics/forehead.py` (4 calculators, ~260 linhas).
- `backend/app/services/metrics/confidence_propagation.py` (`FOREHEAD_POSE_PARAMS`).
- `backend/app/services/metrics/base.py` — adicionado `requires_pixel_analysis: ClassVar[bool] = False` ao ABC.
- `backend/tests/fixtures/synthetic_landmarks.py` (`perfect_forehead_face`, `short_forehead_face`).
- `backend/tests/unit/test_forehead.py` (75 testes, todos passing).
- `nest/src/database/migrations/1746000110000-SeedForeheadFamily.ts` (4 defs + 3 ideals + 3 weights).
- `nest/src/config/yaml/metric_ideals.yaml` (+forehead section).
- `nest/src/config/yaml/region_metric_weights.yaml` (+forehead region).

**Validações**: pytest 868 passed (+75 forehead), vitest 116 passed, migration aplicada. DB: 58 definitions, 56 ideals, region_metric_weight: forehead=3.

---

### PR-19 — global_shape family (4 métricas) ✅ DONE

**Data**: 2026-05-08. **Modelo**: Sonnet 4.6 com contexto.

**Métricas entregues (4)**: `face_height_to_width_ratio`, `face_shape_classification` *(presentation_only=True, DEC-6)*, `total_facial_convexity`, `e_line_deviation` *(requires_pixel_analysis=True, stub DEC-10)*.

**Desvio do plano original**:
- `face_shape_classification` originalmente prevista como puramente categórica. Implementada com `presentation_only=True` — a classificação oval/round/square/heart/oblong é derivada do `face_height_to_width_ratio` e convexidade, mas não entra em score (DEC-6).
- `e_line_deviation` (Ricketts E-line: nariz→queixo) requer perfil lateral — cadastrada como stub `requires_pixel_analysis=True` (DEC-10). Implementada para frontal parcial, mas pipeline pula para não enviesar o score global.
- `total_facial_convexity` usa `scipy.ConvexHull` sobre 8 pontos faciais externos. Produz índice de convexidade [0, 1] onde 1 = face perfeitamente convexa.

**Calibração** (fontes primárias):
- `face_height_to_width_ratio = 1.35 (±0.10 verde)` — Farkas (1994) tabela 4.4-4.7: bigonial:bizygomatic ~1.35. Powell & Humphreys (1984): "aesthetic face" ~1.35. φ ≈ 1.618 é o ideal Marquardt mas refutado como norma populacional (Farkas, 1994).
- `total_facial_convexity = 0.98 (±0.04 verde)` — índice derivado de 8 landmarks perimetrais. Valor canônico estimado; literatura não tem standard direto para esta métrica.
- `face_shape_classification` — ideal_central_value=1.35 (mesma base que face_height_to_width, para referência overlay), presentation_only=True.
- `e_line_deviation` — sem ideal (pixel-dep stub).

**Fontes / links**:
- Farkas, L.G. (1994). *Anthropometry of the Head and Face*, 2nd ed. Raven Press. ISBN 0-7817-0082-8. Tabelas 4.4–4.7.
- Powell N., Humphreys B. (1984). *Proportions of the Aesthetic Face*. Thieme-Stratton. ISBN 0-86577-038-1.
- Ricketts R.M. (1982). "Divine proportion in facial esthetics." *Clin Plast Surg* 9(4):401–422. PMID: 7140068.
- Marquardt Beauty Analysis: https://www.beautyanalysis.com (phi mask overlay reference).

**Pesos (region_metric_weight v1.0, region=global, 2 linhas)**:
- `face_height_to_width_ratio = 1.3`, `total_facial_convexity = 0.8`. `face_shape_classification` excluída (DEC-6 presentation_only). `e_line_deviation` excluída (DEC-10 pixel-dep).

**Pose params (`GLOBAL_SHAPE_POSE_PARAMS`)**: yaw_soft=6°, hard=18°, pitch_soft=6°, hard=18°, yaw_weight=0.50, pitch_weight=0.50, floor=0.20 — balanceado pois métricas globais têm sensibilidade igual a yaw e pitch.

**Artefatos**:
- `backend/app/services/metrics/global_shape.py` (4 calculators, ~330 linhas, inclui ConvexHull).
- `backend/app/services/metrics/confidence_propagation.py` (`GLOBAL_SHAPE_POSE_PARAMS`).
- `backend/tests/fixtures/synthetic_landmarks.py` (`perfect_global_shape_face`, `round_face`).
- `backend/tests/unit/test_global_shape.py` (77 testes, todos passing).
- `nest/src/database/migrations/1746000120000-SeedGlobalShapeFamily.ts` (4 defs + 3 ideals + 2 weights).
- `nest/src/config/yaml/metric_ideals.yaml` (+global_shape section).
- `nest/src/config/yaml/region_metric_weights.yaml` (+global region).

**Validações**: pytest 945 passed (+77 global_shape), vitest 116 passed, migration aplicada. DB: 62 definitions, 59 ideals, region_metric_weight: global=2.

---

### PR-20 — phi/golden family (4 métricas, todas presentation_only) ✅ DONE

**Data**: 2026-05-08. **Modelo**: Sonnet 4.6 com contexto. **Commit**: `926bf2c`.

**Métricas entregues (4)**: `phi_face_height_to_width`, `phi_lower_face_segments`, `phi_eye_to_mouth`, `phi_nose_to_lip` — **TODAS `presentation_only=True` (DEC-6 hard)**. Φ ≠ média populacional; φ ≈ 1.618 é aesthetic overlay, não norma clínica.

**Justificativa DEC-6 por métrica**:
- `phi_face_height_to_width`: Farkas (1994) median = 1.35; φ = 1.618 → desvia +20% da população. Overlay visual apenas.
- `phi_lower_face_segments`: Ricketts (1982) propõe divisão áurea, mas Naini (2011) §2.5 não confirma como norma populacional.
- `phi_eye_to_mouth`: Marquardt Phi Mask (2002) — design overlay sem base epidemiológica validada.
- `phi_nose_to_lip`: Farkas (1994) mouth:nose width ≈ 1.47 (não φ=1.618). Edler (2001) range 1.4–1.6.

**Calibração**: Sem `metric_ideal` — `presentation_only=True` ≡ `default_weight_in_region=0.0`, sem entrada em `metric_ideal` (DEC-6).

**PHI_POSE_PARAMS**: yaw_soft=8°, hard=22°, pitch_soft=7°, hard=20°, yaw_weight=0.45, pitch_weight=0.55, floor=0.25. Mais permissivo que demais (overlay deve permanecer visível em fotos levemente giradas).

**Fontes / links**:
- Marquardt S.R. (2002). *Phi Mask*. https://www.beautyanalysis.com (design overlay; sem peer-review epidemiológico).
- Livio M. (2002). *The Golden Ratio*. Broadway Books. ISBN 0-7679-0816-X.
- Ricketts R.M. (1982). "Divine proportion in facial esthetics." *Clin Plast Surg* 9(4):401–422.
- Edler R.J. (2001). "Background considerations to facial aesthetics." *J Orthod* 28(2):159–168. DOI: [10.1093/ortho/28.2.159](https://doi.org/10.1093/ortho/28.2.159).
- Farkas L.G., Katic M.J., et al. (1994). "Anthropometric proportions in the upper lip–lower lip–chin area." *Am J Orthod* 105(1):36–43. DOI: [10.1016/S0889-5406(94)70099-1](https://doi.org/10.1016/S0889-5406(94)70099-1).
- Naini F.B. (2011). *Facial Aesthetics*. §2.5, §9 (lower-face segments). Wiley-Blackwell.

**Bugs encontrados e corrigidos durante PR-20**:
1. `lm.x(idx)` / `lm.y(idx)` → API correta é `lm.xy(idx)[0]` / `lm.xy(idx)[1]`.
2. `propagate()` chamado com kwargs errados → assinatura correta: `propagate(cr, quality_score, region, regional_penalties, yaw_deg, pitch_deg, params)`.
3. `default_weight_in_region: null` → coluna NOT NULL no DB → corrigido para `0.0`.
4. Testes de floor: `floor^yaw_weight ≈ 0.536` não `floor=0.25` (geometric mean ponderada).

**Artefatos**:
- `backend/app/services/metrics/phi_golden.py` (4 calculators, ~470 linhas).
- `backend/app/services/metrics/confidence_propagation.py` (`PHI_POSE_PARAMS`).
- `backend/app/services/metrics/__init__.py` (import `phi_golden`).
- `backend/tests/fixtures/synthetic_landmarks.py` (`perfect_phi_face`, `wide_face_non_phi`).
- `backend/tests/unit/test_phi_golden.py` (89 testes, todos passing).
- `nest/src/database/migrations/1746000130000-SeedPhiGoldenFamily.ts` (4 defs, 0 ideais, 0 pesos).
- `nest/src/config/yaml/metric_ideals.yaml` (+comentário DEC-6 phi family).
- `nest/src/config/yaml/region_metric_weights.yaml` (+comentário phi exclusion).

**Validações**: pytest 1034 passed (+89 phi), vitest 116 passed, migration aplicada. DB: **66 definitions, 59 ideals, 56 weights (9 regiões)**. Alvo M2 de 60+ métricas ✅ atingido.
