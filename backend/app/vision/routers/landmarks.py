"""POST /vision/landmarks — server-side fallback face detection + quality."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException

from app.vision.schemas.landmark_payload import (
    LandmarkPayload,
    LandmarkRequest,
    PoseAngles,
    QualityFlags,
    RegionalPenalties,
    SubscoreBreakdown,
)
from app.vision.services import face_detection, quality_evaluator
from app.vision.services.fingerprint import build_session_fingerprint
from app.vision.services.image_codec import decode_base64_image
from app.vision.services.pose_estimator import estimate_pose

router = APIRouter()


@router.post("/landmarks", response_model=LandmarkPayload)
def get_landmarks(req: LandmarkRequest) -> LandmarkPayload:
    image = decode_base64_image(req.image_base64)
    h, w = image.shape[:2]

    faces = face_detection.detect_faces(image)
    face_count = len(faces)

    if face_count == 0:
        # Build a degenerate payload — quality_evaluator will mark it REJEITADA.
        empty_landmarks = []
        pose = {"yaw": 0.0, "pitch": 0.0, "roll": 0.0}
        # Cannot compute lighting/blur without landmarks; use zeros.
        quality = {
            "quality_score": 0.0,
            "quality_grade": "REJEITADA",
            "subscore_breakdown": {
                "face_ok": 0.0,
                "pose_score": 0.0,
                "sharpness_score": 0.0,
                "lighting_score": 0.0,
                "occlusion_score": 1.0,
                "expression_score": 1.0,
            },
            "sharpness_score": 0.0,
            "lighting_asymmetry": 0.0,
            "mean_luminance": 0.0,
            "blur_variance": 0.0,
            "recommendations": [
                "Nenhum rosto detectado — capture um rosto único e centralizado."
            ],
            "regional_penalties": {"jaw": 0.0, "eye": 0.0, "nose": 0.0, "brow": 0.0, "mouth": 0.0},
            "flags": {
                "beard": False,
                "beard_density": 0.0,
                "glasses": False,
                "smile": False,
                "hair_covering": False,
            },
        }
        landmarks_list: list[list[float]] = empty_landmarks
        face_width_ratio = 0.0
    else:
        rect = faces[0]
        landmarks = face_detection.extract_landmarks(image, rect)
        pose = estimate_pose(landmarks, (h, w))
        quality = quality_evaluator.evaluate(image, landmarks, pose, face_count)
        landmarks_list = landmarks.tolist()
        face_width_ratio = float(rect.width()) / float(w) if w > 0 else 0.0

    fingerprint = build_session_fingerprint(
        flags=quality["flags"],
        pose=pose,
        mean_luminance=quality.get("mean_luminance", 0.0),
        face_width_ratio=face_width_ratio,
    )

    session_id = req.session_id or uuid.uuid4().hex

    if face_count > 1:
        # surface a 200 with explicit grade — caller decides how to react
        raise HTTPException(
            status_code=400,
            detail=f"Multiple faces detected ({face_count}). Capture a single face.",
        )

    return LandmarkPayload(
        session_id=session_id,
        landmarks=landmarks_list,
        pose=PoseAngles(**pose),
        quality_score=quality["quality_score"],
        quality_grade=quality["quality_grade"],
        flags=QualityFlags(**quality["flags"]),
        regional_penalties=RegionalPenalties(**quality["regional_penalties"]),
        recommendations=quality["recommendations"],
        fingerprint=fingerprint,
        processing_mode="SERVER_FALLBACK",
        sharpness_score=quality["sharpness_score"],
        lighting_asymmetry=quality["lighting_asymmetry"],
        subscore_breakdown=SubscoreBreakdown(**quality["subscore_breakdown"]),
    )
