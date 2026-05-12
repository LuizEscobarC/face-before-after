"""Regenerate frontend/src/biometric/avatarLandmarks.ts from a real face photo.

Runs MediaPipe Tasks Vision FaceLandmarker on a neutral-frontal image and
writes the 478 normalized points (face bbox fits 90% of [0,1]^2 canvas) as
a frozen TypeScript array.

Usage (host):
    docker cp <photo>.png face-vision-service:/tmp/avatar_src.png
    docker cp scripts/extract_avatar_landmarks.py face-vision-service:/tmp/x.py
    docker exec face-vision-service python3 /tmp/x.py /tmp/avatar_src.png \
        /tmp/avatarLandmarks.ts
    docker cp face-vision-service:/tmp/avatarLandmarks.ts \
        frontend/src/biometric/avatarLandmarks.ts

The face_landmarker.task model lives at /app/backend/models/ inside the
face-vision-service container.
"""
import json
import sys

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision as mp_vision

MODEL = "/app/backend/models/face_landmarker.task"


def extract(img_path: str) -> list[dict]:
    img = cv2.imread(img_path)
    if img is None:
        sys.exit(f"FAIL: cannot read {img_path}")

    base = mp_python.BaseOptions(model_asset_path=MODEL)
    options = mp_vision.FaceLandmarkerOptions(
        base_options=base,
        running_mode=mp_vision.RunningMode.IMAGE,
        num_faces=1,
        min_face_detection_confidence=0.5,
        min_face_presence_confidence=0.5,
    )
    landmarker = mp_vision.FaceLandmarker.create_from_options(options)
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    result = landmarker.detect(mp_image)
    if not result.face_landmarks:
        sys.exit("NO FACE DETECTED")

    raw = result.face_landmarks[0][:478]
    pts_raw = [(p.x, p.y) for p in raw]
    xs = [p[0] for p in pts_raw]
    ys = [p[1] for p in pts_raw]
    x0, x1 = min(xs), max(xs)
    y0, y1 = min(ys), max(ys)
    fw, fh = (x1 - x0), (y1 - y0)
    scale = 0.90 / max(fw, fh)
    cx_src = (x0 + x1) / 2
    cy_src = (y0 + y1) / 2
    return [
        {
            "x": round(0.5 + (px - cx_src) * scale, 5),
            "y": round(0.5 + (py - cy_src) * scale, 5),
        }
        for (px, py) in pts_raw
    ]


def render_ts(pts: list[dict]) -> str:
    body = ",\n".join(f'  {{ x: {p["x"]}, y: {p["y"]} }}' for p in pts)
    return (
        "/**\n"
        " * AVATAR_LANDMARKS — 478 MediaPipe Face Mesh landmarks extracted from a real\n"
        " * neutral frontal face photo via mediapipe.tasks FaceLandmarker.\n"
        " *\n"
        " * Coordinates are normalized so the face bbox fills 90% of the [0,1]^2\n"
        " * canvas, centered at (0.5, 0.5). Used as fallback when the user has no\n"
        " * landmarks of their own (admin preview, first-run state).\n"
        " *\n"
        " * Regenerate via scripts/extract_avatar_landmarks.py.\n"
        " */\n"
        "export const AVATAR_LANDMARKS: ReadonlyArray<{ x: number; y: number }> = "
        "Object.freeze([\n"
        f"{body}\n"
        "]);\n"
    )


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit("usage: extract_avatar_landmarks.py <input.png> <output.ts>")
    pts = extract(sys.argv[1])
    open(sys.argv[2], "w").write(render_ts(pts))
    print(f"OK -> {sys.argv[2]} ({len(pts)} landmarks)")
