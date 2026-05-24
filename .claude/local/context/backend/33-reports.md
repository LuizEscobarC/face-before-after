---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/reports"
file_path: ".claude/local/context/backend/33-reports.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Camada de relatórios do backend Python: `reports/compare.py` (`compare_json()`,
  13 COMPARE_KEYS, HIGHER_IS_BETTER), `reports/html_builder.py` (`build_html()`, Jinja-free,
  template inline), e `vision/services/pdf_builder.py` (`PdfBuilder.build()`,
  `PdfReportData`, ReportLab). Endpoints: `POST /vision/compare` (retorna delta estruturado
  + consistency_score) e `POST /vision/generate-pdf` (retorna application/pdf).
tags:
  - "backend"
  - "reports"
  - "compare"
  - "pdf"
  - "html"
rag_keywords:
  - "compare_json report_before report_after COMPARE_KEYS HIGHER_IS_BETTER score_delta"
  - "PdfBuilder build PdfReportData FindingData RecommendationData"
  - "html_builder build_html score_color tier_emoji action_card phase_card"
  - "generate_report compare.py html_builder.py pdf_builder.py"
  - "top_improvements top_regressions improved_count worsened_count"
  - "relatório comparação PDF HTML análise facial"
related_modules:
  - "backend/api-vision"
  - "backend/output-layers"
depends_on:
  - "backend/pipeline"
  - "backend/output-layers"
used_by:
  - "backend/api-vision"
---

# Backend — Reports (compare, HTML, PDF)

> **Última atualização:** 2026-05-24

---

## compare_json

**Arquivo:** `backend/app/reports/compare.py:418`

```python
def compare_json(report_before: dict, report_after: dict) -> dict
```

Compara dois relatórios JSON (`*_mvp_report.json`) e retorna delta estruturado.

**13 `COMPARE_KEYS`** (chave → label PT):
```
overall_asymmetry_score_pct_ipd  → "Assimetria geral"
eye_level_difference_pct_ipd     → "Nível dos olhos"
eye_horizontal_asymmetry_pct_ipd → "Eixo horizontal dos olhos"
nose_deviation_pct_ipd           → "Desvio nasal"
mouth_deviation_pct_ipd          → "Desvio labial"
chin_deviation_pct_ipd           → "Desvio do queixo"
fwhr                             → "Largura-altura facial"
canthal_tilt_mean_deg            → "Inclinação canthal"
lower_third_ratio                → "Terço inferior"
jawline_definition_score         → "Definição mandibular"
marquardt_deviation_pct_ipd      → "Desvio Máscara Áurea"
under_eye_darkness_left          → "Olheira esquerda"
under_eye_darkness_right         → "Olheira direita"
```

**`HIGHER_IS_BETTER = {"jawline_definition_score", "canthal_tilt_mean_deg"}`** — delta invertido (positivo = melhorou):
```
normal:  delta = before - after   (menos = melhor)
higher:  delta = after - before   (mais = melhor)
```

**Response shape:**
```json
{
  "score_before": 72, "score_after": 81, "score_delta": 9,
  "tier_before": "Bronze", "tier_after": "Silver",
  "metrics": [{"key": "...", "label": "...", "before": 2.4, "after": 1.8,
               "delta": 0.6, "improved": true}],
  "improved_count": 8, "worsened_count": 3,
  "top_improvements": [...], "top_regressions": [...]
}
```

`POST /vision/compare` adiciona ao shape: `consistency_score`, `consistency_issues`, `is_comparable`, `baseline_group_id_before`, `baseline_group_id_after`.

---

## generate_report (texto/console)

**Arquivo:** `backend/app/reports/compare.py:115`

```python
def generate_report(report_before: dict, report_after: dict, ...) -> str
```

Versão texto ASCII para uso interno / CLI. Usada por `main()` (`compare.py:379`). Não é exposta via REST — o endpoint retorna `compare_json()`.

---

## build_html

**Arquivo:** `backend/app/reports/html_builder.py:70`

```python
def build_html(data: dict) -> str
```

Gera HTML completo do relatório MVP (sem Jinja2 — template inline em Python). Consome o dict de output do pipeline (score, tier, measurements, recommendations, phases).

**Funções auxiliares:**
- `_score_color(score: int) → str` — hex baseado em score 0–100
- `_tier_emoji(tier: str) → str` — emoji por tier
- `_action_icon(rank: int) → str` — ícone de prioridade
- `action_card(a)` — HTML card para cada recomendação
- `phase_card(key, ph)` — HTML card por fase do plano
- `bar_html(label, value, max_val)` — barra de progresso HTML
- `_render_metrics_catalog(catalog)` — tabela de métricas com severidade

**Usado por:** `POST /vision/full-pipeline` (resposta HTML) e geração local de relatórios.

---

## PdfBuilder

**Arquivo:** `backend/app/vision/services/pdf_builder.py:240`

```python
class PdfBuilder:
    def build(self, data: PdfReportData) -> bytes
```

Gera PDF binário via **ReportLab** (sem weasyprint / wkhtmltopdf). `Never writes to disk` — retorna `bytes` puros.

**`PdfReportData` (TypedDict, `pdf_builder.py:67`):**
```python
class PdfReportData(TypedDict):
    report_id: str
    generated_at: str
    global_score: float
    findings: list[FindingData]
    recommendations: list[RecommendationData]
    disclaimer: str
    rendered_asset_urls: list[str]
```

**`FindingData` (`pdf_builder.py:52`):** `metric_id`, `severity_pt`, `text_medium`, `region_pt`, `deviation_normalized`.

**`RecommendationData` (`pdf_builder.py:59`):** `recommendation_id`, `display_text_short_pt`, `requires_professional`, `professional_type`, `category`, `rank`.

**Seções do PDF** (chamadas por `build()`):
1. `_build_cover()` — capa com score + tier
2. `_build_findings()` — lista de findings com severity badge
3. `_build_rendered_assets()` — imagens das URLs (fetched via HTTP)

**Response HTTP** (`POST /vision/generate-pdf`): `Content-Type: application/pdf`, `Content-Disposition: attachment; filename=relatorio_analise_{report_id[:8]}.pdf`. HTTP 500 em falha de geração.

---

## Relação entre os endpoints de relatório

| Endpoint | Arquivo | Output |
|---|---|---|
| `POST /vision/compare` | `vision/routers/compare_router.py` | JSON (compare_json + consistency) |
| `POST /api/compare` | `api/endpoints/compare.py` ⚠️ não montado | JSON (compare_json apenas) |
| `POST /vision/generate-pdf` | `vision/routers/pdf.py` | `application/pdf` bytes |
| `GET /vision/results/{run_id}/original` | `vision/routers/results.py` | HTML (build_html) |
