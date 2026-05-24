---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/pipeline"
file_path: ".claude/local/context/backend/12-pipeline.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Orquestração do pipeline principal em backend/app/domain/pipeline.py (1532 linhas).
  Função run() executa 8 etapas sequenciais: load → crop 3x4 → align Frankfort →
  CanonicalFrame → métricas avançadas → scores/insights → simulação before/after →
  relatório JSON+TXT+JPG. Modos teaser e premium diferem em simulação, evolution_path
  e metrics_catalog.
tags:
  - "backend"
  - "pipeline"
  - "orchestration"
  - "canonical-frame"
rag_keywords:
  - "run() pipeline teaser premium mode"
  - "CanonicalFrame ipd_px face_rect aligned landmarks"
  - "asymmetry_to_score overall_asymmetry_score_pct_ipd"
  - "FaceAsymmetryAnalyzer detect_face detect_landmarks align_face"
  - "maybe_auto_crop_3x4 Frankfort rotation_matrix"
  - "simulate_before_after trichion_y_override BiSeNet"
  - "build_shareable_report premium_metrics_catalog"
  - "capture_confidence photo_quality_metrics"
  - "score tier_label tier_description"
  - "fuse_landmarks fusion_layer trichion_source bisenet"
related_modules:
  - "backend/api-vision"
depends_on:
  - "backend/architecture"
used_by:
  - "backend/api-vision"
---

# Backend — Pipeline de Análise (domain/pipeline.py)

> **Última atualização:** 2026-05-24
> **Arquivo:** `backend/app/domain/pipeline.py` (1532 linhas)

## Ponto de entrada: `run()`

```python
def run(image_path: str, output_dir: str, mode: str = "premium") -> dict
```

**Arquivo:** `pipeline.py:1021`

Modos válidos: `"teaser"` (análise parcial, sem simulação) e `"premium"` (análise completa).
Retorna um `dict` com o payload completo — usado diretamente por `POST /vision/full-pipeline`.

---

## Etapas do pipeline

### Etapa 1 — Carregar imagem

`cv2.imread(resolved_image_path)` — falha com `sys.exit(1)` se nenhuma face detectada.

`resolve_input_image_path()` (`pipeline.py:154`) resolve paths relativos e valida extensão.

---

### Etapa 2 — Canonical Frame (crop + align)

**`maybe_auto_crop_3x4()`** (`pipeline.py:201`) — recorta proporção 3:4 usando landmarks como guia; grava metadados em `auto_crop_data`.

**`FaceAsymmetryAnalyzer.align_face()`** — rotaciona para alinhar no plano de Frankfort (linha interpupilar horizontal). Gera `rotation_matrix` + `aligned_landmarks`.

**`CanonicalFrame`** (`domain/canonical_frame.py`) — dataclass imutável:
- `image: np.ndarray` — imagem alinhada (fonte única para todos os módulos downstream)
- `landmarks: np.ndarray` — 468 pontos no espaço alinhado
- `ipd_px: float` — distância interpupilar em pixels (unidade de normalização)
- `face_rect: tuple[int,int,int,int]` — bbox `(x,y,w,h)` no espaço alinhado
- `source_path: str`, `crop_metadata: dict`

Imagem canônica persistida: `output_dir/{basename}_canonical.jpg`.

---

### Etapa 3 — Métricas avançadas

**`fm.compute_all()`** (`domain/face_metrics.py`) — retorna bundle com 3 sub-dicts:
- `bundle["advanced"]` — métricas geométricas (assimetria, ratios, ângulos)
- `bundle["skin"]` — skin analysis (IPP, darkness, texture)
- `bundle["photo_quality"]` — nitidez, pose, iluminação

Merge flat em `measurements` para alimentar módulos de produto.

**`_compute_metrics_v2()`** (pipeline chamado separadamente pela API `metrics-v2`) — 93 métricas via `@register` em `services/metrics/`. Este caminho é para `POST /vision/metrics-v2`; o `run()` usa `fm.compute_all()` para o bundle interno.

---

### Etapa 4 — Score e tier

**`asymmetry_to_score(overall_asymmetry_score_pct_ipd)`** (`pipeline.py:469`):
- Input: `overall_asymmetry_score_pct_ipd` — assimetria média em % do IPD
- Output: score 0–100 (quanto menor a assimetria, maior o score)

**`get_score_tier(score)`** (`pipeline.py:482`) → `(tier_label, tier_description)`:
- tiers definidos internamente (Bronze, Silver, Gold, Platinum — ver código)

---

### Etapa 5 — Módulos de produto

Executados sobre `measurements` (merge flat das métricas):

| Função | Arquivo | Modo |
|---|---|---|
| `build_first_impression()` | `layers/impression.py` | teaser + premium |
| `get_top_leverage_recommendation()` | `layers/top_leverage.py` | teaser + premium |
| `build_visual_status()` | `layers/visual_status.py` | premium |
| `get_top3_actions()` | `layers/top_leverage.py` | premium |
| `build_evolution_path()` | `layers/evolution_path.py` | premium |
| `rec.recommend()` | `layers/recommendations.py` | premium |

**SPF injection** (`pipeline.py:1160`): quando `evolution.skin_alert` está ativo, `"SPF 30+ diariamente"` é injetado como rank 1 nas `top3_actions`.

---

### Etapa 6 — Trichion via BiSeNet (pré-simulação)

**`_fuse_landmarks(canonical.image, canonical.landmarks)`** (`services/landmarks/fusion_layer.py`) — detecta hairline com BiSeNet segmentation para corrigir o ponto anatômico `trichion` (por padrão landmark `[10]`).

Se `fused.trichion_source == "bisenet"`, extrai `_trichion_y_px_for_sim` para uso na simulação.

---

### Etapa 7 — Simulação before/after (premium)

**`simulate_before_after(frame, output_dir, trichion_y_override)`** (`domain/simulate.py`) — gera 3 imagens no `output_dir`:
- `*_symmetrized.jpg` — face espelhada no eixo de simetria
- `*_ideal_proportions.jpg` — proporções ajustadas para ideal
- `*_comparison_grid.jpg` — grid comparativo

Falha silenciosa: `simulation_error` captura exceção sem propagar.

---

### Etapa 8 — Relatório e persist

**`build_shareable_report()`** (`pipeline.py:710`) — monta o dict final. Persiste:
- `output_dir/{basename}_mvp_report.json`
- `output_dir/{basename}_mvp_report.txt`
- `output_dir/{basename}_mvp_annotated.jpg`

---

## Diferença teaser vs premium

| Componente | teaser | premium |
|---|---|---|
| `build_visual_status()` | ❌ | ✅ |
| `get_top3_actions()` | ❌ | ✅ |
| `build_evolution_path()` | ❌ | ✅ |
| `rec.recommend()` | ❌ | ✅ |
| `simulate_before_after()` | ❌ | ✅ |
| `premium_metrics_catalog` | ❌ | ✅ |
| `next_step` | upgrade CTA | análise completa |

---

## Funções utilitárias relevantes

| Função | Linha | Descrição |
|---|---|---|
| `asymmetry_to_score()` | 469 | `overall_asymmetry_score_pct_ipd` → score 0-100 |
| `get_score_tier()` | 482 | score → `(tier_label, tier_description)` |
| `compute_capture_confidence()` | 515 | `photo_quality_metrics` → float 0-1 |
| `build_capture_recommendations()` | 541 | `photo_quality_metrics` → list de dicas |
| `get_top_insights()` | 489 | `measurements` → top N insights ponderados por `METRIC_WEIGHTS` |
| `build_premium_metrics_catalog()` | 330 | monta catálogo de métricas para UI premium |
| `maybe_auto_crop_3x4()` | 201 | crop proporcional + metadados |
| `resolve_input_image_path()` | 154 | resolve e valida path da imagem |

---

## METRIC_WEIGHTS (ponderação para insight principal)

```python
METRIC_WEIGHTS = {
    'nose_deviation_px':           2.0,  # maior peso
    'chin_deviation_px':           1.5,
    'mouth_center_deviation_px':   1.5,
    'jawline_mean_asymmetry_px':   1.2,
    'eye_level_difference_px':     1.0,
    'eye_horizontal_asymmetry_px': 1.0,
    'mouth_corners_asymmetry_px':  1.0,
    'nose_wings_asymmetry_px':     0.8,
}
```
