# Face Analysis Domain — Índice de Contexto

> Documentação da arquitetura atual (MediaPipe-478 + NestJS + PostgreSQL + Python).
> Última atualização: Maio 2026 — pós-implementação C1+C2+C3 (93 calculadores).

---

## Arquivos neste domínio

| Arquivo | Conteúdo |
|---------|----------|
| [01-architecture.md](./01-architecture.md) | Stack, fluxo de dados, módulos NestJS, pipeline Python |
| [02-metrics.md](./02-metrics.md) | Catálogo completo das 93 métricas por região/família |
| [03-calculations.md](./03-calculations.md) | Fórmulas: ICD, confidence propagation, registry pattern |
| [04-severity-thresholds.md](./04-severity-thresholds.md) | Ranges green/yellow por métrica + stubs DEC-10 |
| [05-report-structure.md](./05-report-structure.md) | Schema DB (metric_definition · metric_ideal · region_metric_weight) |
| [06-visual-status.md](./06-visual-status.md) | Scores compostos: dominância, atratividade, frescor |
| [07-recommendations.md](./07-recommendations.md) | Catálogo de recomendações e trilha de evolução |

---

## Resumo executivo (sistema atual)

O sistema analisa uma foto facial frontal usando **MediaPipe Mesh-478** e retorna um vetor de 93 métricas com confidence calibrada por pose, qualidade e penalidades regionais.

### Backend Python (`backend/`)
- **93 calculadores** registrados via `@register` em `app.services.metrics`
- Input: `(478, 3)` landmarks MediaPipe, origem = midpoint intercantal, escala = ICD
- Output: lista de `MetricValue` (value, confidence_raw, confidence_final, direction)
- Confidence propagada por `confidence_propagation.propagate()` (yaw/pitch + qualidade + penalidades regionais)
- **4 stubs DEC-10** com `requires_pixel_analysis=True` → `direction="not_computed"`, confidence=0

### Backend NestJS (`nest/`)
- PostgreSQL `localhost:9019 / face_analysis`
- Tabelas: `metric_definition` (93 rows v1.0) · `metric_ideal` (88 rows v1.0) · `region_metric_weight` (88 rows v1.5)
- API REST principal: `POST /v1/vision/metrics`, `POST /v1/vision/full-pipeline`, `POST /v1/analysis`

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
| Pytest | 1394 passed, 48 skipped | `backend/tests/` |
| Vitest | 201 passed | `nest/src/` |
