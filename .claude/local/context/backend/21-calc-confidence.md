---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-confidence"
file_path: ".claude/local/context/backend/21-calc-confidence.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Pipeline de propagação de confiança de métricas em
  `services/metrics/confidence_propagation.py`. Função `propagate()` aplica
  4 multiplicadores em sequência: quality_score, regional_penalty, pose_penalty
  (piecewise-linear por família via PosePenaltyParams), landmark_stability (PR-23,
  multi-capture). LOW_CONF_THRESHOLD=0.4 — abaixo disso MetricValue.is_low_confidence=True.
tags:
  - "backend"
  - "confidence"
  - "metrics"
  - "propagation"
rag_keywords:
  - "propagate confidence_raw quality_score regional_penalty pose_penalty landmark_stability"
  - "LOW_CONF_THRESHOLD 0.4 is_low_confidence MetricValue"
  - "PosePenaltyParams yaw_soft_deg yaw_hard_deg pitch_soft_deg pitch_hard_deg floor"
  - "piecewise linear penalty _axis_penalty soft hard floor"
  - "PR-23 multi-capture jitter landmark_stability_penalty stability_scores"
  - "SYMMETRY_POSE_PARAMS JAW_POSE_PARAMS PHI_POSE_PARAMS GLOBAL_SHAPE_POSE_PARAMS"
  - "confiança propagação penalidade pose região estabilidade landmark"
related_modules:
  - "backend/calc-normalization"
  - "backend/metrics-families"
depends_on:
  - "backend/vision-primitives"
used_by:
  - "backend/pipeline"
  - "backend/metrics-families"
---

# Backend — Cálculo: Propagação de Confiança

> **Última atualização:** 2026-05-24

---

## propagate() — fórmula completa

**Arquivo:** `backend/app/services/metrics/confidence_propagation.py:279`

```python
def propagate(
    confidence_raw: float,
    quality_score: float,
    region: str,
    regional_penalties: dict[str, float],
    yaw_deg: float = 0.0,
    pitch_deg: float = 0.0,
    pose_params: PosePenaltyParams | None = None,
    *,
    stability_scores: list[float] | None = None,
    dependency_landmarks: list[int] | None = None,
) -> float  # confidence_final, clipped [0, 1]
```

**4 etapas multiplicativas:**
```
conf = confidence_raw × quality_score            # step 1: qualidade global
conf ×= regional_penalty_factor(region, ...)    # step 2: oclusão/qualidade regional
conf ×= pose_penalty(yaw_deg, pitch_deg, ...)   # step 3: ângulo de pose
conf ×= landmark_stability_penalty(...)          # step 4: PR-23 (multi-capture só)
```

`LOW_CONF_THRESHOLD = 0.4` — quando `confidence_final < 0.4`, `MetricValue.is_low_confidence = True`.

Steps 1–3 são sempre aplicados. Step 4 só quando `stability_scores is not None` (modo multi-capture PR-23).

---

## PosePenaltyParams — penalidade piecewise linear por família

**Arquivo:** `backend/app/services/metrics/confidence_propagation.py:43`

```python
@dataclass(frozen=True)
class PosePenaltyParams:
    yaw_soft_deg:   float = 5.0   # sem penalidade abaixo deste ângulo
    yaw_hard_deg:   float = 15.0  # penalidade máxima (= floor) acima deste
    pitch_soft_deg: float = 5.0
    pitch_hard_deg: float = 15.0
    floor: float = 0.2            # multiplicador mínimo (não vai a zero)
    yaw_weight:   float = 0.7
    pitch_weight: float = 0.3
```

**Curva `_axis_penalty(angle, soft, hard, floor)`:**
- `|angle| ≤ soft` → `1.0` (sem penalidade)
- `soft < |angle| < hard` → interpolação linear `1.0 → floor`
- `|angle| ≥ hard` → `floor` (plateau)

**`pose_penalty()` combina yaw e pitch como média geométrica ponderada:**
```
P = pen_yaw^yaw_weight × pen_pitch^pitch_weight
```

---

## Params pré-definidos por família

| Família | Constante | yaw_soft/hard | pitch_soft/hard | floor | yaw_w |
|---|---|---|---|---|---|
| symmetry | `SYMMETRY_POSE_PARAMS` | 5/15 | 8/20 | 0.20 | 0.80 |
| thirds | `THIRDS_POSE_PARAMS` | 8/20 | 5/12 | 0.20 | 0.40 |
| fifths | `FIFTHS_POSE_PARAMS` | 5/12 | 8/20 | 0.20 | 0.90 |
| eyes | `EYES_POSE_PARAMS` | 5/15 | 5/15 | 0.20 | 0.60 |
| jaw | `JAW_POSE_PARAMS` | 4/12 | 6/18 | **0.15** | 0.80 |
| nose | `NOSE_POSE_PARAMS` | 5/15 | 8/20 | 0.18 | 0.70 |
| mouth | `MOUTH_POSE_PARAMS` | 6/16 | 8/20 | 0.18 | 0.60 |
| brows | `BROW_POSE_PARAMS` | 5/15 | 8/20 | 0.17 | 0.65 |
| cheekbones | `CHEEKBONE_POSE_PARAMS` | 5/15 | 6/18 | 0.17 | 0.75 |
| forehead | `FOREHEAD_POSE_PARAMS` | 5/15 | 6/16 | 0.17 | 0.60 |
| global_shape | `GLOBAL_SHAPE_POSE_PARAMS` | 6/18 | 6/18 | 0.20 | 0.50 |
| phi | `PHI_POSE_PARAMS` | 8/22 | 7/20 | **0.25** | 0.45 |

**Notas de design:**
- `jaw` tem `floor=0.15` (mais restritivo) — gonion landmarks aproximados no Mesh-478 (`P_LEFT_GONION=58`, `P_RIGHT_GONION=288` marcados como TODO).
- `phi` tem `floor=0.25` (mais relaxado) — métricas `presentation_only`, devem permanecer visíveis em fotos levemente inclinadas.
- `fifths` tem `yaw_weight=0.90` — quintos laterais colapsam com yaw.

---

## regional_penalty_factor (step 2)

**Arquivo:** `confidence_propagation.py:220`

`regional_penalties: dict[str, float]` — mapa `region → fração de penalidade (0–1)` gerado pelo `quality_evaluator` baseado em oclusão/qualidade por região. Um valor de `0.3` reduz `conf` em 30%.

```python
penalty = regional_penalties.get(region, 0.0)  # 0 = sem penalidade
return max(0.0, 1.0 - penalty)
```

---

## landmark_stability_penalty — PR-23 multi-capture (step 4)

**Arquivo:** `confidence_propagation.py:234`

Ativado apenas quando `stability_scores is not None` (pipeline multi-capture). Calcula a média aritmética dos `stability_scores` dos landmarks em `dependency_landmarks`:

```python
# stability_score por landmark: float [0, 1] — jitter normalizado
factor = mean(stability_scores[lm] for lm in dependency_landmarks)
```

Valor próximo de `1.0` = landmarks estáveis entre capturas. Valor próximo de `0.0` = jitter alto → confiança cai.

Quando `dependency_landmarks` não tem overlap com `stability_scores` (índices fora do range), retorna `1.0` (sem penalidade) para compatibilidade retroativa (modo single-capture).
