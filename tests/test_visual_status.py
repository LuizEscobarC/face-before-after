"""Testes para visual_status.py."""

from __future__ import annotations

import pytest

from visual_status import (
    build_visual_status,
    compute_attractiveness_score,
    compute_dominance_score,
    compute_freshness_score,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

def _metrics_dominant():
    return {
        "fwhr": 2.0,
        "jawline_definition_score": 0.8,
        "bizygomatic_to_bigonial_ratio": 1.3,
    }


def _metrics_attractive():
    return {
        "canthal_tilt_mean_deg": 5.0,
        "overall_asymmetry_score_pct_ipd": 0.5,
        "thirds_std_dev": 0.01,
    }


def _metrics_fresh():
    return {
        "skin_uniformity_std_lab_left": 8.0,
        "skin_uniformity_std_lab_right": 7.5,
        "under_eye_darkness_left": 0.03,
        "under_eye_darkness_right": 0.03,
        "eye_aspect_ratio_mean": 0.32,
    }


def _metrics_tired_unattractive():
    return {
        "canthal_tilt_mean_deg": -3.0,
        "overall_asymmetry_score_pct_ipd": 5.0,
        "thirds_std_dev": 0.20,
        "skin_uniformity_std_lab_left": 28.0,
        "skin_uniformity_std_lab_right": 26.0,
        "under_eye_darkness_left": 0.30,
        "under_eye_darkness_right": 0.28,
        "eye_aspect_ratio_mean": 0.18,
        "fwhr": 1.45,
        "jawline_definition_score": 0.15,
        "bizygomatic_to_bigonial_ratio": 1.3,
    }


# ---------------------------------------------------------------------------
# Testes de range 0–10
# ---------------------------------------------------------------------------

class TestScoreRange:
    def test_dominance_score_is_in_range(self):
        for metrics in [_metrics_dominant(), _metrics_tired_unattractive(), {}]:
            score = compute_dominance_score(metrics)
            assert 0.0 <= score <= 10.0, f"Dominance out of range: {score}"

    def test_attractiveness_score_is_in_range(self):
        for metrics in [_metrics_attractive(), _metrics_tired_unattractive(), {}]:
            score = compute_attractiveness_score(metrics)
            assert 0.0 <= score <= 10.0, f"Attractiveness out of range: {score}"

    def test_freshness_score_is_in_range(self):
        for metrics in [_metrics_fresh(), _metrics_tired_unattractive(), {}]:
            score = compute_freshness_score(metrics)
            assert 0.0 <= score <= 10.0, f"Freshness out of range: {score}"


# ---------------------------------------------------------------------------
# Testes de lógica de scores
# ---------------------------------------------------------------------------

class TestDominanceScore:
    def test_high_fwhr_high_jaw_gives_high_score(self):
        score = compute_dominance_score(_metrics_dominant())
        assert score > 7.0, f"Score esperado > 7, obtido: {score}"

    def test_low_fwhr_low_jaw_gives_low_score(self):
        score = compute_dominance_score({"fwhr": 1.4, "jawline_definition_score": 0.05})
        assert score < 4.0, f"Score esperado < 4, obtido: {score}"


class TestAttractivenessScore:
    def test_good_canthal_low_asym_gives_high_score(self):
        score = compute_attractiveness_score(_metrics_attractive())
        assert score > 7.0, f"Score esperado > 7, obtido: {score}"

    def test_negative_canthal_high_asym_gives_low_score(self):
        score = compute_attractiveness_score(_metrics_tired_unattractive())
        assert score < 4.0, f"Score esperado < 4, obtido: {score}"


class TestFreshnessScore:
    def test_uniform_skin_low_dark_gives_high_score(self):
        score = compute_freshness_score(_metrics_fresh())
        assert score > 8.0, f"Score esperado > 8, obtido: {score}"

    def test_bad_skin_high_dark_gives_low_score(self):
        score = compute_freshness_score(_metrics_tired_unattractive())
        assert score < 2.0, f"Score esperado < 2, obtido: {score}"


# ---------------------------------------------------------------------------
# Testes de build_visual_status
# ---------------------------------------------------------------------------

class TestBuildVisualStatus:
    def test_returns_all_required_keys(self):
        result = build_visual_status({})
        assert "dominance_score" in result
        assert "attractiveness_score" in result
        assert "freshness_score" in result
        assert "narrative" in result

    def test_all_scores_float(self):
        result = build_visual_status(_metrics_dominant())
        assert isinstance(result["dominance_score"], float)
        assert isinstance(result["attractiveness_score"], float)
        assert isinstance(result["freshness_score"], float)

    def test_all_scores_in_range(self):
        result = build_visual_status({**_metrics_dominant(), **_metrics_attractive(), **_metrics_fresh()})
        for key in ("dominance_score", "attractiveness_score", "freshness_score"):
            assert 0.0 <= result[key] <= 10.0, f"{key} out of range: {result[key]}"

    def test_narrative_is_non_empty_string(self):
        result = build_visual_status({})
        assert isinstance(result["narrative"], str)
        assert len(result["narrative"]) > 0

    def test_empty_metrics_does_not_raise(self):
        result = build_visual_status({})
        assert result is not None
