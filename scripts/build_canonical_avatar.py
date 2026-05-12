"""Convert MediaPipe canonical_face_model.obj (468 verts) into the 478-point
AVATAR_LANDMARKS array used by the BiometricFaceSimulator.

The OBJ uses a right-handed 3D coord system centered roughly at origin with
Y pointing up. We project to 2D by:
- x_norm = +x  (mirror not needed — model is symmetric)
- y_norm = -y  (flip Y so screen-down is positive)
Then scale+center so the face bbox fills 90% of [0,1]^2.

Indices 468..477 (iris) are filled with the centroid (0.5, 0.5); they're
filtered out of the triangulation already, so values are inert."""
import json
import sys
from pathlib import Path

OBJ = Path("/tmp/canonical_face_model.obj")
OUT = Path("/tmp/canonical_avatar.ts")

verts: list[tuple[float, float]] = []
for line in OBJ.read_text().splitlines():
    if not line.startswith("v "):
        continue
    parts = line.split()
    x, y, _z = float(parts[1]), float(parts[2]), float(parts[3])
    verts.append((x, -y))  # flip Y so screen-down is positive

assert len(verts) == 468, f"expected 468 verts, got {len(verts)}"

xs = [p[0] for p in verts]
ys = [p[1] for p in verts]
x0, x1 = min(xs), max(xs)
y0, y1 = min(ys), max(ys)
fw, fh = (x1 - x0), (y1 - y0)
scale = 0.90 / max(fw, fh)
cx_src, cy_src = (x0 + x1) / 2, (y0 + y1) / 2

pts = [
    {
        "x": round(0.5 + (px - cx_src) * scale, 5),
        "y": round(0.5 + (py - cy_src) * scale, 5),
    }
    for (px, py) in verts
]

# Pad indices 468..477 with the centroid (iris ring; not used in wireframe).
while len(pts) < 478:
    pts.append({"x": 0.5, "y": 0.5})

print(f"verts: {len(pts)}")
print(f"idx 1   (nose tip):     {pts[1]}")
print(f"idx 10  (forehead):     {pts[10]}")
print(f"idx 152 (chin):         {pts[152]}")
print(f"idx 234 (templeL):      {pts[234]}")
print(f"idx 454 (templeR):      {pts[454]}")
print(f"idx 13  (upper lip):    {pts[13]}")

body = ",\n".join(f'  {{ x: {p["x"]}, y: {p["y"]} }}' for p in pts)
ts = (
    "/**\n"
    " * AVATAR_LANDMARKS — 478 facial landmarks.\n"
    " *\n"
    " * Source: MediaPipe `canonical_face_model.obj` (468 verts, MIT-licensed)\n"
    " * https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/\n"
    " *   face_geometry/data/canonical_face_model.obj\n"
    " *\n"
    " * Indices 0..467 are the canonical face mesh, projected to 2D (XY plane,\n"
    " * Y flipped so screen-down is +y), centered & scaled so the face bbox fills\n"
    " * 90% of [0,1]^2. Indices 468..477 (iris ring) are padded with the centroid\n"
    " * (0.5, 0.5); they're filtered out of FACE_TRIANGLES already.\n"
    " *\n"
    " * Regenerate via scripts/build_canonical_avatar.py.\n"
    " */\n"
    "export const AVATAR_LANDMARKS: ReadonlyArray<{ x: number; y: number }> = "
    "Object.freeze([\n"
    f"{body}\n"
    "]);\n"
)
OUT.write_text(ts)
print(f"OK -> {OUT}")
