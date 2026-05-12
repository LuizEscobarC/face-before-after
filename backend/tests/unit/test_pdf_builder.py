"""Unit tests for PdfBuilder (PR-67, M4.5).

Covers:
  1. build() returns valid PDF bytes (starts with %PDF)
  2. Empty findings/recs/assets — still builds without error
  3. Full payload (findings + recs + disclaimer) — builds without error
  4. Multiple findings capped at 3 — does not crash
  5. Multiple recs capped at 5 — does not crash
  6. _score_color thresholds (>=7.5 cyan, >=5.5 amber, <5.5 red)
  7. _severity_badge_color maps known severity strings
  8. _severity_badge_color fallback for unknown string
  9. global_score 0.0 is handled (edge case)
 10. global_score 10.0 is handled (edge case)
 11. generated_at ISO-8601 parses without error
 12. generated_at invalid string doesn't crash (fallback path)
"""

from __future__ import annotations

import pytest

pytest.importorskip("reportlab")

from backend.app.vision.services.pdf_builder import (  # noqa: E402
    PdfBuilder,
    PdfReportData,
    _score_color,
    _severity_badge_color,
)

# ──────────────────────────────────────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────────────────────────────────────

MINIMAL: PdfReportData = {
    "report_id": "00000000-0000-0000-0000-000000000001",
    "generated_at": "2026-05-11T22:00:00Z",
    "global_score": 7.4,
    "findings": [],
    "recommendations": [],
    "disclaimer": "",
    "rendered_asset_urls": [],
}

FULL: PdfReportData = {
    "report_id": "00000000-0000-0000-0000-000000000002",
    "generated_at": "2026-05-11T22:00:00Z",
    "global_score": 6.2,
    "findings": [
        {
            "metric_id": "midline_deviation",
            "region_pt": "Eixo Facial",
            "severity_pt": "leve",
            "text_medium": "Pequeno desvio do eixo facial observado.",
        },
        {
            "metric_id": "jaw_width_ratio",
            "region_pt": "Mandíbula",
            "severity_pt": "moderado",
            "text_medium": "Relação largura mandíbula levemente fora do ideal.",
        },
        {
            "metric_id": "brow_height_l",
            "region_pt": "Sobrancelhas",
            "severity_pt": "considerável",
            "text_medium": "Diferença de altura entre as sobrancelhas observada.",
        },
    ],
    "recommendations": [
        {
            "recommendation_id": "posture-head-tilt",
            "display_text_short_pt": "Melhore a postura cervical.",
            "requires_professional": False,
            "professional_type": None,
            "category": "posture",
        },
        {
            "recommendation_id": "jaw-exercise",
            "display_text_short_pt": "Exercício de mioterapia mandibular.",
            "requires_professional": False,
            "professional_type": None,
            "category": "exercise",
        },
        {
            "recommendation_id": "refer-physio",
            "display_text_short_pt": "Consulta com fisioterapeuta.",
            "requires_professional": True,
            "professional_type": "physiotherapist",
            "category": "professional_referral",
        },
    ],
    "disclaimer": (
        "Esta análise é orientativa e não substitui avaliação profissional."
    ),
    "rendered_asset_urls": [],
}

# ──────────────────────────────────────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────────────────────────────────────


def _build(data: PdfReportData) -> bytes:
    return PdfBuilder().build(data)


# ──────────────────────────────────────────────────────────────────────────────
# Tests — build() output validity
# ──────────────────────────────────────────────────────────────────────────────


def test_build_returns_bytes():
    result = _build(MINIMAL)
    assert isinstance(result, bytes)


def test_build_starts_with_pdf_magic():
    result = _build(MINIMAL)
    assert result[:4] == b"%PDF", f"Expected PDF magic bytes, got {result[:4]!r}"


def test_build_nonempty():
    result = _build(MINIMAL)
    assert len(result) > 512, "PDF too small — likely empty or broken"


def test_build_minimal_no_error():
    """Empty findings/recs/disclaimer should not raise."""
    _build(MINIMAL)  # no exception


def test_build_full_payload_no_error():
    """Full payload with findings + recs + disclaimer should build OK."""
    _build(FULL)  # no exception


def test_build_full_is_larger_than_minimal():
    """A richer payload should produce a larger PDF."""
    size_min = len(_build(MINIMAL))
    size_full = len(_build(FULL))
    assert size_full > size_min


# ──────────────────────────────────────────────────────────────────────────────
# Tests — capping
# ──────────────────────────────────────────────────────────────────────────────


def test_build_caps_findings_at_3():
    """5 findings should be accepted without error (builder caps at 3 in output)."""
    data: PdfReportData = {
        **FULL,
        "findings": [
            {
                "metric_id": f"metric_{i}",
                "region_pt": f"Região {i}",
                "severity_pt": "leve",
                "text_medium": f"Observa-se achado {i}.",
            }
            for i in range(5)
        ],
    }
    result = _build(data)
    assert result[:4] == b"%PDF"


def test_build_caps_recs_at_5():
    """8 recommendations should be accepted without error (builder caps at 5)."""
    data: PdfReportData = {
        **MINIMAL,
        "recommendations": [
            {
                "recommendation_id": f"rec_{i}",
                "display_text_short_pt": f"Recomendação {i}.",
                "requires_professional": False,
                "professional_type": None,
                "category": "lifestyle",
            }
            for i in range(8)
        ],
    }
    result = _build(data)
    assert result[:4] == b"%PDF"


# ──────────────────────────────────────────────────────────────────────────────
# Tests — _score_color thresholds
# ──────────────────────────────────────────────────────────────────────────────


def test_score_color_high_is_cyan():
    from reportlab.lib import colors as rl_colors

    c = _score_color(7.5)
    assert c == rl_colors.HexColor("#22d3ee")


def test_score_color_medium_is_amber():
    from reportlab.lib import colors as rl_colors

    c = _score_color(5.5)
    assert c == rl_colors.HexColor("#f59e0b")


def test_score_color_low_is_red():
    from reportlab.lib import colors as rl_colors

    c = _score_color(3.0)
    assert c == rl_colors.HexColor("#f87171")


def test_score_color_boundary_7_5_is_cyan():
    from reportlab.lib import colors as rl_colors

    # exactly 7.5 → cyan
    assert _score_color(7.5) == rl_colors.HexColor("#22d3ee")


def test_score_color_boundary_5_49_is_red():
    from reportlab.lib import colors as rl_colors

    # 5.49 → below amber threshold → red
    assert _score_color(5.49) == rl_colors.HexColor("#f87171")


# ──────────────────────────────────────────────────────────────────────────────
# Tests — _severity_badge_color
# ──────────────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "severity_pt",
    ["mínimo", "leve", "moderado", "considerável", "extremo"],
)
def test_severity_badge_color_known_strings(severity_pt: str):
    from reportlab.lib import colors as rl_colors

    c = _severity_badge_color(severity_pt)
    # should not return the fallback slate
    assert c != rl_colors.HexColor("#94a3b8"), (
        f"severity_pt={severity_pt!r} returned fallback slate colour"
    )


def test_severity_badge_color_unknown_returns_slate():
    from reportlab.lib import colors as rl_colors

    c = _severity_badge_color("desconhecido")
    assert c == rl_colors.HexColor("#94a3b8")


def test_severity_badge_color_case_insensitive():
    """Case-insensitive comparison: 'LEVE' should map same as 'leve'."""
    assert _severity_badge_color("LEVE") == _severity_badge_color("leve")


# ──────────────────────────────────────────────────────────────────────────────
# Tests — edge-case scores
# ──────────────────────────────────────────────────────────────────────────────


def test_build_score_zero():
    data: PdfReportData = {**MINIMAL, "global_score": 0.0}
    result = _build(data)
    assert result[:4] == b"%PDF"


def test_build_score_ten():
    data: PdfReportData = {**MINIMAL, "global_score": 10.0}
    result = _build(data)
    assert result[:4] == b"%PDF"


# ──────────────────────────────────────────────────────────────────────────────
# Tests — generated_at parsing
# ──────────────────────────────────────────────────────────────────────────────


def test_build_iso_date_parses():
    data: PdfReportData = {**MINIMAL, "generated_at": "2026-01-15T08:30:00Z"}
    result = _build(data)
    assert result[:4] == b"%PDF"


def test_build_invalid_date_string_does_not_crash():
    """An unparseable date string must fall back gracefully, not raise."""
    data: PdfReportData = {**MINIMAL, "generated_at": "not-a-date"}
    result = _build(data)
    assert result[:4] == b"%PDF"
