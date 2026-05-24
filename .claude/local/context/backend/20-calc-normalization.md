---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-normalization"
file_path: ".claude/local/context/backend/20-calc-normalization.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Pipeline de normalização de landmarks para ICU (Intercanthal Unit):
  3 etapas puras em `services/normalization/` — pose_correction (1/cos foreshortening),
  intercanthal_scaler (origem no midpoint dos canthi internos, ICD=1.0),
  midline_aligner (roll correction). Entry point `normalize()` retorna
  `NormalizedLandmarks` imutável usado por todos os calculators de métricas.
tags:
  - "backend"
  - "normalization"
  - "ICU"
  - "landmarks"
rag_keywords:
  - "ICU intercanthal unit normalize NormalizedLandmarks"
  - "pose_correction foreshortening 1/cos yaw pitch"
  - "intercanthal_scaler P_LEFT_EYE_INNER P_RIGHT_EYE_INNER scale_to_intercanthal"
  - "midline_aligner align_to_horizontal roll correction"
  - "dead zone _DEAD_ZONE_DEG _MAX_AMPLIFICATION"
  - "basis intercanthal intercanthal_distance_px pose_correction_applied"
  - "normalização landmarks marcos faciais coordenadas normalizadas"
related_modules:
  - "backend/pipeline"
  - "backend/calc-confidence"
depends_on:
  - "backend/vision-primitives"
used_by:
  - "backend/pipeline"
  - "backend/metrics-families"
---

# Backend — Cálculo: Normalização de Landmarks (ICU)

> **Última atualização:** 2026-05-24

---

## normalize() — entry point

**Arquivo:** `backend/app/services/normalization/normalizer.py`

```python
def normalize(
    landmarks: np.ndarray,   # shape (N,2) ou (N,3) — pixel coords brutos do MediaPipe
    *,
    yaw_deg: float = 0.0,
    pitch_deg: float = 0.0,
    image_size: tuple[int, int] | None = None,
) -> NormalizedLandmarks
```

Função pura (sem I/O, sem estado global). Thread-safe. Executa 3 etapas em sequência:

```
landmarks_px (N,3)
    │
    ▼ step 1 — apply_pose_correction(pts, yaw_deg, pitch_deg)
corrected (N,3)
    │
    ▼ step 2 — scale_to_intercanthal(corrected)
scaled (N,3), icd_px: float
    │
    ▼ step 3 — align_to_horizontal(scaled)
aligned (N,3)
    │
    ▼ NormalizedLandmarks(points=aligned, basis="intercanthal", ...)
```

**Raises:** `ValueError` quando `landmarks` tem shape inválido ou `intercanthal_distance_px` é degenerada (canthi colapsados).

---

## step 1 — apply_pose_correction (foreshortening)

**Arquivo:** `backend/app/services/normalization/pose_correction.py`

**Problema:** a câmera em yaw/pitch comprime o rosto via projeção perspectiva. Sem correção, landmarks estão encurtados por `cos(θ)` no eixo afetado.

**Fórmula:**
```
scale_x = min(1 / max(|cos(yaw)|, 1e-6), MAX_AMPLIFICATION)   # yaw → eixo X
scale_y = min(1 / max(|cos(pitch)|, 1e-6), MAX_AMPLIFICATION)  # pitch → eixo Y
```

Constantes:
- `_DEAD_ZONE_DEG = 3.0` — ângulos dentro de ±3° não aplicam correção (ruído)
- `_MAX_AMPLIFICATION = 2.0` — cap: nunca amplifica mais de 2× para evitar artefatos

**Retorno:** `(corrected_landmarks, pose_applied: bool)` — `pose_applied=False` quando ambos yaw e pitch estão dentro do dead zone.

---

## step 2 — scale_to_intercanthal (ICU)

**Arquivo:** `backend/app/services/normalization/intercanthal_scaler.py`

**Landmarks de referência** (de `domain/landmarks_mesh.py`):
- `P_LEFT_EYE_INNER = 133` (dlib 39 — canto interno esquerdo)
- `P_RIGHT_EYE_INNER = 362` (dlib 42 — canto interno direito)

**Operação:**
1. Calcula `origin = (left_inner + right_inner) / 2` — midpoint dos canthi internos
2. Translada todos os landmarks: `pts -= origin`
3. Calcula `icd_px = ||right_inner - left_inner||` (distância euclidiana em pixels)
4. Escala: `pts /= icd_px`

**Resultado:** origem em `(0, 0)` = midpoint intercantal; `icd = 1.0 ICU` por definição. Y aumenta para baixo (convenção de imagem preservada).

**Retorno:** `(scaled_landmarks, icd_px: float)`

---

## step 3 — align_to_horizontal (roll)

**Arquivo:** `backend/app/services/normalization/midline_aligner.py`

Após escala ICU, o segmento intercantal pode ter roll residual (inclinação da cabeça). Esta etapa rotaciona todos os landmarks em torno de `(0,0)` para deixar o eixo intercantal perfeitamente horizontal.

**Fórmula:**
```
roll_deg = atan2(delta_y, delta_x)   # ângulo atual do segmento intercantal
angle_rad = -roll_deg                # rotação inversa
rot = [[cos, -sin], [sin, cos]]
pts[:, :2] = pts[:, :2] @ rot.T     # row-vector convention
```

Constante:
- `_DEAD_ZONE_DEG = 0.5` — roll menor que ±0.5° é ignorado (evita ruído de arredondamento)

**Retorno:** `(aligned_landmarks, roll_corrected_deg: float)`

---

## NormalizedLandmarks — output contract

**Arquivo:** `backend/app/domain/normalized_landmarks.py`

```python
@dataclass(frozen=True)
class NormalizedLandmarks:
    points: np.ndarray              # shape (N, 3) — coordenadas em ICU
    basis: str                      # sempre "intercanthal"
    intercanthal_distance_px: float # ICD em pixels antes da normalização
    pose_correction_applied: bool   # True se yaw ou pitch > dead zone
    midline_aligned: bool           # sempre True após normalize()
    source_image_size: tuple[int,int] | None  # (w, h) para round-trips px↔ICU
```

**Round-trip px ↔ ICU:**
```python
# ICU → pixel
px = (icu_coord * icd_px) + origin_px

# pixel → ICU
icu = (px - origin_px) / icd_px
```

---

## Uso nos calculators de métricas

Todos os `metric_id` calculam a partir de `NormalizedLandmarks.points` — nunca de pixels brutos. O acesso é via `ctx.normalized` dentro de cada `MetricCalculator`:

```python
lm = ctx.normalized.points   # np.ndarray (478, 3) em ICU
icd = ctx.normalized.intercanthal_distance_px  # para métricas em %ICD
```

Métricas `phi_*` e `wave_c2/c3` usam apenas ratios ICU — invariantes à distância câmera-sujeito.
