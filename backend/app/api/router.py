from __future__ import annotations

from fastapi import APIRouter

from app.api.endpoints import analysis, compare, meta, results

router = APIRouter()

router.include_router(meta.router)
router.include_router(analysis.router, prefix="/api/analyze")
router.include_router(results.router, prefix="/api/result")
router.include_router(compare.router, prefix="/api")
