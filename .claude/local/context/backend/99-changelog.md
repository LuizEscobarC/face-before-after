---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/changelog"
file_path: ".claude/local/context/backend/99-changelog.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Changelog do subsistema backend. Uma linha por mudanca documentada, mais recente primeiro.
tags:
  - "backend"
  - "changelog"
rag_keywords: []
related_modules: []
depends_on: []
used_by: []
---
# backend — Changelog

- **2026-05-24** — Criado `34-landmark-stability.md`: LandmarkStabilityAnalyzer (PR-23 multi-capture), analyze(), landmark_stability_penalty, integração com confidence_propagation.

- **2026-05-24** — Criado `32-bisenet-segmenter.md`: BiSeNetSegmenter, segment(), class labels, extração trichion Y da máscara.

- **2026-05-24** — Criado `31-landmarks-fusion.md`: FusedLandmarks, fuse(), VirtualLandmarks, _trichion.py effective_trichion_y/TRICHION_CONFIDENCE_THRESHOLD.

- **2026-05-24** — Criado `30-calc-registry-base.md`: MetricRegistry, MetricCalculator ABC, QualityContext, MetricValue — contrato base de todas as calculadoras.

- **2026-05-24** — Auditoria e correção de 6 erros factuais nos docs gerados por agente: `22-calc-symmetry.md` (fórmula midline_deviation, dep lm, confidence global_asymmetry_index weighted-mean), `2E-calc-wave-c2.md` (nasolabial_angle_proxy reescrito como STUB), `25-calc-eyes.md` (directions scleral_show_lower_l/r: `visible`→`scleral_show`), `2D-calc-global-shape.md` (e_line_deviation: directions `anterior/posterior`→`left_deviation/right_deviation`, fórmula corrigida para desvio lateral do eixo nariz→mento).

- **2026-05-24** — Criado `33-reports.md`: compare_json (13 COMPARE_KEYS, HIGHER_IS_BETTER, delta por chave), PdfBuilder (ReportLab, PdfReportData, FindingData, RecommendationData), build_html (Jinja-free, template inline), relação entre endpoints /vision/compare, /api/compare (não montado), /vision/generate-pdf e /vision/results.

- **2026-05-24** — Criados `20-calc-normalization.md` (etapa 5) e `21-calc-confidence.md` (etapa 6): pipeline normalize() 3 etapas, pose_correction foreshortening 1/cos, intercanthal_scaler P_LEFT_EYE_INNER=133/P_RIGHT_EYE_INNER=362, midline_aligner roll, NormalizedLandmarks. propagate() 4 etapas, PosePenaltyParams piecewise-linear, 12 POSE_PARAMS por família, LOW_CONF_THRESHOLD=0.4, landmark_stability PR-23.

- **2026-05-24** — Criados 14 docs de calculadoras de métricas (22–2F): `22-calc-symmetry.md` (5 métricas, SYMMETRY_POSE_PARAMS, global_asymmetry_index composto), `23-calc-thirds.md` (4 métricas, BiSeNet trichion fusion), `24-calc-fifths.md` (6 métricas, yaw_weight=0.90), `25-calc-eyes.md` (10 métricas, supratarsal_fold_visibility stub DEC-10), `26-calc-brows.md` (9 métricas, BROW_POSE_PARAMS), `27-calc-nose.md` (9 métricas, NOSE_POSE_PARAMS), `28-calc-mouth.md` (7 métricas, MOUTH_POSE_PARAMS), `29-calc-jaw.md` (6 métricas, floor=0.15, P_LEFT_GONION=58 TODO), `2A-calc-cheekbones.md` (5 métricas), `2B-calc-forehead.md` (4 métricas, BiSeNet), `2C-calc-phi.md` (4 métricas presentation_only DEC-6, _PHI=1.6180), `2D-calc-global-shape.md` (4 métricas, face_shape_classification, e_line_deviation), `2E-calc-wave-c2.md` (10 métricas, nasolabial_angle_proxy gap), `2F-calc-wave-c3.md` (10 métricas, facial_index_anthropometric Martin 87.5). Catálogo granular de 93 metric_ids com arquivo:linha, unit, ideal, max_dev, directions, pose_params e dep lm para cada família.

- **2026-05-24** — Criado `20-output-layers.md`: MetricValue domain contract, GeneratePdfRequest/FindingRequest/RecommendationRequest (PR-60), compare_json 13 COMPARE_KEYS, HIGHER_IS_BETTER.

- **2026-05-24** — Criado `19-overlays.md`: POST /vision/render (7 overlay_ids, heatmaps PR-37/38, L1/L2 suppression) e POST /vision/compose-before-ideal (IdealLandmarkOffset, offsets_json).

- **2026-05-24** — Criado `18-trichion-bisenet.md`: FusedLandmarks, fuse(), TRICHION_CONFIDENCE_THRESHOLD=0.40, effective_trichion_y, métricas afetadas (upper_third_ratio, forehead_height_ratio).

- **2026-05-24** — Criados `15-metrics-eyes-brows-nose-jaw-mouth.md`, `16-metrics-cheekbones-forehead-thirds-fifths-symmetry-global-phi.md`, `17-metrics-wave-c2-c3.md`: catálogo completo dos 93 metric_ids em 14 famílias com ideais, max_dev, directions e pose params.

- **2026-05-24** — Criado `14-normalization-confidence.md`: normalize() 3 etapas → NormalizedLandmarks (ICU), propagate() 4 etapas multiplicativas, PosePenaltyParams para 12 famílias, landmark_stability_penalty PR-23.

- **2026-05-24** — Criado `13-vision-primitives.md`: LandmarkPayload schema completo, quality_evaluator.evaluate() score multiplicativo, POSE_LIMITS, GRADE_THRESHOLDS, fluxo /vision/landmarks.

- **2026-05-24** — Criado `12-pipeline.md`: orquestração `run()` em `domain/pipeline.py` — 8 etapas, CanonicalFrame, score/tier, módulos de produto teaser vs premium, BiSeNet trichion, simulação before/after, METRIC_WEIGHTS.

- **2026-05-24** — Criado `11-api-vision.md`: catálogo dos 15 endpoints ativos em `/vision/*`. Inclui tabela de duplicações com router legado. Endpoints exclusivos documentados: landmarks, metrics-v2 (93 métricas, PR-23 multi-capture), render (7 overlay types), compose-before-ideal, generate-pdf, results/original, results/canonical.

- **2026-05-24** — Criado `10-api-endpoints.md`: catálogo dos 8 endpoints do router legado `app/api/endpoints/`. Descoberta: router nunca montado em `main.py` — todos os endpoints são desmontados. Único valor residual: `GET /api/glossary` sem par em `vision/`.

- **2026-05-24** — Pass geral de frontmatter: tenant_id corrigido por subprojeto (rag-map.md), file_path realinhado a `.claude/local/context/`, summary_context e rag_keywords reescritos para densidade factual. Sem mudanca de codigo.
