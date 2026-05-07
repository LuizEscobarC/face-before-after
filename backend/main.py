from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import router
from app.core.logging import setup_logging

setup_logging()

app = FastAPI(
    title="Face Before/After API",
    version="1.0.0",
    description="Facial symmetry & metrics analysis API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    from app.core.config import settings

    uvicorn.run("main:app", host=settings.api_host, port=settings.api_port, reload=True)
