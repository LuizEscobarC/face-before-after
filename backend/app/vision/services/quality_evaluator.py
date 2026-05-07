"""Photo Quality Gatekeeper — Module 0.

Multiplicative score: face_ok × pose × sharpness × lighting × occlusion × expression.
"""
from __future__ import annotations

from typing import Any

import cv2
import numpy as np


# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------
POSE_LIMITS = {"yaw": (8.0, 20.0), "pitch": (8.0, 20.0), "roll": (5.0, 15.0)}
SHARPNESS_FLOOR = 40.0       # Laplacian variance below this → score 0
SHARPNESS_TARGET = 250.0     # variance >= this → score 1
LIGHTING_TARGET_MEAN = 130.0  # ideal L mean (LAB) — middle exposure
LIGHTING_TOLERANCE = 60.0     # |L_mean - target| above this → score 0
LIGHTING_ASYM_FLOOR = 35.0    # |L_left - L_right| above this → score 0

GRADE_THRESHOLDS = [
    (0.85, "ALTA"),
    (0.70, "MEDIA"),
    (0.55, "BAIXA"),
]


def _linear_decay(value: float, ideal: float, fail: float) -> float:
    """Score 1.0 when |value| <= ideal, decays to 0 at |value| >= fail."""
    v = abs(value)
    if v <= ideal:
        return 1.0
    if v >= fail:
        return 0.0
    return float(1.0 - (v - ideal) / (fail - ideal))


def _pose_score(pose: dict[str, float]) -> float:
    yaw_score = _linear_decay(pose["yaw"], *POSE_LIMITS["yaw"])
    pitch_score = _linear_decay(pose["pitch"], *POSE_LIMITS["pitch"])
    roll_score = _linear_decay(pose["roll"], *POSE_LIMITS["roll"])
    return float(min(yaw_score, pitch_score, roll_score))


def _face_bbox_from_landmarks(landmarks: np.ndarray, image_shape: tuple[int, int]) -> tuple[int, int, int, int]:
    h, w = image_shape
    x0 = int(max(0, np.min(landmarks[:, 0])))
    y0 = int(max(0, np.min(landmarks[:, 1])))
    x1 = int(min(w - 1, np.max(landmarks[:, 0])))
    y1 = int(min(h - 1, np.max(landmarks[:, 1])))
    return x0, y0, x1, y1


def compute_blur_score(image_bgr: np.ndarray, landmarks: np.ndarray) -> tuple[float, float]:
    """Returns (sharpness_score in [0,1], raw Laplacian variance)."""
    h, w = image_bgr.shape[:2]
    x0, y0, x1, y1 = _face_bbox_from_landmarks(landmarks, (h, w))
    if x1 - x0 < 10 or y1 - y0 < 10:
        return 0.0, 0.0
    crop = image_bgr[y0:y1, x0:x1]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    variance = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    if variance <= SHARPNESS_FLOOR:
        score = 0.0
    elif variance >= SHARPNESS_TARGET:
        score = 1.0
    else:
        score = (variance - SHARPNESS_FLOOR) / (SHARPNESS_TARGET - SHARPNESS_FLOOR)
    return float(score), round(variance, 2)


def compute_lighting(image_bgr: np.ndarray, landmarks: np.ndarray) -> tuple[float, float, float]:
    """Returns (lighting_score, lighting_asymmetry_delta_L, mean_L)."""
    h, w = image_bgr.shape[:2]
    x0, y0, x1, y1 = _face_bbox_from_landmarks(landmarks, (h, w))
    if x1 - x0 < 10 or y1 - y0 < 10:
        return 0.0, 0.0, 0.0

    crop = image_bgr[y0:y1, x0:x1]
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB)
    luminance_channel = lab[:, :, 0].astype(np.float32)

    mean_luminance = float(np.mean(luminance_channel))
    horizontal_midpoint = (x1 - x0) // 2
    left_luminance = float(np.mean(luminance_channel[:, :horizontal_midpoint])) if horizontal_midpoint > 0 else mean_luminance
    right_luminance = float(np.mean(luminance_channel[:, horizontal_midpoint:])) if horizontal_midpoint > 0 else mean_luminance
    lighting_asymmetry_delta = abs(left_luminance - right_luminance)

    # Exposure score
    exposure_distance = abs(mean_luminance - LIGHTING_TARGET_MEAN)
    if exposure_distance >= LIGHTING_TOLERANCE:
        exposure_score = 0.0
    else:
        exposure_score = float(1.0 - exposure_distance / LIGHTING_TOLERANCE)

    # Symmetry score
    if lighting_asymmetry_delta >= LIGHTING_ASYM_FLOOR:
        symmetry_score = 0.0
    else:
        symmetry_score = float(1.0 - lighting_asymmetry_delta / LIGHTING_ASYM_FLOOR)

    score = float(min(exposure_score, symmetry_score))
    return score, round(lighting_asymmetry_delta, 2), round(mean_luminance, 2)


def _grade_from_score(score: float) -> str:
    for threshold, grade in GRADE_THRESHOLDS:
        if score >= threshold:
            return grade
    return "REJEITADA"


def _build_recommendations(subscores: dict[str, float], pose: dict[str, float], lighting_asymmetry: float) -> list[str]:
    """Priority order: pose > sharpness > lighting > occlusion > expression. Returns up to 3 tips."""
    tips: list[str] = []

    if subscores["pose_score"] < 0.7:
        worst_axis = max(("yaw", "pitch", "roll"), key=lambda k: abs(pose[k]))
        if worst_axis == "yaw":
            tips.append("Olhe diretamente para a câmera — você está virando o rosto.")
        elif worst_axis == "pitch":
            tips.append("Mantenha a cabeça nivelada — sem inclinar para cima ou para baixo.")
        else:
            tips.append("Endireite a cabeça — ela está inclinada lateralmente.")

    if subscores["sharpness_score"] < 0.7:
        tips.append("Reduza o desfoque: apoie o celular ou aproxime-se com firmeza.")

    if subscores["lighting_score"] < 0.7:
        if lighting_asymmetry >= 15:
            tips.append("Ilumine o rosto de frente — há sombra forte de um lado.")
        else:
            tips.append("Ajuste a iluminação: a foto está muito escura ou muito clara.")

    if not tips:
        tips.append("Boa captura — pronto para análise.")

    return tips[:3]


def evaluate(
    image_bgr: np.ndarray,
    landmarks: np.ndarray,
    pose: dict[str, float],
    face_count: int,
) -> dict[str, Any]:
    """Run all quality checks. Returns dict with score, grade, subscores and recommendations."""
    face_ok = 1.0 if face_count == 1 else 0.0

    pose_score = _pose_score(pose) if face_ok else 0.0
    sharpness_score, blur_variance = compute_blur_score(image_bgr, landmarks) if face_ok else (0.0, 0.0)
    lighting_score, lighting_asymmetry, mean_luminance = compute_lighting(image_bgr, landmarks) if face_ok else (0.0, 0.0, 0.0)

    # Placeholders — to be replaced by real detection in a future phase.
    occlusion_score = 1.0
    expression_score = 1.0

    subscores = {
        "face_ok": face_ok,
        "pose_score": round(pose_score, 4),
        "sharpness_score": round(sharpness_score, 4),
        "lighting_score": round(lighting_score, 4),
        "occlusion_score": occlusion_score,
        "expression_score": expression_score,
    }

    score = float(
        face_ok * pose_score * sharpness_score * lighting_score * occlusion_score * expression_score
    )
    grade = _grade_from_score(score)

    recommendations = _build_recommendations(subscores, pose, lighting_asymmetry) if face_ok else [
        "Nenhum rosto detectado — capture um rosto único e centralizado." if face_count == 0
        else "Mais de um rosto detectado — capture apenas um rosto na foto."
    ]

    return {
        "quality_score": round(score, 4),
        "quality_grade": grade,
        "subscore_breakdown": subscores,
        "sharpness_score": round(sharpness_score, 4),
        "lighting_asymmetry": lighting_asymmetry,
        "mean_luminance": mean_luminance,
        "blur_variance": blur_variance,
        "recommendations": recommendations,
        "regional_penalties": {"jaw": 0.0, "eye": 0.0, "nose": 0.0, "brow": 0.0, "mouth": 0.0},
        "flags": {
            "beard": False,
            "beard_density": 0.0,
            "glasses": False,
            "smile": False,
            "hair_covering": False,
        },
    }
