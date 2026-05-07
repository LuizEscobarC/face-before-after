from __future__ import annotations

from fastapi import HTTPException


class FaceNotDetectedError(HTTPException):
    def __init__(self) -> None:
        super().__init__(status_code=400, detail="No face detected in the image.")


class InvalidImageError(HTTPException):
    def __init__(self, reason: str) -> None:
        super().__init__(status_code=400, detail=f"Invalid image: {reason}")


class FileTooLargeError(HTTPException):
    def __init__(self, limit_mb: int = 15) -> None:
        super().__init__(status_code=413, detail=f"File too large. Limit: {limit_mb}MB.")


class RunNotFoundError(HTTPException):
    def __init__(self, run_id: str) -> None:
        super().__init__(status_code=404, detail=f"Run '{run_id}' not found.")


class SimulationNotFoundError(HTTPException):
    def __init__(self, sim_type: str) -> None:
        super().__init__(status_code=404, detail=f"Simulation image '{sim_type}' not found.")


class InvalidSimulationTypeError(HTTPException):
    def __init__(self) -> None:
        super().__init__(
            status_code=400,
            detail="Invalid simulation type. Use: symmetrized, ideal_proportions, comparison_grid.",
        )
