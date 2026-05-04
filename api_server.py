#!/usr/bin/env python3
"""API HTTP para análise facial Free/Premium.

Endpoints:
- POST /api/analyze/free
- POST /api/analyze/premium
- GET  /api/capture-guidelines
"""

from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import mvp_pipeline as pipeline

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg"}
MAX_UPLOAD_BYTES = 15 * 1024 * 1024

GUIDELINES = {
    "title": "Guia de Captura (estilo 3x4)",
    "distance_meters": "0.5m a 0.8m",
    "zoom": "2x quando possível (ou aproxime mantendo nitidez)",
    "tips": [
        "Use iluminação frontal e homogênea (evite luz lateral forte).",
        "Mantenha o rosto centralizado e ocupando boa parte do quadro.",
        "Olhe para frente, sem inclinar muito cabeça ou câmera.",
        "Retire óculos escuros, boné e objetos cobrindo o rosto.",
        "Evite desfoque: apoie o celular e segure firme.",
        "A foto deve parecer uma 3x4: rosto dominante, fundo simples.",
    ],
}

app = FastAPI(title="Face Before/After API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _validate_upload(upload: UploadFile, raw: bytes) -> None:
    filename = upload.filename or "upload.jpg"
    ext = Path(filename).suffix.lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato inválido. Use PNG/JPG/JPEG (recebido: {ext or 'sem extensão'}).",
        )

    if len(raw) == 0:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")

    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Arquivo muito grande. Limite de 15MB.",
        )


def _run_analysis(upload: UploadFile, mode: str) -> dict:
    raw = upload.file.read()
    _validate_upload(upload, raw)

    run_id = uuid.uuid4().hex[:12]
    out_dir = Path("resultado_api") / run_id
    out_dir.mkdir(parents=True, exist_ok=True)

    safe_name = Path(upload.filename or "upload.jpg").name
    input_path = out_dir / safe_name
    input_path.write_bytes(raw)

    try:
        result = pipeline.run(str(input_path), str(out_dir), mode=mode)
    except SystemExit as exc:
        raise HTTPException(status_code=400, detail=f"Falha na análise: {exc}") from exc
    except Exception as exc:  # pragma: no cover - segurança de borda
        raise HTTPException(status_code=500, detail=f"Erro interno: {exc}") from exc

    result["run_id"] = run_id
    result["output_dir"] = str(out_dir)
    return result


@app.get("/")
def root() -> dict:
    return {
        "service": "face-before-after-api",
        "status": "ok",
        "endpoints": [
            "/api/analyze/free",
            "/api/analyze/premium",
            "/api/capture-guidelines",
        ],
    }


@app.get("/api/capture-guidelines")
def capture_guidelines() -> dict:
    return GUIDELINES


@app.post("/api/analyze/free")
def analyze_free(photo: UploadFile = File(...)) -> dict:
    return _run_analysis(photo, mode="teaser")


@app.post("/api/analyze/premium")
def analyze_premium(photo: UploadFile = File(...)) -> dict:
    return _run_analysis(photo, mode="premium")


if __name__ == "__main__":
    import uvicorn

    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    uvicorn.run("api_server:app", host=host, port=port, reload=True)
