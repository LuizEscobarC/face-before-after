---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/overlays"
file_path: ".claude/local/context/backend/19-overlays.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Sistema de overlays visuais servido por POST /vision/render e POST /vision/compose-before-ideal.
  render.py suporta 7 overlay_ids: 5 linhas (axis_vertical, axis_intercanthal, grid_thirds,
  grid_fifths, outline_face) e 2 heatmaps (heatmap_asymmetry via PR-37, heatmap_ideal_adherence
  via PR-38). compose.py renderiza canvas side-by-side before/ideal com IdealLandmarkOffset.
  Todos usam multipart/form-data com landmarks_json como pixel coords (N×2).
tags:
  - "backend"
  - "overlays"
  - "render"
  - "compose"
  - "heatmap"
rag_keywords:
  - "POST /vision/render overlay_ids_json SUPPORTED_OVERLAYS multipart"
  - "axis_vertical axis_intercanthal grid_thirds grid_fifths outline_face"
  - "heatmap_asymmetry PR-37 coolwarm alpha 0.55 render_asymmetry_heatmap"
  - "heatmap_ideal_adherence PR-38 region_adherence_json adherence confidence"
  - "render_ideal_adherence_heatmap HeatmapSuppressedError L2 suppression"
  - "POST /vision/compose-before-ideal offsets_json IdealLandmarkOffset dx_icu dy_icu"
  - "show_actual_wireframe show_guide_lines compose_before_ideal"
  - "BeforeIdealComposeError unknown overlay silently ignored L1 suppression"
  - "_OVERLAY_STYLES stroke stroke_width dash cyan indigo"
  - "landmarks_json pixel coords N×2 478 points"
related_modules:
  - "backend/api-vision"
  - "backend/trichion-bisenet"
depends_on:
  - "backend/architecture"
used_by:
  - "backend/api-vision"
---

# Backend — Overlays (render + compose-before-ideal)

> **Última atualização:** 2026-05-24

---

## POST /vision/render — overlay_ids

**Arquivo:** `backend/app/vision/routers/render.py:210`

Request `multipart/form-data`:
- `image: UploadFile` — JPEG/PNG
- `landmarks_json: str` — JSON `[[x, y], ...]` 478 pontos em pixels
- `overlay_ids_json: str` — JSON array de IDs válidos
- `region_adherence_json: str | None` — obrigatório para `heatmap_ideal_adherence`

### Overlays de linha (z=10/20)

Definidos em `_OVERLAY_STYLES` (`render.py:61`):

| overlay_id | Cor | Tipo |
|---|---|---|
| `"axis_vertical"` | `#22d3ee` (cyan) | linha vertical midline com dash |
| `"axis_intercanthal"` | `#22d3ee` (cyan) | linha horizontal inter-cantal |
| `"grid_thirds"` | `#a5b4fc` (indigo claro) | 2 linhas horizontais (terços) |
| `"grid_fifths"` | `#a5b4fc` (indigo claro) | 4 linhas verticais (quintos) |
| `"outline_face"` | `#67e8f9` (cyan brilhante) | contorno do jawline |

Overlay_ids desconhecidos são **silenciosamente ignorados** (L1 suppression — skip quando índice de landmark fora do range).

### Heatmaps (z=30, desenhados antes das linhas)

| overlay_id | PR | Serviço | Alpha padrão | Colormap |
|---|---|---|---|---|
| `"heatmap_asymmetry"` | PR-37 | `render_asymmetry_heatmap()` | 0.55 | coolwarm |
| `"heatmap_ideal_adherence"` | PR-38 | `render_ideal_adherence_heatmap()` | 0.55 | verde→âmbar→vermelho |

**`heatmap_ideal_adherence`** exige `region_adherence_json`:
```json
[{"region": "symmetry", "adherence": 0.72, "confidence": 0.91}, ...]
```

**`HeatmapSuppressedError`** → HTTP 422 com `{"overlay_id": ..., "suppressed": ..., "samples": ...}` (L2 suppression quando heatmap não tem dados suficientes).

---

## POST /vision/compose-before-ideal

**Arquivo:** `backend/app/vision/routers/compose.py:92`

Request `multipart/form-data`:
- `image: UploadFile` — JPEG/PNG
- `landmarks_json: str` — JSON `[[x, y], ...]` len ≥ 478
- `offsets_json: str = "[]"` — JSON array de `IdealLandmarkOffset`:
  ```json
  [{"landmark_index": 10, "dx_icu": 0.0, "dy_icu": -0.15, "metric_id": "forehead_height_ratio"}]
  ```
  Array vazio = renderiza wireframe atual sem proposta de mudança
- `show_actual_wireframe: str = "true"` — exibir wireframe da face real
- `show_guide_lines: str = "true"` — exibir linhas-guia de proporção

**Response:** `StreamingResponse` PNG — canvas side-by-side before/ideal.

**`IdealLandmarkOffset`** (`compose.py:56`):
- `landmark_index: int` — índice MediaPipe 0–477
- `dx_icu: float` — deslocamento horizontal em ICU
- `dy_icu: float` — deslocamento vertical em ICU (positivo = para baixo)
- `metric_id: str | None` — metric_id que gerou o offset (para anotação)

**`BeforeIdealComposeError`** → HTTP 422 com `{"reason": ..., "message": ...}`.

---

## Fluxo típico de uso

```
1. POST /vision/landmarks → LandmarkPayload.landmarks (pixel coords)
2. POST /vision/metrics-v2 → lista de MetricValue com confidence, direction
3. POST /vision/render com overlay_ids=["axis_vertical","grid_thirds"] → PNG overlay
4. POST /vision/compose-before-ideal com offsets calculados → PNG before/ideal
```
