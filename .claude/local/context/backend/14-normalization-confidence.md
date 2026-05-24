---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/normalization-confidence"
file_path: ".claude/local/context/backend/14-normalization-confidence.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Dois subsistemas de pré-processamento de métricas: (1) normalization pipeline
  em services/normalization/ — 3 etapas sequenciais (pose_correction → intercanthal_scaler →
  midline_aligner) que produz NormalizedLandmarks com basis="intercanthal";
  (2) confidence propagation em services/metrics/confidence_propagation.py —
  pipeline multiplicativo de 4 etapas (quality × regional × pose × stability)
  com PosePenaltyParams por família de métricas (SYMMETRY, THIRDS, JAW, etc).
tags:
  - "backend"
  - "normalization"
  - "confidence"
  - "metrics"
rag_keywords:
  - "normalize() intercanthal_scaler midline_aligner pose_correction NormalizedLandmarks"
  - "NormalizedLandmarks basis intercanthal_distance_px pose_correction_applied"
  - "propagate() confidence_raw quality_score regional_penalty pose_penalty stability"
  - "PosePenaltyParams yaw_soft_deg yaw_hard_deg pitch_soft_deg pitch_hard_deg floor"
  - "SYMMETRY_POSE_PARAMS THIRDS_POSE_PARAMS FIFTHS_POSE_PARAMS JAW_POSE_PARAMS"
  - "EYES_POSE_PARAMS NOSE_POSE_PARAMS MOUTH_POSE_PARAMS BROW_POSE_PARAMS"
  - "CHEEKBONE_POSE_PARAMS FOREHEAD_POSE_PARAMS GLOBAL_SHAPE_POSE_PARAMS PHI_POSE_PARAMS"
  - "landmark_stability_penalty PR-23 multi-capture stability_scores dependency_landmarks"
  - "LOW_CONF_THRESHOLD 0.4 confidence_final"
  - "scale_to_intercanthal align_to_horizontal apply_pose_correction"
related_modules:
  - "backend/pipeline"
  - "backend/vision-primitives"
depends_on:
  - "backend/architecture"
used_by:
  - "backend/pipeline"
---

# Backend — Normalização e Propagação de Confiança

> **Última atualização:** 2026-05-24

---

## 1. Normalization Pipeline

**Pacote:** `backend/app/services/normalization/`  
**Entry point:** `normalize(landmarks, yaw_deg, pitch_deg, image_size) → NormalizedLandmarks`  
**Arquivo:** `normalization/normalizer.py:30`

### Etapas sequenciais

```
landmarks (N×2 ou N×3 pixels)
  → apply_pose_correction(pts, yaw_deg, pitch_deg)     # etapa 1
  → scale_to_intercanthal(corrected)                   # etapa 2
  → align_to_horizontal(scaled)                        # etapa 3
  → NormalizedLandmarks
```

| Etapa | Arquivo | Função | Descrição |
|---|---|---|---|
| 1 | `pose_correction.py` | `apply_pose_correction()` | Compensa foreshortening de yaw/pitch; pulado dentro de dead zone |
| 2 | `intercanthal_scaler.py` | `scale_to_intercanthal()` | Centraliza no midpoint inter-cantal + escala em ICU (Intercanthal Unit) |
| 3 | `midline_aligner.py` | `align_to_horizontal()` | Rotaciona para alinhar eixo inter-ocular horizontalmente (corrige roll) |

### NormalizedLandmarks (`domain/normalized_landmarks.py`)

Dataclass imutável produzida pelo `normalize()`:
- `points: np.ndarray` — shape `(N, 3)` em ICU (intercanthal units)
- `basis: str = "intercanthal"` — sempre `"intercanthal"` nessa pipeline
- `intercanthal_distance_px: float` — ICD em pixels antes da escala
- `pose_correction_applied: bool`
- `midline_aligned: bool = True`
- `source_image_size: tuple[int,int] | None`

**Invariante:** todas as métricas do registry consomem `NormalizedLandmarks` — nunca landmarks brutos.

---

## 2. Confidence Propagation Pipeline

**Arquivo:** `backend/app/services/metrics/confidence_propagation.py`  
**Entry point:** `propagate(...) → float`

### Fórmula multiplicativa (4 etapas)

```
confidence_final = confidence_raw
                   × quality_score           # gate global de qualidade da imagem
                   × regional_penalty_factor # oclusão/qualidade por região
                   × pose_penalty_factor     # yaw/pitch ponderados por família
                   × landmark_stability      # PR-23: só multi-capture
```
Resultado clipado em `[0, 1]`.  
Métricas com `confidence_final < 0.4` (`LOW_CONF_THRESHOLD`) são flagadas como baixa confiança.

### PosePenaltyParams

```python
@dataclass(frozen=True)
class PosePenaltyParams:
    yaw_soft_deg: float = 5.0   # sem penalidade até aqui
    yaw_hard_deg: float = 15.0  # penalidade máxima acima daqui
    pitch_soft_deg: float = 5.0
    pitch_hard_deg: float = 15.0
    floor: float = 0.2          # multiplicador mínimo (hard threshold)
    yaw_weight: float = 0.7
    pitch_weight: float = 0.3   # yaw_weight + pitch_weight = 1.0
```

Penalidade combinada = média geométrica ponderada: `P_yaw^w_yaw × P_pitch^w_pitch`.

### Parâmetros por família de métricas

| Constante | Yaw soft/hard | Pitch soft/hard | floor | yaw_w/pitch_w |
|---|---|---|---|---|
| `SYMMETRY_POSE_PARAMS` | 5/15° | 8/20° | 0.2 | 0.8/0.2 |
| `THIRDS_POSE_PARAMS` | 8/20° | 5/12° | 0.2 | 0.4/0.6 |
| `FIFTHS_POSE_PARAMS` | 5/12° | 8/20° | 0.2 | 0.9/0.1 |
| `EYES_POSE_PARAMS` | 5/15° | 5/15° | 0.2 | 0.6/0.4 |
| `JAW_POSE_PARAMS` | 4/12° | 6/18° | 0.15 | 0.8/0.2 |
| `NOSE_POSE_PARAMS` | 5/15° | 8/20° | 0.18 | 0.7/0.3 |
| `MOUTH_POSE_PARAMS` | 6/16° | 8/20° | 0.18 | 0.6/0.4 |
| `BROW_POSE_PARAMS` | 5/15° | 8/20° | 0.17 | 0.65/0.35 |
| `CHEEKBONE_POSE_PARAMS` | 5/15° | 6/18° | 0.17 | 0.75/0.25 |
| `FOREHEAD_POSE_PARAMS` | 5/15° | 6/16° | 0.17 | 0.60/0.40 |
| `GLOBAL_SHAPE_POSE_PARAMS` | 6/18° | 6/18° | 0.20 | 0.50/0.50 |
| `PHI_POSE_PARAMS` | 8/22° | 7/20° | 0.25 | 0.45/0.55 |

**JAW** tem o `floor` mais restritivo (`0.15`) — landmarks gonion são aproximados.  
**PHI** tem o `floor` mais relaxado (`0.25`) — overlays de apresentação, tolerados sob pose moderada.

### Landmark Stability Penalty (PR-23)

**Função:** `landmark_stability_penalty(stability_scores, dependency_landmarks)`

- Ativo **apenas** em sessões multi-capture (`stability_scores` não é `None`)
- `stability_scores`: lista por landmark de `LandmarkStabilityResult.to_scores_list()`
- Retorna média aritmética dos scores para os `dependency_landmarks` do metric
- Sessão single-capture: retorna `1.0` (sem penalidade — retrocompatibilidade total)
