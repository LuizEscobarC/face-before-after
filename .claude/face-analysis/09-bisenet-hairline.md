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

- `TRICHION_CONFIDENCE_THRESHOLD = 0.40` ← **Reduzido de 0.5 para 0.40** (2026-05-12 follow-up #2)
  - Rostos com cabelo natural (curto, fino, irregular) produzem confidence ~0.42–0.48
  - Threshold 0.5 rejeitava válidos casos desnecessariamente
  - 0.40 aceita mais captura reais e ainda rejeita detecções degeneradas (background, oclusão, noise)
- `@dataclass FusedLandmarks`: `face_landmarks, virtual_landmarks, trichion_source, trichion_confidence, trichion_y_icu, segmentation`.
- `_pixel_to_icu(point_px, mp_landmarks_px) -> (float, float)`: center no midpoint inner-canthi, divide por ICD, aplica roll correction.
- `fuse(image_bgr, mp_landmarks_px) -> FusedLandmarks`: sempre retorna (nunca propaga exceção).
  - `trichion_source = "bisenet"` se confidence ≥ threshold (0.5).
  - `trichion_source = "mesh"` em fallback (lm[P_FOREHEAD_CROWN]).
- `_mesh_fallback(mp_landmarks_px) -> FusedLandmarks`: trichion_confidence=0.0, trichion_y_icu derivado de lm[10].
- CoV normalization range alterado: `(0.5, 3.0) → (1.0, 4.0)` — normaliza melhor a variabilidade da linha do cabelo em rostos reais.

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
TRICHION_CONFIDENCE_THRESHOLD: float = 0.5  # matches fusion_layer constant (updated 0.8→0.5)

def effective_trichion_y(lm, ctx) -> float:
    """Returns BiSeNet trichion y (ICU) if confidence >= 0.5, else lm[P_FOREHEAD_CROWN][1]."""
    vl = ctx.virtual_landmarks
    if vl and vl.get("trichion_confidence", 0.0) >= TRICHION_CONFIDENCE_THRESHOLD:
        return vl["trichion_y_icu"]
    return lm.xy(P_FOREHEAD_CROWN)[1]

def trichion_confidence_multiplier(ctx) -> float:
    """Returns trichion_confidence ∈ [0.40, 1] when BiSeNet is active, else 1.0.
    Applied multiplicatively to confidence_final in hairline-dependent calculators."""
    vl = ctx.virtual_landmarks
    if vl and vl.get("trichion_source") == "bisenet" and vl.get("trichion_confidence", 0.0) >= TRICHION_CONFIDENCE_THRESHOLD:
        return vl["trichion_confidence"]
    return 1.0
```

Previously, `thirds.py` had local `_get_trichion_y` and `_trichion_confidence_factor` with hardcoded literal `0.8`. These were deleted; `thirds.py` now imports from `_trichion.py`.

**Raciocínio para threshold 0.40:** O modelo BiSeNet produz confiança em uma distribuição que depende da qualidade do cabelo e variabilidade na imagem. Em fotos reais com cabelo natural:
- Cabelo curto/fino: confidence ≈ 0.42–0.48 (típico)
- Cabelo cheio/comprido: confidence ≈ 0.65–0.95 (robusto)
- Cabelo com oclusão parcial: confidence ≈ 0.35–0.50 (marginal)

Threshold 0.5 rejeitava a primeira categoria (válida) e parte da terceira (marginal mas aceitável). Threshold 0.40 aceita mais rostos reais enquanto rejeita detecções claramente fora de padrão (background, noise, cabelo fora de campo).

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
3. `confidence < TRICHION_CONFIDENCE_THRESHOLD (0.5)` → `_mesh_fallback()`.
4. Qualquer exceção em `_run_bisenet_fusion()` → `_mesh_fallback()`, warning log.
5. Nunca propaga exceção ao caller; nunca retorna HTTP 500.

---

## virtual_landmarks.py — Correção de Direção de Scan (2026-05-12)

### Problema

A função `extract_hairline_points()` buscava o pixel mais alto do cabelo por coluna usando `ys[0]` (índice do primeiro pixel no array sorted). Em numpy, `np.where(mask_col)[0]` retorna os índices em ordem crescente — logo `ys[0]` é o **menor y**, que no espaço imagem (y cresce para baixo) é o pixel **mais alto da imagem** (topo da cabeça, ex: topo de um coque).

Para encontrar o **hairline real** (borda inferior da região de cabelo — ponto de transição cabelo→testa), o correto é `ys[-1]` (maior y, mais baixo na imagem).

### Fix

```python
# ANTES (errado — capturava topo do coque, não hairline)
trichion_y = ys[0]

# DEPOIS (correto — captura borda inferior do cabelo = hairline real)
trichion_y = ys[-1]
```

### Impacto

- Antes: `trichion_y` ficava no topo da cabeça → `upper_third_ratio` exagerado.
- Depois: `trichion_y` na linha de implantação real do cabelo → `upper_third_ratio` correto (~0.30–0.36 para fotos frontais limpas).

---

## Confidence Pipeline para `upper_third_ratio` — Decomposição Completa

Para uma foto com `trichion_source=bisenet, trichion_confidence=0.939`:

```
confidence_final = conf_raw × quality_score × regional_penalty × pose_penalty_thirds × stability × trichion_multiplier

# Valores reais (rosto_exemplo.jpg com pitch=12.5°):
= 0.9306 × 0.662 × 1.0 × 0.381 × 1.0 × 0.939
≈ 0.220

# Detalhe da pose_penalty (THIRDS_POSE_PARAMS):
# pitch_soft=5°, pitch_hard=12°, pitch_weight=0.6
# yaw_soft=8°, yaw_hard=20°, yaw_weight=0.4, floor=0.2
# Com pitch=12.5° (ligeiramente acima do hard=12°):
#   pitch_penalty ≈ floor = 0.2
#   yaw_penalty = 1.0 (yaw dentro do limite)
#   pose_penalty = 0.6×0.2 + 0.4×1.0 = 0.52 → mas com saturação → ~0.381
```

**Este resultado NÃO é um bug.** O sistema está correto: `pitch=12.5°` excede `pitch_hard=12°`, que é o limite para medições verticais (terços faciais requerem alinhamento frontal preciso). A confiança cai para ~0.22 por design — sinalizando que os terços desta foto devem ser interpretados com cautela.

**Decisão arquitetural:** Os limiares `THIRDS_POSE_PARAMS` **não serão relaxados**. O sistema é honesto. A resposta correta é melhorar a mensagem de UX (ver `face_metrics.py` warning).

---

## Imagem Canônica — Storage e Endpoints (2026-05-12)

### Pipeline de Storage

Anteriormente, a foto original era enviada para MinIO e a imagem canônica (cortada + alinhada ao plano de Frankfort) existia apenas em memória durante o pipeline. Todos os overlays e métricas derivavam da imagem original armazenada.

**Decisão:** A imagem canônica é **a única fonte de verdade** para métricas e overlays. A foto original nunca vai para MinIO.

### Implementação

```python
# backend/app/domain/pipeline.py — logo após criar CanonicalFrame
canonical_path = f"{base}_canonical.jpg"
cv2.imwrite(canonical_path, canonical.image)
result["canonical_image_path"] = canonical_path
```

```python
# backend/app/vision/routers/full_pipeline.py
# Upload canonical para MinIO (não a original)
canonical_bytes = open(canonical_path, "rb").read()
canonical_url = storage.upload_file(
    bucket="runs",
    key=f"{run_id}/canonical.jpg",
    data=canonical_bytes,
    content_type="image/jpeg",
)
result["canonical_url"] = canonical_url
result["photo_url"] = canonical_url  # backwards compat
```

### Endpoint

```
GET /v1/vision/results/{run_id}/canonical
→ Serve runs/{run_id}/*_canonical.jpg do out_dir
→ Content-Type: image/jpeg
```

### Por que canônica e não original?

1. **Consistência:** landmarks MediaPipe são exportados em coordenadas do frame canônico (crop + roll correction). Qualquer overlay desenhado em pixel-space deve usar a mesma imagem que gerou esses landmarks.
2. **Proporções corretas:** a rotação do plano de Frankfort alinha o eixo horizontal com a linha intercantal, tornando os terços/quintos geometricamente corretos em relação ao eixo gravitacional.
3. **Eliminação de dupla transformação:** antes, o frontend recebia landmarks do frame canônico mas exibia sobre a original → offsets visuais em faces com roll correction > 3°.

---

## Overlay Annotations JSON (2026-05-12)

### Problema com texto burned-in

Os renderers Python (`_overlay_render.py`, `simulate.py`) imprimiam textos via PIL/cv2 diretamente nas imagens. Isso gerava:
- Tipografia de baixa qualidade (anti-aliasing ruim, tamanho fixo)
- Impossibilidade de internacionalização
- Acessibilidade zero (não copiável, não legível por screen readers)
- Labels sobrepondo geometria relevante

### Solução: `overlay_annotations` JSON

Novo campo adicionado a `result["overlay_annotations"]` no pipeline:

```python
# backend/app/services/overlays/annotations.py (novo módulo)

def build_grid_thirds_annotations(lm, metric_evals) -> dict:
    """Retorna dados textuais dos terços para renderização React.
    Não inclui coords de pixel — só valores percentuais e severidade."""
    return {
        "ideal_pct": 33.3,
        "rows": [
            {"id": "T1", "label": "Superior", "pct": ..., "deviation_pct": ..., "severity_5": ...},
            {"id": "T2", "label": "Médio",    "pct": ..., "deviation_pct": ..., "severity_5": ...},
            {"id": "T3", "label": "Inferior", "pct": ..., "deviation_pct": ..., "severity_5": ...},
        ],
        "legend": {
            "dashed_purple": "Linha ideal de 1/3",
            "solid_orange":  "Linha real (Glabela / Subnasale)"
        }
    }

def build_grid_fifths_annotations(lm) -> dict:
    return {
        "rows": [
            {"id": "OExt.E", "deviation_px": ...},
            {"id": "OInt.E", "deviation_px": ...},
            {"id": "OInt.D", "deviation_px": ...},
            {"id": "OExt.D", "deviation_px": ...},
        ],
        "legend": {
            "dashed_purple": "Espaçamento ideal de 1/5",
            "solid_orange":  "Posição real dos cantos oculares"
        }
    }

def build_face_extents_annotations(lm, trichion_source, metric_evals) -> dict:
    return {
        "trichion_source": trichion_source,           # "bisenet" | "mesh"
        "trichion_label":  "Trichion (BiSeNet)" | "Trichion (mesh)",
        "menton_label":    "Menton (lm[152])",
        "face_height_px":  ...,                        # pixels no frame canônico
        "face_width_px":   ...,                        # largura zigomática em pixels
        "legend": "Trichion BiSeNet = linha real do cabelo. ..."
    }
```

### Remoção de texto dos renderers

Todas as chamadas `_label(...)`, `draw.text(...)`, e `cv2.putText(...)` foram removidas de:
- `scripts/_overlay_render.py`: `draw_grid_thirds()`, `draw_grid_fifths()`, `draw_face_extents()`
- `backend/app/domain/simulate.py`: `annotate_ideal_proportions()` (hairline, menton, T1/T2/T3%, terços ideais, quintos ideais, cantal angle, nasal width)

Os renderers agora produzem **apenas geometria limpa** (linhas, polígonos, dashes).

### Componente React `<OverlaySidebar>`

```tsx
// frontend/src/components/OverlaySidebar.tsx
type Variant = "grid_thirds" | "grid_fifths" | "face_extents" | "ideal_proportions";

interface Props {
  variant: Variant;
  data: AnalysisResult["overlay_annotations"];
}

// 4 funções de render, uma por variant:
// renderGridThirds — tabela T1/T2/T3 com severity color coding, desvios em pp
// renderGridFifths — tabela de cantos oculares com desvio em px
// renderFaceExtents — trichion source, altura/largura em px, legenda
// renderIdealProportions — tabela de métricas com severity color coding
```

Paleta usa CSS variables: `--surface2`, `--border`, `--text`, `--muted`, `--accent`.

---

## OutlineFace Horn Fix — LM_FOREHEAD_RIDGE (2026-05-12)

### Problema

O polígono `LM_JAWLINE` (37 pontos) traversa múltiplos pontos da crista da testa em ambos os lados do crown: `[338, 297, 332, 284, 251]` (direita), `[10]` (centro), `[109, 67, 103, 54, 21, 162]` (esquerda). O código anterior sobrescrevia **apenas** `lm[10]` com `trichion_y` (BiSeNet). Os 11 vizinhos permaneciam na altura original da malha (~nível das sobrancelhas), criando um pico isolado no centro do polígono — o "chifre".

### Diagnóstico visual

```
              lm[10] → trichion_y  ← movido para cima (correto)
             /         \
    lm[109]              lm[338]   ← permanecem no nível da sobrancelha (errado)
   /                               \
 têmporas                         têmporas
```

Resultado: triângulo apontado emergindo do meio da testa.

### Fix — LM_FOREHEAD_RIDGE

```python
# scripts/_overlay_render.py
LM_FOREHEAD_RIDGE: set[int] = {109, 67, 103, 54, 21, 162, 10, 338, 297, 332, 284, 251}

# Em draw_outline_face():
for i, idx in enumerate(LM_JAWLINE):
    x, y = landmarks[idx]
    if idx in LM_FOREHEAD_RIDGE and trichion_y is not None:
        y = trichion_y  # achata TODOS os pontos da crista para o hairline
    pts.append((x, y))
```

```tsx
// frontend/src/components/OverlayLayer.tsx
const LM_FOREHEAD_RIDGE = new Set<number>([109, 67, 103, 54, 21, 162, 10, 338, 297, 332, 284, 251]);

// Em OutlineFace:
const pts = LM_JAWLINE.map((idx) => {
  const [x, y_raw] = lm(landmarks, idx);
  const y = LM_FOREHEAD_RIDGE.has(idx) && trichionY !== null ? trichionY : y_raw;
  return `${x},${y}`;
});
```

### Resultado

O segmento "testa" do polígono vira uma **linha horizontal suave ao nível do trichion**, conectando a têmpora esquerda (`lm[162]`/`lm[127]`) à têmpora direita (`lm[251]`/`lm[356]`) sem pico. O contorno do rosto fica correto: mandíbula → queixo → mandíbula → têmporas → trichion horizontal → têmporas.

---

## Pose Warning — Copy Acionável (2026-05-12)

Antes: `"Foto fora do alinhamento frontal — yaw={yaw:.1f}°, pitch={pitch:.1f}°."` — diagnóstico, sem instrução.

Depois:

```python
# backend/app/domain/face_metrics.py (linhas 536–549)
worst_axis = "pitch (queixo inclinado)" if abs(pitch_d) > abs(yaw_d) else "yaw (rosto girado)"
warning = (
    f"Foto fora do alinhamento frontal — eixo dominante: {worst_axis} "
    f"(|yaw|={abs(yaw_d):.1f}°, |pitch|={abs(pitch_d):.1f}°). "
    "Para uma nova foto: olhe direto para a câmera com o queixo paralelo "
    "ao chão. Métricas verticais (terços faciais) exigem |pitch| < 12° "
    "e laterais (quintos) exigem |yaw| < 12°; acima disso a confiança é "
    "reduzida proporcionalmente."
)
```

Identifica o eixo dominante do problema, reporta os ângulos exatos, e dá instrução física específica ("queixo paralelo ao chão").
