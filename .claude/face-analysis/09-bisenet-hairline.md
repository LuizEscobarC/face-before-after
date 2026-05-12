# 09 — BiSeNet Hairline Integration

> Implementado: **2026-05-12** · Refinado: **2026-05-12** (threshold 0.8→0.5, scan direction, canonical storage, overlay annotations JSON)
> Objetivo: substituir `lm[10]` (P_FOREHEAD_CROWN) como proxy de hairline pelo trichion virtual derivado do modelo BiSeNet face-parsing (ONNX, hair class=17, CelebAMask-HQ).

---

## Motivação

`lm[10]` (P_FOREHEAD_CROWN) é o landmark mais alto do mesh MediaPipe na fronte, mas representa o início do cabelo **estimado geometricamente**, não o verdadeiro hairline anatômico. Em fotografias onde o cabelo recua (ex: Brad Pitt), `lm[10]` fica muito acima do hairline real, produzindo `upper_third_ratio ≈ 0.20` em vez dos esperados `0.30–0.36`.

A integração BiSeNet:
- Detecta pixels de cabelo (class 17 do modelo CelebAMask-HQ 19 classes).
- Extrai a linha mais superior do cabelo (trichion virtual) por coluna de pixel.
- Converte para coordenadas ICU (intercanthal units).
- Injeta em `QualityContext.virtual_landmarks` para uso por `thirds.py`.
- Fallback silencioso para `lm[10]` se o modelo falha ou confidence < 0.8.

---

## Arquitetura — Novos Módulos

### `backend/app/services/segmentation/bisenet_segmenter.py`

- `_get_session() -> ort.InferenceSession`: singleton ORT session, CPU-only.
- `_preprocess(image_bgr) -> np.ndarray`: BGR→RGB, resize 512×512, ImageNet norm, NCHW float32.
- `_postprocess(raw_output, orig_h, orig_w) -> dict`: argmax → hair_mask bool, label_map int32, upsample para tamanho original.
- `BiSeNetSegmenter.segment(image_bgr) -> dict`: orquestra preprocess+run+postprocess, retorna `{hair_mask, face_mask, raw_label_map, elapsed_ms}`.
- `get_segmenter() -> BiSeNetSegmenter`: factory singleton.
- Modelo buscado em: `models/bisenet_face_parsing.onnx` (caminhos múltiplos relativos ao arquivo).
- Hair class = **17**; providers = `["CPUExecutionProvider"]`.

### `backend/app/services/landmarks/virtual_landmarks.py`

- `extract_hairline_points(hair_mask: np.ndarray, face_landmarks_px: np.ndarray) -> dict`
  - Horizontal band: do eixo X de `P_LEFT_EYE_OUTER` ao `P_RIGHT_EYE_OUTER`.
  - Per-column: topmost hair pixel (ou NaN se ausente).
  - Suavização: Savitzky-Golay (window=21, polyorder=3).
  - Confidence composta: `base_conf × regularity × distance_penalty`.
  - Retorna: `trichion, hairline_left, hairline_center, hairline_right, forehead_top_estimate, temple_left, temple_right, confidence, column_y`.
  - Fallback `_empty_result()` quando `valid_frac < 0.10` → confidence=0.

### `backend/app/services/landmarks/fusion_layer.py`

- `TRICHION_CONFIDENCE_THRESHOLD = 0.8`
- `@dataclass FusedLandmarks`: `face_landmarks, virtual_landmarks, trichion_source, trichion_confidence, trichion_y_icu, segmentation`.
- `_pixel_to_icu(point_px, mp_landmarks_px) -> (float, float)`: center no midpoint inner-canthi, divide por ICD, aplica roll correction.
- `fuse(image_bgr, mp_landmarks_px) -> FusedLandmarks`: sempre retorna (nunca propaga exceção).
  - `trichion_source = "bisenet"` se confidence ≥ threshold.
  - `trichion_source = "mesh"` em fallback (lm[P_FOREHEAD_CROWN]).
- `_mesh_fallback(mp_landmarks_px) -> FusedLandmarks`: trichion_confidence=0.0, trichion_y_icu derivado de lm[10].

---

## Alterações em Módulos Existentes

### `backend/app/services/metrics/base.py`

`QualityContext` ganhou campo opcional:
```python
virtual_landmarks: dict[str, Any] | None = None
# Keys: trichion_y_icu (float), trichion_confidence (float), trichion_source (str)
```

### `backend/app/services/metrics/thirds.py`

- Imports `effective_trichion_y`, `trichion_confidence_multiplier`, `TRICHION_CONFIDENCE_THRESHOLD` from `_trichion.py` (see below).
- All 4 calculators (`upper`, `middle`, `lower`, `dominant`) pass `trichion_y_override` to `_thirds_geometry()` to maintain invariant `upper + middle + lower = 1.0`.
- `UpperThirdRatioCalculator.compute()`: applies `conf_final *= trichion_confidence_multiplier(ctx)`.

### `backend/app/services/metrics/_trichion.py` ← NEW (2026-05-12 follow-up)

Single source of truth for trichion override logic, used by **all 9** hairline-dependent calculators:

```python
TRICHION_CONFIDENCE_THRESHOLD: float = 0.8  # matches fusion_layer constant

def effective_trichion_y(lm, ctx) -> float: ...
    # Returns BiSeNet y_icu if confidence >= threshold, else lm[P_FOREHEAD_CROWN][1]

def trichion_confidence_multiplier(ctx) -> float: ...
    # Returns trichion_confidence when source=bisenet+active, else 1.0
```

Previously, `thirds.py` had local `_get_trichion_y` and `_trichion_confidence_factor` with hardcoded literal `0.8`. These were deleted; `thirds.py` now imports from `_trichion.py`.

---

## Affected Metrics — Full List

The following 9 metrics depend on the hairline y-coordinate. All use `effective_trichion_y(lm, ctx)` from `_trichion.py` and apply `trichion_confidence_multiplier(ctx)` to their `confidence_final`.

**Justification:** Farkas (1994), Martin–Saller, and Phi/Marquardt ideal constants were all calibrated against the **anatomical trichion** (dermatological hairline). MediaPipe `lm[10]` (P_FOREHEAD_CROWN) is the topmost mesh vertex, not the anatomical hairline — it sits above the actual hairline in subjects with visible foreheads, causing systematic overestimation of forehead-related measurements. Patching to BiSeNet trichion is a **correction** toward the original anthropometric reference, NOT a recalibration of the ideals.

| Metric ID | File | Family | Effect of higher trichion |
|-----------|------|--------|--------------------------|
| `upper_third_ratio` | `thirds.py` | thirds | increases |
| `middle_third_ratio` | `thirds.py` | thirds | decreases (denominator grows) |
| `lower_third_ratio` | `thirds.py` | thirds | decreases (denominator grows) |
| `dominant_third` | `thirds.py` | thirds | shifts toward upper dominance |
| `forehead_height_ratio` | `forehead.py` | forehead | increases (closer to ideal 1.90 ICU) |
| `hairline_curvature_index` | `forehead.py` | forehead | increases (larger sagitta) |
| `chin_projection_proxy` | `wave_c2.py` | jaw | decreases (total_h grows) |
| `face_height_to_width_ratio` | `global_shape.py` | global_shape | increases |
| `face_shape_classification` | `global_shape.py` | global_shape | aspect increases |
| `total_facial_convexity` | `global_shape.py` | global_shape | crown vertex shifts up (minor effect) |
| `facial_index_anthropometric` | `wave_c3.py` | global_shape | increases (face_h grows) |
| `phi_face_height_to_width` | `phi_golden.py` | phi | increases |

**Ideals and severity thresholds: unchanged.** The constants (`_IDEAL_HEIGHT=1.90 ICU`, `_IDEAL_CHIN_PROJ=0.33`, `_IDEAL_FACE_INDEX=87.5`, `_IDEAL_ASPECT=1.35`, `_IDEAL_CURVATURE=0.48`, etc.) remain exactly as calibrated against the anatomical trichion.

### `backend/app/domain/pipeline.py`

- `fuse()` chamado após normalização com `canonical.image` e `canonical.landmarks`.
- Resultado injetado em `QualityContext(virtual_landmarks=_vl_ctx)`.
- Campos adicionados ao resultado: `virtual_landmarks`, `trichion_source`, `trichion_confidence`.

### `frontend/src/components/OverlayLayer.tsx`

- `OverlayLayerProps.trichion_source?: "bisenet" | "mesh"` adicionado.
- `FaceExtents` agora recebe `trichion_source` e exibe label dinâmico: `"Trichion (BiSeNet)"` ou `"Trichion (mesh)"`.

---

## Dockerfile (`Dockerfile.api`)

```dockerfile
RUN curl -fsSL \
    "https://github.com/yakhyo/face-parsing/releases/download/v0.0.1/bisenet_resnet18.onnx" \
    -o /app/backend/models/bisenet_face_parsing.onnx \
    || echo "WARNING: BiSeNet ONNX download failed — fallback mesh trichion will be used at runtime"
```

Se URL 404r: substituir pela URL do mirror e rebuildar. Fallback automático em runtime, sem crash.

---

## Testes

| Arquivo | Testes | Cobre |
|---------|--------|-------|
| `tests/services/segmentation/test_bisenet_segmenter.py` | 6 | Shape, hair_mask all-True (class 17), label range, elapsed, RuntimeError, ImportError |
| `tests/services/landmarks/test_virtual_landmarks.py` | 6 | Trichion position, confidence alta/baixa/zero, keys, trichion [x,y] |
| `tests/services/landmarks/test_fusion_layer.py` | 7 | Fallback RuntimeError/ImportError, FusedLandmarks schema, _mesh_fallback, _pixel_to_icu |
| `tests/services/metrics/test_thirds_with_bisenet.py` | 7 | Fallback idêntico ao baseline, upper aumenta com trichion mais alto, ratios somam 1.0, conf *= trichion_confidence, não-thirds inalterados |
| `tests/services/metrics/test_hairline_metrics_with_bisenet.py` | 39 | Os 8 metrics adicionais: fallback=baseline, shift de direção correto, conf *= trichion_confidence |

Total: **65 testes de hairline** — todos passando. 1 falha pré-existente (`test_marquardt_zero_for_symmetric_face`) não relacionada.

---

## Coordenadas ICU — Referência

- Origem: midpoint dos inner canthi (P_LEFT_EYE_INNER / P_RIGHT_EYE_INNER).
- Escala: 1 ICU = ICD (distância intercantal em pixels).
- Eixo Y: **cresce para baixo** (padrão imagem); trichion acima dos olhos → y_icu < 0.
- `upper_third_ratio` aumenta quando `trichion_y_icu` fica mais negativo (hairline mais alto).

---

## Invariante de Ratios

```
upper_third_ratio + middle_third_ratio + lower_third_ratio = 1.0
```

Mantido porque todos os 3 calculadores usam o mesmo `trichion_y_override`.

---

## Garantias de Fallback

1. `onnxruntime` não instalado → `ImportError` → `_mesh_fallback()` → `trichion_source = "mesh"`.
2. Modelo ONNX não encontrado → `RuntimeError` → `_mesh_fallback()`.
3. `confidence < TRICHION_CONFIDENCE_THRESHOLD (0.8)` → `_mesh_fallback()`.
4. Qualquer exceção em `_run_bisenet_fusion()` → `_mesh_fallback()`, warning log.
5. Nunca propaga exceção ao caller; nunca retorna HTTP 500.
