from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.exceptions import RunNotFoundError, SimulationNotFoundError, InvalidSimulationTypeError

router = APIRouter()

_SIM_PATTERNS: dict[str, str] = {
    "symmetrized": "*_symmetrized.jpg",
    "ideal_proportions": "*_ideal_proportions.jpg",
    "comparison_grid": "*_comparison_grid.jpg",
}


def _resolve_run_dir(run_id: str) -> Path:
    run_dir = Path(settings.resultado_api_dir) / run_id
    if not run_dir.exists():
        raise RunNotFoundError(run_id)
    return run_dir


@router.get("/{run_id}/annotated", tags=["results"])
def get_annotated_image(run_id: str) -> FileResponse:
    run_dir = _resolve_run_dir(run_id)
    matches = list(run_dir.glob("*_mvp_annotated.jpg")) or list(run_dir.glob("*_annotated.jpg"))
    if not matches:
        raise SimulationNotFoundError("annotated")
    return FileResponse(matches[0], media_type="image/jpeg")


@router.get("/{run_id}/simulation/{sim_type}", tags=["results"])
def get_simulation_image(run_id: str, sim_type: str) -> FileResponse:
    if sim_type not in _SIM_PATTERNS:
        raise InvalidSimulationTypeError()
    run_dir = _resolve_run_dir(run_id)
    matches = list(run_dir.glob(_SIM_PATTERNS[sim_type]))
    if not matches:
        raise SimulationNotFoundError(sim_type)
    return FileResponse(matches[0], media_type="image/jpeg")
