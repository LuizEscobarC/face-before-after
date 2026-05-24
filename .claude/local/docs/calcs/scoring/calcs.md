---
tenant_id: "face-before-after"
project: "face-before-after"
module: "scoring/calcs"
file_path: ".claude/docs/calcs/scoring/calcs.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Audit em 2026-05-09. RegionalScorer, GlobalScorer, ScoreBander e SeverityClassifier validados contra YAMLs e specs Vitest.
tags:
  - "calculations"
rag_keywords:
  - "calcs"
  - "docs"
  - "scoring"
related_modules: []
depends_on: []
used_by: []
---
# Scoring — fórmulas auditadas

> Audit em 2026-05-09. RegionalScorer, GlobalScorer, ScoreBander e SeverityClassifier validados contra YAMLs e specs Vitest.

### regional_score

formula = (Σ[quality_i × weight_i × confidence_final_i] / Σ[weight_i × confidence_final_i]) × 100
        where quality_i = clip(1 − |deviation_normalized_i|, 0, 1)
unit = 0..100
file = nest/src/modules/analysis/.../regional-scorer.ts:56-114
gating = métrica skipada se confidence_final < MIN_CONFIDENCE_TO_DISPLAY_DEFAULT (0.4)
edge case = sumWeightedConfidence === 0 → score = null (não divide por zero)
NOTE = pesos regionais NÃO somam 1.0 — são multiplicadores relativos; a divisão normaliza internamente
       (yaml header confirma: "weights are unitless multipliers")

### global_score

formula = Σ[regional_score_i × global_weight_i] / Σ[global_weight_i used]
unit = 0..100
file = nest/src/modules/analysis/.../global-scorer.ts:42-117
gating (DEC-8) = se qualquer região crítica tem confidence_aggregate < 0.5 → score=null, isDisplayable=false
exclusion = regiões com regional_score=null são REMOVIDAS do somatório (não contam como zero)

### global_weights (sums verified)

v1.0:
  symmetry = 0.65
  eyes     = 0.35
  Σ        = 1.0 ✅

v1.5 (provisional, is_active=FALSE):
  symmetry   = 0.18
  eyes       = 0.16
  jaw        = 0.14
  nose       = 0.12
  mouth      = 0.12
  brows      = 0.10
  cheekbones = 0.08
  forehead   = 0.05
  global     = 0.05
  Σ          = 1.0 ✅

### score_band (DEC-9)

[0, 50)    → no_number  (score escondido — banding "refine sem número")
[50, 70)   → refine
[70, 85)   → good
[85, 100]  → high
file = nest/src/modules/analysis/.../score-bander.ts:17-25
boundaries = inclusivo no limite inferior, exclusivo no superior (testado em .spec.ts)

### severity_5 (deviation_normalized → severity)

[0, 1.0)   → ideal
[1.0, 2.0) → mild
[2.0, 3.5) → moderate
[3.5, 5.0) → strong
[5.0, ∞)   → extreme
file = nest/src/modules/diagnosis/.../severity-classifier.ts:58-68
continuity = ranges contínuos, sem gap em transições (1.0, 2.0, 3.5, 5.0 testados)

### severity_3 mapping (5 → 3 para narrativa)

ideal, mild → LEVE
moderate    → MODERADO
strong, extreme → SEVERO
