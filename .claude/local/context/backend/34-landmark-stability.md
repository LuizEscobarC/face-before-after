---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/landmark-stability"
file_path: ".claude/local/context/backend/34-landmark-stability.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  landmark_stability.py implements multi-capture landmark jitter analysis (PR-23).
  compute_stability(frames) accepts a list of (N,2)/(N,3) pixel-space landmark arrays,
  computes per-landmark RMS displacement normalised by ICD, and returns a
  LandmarkStabilityResult with per-landmark scores in [0,1] and averaged_landmarks.
  stability_factor_for_metric() reduces per-landmark scores to a scalar for a metric's
  dependency_landmarks; this scalar is step 4 in the confidence_propagation.propagate() pipeline.
tags:
  - "backend"
  - "landmarks"
  - "stability"
  - "multi-capture"
  - "confidence"
  - "pr-23"
rag_keywords:
  - "LandmarkStabilityResult"
  - "compute_stability"
  - "stability_factor_for_metric"
  - "STABILITY_SLOPE"
  - "global_instability_index"
  - "averaged_landmarks"
  - "to_scores_list"
  - "_estimate_icd_px"
  - "landmark_stability_penalty"
  - "sigma_icu"
  - "capture_count"
  - "icd_px"
  - "scores"
related_modules:
  - "backend/vision-primitives"
  - "backend/calc-confidence"
  - "backend/pipeline"
depends_on:
  - "backend/vision-primitives"
used_by:
  - "backend/calc-confidence"
  - "backend/pipeline"
---

# LandmarkStabilityResult dataclass (landmark_stability.py)

**Source:** `backend/app/services/landmark_stability.py`

```python
@dataclass(frozen=True, slots=True)
class LandmarkStabilityResult:
    scores:                    np.ndarray   # (N,) float64, each ∈ [0, 1]
    global_instability_index:  float        # 1 − mean(scores)
    averaged_landmarks:        np.ndarray   # (N, 3) mean pixel coords across frames
    capture_count:             int          # number of input frames
    icd_px:                    float        # ICD pixels from first frame
```

| Field | Semantics |
|---|---|
| `scores` | Per-landmark stability: 1.0 = perfectly stable, 0.0 = jitter ≥ 0.20 ICD |
| `global_instability_index` | `1 − mean(scores)`; > 0.1 suggests compromised session quality |
| `averaged_landmarks` | Mean position in pixel coords — fed to normalization pipeline instead of single-capture array in multi-capture mode |
| `capture_count` | Number of input frames used |
| `icd_px` | Intercanthal distance from first frame; stored for auditing |

**`to_scores_list()`**: returns `[float(s) for s in self.scores]` — JSON-serialisable;
passed as `QualityContext.landmark_stability_scores` (list of 478 floats for Mesh-478).

---

# compute_stability() — core algorithm (landmark_stability.py)

**Source:** `backend/app/services/landmark_stability.py`

```python
def compute_stability(frames: list[np.ndarray]) -> LandmarkStabilityResult:
```

**Input:** list of arrays, each `(N, 2)` or `(N, 3)` in pixel coords. All frames must
have the same `N`. If shape is `(N, 2)`, a zero z-column is appended before stacking.

**Raises `ValueError`** if `frames` is empty or shapes are inconsistent.

**Algorithm:**

1. **Normalise** all frames to `(N, 3)` float64.
2. **Stack**: `stacked = np.stack(normalised, axis=0)` → `(F, N, 3)`.
3. **Average**: `averaged = stacked.mean(axis=0)` → `(N, 3)`.
4. **Single-frame shortcut**: if `len(frames) == 1`, return `LandmarkStabilityResult`
   with `scores = np.ones(N)`, `global_instability_index = 0.0`. No penalty is possible.
5. **ICD from first frame**: `icd_px = _estimate_icd_px(normalised[0])`. If `< 1.0` (sub-pixel
   degenerate case), return all-ones scores.
6. **Per-landmark variance**:
   ```python
   var_x = stacked[:, :, 0].var(axis=0)  # (N,)
   var_y = stacked[:, :, 1].var(axis=0)  # (N,)
   sigma = np.sqrt((var_x + var_y) / 2.0)   # RMS displacement in px
   sigma_icu = sigma / icd_px               # normalised to ICD units
   ```
7. **Stability scores**:
   ```python
   scores = np.clip(1.0 - STABILITY_SLOPE * sigma_icu, 0.0, 1.0)
   ```
8. **Global instability**: `1.0 − scores.mean()`.

---

# STABILITY_SLOPE constant and score curve (landmark_stability.py)

**Source:** `backend/app/services/landmark_stability.py`

```python
STABILITY_SLOPE: float = 5.0
```

Defines the piecewise-linear curve:
```
stability_i = max(0.0, 1.0 − STABILITY_SLOPE × (sigma_i / icd_px))
```

Key calibration points:

| sigma / ICD | stability score |
|---|---|
| 0.00 | 1.00 (zero jitter) |
| 0.10 | 0.50 |
| ≥ 0.20 | 0.00 (fully unreliable) |

A sigma of 0.10 ICD ≈ 10 px for a 100-px ICD face, corresponding to ±~14 px
localisation jitter. This threshold is calibrated against Bulat & Tzimiropoulos
2017 (ICCV), which reports 2–3 px NME for state-of-the-art face alignment.

---

# stability_factor_for_metric() — per-metric scalar (landmark_stability.py)

**Source:** `backend/app/services/landmark_stability.py`

```python
def stability_factor_for_metric(
    stability_scores: np.ndarray | list[float],
    dependency_landmarks: list[int],
) -> float:
```

Returns the arithmetic mean of `stability_scores[i]` for all `i` in
`dependency_landmarks` that are in range. Out-of-range indices are silently ignored.

Returns `1.0` (no penalty) when:
- `dependency_landmarks` is empty.
- `stability_scores` is empty.
- All dependency indices are out of range.

This function is the complement to `confidence_propagation.landmark_stability_penalty()`,
which implements the same semantics but operates on `list[float]` directly. The
difference is that `stability_factor_for_metric` uses `np.asarray` and `np.mean`,
while `landmark_stability_penalty` uses pure Python arithmetic (with NaN filtering).

---

# Integration with confidence_propagation.propagate() (landmark_stability.py)

**Source:** `backend/app/services/metrics/confidence_propagation.py` (step 4)

`LandmarkStabilityResult.to_scores_list()` output is assigned to
`QualityContext.landmark_stability_scores` before the pipeline calls `propagate()`.

Inside `propagate()`, step 4 calls `landmark_stability_penalty(stability_scores, dependency_landmarks or [])`:

```python
def landmark_stability_penalty(
    stability_scores: list[float] | None,
    dependency_landmarks: list[int],
) -> float:
```

Returns `1.0` (backwards compatible) when `stability_scores is None` (single-capture,
i.e. `capture_count == 1`) or `dependency_landmarks` is empty.

Otherwise returns `mean([stability_scores[i] for i in dependency_landmarks if in range])`,
filtering NaN values (propagated NaN guard).

Pipeline step 4 is only active when `capture_count > 1`. Single-capture sessions
always use `confidence_final` with no stability penalty.

---

# _estimate_icd_px() — ICD helper (landmark_stability.py)

**Source:** `backend/app/services/landmark_stability.py`

```python
def _estimate_icd_px(frame: np.ndarray) -> float:
```

Uses MediaPipe inner canthus indices `P_LEFT_EYE_INNER` and `P_RIGHT_EYE_INNER`
(imported from `app.domain.landmarks_mesh`; indices 133 and 362 in Mesh-478).

Returns `np.linalg.norm(right[:2] - left[:2])`. Returns `1.0` if `frame.shape[0]`
is smaller than the required index (degenerate landmark array guard).
