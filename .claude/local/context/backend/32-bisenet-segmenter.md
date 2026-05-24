---
tenant_id: "face-before-after-backend"
project: "face-before-after-backend"
module: "backend/bisenet-segmenter"
file_path: ".claude/local/context/backend/32-bisenet-segmenter.md"
doc_type: "code"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  BiSeNetSegmenter wraps an ONNX Runtime InferenceSession for BiSeNet face parsing
  (CelebAMask-HQ 19-class layout). segment(image_bgr) returns hair_mask (bool H×W),
  face_mask (bool H×W), raw_label_map (int32 H×W), and elapsed_ms. A module-level
  singleton is managed via get_segmenter(); the ORT session is lazy-loaded and
  thread-safe via _get_session() with double-checked locking.
tags:
  - "backend"
  - "segmentation"
  - "bisenet"
  - "onnxruntime"
  - "hair-mask"
  - "face-parsing"
rag_keywords:
  - "BiSeNetSegmenter"
  - "segment"
  - "get_segmenter"
  - "_get_session"
  - "_preprocess"
  - "_postprocess"
  - "_resolve_model_path"
  - "hair_mask"
  - "face_mask"
  - "raw_label_map"
  - "elapsed_ms"
  - "_HAIR_CLASS"
  - "_FACE_CLASSES"
  - "_INPUT_SIZE"
  - "BISENET_ONNX_PATH"
  - "CPUExecutionProvider"
  - "bisenet_face_parsing.onnx"
related_modules:
  - "backend/landmarks-fusion"
  - "backend/trichion-bisenet"
  - "backend/pipeline"
depends_on: []
used_by:
  - "backend/trichion-bisenet"
  - "backend/landmarks-fusion"
  - "backend/pipeline"
---

# BiSeNetSegmenter class (bisenet_segmenter.py)

**Source:** `backend/app/services/segmentation/bisenet_segmenter.py`

Thin wrapper around an ORT `InferenceSession`. No constructor arguments; the class
has no `__init__` — it delegates everything to module-level helpers.

```python
class BiSeNetSegmenter:
    def segment(self, image_bgr: np.ndarray) -> dict: ...
```

A module-level singleton is provided:

```python
_SEGMENTER: BiSeNetSegmenter | None = None

def get_segmenter() -> BiSeNetSegmenter:
    global _SEGMENTER
    if _SEGMENTER is None:
        _SEGMENTER = BiSeNetSegmenter()
    return _SEGMENTER
```

`get_segmenter()` is the expected import from `fusion_layer.py`. The constructor is
lightweight; the ORT session is loaded lazily on the first `segment()` call.

---

# segment() — signature and output (bisenet_segmenter.py)

**Source:** `backend/app/services/segmentation/bisenet_segmenter.py`

```python
def segment(self, image_bgr: np.ndarray) -> dict:
```

**Input:** BGR image `(H, W, 3)`, uint8 or float. Original dimensions preserved in output.

**Output dict:**

| Key | Type | Description |
|---|---|---|
| `hair_mask` | `np.ndarray` bool `(H, W)` | True where `label_map == 17` (hair class) |
| `face_mask` | `np.ndarray` bool `(H, W)` | True where `label_map ∈ {1}` (skin class) |
| `raw_label_map` | `np.ndarray` int32 `(H, W)` | Full 19-class label map, original resolution |
| `elapsed_ms` | `float` | Wall-clock inference time in milliseconds |

**Inference pipeline:**
1. `_preprocess(image_bgr)` → `(1, 3, 512, 512)` float32 tensor.
2. `session.run(None, {input_name: tensor})[0]` → raw ORT output.
3. `_postprocess(raw, h, w)` → int32 label map at original `(h, w)`.
4. `hair_mask = (label_map == _HAIR_CLASS)`, `face_mask = np.isin(label_map, list(_FACE_CLASSES))`.

Raises `RuntimeError` (propagated from `_get_session()`) if onnxruntime is not
installed or the model file is not found. The caller (`fusion_layer.fuse()`) catches
this and activates the mesh-trichion fallback.

---

# CelebAMask-HQ class labels (bisenet_segmenter.py)

**Source:** `backend/app/services/segmentation/bisenet_segmenter.py` (module docstring)

```
0=background, 1=skin, 2=left_brow, 3=right_brow, 4=left_eye, 5=right_eye,
6=eyeglasses, 7=left_ear, 8=right_ear, 9=earrings, 10=nose, 11=mouth,
12=upper_lip, 13=lower_lip, 14=neck, 15=necklace, 16=cloth, 17=hair, 18=hat
```

Active constants:

```python
_HAIR_CLASS   = 17      # used for hair_mask
_FACE_CLASSES = {1}     # "skin" — extend as needed (comment in source)
```

Only `hair_mask` (label 17) is consumed by the current pipeline (`fusion_layer.py`).
`face_mask` (label 1 = skin) is returned but not yet consumed by any active caller.

---

# Input preprocessing — _preprocess() (bisenet_segmenter.py)

**Source:** `backend/app/services/segmentation/bisenet_segmenter.py`

```python
def _preprocess(image_bgr: np.ndarray) -> np.ndarray:
    # BGR → RGB → resize 512×512 → ImageNet normalise → NCHW float32
    rgb     = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (512, 512), interpolation=cv2.INTER_LINEAR)
    tensor  = resized.astype(np.float32) / 255.0
    tensor  = (tensor - _MEAN) / _STD
    return np.transpose(tensor, (2, 0, 1))[np.newaxis]  # (1, 3, 512, 512)
```

ImageNet normalization constants:
```python
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
_INPUT_SIZE = 512
```

---

# Output postprocessing — _postprocess() (bisenet_segmenter.py)

**Source:** `backend/app/services/segmentation/bisenet_segmenter.py`

```python
def _postprocess(raw_output: np.ndarray, target_h: int, target_w: int) -> np.ndarray:
```

Handles three ORT output shapes:
- `(1, 19, H, W)` → `np.argmax(output[0], axis=0).astype(int32)` (standard BiSeNet logit output).
- `(1, H, W)` → `output[0].astype(int32)` (pre-argmaxed).
- `(H, W)` → `output.astype(int32)` (flat label map).

If the resulting label map is not `(target_h, target_w)`, upsamples with
`cv2.INTER_NEAREST` to preserve class boundaries.

---

# ORT session — lazy-load singleton and model resolution (bisenet_segmenter.py)

**Source:** `backend/app/services/segmentation/bisenet_segmenter.py`

**Thread-safety:** `_SESSION_LOCK: threading.Lock` with double-checked locking pattern:
```python
if _SESSION is not None: return _SESSION
with _SESSION_LOCK:
    if _SESSION is not None: return _SESSION
    # ... load session
```

**CPU-only:** `providers=["CPUExecutionProvider"]` is enforced regardless of environment.
`intra_op_num_threads = 2`, `log_severity_level = 3` (suppress verbose ORT logs).

**Model path resolution** (`_resolve_model_path()`):
1. `BISENET_ONNX_PATH` env var (absolute path).
2. `/app/backend/models/bisenet_face_parsing.onnx` (Docker layout).
3. Walk up from `__file__` looking for `backend/models/bisenet_face_parsing.onnx` or `models/bisenet_face_parsing.onnx`.
4. Falls back to Docker path (causes `FileNotFoundError` downstream if not present).

Note: `_resolve_model_path` is defined twice in the file — once at module level (used
to set `_MODEL_PATH`) and once inside `_get_session()`. The inner version checks a
hardcoded candidates list against `_MODEL_PATH`. This is a minor redundancy; the
effective resolution at load time uses the module-level definition.

**Raises `RuntimeError`** with descriptive messages:
- `"onnxruntime is not installed"` (ImportError wrapping).
- `"BiSeNet ONNX model not found at {path}. Rebuild the Docker image…"`.
