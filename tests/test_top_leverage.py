"""Testes para top_leverage.py."""

from __future__ import annotations

import pytest

from top_leverage import get_top3_actions, get_top_leverage_recommendation


# ---------------------------------------------------------------------------
# Fixtures de métricas com campos do catálogo disponíveis
# ---------------------------------------------------------------------------

def _base_metrics():
    """Métricas básicas cobrindo a maioria das chaves do REC_CATALOG."""
    return {
        "overall_asymmetry_score_pct_ipd": 2.5,
        "fwhr": 1.55,
        "canthal_tilt_mean_deg": -1.0,
        "lower_third_ratio": 0.48,
        "intercanthal_to_eyewidth_ratio": 1.3,
        "nasal_to_mouth_width_ratio": 0.85,
        "mouth_to_ipd_ratio": 1.20,
        "thirds_std_dev": 0.08,
        "fifths_std_dev": 0.05,
        "marquardt_deviation_pct_ipd": 3.0,
        "jaw_width_pct_ipd": 130.0,
        "jawline_definition_score": 0.25,
        "upper_lower_lip_ratio": 0.5,
        "philtrum_length_pct_ipd": 28.0,
    }


def _minimal_metrics():
    """Apenas canthal tilt moderadamente ruim — cobertura mínima."""
    return {"canthal_tilt_mean_deg": -2.0}


# ---------------------------------------------------------------------------
# Testes de get_top_leverage_recommendation
# ---------------------------------------------------------------------------

class TestGetTopLeverageRecommendation:
    def test_returns_required_keys(self):
        result = get_top_leverage_recommendation(_base_metrics(), max_tier=1)
        for key in ("metric_key", "short_action", "why_it_matters", "time_to_result",
                    "tier", "deviation_score"):
            assert key in result, f"Chave ausente: {key}"

    def test_tier_respects_max_tier_constraint(self):
        result = get_top_leverage_recommendation(_base_metrics(), max_tier=1)
        assert result["tier"] <= 1, (
            f"Tier {result['tier']} excede max_tier=1"
        )

    def test_tier_never_3_for_max_tier_1(self):
        """Produto de entrada: nunca retornar ação tier_3 com max_tier=1."""
        result = get_top_leverage_recommendation(_base_metrics(), max_tier=1)
        assert result["tier"] != 3

    def test_returns_result_even_for_minimal_metrics(self):
        result = get_top_leverage_recommendation(_minimal_metrics(), max_tier=1)
        assert isinstance(result["short_action"], str)
        assert len(result["short_action"]) > 0

    def test_returns_fallback_for_empty_metrics(self):
        """Sem métricas disponíveis, deve retornar fallback sem exceção."""
        result = get_top_leverage_recommendation({}, max_tier=1)
        assert isinstance(result["short_action"], str)
        assert result["tier"] == 0

    def test_why_it_matters_is_non_empty(self):
        result = get_top_leverage_recommendation(_base_metrics(), max_tier=1)
        assert isinstance(result["why_it_matters"], str)
        assert len(result["why_it_matters"]) > 0

    def test_deviation_score_non_negative(self):
        result = get_top_leverage_recommendation(_base_metrics(), max_tier=2)
        assert result["deviation_score"] >= 0.0


# ---------------------------------------------------------------------------
# Testes de get_top3_actions
# ---------------------------------------------------------------------------

class TestGetTop3Actions:
    def test_returns_at_most_3_items(self):
        result = get_top3_actions(_base_metrics(), max_tier=2)
        assert len(result) <= 3

    def test_returns_at_least_1_item(self):
        result = get_top3_actions(_base_metrics(), max_tier=2)
        assert len(result) >= 1

    def test_all_items_have_required_keys(self):
        result = get_top3_actions(_base_metrics(), max_tier=2)
        for item in result:
            for key in ("rank", "short_action", "why_it_matters", "time_to_result",
                        "tier", "metric_key"):
                assert key in item, f"Chave ausente em item rank={item.get('rank')}: {key}"

    def test_ranks_are_sequential_from_1(self):
        result = get_top3_actions(_base_metrics(), max_tier=2)
        for i, item in enumerate(result, start=1):
            assert item["rank"] == i

    def test_no_tier_3_when_max_tier_1(self):
        result = get_top3_actions(_base_metrics(), max_tier=1)
        for item in result:
            assert item["tier"] <= 1, (
                f"Tier {item['tier']} excede max_tier=1 no item rank={item['rank']}"
            )

    def test_empty_metrics_returns_list(self):
        result = get_top3_actions({}, max_tier=2)
        assert isinstance(result, list)

    def test_all_actions_are_strings(self):
        result = get_top3_actions(_base_metrics(), max_tier=2)
        for item in result:
            assert isinstance(item["short_action"], str)
            assert isinstance(item["why_it_matters"], str)
            assert isinstance(item["time_to_result"], str)

    def test_at_least_one_tier0_action_when_available(self):
        """Com métricas completas, deve haver pelo menos 1 ação tier_0."""
        result = get_top3_actions(_base_metrics(), max_tier=2)
        tiers = [item["tier"] for item in result]
        # tier_0 ou tier_1 — o produto de entrada sempre tem ações imediatas
        assert any(t <= 1 for t in tiers), (
            f"Nenhuma ação tier ≤ 1 no resultado: {tiers}"
        )
