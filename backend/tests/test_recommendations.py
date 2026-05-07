"""Testes para recommendations.py e glossary.py."""

from __future__ import annotations

import app.domain.layers.recommendations as rm
import app.domain.layers.glossary as gm


def test_glossary_entries_have_required_fields():
    assert gm.GLOSSARY, "Glossário vazio"
    for key, g in gm.GLOSSARY.items():
        for f in ("termo", "unidade", "descricao", "como_medido", "referencias"):
            assert f in g, f"glossary[{key}] sem campo {f}"
        assert g["referencias"], f"glossary[{key}] sem referências"
        for r in g["referencias"]:
            assert r.get("url", "").startswith(("http://", "https://"))


def test_recommend_excelente_em_metricas_perfeitas():
    measurements = {
        "overall_asymmetry_score_pct_ipd": 0.5,
        "advanced": {
            "fwhr": 1.85,
            "lower_third_ratio": 0.56,
            "canthal_tilt_mean_deg": 5.0,
            "intercanthal_to_eyewidth_ratio": 1.0,
            "nasal_to_mouth_width_ratio": 0.70,
            "mouth_to_ipd_ratio": 1.50,
            "thirds_std_dev": 0.0,
            "fifths_std_dev": 0.0,
            "marquardt_deviation_pct_ipd": 0.5,
            "jaw_width_pct_ipd": 155.0,
            "jawline_definition_score": 8.0,
            "upper_lower_lip_ratio": 0.62,
            "philtrum_length_pct_ipd": 22.0,
            "face_shape_label": "oval",
        },
    }
    items = rm.recommend(measurements)
    assert items, "recommend() deve sempre retornar itens"
    for it in items:
        assert it["severity"] == "excelente", \
            f"esperava excelente para {it['metric_key']}, veio {it['severity']}"
        assert it["actions"] == [], \
            f"métrica excelente não deve ter ações ({it['metric_key']})"


def test_recommend_gera_acoes_para_severidade_alta():
    measurements = {
        "overall_asymmetry_score_pct_ipd": 6.0,   # acentuada
        "advanced": {
            "fwhr": 1.40,                          # bem abaixo do ideal
            "marquardt_deviation_pct_ipd": 7.5,    # acentuada
            "jawline_definition_score": 2.0,       # acentuada
        },
    }
    items = rm.recommend(measurements)
    by_key = {it["metric_key"]: it for it in items}
    for key in ("overall_asymmetry_score_pct_ipd", "fwhr",
                "marquardt_deviation_pct_ipd", "jawline_definition_score"):
        assert key in by_key, f"{key} ausente do plano"
        assert by_key[key]["severity"] != "excelente"
        assert by_key[key]["actions"], f"{key} deveria ter ações"
        for a in by_key[key]["actions"]:
            assert "titulo" in a and "descricao" in a and "tipo" in a
            assert (a.get("fonte") or {}).get("url", "").startswith("http")


def test_recommend_ordena_por_severidade_desc():
    measurements = {
        "advanced": {
            "fwhr": 1.85,           # excelente
            "marquardt_deviation_pct_ipd": 9.0,  # severa
            "jawline_definition_score": 6.0,     # leve
        },
    }
    items = rm.recommend(measurements)
    sev_order = [it["severity"] for it in items]
    rank = {"excelente": 0, "leve": 1, "moderada": 2,
            "acentuada": 3, "severa": 4}
    nums = [rank[s] for s in sev_order]
    assert nums == sorted(nums, reverse=True), sev_order
