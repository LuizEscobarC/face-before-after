"""Teste de integração end-to-end do mvp_pipeline.

Executa run() com uma foto real e valida que todos os blocos do produto
de entrada estão presentes, consistentes e prontos para cobrança.
"""

from __future__ import annotations

import os
import tempfile

import pytest

import mvp_pipeline as pipeline


# ---------------------------------------------------------------------------
# Fixture: imagem de teste disponível no workspace
# ---------------------------------------------------------------------------

_IMAGE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "depois.png"
)


@pytest.fixture(scope="module")
def pipeline_result(tmp_path_factory):
    """Roda o pipeline uma única vez e compartilha o resultado."""
    if not os.path.exists(_IMAGE_PATH):
        pytest.skip(f"Imagem de teste não encontrada: {_IMAGE_PATH}")
    output_dir = str(tmp_path_factory.mktemp("mvp_out"))
    return pipeline.run(_IMAGE_PATH, output_dir)


@pytest.fixture(scope="module")
def pipeline_result_teaser(tmp_path_factory):
    """Roda o pipeline em modo teaser para validar gating de produto."""
    if not os.path.exists(_IMAGE_PATH):
        pytest.skip(f"Imagem de teste não encontrada: {_IMAGE_PATH}")
    output_dir = str(tmp_path_factory.mktemp("mvp_out_teaser"))
    return pipeline.run(_IMAGE_PATH, output_dir, mode="teaser")


# ---------------------------------------------------------------------------
# Estrutura de alto nível
# ---------------------------------------------------------------------------

class TestPipelineTopLevelKeys:
    REQUIRED_KEYS = [
        "analysis_mode", "access_tier",
        "input_file", "generated_at", "rotation_correction_degrees",
        "score", "tier", "tier_description",
        "capture_confidence",
        "auto_crop",
        "first_impression", "visual_status",
        "top_leverage", "top3_actions_v2",
        "evolution_path", "next_step",
        "measurements", "measurements_blocks",
        "photo_warnings", "capture_recommendations",
        "simulation_paths", "simulation_error",
        "premium_metrics_catalog",
    ]

    def test_all_top_level_keys_present(self, pipeline_result):
        for key in self.REQUIRED_KEYS:
            assert key in pipeline_result, f"Chave ausente no resultado: {key}"

    def test_score_is_in_range(self, pipeline_result):
        assert 0 <= pipeline_result["score"] <= 100

    def test_capture_confidence_is_float_in_range(self, pipeline_result):
        cc = pipeline_result["capture_confidence"]
        assert isinstance(cc, float)
        assert 0.0 <= cc <= 1.0

    def test_generated_at_is_string(self, pipeline_result):
        assert isinstance(pipeline_result["generated_at"], str)
        assert len(pipeline_result["generated_at"]) > 0

    def test_mode_defaults_to_premium(self, pipeline_result):
        assert pipeline_result["analysis_mode"] == "premium"
        assert pipeline_result["access_tier"] == "paid-one-shot"

    def test_premium_catalog_is_non_empty(self, pipeline_result):
        catalog = pipeline_result["premium_metrics_catalog"]
        assert isinstance(catalog, list)
        assert len(catalog) >= 1

    def test_auto_crop_has_expected_shape(self, pipeline_result):
        auto_crop = pipeline_result["auto_crop"]
        assert isinstance(auto_crop, dict)
        assert "applied" in auto_crop
        assert isinstance(auto_crop["applied"], bool)


# ---------------------------------------------------------------------------
# first_impression
# ---------------------------------------------------------------------------

class TestFirstImpression:
    def test_required_keys(self, pipeline_result):
        fi = pipeline_result["first_impression"]
        for key in ("headline", "tags", "main_risk", "positive_signal"):
            assert key in fi, f"first_impression faltando: {key}"

    def test_headline_not_empty(self, pipeline_result):
        assert len(pipeline_result["first_impression"]["headline"]) > 0

    def test_tags_is_list(self, pipeline_result):
        assert isinstance(pipeline_result["first_impression"]["tags"], list)

    def test_no_technical_jargon_in_main_risk(self, pipeline_result):
        main_risk = pipeline_result["first_impression"]["main_risk"]
        banned = ["canthal tilt", "periorbital", "limiar perceptível", " px"]
        for term in banned:
            assert term not in main_risk.lower(), \
                f"Linguagem técnica proibida em main_risk: {term!r}"


# ---------------------------------------------------------------------------
# visual_status
# ---------------------------------------------------------------------------

class TestVisualStatus:
    def test_required_keys(self, pipeline_result):
        vs = pipeline_result["visual_status"]
        for key in ("dominance_score", "attractiveness_score",
                    "freshness_score", "narrative"):
            assert key in vs, f"visual_status faltando: {key}"

    def test_scores_in_range(self, pipeline_result):
        vs = pipeline_result["visual_status"]
        for key in ("dominance_score", "attractiveness_score", "freshness_score"):
            assert 0.0 <= vs[key] <= 10.0, f"{key} fora de [0,10]: {vs[key]}"

    def test_narrative_not_empty(self, pipeline_result):
        assert len(pipeline_result["visual_status"]["narrative"]) > 0


# ---------------------------------------------------------------------------
# top_leverage
# ---------------------------------------------------------------------------

class TestTopLeverage:
    def test_required_keys(self, pipeline_result):
        tl = pipeline_result["top_leverage"]
        for key in ("metric_key", "short_action", "why_it_matters",
                    "time_to_result", "tier", "deviation_score", "confidence_score"):
            assert key in tl, f"top_leverage faltando: {key}"

    def test_confidence_score_in_range(self, pipeline_result):
        cs = pipeline_result["top_leverage"]["confidence_score"]
        assert 0.0 <= cs <= 1.0

    def test_tier_is_valid(self, pipeline_result):
        assert pipeline_result["top_leverage"]["tier"] in (0, 1, 2)


# ---------------------------------------------------------------------------
# top3_actions_v2 (hierarquia oficial)
# ---------------------------------------------------------------------------

class TestTop3ActionsV2:
    def test_returns_list(self, pipeline_result):
        assert isinstance(pipeline_result["top3_actions_v2"], list)

    def test_at_least_one_action(self, pipeline_result):
        assert len(pipeline_result["top3_actions_v2"]) >= 1

    def test_at_most_three_actions(self, pipeline_result):
        assert len(pipeline_result["top3_actions_v2"]) <= 3

    def test_no_old_top_3_actions_key(self, pipeline_result):
        """top_3_actions (antigo) não deve existir — só debug_top_3_actions."""
        assert "top_3_actions" not in pipeline_result

    def test_all_items_have_required_keys(self, pipeline_result):
        for item in pipeline_result["top3_actions_v2"]:
            for key in ("rank", "metric_key", "short_action",
                        "why_it_matters", "time_to_result", "tier"):
                assert key in item, f"top3_actions_v2 item faltando: {key}"


# ---------------------------------------------------------------------------
# evolution_path (com confidence por fase)
# ---------------------------------------------------------------------------

class TestEvolutionPath:
    def test_required_top_keys(self, pipeline_result):
        ep = pipeline_result["evolution_path"]
        for key in ("mutable_metrics", "phase_1", "phase_2", "phase_3"):
            assert key in ep

    def test_each_phase_has_confidence_fields(self, pipeline_result):
        ep = pipeline_result["evolution_path"]
        for phase in ("phase_1", "phase_2", "phase_3"):
            assert "confidence_score" in ep[phase], \
                f"{phase} sem confidence_score"
            assert "confidence_label" in ep[phase], \
                f"{phase} sem confidence_label"

    def test_confidence_scores_in_range(self, pipeline_result):
        ep = pipeline_result["evolution_path"]
        for phase in ("phase_1", "phase_2", "phase_3"):
            score = ep[phase]["confidence_score"]
            assert 0.0 <= score <= 1.0, f"{phase} confidence_score={score}"

    def test_confidence_labels_valid(self, pipeline_result):
        valid = {"muito provável", "provável", "possível", "desafiador"}
        ep = pipeline_result["evolution_path"]
        for phase in ("phase_1", "phase_2", "phase_3"):
            label = ep[phase]["confidence_label"]
            assert label in valid, f"{phase} label inválido: {label!r}"

    def test_reanalysis_dates_present(self, pipeline_result):
        ep = pipeline_result["evolution_path"]
        for phase in ("phase_1", "phase_2", "phase_3"):
            assert "reanalysis_date" in ep[phase]
            assert len(ep[phase]["reanalysis_date"]) == 10  # YYYY-MM-DD


# ---------------------------------------------------------------------------
# next_step
# ---------------------------------------------------------------------------

class TestNextStep:
    def test_required_keys(self, pipeline_result):
        ns = pipeline_result["next_step"]
        for key in ("profile", "message", "action", "cta_text",
                    "cta_type", "urgency_hook"):
            assert key in ns, f"next_step faltando: {key}"

    def test_profile_is_valid(self, pipeline_result):
        assert pipeline_result["next_step"]["profile"] in ("alto", "medio", "baixo")

    def test_message_not_empty(self, pipeline_result):
        assert len(pipeline_result["next_step"]["message"]) > 0

    def test_cta_text_not_empty(self, pipeline_result):
        assert len(pipeline_result["next_step"]["cta_text"]) > 0

    def test_no_price_in_message(self, pipeline_result):
        """CTA não deve mencionar preço."""
        message = pipeline_result["next_step"]["message"]
        cta = pipeline_result["next_step"]["cta_text"]
        for text in (message, cta):
            assert "R$" not in text, f"Preço no copy do next_step: {text!r}"


# ---------------------------------------------------------------------------
# simulation
# ---------------------------------------------------------------------------

class TestSimulation:
    def test_simulation_paths_or_error(self, pipeline_result):
        """Ou paths ou erro — nunca ambos nulos."""
        paths = pipeline_result["simulation_paths"]
        error = pipeline_result["simulation_error"]
        assert paths is not None or error is not None, \
            "simulation_paths e simulation_error são ambos None"

    def test_simulation_paths_have_three_keys_when_present(self, pipeline_result):
        paths = pipeline_result["simulation_paths"]
        if paths is not None:
            for key in ("symmetrized", "ideal_proportions", "comparison_grid"):
                assert key in paths, f"simulation_paths faltando: {key}"

    def test_simulation_files_exist_when_paths_present(self, pipeline_result):
        paths = pipeline_result["simulation_paths"]
        if paths is not None:
            for key, path in paths.items():
                assert os.path.exists(path), \
                    f"Arquivo de simulação não existe: {path}"


# ---------------------------------------------------------------------------
# capture_recommendations
# ---------------------------------------------------------------------------

class TestCaptureRecommendations:
    def test_is_list(self, pipeline_result):
        assert isinstance(pipeline_result["capture_recommendations"], list)

    def test_items_have_area_and_tip(self, pipeline_result):
        for item in pipeline_result["capture_recommendations"]:
            assert "area" in item, "Recomendação de captura sem campo 'area'"
            assert "tip" in item, "Recomendação de captura sem campo 'tip'"
            assert len(item["tip"]) > 0

    def test_area_values_are_known(self, pipeline_result):
        valid_areas = {"enquadramento", "iluminação", "nitidez", "distância", "resolução"}
        for item in pipeline_result["capture_recommendations"]:
            assert item["area"] in valid_areas, \
                f"Área de captura desconhecida: {item['area']!r}"


# ---------------------------------------------------------------------------
# measurements — blocos unificados
# ---------------------------------------------------------------------------

class TestMeasurementsUnified:
    def test_measurements_has_asymmetry_key(self, pipeline_result):
        assert "overall_asymmetry_score" in pipeline_result["measurements"]

    def test_measurements_has_advanced_keys(self, pipeline_result):
        assert "fwhr" in pipeline_result["measurements"]

    def test_measurements_has_skin_keys(self, pipeline_result):
        assert "skin_uniformity_std_lab_left" in pipeline_result["measurements"]

    def test_measurements_has_photo_quality_keys(self, pipeline_result):
        assert "frontal_ok" in pipeline_result["measurements"]

    def test_measurements_blocks_has_three_sub_blocks(self, pipeline_result):
        mb = pipeline_result["measurements_blocks"]
        for key in ("advanced", "photo_quality", "skin"):
            assert key in mb, f"measurements_blocks faltando: {key}"


# ---------------------------------------------------------------------------
# Teaser vs Premium
# ---------------------------------------------------------------------------

class TestTeaserMode:
    def test_teaser_mode_flags(self, pipeline_result_teaser):
        assert pipeline_result_teaser["analysis_mode"] == "teaser"
        assert pipeline_result_teaser["access_tier"] == "free-teaser"

    def test_teaser_hides_premium_sections(self, pipeline_result_teaser):
        assert pipeline_result_teaser["top3_actions_v2"] == []
        assert pipeline_result_teaser["evolution_path"] == {}
        assert pipeline_result_teaser["simulation_paths"] is None
        assert pipeline_result_teaser["premium_metrics_catalog"] == []

    def test_teaser_keeps_core_value(self, pipeline_result_teaser):
        assert pipeline_result_teaser["score"] >= 0
        assert pipeline_result_teaser["first_impression"]["headline"]
        assert pipeline_result_teaser["top_leverage"].get("short_action")
