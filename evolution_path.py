"""Trilha de evolução personalizada baseada em métricas mutáveis.

Organiza as ações disponíveis em 3 fases temporais (7 dias, 30 dias, 90 dias)
filtrando apenas métricas que podem mudar sem intervenção cirúrgica.
"""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List

import face_metrics as fm
import recommendations as rec


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

    for key in mutable:
        entry = catalog.get(key, {})
        value = metrics.get(key)
        sev = _get_metric_severity(key, value)

        tier0_actions.extend(_actions_for_tier(entry, 0, sev))
        tier1_actions.extend(_actions_for_tier(entry, 1, sev))
        tier2_actions.extend(_actions_for_tier(entry, 2, sev))

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

    # Determinar métricas alvo por fase
    def _target_metric_label(tier_actions: List[Dict]) -> str:
        if tier_actions:
            return tier_actions[0].get("metric_label", "")
        return "Métricas gerais"

    phase_1 = {
        "label": "Esta semana (0–7 dias)",
        "focus": "Ajustes imediatos de foto, expressão, iluminação e postura",
        "actions": tier0_actions[:3],
        "target_metric": _target_metric_label(tier0_actions),
        "reanalysis_date": (today + timedelta(days=7)).isoformat(),
        "reanalysis_label": "em 7 dias",
    }

    phase_2 = {
        "label": "Próximos 30 dias",
        "focus": "Hábitos consistentes: skincare, exercício, mastigação bilateral",
        "actions": tier1_actions[:3],
        "target_metric": _target_metric_label(tier1_actions),
        "reanalysis_date": (today + timedelta(days=30)).isoformat(),
        "reanalysis_label": "em 30 dias",
    }

    phase_3 = {
        "label": "3 meses",
        "focus": "Avaliação profissional acessível (se indicado) + consolidação",
        "actions": tier2_actions[:2],
        "target_metric": _target_metric_label(tier2_actions),
        "reanalysis_date": (today + timedelta(days=90)).isoformat(),
        "reanalysis_label": "em 90 dias",
        "requires_professional": len(tier2_actions) > 0,
    }

    return {
        "mutable_metrics": mutable,
        "phase_1": phase_1,
        "phase_2": phase_2,
        "phase_3": phase_3,
    }
