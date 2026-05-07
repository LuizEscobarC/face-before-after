"""POST /vision/full-pipeline — transition endpoint reusing the existing MVP pipeline.

Accepts both multipart upload (legacy) and JSON base64 (preferred for
service-to-service calls from NestJS).
"""
from __future__ import annotations

import asyncio
import base64
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

import app.domain.pipeline as pipeline
from app.api.deps import get_storage
from app.core.config import settings
from app.core.exceptions import FileTooLargeError, InvalidImageError
from app.infra.storage import MinIOStorage
from app.vision.schemas.pipeline import FullPipelineRequest, FullPipelineResponse

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

    photo_url: str | None = None
    if storage:
        try:
            minio_path = f"uploads/{run_id}/{safe_name}"
            storage.upload_file(image_bytes, minio_path)
            photo_url = f"minio://{minio_path}"
        except Exception:
            logger.warning("MinIO upload failed for run_id=%s", run_id)
        except Exception:
            logger.warning("MinIO upload failed for run_id=%s", run_id)

    if isinstance(result, dict):
        result["run_id"] = run_id
        result["output_dir"] = str(out_dir)
        result["photo_url"] = photo_url

    return FullPipelineResponse(
        run_id=run_id,
        output_dir=str(out_dir),
        photo_url=photo_url,
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
