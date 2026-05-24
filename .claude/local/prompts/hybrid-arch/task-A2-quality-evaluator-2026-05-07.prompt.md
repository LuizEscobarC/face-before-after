---
tenant_id: "face-before-after"
project: "face-before-after"
module: "hybrid-arch/task-A2-quality-evaluator-2026-05-07.prompt"
file_path: ".claude/prompts/hybrid-arch/task-A2-quality-evaluator-2026-05-07.prompt.md"
doc_type: "decision"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  ---
tags:
  - "task-prompt"
rag_keywords:
  - "arch"
  - "evaluator"
  - "hybrid"
  - "prompt"
  - "prompts"
  - "quality"
related_modules: []
depends_on: []
used_by: []
---
# Task A2 — Quality Evaluator + Fingerprint + Smoke Tests
**Created**: 2026-05-07
**Status**: ✅ CONCLUÍDO
**Stack**: FastAPI / Python 3.12, OpenCV, dlib, numpy

---

## 0. O que foi feito

Implementação do **Módulo 0 — Photo Quality Gatekeeper**: avaliação multiplicativa de qualidade da foto antes de qualquer análise facial. Também implementado o `fingerprint.py` para identificação de sessão.

---

## 1. Arquivos criados/modificados

| Arquivo | Descrição |
|---------|-----------|
| `backend/app/vision/services/quality_evaluator.py` | Score multiplicativo + grade + recomendações |
| `backend/app/vision/services/pose_estimator.py` | solvePnP → {yaw, pitch, roll} em graus |
| `backend/app/vision/services/fingerprint.py` | sha1 de 6 buckets → hex[:16] |
| `backend/tests/test_quality_evaluator.py` | 2 smoke tests |

---

## 2. `quality_evaluator.py` — design

### Fórmula do score
```
quality_score = face_ok × pose_score × sharpness_score × lighting_score × occlusion_score × expression_score
```

Todos os fatores em [0, 1]. Multiplicativo: qualquer sub-score zero → score total zero.

### Grades
| Threshold | Grade |
|-----------|-------|
| ≥ 0.85 | ALTA |
| ≥ 0.70 | MEDIA |
| ≥ 0.55 | BAIXA |
| < 0.55 | REJEITADA |

### Funções principais
```python
def _linear_decay(value, ideal, fail) -> float
    # 1.0 quando |value| <= ideal; decai a 0 em |value| >= fail

def _pose_score(pose) -> float
    # min(yaw_score, pitch_score, roll_score)
    # Limites: yaw (8°/20°), pitch (8°/20°), roll (5°/15°)

def compute_blur_score(image_bgr, landmarks) -> (float, float)
    # Laplacian variance na face bbox
    # SHARPNESS_FLOOR=40, SHARPNESS_TARGET=250

def compute_lighting(image_bgr, landmarks) -> (float, float, float)
    # LAB L-channel: exposure score + symmetry score (left vs right)
    # LIGHTING_TARGET_MEAN=130, LIGHTING_TOLERANCE=60, LIGHTING_ASYM_FLOOR=35

def _build_recommendations(subscores, pose, lighting_asymmetry) -> list[str]
    # Até 3 dicas em pt-BR; prioridade: pose > sharpness > lighting

def evaluate(image_bgr, landmarks, pose, face_count) -> dict
    # Retorna: quality_score, quality_grade, subscore_breakdown,
    #           sharpness_score, lighting_asymmetry, mean_luminance,
    #           blur_variance, recommendations, regional_penalties (0.0), flags (False)
```

### Subscores placeholder
- `occlusion_score = 1.0` — placeholder (E1 irá substituir)
- `expression_score = 1.0` — placeholder
- `regional_penalties` — todos `0.0` (E2 irá substituir)
- `flags` — todos `False`, `beard_density=0.0` (E1 irá substituir)

---

## 3. `pose_estimator.py`

```python
def estimate_pose(landmarks: np.ndarray, image_shape: tuple) -> dict[str, float]:
    # 6 pontos âncora: nariz (30), queixo (8), olhos (36,45), boca (48,54)
    # solvePnP com modelo 3D canônico
    # Rodrigues → rotation_matrix → projeção → {yaw, pitch, roll}
```

Variáveis renomeadas (clean-code): `rvec` → `rotation_vector`, `rmat` → `rotation_matrix`, `proj` → `projection_matrix`.

---

## 4. `fingerprint.py`

```python
def build_session_fingerprint(flags, pose, mean_luminance, face_width_ratio) -> str:
    # 6 buckets discretos:
    #   beard (True/False), glasses, smile
    #   lighting: dark/mid/bright/overexposed
    #   pose: frontal/slight/off
    #   distance: far/mid/close
    # sha1("|".join(parts))[:16]
```

---

## 5. Smoke tests (`backend/tests/test_quality_evaluator.py`)

```python
# Fixture: bkp/01/antes.png (foto real)

def test_evaluator_grades_good_photo_acceptable(good_image):
    # grade in {ALTA, MEDIA, BAIXA}, score in [0,1]

def test_evaluator_rejects_heavily_blurred_photo(good_image):
    # GaussianBlur(51,51) → sharpness_score < 0.6
```

---

## 6. Verificação

```bash
# Smoke tests dentro do container
docker exec face-vision-service python -m pytest backend/tests/ -v

# Avaliar foto real
curl -s -X POST http://localhost:9015/vision/landmarks \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\"}" \
  | jq '{quality_score, quality_grade, subscore_breakdown, fingerprint}'

# Compile check
docker exec face-vision-service python -c "
from app.vision.services.quality_evaluator import evaluate
from app.vision.services.fingerprint import build_session_fingerprint
print('OK')
"
```
