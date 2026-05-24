---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/index"
file_path: ".claude/local/context/backend/00-index.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Backend Python (FastAPI 0.112+, Python 3.12) implementa face-analysis-api — pipeline de
  análise facial com MediaPipe + dlib 68 landmarks + BiSeNet hair segmentation. Camadas DDD
  internas em backend/app/{api,domain,services,vision,reports,infra,core}. Roda em container
  backend-api via uvicorn, expõe endpoints REST sob /api/v1.
tags:
  - "backend"
  - "python"
  - "fastapi"
  - "face-analysis"
rag_keywords:
  - "FastAPI 0.112"
  - "MediaPipe FaceMesh"
  - "dlib 68 landmarks"
  - "BiSeNet segmentation"
  - "uvicorn ASGI"
  - "Python 3.12 face pipeline"
  - "MinIO storage"
  - "ONNX runtime"
related_modules: []
depends_on: []
used_by:
  - "nest"
---

# Backend — Índice

> **Última atualização:** 2026-05-24

Backend Python que serve a face-analysis-api. Camadas seguem padrão DDD-lite:
api (transport) → services (orchestration) → domain (rules) → infra (storage/IO).

## Componentes

| Camada | Path | Responsabilidade |
|---|---|---|
| API REST | [backend/app/api](../../../../backend/app/api) | Routers FastAPI, deps, schemas de request |
| Vision | [backend/app/vision](../../../../backend/app/vision) | Sub-API isolada para vision tasks (legacy A1) |
| Domain | [backend/app/domain](../../../../backend/app/domain) | Pipeline, métricas, asymmetry, canonical frame |
| Services | [backend/app/services](../../../../backend/app/services) | Landmarks, metrics, normalization, overlays, segmentation |
| Reports | [backend/app/reports](../../../../backend/app/reports) | HTML/PDF builders |
| Infra | [backend/app/infra](../../../../backend/app/infra) | Storage (MinIO) |
| Core | [backend/app/core](../../../../backend/app/core) | Config (pydantic-settings), logging, exceptions, json_utils |

## Documentos

| Arquivo | Cobre |
|---|---|
| [01-architecture.md](01-architecture.md) | Layers, fluxo principal, contratos de borda |
| [10-api-endpoints.md](10-api-endpoints.md) | ⚠️ Router legado desmontado — 8 endpoints de `api/endpoints/` (não acessíveis em produção) |
| [11-api-vision.md](11-api-vision.md) | ✅ 15 endpoints ativos em `/vision/*` — landmarks, metrics-v2, full-pipeline, render, compose, compare, results, pdf |
| [12-pipeline.md](12-pipeline.md) | ✅ Orquestração `run()` em `domain/pipeline.py` — 8 etapas, teaser vs premium, CanonicalFrame, score, tiers |
| [13-vision-primitives.md](13-vision-primitives.md) | ✅ Primitivas de visão: LandmarkPayload, quality_evaluator (score multiplicativo, grades, POSE_LIMITS), fingerprint |
| [14-normalization-confidence.md](14-normalization-confidence.md) | ✅ Normalização (3 etapas → ICU) + confidence propagation (4 etapas multiplicativas, PosePenaltyParams por família) |
| [15-metrics-eyes-brows-nose-jaw-mouth.md](15-metrics-eyes-brows-nose-jaw-mouth.md) | ✅ 41 métricas em 5 famílias: eyes (10), brows (9), nose (9), jaw (6), mouth (7) — metric_id, ideal, max_dev |
| [16-metrics-cheekbones-forehead-thirds-fifths-symmetry-global-phi.md](16-metrics-cheekbones-forehead-thirds-fifths-symmetry-global-phi.md) | ✅ 38 métricas em 7 famílias: cheekbones (5), forehead (4), thirds (4), fifths (6), symmetry (5), global_shape (4), phi (4) |
| [17-metrics-wave-c2-c3.md](17-metrics-wave-c2-c3.md) | ✅ 20 métricas wave_c2 (10) + wave_c3 (10) — tabela completa de todos 93 metric_ids |
| [18-trichion-bisenet.md](18-trichion-bisenet.md) | ✅ BiSeNet trichion fusion — FusedLandmarks, threshold 0.40, effective_trichion_y, métricas afetadas |
| [19-overlays.md](19-overlays.md) | ✅ Overlays: 5 linhas + 2 heatmaps (PR-37/38), compose-before-ideal, IdealLandmarkOffset, L1/L2 suppression |
| [20-output-layers.md](20-output-layers.md) | ✅ MetricValue (to_dict, presentation_only, improvement_vector), PDF (GeneratePdfRequest, PR-60), compare_json (13 métricas) |
| [22-calc-symmetry.md](22-calc-symmetry.md) | ✅ 5 métricas: midline_deviation, eye_height_asymmetry, brow_height_asymmetry, lip_canting_angle, global_asymmetry_index — SYMMETRY_POSE_PARAMS, improvement_vector |
| [23-calc-thirds.md](23-calc-thirds.md) | ✅ 4 métricas: upper/middle/lower_third_ratio, dominant_third — THIRDS_POSE_PARAMS, BiSeNet trichion fusion |
| [24-calc-fifths.md](24-calc-fifths.md) | ✅ 6 métricas: fifth_1..5_ratio, intercanthal_to_eye_width_ratio — FIFTHS_POSE_PARAMS yaw_weight=0.90 |
| [25-calc-eyes.md](25-calc-eyes.md) | ✅ 10 métricas: eye_aperture_ratio_l/r, interpupillary_distance, intercanthal_distance, canthal_tilt_l/r, scleral_show_lower_l/r, palpebral_fissure_inclination, supratarsal_fold_visibility (stub DEC-10) |
| [26-calc-brows.md](26-calc-brows.md) | ✅ 9 métricas: brow_height_l/r, brow_arch_peak_l/r, brow_thickness_l/r, brow_tail_drop_l/r, interbrow_distance_ratio — BROW_POSE_PARAMS |
| [27-calc-nose.md](27-calc-nose.md) | ✅ 9 métricas: nose_length/width_to_icd, alar_to_face_width_ratio, nose_to_mouth_width_ratio, dorsum_deviation, nasal_tip_deviation, alar_base_asymmetry, nasal_dorsum_straightness, columella_show |
| [28-calc-mouth.md](28-calc-mouth.md) | ✅ 7 métricas: mouth_width_to_icd, mouth_to_face_width_ratio, upper/lower_lip_height_ratio, vermilion_height_total, lip_corner_canting, mouth_midline_deviation |
| [29-calc-jaw.md](29-calc-jaw.md) | ✅ 6 métricas: jaw_width_ratio, gonial_angle_l/r, gonial_angle_asymmetry, mandibular_plane_angle, chin_height_ratio — JAW_POSE_PARAMS floor=0.15, P_LEFT_GONION=58 TODO |
| [2A-calc-cheekbones.md](2A-calc-cheekbones.md) | ✅ 5 métricas: zygomatic_width_ratio, malar_projection_index, midface_height_ratio, cheekbone_to_jaw_ratio, submalar_hollow_index — CHEEKBONE_POSE_PARAMS |
| [2B-calc-forehead.md](2B-calc-forehead.md) | ✅ 4 métricas: forehead_height_ratio (BiSeNet), forehead_width_ratio, temporal_width_ratio, hairline_curvature_index — FOREHEAD_POSE_PARAMS |
| [2C-calc-phi.md](2C-calc-phi.md) | ✅ 4 métricas presentation_only (DEC-6): phi_face_height_to_width, phi_lower_face_segments, phi_eye_to_mouth, phi_nose_to_lip — _PHI=1.6180, _PHI_TOLERANCE=0.0809, PHI_POSE_PARAMS floor=0.25 |
| [2D-calc-global-shape.md](2D-calc-global-shape.md) | ✅ 4 métricas: face_height_to_width_ratio, face_shape_classification (oval/round/square/oblong/heart), total_facial_convexity, e_line_deviation — GLOBAL_SHAPE_POSE_PARAMS |
| [2E-calc-wave-c2.md](2E-calc-wave-c2.md) | ✅ 10 métricas wave_c2: nasolabial_angle_proxy (gap calibração), alar_flare_index, cupids_bow_definition, lip_volume_ratio, oral_commissure_height_asym, philtrum_width_ratio, smile_line_curvature, chin_projection_proxy, mandibular_corpus_length_ratio, masseteric_prominence_proxy |
| [2F-calc-wave-c3.md](2F-calc-wave-c3.md) | ✅ 10 métricas wave_c3: mentolabial_fold_proxy, brow_arch_peak_position_l/r, intersuperciliary_distance_ratio, buccal_fat_index, ogee_curve_proxy (gap), infraorbital_hollow_index, forehead_slope_proxy (gap), glabella_prominence_proxy, facial_index_anthropometric (Martin 87.5) |
| 99-changelog.md | Histórico de mudanças |

## Cross-refs

Domínio funcional (regras de análise, calibrações): ver [.claude/local/face-analysis/](../../face-analysis/00-index.md).
Camada NestJS que consome esta API: ver [nest/](../nest/00-index.md).
