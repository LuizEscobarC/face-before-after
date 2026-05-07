from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.logging import setup_logging
from app.vision.router import router as vision_router

setup_logging()

app = FastAPI(
    title="Face Vision Service",
    version="2.0.0",
    description=(
        "Microservice for face detection, landmark extraction, photo-quality "
        "evaluation and atomic facial metrics. Consumed by the NestJS orchestrator."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> dict:
    return {
        "service": "face-vision-service",
        "status": "ok",
        "endpoints": [
            "/vision/capture-guidelines",
            "/vision/health",
            "/vision/landmarks",
            "/vision/metrics",
            "/vision/full-pipeline",
            "/vision/full-pipeline/upload",
            "/vision/compare",
            "/vision/results/{run_id}/annotated",
            "/vision/results/{run_id}/simulation/{sim_type}",
        ],
    }


app.include_router(vision_router)

if __name__ == "__main__":
    import uvicorn
    from app.core.config import settings

    uvicorn.run("main:app", host=settings.api_host, port=settings.api_port, reload=True)
