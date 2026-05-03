"""Scores compostos de status visual: dominância, atratividade e frescor.

Combina métricas técnicas em 3 dimensões de percepção social com base em
evidências da literatura (Lefevre 2012, Rhee 2012, Axelsson 2010).
"""

from __future__ import annotations

from typing import Any, Dict


# ---------------------------------------------------------------------------
# Utilitário
# ---------------------------------------------------------------------------


def _clamp(value: float, lo: float = 0.0, hi: float = 10.0) -> float:
    """Limita value ao intervalo [lo, hi]."""
    return max(lo, min(hi, value))


# ---------------------------------------------------------------------------
# Scores individuais
# ---------------------------------------------------------------------------


def compute_dominance_score(metrics: Dict[str, Any]) -> float:
    """Score de dominância/força percebida (0–10).

    Baseado em:
    - fWHR: ideal ~1.85, range considerado [1.4, 2.2] (Lefevre 2012)
    - jawline_definition_score: 0–1, maior = mais definido
    - bizygomatic_to_bigonial_ratio: ideal ~1.3 (zigomático mais largo)
    """
    fwhr = float(metrics.get("fwhr", 1.85))
    fwhr_score = _clamp((fwhr - 1.4) / (2.2 - 1.4) * 10.0)

    jaw = float(metrics.get("jawline_definition_score", 0.5))
    jaw_score = _clamp(jaw * 10.0)

    bzg = float(metrics.get("bizygomatic_to_bigonial_ratio", 1.3))
    bzg_score = _clamp(10.0 - abs(bzg - 1.3) * 20.0)

    return round(_clamp(fwhr_score * 0.50 + jaw_score * 0.35 + bzg_score * 0.15), 2)


def compute_attractiveness_score(metrics: Dict[str, Any]) -> float:
    """Score de atratividade percebida (0–10).

    Baseado em:
    - canthal_tilt_mean_deg: ideal +5°, penalizar negativo (Rhee 2012)
    - overall_asymmetry_score_pct_ipd: ideal 0%, acentuada >5%
    - thirds_std_dev: ideal 0 (equilíbrio dos terços)
    """
    tilt = float(metrics.get("canthal_tilt_mean_deg", 5.0))
    # [-5, +7] → [0, 10]
    tilt_score = _clamp((tilt + 5.0) / 12.0 * 10.0)

    asym = float(metrics.get("overall_asymmetry_score_pct_ipd", 0.0))
    sym_score = _clamp((5.0 - asym) / 5.0 * 10.0)

    thirds = float(metrics.get("thirds_std_dev", 0.0))
    thirds_score = _clamp(10.0 - thirds * 50.0)

    return round(
        _clamp(tilt_score * 0.45 + sym_score * 0.40 + thirds_score * 0.15), 2
    )


def compute_freshness_score(metrics: Dict[str, Any]) -> float:
    """Score de frescor/cuidado percebido (0–10).

    Baseado em:
    - skin_uniformity_std_lab_*: ideal <10, ruim >25
    - under_eye_darkness_*: ideal <0.05, ruim >0.25
    - eye_aspect_ratio_mean: ideal 0.28–0.35 (abertura ocular)
    """
    skin_l = float(metrics.get("skin_uniformity_std_lab_left", 15.0))
    skin_r = float(metrics.get("skin_uniformity_std_lab_right", 15.0))
    skin_std = (skin_l + skin_r) / 2.0
    skin_score = _clamp((25.0 - skin_std) / 15.0 * 10.0)

    dark_l = float(metrics.get("under_eye_darkness_left", 0.1))
    dark_r = float(metrics.get("under_eye_darkness_right", 0.1))
    eye_dark = (dark_l + dark_r) / 2.0
    dark_score = _clamp((0.25 - eye_dark) / 0.20 * 10.0)

    ear = float(metrics.get("eye_aspect_ratio_mean", 0.28))
    # [0.18, 0.35] → [0, 10]
    ear_score = _clamp((ear - 0.18) / 0.17 * 10.0)

    return round(
        _clamp(skin_score * 0.45 + dark_score * 0.35 + ear_score * 0.20), 2
    )


# ---------------------------------------------------------------------------
# Narrativa interpretativa
# ---------------------------------------------------------------------------


_NARRATIVE_MAP = {
    ("dominancia", "frescor"): (
        "Presença e estrutura são seus pontos fortes. "
        "Recuperar a aparência de energia visual é o próximo passo de maior impacto."
    ),
    ("dominancia", "atratividade"): (
        "Você transmite autoridade. "
        "Ajustar o ângulo do olhar e a simetria amplia ainda mais sua presença."
    ),
    ("atratividade", "dominancia"): (
        "Você tem harmonia e equilíbrio visual. "
        "Aumentar a percepção de força facial é o passo que mais soma."
    ),
    ("atratividade", "frescor"): (
        "Harmonia facial forte. "
        "Aparência de descanso e cuidado com a pele é o que mais impacta agora."
    ),
    ("frescor", "dominancia"): (
        "Você transmite saúde e cuidado. "
        "Fortalecer a percepção de presença é a alavanca disponível."
    ),
    ("frescor", "atratividade"): (
        "Aparência saudável e descansada. "
        "Trabalhar simetria e proporções amplia o impacto."
    ),
}


def _build_narrative(d: float, a: float, f: float) -> str:
    scores = {"dominancia": d, "atratividade": a, "frescor": f}
    strongest = max(scores, key=lambda k: scores[k])
    weakest = min(scores, key=lambda k: scores[k])
    key = (strongest, weakest)
    if strongest == weakest:
        return (
            "Suas três dimensões visuais estão equilibradas "
            f"({d:.1f}, {a:.1f}, {f:.1f}/10). "
            "Foco na consistência e manutenção dos hábitos."
        )
    return _NARRATIVE_MAP.get(
        key,
        (
            f"Seus pontos mais fortes são {strongest} ({scores[strongest]:.1f}/10). "
            f"Maior oportunidade: {weakest} ({scores[weakest]:.1f}/10)."
        ),
    )


# ---------------------------------------------------------------------------
# Interface pública
# ---------------------------------------------------------------------------


def build_visual_status(metrics: Dict[str, Any]) -> Dict[str, Any]:
    """Calcula os 3 scores de status visual e gera narrativa interpretativa.

    Args:
        metrics: dict com métricas de face_metrics / face_asymmetry.

    Returns:
        {
            "dominance_score": float,       # 0–10
            "attractiveness_score": float,  # 0–10
            "freshness_score": float,       # 0–10
            "narrative": str
        }
    """
    d = compute_dominance_score(metrics)
    a = compute_attractiveness_score(metrics)
    f = compute_freshness_score(metrics)

    return {
        "dominance_score": d,
        "attractiveness_score": a,
        "freshness_score": f,
        "narrative": _build_narrative(d, a, f),
    }
