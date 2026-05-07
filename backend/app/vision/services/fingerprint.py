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
) -> str:
    fingerprint_parts = [
        str(bool(flags.get("beard", False))),
        str(bool(flags.get("glasses", False))),
        str(bool(flags.get("smile", False))),
        _bucket_lighting(mean_luminance),
        _bucket_pose(pose),
        _bucket_distance(face_width_ratio),
    ]
    fingerprint_input = "|".join(fingerprint_parts)
    return hashlib.sha1(fingerprint_input.encode("utf-8"), usedforsecurity=False).hexdigest()[:16]
