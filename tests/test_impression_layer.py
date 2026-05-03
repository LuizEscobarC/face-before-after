"""Testes para impression_layer.py."""

from __future__ import annotations

import pytest

from impression_layer import build_first_impression


# ---------------------------------------------------------------------------
# Fixtures de métricas
# ---------------------------------------------------------------------------

def _metrics_tired():
    """Olhos caídos + area periorbital escura."""
    return {
        "canthal_tilt_mean_deg": -2.0,
        "under_eye_darkness_left": 0.20,
        "under_eye_darkness_right": 0.18,
        "fwhr": 1.85,
        "jawline_definition_score": 0.5,
        "skin_uniformity_std_lab_left": 12.0,
        "skin_uniformity_std_lab_right": 11.0,
        "overall_asymmetry_score_pct_ipd": 0.8,
        "eye_aspect_ratio_mean": 0.28,
    }


def _metrics_high_asymmetry():
    """Assimetria acima do limiar perceptível."""
    return {
        "canthal_tilt_mean_deg": 4.0,
        "under_eye_darkness_left": 0.08,
        "under_eye_darkness_right": 0.07,
        "fwhr": 1.9,
        "jawline_definition_score": 0.6,
        "skin_uniformity_std_lab_left": 10.0,
        "skin_uniformity_std_lab_right": 9.0,
        "overall_asymmetry_score_pct_ipd": 4.5,
        "eye_aspect_ratio_mean": 0.30,
    }


def _metrics_excellent():
    """Face praticamente ideal."""
    return {
        "canthal_tilt_mean_deg": 5.0,
        "under_eye_darkness_left": 0.04,
        "under_eye_darkness_right": 0.03,
        "fwhr": 1.88,
        "jawline_definition_score": 0.75,
        "skin_uniformity_std_lab_left": 8.0,
        "skin_uniformity_std_lab_right": 7.5,
        "overall_asymmetry_score_pct_ipd": 0.6,
        "eye_aspect_ratio_mean": 0.31,
    }


def _metrics_low_dominance():
    """Baixa presença/dominância."""
    return {
        "canthal_tilt_mean_deg": 2.0,
        "under_eye_darkness_left": 0.05,
        "under_eye_darkness_right": 0.06,
        "fwhr": 1.4,
        "jawline_definition_score": 0.2,
        "skin_uniformity_std_lab_left": 11.0,
        "skin_uniformity_std_lab_right": 12.0,
        "overall_asymmetry_score_pct_ipd": 1.5,
        "eye_aspect_ratio_mean": 0.29,
    }


# ---------------------------------------------------------------------------
# Testes de retorno de estrutura
# ---------------------------------------------------------------------------

class TestBuildFirstImpressionStructure:
    def test_returns_all_required_keys(self):
        result = build_first_impression(_metrics_excellent())
        assert "headline" in result
        assert "tags" in result
        assert "main_risk" in result
        assert "positive_signal" in result

    def test_headline_is_non_empty_string(self):
        result = build_first_impression(_metrics_excellent())
        assert isinstance(result["headline"], str)
        assert len(result["headline"]) > 0

    def test_tags_is_list(self):
        result = build_first_impression(_metrics_excellent())
        assert isinstance(result["tags"], list)

    def test_positive_signal_always_present(self):
        """positive_signal deve estar preenchido mesmo para métricas vazias."""
        result = build_first_impression({})
        assert isinstance(result["positive_signal"], str)
        assert len(result["positive_signal"]) > 0


# ---------------------------------------------------------------------------
# Testes de lógica de regras
# ---------------------------------------------------------------------------

class TestImpressionRules:
    def test_tired_eyes_tag_detected(self):
        result = build_first_impression(_metrics_tired())
        tags_lower = [t.lower() for t in result["tags"]]
        assert any("cansa" in t for t in tags_lower), (
            f"'aparência cansada' não encontrado em tags: {result['tags']}"
        )

    def test_high_asymmetry_risk_detected(self):
        result = build_first_impression(_metrics_high_asymmetry())
        assert "assimetria" in result["main_risk"].lower(), (
            f"Risco de assimetria não encontrado: {result['main_risk']}"
        )

    def test_excellent_metrics_no_critical_tags(self):
        result = build_first_impression(_metrics_excellent())
        negative_tags = {"aparência cansada", "assimetria visível", "pele irregular",
                         "presença suave", "olhos pouco abertos"}
        result_tags = set(result["tags"])
        overlap = negative_tags & result_tags
        assert len(overlap) == 0, f"Tags negativas inesperadas: {overlap}"

    def test_low_dominance_tag_present(self):
        result = build_first_impression(_metrics_low_dominance())
        tags_lower = [t.lower() for t in result["tags"]]
        assert any("presença" in t or "dominan" in t for t in tags_lower), (
            f"Tag de baixa presença não encontrada: {result['tags']}"
        )

    def test_excellent_headline_mentions_positive(self):
        result = build_first_impression(_metrics_excellent())
        # Sem riscos → headline deve mencionar algo positivo
        headline_lower = result["headline"].lower()
        positive_words = ["sólida", "solida", "positivo", "alto", "forte", "jovial",
                          "marcante", "uniforme", "qualidade"]
        assert any(w in headline_lower for w in positive_words), (
            f"Headline para métricas excelentes não soa positiva: {result['headline']}"
        )

    def test_empty_metrics_returns_defaults(self):
        """Sem métricas, deve retornar resultado sem exceção."""
        result = build_first_impression({})
        assert isinstance(result["headline"], str)
        assert isinstance(result["tags"], list)

    def test_main_risk_non_empty_when_risks_found(self):
        result = build_first_impression(_metrics_tired())
        assert len(result["main_risk"]) > 0
