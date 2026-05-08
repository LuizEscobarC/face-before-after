"""POST /vision/compare — compares two prior MVP runs by run_id."""
from __future__ import annotations

import glob
import json
import re
from pathlib import Path

from fastapi import APIRouter

import app.reports.compare as cr
from app.core.config import settings
from app.core.exceptions import RunNotFoundError
from app.vision.schemas.pipeline import CompareRequest
from app.vision.services.fingerprint import compute_consistency_score

router = APIRouter()

_VALID_RUN_ID = re.compile(r"^[a-f0-9]{12}$")


def _load_report(run_id: str) -> dict:
    if not _VALID_RUN_ID.match(run_id):
        from fastapi import HTTPException

        raise HTTPException(status_code=400, detail=f"Invalid run_id: {run_id}")
    pattern = str(Path(settings.resultado_api_dir) / run_id / "*_mvp_report.json")
    matches = glob.glob(pattern)
    if not matches:
        raise RunNotFoundError(run_id)
    with open(matches[0], encoding="utf-8") as f:
        return json.load(f)


def _load_fingerprint_sidecar(run_id: str) -> dict:
    sidecar = Path(settings.resultado_api_dir) / run_id / f"{run_id}_fingerprint.json"
    try:
        with open(sidecar, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


@router.post("/compare")
def compare_runs(req: CompareRequest) -> dict:
    report_before = _load_report(req.run_id_before)
    report_after = _load_report(req.run_id_after)
    compare_result = cr.compare_json(report_before, report_after)

    sidecar_before = _load_fingerprint_sidecar(req.run_id_before)
    sidecar_after = _load_fingerprint_sidecar(req.run_id_after)
    consistency = compute_consistency_score(
        sidecar_before.get("fingerprint_parts") or [],
        sidecar_after.get("fingerprint_parts") or [],
    )

    return {
        **compare_result,
        "consistency_score": consistency["consistency_score"],
        "consistency_issues": consistency["consistency_issues"],
        "is_comparable": consistency["is_comparable"],
        "baseline_group_id_before": sidecar_before.get("baseline_group_id"),
        "baseline_group_id_after": sidecar_after.get("baseline_group_id"),
    }

