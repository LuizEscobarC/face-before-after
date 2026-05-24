---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/output-layers"
file_path: ".claude/local/context/backend/20-output-layers.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Camada de output do pipeline Python: MetricValue (domain object imutável,
  contrato do POST /vision/metrics-v2), GeneratePdfRequest/PdfBuilder (PR-60),
  e reports/compare.py (compare_json para POST /vision/compare e POST /api/compare).
  MetricValue.to_dict() serializa todos os campos incluindo improvement_vector
  e presentation_only.
tags:
  - "backend"
  - "output"
  - "metric-value"
  - "pdf"
  - "compare"
rag_keywords:
  - "MetricValue metric_id region family unit value error confidence_raw confidence_final"
  - "is_low_confidence direction dependency_landmarks presentation_only improvement_vector"
  - "MetricValue.to_dict() contract POST /vision/metrics-v2 response"
  - "DEC-6 presentation_only never score aggregate phi golden"
  - "GeneratePdfRequest report_id global_score findings recommendations"
  - "FindingRequest metric_id severity_3 narrative_text deviation_normalized"
  - "RecommendationRequest recommendation_id display_text_short_pt requires_professional"
  - "PdfBuilder PdfReportData PR-60 M4.5 application/pdf"
  - "compare_json COMPARE_KEYS score_before score_after score_delta tier_before tier_after"
  - "HIGHER_IS_BETTER jawline_definition_score canthal_tilt_mean_deg"
related_modules:
  - "backend/pipeline"
  - "backend/api-vision"
  - "backend/normalization-confidence"
depends_on:
  - "backend/normalization-confidence"
used_by:
  - "backend/pipeline"
  - "backend/api-vision"
---

# Backend — Output Layers (MetricValue, PDF, Compare)

> **Última atualização:** 2026-05-24

---

## MetricValue (`domain/metric_value.py`)

Dataclass `frozen=True, slots=True` — imutável.

```python
@dataclass(frozen=True, slots=True)
class MetricValue:
    metric_id:            str
    region:               str
    family:               str
    unit:                 str
    value:                float   # magnitude não-negativa
    error:                float   # incerteza de medição
    confidence_raw:       float   # 0–1 antes de penalidades
    confidence_final:     float   # 0–1 após todos os multiplicadores
    is_low_confidence:    bool    # True quando confidence_final < 0.4
    direction:            str     # label semântico do desvio
    dependency_landmarks: tuple[int, ...]  # índices MediaPipe consumidos
    presentation_only:    bool = False     # DEC-6: nunca entra em score
    improvement_vector:   tuple[float, float] | None = None
```

### `to_dict()` — contrato de serialização

```json
{
  "metric_id": "eye_aperture_ratio_l",
  "region": "eyes",
  "family": "eyes",
  "unit": "ratio",
  "value": 0.28,
  "error": 0.01,
  "confidence_raw": 0.93,
  "confidence_final": 0.81,
  "is_low_confidence": false,
  "direction": "narrow",
  "dependency_landmarks": [33, 7, 163, 144],
  "presentation_only": false,
  "improvement_vector": null
}
```

**Regra `presentation_only` (DEC-6):** métricas `phi_*` têm `presentation_only=True` — Nest não as inclui em nenhum score agregado nem em comparações de melhoria.

**`improvement_vector`:** vetor `[dx, dy]` em ICU indicando direção de melhoria para animação/composição. `None` quando não calculado.

---

## PDF Report (`vision/routers/pdf.py`)

**PR-60, M4.5** — `POST /vision/generate-pdf`

### GeneratePdfRequest

```python
class GeneratePdfRequest(BaseModel):
    report_id: str              # UUID do relatório
    generated_at: str           # ISO datetime string
    global_score: float         # score 0–100
    findings: list[FindingRequest]
    recommendations: list[RecommendationRequest]
    disclaimer: str = ""
    rendered_asset_urls: list[str] = []  # URLs das imagens geradas
```

### FindingRequest

```python
class FindingRequest(BaseModel):
    metric_id: str
    severity_3: str | None      # severidade 3-nível (ex: "mild", "moderate", "severe")
    narrative_text: str = ""
    deviation_normalized: float | None
    # Campos legacy (backward compat com callers antigos):
    region_pt: str | None
    severity_pt: str | None
    text_medium: str | None
```

### RecommendationRequest

```python
class RecommendationRequest(BaseModel):
    recommendation_id: str
    display_text_short_pt: str = ""
    requires_professional: bool = False
    professional_type: str | None    # ex: "orthodontist", "dermatologist"
    category: str = ""
    rank: int | None
```

**`PdfBuilder`** (`vision/services/pdf_builder.py`) consome `PdfReportData` e retorna `bytes` (PDF binário). Geração falha → HTTP 500.

**Response:** `application/pdf` com `Content-Disposition: attachment; filename=relatorio_analise_{report_id[:8]}.pdf`

---

## Compare (`reports/compare.py`)

Usado por `POST /vision/compare` e `POST /api/compare`.

### `compare_json(run_id_before, run_id_after) → dict`

Lê `*_mvp_report.json` de cada run em `resultado_api_dir/{run_id}/` e compara 13 métricas:

**`COMPARE_KEYS` (13 métricas):**
`overall_asymmetry_score_pct_ipd`, `eye_level_difference_pct_ipd`, `eye_horizontal_asymmetry_pct_ipd`, `nose_deviation_pct_ipd`, `mouth_deviation_pct_ipd`, `chin_deviation_pct_ipd`, `fwhr`, `canthal_tilt_mean_deg`, `lower_third_ratio`, `jawline_definition_score`, `marquardt_deviation_pct_ipd`, `under_eye_darkness_left`, `under_eye_darkness_right`

**`HIGHER_IS_BETTER`:** `jawline_definition_score`, `canthal_tilt_mean_deg` — delta invertido (melhora = aumento).

**Response shape:**
```json
{
  "score_before": 72,
  "score_after": 81,
  "score_delta": 9,
  "tier_before": "Bronze",
  "tier_after": "Silver",
  "metrics": [
    {
      "key": "overall_asymmetry_score_pct_ipd",
      "label": "Assimetria geral",
      "before": 2.4,
      "after": 1.8,
      "delta": 0.6,
      "improved": true
    }
  ],
  "improved_count": 8,
  "worsened_count": 3,
  "top_improvements": [...],
  "top_regressions": [...]
}
```

`POST /vision/compare` adiciona ao shape acima: `consistency_score`, `consistency_issues`, `is_comparable`, `baseline_group_id_before`, `baseline_group_id_after`.
