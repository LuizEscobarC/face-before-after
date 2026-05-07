from __future__ import annotations

from fastapi import APIRouter

from app.vision.routers import compare, full_pipeline, landmarks, meta, metrics, results

router = APIRouter(prefix="/vision", tags=["vision"])

router.include_router(meta.router)
router.include_router(landmarks.router)
router.include_router(metrics.router)
router.include_router(full_pipeline.router)
router.include_router(compare.router)
router.include_router(results.router)
