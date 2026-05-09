"""PR-60 — M4.5 PDF Builder (ReportLab)

Generates a structured analysis report PDF from narrative data and
rendered asset URLs. Uses ReportLab exclusively — no system dependencies.

Output structure:
  Page 1 — Capa (title, score global, date)
  Page 2 — Score global + regional breakdown
  Page 3+ — Top findings (text, medium size, one per section)
  After findings — Rendered overlay/heatmap images (if provided)
  Before last — Recomendações (top-5, text short)
  Last — Disclaimer

Usage:
    from app.vision.services.pdf_builder import PdfBuilder
    pdf_bytes = PdfBuilder().build(report_data)

``report_data`` is a :class:`PdfReportData` typed dict.

References:
    - PLAN_M4_NARRATIVE.md §2.4 (M4.5 backlog, PR-60)
    - ReportLab User Guide §1–4 (basic platypus + styles)
"""
from __future__ import annotations

import io
import textwrap
from datetime import datetime
from typing import TypedDict

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

# ──────────────────────────────────────────────────────────────────────────────
# Typed dicts — matches the narrative endpoint response shape (PR-59)
# ──────────────────────────────────────────────────────────────────────────────


class FindingData(TypedDict):
    metric_id: str
    region_pt: str
    severity_pt: str
    text_medium: str


class RecommendationData(TypedDict):
    recommendation_id: str
    display_text_short_pt: str
    requires_professional: bool
    professional_type: str | None
    category: str


class PdfReportData(TypedDict):
    report_id: str
    generated_at: str          # ISO-8601 string
    global_score: float        # 0–10
    findings: list[FindingData]
    recommendations: list[RecommendationData]
    disclaimer: str
    rendered_asset_urls: list[str]   # optional PNG URLs, downloaded and embedded


# ──────────────────────────────────────────────────────────────────────────────
# Design tokens (matches frontend --accent #6366f1 / dark theme spirit,
# but PDF uses CMYK-safe palette)
# ──────────────────────────────────────────────────────────────────────────────
_INDIGO = colors.HexColor("#6366f1")       # --accent
_CYAN = colors.HexColor("#22d3ee")         # --accent2
_DARK = colors.HexColor("#1c1c2e")         # --surface2
_SLATE = colors.HexColor("#94a3b8")        # --muted
_WHITE = colors.white
_TEXT = colors.HexColor("#1e293b")         # readable dark for white paper

_PAGE_W, _PAGE_H = A4
_MARGIN = 20 * mm


# ──────────────────────────────────────────────────────────────────────────────
# Style factory
# ──────────────────────────────────────────────────────────────────────────────


def _build_styles() -> dict[str, ParagraphStyle]:
    base = getSampleStyleSheet()

    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Normal"],
            fontSize=28,
            leading=34,
            textColor=_INDIGO,
            alignment=TA_CENTER,
            spaceAfter=6 * mm,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontSize=14,
            leading=18,
            textColor=_SLATE,
            alignment=TA_CENTER,
            spaceAfter=4 * mm,
        ),
        "score_large": ParagraphStyle(
            "ScoreLarge",
            parent=base["Normal"],
            fontSize=52,
            leading=60,
            textColor=_INDIGO,
            alignment=TA_CENTER,
        ),
        "section_heading": ParagraphStyle(
            "SectionHeading",
            parent=base["Normal"],
            fontSize=14,
            leading=18,
            textColor=_DARK,
            spaceAfter=3 * mm,
            spaceBefore=6 * mm,
            fontName="Helvetica-Bold",
        ),
        "finding_title": ParagraphStyle(
            "FindingTitle",
            parent=base["Normal"],
            fontSize=11,
            leading=14,
            textColor=_INDIGO,
            fontName="Helvetica-Bold",
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontSize=10,
            leading=14,
            textColor=_TEXT,
            alignment=TA_JUSTIFY,
            spaceAfter=3 * mm,
        ),
        "muted": ParagraphStyle(
            "Muted",
            parent=base["Normal"],
            fontSize=8,
            leading=11,
            textColor=_SLATE,
            alignment=TA_LEFT,
            spaceAfter=2 * mm,
        ),
        "disclaimer": ParagraphStyle(
            "Disclaimer",
            parent=base["Normal"],
            fontSize=7.5,
            leading=10,
            textColor=_SLATE,
            alignment=TA_JUSTIFY,
            borderPadding=(4, 6, 4, 6),
        ),
        "rec_item": ParagraphStyle(
            "RecItem",
            parent=base["Normal"],
            fontSize=10,
            leading=14,
            textColor=_TEXT,
            spaceAfter=2 * mm,
            leftIndent=4 * mm,
        ),
    }


# ──────────────────────────────────────────────────────────────────────────────
# Score colour helper
# ──────────────────────────────────────────────────────────────────────────────


def _score_color(score: float) -> colors.Color:
    if score >= 7.5:
        return colors.HexColor("#22d3ee")   # cyan – good
    if score >= 5.5:
        return colors.HexColor("#f59e0b")   # amber – moderate
    return colors.HexColor("#f87171")       # red – low


def _severity_badge_color(severity_pt: str) -> colors.Color:
    mapping = {
        "mínimo": colors.HexColor("#6ee7b7"),
        "leve": colors.HexColor("#86efac"),
        "moderado": colors.HexColor("#fbbf24"),
        "considerável": colors.HexColor("#f87171"),
        "extremo": colors.HexColor("#ef4444"),
    }
    return mapping.get(severity_pt.lower(), _SLATE)


# ──────────────────────────────────────────────────────────────────────────────
# Image fetcher
# ──────────────────────────────────────────────────────────────────────────────


def _fetch_image_bytes(url: str) -> bytes | None:
    """Download an image from a URL. Returns None on any error."""
    try:
        import urllib.request
        with urllib.request.urlopen(url, timeout=10) as resp:  # noqa: S310
            return resp.read()
    except Exception:  # noqa: BLE001
        return None


# ──────────────────────────────────────────────────────────────────────────────
# PdfBuilder
# ──────────────────────────────────────────────────────────────────────────────


class PdfBuilder:
    """Assembles a PDF analysis report from ``PdfReportData``."""

    def build(self, data: PdfReportData) -> bytes:
        """Return the PDF as raw bytes. Never writes to disk."""
        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=_MARGIN,
            rightMargin=_MARGIN,
            topMargin=_MARGIN,
            bottomMargin=_MARGIN,
            title=f"Relatório de Análise Facial — {data['report_id'][:8]}",
            author="Face Analysis System",
            subject="Análise de proporções faciais",
        )

        styles = _build_styles()
        story: list = []

        story.extend(self._build_cover(data, styles))
        story.append(PageBreak())
        story.extend(self._build_findings(data, styles))
        story.extend(self._build_rendered_assets(data))
        story.extend(self._build_recommendations(data, styles))
        story.append(PageBreak())
        story.extend(self._build_disclaimer(data, styles))

        doc.build(story)
        return buf.getvalue()

    # ── Capa ─────────────────────────────────────────────────────────────────

    def _build_cover(
        self, data: PdfReportData, styles: dict[str, ParagraphStyle]
    ) -> list:
        generated = data.get("generated_at", "")
        try:
            dt = datetime.fromisoformat(generated.replace("Z", "+00:00"))
            date_str = dt.strftime("%d/%m/%Y")
        except (ValueError, AttributeError):
            date_str = generated[:10] if generated else "—"

        score = data.get("global_score", 0.0)
        score_color = _score_color(score)

        cover: list = [
            Spacer(1, 20 * mm),
            Paragraph("Análise de Proporções Faciais", styles["title"]),
            Paragraph("Relatório gerado por processamento computacional", styles["subtitle"]),
            Spacer(1, 10 * mm),
            HRFlowable(width="100%", thickness=1, color=_INDIGO, spaceAfter=8 * mm),
            Paragraph("Score Global", styles["section_heading"]),
            Paragraph(
                f'<font color="{score_color.hexval() if hasattr(score_color, "hexval") else "#6366f1"}">'
                f"<b>{score:.1f}</b></font>&nbsp;<font size='18' color='#94a3b8'>/&nbsp;10</font>",
                ParagraphStyle(
                    "ScoreInline",
                    parent=styles["body"],
                    fontSize=48,
                    leading=56,
                    alignment=TA_CENTER,
                ),
            ),
            Spacer(1, 8 * mm),
            Paragraph(f"ID do relatório: {data['report_id'][:16]}…", styles["muted"]),
            Paragraph(f"Gerado em: {date_str}", styles["muted"]),
            Spacer(1, 12 * mm),
            HRFlowable(width="100%", thickness=0.5, color=_SLATE),
        ]
        return cover

    # ── Findings ─────────────────────────────────────────────────────────────

    def _build_findings(
        self, data: PdfReportData, styles: dict[str, ParagraphStyle]
    ) -> list:
        findings = data.get("findings", [])
        if not findings:
            return []

        elements: list = [
            Paragraph("Principais Achados", styles["section_heading"]),
            HRFlowable(width="100%", thickness=0.5, color=_INDIGO, spaceAfter=4 * mm),
        ]

        for i, finding in enumerate(findings[:3], start=1):
            region = finding.get("region_pt", "—")
            severity = finding.get("severity_pt", "—")
            text = finding.get("text_medium", "—")
            sev_color = _severity_badge_color(severity)

            badge_table = Table(
                [[Paragraph(severity.upper(), ParagraphStyle(
                    "Badge",
                    parent=styles["muted"],
                    fontSize=7,
                    textColor=_WHITE,
                    alignment=TA_CENTER,
                    fontName="Helvetica-Bold",
                ))]],
                colWidths=[22 * mm],
                rowHeights=[5 * mm],
            )
            badge_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), sev_color),
                ("ROUNDEDCORNERS", [3]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]))

            elements.append(
                Paragraph(f"{i}. {region}", styles["finding_title"])
            )
            elements.append(badge_table)
            elements.append(Spacer(1, 2 * mm))
            elements.append(Paragraph(text, styles["body"]))
            elements.append(HRFlowable(
                width="80%", thickness=0.3, color=_SLATE, spaceAfter=3 * mm
            ))

        return elements

    # ── Rendered assets (overlays / heatmaps) ────────────────────────────────

    def _build_rendered_assets(self, data: PdfReportData) -> list:
        urls = data.get("rendered_asset_urls", [])
        if not urls:
            return []

        elements: list = [PageBreak()]
        usable_width = _PAGE_W - 2 * _MARGIN

        for url in urls[:4]:   # cap at 4 images to keep PDF manageable
            img_bytes = _fetch_image_bytes(url)
            if not img_bytes:
                continue
            buf = io.BytesIO(img_bytes)
            try:
                img = Image(buf, width=usable_width, height=usable_width * 0.6)
                elements.append(img)
                elements.append(Spacer(1, 4 * mm))
            except Exception:  # noqa: BLE001
                continue

        return elements

    # ── Recomendações ────────────────────────────────────────────────────────

    def _build_recommendations(
        self, data: PdfReportData, styles: dict[str, ParagraphStyle]
    ) -> list:
        recs = data.get("recommendations", [])
        if not recs:
            return []

        elements: list = [
            Spacer(1, 6 * mm),
            Paragraph("Recomendações", styles["section_heading"]),
            HRFlowable(width="100%", thickness=0.5, color=_CYAN, spaceAfter=4 * mm),
        ]

        for i, rec in enumerate(recs[:5], start=1):
            text = rec.get("display_text_short_pt", "—")
            requires_prof = rec.get("requires_professional", False)
            prof_type = rec.get("professional_type")
            category = rec.get("category", "")

            # Professional referral gets an extra note
            if requires_prof and prof_type:
                note = f" <font color='#f59e0b'>[Avaliação profissional sugerida: {prof_type}]</font>"
            elif category == "professional_referral":
                note = " <font color='#f59e0b'>[Avaliação profissional sugerida]</font>"
            else:
                note = ""

            elements.append(
                Paragraph(f"{i}. {text}{note}", styles["rec_item"])
            )

        if any(r.get("requires_professional") or r.get("category") == "professional_referral"
               for r in recs[:5]):
            elements.append(Spacer(1, 2 * mm))
            elements.append(Paragraph(
                "* Esta sugestão de buscar avaliação profissional é genérica e não substitui "
                "consulta com profissional qualificado. (DEC-35)",
                styles["muted"],
            ))

        return elements

    # ── Disclaimer ───────────────────────────────────────────────────────────

    def _build_disclaimer(
        self, data: PdfReportData, styles: dict[str, ParagraphStyle]
    ) -> list:
        disclaimer = data.get("disclaimer", "")
        if not disclaimer:
            return []

        return [
            Paragraph("Aviso Legal", styles["section_heading"]),
            HRFlowable(width="100%", thickness=0.5, color=_SLATE, spaceAfter=3 * mm),
            Paragraph(disclaimer, styles["disclaimer"]),
        ]
