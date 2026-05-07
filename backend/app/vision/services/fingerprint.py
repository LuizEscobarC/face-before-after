"""Session fingerprint — discrete buckets for ConsistencyScore matching."""
from __future__ import annotations

import hashlib


def _bucket_lighting(mean_luminance: float) -> str:
    if mean_luminance < 90:
        return "dark"
    if mean_luminance < 140:
        return "mid"
    if mean_luminance < 180:
        return "bright"
    return "overexposed"


def _bucket_pose(pose: dict[str, float]) -> str:
    yaw = abs(pose["yaw"])
    if yaw < 5:
        return "frontal"
    if yaw < 15:
        return "slight"
    return "off"


def _bucket_distance(face_width_ratio: float) -> str:
    """face_width_ratio = face_bbox_w / image_w."""
    if face_width_ratio < 0.25:
        return "far"
    if face_width_ratio < 0.55:
        return "mid"
    return "close"


def build_session_fingerprint(
    flags: dict[str, bool],
    pose: dict[str, float],
    mean_luminance: float,
    face_width_ratio: float,
) -> tuple[str, list[str]]:
    fingerprint_parts = [
        str(bool(flags.get("beard", False))),
        str(bool(flags.get("glasses", False))),
        str(bool(flags.get("smile", False))),
        _bucket_lighting(mean_luminance),
        _bucket_pose(pose),
        _bucket_distance(face_width_ratio),
    ]
    fingerprint_input = "|".join(fingerprint_parts)
    fingerprint_hash = hashlib.sha1(fingerprint_input.encode("utf-8"), usedforsecurity=False).hexdigest()[:16]
    return fingerprint_hash, fingerprint_parts


_PART_LABELS = ["beard", "glasses", "smile", "lighting", "pose", "distance"]
_CRITICAL_PARTS = {"lighting", "pose", "distance"}


def compute_consistency_score(
    parts_a: list[str],
    parts_b: list[str],
) -> dict:
    """Compare two fingerprint_parts lists. Returns consistency_score, issues and is_comparable."""
    if not parts_a or not parts_b:
        return {
            "consistency_score": 0.0,
            "consistency_issues": ["Dados de fingerprint insuficientes."],
            "is_comparable": False,
        }

    n = min(len(parts_a), len(parts_b), len(_PART_LABELS))
    issues: list[str] = []
    matches = 0
    critical_ok = True

    _messages = {
        "pose": "Pose diferente entre as fotos (ângulo de captura distinto).",
        "lighting": "Iluminação diferente entre as fotos.",
        "distance": "Distância de captura diferente entre as fotos.",
        "beard": "Estado de barba difere entre as fotos.",
        "glasses": "Uso de óculos difere entre as fotos.",
        "smile": "Expressão (sorriso) difere entre as fotos.",
    }

    for i in range(n):
        label = _PART_LABELS[i]
        if parts_a[i] == parts_b[i]:
            matches += 1
        else:
            if label in _CRITICAL_PARTS:
                critical_ok = False
            msg = _messages.get(label)
            if msg:
                issues.append(msg)

    consistency_score = round(matches / n, 4) if n > 0 else 0.0

    return {
        "consistency_score": consistency_score,
        "consistency_issues": issues,
        "is_comparable": critical_ok and consistency_score >= 0.5,
    }
