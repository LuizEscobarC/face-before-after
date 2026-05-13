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

# Asymmetry analysis landmarks (mirrors face_asymmetry.py)
LM_LEFT_EYE_ASYM  = [33, 7, 163, 144, 145, 153]
LM_RIGHT_EYE_ASYM = [263, 249, 390, 373, 374, 380]
P_NOSE_TIP_ASYM   = 1
P_UPPER_LIP_ASYM  = 13
P_LEFT_MOUTH      = 61
P_RIGHT_MOUTH     = 291

# Forehead ridge landmark indices (mirrors IdealProportionsLayer.tsx LM_FOREHEAD_RIDGE)
_FOREHEAD_RIDGE = [109, 67, 103, 54, 21, 162, 10, 338, 297, 332, 284, 251]

# Metric-to-anatomical-region mapping (matches MetricsMapLayer frontend logic)
_METRIC_REGION_MAP: dict[str, str] = {
    "upper_third_ratio":      "FOREHEAD",
    "forehead_height_ratio":  "FOREHEAD",
    "lower_third_ratio":      "JAW",
    "chin_projection_ratio":  "JAW",
    "middle_third_ratio":     "NOSE",
    "facial_index":           "NOSE",
    "face_height_ratio":      "NOSE",
    "face_width_ratio":       "NOSE",
    "phi_ratio":              "EYES",
    "eye_width_ratio":        "EYES",
    "eye_spacing_ratio":      "EYES",
    "mouth_width_ratio":      "MOUTH",
    "lip_ratio":              "MOUTH",
    "philtrum_ratio":         "MOUTH",
}


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


def build_ideal_proportions_zones(
    lm: Sequence[Sequence[float]],
    metric_evals: Iterable[dict] | None = None,
    trichion_y_px: float | None = None,
) -> dict:
    """Compute anatomical zone rects for IdealProportionsLayer from landmarks.

    Returns JSON consumed by IdealProportionsLayer.tsx so the frontend can
    render SVG rects without any hardcoded geometry.

    Parameters
    ----------
    trichion_y_px : float | None
        When provided (from the pipeline's BiSeNet virtual_landmarks["trichion"][1]),
        this pixel y is used directly as the top of the forehead zone.  When absent,
        falls back to algebraic derivation from upper_third_ratio.

    Output shape::

        {
          "zones": [
            {"metric_id": "upper_third_ratio", "rect": {"x":…,"y":…,"w":…,"h":…},
             "severity_5": "mild", "direction": "low"},
            …
          ]
        }
    """
    x_zygo_l = _xy(lm, P_ZYGO_IMG_LEFT)[0]
    x_zygo_r = _xy(lm, P_ZYGO_IMG_RIGHT)[0]
    x_face_l = min(x_zygo_l, x_zygo_r)
    x_face_r = max(x_zygo_l, x_zygo_r)
    face_w   = max(1.0, x_face_r - x_face_l)

    y_brow_l = _xy(lm, P_BROW_LEFT_INNER)[1]
    y_brow_r = _xy(lm, P_BROW_RIGHT_INNER)[1]
    y_brow   = (y_brow_l + y_brow_r) / 2.0

    # Priority: direct pixel trichion from BiSeNet virtual_landmarks > metric roundtrip > lm[10]
    if trichion_y_px is not None:
        y_top = float(trichion_y_px)
    else:
        y_top = _derive_trichion_y_px(lm, metric_evals)
    y_top = max(0.0, min(y_top, y_brow - 1))

    y_sub = _xy(lm, P_SUBNASALE)[1]
    y_men = _xy(lm, P_MENTON)[1]
    y_mid = max(y_brow + 1, y_sub)
    y_bot = max(y_mid + 1, y_men)

    def _met(mid: str) -> dict | None:
        return _metric_get(metric_evals, mid) if metric_evals else None

    zone_defs = [
        ("forehead_height_ratio", x_face_l + face_w * 0.16, y_top, face_w * 0.68, max(12.0, y_brow - y_top)),
        ("upper_third_ratio",     x_face_l + face_w * 0.08, y_top, face_w * 0.84, max(12.0, y_brow - y_top)),
        ("middle_third_ratio",    x_face_l + face_w * 0.08, y_brow, face_w * 0.84, max(12.0, y_mid - y_brow)),
        ("lower_third_ratio",     x_face_l + face_w * 0.05, y_mid, face_w * 0.90, max(12.0, y_bot - y_mid)),
    ]

    zones = []
    for metric_id, rx, ry, rw, rh in zone_defs:
        m = _met(metric_id)
        zones.append({
            "metric_id":  metric_id,
            "rect":       {"x": round(rx, 1), "y": round(ry, 1), "w": round(rw, 1), "h": round(rh, 1)},
            "severity_5": m.get("severity_5") if m else None,
            "direction":  m.get("direction") if m else None,
        })

    return {"zones": zones}


def build_metrics_map_metadata(
    lm: Sequence[Sequence[float]],
    metric_evals: Iterable[dict] | None = None,
    region_adherence: Iterable[dict] | None = None,
) -> dict:
    """Compute per-region bounding boxes from landmarks for MetricsMapLayer.

    Replaces the hardcoded REGION_BOUNDS object in the frontend.

    Output shape::

        {
          "regions": [
            {"region": "FOREHEAD", "bounds": {"x":…,"y":…,"w":…,"h":…},
             "adherence": 0.87, "confidence": 0.9},
            …
          ]
        }
    """
    x_zygo_l = _xy(lm, P_ZYGO_IMG_LEFT)[0]
    x_zygo_r = _xy(lm, P_ZYGO_IMG_RIGHT)[0]
    x_face_l = min(x_zygo_l, x_zygo_r)
    x_face_r = max(x_zygo_l, x_zygo_r)
    face_w   = max(1.0, x_face_r - x_face_l)

    y_brow_l = _xy(lm, P_BROW_LEFT_INNER)[1]
    y_brow_r = _xy(lm, P_BROW_RIGHT_INNER)[1]
    y_brow   = (y_brow_l + y_brow_r) / 2.0

    ridge_ys = [_xy(lm, idx)[1] for idx in _FOREHEAD_RIDGE if idx < len(lm)]
    y_top    = min(ridge_ys) if ridge_ys else _xy(lm, P_FOREHEAD_CROWN)[1]
    y_top    = max(0.0, min(y_top, y_brow - 1))

    y_sub = _xy(lm, P_SUBNASALE)[1]
    y_men = _xy(lm, P_MENTON)[1]
    y_eye_inner_l = _xy(lm, P_LEFT_EYE_INNER)[1]
    y_eye_inner_r = _xy(lm, P_RIGHT_EYE_INNER)[1]
    y_eye_center  = (y_eye_inner_l + y_eye_inner_r) / 2.0

    # Eye outer x coords for eye-region width
    x_eye_ol = _xy(lm, P_EYE_OUTER_IMG_LEFT)[0]
    x_eye_or = _xy(lm, P_EYE_OUTER_IMG_RIGHT)[0]
    x_eye_l  = min(x_eye_ol, x_eye_or)
    x_eye_r  = max(x_eye_ol, x_eye_or)

    # Region bounding rects computed from landmarks
    pad_x = face_w * 0.05
    region_bounds_lm: dict[str, dict] = {
        "FOREHEAD": {"x": x_face_l + pad_x, "y": y_top,           "w": face_w - pad_x * 2, "h": max(12.0, y_brow - y_top)},
        "EYES":     {"x": x_eye_l - pad_x,  "y": y_brow,          "w": (x_eye_r - x_eye_l) + pad_x * 2, "h": max(12.0, y_sub - y_brow) * 0.5},
        "NOSE":     {"x": x_face_l + face_w * 0.2, "y": y_brow + (y_sub - y_brow) * 0.4, "w": face_w * 0.6, "h": max(12.0, (y_sub - y_brow) * 0.6)},
        "MOUTH":    {"x": x_face_l + face_w * 0.15, "y": y_sub,   "w": face_w * 0.70, "h": max(12.0, (y_men - y_sub) * 0.5)},
        "JAW":      {"x": x_face_l + pad_x, "y": y_sub + (y_men - y_sub) * 0.4, "w": face_w - pad_x * 2, "h": max(12.0, (y_men - y_sub) * 0.6)},
    }

    # Build adherence lookup
    adh_map: dict[str, dict] = {}
    if region_adherence:
        for ra in region_adherence:
            if ra and ra.get("region"):
                adh_map[ra["region"]] = ra

    regions = []
    for region_name, bounds in region_bounds_lm.items():
        ra = adh_map.get(region_name, {})
        regions.append({
            "region":     region_name,
            "bounds":     {k: round(v, 1) for k, v in bounds.items()},
            "adherence":  ra.get("adherence"),
            "confidence": ra.get("confidence"),
        })

    return {"regions": regions}


def build_asymmetry_analysis_annotations(
    lm: Sequence[Sequence[float]],
    asymmetry_measurements: dict | None,
    image_size: tuple[int, int],
) -> dict:
    """Build JSON for the AsymmetryAnalysisLayer SVG renderer.

    Replaces the burned-in OpenCV markings in ``*_mvp_annotated.jpg`` with
    pure data: Frankfort horizontal y-line, facial midline anchor points,
    and the deviation of each anatomical key-point relative to the midline.
    """
    width, height = int(image_size[0]), int(image_size[1])

    def _avg_xy(indices: Sequence[int]) -> tuple[float, float]:
        xs = [_xy(lm, i)[0] for i in indices if i < len(lm)]
        ys = [_xy(lm, i)[1] for i in indices if i < len(lm)]
        if not xs or not ys:
            return (0.0, 0.0)
        return (sum(xs) / len(xs), sum(ys) / len(ys))

    left_eye  = _avg_xy(LM_LEFT_EYE_ASYM)
    right_eye = _avg_xy(LM_RIGHT_EYE_ASYM)
    eye_y     = (left_eye[1] + right_eye[1]) / 2.0

    glabella_x = (_xy(lm, P_BROW_LEFT_INNER)[0] + _xy(lm, P_BROW_RIGHT_INNER)[0]) / 2.0
    eye_mid_x  = (left_eye[0] + right_eye[0]) / 2.0
    midline_x  = (glabella_x + eye_mid_x) / 2.0

    glabella_y = (_xy(lm, P_BROW_LEFT_INNER)[1] + _xy(lm, P_BROW_RIGHT_INNER)[1]) / 2.0
    menton_y   = _xy(lm, P_MENTON)[1]
    y_top      = max(0.0, glabella_y - 30.0)
    y_bot      = min(float(height), menton_y + 30.0)

    deviation_defs = [
        ("Ponta do nariz", P_NOSE_TIP_ASYM),
        ("Mento",          P_MENTON),
        ("Lábio superior", P_UPPER_LIP_ASYM),
        ("Canto E. boca",  P_LEFT_MOUTH),
        ("Canto D. boca",  P_RIGHT_MOUTH),
    ]
    deviations = []
    for label, idx in deviation_defs:
        if idx >= len(lm):
            continue
        x, y = _xy(lm, idx)
        deviations.append({
            "label":         label,
            "landmark_idx":  idx,
            "x":             round(x, 1),
            "y":             round(y, 1),
            "midline_x":     round(midline_x, 1),
            "deviation_px":  round(abs(x - midline_x), 2),
        })

    measurements = asymmetry_measurements or {}
    overall_score   = measurements.get("overall_asymmetry_score")
    overall_pct_ipd = measurements.get("overall_asymmetry_score_pct_ipd")

    return {
        "image_size": {"width": width, "height": height},
        "frankfort_horizontal": {
            "y":         round(eye_y, 1),
            "eye_left":  {"x": round(left_eye[0], 1),  "y": round(left_eye[1], 1)},
            "eye_right": {"x": round(right_eye[0], 1), "y": round(right_eye[1], 1)},
        },
        "facial_midline": {
            "x_top":    round(midline_x, 1),
            "y_top":    round(y_top, 1),
            "x_bottom": round(midline_x, 1),
            "y_bottom": round(y_bot, 1),
        },
        "deviations": deviations,
        "overall_asymmetry_score":         overall_score,
        "overall_asymmetry_score_pct_ipd": overall_pct_ipd,
    }
