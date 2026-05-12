"""Sidebar annotations for overlay SVGs / PNGs.

These helpers build the *textual* counterpart of the geometric overlays
(grid_thirds, grid_fifths, face_extents).  React renders the strings next to
the image; the renderers themselves draw only lines/polygons.

Kept in sync with scripts/_overlay_render.py (build_*_annotations) — the
script is a tooling mirror used from the CLI; this module is the canonical
in-process implementation called from the API pipeline.
"""

from __future__ import annotations

from typing import Iterable, Sequence

# MediaPipe Mesh-478 indices reused here (mirrors OverlayLayer.tsx and
# scripts/_overlay_render.py — keeping a small local copy avoids importing
# scripts/* from the runtime package, since scripts/ is not on sys.path
# inside the docker image).
P_BROW_LEFT_INNER     = 107
P_BROW_RIGHT_INNER    = 336
P_SUBNASALE           = 2
P_MENTON              = 152
P_LEFT_EYE_INNER      = 133
P_RIGHT_EYE_INNER     = 362
P_FOREHEAD_CROWN      = 10
P_ZYGO_IMG_RIGHT      = 454
P_ZYGO_IMG_LEFT       = 234
P_EYE_OUTER_IMG_LEFT  = 33
P_EYE_OUTER_IMG_RIGHT = 263


def _xy(lm: Sequence[Sequence[float]], idx: int) -> tuple[float, float]:
    if idx < 0 or idx >= len(lm):
        return (0.0, 0.0)
    p = lm[idx]
    return (float(p[0]), float(p[1]))


def _metric_get(metric_evals: Iterable[dict] | None, metric_id: str) -> dict | None:
    if not metric_evals:
        return None
    for m in metric_evals:
        if m and m.get("metric_id") == metric_id:
            return m
    return None


def _derive_trichion_y_px(
    lm: Sequence[Sequence[float]],
    metric_evals: Iterable[dict] | None = None,
) -> float:
    """Algebraic derivation of trichion_y consistent with upper_third_ratio."""
    m = _metric_get(metric_evals, "upper_third_ratio")
    if m and isinstance(m.get("value"), (int, float)):
        u = float(m["value"])
        if 0.05 < u < 0.95:
            y_brow = (
                _xy(lm, P_BROW_LEFT_INNER)[1] + _xy(lm, P_BROW_RIGHT_INNER)[1]
            ) / 2.0
            y_men = _xy(lm, P_MENTON)[1]
            return (u * y_men - y_brow) / (u - 1.0)
    return _xy(lm, P_FOREHEAD_CROWN)[1]


def build_grid_thirds_annotations(
    lm: Sequence[Sequence[float]],
    metric_evals: Iterable[dict] | None = None,
) -> dict:
    y_top   = _derive_trichion_y_px(lm, metric_evals)
    y_brow  = (_xy(lm, P_BROW_LEFT_INNER)[1] + _xy(lm, P_BROW_RIGHT_INNER)[1]) / 2.0
    y_sub   = _xy(lm, P_SUBNASALE)[1]
    y_men   = _xy(lm, P_MENTON)[1]
    face_h  = max(1.0, y_men - y_top)
    m_upper  = _metric_get(metric_evals, "upper_third_ratio")
    m_middle = _metric_get(metric_evals, "middle_third_ratio")
    m_lower  = _metric_get(metric_evals, "lower_third_ratio")

    def _pct(metric: dict | None, fallback: float) -> float:
        if metric and isinstance(metric.get("value"), (int, float)):
            return float(metric["value"]) * 100.0
        return fallback

    rows = [
        ("T1", "Terço superior", _pct(m_upper,  ((y_brow - y_top) / face_h) * 100.0),
         (m_upper or {}).get("severity_5")),
        ("T2", "Terço médio",    _pct(m_middle, ((y_sub  - y_brow) / face_h) * 100.0),
         (m_middle or {}).get("severity_5")),
        ("T3", "Terço inferior", _pct(m_lower,  ((y_men  - y_sub) / face_h) * 100.0),
         (m_lower or {}).get("severity_5")),
    ]
    return {
        "ideal_pct": 33.3,
        "rows": [
            {"id": r[0], "label": r[1], "pct": round(r[2], 1),
             "deviation_pct": round(r[2] - 33.3, 1), "severity_5": r[3]}
            for r in rows
        ],
        "legend": {
            "dashed_purple": "Linhas tracejadas: terços ideais (Farkas 1/3 · 2/3)",
            "solid_orange": "Linhas laranja: marcos reais (sobrancelha e subnasale)",
        },
    }


def build_grid_fifths_annotations(lm: Sequence[Sequence[float]]) -> dict:
    x_face_l = _xy(lm, P_ZYGO_IMG_LEFT)[0]
    x_face_r = _xy(lm, P_ZYGO_IMG_RIGHT)[0]
    x_eye_ol = _xy(lm, P_EYE_OUTER_IMG_LEFT)[0]
    x_eye_il = _xy(lm, P_LEFT_EYE_INNER)[0]
    x_eye_ir = _xy(lm, P_RIGHT_EYE_INNER)[0]
    x_eye_or = _xy(lm, P_EYE_OUTER_IMG_RIGHT)[0]
    face_w = max(1.0, x_face_r - x_face_l)
    fifth = face_w / 5.0
    ideals  = [x_face_l + i * fifth for i in (1, 2, 3, 4)]
    actuals = [x_eye_ol, x_eye_il, x_eye_ir, x_eye_or]
    names   = ["OExt.E", "OInt.E", "OInt.D", "OExt.D"]
    return {
        "rows": [
            {"id": n, "deviation_px": round(a - i)}
            for n, a, i in zip(names, actuals, ideals)
        ],
        "legend": {
            "dashed_purple": "Tracejado roxo: divisões ideais (1/5 da largura facial)",
            "solid_orange": "Linhas laranja: posição real do canto ocular",
        },
    }


def build_face_extents_annotations(
    lm: Sequence[Sequence[float]],
    trichion_source: str | None = "mesh",
    metric_evals: Iterable[dict] | None = None,
) -> dict:
    y_top = _derive_trichion_y_px(lm, metric_evals)
    y_men = _xy(lm, P_MENTON)[1]
    x_left  = _xy(lm, P_ZYGO_IMG_LEFT)[0]
    x_right = _xy(lm, P_ZYGO_IMG_RIGHT)[0]
    return {
        "trichion_source": trichion_source or "mesh",
        "trichion_label": "Trichion (BiSeNet)" if trichion_source == "bisenet" else "Trichion (mesh)",
        "menton_label": "Menton",
        "face_height_px": round(y_men - y_top, 1),
        "face_width_px": round(x_right - x_left, 1),
        "legend": "Caixa branca: extensão facial Trichion → Menton (altura) · Zigomáticos (largura).",
    }
