---
tenant_id: "face-before-after"
project: "face-before-after"
module: "hybrid-arch/task-E1-flag-detection-2026-05-07.prompt"
file_path: ".claude/prompts/hybrid-arch/task-E1-flag-detection-2026-05-07.prompt.md"
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
  - "detection"
  - "flag"
  - "hybrid"
  - "prompt"
  - "prompts"
related_modules: []
depends_on: []
used_by: []
---
# Task E1 — Flag Detection Heurística (sem novos pacotes)
**Created**: 2026-05-07
**Stack**: FastAPI / Python 3.12, OpenCV 4, dlib 68-point landmarks
**Depende de**: nada (E2 depende desta)
**Status**: ✅ IMPLEMENTADO

---

## 0. Contexto

O `quality_evaluator.py` já computa `quality_score` multiplicativo (pose × sharpness × lighting × occlusion × expression).
O campo `flags` no `LandmarkPayload` atualmente retorna **tudo `False`** e `beard_density: 0.0`.

Esta task implementa a detecção heurística de barba, óculos e sorriso usando apenas **OpenCV + numpy + landmarks dlib** já disponíveis — zero novos pacotes.

### Landmarks dlib de referência (68-point)
- **Jaw line**: 0–16 (0=esq, 16=dir), 5–11 = queixo inferior
- **Eyebrows**: 17–21 (esq), 22–26 (dir)
- **Nose**: 27–35
- **Eyes**: 36–41 (esq), 42–47 (dir)
- **Mouth outer**: 48–59; **Mouth inner**: 60–67
  - 48 = canto esquerdo, 54 = canto direito, 57 = lábio inferior centro

---

## 1. Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `backend/app/vision/services/quality_evaluator.py` | Adicionar `detect_flags()` + chamar em `evaluate()` |
| `backend/app/vision/schemas/landmark_payload.py` | Adicionar `beard_density: float` em `QualityFlags` |

---

## 2. Implementação

### 2.1 Função `detect_flags()`

Adicionar em `quality_evaluator.py`, após `compute_lighting()`:

```python
def detect_flags(image_bgr: np.ndarray, landmarks: np.ndarray) -> dict:
    """Heuristic detection of beard, glasses, smile via OpenCV + dlib landmarks.

    No new packages — uses only OpenCV, numpy, and the existing 68-point array.
    Returns: {beard: bool, beard_density: float, glasses: bool, smile: bool, hair_covering: bool}
    """
    h, w = image_bgr.shape[:2]
    pad = 4  # pixel padding for small ROIs

    # ------------------------------------------------------------------
    # Beard — chin ROI between mouth bottom and jaw bottom
    # ------------------------------------------------------------------
    mouth_bottom_y = int(landmarks[57, 1])   # lábio inferior centro
    chin_y = int(np.max(landmarks[5:12, 1])) # ponto mais baixo do queixo (pts 5-11)
    jaw_x0 = int(landmarks[6, 0])
    jaw_x1 = int(landmarks[10, 0])

    beard_density = 0.0
    roi_h = chin_y - mouth_bottom_y
    roi_w = jaw_x1 - jaw_x0
    if roi_h > 8 and roi_w > 8:
        y0 = max(0, mouth_bottom_y)
        y1 = min(h - 1, chin_y)
        x0 = max(0, jaw_x0)
        x1 = min(w - 1, jaw_x1)
        chin_roi = image_bgr[y0:y1, x0:x1]
        if chin_roi.size > 0:
            lab = cv2.cvtColor(chin_roi, cv2.COLOR_BGR2LAB)
            l_channel = lab[:, :, 0].astype(np.float32)
            std_l = float(np.std(l_channel))
            mean_l = float(np.mean(l_channel))
            # High texture + dark region → beard
            beard_density = float((std_l / 50.0) * (1.0 - mean_l / 220.0))
            beard_density = max(0.0, min(1.0, beard_density))

    beard = beard_density > 0.35

    # ------------------------------------------------------------------
    # Glasses — eye ROI Sobel edge density
    # ------------------------------------------------------------------
    eye_pts = landmarks[36:48]  # both eyes (36-41 left, 42-47 right)
    ex0 = max(0, int(np.min(eye_pts[:, 0])) - 20)
    ey0 = max(0, int(np.min(eye_pts[:, 1])) - 20)
    ex1 = min(w - 1, int(np.max(eye_pts[:, 0])) + 20)
    ey1 = min(h - 1, int(np.max(eye_pts[:, 1])) + 20)

    glasses = False
    if ex1 - ex0 > 10 and ey1 - ey0 > 10:
        eye_roi = image_bgr[ey0:ey1, ex0:ex1]
        gray_eye = cv2.cvtColor(eye_roi, cv2.COLOR_BGR2GRAY)
        sobel_x = cv2.Sobel(gray_eye, cv2.CV_64F, 1, 0, ksize=3)
        sobel_y = cv2.Sobel(gray_eye, cv2.CV_64F, 0, 1, ksize=3)
        edges = np.sqrt(sobel_x ** 2 + sobel_y ** 2)
        roi_area = (ex1 - ex0) * (ey1 - ey0)
        edge_density = float(np.count_nonzero(edges > 80)) / roi_area if roi_area > 0 else 0.0
        glasses = edge_density > 0.18

    # ------------------------------------------------------------------
    # Smile — mouth corner lift relative to lower lip center
    # ------------------------------------------------------------------
    mouth_corners_y = (landmarks[48, 1] + landmarks[54, 1]) / 2.0
    mouth_center_y = float(landmarks[57, 1])
    # In image coords: larger y = lower. Corners above center = positive lift = smile.
    lift = float(mouth_center_y - mouth_corners_y)
    smile = lift > 4.0

    # hair_covering: placeholder — requires top-of-head ROI analysis (V2)
    return {
        "beard": beard,
        "beard_density": round(beard_density, 4),
        "glasses": glasses,
        "smile": smile,
        "hair_covering": False,
    }
```

### 2.2 Integrar em `evaluate()`

Localizar o trecho de `evaluate()` onde `flags` é construído e **substituir** o bloco de flags estáticas:

**Antes** (atual):
```python
    return {
        ...
        "regional_penalties": {"jaw": 0.0, "eye": 0.0, "nose": 0.0, "brow": 0.0, "mouth": 0.0},
        "flags": {
            "beard": False,
            "beard_density": 0.0,
            "glasses": False,
            "smile": False,
            "hair_covering": False,
        },
        ...
    }
```

**Depois** — chamar `detect_flags()` e passar o resultado:
```python
    flags = detect_flags(image_bgr, landmarks)

    return {
        ...
        "regional_penalties": {"jaw": 0.0, "eye": 0.0, "nose": 0.0, "brow": 0.0, "mouth": 0.0},
        "flags": flags,
        ...
    }
```

> Nota: `regional_penalties` ainda fica com zeros aqui — será preenchido na E2 (que depende dos flags).

### 2.3 Schema — adicionar `beard_density`

Em `backend/app/vision/schemas/landmark_payload.py`, no modelo `QualityFlags`:

**Antes**:
```python
class QualityFlags(BaseModel):
    beard: bool = False
    glasses: bool = False
    smile: bool = False
    hair_covering: bool = False
```

**Depois**:
```python
class QualityFlags(BaseModel):
    beard: bool = False
    beard_density: float = 0.0
    glasses: bool = False
    smile: bool = False
    hair_covering: bool = False
```

---

## 3. Regras de Negócio

- **Sem novos pacotes** — apenas `cv2`, `numpy`, `dlib` (já instalados na imagem Docker)
- `beard_density` é float em [0.0, 1.0] — nunca negativo, nunca > 1
- `hair_covering` fica `False` (placeholder V2)
- A detecção é **best-effort** — falso positivo é aceitável; o campo é informativo, não gate

---

## 4. Verificação

```bash
# Rebuild vision-service
docker compose build vision-service && docker compose up -d vision-service

# Checar flags no response de landmarks
curl -s -X POST http://localhost:9015/vision/landmarks \
  -H "Content-Type: application/json" \
  -d "{\"image_base64\":\"$(base64 -w0 bkp/antes.png)\"}" \
  | jq '{flags, quality_grade}'

# Esperado: flags.beard_density é um float (ex: 0.2134), não 0.0 fixo
# (valor exato depende da foto)

# Smoke tests
docker exec face-vision-service python -m pytest backend/tests/ -v

# Compile check (sem rodar)
docker exec face-vision-service python -c "
from app.vision.services.quality_evaluator import detect_flags
print('detect_flags OK')
"
```

---

## 5. Checklist

- [x] `detect_flags()` adicionada em `quality_evaluator.py`
- [x] `evaluate()` chama `detect_flags()` e passa resultado em `flags`
- [x] `QualityFlags` schema tem `beard_density: float = 0.0`
- [x] `beard_density` retornado no response de `/vision/landmarks`
- [x] Smoke tests passando
- [x] Nenhum `pip install` executado
