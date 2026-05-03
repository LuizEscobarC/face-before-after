"""Recomendação de máxima alavancagem e top-3 ações priorizadas.

Combina desvio do ideal com peso de percepção social e filtro de
acionabilidade para surfar a ação de maior retorno percebido
dentro das possibilidades reais do usuário.
"""

from __future__ import annotations

import math
from typing import Any, Dict, List, Optional

import face_metrics as fm
import recommendations as rec


# ---------------------------------------------------------------------------
# Mapeamento de benefício percebido por métrica (linguagem social, não técnica)
# ---------------------------------------------------------------------------

_WHY_BENEFIT_MAP: Dict[str, str] = {
    "overall_asymmetry_score_pct_ipd": (
        "melhora imediatamente como você é percebido em fotos e vídeos"
    ),
    "canthal_tilt_mean_deg": (
        "aumenta a percepção de juventude e energia visual"
    ),
    "fwhr": (
        "amplia a percepção de presença e autoridade"
    ),
    "jawline_definition_score": (
        "define a estrutura facial — o que mais transmite força e saúde"
    ),
    "intercanthal_to_eyewidth_ratio": (
        "elimina distorção que prejudica a primeira impressão na foto"
    ),
    "nasal_to_mouth_width_ratio": (
        "equilibra as proporções centrais — o que mais capta atenção no rosto"
    ),
    "mouth_to_ipd_ratio": (
        "equilibra a proporção da boca com o restante do rosto"
    ),
    "thirds_std_dev": (
        "harmoniza os três terços faciais — base da percepção de equilíbrio"
    ),
    "fifths_std_dev": (
        "elimina desequilíbrio lateral que distrai na primeira impressão"
    ),
    "marquardt_deviation_pct_ipd": (
        "aproxima o rosto das proporções que o cérebro reconhece como harmônicas"
    ),
    "jaw_width_pct_ipd": (
        "aumenta a percepção de dimorfismo e presença visual"
    ),
    "upper_lower_lip_ratio": (
        "equilibra a proporção labial — detalhe que aumenta harmonia frontal"
    ),
    "philtrum_length_pct_ipd": (
        "ajusta o filtro nasolabial para a proporção associada à juventude"
    ),
    "lower_third_ratio": (
        "equilibra o terço inferior — marcador de proporção sexual"
    ),
}

_DEFAULT_BENEFIT = "aumenta o impacto da sua presença visual"


# ---------------------------------------------------------------------------
# Cálculo de desvio normalizado do ideal
# ---------------------------------------------------------------------------


def _normalized_deviation(key: str, value: Any) -> float:
    """Retorna desvio normalizado [0, 1] em relação ao ideal de uma métrica.

    Usa ADVANCED_IDEALS de face_metrics quando disponível.
    Retorna 0.0 para métricas não numéricas.
    """
    if not isinstance(value, (int, float)):
        return 0.0

    val = float(value)

    if key in fm.ADVANCED_IDEALS:
        entry = fm.ADVANCED_IDEALS[key]
        if isinstance(entry, dict):
            ideal = float(entry.get("ideal", val))
            tol = float(entry.get("tolerance", 1.0))
        elif isinstance(entry, (list, tuple)) and len(entry) >= 2:
            ideal, tol = float(entry[0]), float(entry[1])
        else:
            return 0.0
        if tol <= 0:
            return 0.0
        raw_dev = abs(val - ideal) / tol
        return min(raw_dev / 4.0, 1.0)  # normaliza: 4× tol → desvio máximo (1.0)

    return 0.0


# ---------------------------------------------------------------------------
# Construção do score de alavancagem
# ---------------------------------------------------------------------------


def _leverage_score(key: str, value: Any, catalog_entry: Dict[str, Any]) -> float:
    """Score = social_perception_weight × normalized_deviation."""
    spw = float(catalog_entry.get("social_perception_weight", 0.5))
    dev = _normalized_deviation(key, value)
    return spw * dev


def _get_best_action_text(key: str, catalog_entry: Dict[str, Any]) -> Optional[str]:
    """Retorna o título da melhor ação disponível (leve > moderada > acentuada)."""
    actions_by_sev = catalog_entry.get("actions_by_severity", {})
    for sev in ("leve", "moderada", "acentuada"):
        actions = actions_by_sev.get(sev, [])
        if actions:
            return actions[0].get("titulo", "")
    return None


# ---------------------------------------------------------------------------
# Interface pública
# ---------------------------------------------------------------------------


def get_top_leverage_recommendation(
    metrics: Dict[str, Any],
    max_tier: int = 1,
) -> Dict[str, Any]:
    """Retorna a recomendação com maior alavancagem social dentro do tier máximo.

    Args:
        metrics: dict de métricas (face_metrics + face_asymmetry).
        max_tier: tier máximo aceitável (0=grátis/hoje, 1=semanas/barato, ...).
                  Para o produto de entrada, usar max_tier=1.

    Returns:
        {
            "metric_key": str,
            "short_action": str,
            "why_it_matters": str,
            "time_to_result": str,
            "tier": int,
            "deviation_score": float,
        }
    """
    best_score = -1.0
    best: Dict[str, Any] = {}

    for key, entry in rec.REC_CATALOG.items():
        tier = int(entry.get("actionability_tier", 2))
        if tier > max_tier:
            continue

        value = metrics.get(key)
        if value is None:
            continue

        score = _leverage_score(key, value, entry)
        if score > best_score:
            best_score = score
            action_text = _get_best_action_text(key, entry) or entry.get("label", key)
            best = {
                "metric_key": key,
                "short_action": action_text,
                "why_it_matters": _WHY_BENEFIT_MAP.get(key, _DEFAULT_BENEFIT),
                "time_to_result": entry.get("time_to_result", "semanas"),
                "tier": tier,
                "deviation_score": round(best_score, 4),
            }

    if not best:
        # Fallback: retornar orientação de foto quando nenhuma métrica disponível
        best = {
            "metric_key": "overall_asymmetry_score_pct_ipd",
            "short_action": "Fotografar com luz frontal, câmera na altura dos olhos e cabeça reta",
            "why_it_matters": "melhora imediatamente como você é percebido em fotos e vídeos",
            "time_to_result": "imediato",
            "tier": 0,
            "deviation_score": 0.0,
        }

    return best


def get_top3_actions(
    metrics: Dict[str, Any],
    max_tier: int = 2,
) -> List[Dict[str, Any]]:
    """Retorna 3 ações priorizadas por alavancagem, garantindo variedade de tier.

    Tenta sempre: 1 ação tier_0 + 1 tier_1 + 1 tier_2.
    Se não houver de algum tier, preenche com a próxima melhor disponível.

    Args:
        metrics: dict de métricas.
        max_tier: tier máximo incluído na seleção.

    Returns:
        Lista de até 3 dicts: {"rank", "short_action", "why_it_matters",
                               "time_to_result", "tier", "metric_key"}
    """
    # Calcular score para todas as métricas disponíveis dentro do max_tier
    candidates: List[Dict[str, Any]] = []
    for key, entry in rec.REC_CATALOG.items():
        tier = int(entry.get("actionability_tier", 2))
        if tier > max_tier:
            continue
        value = metrics.get(key)
        if value is None:
            continue
        score = _leverage_score(key, value, entry)
        action_text = _get_best_action_text(key, entry) or entry.get("label", key)
        candidates.append(
            {
                "metric_key": key,
                "short_action": action_text,
                "why_it_matters": _WHY_BENEFIT_MAP.get(key, _DEFAULT_BENEFIT),
                "time_to_result": entry.get("time_to_result", "semanas"),
                "tier": tier,
                "score": score,
            }
        )

    candidates.sort(key=lambda c: c["score"], reverse=True)

    # Selecionar: 1 por tier (0, 1, 2), priorizando maior score por tier
    selected: List[Dict[str, Any]] = []
    used_keys: set = set()

    for target_tier in range(min(3, max_tier + 1)):
        for c in candidates:
            if c["tier"] == target_tier and c["metric_key"] not in used_keys:
                selected.append(c)
                used_keys.add(c["metric_key"])
                break

    # Se ainda não tem 3, completar com os melhores restantes
    for c in candidates:
        if len(selected) >= 3:
            break
        if c["metric_key"] not in used_keys:
            selected.append(c)
            used_keys.add(c["metric_key"])

    # Montar output final com rank
    result = []
    for rank, item in enumerate(selected[:3], start=1):
        result.append(
            {
                "rank": rank,
                "metric_key": item["metric_key"],
                "short_action": item["short_action"],
                "why_it_matters": item["why_it_matters"],
                "time_to_result": item["time_to_result"],
                "tier": item["tier"],
            }
        )

    return result
