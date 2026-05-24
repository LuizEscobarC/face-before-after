---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/calc-registry-base"
file_path: ".claude/local/context/backend/30-calc-registry-base.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  MetricRegistry (registry.py) uses a module-level dict _registry keyed by metric_id,
  populated via the @register class decorator; compute_all() iterates all registered
  MetricCalculator instances calling compute(landmarks, ctx). MetricCalculator is an
  ABC in base.py with class-level identity fields (metric_id, region, family, unit,
  requires_pixel_analysis, presentation_only) and abstract compute() returning MetricValue.
  QualityContext carries quality_score, regional_penalties, pose, landmark_stability_scores,
  and virtual_landmarks for BiSeNet trichion override.
tags:
  - "backend"
  - "metrics"
  - "registry"
  - "abstract-base"
  - "quality-context"
  - "metric-value"
rag_keywords:
  - "MetricRegistry"
  - "MetricCalculator"
  - "QualityContext"
  - "MetricValue"
  - "register"
  - "register_class"
  - "compute_all"
  - "all_instances"
  - "list_metric_ids"
  - "quality_score"
  - "regional_penalties"
  - "landmark_stability_scores"
  - "virtual_landmarks"
  - "confidence_raw"
  - "confidence_final"
  - "is_low_confidence"
  - "dependency_landmarks"
  - "presentation_only"
  - "improvement_vector"
  - "LOW_CONF_THRESHOLD"
related_modules:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
  - "backend/pipeline"
  - "backend/landmarks-fusion"
depends_on:
  - "backend/calc-normalization"
  - "backend/calc-confidence"
used_by:
  - "backend/pipeline"
---

# MetricRegistry — registration and dispatch (registry.py)

**Source:** `backend/app/services/metrics/registry.py`

The registry is a module-level dict `_registry: dict[str, type[MetricCalculator]]`.
It is populated at import time: each calculator module (symmetry.py, thirds.py, …)
imports `register` from `base.py` and decorates its class with it.

## Registration mechanism

```python
@register          # = registry.register_class(cls) then return cls
class MyCalc(MetricCalculator):
    metric_id = "my_metric"
    ...
```

`register_class(cls)` stores `_registry[cls.metric_id] = cls`.  
The decorator form (`@register`) is syntactic sugar: it calls `register_class` and
returns the class unchanged.

There is **no auto-discovery** (no `importlib` scan). The modules must be imported
somewhere upstream (e.g. `pipeline.py`) for the registry to be populated.

## Public API

| Function | Signature | Returns |
|---|---|---|
| `register_class` | `(cls) → None` | Stores class in `_registry` |
| `register` | `(cls) → cls` | Decorator wrapper of `register_class` |
| `get` | `(metric_id: str) → MetricCalculator \| None` | Fresh instance or None |
| `all_instances` | `() → dict[str, MetricCalculator]` | Fresh instance per registered metric |
| `list_metric_ids` | `() → list[str]` | Sorted list of registered metric_ids |
| `compute_all` | `(landmarks, ctx, metric_ids?) → list[MetricValue]` | Computed results |

`get()` always instantiates a new object (`cls()`); there is no instance cache.

`compute_all()` iterates `targets = metric_ids if metric_ids else list_metric_ids()`,
calls `get(mid)` per ID (silently skips unknown IDs), calls `calc.compute(landmarks, ctx)`,
and appends the result. Returns a flat `list[MetricValue]`.

Usage by `GET /vision/capabilities`: calls `list_metric_ids()` and validates against
`metric_definition` rows in Postgres.

---

# MetricCalculator ABC — identity contract (base.py)

**Source:** `backend/app/services/metrics/base.py`

```python
class MetricCalculator(ABC):
    metric_id:              ClassVar[str]
    region:                 ClassVar[str]
    family:                 ClassVar[str]
    unit:                   ClassVar[str]
    presentation_only:      ClassVar[bool] = False
    requires_pixel_analysis:ClassVar[bool] = False

    @abstractmethod
    def compute(
        self,
        landmarks: NormalizedLandmarks,
        ctx: QualityContext,
    ) -> MetricValue: ...
```

All six class-level attributes mirror the `metric_definition` table in Postgres
(PLAN_METRICS.md §5.1). Concrete calculators set them as class variables.

`presentation_only = True` must never enter any score aggregate (DEC-6, enforced
in the scoring layer). Used by phi/golden-ratio metrics.

`requires_pixel_analysis = False` for all current calculators; reserved for future
pixel-based metrics that need raw image data beyond landmarks.

`compute()` receives already-normalised `NormalizedLandmarks` (ICU space) and a
`QualityContext` with quality/pose/stability signals.

---

# QualityContext — runtime quality signals (base.py)

**Source:** `backend/app/services/metrics/base.py`

```python
@dataclass
class QualityContext:
    quality_score:             float = 1.0
    regional_penalties:        dict[str, float] = field(default_factory=dict)
    pose:                      dict[str, float] = field(default_factory=dict)
    landmark_stability_scores: list[float] | None = None
    capture_count:             int = 1
    virtual_landmarks:         dict[str, Any] | None = None
```

| Field | Type | Semantics |
|---|---|---|
| `quality_score` | `float` [0–1] | Global image quality gate (multiplicative in propagate) |
| `regional_penalties` | `dict[str, float]` | Region → penalty fraction [0–1]; missing region = 0 penalty |
| `pose` | `dict[str, float]` | Keys `yaw`, `pitch`, `roll` in degrees; missing keys default to 0.0 |
| `landmark_stability_scores` | `list[float] \| None` | 478 per-landmark stability scores from multi-capture (PR-23, DEC-11); `None` when `capture_count == 1` |
| `capture_count` | `int` | Number of frames; 1 = single-capture (M1/M2 common case) |
| `virtual_landmarks` | `dict \| None` | BiSeNet fusion output for hairline-aware thirds; keys: `trichion_y_icu`, `trichion_confidence`, `trichion_source` |

Accessor helpers: `get_yaw()`, `get_pitch()`, `get_roll()` — all return `float` from
`self.pose.get(key, 0.0)`.

`virtual_landmarks["trichion_confidence"] >= 0.8` triggers `UpperThirdRatioCalculator`
to use the BiSeNet-derived `trichion_y_icu` rather than `lm[P_FOREHEAD_CROWN]`.

---

# MetricValue — immutable result object (domain/metric_value.py)

**Source:** `backend/app/domain/metric_value.py`

```python
@dataclass(frozen=True, slots=True)
class MetricValue:
    metric_id:            str
    region:               str
    family:               str
    unit:                 str
    value:                float
    error:                float
    confidence_raw:       float
    confidence_final:     float
    is_low_confidence:    bool
    direction:            str
    dependency_landmarks: tuple[int, ...]
    presentation_only:    bool = False
    improvement_vector:   tuple[float, float] | None = None
```

| Field | Semantics |
|---|---|
| `metric_id` | snake_case string, stable across refactors |
| `region` | One of the 12 canonical region labels |
| `family` | Metric sub-family (symmetry, thirds, fifths, …) |
| `unit` | Measurement unit (intercanthal_units, degrees, …) |
| `value` | Raw numeric result (always non-negative magnitude) |
| `error` | Propagated measurement uncertainty in same unit |
| `confidence_raw` | 0–1 before regional/pose penalties |
| `confidence_final` | 0–1 after all penalties; used for displayability |
| `is_low_confidence` | `True` when `confidence_final < LOW_CONF_THRESHOLD` (0.4) |
| `direction` | Semantic label describing which way the value deviates |
| `dependency_landmarks` | MediaPipe Mesh-478 indices consumed by this metric |
| `presentation_only` | If `True`, never enters score aggregate (DEC-6) |
| `improvement_vector` | Optional `(dx, dy)` in ICU; when present, drives before/after simulation |

`LOW_CONF_THRESHOLD = 0.4` is defined in `confidence_propagation.py`.

`to_dict()` serialises all fields to JSON-compatible dict; `improvement_vector` is
converted from `tuple` to `list` (or `None`).

Mirrors the JSON contract of `POST /vision/metrics-v2` response (PLAN_METRICS.md §10).
