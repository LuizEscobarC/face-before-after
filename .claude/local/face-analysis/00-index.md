---
tenant_id: "face-before-after"
project: "face-before-after"
module: "face-analysis/00-index"
file_path: ".claude/face-analysis/00-index.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Documentação da arquitetura atual MediaPipe-478 + NestJS + PostgreSQL + Python. > Última atualização: 2026-05-12 — auditoria do painel premium; integração BiSeNet hairline; OutlineFace horn fix LMFOREHEADRIDGE; overlay annotations JSON; imagem canônica como fonte única; thresho
tags:
  - "face-analysis"
rag_keywords:
  - "analysis"
  - "face"
  - "index"
related_modules: []
depends_on: []
used_by: []
---
# Face Analysis Domain — Índice de Contexto

> Documentação da arquitetura atual (MediaPipe-478 + NestJS + PostgreSQL + Python).
> Última atualização: **2026-05-12** — auditoria do painel premium; integração BiSeNet hairline; OutlineFace horn fix (LM_FOREHEAD_RIDGE); overlay annotations JSON; imagem canônica como fonte única; threshold trichion 0.8→0.5; pose warning acionável; layout overlay (SVG 100%, CSS grid 2-col, breakpoint 640px); labels PT-BR proporções ideais.

## Auditorias / changelog técnico

- [CALIBRATION_AUDIT_2026-05-12.md](./CALIBRATION_AUDIT_2026-05-12.md) — bugs de landmark (P_NOSE_RIGHT 45→278, zygomatic, lips), recalibração de ideais v1.1, painel premium (D1-D4: jawline, marquardt, fwhr, gaussianas).
- [08-svg-overlays.md](./08-svg-overlays.md) — 7 bugs/melhorias: coordinate space, Rule of Fifths, midline, OutlineFace horn (LM_FOREHEAD_RIDGE), overlay annotations JSON + `<OverlaySidebar>`.
- [09-bisenet-hairline.md](./09-bisenet-hairline.md) — integração BiSeNet: virtual trichion, FusedLandmarks, trichion threshold 0.5, scan direction fix, confidence decomposição completa, canonical image storage, overlay annotations, OutlineFace horn fix, pose warning copy.

---

## Arquivos neste domínio

| Arquivo | Conteúdo | Quando ler |
|---------|----------|------------|
| [01-architecture.md](./01-architecture.md) | Stack, fluxo de dados, módulos NestJS, pipeline Python | sempre — base de tudo |
| [02-metrics.md](./02-metrics.md) | Catálogo completo das 93 métricas por região/família | sessões de métricas, calculadores |
| [03-calculations.md](./03-calculations.md) | Fórmulas: ICD, confidence propagation, registry pattern | sessões de fórmulas/calibração |
| [04-severity-thresholds.md](./04-severity-thresholds.md) | Ranges green/yellow por métrica + stubs DEC-10 | sessões de severidade/diagnóstico |
| [05-report-structure.md](./05-report-structure.md) | Schema DB (metric_definition · metric_ideal · region_metric_weight) | sessões de DB/DDL |
| [06-visual-status.md](./06-visual-status.md) | Scores compostos: dominância, atratividade, frescor | sessões de visual_status, scoring |
| [07-recommendations.md](./07-recommendations.md) | Catálogo de recomendações e trilha de evolução | sessões de recomendações/templates |
| [08-svg-overlays.md](./08-svg-overlays.md) | SVG overlays: bugs corrigidos, coordinate space, componentes, QA | sessões de overlays, OverlayLayer |
| [09-bisenet-hairline.md](./09-bisenet-hairline.md) | BiSeNet hairline: segmenter, virtual_landmarks, fusion_layer, thirds BiSeNet-aware, trichion_source | sessões de hairline, thirds, trichion |

---

## Resumo executivo (sistema atual)

O sistema analisa uma foto facial frontal usando **MediaPipe Mesh-478** e retorna um vetor de 93 métricas com confidence calibrada por pose, qualidade e penalidades regionais.

### Backend Python (`backend/`)
- **93 calculadores** registrados via `@register` em `app.services.metrics`
- Input: `(478, 3)` landmarks MediaPipe, origem = midpoint intercantal, escala = ICD
- Output: lista de `MetricValue` (value, confidence_raw, confidence_final, direction)
- Confidence propagada por `confidence_propagation.propagate()` — pipeline: `conf_raw × quality × regional_penalty × pose_penalty × trichion_multiplier`
- **4 stubs DEC-10** com `requires_pixel_analysis=True` → `direction="not_computed"`, confidence=0
- **Imagem canônica** (crop + Frankfort-alignment) é **a única fonte de verdade** para métricas, overlays e storage. A foto original nunca vai para MinIO.
- **BiSeNet hairline** detecta trichion anatômico (threshold confidence ≥ 0.5); fallback automático para `lm[10]`.
- **`result["overlay_annotations"]`** contém labels textuais JSON dos overlays (terços, quintos, extensão facial) — sem texto burned-in nos PNGs.

### Backend NestJS (`nest/`)
- PostgreSQL `localhost:9019 / face_analysis`
- Tabelas: `metric_definition` (93 rows v1.0) · `metric_ideal` (88 rows v1.0) · `region_metric_weight` (88 rows v1.5)
- API REST principal: `POST /v1/vision/metrics`, `POST /v1/vision/full-pipeline`, `POST /v1/analysis`
- Endpoint canônica: `GET /v1/vision/results/{run_id}/canonical` → imagem canônica JPEG

### Waves de implementação

| Wave | # métricas | Stubs | Módulo Python |
|------|-----------|-------|---------------|
| Base | 63 | 0 | symmetry · thirds · fifths · eyes · jaw · nose · mouth · brows · cheekbones · forehead · global_shape · phi_golden |
| C1 | 10 | 1 (`supratarsal_fold_visibility`) | integrado em `eyes.py` / `cheekbones.py` |
| C2 | 10 | 1 (`nasolabial_angle_proxy`) | `wave_c2.py` |
| C3 | 10 | 2 (`ogee_curve_proxy` · `forehead_slope_proxy`) | `wave_c3.py` |
| **Total** | **93** | **4** | — |

---

## Constantes globais chave

| Constante | Valor | Arquivo |
|-----------|-------|---------|
| Landmarks | MediaPipe Mesh-478 | `landmarks_mesh.py` |
| Origem | midpoint P_INNER_CANTHUS_L / P_INNER_CANTHUS_R | `normalized_landmarks.py` |
| Escala (ICD) | distância intercantal em pixels | `normalized_landmarks.py` |
| Eixo Y | cresce para baixo (padrão imagem) | — |
| LOW_CONF_THRESHOLD | 0.35 | `confidence_propagation.py` |
| Frontal OK | \|yaw\| ≤ 15° e \|pitch\| ≤ 15° | `confidence_propagation.py` |
| Pytest | 1441 passed, 49 skipped | `backend/tests/` |
| Vitest | 201 passed | `nest/src/` |
