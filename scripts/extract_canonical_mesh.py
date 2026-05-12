"""Extract MediaPipe's canonical 478-point face mesh and save it as a JSON
ready to be consumed by frontend/src/biometric/normalizeLandmarks.ts.

Run once:
    .venv/bin/python scripts/extract_canonical_mesh.py

It downloads (or re-uses cached) canonical_face_model.obj from the official
MediaPipe repo, parses the 478 vertices, applies the same normalization used
at runtime (forehead 10 / chin 152 / cheek-L 234 / cheek-R 454 anchors → fit
85% of viewBox 100×130), then writes
frontend/src/biometric/canonicalFaceMesh.json.

Re-running is idempotent. Network is required only the first time.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

URL = (
    "https://raw.githubusercontent.com/google-ai-edge/mediapipe/master/"
    "mediapipe/modules/face_geometry/data/canonical_face_model.obj"
)

ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = ROOT / ".cache"
OBJ_PATH = CACHE_DIR / "canonical_face_model.obj"
OUT_PATH = ROOT / "frontend" / "src" / "biometric" / "canonicalFaceMesh.json"

VIEW_W = 100
VIEW_H = 130
FILL_RATIO = 0.85

FOREHEAD = 10
CHIN = 152
CHEEK_L = 234
CHEEK_R = 454


def download_obj() -> str:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if not OBJ_PATH.exists():
        print(f"↓ downloading {URL}")
        urllib.request.urlretrieve(URL, OBJ_PATH)
    return OBJ_PATH.read_text()


def parse_vertices(obj_text: str) -> list[list[float]]:
    verts: list[list[float]] = []
    for line in obj_text.splitlines():
        if not line.startswith("v "):
            continue
        parts = line.split()
        if len(parts) < 4:
            continue
        verts.append([float(parts[1]), float(parts[2]), float(parts[3])])
    if len(verts) != 478:
        print(
            f"⚠ expected 478 vertices, got {len(verts)} — proceeding anyway",
            file=sys.stderr,
        )
    return verts


def normalize(verts: list[list[float]]) -> list[list[float]]:
    """Match the runtime normalizeToViewBox() exactly.

    The .obj file uses a right-handed system where +Y points UP and the face
    is centred near origin. SVG coords have +Y DOWN, so we flip Y here.
    """
    if not verts:
        return verts

    # Flip Y so chin > forehead in image coordinates.
    flipped = [[v[0], -v[1], v[2]] for v in verts]

    forehead = flipped[FOREHEAD]
    chin = flipped[CHIN]
    cheek_l = flipped[CHEEK_L]
    cheek_r = flipped[CHEEK_R]

    min_x = min(cheek_l[0], cheek_r[0])
    max_x = max(cheek_l[0], cheek_r[0])
    min_y = min(forehead[1], chin[1])
    max_y = max(forehead[1], chin[1])
    src_cx = (min_x + max_x) / 2
    src_cy = (min_y + max_y) / 2
    src_h = max(1e-6, max_y - min_y)

    scale = (VIEW_H * FILL_RATIO) / src_h
    cx = VIEW_W / 2
    cy = VIEW_H / 2

    return [
        [
            cx + (v[0] - src_cx) * scale,
            cy + (v[1] - src_cy) * scale,
            v[2] * scale,
        ]
        for v in flipped
    ]


def main() -> int:
    obj_text = download_obj()
    verts = parse_vertices(obj_text)
    points = normalize(verts)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps([[round(c, 4) for c in p] for p in points], separators=(",", ":"))
    )

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"✓ wrote {OUT_PATH.relative_to(ROOT)} ({len(points)} pts, {size_kb:.1f} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
