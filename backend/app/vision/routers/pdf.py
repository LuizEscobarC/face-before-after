"""POST /vision/generate-pdf — PDF report generator (PR-60, M4.5).

Accepts the structured narrative data from the Nest orchestrator
(mirroring the GET /api/analysis/:id/narrative response shape from PR-59)
and returns a binary PDF.

Request body: JSON (``application/json``).

Shape matches :class:`app.vision.services.pdf_builder.PdfReportData`:

.. code-block:: json

    {
      "report_id": "uuid-string",
      "generated_at": "2025-01-01T00:00:00Z",
      "global_score": 7.4,
      "findings": [
        {
          "metric_id": "midline_deviation",
          "region_pt": "Eixo Facial",
          "severity_pt": "leve",
          "text_medium": "Pequeno desvio do eixo facial..."
        }
      ],
      "recommendations": [
        {
          "recommendation_id": "improve-head-posture",
          "display_text_short_pt": "Ajuste a postura da cabeça...",
          "requires_professional": false,
          "professional_type": null,
          "category": "posture"
        }
      ],
      "disclaimer": "Esta análise é orientativa e não...",
      "rendered_asset_urls": ["https://minio.../overlay.png"]
    }

Response: ``application/pdf``, binary PDF.

References:
    - PLAN_M4_NARRATIVE.md §2.4 (M4.5 backlog, PR-60)
    - app.vision.services.pdf_builder.PdfBuilder
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

from app.vision.services.pdf_builder import PdfBuilder, PdfReportData

router = APIRouter()


class FindingRequest(BaseModel):
    metric_id: str
    region_pt: str
    severity_pt: str
    text_medium: str


class RecommendationRequest(BaseModel):
    recommendation_id: str
    display_text_short_pt: str
    requires_professional: bool = False
    professional_type: str | None = None
    category: str = ""


class GeneratePdfRequest(BaseModel):
    report_id: str
    generated_at: str
    global_score: float
    findings: list[FindingRequest] = []
    recommendations: list[RecommendationRequest] = []
    disclaimer: str = ""
    rendered_asset_urls: list[str] = []


@router.post(
    "/generate-pdf",
    response_class=Response,
    responses={
        200: {
            "content": {"application/pdf": {}},
            "description": "PDF report binary",
        },
        422: {"description": "Validation error in request body"},
        500: {"description": "PDF generation failed"},
    },
    summary="Gera PDF do relatório de análise facial (PR-60 M4.5)",
    tags=["vision"],
)
async def generate_pdf(body: GeneratePdfRequest) -> Response:
    """
    Builds a structured PDF from narrative data.

    The PDF contains: capa → score global → top findings →
    rendered overlay images → recomendações → disclaimer.

    Input mirrors the shape returned by
    ``GET /api/analysis/:id/narrative`` (PR-59).
    """
    try:
        report_data: PdfReportData = {
            "report_id": body.report_id,
            "generated_at": body.generated_at,
            "global_score": body.global_score,
            "findings": [
                {
                    "metric_id": f.metric_id,
                    "region_pt": f.region_pt,
                    "severity_pt": f.severity_pt,
                    "text_medium": f.text_medium,
                }
                for f in body.findings
            ],
            "recommendations": [
                {
                    "recommendation_id": r.recommendation_id,
                    "display_text_short_pt": r.display_text_short_pt,
                    "requires_professional": r.requires_professional,
                    "professional_type": r.professional_type,
                    "category": r.category,
                }
                for r in body.recommendations
            ],
            "disclaimer": body.disclaimer,
            "rendered_asset_urls": body.rendered_asset_urls,
        }

        pdf_bytes = PdfBuilder().build(report_data)

        filename = f"relatorio_analise_{body.report_id[:8]}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(pdf_bytes)),
            },
        )

    except ImportError as exc:
        raise HTTPException(
            status_code=500,
            detail=(
                "ReportLab not installed. Add 'reportlab>=4.2.0' to "
                "pyproject.toml and rebuild the vision-service image."
            ),
        ) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {exc}",
        ) from exc
