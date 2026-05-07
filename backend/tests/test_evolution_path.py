"""Testes unitários para evolution_path.py."""

from __future__ import annotations

import pytest

from app.domain.layers.evolution_path import (
    build_evolution_path,
    get_mutable_metrics,
    _sev_rank,
    _get_metric_severity,
)
import app.domain.layers.recommendations as rec


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _base_metrics():
    return {
        "overall_asymmetry_score_pct_ipd": 3.0,
        "fwhr": 1.55,
        "canthal_tilt_mean_deg": -1.0,
        "lower_third_ratio": 0.48,
        "intercanthal_to_eyewidth_ratio": 1.3,
        "nasal_to_mouth_width_ratio": 0.85,
        "mouth_to_ipd_ratio": 1.20,
        "thirds_std_dev": 0.08,
        "fifths_std_dev": 0.05,
        "marquardt_deviation_pct_ipd": 4.0,
        "jaw_width_pct_ipd": 120.0,
        "jawline_definition_score": 0.25,
        "upper_lower_lip_ratio": 0.5,
        "philtrum_length_pct_ipd": 28.0,
    }


def _perfect_metrics():
    """Métricas dentro do ideal — nenhuma deve gerar ação."""
    return {
        "overall_asymmetry_score_pct_ipd": 0.0,
        "fwhr": 1.85,
        "canthal_tilt_mean_deg": 5.0,
        "lower_third_ratio": 0.56,
        "intercanthal_to_eyewidth_ratio": 1.0,
        "nasal_to_mouth_width_ratio": 0.70,
        "mouth_to_ipd_ratio": 1.50,
        "thirds_std_dev": 0.0,
        "fifths_std_dev": 0.0,
        "marquardt_deviation_pct_ipd": 0.0,
        "jaw_width_pct_ipd": 155.0,
        "jawline_definition_score": 0.65,
        "upper_lower_lip_ratio": 0.65,
        "philtrum_length_pct_ipd": 26.0,
    }


# ---------------------------------------------------------------------------
# _sev_rank
# ---------------------------------------------------------------------------

class TestSevRank:
    def test_excelente_is_zero(self):
        assert _sev_rank("excelente") == 0

    def test_severa_is_highest(self):
        assert _sev_rank("severa") == 4

    def test_ordering(self):
        assert _sev_rank("leve") < _sev_rank("moderada") < _sev_rank("acentuada")

    def test_unknown_returns_leve(self):
        assert _sev_rank("desconhecida") == 1


# ---------------------------------------------------------------------------
# _get_metric_severity
# ---------------------------------------------------------------------------

class TestGetMetricSeverity:
    def test_known_ideal_returns_excelente(self):
        # fwhr ideal = 1.85 ± 0.10
        assert _get_metric_severity("fwhr", 1.85) == "excelente"

    def test_known_far_from_ideal_not_excelente(self):
        # fwhr = 1.0 está muito abaixo do ideal (1.85 ± 0.10)
        sev = _get_metric_severity("fwhr", 1.0)
        assert sev != "excelente"

    def test_non_numeric_returns_excelente(self):
        assert _get_metric_severity("face_shape_label", "oval") == "excelente"

    def test_unknown_key_returns_leve(self):
        assert _get_metric_severity("unknown_key_xyz", 5.0) == "leve"


# ---------------------------------------------------------------------------
# get_mutable_metrics
# ---------------------------------------------------------------------------

class TestGetMutableMetrics:
    def test_returns_list(self):
        result = get_mutable_metrics(_base_metrics())
        assert isinstance(result, list)

    def test_perfect_metrics_returns_empty_or_small(self):
        result = get_mutable_metrics(_perfect_metrics())
        # Métricas ideais não devem gerar lista longa de problemas
        assert len(result) == 0

    def test_bad_metrics_returns_non_empty(self):
        result = get_mutable_metrics(_base_metrics())
        assert len(result) > 0

    def test_all_returned_keys_are_in_catalog(self):
        result = get_mutable_metrics(_base_metrics())
        for key in result:
            assert key in rec.REC_CATALOG, f"Chave {key} não está no catálogo"

    def test_all_returned_metrics_are_mutable(self):
        result = get_mutable_metrics(_base_metrics())
        for key in result:
            assert rec.REC_CATALOG[key].get("mutable", False), \
                f"Chave {key} não é mutável mas foi retornada"


# ---------------------------------------------------------------------------
# build_evolution_path — estrutura
# ---------------------------------------------------------------------------

class TestBuildEvolutionPathStructure:
    def test_returns_required_top_keys(self):
        result = build_evolution_path(_base_metrics(), rec.REC_CATALOG)
        for key in ("mutable_metrics", "phase_1", "phase_2", "phase_3"):
            assert key in result, f"Chave ausente: {key}"

    def test_each_phase_has_required_keys(self):
        result = build_evolution_path(_base_metrics(), rec.REC_CATALOG)
        phase_keys = {
            "label", "focus", "actions", "target_metric",
            "reanalysis_date", "reanalysis_label",
            "confidence_score", "confidence_label",
        }
        for phase in ("phase_1", "phase_2", "phase_3"):
            for key in phase_keys:
                assert key in result[phase], \
                    f"Fase {phase} faltando campo: {key}"

    def test_actions_is_list(self):
        result = build_evolution_path(_base_metrics(), rec.REC_CATALOG)
        for phase in ("phase_1", "phase_2", "phase_3"):
            assert isinstance(result[phase]["actions"], list)

    def test_mutable_metrics_is_list(self):
        result = build_evolution_path(_base_metrics(), rec.REC_CATALOG)
        assert isinstance(result["mutable_metrics"], list)


# ---------------------------------------------------------------------------
# build_evolution_path — confidence por fase
# ---------------------------------------------------------------------------

class TestPhaseConfidence:
    def test_confidence_score_in_range(self):
        result = build_evolution_path(_base_metrics(), rec.REC_CATALOG,
                                      capture_confidence=1.0)
        for phase in ("phase_1", "phase_2", "phase_3"):
            score = result[phase]["confidence_score"]
            assert 0.0 <= score <= 1.0, \
                f"{phase} confidence_score fora de [0,1]: {score}"

    def test_confidence_label_is_valid(self):
        valid_labels = {"muito provável", "provável", "possível", "desafiador"}
        result = build_evolution_path(_base_metrics(), rec.REC_CATALOG,
                                      capture_confidence=1.0)
        for phase in ("phase_1", "phase_2", "phase_3"):
            label = result[phase]["confidence_label"]
            assert label in valid_labels, \
                f"{phase} confidence_label inválido: {label!r}"

    def test_low_capture_confidence_lowers_phase_confidence(self):
        result_high = build_evolution_path(
            _base_metrics(), rec.REC_CATALOG, capture_confidence=1.0
        )
        result_low = build_evolution_path(
            _base_metrics(), rec.REC_CATALOG, capture_confidence=0.2
        )
        for phase in ("phase_1", "phase_2", "phase_3"):
            high_conf = result_high[phase]["confidence_score"]
            low_conf = result_low[phase]["confidence_score"]
            # Confiança de captura baixa deve reduzir ou igualar a confiança da fase
            assert low_conf <= high_conf + 0.01, \
                f"{phase}: confiança com captura baixa ({low_conf}) " \
                f"maior que com captura alta ({high_conf})"

    def test_phase_1_typically_higher_than_phase_3(self):
        """Fase 1 (hábitos imediatos) deve ter confiança >= fase 3 (profissional)."""
        result = build_evolution_path(_base_metrics(), rec.REC_CATALOG,
                                      capture_confidence=1.0)
        p1 = result["phase_1"]["confidence_score"]
        p3 = result["phase_3"]["confidence_score"]
        # Phase 3 com tier 2 (profissional) tende a ser menor ou igual
        assert p1 >= p3, f"Fase 1 ({p1}) não >= fase 3 ({p3})"

    def test_empty_metrics_does_not_raise(self):
        result = build_evolution_path({}, rec.REC_CATALOG, capture_confidence=0.5)
        assert "phase_1" in result
        assert result["phase_1"]["confidence_score"] == 0.0

    def test_perfect_metrics_all_phases_empty_or_zero_confidence(self):
        result = build_evolution_path(_perfect_metrics(), rec.REC_CATALOG,
                                      capture_confidence=1.0)
        # Métricas ideais → sem ações → confiança 0 (nada a fazer)
        for phase in ("phase_1", "phase_2", "phase_3"):
            assert result[phase]["confidence_score"] == 0.0
            assert result[phase]["actions"] == []


# ---------------------------------------------------------------------------
# build_evolution_path — datas
# ---------------------------------------------------------------------------

class TestPhaseReanalysisDates:
    def test_reanalysis_dates_are_isoformat(self):
        from datetime import date
        result = build_evolution_path(_base_metrics(), rec.REC_CATALOG)
        for phase in ("phase_1", "phase_2", "phase_3"):
            d_str = result[phase]["reanalysis_date"]
            # Deve ser parseable como date
            parsed = date.fromisoformat(d_str)
            assert parsed > date.today()

    def test_phase_3_date_after_phase_2(self):
        from datetime import date
        result = build_evolution_path(_base_metrics(), rec.REC_CATALOG)
        d2 = date.fromisoformat(result["phase_2"]["reanalysis_date"])
        d3 = date.fromisoformat(result["phase_3"]["reanalysis_date"])
        assert d3 > d2
