"""Trilha de evolução personalizada baseada em métricas mutáveis.

Organiza as ações disponíveis em 3 fases temporais (7 dias, 30 dias, 90 dias)
filtrando apenas métricas que podem mudar sem intervenção cirúrgica.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List

import app.domain.face_metrics as fm
import app.domain.layers.recommendations as rec


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sev_rank(sev: str) -> int:
    return {"excelente": 0, "leve": 1, "moderada": 2, "acentuada": 3, "severa": 4}.get(
        sev, 1
    )


def _get_metric_severity(key: str, value: Any) -> str:
    """Calcula severidade de uma métrica usando face_metrics quando possível."""
    if not isinstance(value, (int, float)):
        return "excelente"
    if key in fm.ADVANCED_IDEALS:
        return fm.severity_for(key, float(value))
    return "leve"


def _actions_for_tier(entry: Dict[str, Any], tier: int, severity: str) -> List[Dict]:
    """Retorna ações do catálogo para um tier específico dentro de uma severidade."""
    severity_order = ["leve", "moderada", "acentuada"]
    # Usar a severidade real ou a imediatamente menor disponível
    actions_by_sev = entry.get("actions_by_severity", {})
    sev_to_use = severity if severity in actions_by_sev else "leve"

    result = []
    for action in actions_by_sev.get(sev_to_use, []):
        action_tier = _infer_tier_from_tipo(action.get("tipo", ""))
        if action_tier == tier:
            result.append(
                {
                    "titulo": action.get("titulo", ""),
                    "descricao": action.get("descricao", ""),
                    "frequencia": action.get("frequencia", ""),
                    "metric_label": entry.get("label", ""),
                }
            )
    return result


def _infer_tier_from_tipo(tipo: str) -> int:
    """Inferir tier a partir do tipo de ação (fallback quando tier não está na ação)."""
    mapping = {
        "habito": 0,
        "postura": 0,
        "exercicio": 1,
        "profissional": 2,
    }
    return mapping.get(tipo.lower(), 1)


def _check_skin_alert(metrics: Dict[str, Any]) -> bool:
    """Retorna True se pele/olheiras estão em nível de alerta."""
    left = float(metrics.get("skin_uniformity_std_lab_left", 0.0) or 0.0)
    right = float(metrics.get("skin_uniformity_std_lab_right", 0.0) or 0.0)
    skin_mean = (left + right) / 2.0 if (left or right) else 0.0
    dark_l = float(metrics.get("under_eye_darkness_left", 0.0) or 0.0)
    dark_r = float(metrics.get("under_eye_darkness_right", 0.0) or 0.0)
    dark_mean = (dark_l + dark_r) / 2.0 if (dark_l or dark_r) else 0.0
    return skin_mean > 20.0 or dark_mean > 0.15


# ---------------------------------------------------------------------------
# Interface pública
# ---------------------------------------------------------------------------


def get_mutable_metrics(
    metrics: Dict[str, Any],
    catalog: Dict[str, Any] = None,
) -> List[str]:
    """Retorna chaves de métricas mutáveis que estão fora do ideal.

    Args:
        metrics: dict de métricas do face_metrics / face_asymmetry.
        catalog: catálogo de recomendações (usa rec.REC_CATALOG por padrão).

    Returns:
        Lista de chaves de métricas mutáveis com severidade > excelente.
    """
    if catalog is None:
        catalog = rec.REC_CATALOG

    result = []
    for key, entry in catalog.items():
        if not entry.get("mutable", False):
            continue
        value = metrics.get(key)
        if value is None:
            continue
        sev = _get_metric_severity(key, value)
        if sev != "excelente":
            result.append(key)
    return result


def build_evolution_path(
    metrics: Dict[str, Any],
    catalog: Dict[str, Any] = None,
    capture_confidence: float = 1.0,
) -> Dict[str, Any]:
    """Constrói a trilha de evolução em 3 fases.

    Args:
        metrics: dict de métricas.
        catalog: catálogo de recomendações (usa rec.REC_CATALOG por padrão).

    Returns:
        {
            "mutable_metrics": list[str],
            "phase_1": {...},  # 0–7 dias, ações tier_0
            "phase_2": {...},  # 7–30 dias, ações tier_1
            "phase_3": {...},  # 30–90 dias, ações tier_2
        }
    """
    if catalog is None:
        catalog = rec.REC_CATALOG

    today = date.today()
    mutable = get_mutable_metrics(metrics, catalog)

    # Coletar ações por tier
    tier0_actions: List[Dict] = []
    tier1_actions: List[Dict] = []
    tier2_actions: List[Dict] = []
    tier0_sev_ranks: List[int] = []
    tier1_sev_ranks: List[int] = []
    tier2_sev_ranks: List[int] = []

    for key in mutable:
        entry = catalog.get(key, {})
        value = metrics.get(key)
        sev = _get_metric_severity(key, value)

        tier0_new = _actions_for_tier(entry, 0, sev)
        tier1_new = _actions_for_tier(entry, 1, sev)
        tier2_new = _actions_for_tier(entry, 2, sev)

        tier0_actions.extend(tier0_new)
        tier1_actions.extend(tier1_new)
        tier2_actions.extend(tier2_new)

        if tier0_new:
            tier0_sev_ranks.append(_sev_rank(sev))
        if tier1_new:
            tier1_sev_ranks.append(_sev_rank(sev))
        if tier2_new:
            tier2_sev_ranks.append(_sev_rank(sev))

    # Desduplicar por título
    def _dedup(actions: List[Dict]) -> List[Dict]:
        seen: set = set()
        out = []
        for a in actions:
            key_str = a.get("titulo", "")
            if key_str not in seen:
                seen.add(key_str)
                out.append(a)
        return out

    tier0_actions = _dedup(tier0_actions)
    tier1_actions = _dedup(tier1_actions)
    tier2_actions = _dedup(tier2_actions)

    def _clamp01(value: float) -> float:
        return max(0.0, min(1.0, float(value)))

    def _confidence_label(score: float) -> str:
        if score >= 0.75:
            return "muito provável"
        if score >= 0.50:
            return "provável"
        if score >= 0.30:
            return "possível"
        return "desafiador"

    def _phase_confidence(
        actions: List[Dict],
        sev_ranks: List[int],
        base_score: float,
    ) -> float:
        if not actions:
            return 0.0
        avg_rank = sum(sev_ranks) / len(sev_ranks) if sev_ranks else 2.0
        severity_factor = max(0.45, 1.0 - (avg_rank - 1.0) * 0.15)
        action_factor = min(1.0, 0.60 + 0.15 * len(actions))
        confidence = base_score * _clamp01(capture_confidence) * severity_factor * action_factor
        return round(_clamp01(confidence), 3)

    phase_1_conf = _phase_confidence(tier0_actions[:3], tier0_sev_ranks, base_score=0.88)
    phase_2_conf = _phase_confidence(tier1_actions[:3], tier1_sev_ranks, base_score=0.72)
    phase_3_conf = _phase_confidence(tier2_actions[:2], tier2_sev_ranks, base_score=0.58)

    # Determinar métricas alvo por fase
    def _target_metric_label(tier_actions: List[Dict]) -> str:
        if tier_actions:
            return tier_actions[0].get("metric_label", "")
        return "Métricas gerais"

    _p1_target = _target_metric_label(tier0_actions)
    _p1_focus = (
        f"Foco em {_p1_target} — ajustes de postura, expressão e registro fotográfico"
        if _p1_target and _p1_target != "Métricas gerais"
        else "Ajustes de expressão, postura e registro fotográfico"
    )

    phase_1 = {
        "label": "Esta semana (0–7 dias)",
        "focus": _p1_focus,
        "actions": tier0_actions[:3],
        "target_metric": _p1_target,
        "reanalysis_date": (today + timedelta(days=7)).isoformat(),
        "reanalysis_label": "em 7 dias",
        "confidence_score": phase_1_conf,
        "confidence_label": _confidence_label(phase_1_conf),
    }

    # Injetar ação de pele como 1ª da fase 1 quando skin_alert ativo
    if _check_skin_alert(metrics):
        _spf_action = {
            "titulo": "SPF 30+ diariamente + hidratante noturno",
            "descricao": "Aplicar SPF 30+ toda manhã; hidratante noturno antes de dormir.",
            "frequencia": "diário",
            "metric_label": "Protocolo SPF + hidratação",
        }
        existing_titles = {a.get("titulo", "") for a in phase_1["actions"]}
        if _spf_action["titulo"] not in existing_titles:
            phase_1["actions"] = [_spf_action] + phase_1["actions"][:2]

    _p2_target = _target_metric_label(tier1_actions)
    _p2_focus = (
        f"Hábitos diários focados em {_p2_target}"
        if _p2_target and _p2_target != "Métricas gerais"
        else "Hábitos diários: skincare, exercício e postura"
    )

    phase_2 = {
        "label": "Próximos 30 dias",
        "focus": _p2_focus,
        "actions": tier1_actions[:3],
        "target_metric": _p2_target,
        "reanalysis_date": (today + timedelta(days=30)).isoformat(),
        "reanalysis_label": "em 30 dias",
        "confidence_score": phase_2_conf,
        "confidence_label": _confidence_label(phase_2_conf),
    }

    phase_3 = {
        "label": "3 meses",
        "focus": "Avaliação profissional acessível (se indicado) + consolidação",
        "actions": tier2_actions[:2],
        "target_metric": _target_metric_label(tier2_actions),
        "reanalysis_date": (today + timedelta(days=90)).isoformat(),
        "reanalysis_label": "em 90 dias",
        "requires_professional": len(tier2_actions) > 0,
        "confidence_score": phase_3_conf,
        "confidence_label": _confidence_label(phase_3_conf),
    }

    return {
        "mutable_metrics": mutable,
        "phase_1": phase_1,
        "phase_2": phase_2,
        "phase_3": phase_3,
        "skin_alert": _check_skin_alert(metrics),
    }
