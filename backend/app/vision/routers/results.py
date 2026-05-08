"""GET /vision/results/* — serve generated images per run_id (annotated, simulations)."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.exceptions import (
    InvalidSimulationTypeError,
    RunNotFoundError,
    SimulationNotFoundError,
)

router = APIRouter()

_SIM_PATTERNS: dict[str, str] = {
    "canonical": "*_canonical.jpg",
    "symmetrized": "*_symmetrized.jpg",
    "ideal_proportions": "*_ideal_proportions.jpg",
    "comparison_grid": "*_comparison_grid.jpg",
}


def _resolve_run_dir(run_id: str) -> Path:
    run_dir = Path(settings.resultado_api_dir) / run_id
    if not run_dir.exists():
        raise RunNotFoundError(run_id)
    return run_dir


@router.get("/results/{run_id}/original")
def get_original_image(run_id: str) -> FileResponse:
    run_dir = _resolve_run_dir(run_id)
    # Prefer the canonical (aligned) crop; fall back to raw input
    matches = (
        list(run_dir.glob("*_canonical.jpg"))
        or list(run_dir.glob("*_canonical.png"))
        or [
            p for p in run_dir.iterdir()
            if p.suffix.lower() in {".jpg", ".jpeg", ".png"}
            and not any(tag in p.stem for tag in ("annotated", "symmetrized", "ideal", "comparison", "grid", "report"))
        ]
    )
    if not matches:
        raise SimulationNotFoundError("original")
    return FileResponse(matches[0], media_type="image/jpeg")


@router.get("/results/{run_id}/annotated")
def get_annotated_image(run_id: str) -> FileResponse:
    run_dir = _resolve_run_dir(run_id)
    matches = list(run_dir.glob("*_mvp_annotated.jpg")) or list(run_dir.glob("*_annotated.jpg"))
    if not matches:
        raise SimulationNotFoundError("annotated")
    return FileResponse(matches[0], media_type="image/jpeg")


@router.get("/results/{run_id}/simulation/{sim_type}")
def get_simulation_image(run_id: str, sim_type: str) -> FileResponse:
    if sim_type not in _SIM_PATTERNS:
        raise InvalidSimulationTypeError()
    run_dir = _resolve_run_dir(run_id)
    matches = list(run_dir.glob(_SIM_PATTERNS[sim_type]))
    if not matches:
        raise SimulationNotFoundError(sim_type)
    return FileResponse(matches[0], media_type="image/jpeg")
