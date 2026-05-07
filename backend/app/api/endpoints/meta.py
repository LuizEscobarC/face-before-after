from __future__ import annotations

from fastapi import APIRouter

from app.domain.layers.glossary import GLOSSARY

router = APIRouter()

_GUIDELINES = {
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


@router.get("/")
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


@router.get("/api/capture-guidelines")
def capture_guidelines() -> dict:
    return _GUIDELINES


@router.get("/api/glossary")
def get_glossary() -> dict:
    return GLOSSARY
