"""Meta endpoints — capture guidelines, health probe."""
from __future__ import annotations

from fastapi import APIRouter

from app.vision.schemas.pipeline import CaptureGuidelines

router = APIRouter()

_GUIDELINES = CaptureGuidelines(
    title="Guia de Captura (estilo 3x4)",
    distance_meters="0.5m a 0.8m",
    zoom="2x quando possível (ou aproxime mantendo nitidez)",
    tips=[
        "Use iluminação frontal e homogênea (evite luz lateral forte).",
        "Mantenha o rosto centralizado e ocupando boa parte do quadro.",
        "Olhe para frente, sem inclinar muito cabeça ou câmera.",
        "Retire óculos escuros, boné e objetos cobrindo o rosto.",
        "Evite desfoque: apoie o celular e segure firme.",
        "A foto deve parecer uma 3x4: rosto dominante, fundo simples.",
    ],
)


@router.get("/capture-guidelines", response_model=CaptureGuidelines)
def capture_guidelines() -> CaptureGuidelines:
    return _GUIDELINES


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vision-service"}
