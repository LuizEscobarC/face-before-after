#!/usr/bin/env python3
"""Render every visualization the React frontend shows, as standalone PNGs.

Closed-loop testing rig for overlay calculations: edit a calculator,
rerun this script, inspect the PNGs (or the contact-sheet HTML).

Usage:
    python scripts/render_all_overlays.py <image>
        [--api http://localhost:9015]
        [--out review/<stem>]

What it produces, in `review/<stem>/`:
    report.json
    <stem>_axis_vertical.png            (server-rendered)
    <stem>_axis_intercanthal.png        (server-rendered)
    <stem>_grid_thirds.png              (server-rendered)
    <stem>_grid_fifths.png              (server-rendered)
    <stem>_outline_face.png             (server-rendered)
    <stem>_face_extents.png             (client-side: not in /vision/render)
    <stem>_improvement_vectors.png      (client-side: not in /vision/render)
    <stem>_heatmap_asymmetry.png        (server-rendered)
    <stem>_heatmap_ideal_adherence.png  (server-rendered, may be skipped if no region data)
    <stem>_compare_original_vs_simetrizado.png
    <stem>_metrics_map.png              (PIL panel)
    <stem>_ideal_proportions.png        (PIL panel)
    <stem>_index.html                   (contact sheet)

Backend contracts (cross-checked against
`backend/app/vision/routers/{render,compose,full_pipeline}.py`):

    POST /vision/full-pipeline/upload   multipart: photo, mode=premium
    POST /vision/render                 multipart: image, landmarks_json,
                                                   overlay_ids_json,
                                                   region_adherence_json?
    POST /vision/compose-before-ideal   multipart: image, landmarks_json,
                                                   offsets_json
"""

from __future__ import annotations

import argparse
import io
import json
import math
import sys
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageDraw, ImageFont

import _overlay_render as ovl  # PIL port of OverlayLayer.tsx (sibling module).

# ---------------------------------------------------------------------------
# Constants — kept in sync with frontend/src/components/OverlayLayer.tsx
# Any drift here means the agent is reviewing a different overlay than the
# user actually sees in the browser.
# ---------------------------------------------------------------------------

P_NOSE_TIP = 1
P_MENTON = 152
P_LEFT_EYE_INNER = 133
P_RIGHT_EYE_INNER = 362
P_LEFT_EYE_OUTER = 33
P_RIGHT_EYE_OUTER = 263
P_BROW_LEFT_INNER = 107
P_BROW_RIGHT_INNER = 336
P_SUBNASALE = 2
P_FOREHEAD_CROWN = 10
P_ZYGO_IMG_RIGHT = 454
P_ZYGO_IMG_LEFT = 234

# z=10/20 SVG line styles mirroring OVERLAY_STYLES + SEVERITY_ARROW_COLORS.
SEVERITY_ARROW_COLORS = {
    "mild": (34, 197, 94),
    "moderate": (234, 179, 8),
    "strong": (249, 115, 22),
    "extreme": (239, 68, 68),
}
FACE_EXTENTS_STROKE = (255, 255, 255)

OVERLAY_LABELS = {
    "axis_vertical": "Eixo vertical",
    "axis_intercanthal": "Eixo intercantal",
    "grid_thirds": "Terços faciais",
    "grid_fifths": "Quintos faciais",
    "outline_face": "Contorno facial",
    "face_extents": "Extremidades da face",
    "improvement_vectors": "Vetores de melhoria",
    "heatmap_asymmetry": "Mapa de calor — assimetria",
    "heatmap_ideal_adherence": "Mapa de calor — aderência",
    "compare_original_vs_simetrizado": "Comparativo original vs simetrizado",
    "metrics_map": "Mapa de métricas detectadas",
    "ideal_proportions": "Proporções ideais",
}

SERVER_HEATMAP_OVERLAYS = ["heatmap_asymmetry", "heatmap_ideal_adherence"]
LINE_OVERLAYS = [
    "axis_vertical",
    "axis_intercanthal",
    "grid_thirds",
    "grid_fifths",
    "outline_face",
    "face_extents",
    "improvement_vectors",
]


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

class ApiError(RuntimeError):
    pass


def probe_api(api_url: str) -> None:
    try:
        r = requests.get(api_url + "/", timeout=5)
        r.raise_for_status()
    except Exception as exc:
        raise ApiError(
            f"API not reachable at {api_url} — start it with "
            f"`docker compose up -d` (or `just api-dev`). Underlying: {exc}"
        ) from exc


def call_full_pipeline(api_url: str, image_path: Path) -> dict[str, Any]:
    with image_path.open("rb") as fh:
        files = {"photo": (image_path.name, fh, "image/jpeg")}
        data = {"mode": "premium"}
        r = requests.post(
            f"{api_url}/vision/full-pipeline/upload",
            files=files, data=data, timeout=180,
        )
    if r.status_code != 200:
        raise ApiError(f"full-pipeline failed [{r.status_code}]: {r.text[:500]}")
    return r.json()


def call_render(
    api_url: str,
    image_bytes: bytes,
    image_name: str,
    landmarks: list[list[float]],
    overlay_id: str,
    region_adherence: list[dict] | None = None,
) -> bytes | None:
    files = {"image": (image_name, image_bytes, "image/jpeg")}
    data = {
        "landmarks_json": json.dumps(landmarks),
        "overlay_ids_json": json.dumps([overlay_id]),
    }
    if region_adherence is not None:
        data["region_adherence_json"] = json.dumps(region_adherence)
    r = requests.post(f"{api_url}/vision/render", files=files, data=data, timeout=120)
    if r.status_code != 200:
        # 422 with suppressed=... is an acceptable "no data" outcome for heatmaps
        try:
            payload = r.json()
        except ValueError:
            payload = r.text[:500]
        print(f"  ! /vision/render {overlay_id} -> {r.status_code}: {payload}", file=sys.stderr)
        return None
    return r.content


def call_compose(
    api_url: str,
    image_bytes: bytes,
    image_name: str,
    landmarks: list[list[float]],
    offsets: list[dict],
) -> bytes | None:
    files = {"image": (image_name, image_bytes, "image/jpeg")}
    data = {
        "landmarks_json": json.dumps(landmarks),
        "offsets_json": json.dumps(offsets),
        "show_actual_wireframe": "true",
        "show_guide_lines": "true",
    }
    r = requests.post(
        f"{api_url}/vision/compose-before-ideal",
        files=files, data=data, timeout=120,
    )
    if r.status_code != 200:
        print(f"  ! compose-before-ideal -> {r.status_code}: {r.text[:300]}", file=sys.stderr)
        return None
    return r.content


# ---------------------------------------------------------------------------
# Client-side overlay renderers
#   Lines/face_extents/improvement_vectors are rendered by ``_overlay_render``
#   (PIL port of OverlayLayer.tsx). Heatmaps still come from /vision/render
#   because they require scipy interpolation + density gating.
# ---------------------------------------------------------------------------

def _font(size: int = 14) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in ("DejaVuSans.ttf", "Arial.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_line_overlay(
    image_bytes: bytes,
    overlay_id: str,
    lm: list[list[float]],
    metric_evals: list[dict],
    trichion_source: str | None,
) -> tuple[bytes, dict[str, Any]]:
    """Dispatch to the correct PIL renderer for a single line overlay.

    Returns ``(png_bytes, info)``. ``info`` carries diagnostic metadata
    (e.g. arrow count for improvement_vectors).
    """
    base = Image.open(io.BytesIO(image_bytes))
    info: dict[str, Any] = {}
    if overlay_id == "axis_vertical":
        out = ovl.draw_axis_vertical(base, lm)
    elif overlay_id == "axis_intercanthal":
        out = ovl.draw_axis_intercanthal(base, lm)
    elif overlay_id == "grid_thirds":
        out = ovl.draw_grid_thirds(base, lm, metric_evals)
    elif overlay_id == "grid_fifths":
        out = ovl.draw_grid_fifths(base, lm)
    elif overlay_id == "outline_face":
        out = ovl.draw_outline_face(base, lm, metric_evals)
    elif overlay_id == "face_extents":
        out = ovl.draw_face_extents(base, lm, trichion_source, metric_evals)
    elif overlay_id == "improvement_vectors":
        out, drawn = ovl.draw_improvement_vectors(base, lm, metric_evals)
        info["arrows_drawn"] = drawn
    else:
        raise ValueError(f"Unknown line overlay id: {overlay_id}")
    buf = io.BytesIO()
    out.convert("RGB").save(buf, format="PNG")
    return buf.getvalue(), info


# ---------------------------------------------------------------------------
# Text panels (PIL) — metrics_map and ideal_proportions
# ---------------------------------------------------------------------------

def _severity_color(sev: str | None) -> tuple[int, int, int]:
    if not sev:
        return (148, 163, 184)
    s = sev.lower()
    if "excel" in s or "ideal" in s or "mild" in s: return (34, 197, 94)
    if "leve" in s: return (132, 204, 22)
    if "moder" in s: return (234, 179, 8)
    if "acent" in s or "strong" in s: return (249, 115, 22)
    if "sever" in s or "extreme" in s: return (239, 68, 68)
    return (148, 163, 184)


def render_metrics_map(metric_evals: list[dict], width: int = 980) -> bytes:
    rows = sorted(
        [m for m in metric_evals if not m.get("presentation_only")],
        key=lambda m: (m.get("region") or "", m.get("metric_id") or ""),
    )
    row_h = 22
    pad = 16
    height = pad * 2 + 38 + max(1, len(rows)) * row_h
    img = Image.new("RGB", (width, height), (10, 10, 18))
    draw = ImageDraw.Draw(img)
    title_font = _font(18)
    header_font = _font(12)
    cell_font = _font(12)

    draw.text((pad, pad), "Mapa de métricas detectadas", fill=(226, 232, 240), font=title_font)
    y = pad + 30
    cols = [
        ("region", 90),
        ("metric_id", 360),
        ("value", 110),
        ("ideal", 110),
        ("conf", 70),
        ("severity", 110),
    ]
    x = pad
    for label, w in cols:
        draw.text((x, y), label, fill=(148, 163, 184), font=header_font)
        x += w
    y += 18
    draw.line([(pad, y - 2), (width - pad, y - 2)], fill=(40, 40, 60), width=1)

    for m in rows:
        x = pad
        cells = [
            (str(m.get("region") or "—"), (148, 163, 184)),
            (str(m.get("metric_id") or "?"), (226, 232, 240)),
            (f"{m.get('value'):.4f}" if isinstance(m.get("value"), (int, float)) else "—",
             (226, 232, 240)),
            (str(m.get("ideal") if m.get("ideal") is not None else "—"), (148, 163, 184)),
            (f"{m.get('confidence_final'):.2f}" if isinstance(m.get("confidence_final"), (int, float)) else "—",
             (148, 163, 184)),
            (str(m.get("severity5") or m.get("severity") or "—"),
             _severity_color(m.get("severity5") or m.get("severity"))),
        ]
        for (text, color), (_, w) in zip(cells, cols):
            draw.text((x, y), text[: max(1, w // 7)], fill=color, font=cell_font)
            x += w
        y += row_h

    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def render_ideal_proportions(metric_evals: list[dict]) -> bytes:
    """Static reference card with the canonical ideals + the photo's measured values."""
    by_id = {m.get("metric_id"): m for m in metric_evals}
    rows: list[tuple[str, str, str]] = []
    for mid, ideal_label in [
        ("upper_third_ratio", "≈ 0.333 (Farkas)"),
        ("middle_third_ratio", "≈ 0.333 (Farkas)"),
        ("lower_third_ratio", "≈ 0.333 (Farkas)"),
        ("facial_index_anthropometric", "87.5 (mesoprosopic)"),
        ("face_height_to_width_ratio", "≈ 0.86–0.94 (Naini)"),
        ("phi_face_height_to_width", "1.618 (φ)"),
        ("forehead_height_ratio", "1.90 ICU"),
        ("chin_projection_proxy", "0.33 (Farkas)"),
    ]:
        m = by_id.get(mid)
        val = "—"
        if m and isinstance(m.get("value"), (int, float)):
            val = f"{m['value']:.3f}"
        rows.append((mid, val, ideal_label))

    width, row_h, pad = 880, 26, 18
    height = pad * 2 + 40 + len(rows) * row_h
    img = Image.new("RGB", (width, height), (10, 10, 18))
    draw = ImageDraw.Draw(img)
    draw.text((pad, pad), "Proporções ideais (referência canônica)",
              fill=(226, 232, 240), font=_font(18))
    y = pad + 32
    draw.text((pad, y), "métrica", fill=(148, 163, 184), font=_font(12))
    draw.text((pad + 360, y), "medido", fill=(148, 163, 184), font=_font(12))
    draw.text((pad + 480, y), "ideal", fill=(148, 163, 184), font=_font(12))
    y += 18
    draw.line([(pad, y - 2), (width - pad, y - 2)], fill=(40, 40, 60), width=1)
    for mid, val, ideal in rows:
        draw.text((pad, y), mid, fill=(226, 232, 240), font=_font(13))
        draw.text((pad + 360, y), val, fill=(34, 211, 238), font=_font(13))
        draw.text((pad + 480, y), ideal, fill=(165, 180, 252), font=_font(13))
        y += row_h
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


# ---------------------------------------------------------------------------
# Compose offsets — must mirror PremiumResultPage.tsx::buildComposeOffsets
# ---------------------------------------------------------------------------

def build_compose_offsets(metric_evals: list[dict]) -> list[dict]:
    out: list[dict] = []
    for m in metric_evals:
        anchor = m.get("anchor_landmark_index")
        if anchor is None:
            deps = m.get("dependency_landmarks") or []
            anchor = deps[0] if deps else None
        if anchor is None:
            continue
        vx = m.get("improvement_vector_x")
        vy = m.get("improvement_vector_y")
        if vx is None and vy is None:
            continue
        out.append({
            "landmark_index": int(anchor),
            "dx_icu": float(vx or 0.0),
            "dy_icu": float(vy or 0.0),
            "metric_id": m.get("metric_id") or "",
        })
    return out


# ---------------------------------------------------------------------------
# region_adherence — derive from region_metric_evaluations or aggregate
# from metric_evaluations when the per-region rollup is empty.
# ---------------------------------------------------------------------------

def build_region_adherence(report: dict) -> list[dict]:
    rme = report.get("region_metric_evaluations") or []
    if isinstance(rme, list) and rme:
        out = []
        for r in rme:
            try:
                out.append({
                    "region": str(r["region"]),
                    "adherence": float(r.get("adherence", r.get("score", 0.0))),
                    "confidence": float(r.get("confidence_final", r.get("confidence", 1.0))),
                })
            except (KeyError, TypeError, ValueError):
                continue
        if out:
            return out

    # Fallback: aggregate from per-metric evaluations.
    # adherence = 1 - clip(|deviation_normalized|, 0, 1) when present,
    # otherwise 1 - clip(|value - ideal|, 0, 1) is too noisy — skip.
    by_region: dict[str, list[tuple[float, float]]] = {}
    for m in report.get("metric_evaluations", []) or []:
        if m.get("presentation_only"):
            continue
        region = m.get("region")
        dev = m.get("deviation_normalized")
        conf = m.get("confidence_final")
        if not region or not isinstance(dev, (int, float)) or not isinstance(conf, (int, float)):
            continue
        adher = 1.0 - min(1.0, abs(float(dev)))
        by_region.setdefault(region, []).append((adher, float(conf)))
    out = []
    for region, samples in by_region.items():
        wsum = sum(c for _, c in samples)
        if wsum <= 0:
            continue
        adher = sum(a * c for a, c in samples) / wsum
        out.append({"region": region, "adherence": adher, "confidence": wsum / len(samples)})
    return out


# ---------------------------------------------------------------------------
# Index HTML — single-page contact sheet
# ---------------------------------------------------------------------------

INDEX_TEMPLATE = """<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Overlay review — {stem}</title>
<style>
 body{{background:#0a0a12;color:#e2e8f0;font:14px system-ui;margin:0;padding:24px}}
 h1{{font-size:22px;margin:0 0 4px}}
 header p{{color:#94a3b8;margin:0 0 18px}}
 .badge{{display:inline-block;background:rgba(99,102,241,.15);
        border:1px solid rgba(99,102,241,.4);color:#a5b4fc;
        border-radius:99px;padding:2px 10px;margin-right:6px;font-size:12px}}
 .grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:16px}}
 figure{{background:#13131f;border:1px solid rgba(255,255,255,.07);
         border-radius:12px;padding:10px;margin:0}}
 figcaption{{font-size:13px;color:#94a3b8;margin-bottom:6px}}
 figcaption b{{color:#e2e8f0}}
 img{{width:100%;height:auto;border-radius:8px;background:#000;display:block}}
 .miss{{color:#fca5a5;font-style:italic}}
</style></head>
<body>
<header>
 <h1>Overlay review — {stem}</h1>
 <p>
  <span class="badge">trichion: {trichion}</span>
  <span class="badge">score: {score}</span>
  <span class="badge">tier: {tier}</span>
  <span class="badge">run_id: {run_id}</span>
 </p>
</header>
<div class="grid">
{cards}
</div>
</body></html>
"""


def build_index_html(out_dir: Path, stem: str, report: dict, items: list[tuple[str, str | None]]) -> Path:
    cards = []
    for overlay_id, png_name in items:
        label = OVERLAY_LABELS.get(overlay_id, overlay_id)
        if png_name and (out_dir / png_name).exists():
            body = f'<img src="{png_name}" alt="{label}"/>'
        else:
            body = '<p class="miss">não disponível</p>'
        cards.append(
            f'<figure><figcaption><b>{label}</b><br/>{overlay_id}</figcaption>{body}</figure>'
        )
    html = INDEX_TEMPLATE.format(
        stem=stem,
        trichion=str(report.get("trichion_source") or "mesh (fallback)"),
        score=report.get("score", "—"),
        tier=report.get("tier", "—"),
        run_id=report.get("run_id", "—"),
        cards="\n".join(cards),
    )
    target = out_dir / f"{stem}_index.html"
    target.write_text(html, encoding="utf-8")
    return target


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("image", type=Path, help="Path to a face photo (jpg/png)")
    ap.add_argument("--api", default="http://localhost:9015",
                    help="Vision API base URL (default: %(default)s)")
    ap.add_argument("--out", type=Path, default=None,
                    help="Output dir (default: review/<image-stem>)")
    args = ap.parse_args(argv)

    image_path: Path = args.image
    if not image_path.exists():
        print(f"ERROR: image not found: {image_path}", file=sys.stderr)
        return 2
    stem = image_path.stem
    out_dir: Path = args.out or Path("review") / stem
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[1/5] Probing API at {args.api} ...")
    probe_api(args.api)

    print(f"[2/5] Running full pipeline on {image_path.name} ...")
    pipe = call_full_pipeline(args.api, image_path)
    report = pipe.get("result") or {}
    report.setdefault("run_id", pipe.get("run_id"))
    landmarks = report.get("landmarks") or []
    if not landmarks or len(landmarks) < 478:
        print(f"ERROR: pipeline returned {len(landmarks)} landmarks, expected ≥478",
              file=sys.stderr)
        return 3
    metric_evals = report.get("metric_evaluations") or []
    trichion_source = report.get("trichion_source")

    (out_dir / "report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"      -> {len(landmarks)} landmarks, {len(metric_evals)} metric evals,"
          f" trichion_source={trichion_source!r}")

    image_bytes = image_path.read_bytes()
    image_name = image_path.name

    # Landmarks returned by the pipeline are in the CANONICAL frame
    # (cropped + rotation-corrected). The PIL renders must use the same
    # frame so landmark coordinates fall on the right pixels.
    # The /vision/render server endpoint handles this internally; only the
    # client-side PIL renders need this adjustment.
    crop_info = report.get("auto_crop") or {}
    rotation_deg = float(report.get("rotation_correction_degrees") or 0.0)
    if crop_info.get("applied") or abs(rotation_deg) > 0.1:
        canonical_img = Image.open(io.BytesIO(image_bytes))
        if abs(rotation_deg) > 0.1:
            canonical_img = canonical_img.rotate(-rotation_deg, expand=True, resample=Image.BICUBIC)
        bbox = crop_info.get("crop_bbox")
        if bbox and len(bbox) == 4:
            canonical_img = canonical_img.crop(tuple(bbox))
        buf = io.BytesIO()
        canonical_img.save(buf, format="JPEG", quality=95)
        pil_image_bytes = buf.getvalue()
    else:
        pil_image_bytes = image_bytes

    artifacts: list[tuple[str, str | None]] = []

    print("[3/5] PIL-rendered line overlays (mirrors OverlayLayer.tsx) ...")
    for oid in LINE_OVERLAYS:
        try:
            png, info = render_line_overlay(
                pil_image_bytes, oid, landmarks, metric_evals, trichion_source,
            )
        except Exception as exc:
            print(f"      ! {oid}: {exc}", file=sys.stderr)
            artifacts.append((oid, None))
            continue
        out_name = f"{stem}_{oid}.png"
        (out_dir / out_name).write_bytes(png)
        suffix = ""
        if "arrows_drawn" in info:
            suffix = f" (arrows={info['arrows_drawn']})"
        print(f"      ✓ {out_name}{suffix}")
        artifacts.append((oid, out_name))

    print("[4/5] Server-rendered heatmaps + composer + panels ...")
    region_adherence = build_region_adherence(report)
    for oid in SERVER_HEATMAP_OVERLAYS:
        ra = region_adherence if oid == "heatmap_ideal_adherence" else None
        if oid == "heatmap_ideal_adherence" and not ra:
            print(f"      ! heatmap_ideal_adherence: skipped (no region adherence data)")
            artifacts.append((oid, None))
            continue
        png = call_render(args.api, image_bytes, image_name, landmarks, oid,
                          region_adherence=ra)
        out_name = f"{stem}_{oid}.png"
        if png:
            (out_dir / out_name).write_bytes(png)
            print(f"      ✓ {out_name}")
            artifacts.append((oid, out_name))
        else:
            artifacts.append((oid, None))

    offsets = build_compose_offsets(metric_evals)
    cmp_png = call_compose(args.api, image_bytes, image_name, landmarks, offsets)
    cmp_name = f"{stem}_compare_original_vs_simetrizado.png"
    if cmp_png:
        (out_dir / cmp_name).write_bytes(cmp_png)
        print(f"      ✓ {cmp_name} ({len(offsets)} offsets)")
        artifacts.append(("compare_original_vs_simetrizado", cmp_name))
    else:
        artifacts.append(("compare_original_vs_simetrizado", None))

    mm_png = render_metrics_map(metric_evals)
    mm_name = f"{stem}_metrics_map.png"
    (out_dir / mm_name).write_bytes(mm_png)
    print(f"      ✓ {mm_name}")
    artifacts.append(("metrics_map", mm_name))

    ip_png = render_ideal_proportions(metric_evals)
    ip_name = f"{stem}_ideal_proportions.png"
    (out_dir / ip_name).write_bytes(ip_png)
    print(f"      ✓ {ip_name}")
    artifacts.append(("ideal_proportions", ip_name))

    print("[5/5] Building contact sheet ...")
    index = build_index_html(out_dir, stem, report, artifacts)
    print(f"      ✓ {index}")
    print()
    print(f"DONE → {out_dir}/")
    print(f"OPEN → file://{index.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
