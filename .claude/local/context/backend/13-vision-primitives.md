---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/vision-primitives"
file_path: ".claude/local/context/backend/13-vision-primitives.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Primitivas de visão computacional que alimentam POST /vision/landmarks:
  detecção de face, extração de landmarks MediaPipe FaceMesh (478 pontos),
  pose estimation, quality_evaluator com score multiplicativo e grades
  ALTA/MEDIA/BAIXA/REJEITADA, fingerprint de sessão, e schemas Pydantic
  LandmarkPayload/LandmarkRequest em vision/schemas/landmark_payload.py.
tags:
  - "backend"
  - "vision"
  - "landmarks"
  - "quality"
rag_keywords:
  - "LandmarkPayload LandmarkRequest PoseAngles QualityFlags RegionalPenalties"
  - "quality_grade ALTA MEDIA BAIXA REJEITADA thresholds 0.85 0.70 0.35"
  - "quality_score multiplicativo face_ok pose_score sharpness lighting occlusion"
  - "POSE_LIMITS yaw pitch roll 8.0 20.0 degrees"
  - "SHARPNESS_FLOOR 40 SHARPNESS_TARGET 250 Laplacian variance"
  - "LIGHTING_TARGET_MEAN 130 LIGHTING_TOLERANCE 60 LAB L-channel"
  - "detect_flags beard glasses smile hair_covering"
  - "build_session_fingerprint fingerprint_parts session_id"
  - "ProcessingMode CLIENT_SIDE SERVER_FALLBACK"
  - "SubscoreBreakdown FaceBbox RegionalPenalties jaw eye nose brow mouth"
related_modules:
  - "backend/pipeline"
  - "backend/api-vision"
depends_on:
  - "backend/architecture"
used_by:
  - "backend/pipeline"
  - "backend/api-vision"
---

# Backend — Vision Primitives (Landmarks + Quality)

> **Última atualização:** 2026-05-24

Camada de primitivas que implementa `POST /vision/landmarks` e alimenta o pipeline interno.

## Schemas Pydantic (`vision/schemas/landmark_payload.py`)

### LandmarkRequest

```python
class LandmarkRequest(BaseModel):
    image_base64: str
    session_id: str | None = None
```

### LandmarkPayload

Contrato de saída de `/vision/landmarks` e entrada esperada do cliente para `/vision/metrics-v2`:

| Campo | Tipo | Descrição |
|---|---|---|
| `session_id` | `str` | UUID gerado ou propagado do request |
| `landmarks` | `list[list[float]]` | 478 pontos `[x, y]` em pixels (MediaPipe Mesh-478) |
| `pose` | `PoseAngles` | `yaw`, `pitch`, `roll` em graus |
| `quality_score` | `float` | 0.0–1.0 (produto dos 6 sub-scores) |
| `quality_grade` | `QualityGrade` | `"ALTA"`, `"MEDIA"`, `"BAIXA"`, `"REJEITADA"` |
| `flags` | `QualityFlags` | `beard`, `beard_density`, `glasses`, `smile`, `hair_covering` |
| `regional_penalties` | `RegionalPenalties` | `jaw`, `eye`, `nose`, `brow`, `mouth` (float 0–1) |
| `recommendations` | `list[str]` | Dicas de captura (max 3) |
| `fingerprint` | `str` | Hash de identidade da sessão |
| `fingerprint_parts` | `list[str]` | Componentes do fingerprint |
| `processing_mode` | `ProcessingMode` | `"CLIENT_SIDE"` ou `"SERVER_FALLBACK"` |
| `sharpness_score` | `float` | Sub-score de nitidez |
| `lighting_asymmetry` | `float` | Diferença de luminância L/R |
| `subscore_breakdown` | `SubscoreBreakdown \| None` | 6 sub-scores individuais |
| `face_bbox` | `FaceBbox \| None` | Bbox `(x,y,w,h)` em pixels |

### SubscoreBreakdown

`face_ok`, `pose_score`, `sharpness_score`, `lighting_score`, `occlusion_score`, `expression_score` — todos `float` 0–1.

### QualityGrade (thresholds)

```python
GRADE_THRESHOLDS = [
    (0.85, "ALTA"),
    (0.70, "MEDIA"),
    (0.35, "BAIXA"),
    # abaixo de 0.35 → REJEITADA
]
```

**Arquivo:** `vision/services/quality_evaluator.py:38`

---

## quality_evaluator.evaluate()

**Arquivo:** `vision/services/quality_evaluator.py:284`

**Score:** produto multiplicativo dos 6 sub-scores:

```
quality_score = face_ok × pose_score × sharpness_score × lighting_score × occlusion_score × expression_score
```

| Sub-score | Fonte | Parâmetros |
|---|---|---|
| `face_ok` | `face_count == 1` → `1.0` | `0.0` se nenhum ou múltiplos |
| `pose_score` | `_pose_score(pose)` | `yaw 60%` + `pitch 20%` + `roll 20%` |
| `sharpness_score` | Laplacian variance da ROI | `FLOOR=40`, `TARGET=250` |
| `lighting_score` | L-channel LAB mean + assimetria | `TARGET=130`, `TOLERANCE=60`, `ASYM_WARN=15`, `ASYM_FLOOR=35` |
| `occlusion_score` | `beard_density` via flags | `max(0.5, 1.0 - beard_density × 0.3)` |
| `expression_score` | `smile` flag | `0.93` (smile) ou `1.0` (neutro) |

### POSE_LIMITS

```python
POSE_LIMITS = {"yaw": (8.0, 20.0), "pitch": (8.0, 20.0), "roll": (8.0, 20.0)}
# (ideal_max_deg, fail_deg) — linear_decay entre os dois
```

**Arquivo:** `vision/services/quality_evaluator.py:29`

Score `1.0` até `8°`, decai linearmente para `0.0` em `20°`.

---

## face_detection + extract_landmarks

**Arquivo:** `vision/services/face_detection.py`

- `detect_faces(image_bgr)` → `list[FaceDetectionResult]` — usa MediaPipe FaceDetection para bbox
- `extract_landmarks(image_bgr, face_result)` → `np.ndarray` shape `(478, 2)` — MediaPipe FaceMesh 478 pontos em pixels

---

## estimate_pose

**Arquivo:** `vision/services/pose_estimator.py`

- `estimate_pose(landmarks, image_shape)` → `dict[str, float]` com `yaw`, `pitch`, `roll` em graus
- Usa pontos anatômicos de `landmarks_mesh.py` (inter-ocular, nariz, queixo)

---

## build_session_fingerprint

**Arquivo:** `vision/services/fingerprint.py`

- `build_session_fingerprint(flags, pose, mean_luminance, face_width_ratio)` → `(fingerprint: str, fingerprint_parts: list[str])`
- `fingerprint` = hash das características estáveis da sessão (não da identidade facial)
- Usado para agrupar frames do mesmo usuário sem biometria persistente

---

## Fluxo completo de `/vision/landmarks`

```
image_base64 → decode_base64_image()
             → detect_faces() → [0 faces] → payload REJEITADA
                               → [1 face]  → extract_landmarks()
                                           → estimate_pose()
                                           → quality_evaluator.evaluate()
                                           → detect_flags()
                                           → build_session_fingerprint()
                                           → LandmarkPayload
             → [>1 face] → HTTP 400
```

**Arquivo orquestrador:** `vision/routers/landmarks.py:26`
