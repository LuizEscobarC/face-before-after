---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/trichion-bisenet"
file_path: ".claude/local/context/backend/18-trichion-bisenet.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Sistema de detecção do trichion (hairline) via BiSeNet em
  services/landmarks/fusion_layer.py e helper central em
  services/metrics/_trichion.py. FusedLandmarks é o output de fuse() com
  trichion_source (bisenet/mesh), trichion_confidence e trichion_y_icu.
  Threshold TRICHION_CONFIDENCE_THRESHOLD=0.40 — reduzido de 0.50 em
  2026-05-12 para aceitar rostos com cabelo natural (confidence 0.42–0.48).
tags:
  - "backend"
  - "trichion"
  - "bisenet"
  - "landmarks"
rag_keywords:
  - "trichion BiSeNet hairline segmentation fusion_layer FusedLandmarks"
  - "TRICHION_CONFIDENCE_THRESHOLD 0.40 bisenet mesh fallback"
  - "trichion_source bisenet mesh trichion_confidence trichion_y_icu"
  - "effective_trichion_y trichion_confidence_multiplier"
  - "forehead_height_ratio upper_third_ratio trichion override"
  - "P_FOREHEAD_CROWN mesh point 10 geometric fallback"
  - "fuse() FusedLandmarks face_landmarks virtual_landmarks segmentation"
  - "bisenet_segmenter get_segmenter hair_mask"
  - "trichion x-coordinate always from lm P_FOREHEAD_CROWN"
related_modules:
  - "backend/pipeline"
  - "backend/metrics-other-families"
  - "backend/normalization-confidence"
depends_on:
  - "backend/architecture"
used_by:
  - "backend/pipeline"
  - "backend/metrics-other-families"
---

# Backend — Trichion & BiSeNet Fusion

> **Última atualização:** 2026-05-24

---

## Problema que o sistema resolve

MediaPipe Mesh-478 ponto `10` (`P_FOREHEAD_CROWN`) é o vértice mais alto da malha — tipicamente 5–15 mm acima do trichion clínico (hairline anatômica de Farkas 1994). Isso causa superestimação sistemática da altura da testa e desequilíbrio dos terços.

BiSeNet segmenta o cabelo e extrai a linha do cabelo para produzir `trichion_y_icu` correto.

---

## FusedLandmarks (`fusion_layer.py:60`)

Dataclass output de `fuse(image_bgr, mp_landmarks_px)`:

| Campo | Tipo | Descrição |
|---|---|---|
| `face_landmarks` | `np.ndarray (478,3)` | Landmarks MediaPipe em pixel-space (não alterados) |
| `virtual_landmarks` | `dict` | Pontos virtuais derivados — inclui `trichion`, `trichion_confidence`, `trichion_source`, `trichion_y_icu` |
| `trichion_source` | `"bisenet" \| "mesh"` | Fonte do trichion usado |
| `trichion_confidence` | `float` | Confiança 0–1 da segmentação BiSeNet |
| `trichion_y_icu` | `float \| None` | Coordenada Y do trichion em ICU (pronta para NormalizedLandmarks) |
| `segmentation` | `dict` | Output bruto da segmentação (`hair_mask`, etc.) |

---

## `fuse()` (`fusion_layer.py:174`)

```python
def fuse(image_bgr: np.ndarray, mp_landmarks_px: np.ndarray) -> FusedLandmarks | None
```

**Fluxo:**
1. Tenta `_run_bisenet_fusion(image_bgr, mp_landmarks_px)` via `bisenet_segmenter.get_segmenter()`
2. Se `confidence < TRICHION_CONFIDENCE_THRESHOLD` → descarta; cai para fallback
3. Fallback `_mesh_fallback()` → usa `lm[P_FOREHEAD_CROWN]` com `trichion_source="mesh"`, `trichion_confidence=0.0`
4. Retorna `FusedLandmarks`; em caso de exceção, retorna `None` (falha silenciosa)

**`TRICHION_CONFIDENCE_THRESHOLD = 0.40`** (`fusion_layer.py:52`)  
Mantido sincronizado com `_trichion.py:TRICHION_CONFIDENCE_THRESHOLD`.  
Reduzido de 0.50 para 0.40 em 2026-05-12: rostos com cabelo natural curto/irregular produzem confidence 0.42–0.48 — threshold anterior rejeitava casos válidos.

---

## Helper central: `_trichion.py`

**Arquivo:** `backend/app/services/metrics/_trichion.py`

### `effective_trichion_y(lm, ctx) → float`

Retorna `trichion_y` em ICU para uso nos calculators de métricas:
1. Se `ctx.virtual_landmarks["trichion_confidence"] >= 0.40` → usa `trichion_y_icu` do BiSeNet
2. Fallback → usa `lm[P_FOREHEAD_CROWN][1]` (y do ponto 10 da malha)

**Nota:** coordenada X é sempre do ponto `lm[P_FOREHEAD_CROWN]` — BiSeNet produz apenas linha horizontal (y), o x do ponto 10 é proxy confiável para a linha média.

### `trichion_confidence_multiplier(ctx) → float`

Retorna multiplicador para propagar a incerteza do BiSeNet no `confidence_final`:
- Path BiSeNet ativo: retorna `trichion_confidence` (∈ [0.40, 1.0])
- Fallback mesh: retorna `1.0` (sem impacto na confiança existente)

---

## Métricas afetadas pelo trichion

Quando `trichion_source == "bisenet"`, as seguintes métricas usam o ponto corrigido:

- `upper_third_ratio` (`thirds.py`) — trichion→glabella / altura total
- `forehead_height_ratio` (`forehead.py`) — altura da testa em ICU
- `forehead_width_ratio` e `temporal_width_ratio` (indiretamente, via `forehead.py`)

Impacto: sem BiSeNet, `upper_third_ratio` tende a ser artificialmente alto (testa parece maior).

---

## Pipeline de consumo

```
pipeline.run()
  → _fuse_landmarks(canonical.image, canonical.landmarks)
  → FusedLandmarks.trichion_y_icu
  → simulate_before_after(trichion_y_override=...)   # simulação usa trichion correto
  → MetricsV2Request.quality_context.virtual_landmarks  # métricas usam via ctx
```
