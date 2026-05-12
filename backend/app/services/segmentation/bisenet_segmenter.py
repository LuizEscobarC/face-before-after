"""BiSeNet face-parsing segmenter (CelebAMask-HQ, 19 classes, ONNX Runtime).

Architecture:
  Input:  BGR image (H x W x 3, uint8).
  Output: dict with "hair_mask" (bool H×W), "face_mask" (bool H×W),
          "raw_label_map" (int H×W), "elapsed_ms" (float).

BiSeNet class indices (CelebAMask-HQ 19-class layout):
  0=background, 1=skin, 2=left_brow, 3=right_brow, 4=left_eye, 5=right_eye,
  6=eyeglasses, 7=left_ear, 8=right_ear, 9=earrings, 10=nose, 11=mouth,
  12=upper_lip, 13=lower_lip, 14=neck, 15=necklace, 16=cloth, 17=hair, 18=hat.

Singleton: one ORT InferenceSession per process (thread-safe lazy init).
CPU-only: providers=["CPUExecutionProvider"] enforced regardless of env.
"""

from __future__ import annotations

import logging
import threading
import time
from pathlib import Path

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# Constants
# --------------------------------------------------------------------------- #
_MODEL_PATH = Path(__file__).resolve().parents[5] / "backend" / "models" / "bisenet_face_parsing.onnx"
_INPUT_SIZE  = 512          # BiSeNet canonical input (square)
_HAIR_CLASS  = 17           # CelebAMask-HQ label for "hair"
_FACE_CLASSES = {1}         # "skin" — extend as needed

# ImageNet normalisation (applied after BGR→RGB, scale to [0,1])
_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)

# --------------------------------------------------------------------------- #
# Singleton session
# --------------------------------------------------------------------------- #
_SESSION_LOCK: threading.Lock = threading.Lock()
_SESSION: object | None = None   # ort.InferenceSession once loaded


def _get_session() -> object:
    """Lazy-load the ORT session (singleton, thread-safe).

    Raises RuntimeError if onnxruntime or the model file is unavailable.
    """
    global _SESSION  # noqa: PLW0603
    if _SESSION is not None:
        return _SESSION
    with _SESSION_LOCK:
        if _SESSION is not None:  # double-checked
            return _SESSION
        try:
            import onnxruntime as ort  # noqa: PLC0415
        except ImportError as exc:
            raise RuntimeError("onnxruntime is not installed") from exc

        model_path = _resolve_model_path()
        if not model_path.exists():
            raise RuntimeError(
                f"BiSeNet ONNX model not found at {model_path}. "
                "Rebuild the Docker image or place the model manually."
            )
        sess_opts = ort.SessionOptions()
        sess_opts.intra_op_num_threads = 2
        sess_opts.log_severity_level = 3  # suppress verbose ORT logs
        _SESSION = ort.InferenceSession(
            str(model_path),
            sess_options=sess_opts,
            providers=["CPUExecutionProvider"],
        )
        logger.info("BiSeNet ORT session loaded from %s", model_path)
    return _SESSION


def _resolve_model_path() -> Path:
    """Return the model path, checking several candidate locations."""
    candidates = [
        _MODEL_PATH,
        Path("/app/backend/models/bisenet_face_parsing.onnx"),
        Path("backend/models/bisenet_face_parsing.onnx"),
        Path("models/bisenet_face_parsing.onnx"),
    ]
    for p in candidates:
        if p.exists():
            return p
    return _MODEL_PATH  # will raise FileNotFoundError downstream


# --------------------------------------------------------------------------- #
# Pre/post-processing helpers
# --------------------------------------------------------------------------- #

def _preprocess(image_bgr: np.ndarray) -> np.ndarray:
    """BGR → RGB → resize 512×512 → normalise → NCHW float32."""
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (_INPUT_SIZE, _INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
    tensor = resized.astype(np.float32) / 255.0
    tensor = (tensor - _MEAN) / _STD
    # HWC → CHW → 1CHW
    tensor = np.transpose(tensor, (2, 0, 1))[np.newaxis]
    return tensor  # shape (1, 3, 512, 512)


def _postprocess(
    raw_output: np.ndarray,
    target_h: int,
    target_w: int,
) -> np.ndarray:
    """Argmax → upsample bilinear to (target_h, target_w) → int label map.

    raw_output shape: (1, 19, H, W) or (1, H, W) depending on model variant.
    Returns: (target_h, target_w) int32 label map.
    """
    if raw_output.ndim == 4:
        # (1, 19, H, W) → (H, W)
        label_map = np.argmax(raw_output[0], axis=0).astype(np.int32)
    elif raw_output.ndim == 3:
        label_map = raw_output[0].astype(np.int32)
    elif raw_output.ndim == 2:
        label_map = raw_output.astype(np.int32)
    else:
        raise ValueError(f"Unexpected ORT output shape: {raw_output.shape}")

    if label_map.shape != (target_h, target_w):
        # Upsample to original image size with nearest-neighbour to keep classes crisp
        label_map = cv2.resize(
            label_map.astype(np.uint8),
            (target_w, target_h),
            interpolation=cv2.INTER_NEAREST,
        ).astype(np.int32)
    return label_map


# --------------------------------------------------------------------------- #
# Public segmenter
# --------------------------------------------------------------------------- #

class BiSeNetSegmenter:
    """Thin wrapper around the ORT session.

    Usage::

        seg = BiSeNetSegmenter()
        result = seg.segment(image_bgr)
        hair_mask = result["hair_mask"]   # bool (H, W)
    """

    def segment(self, image_bgr: np.ndarray) -> dict:
        """Run face parsing on *image_bgr*.

        Parameters
        ----------
        image_bgr : np.ndarray
            BGR image (H, W, 3), uint8 or float. Will be converted internally.

        Returns
        -------
        dict with keys:
          - hair_mask      : np.ndarray bool (H, W) — True where hair was detected
          - face_mask      : np.ndarray bool (H, W) — True for skin class
          - raw_label_map  : np.ndarray int32 (H, W) — full 19-class label map
          - elapsed_ms     : float — wall-clock inference time in milliseconds

        Raises
        ------
        RuntimeError
            Propagated by _get_session() when onnxruntime is missing or model not found.
            The fusion_layer must catch this and activate the fallback path.
        """
        h, w = image_bgr.shape[:2]
        session = _get_session()

        t0 = time.perf_counter()
        tensor = _preprocess(image_bgr)
        input_name = session.get_inputs()[0].name
        raw = session.run(None, {input_name: tensor})[0]
        elapsed_ms = (time.perf_counter() - t0) * 1000.0

        label_map = _postprocess(raw, h, w)

        hair_mask = (label_map == _HAIR_CLASS)
        face_mask = np.isin(label_map, list(_FACE_CLASSES))

        return {
            "hair_mask":     hair_mask,
            "face_mask":     face_mask,
            "raw_label_map": label_map,
            "elapsed_ms":    elapsed_ms,
        }


# Module-level singleton for direct import
_SEGMENTER: BiSeNetSegmenter | None = None


def get_segmenter() -> BiSeNetSegmenter:
    """Return the module-level BiSeNetSegmenter singleton."""
    global _SEGMENTER  # noqa: PLW0603
    if _SEGMENTER is None:
        _SEGMENTER = BiSeNetSegmenter()
    return _SEGMENTER
