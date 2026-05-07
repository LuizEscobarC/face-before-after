"""Scores compostos de status visual: dominância, atratividade e frescor.

Combina métricas técnicas em 3 dimensões de percepção social com base em
evidências da literatura (Lefevre 2012, Rhee 2012, Axelsson 2010).

Quando uma métrica vem `None` (medição inválida no `face_metrics`), o peso
dela é redistribuído entre as componentes restantes — em vez de assumir um
valor neutro hardcoded que viesa o score.
"""

from __future__ import annotations

from typing import Any, Dict, Iterable, Optional, Tuple


# Faixa baseada na literatura de percepção facial (Rhee 2012, Kang 2021):
#   tilt < -5°  → percepção de cansaço/queda palpebral
#   tilt 0–3°   → neutro
#   tilt +5/+8° → percepção juvenil ideal
TILT_MIN_DEG = -5.0
TILT_MAX_DEG = 7.0


def _clamp(value: float, lo: float = 0.0, hi: float = 10.0) -> float:
    return max(lo, min(hi, value))


def _num(metrics: Dict[str, Any], key: str) -> Optional[float]:
    """Lê uma métrica como float; devolve None se ausente ou inválida."""
    v = metrics.get(key)
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    return f


def _weighted(parts: Iterable[Tuple[Optional[float], float]]) -> float:
    """Média ponderada pulando componentes None.

    Cada par é (score_em_0_a_10, peso). Se TODAS as componentes forem None,
    devolve 0.0 (medição indisponível, não “neutro”).
    """
    total_weight = 0.0
    total = 0.0
    for score, weight in parts:
        if score is None:
            continue
        total += score * weight
        total_weight += weight
    if total_weight <= 0.0:
        return 0.0
    return _clamp(total / total_weight)


# ---------------------------------------------------------------------------
# Scores individuais
# ---------------------------------------------------------------------------


def compute_dominance_score(metrics: Dict[str, Any]) -> float:
    """Dominância/força percebida (0–10).

    fWHR ideal ~1.85 dentro de [1.4, 2.2]; jawline_definition_score em [0, 1];
    bizygomatic_to_bigonial_ratio centrado em 1.3.
    """
    fwhr = _num(metrics, "fwhr")
    fwhr_score = (fwhr - 1.4) / 0.8 * 10.0 if fwhr is not None else None

    jaw = _num(metrics, "jawline_definition_score")
    jaw_score = jaw * 10.0 if jaw is not None else None

    bzg = _num(metrics, "bizygomatic_to_bigonial_ratio")
    bzg_score = (10.0 - abs(bzg - 1.3) * 20.0) if bzg is not None else None

    return round(_weighted([
        (fwhr_score, 0.50),
        (jaw_score, 0.35),
        (bzg_score, 0.15),
    ]), 2)


def compute_attractiveness_score(metrics: Dict[str, Any]) -> float:
    """Atratividade percebida (0–10)."""
    tilt = _num(metrics, "canthal_tilt_mean_deg")
    tilt_score = (
        (tilt - TILT_MIN_DEG) / (TILT_MAX_DEG - TILT_MIN_DEG) * 10.0
        if tilt is not None else None
    )

    asym = _num(metrics, "overall_asymmetry_score_pct_ipd")
    sym_score = (5.0 - asym) / 5.0 * 10.0 if asym is not None else None

    thirds = _num(metrics, "thirds_std_dev")
    thirds_score = (10.0 - thirds * 50.0) if thirds is not None else None

    return round(_weighted([
        (tilt_score, 0.45),
        (sym_score, 0.40),
        (thirds_score, 0.15),
    ]), 2)


def compute_freshness_score(metrics: Dict[str, Any]) -> float:
    """Frescor/cuidado percebido (0–10)."""
    skin_l = _num(metrics, "skin_uniformity_std_lab_left")
    skin_r = _num(metrics, "skin_uniformity_std_lab_right")
    if skin_l is not None and skin_r is not None:
        skin_std = (skin_l + skin_r) / 2.0
        skin_score = (25.0 - skin_std) / 15.0 * 10.0
    else:
        skin_score = None

    dark_l = _num(metrics, "under_eye_darkness_left")
    dark_r = _num(metrics, "under_eye_darkness_right")
    if dark_l is not None and dark_r is not None:
        eye_dark = (dark_l + dark_r) / 2.0
        dark_score = (0.25 - eye_dark) / 0.20 * 10.0
    else:
        dark_score = None

    ear = _num(metrics, "eye_aspect_ratio_mean")
    ear_score = (ear - 0.18) / 0.17 * 10.0 if ear is not None else None

    return round(_weighted([
        (skin_score, 0.45),
        (dark_score, 0.35),
        (ear_score, 0.20),
    ]), 2)


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
        base = (
            "Suas três dimensões visuais estão equilibradas "
            f"({d:.1f}, {a:.1f}, {f:.1f}/10). "
            "Foco na consistência e manutenção dos hábitos."
        )
        return base + _freshness_alert(f)
    base = _NARRATIVE_MAP.get(
        key,
        (
            f"Seus pontos mais fortes são {strongest} ({scores[strongest]:.1f}/10). "
            f"Maior oportunidade: {weakest} ({scores[weakest]:.1f}/10)."
        ),
    )
    return base + _freshness_alert(f)


def _freshness_alert(freshness_score: float) -> str:
    if freshness_score < 4.0:
        return (
            " Olheiras e irregularidade de tom são os sinais que mais envelhecem"
            " a percepção visual — e os que melhor respondem a hábito simples."
        )
    return ""


def build_visual_status(metrics: Dict[str, Any]) -> Dict[str, Any]:
    d = compute_dominance_score(metrics)
    a = compute_attractiveness_score(metrics)
    f = compute_freshness_score(metrics)
    return {
        "dominance_score": d,
        "attractiveness_score": a,
        "freshness_score": f,
        "narrative": _build_narrative(d, a, f),
    }
