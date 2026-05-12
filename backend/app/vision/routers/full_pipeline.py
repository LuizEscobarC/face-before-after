"""POST /vision/full-pipeline — transition endpoint reusing the existing MVP pipeline.

Accepts both multipart upload (legacy) and JSON base64 (preferred for
service-to-service calls from NestJS).
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

import app.domain.pipeline as pipeline
from app.api.deps import get_storage
from app.core.config import settings
from app.core.exceptions import FileTooLargeError, InvalidImageError
from app.infra.storage import MinIOStorage
from app.core.json_utils import sanitize_numpy
from app.vision.schemas.pipeline import FullPipelineRequest, FullPipelineResponse
from app.vision.services import face_detection, quality_evaluator
from app.vision.services.fingerprint import build_session_fingerprint, generate_baseline_group_id
from app.vision.services.image_codec import decode_base64_image
from app.vision.services.pose_estimator import estimate_pose

logger = logging.getLogger(__name__)
router = APIRouter()

_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
_MAX_UPLOAD_BYTES = 15 * 1024 * 1024
_VALID_MODES = {"teaser", "premium"}


def _validate_bytes(filename: str, raw: bytes) -> None:
    ext = Path(filename).suffix.lower()
    if ext and ext not in _ALLOWED_EXTENSIONS:
        raise InvalidImageError(f"Format not supported: {ext}. Use PNG/JPG/JPEG.")
    if not raw:
        raise InvalidImageError("Empty file.")
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise FileTooLargeError(limit_mb=15)


async def _execute(image_bytes: bytes, filename: str, mode: str, storage: MinIOStorage | None) -> FullPipelineResponse:
    _validate_bytes(filename, image_bytes)
    if mode not in _VALID_MODES:
        raise HTTPException(status_code=400, detail=f"Invalid mode '{mode}'. Use one of: {sorted(_VALID_MODES)}.")

    run_id = uuid.uuid4().hex[:12]
    out_dir = Path(settings.resultado_api_dir) / run_id
    out_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(filename or "upload.jpg").name or "upload.jpg"
    if not Path(safe_name).suffix:
        safe_name += ".jpg"
    input_path = out_dir / safe_name
    input_path.write_bytes(image_bytes)

    try:
        result = await asyncio.to_thread(pipeline.run, str(input_path), str(out_dir), mode)
    except SystemExit as exc:
        raise HTTPException(status_code=400, detail=f"Analysis failed: {exc}") from exc
    except Exception as exc:
        logger.exception("Pipeline error for run_id=%s", run_id)
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc

    # The canonical (cropped + aligned) image is the single source of truth for
    # every downstream renderer and metric.  We upload IT to MinIO (not the raw
    # user upload).  The raw upload stays local in out_dir for debug only.
    canonical_url: str | None = None
    canonical_path = (result or {}).get("canonical_image_path") if isinstance(result, dict) else None
    if storage and canonical_path:
        try:
            with open(canonical_path, "rb") as _cf:
                canonical_bytes = _cf.read()
            minio_canonical_path = f"runs/{run_id}/canonical.jpg"
            storage.upload_file(canonical_bytes, minio_canonical_path)
        except Exception:
            logger.warning("MinIO canonical upload failed for run_id=%s", run_id)
    # Always set canonical_url to the HTTP endpoint — works whether MinIO succeeded or not
    canonical_url = f"/v1/vision/results/{run_id}/canonical"

    if isinstance(result, dict):
        result = sanitize_numpy(result)
        result["run_id"] = run_id
        result["output_dir"] = str(out_dir)
        result["canonical_url"] = canonical_url
        # Backwards compatibility: keep photo_url populated with the canonical URL
        # so older clients that still read photo_url get the right image.
        result["photo_url"] = canonical_url

    # Save fingerprint sidecar for consistency score in compare runs.
    try:
        import cv2
        import numpy as np
        img_array = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(img_array, cv2.IMREAD_COLOR)
        if img_bgr is not None:
            faces = face_detection.detect_faces(img_bgr)
            if faces:
                landmarks = face_detection.extract_landmarks(img_bgr, faces[0])
                h, w = img_bgr.shape[:2]
                pose = estimate_pose(landmarks, (h, w))
                quality = quality_evaluator.evaluate(img_bgr, landmarks, pose, 1)
                face_width_ratio = float(faces[0].bbox[2]) / float(w) if w > 0 else 0.0
                fingerprint_hash, fingerprint_parts = build_session_fingerprint(
                    quality["flags"], pose, quality.get("mean_luminance", 0.0), face_width_ratio
                )
                baseline_group_id = generate_baseline_group_id(quality["flags"])
                sidecar = out_dir / f"{run_id}_fingerprint.json"
                sidecar.write_text(json.dumps({
                    "fingerprint": fingerprint_hash,
                    "fingerprint_parts": fingerprint_parts,
                    "baseline_group_id": baseline_group_id,
                }))
    except Exception:
        logger.debug("Fingerprint sidecar generation failed for run_id=%s (non-fatal)", run_id)

    return FullPipelineResponse(
        run_id=run_id,
        output_dir=str(out_dir),
        photo_url=canonical_url,
        result=result if isinstance(result, dict) else {"value": result},
    )


@router.post("/full-pipeline", response_model=FullPipelineResponse)
async def full_pipeline_json(
    req: FullPipelineRequest,
    storage: MinIOStorage | None = Depends(get_storage),
) -> FullPipelineResponse:
    try:
        image_bytes = base64.b64decode(req.image_base64.split(",", 1)[-1], validate=False)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid base64: {exc}") from exc
    return await _execute(image_bytes, req.filename or "upload.jpg", req.mode, storage)


@router.post("/full-pipeline/upload", response_model=FullPipelineResponse)
async def full_pipeline_upload(
    photo: UploadFile = File(...),
    mode: str = Form("premium"),
    storage: MinIOStorage | None = Depends(get_storage),
) -> FullPipelineResponse:
    image_bytes = await photo.read()
    return await _execute(image_bytes, photo.filename or "upload.jpg", mode, storage)
