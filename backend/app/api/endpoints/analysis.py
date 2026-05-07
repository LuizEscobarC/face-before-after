from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

import app.domain.pipeline as pipeline
from app.api.deps import get_storage
from app.core.config import settings
from app.core.exceptions import FileTooLargeError, InvalidImageError
from app.infra.storage import MinIOStorage

logger = logging.getLogger(__name__)

router = APIRouter()

_ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
_MAX_UPLOAD_BYTES = 15 * 1024 * 1024


def _validate_upload(upload: UploadFile, raw: bytes) -> None:
    filename = upload.filename or "upload.jpg"
    ext = Path(filename).suffix.lower()
    if ext not in _ALLOWED_EXTENSIONS:
        raise InvalidImageError(f"Format not supported: {ext or 'no extension'}. Use PNG/JPG/JPEG.")
    if len(raw) == 0:
        raise InvalidImageError("Empty file.")
    if len(raw) > _MAX_UPLOAD_BYTES:
        raise FileTooLargeError(limit_mb=15)


async def _run_analysis(upload: UploadFile, mode: str, storage: MinIOStorage | None) -> dict:
    raw = await upload.read()
    _validate_upload(upload, raw)

    run_id = uuid.uuid4().hex[:12]
    out_dir = Path(settings.resultado_api_dir) / run_id
    out_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(upload.filename or "upload.jpg").name
    input_path = out_dir / safe_name
    input_path.write_bytes(raw)

    try:
        result = await asyncio.to_thread(pipeline.run, str(input_path), str(out_dir), mode)
    except SystemExit as exc:
        raise HTTPException(status_code=400, detail=f"Analysis failed: {exc}") from exc
    except Exception as exc:
        logger.exception("Pipeline error for run_id=%s", run_id)
        raise HTTPException(status_code=500, detail=f"Internal error: {exc}") from exc

    result["photo_url"] = None
    if storage:
        try:
            minio_path = f"uploads/{run_id}/{safe_name}"
            storage.upload_file(raw, minio_path)
            result["photo_url"] = f"minio://{minio_path}"
        except Exception:
            logger.warning("MinIO upload failed for run_id=%s", run_id)

    result["run_id"] = run_id
    result["output_dir"] = str(out_dir)
    return result


@router.post("/free", tags=["analysis"])
async def analyze_free(
    photo: UploadFile = File(...),
    storage: MinIOStorage | None = Depends(get_storage),
) -> dict:
    return await _run_analysis(photo, mode="teaser", storage=storage)


@router.post("/premium", tags=["analysis"])
async def analyze_premium(
    photo: UploadFile = File(...),
    storage: MinIOStorage | None = Depends(get_storage),
) -> dict:
    return await _run_analysis(photo, mode="premium", storage=storage)
