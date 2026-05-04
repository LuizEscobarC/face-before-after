"""Camada de linguagem social/emocional sobre as métricas faciais.

Traduz métricas técnicas em narrativas de percepção (primeira impressão).
Não requer bibliotecas externas além das já disponíveis no projeto.
"""

from __future__ import annotations

from typing import Any, Dict, List


# ---------------------------------------------------------------------------
# Regras de risco — avaliadas em ordem; primeiro match é o principal risco
# ---------------------------------------------------------------------------

_IMPRESSION_RULES: List[Dict[str, Any]] = [
    {
        "id": "tired_eyes",
        "condition": lambda m: (
            m.get("canthal_tilt_mean_deg", 5.0) < 0
            and (
                m.get("under_eye_darkness_left", 0.0)
                + m.get("under_eye_darkness_right", 0.0)
            )
            / 2
            > 0.15
        ),
        "risk": (
            "Olhar transmite cansaço — olhos caídos e área escura ao redor dos olhos "
            "reduzem energia visual"
        ),
        "tag": "aparência cansada",
    },
    {
        "id": "low_dominance",
        "condition": lambda m: (
            m.get("fwhr", 1.85) < 1.6
            and m.get("jawline_definition_score", 0.5) < 0.3
        ),
        "risk": (
            "Estrutura facial suave reduz percepção de presença — "
            "mandíbula e face mais estreita do que o ideal de autoridade"
        ),
        "tag": "presença suave",
    },
    {
        "id": "skin_care",
        "condition": lambda m: (
            (
                m.get("skin_uniformity_std_lab_left", 0.0)
                + m.get("skin_uniformity_std_lab_right", 0.0)
            )
            / 2
            > 20
        ),
        "risk": (
            "Irregularidade de tom de pele visível — isso afeta diretamente a "
            "percepção de cuidado"
        ),
        "tag": "pele irregular",
    },
    {
        "id": "visible_asymmetry",
        "condition": lambda m: m.get("overall_asymmetry_score_pct_ipd", 0.0) > 3.0,
        "risk": (
            "Assimetria facial no nível perceptível — é o fator com maior "
            "peso na percepção atual"
        ),
        "tag": "assimetria visível",
    },
    {
        "id": "low_ear",
        "condition": lambda m: m.get("eye_aspect_ratio_mean", 0.3) < 0.22,
        "risk": (
            "Abertura ocular reduzida — olhos pouco abertos passam sensação de "
            "sonolência ou desinteresse"
        ),
        "tag": "olhos pouco abertos",
    },
]

# ---------------------------------------------------------------------------
# Sinais positivos — o primeiro que bater se torna o "positive_signal"
# ---------------------------------------------------------------------------

_POSITIVE_SIGNALS: List[Dict[str, Any]] = [
    {
        "id": "high_symmetry",
        "condition": lambda m: m.get("overall_asymmetry_score_pct_ipd", 99.0) < 1.0,
        "signal": "Alta simetria facial — ativo visual forte e raro",
    },
    {
        "id": "good_canthal",
        "condition": lambda m: m.get("canthal_tilt_mean_deg", 0.0) >= 3.0,
        "signal": "Olhar jovial e energético — ângulo do olhar favorável aumenta atratividade percebida",
    },
    {
        "id": "strong_presence",
        "condition": lambda m: m.get("fwhr", 0.0) >= 1.85,
        "signal": "Presença marcante — proporção facial associada a autoridade e confiança",
    },
    {
        "id": "fresh_skin",
        "condition": lambda m: (
            (
                m.get("skin_uniformity_std_lab_left", 99.0)
                + m.get("skin_uniformity_std_lab_right", 99.0)
            )
            / 2
        )
        < 12,
        "signal": "Tom de pele uniforme — transmite cuidado e saúde visualmente",
    },
    {
        "id": "default",
        "condition": lambda m: True,
        "signal": "Equilíbrio facial consistente — nenhum ponto de atenção dominante",
    },
]


# ---------------------------------------------------------------------------
# Interface pública
# ---------------------------------------------------------------------------


def build_first_impression(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Constrói o diagnóstico de primeira impressão em linguagem social.

    Args:
        metrics: dict com métricas de face_metrics e/ou face_asymmetry.
                 Campos usados (todos opcionais com defaults seguros):
                   canthal_tilt_mean_deg, under_eye_darkness_left/right,
                   fwhr, jawline_definition_score, skin_uniformity_std_lab_left/right,
                   overall_asymmetry_score_pct_ipd, eye_aspect_ratio_mean.

    Returns:
        {
            "headline": str,        # frase principal em linguagem de benefício social
            "tags": list[str],      # adjetivos de percepção
            "main_risk": str,       # fator que mais derruba a impressão hoje
            "positive_signal": str, # ponto forte da face (sempre presente)
        }
    """
    risks_found = [r for r in _IMPRESSION_RULES if r["condition"](metrics)]
    positive = next(p for p in _POSITIVE_SIGNALS if p["condition"](metrics))

    positive_short = positive["signal"].split("—")[0].strip()

    if not risks_found:
        if positive["id"] == "default":
            headline = "Primeira impressão equilibrada. Oportunidades existem, mas nenhuma urgente."
        else:
            headline = f"Primeira impressão sólida. {positive['signal']}."
        main_risk = "Nenhum fator crítico identificado — manutenção e consistência são o foco."
    elif len(risks_found) == 1:
        risk_short = risks_found[0]["risk"].split("—")[0].strip().lower()
        headline = f"{positive_short}. Ponto a refinar: {risk_short}."
        main_risk = risks_found[0]["risk"]
    else:
        risk_short = risks_found[0]["risk"].split("—")[0].strip().lower()
        headline = (
            f"{positive_short}. Mais de um ponto de refinamento — o principal: {risk_short}."
        )
        main_risk = risks_found[0]["risk"]

    tags = [r["tag"] for r in risks_found] if risks_found else ["equilíbrio visual"]

    return {
        "headline": headline,
        "tags": tags,
        "main_risk": main_risk,
        "positive_signal": positive["signal"],
    }
