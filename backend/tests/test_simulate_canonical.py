"""Garante que simulate.simulate consome CanonicalFrame, sem reler do disco."""

from __future__ import annotations

import os
import tempfile

import numpy as np
import pytest

from app.domain.canonical_frame import CanonicalFrame
from app.domain.landmarks_mesh import (
    LM_JAWLINE,
    LM_LEFT_BROW,
    LM_LEFT_EYE,
    LM_NOSE_BRIDGE,
    LM_NOSE_TIP,
    LM_OUTER_MOUTH,
    LM_RIGHT_BROW,
    LM_RIGHT_EYE,
    P_BROW_LEFT_INNER,
    P_BROW_LEFT_MID,
    P_BROW_RIGHT_INNER,
    P_BROW_RIGHT_MID,
    P_LEFT_EYE_INNER,
    P_LEFT_EYE_OUTER,
    P_LEFT_MOUTH,
    P_MENTON,
    P_NASION,
    P_NOSE_LEFT,
    P_NOSE_RIGHT,
    P_RIGHT_EYE_INNER,
    P_RIGHT_EYE_OUTER,
    P_RIGHT_MOUTH,
    P_SUBNASALE,
    TOTAL_LANDMARKS,
)


def _frame(tmp_dir: str) -> CanonicalFrame:
    img = np.full((400, 300, 3), 200, dtype=np.uint8)
    lm = np.zeros((TOTAL_LANDMARKS, 2), dtype=np.int32)

    # Jawline (17 pontos) — apenas índices nomeados são populados.
    jaw_xs = [30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180, 195, 210, 225, 240, 255, 270]
    jaw_ys = [320, 324, 328, 332, 336, 340, 344, 348, 350, 348, 344, 340, 336, 332, 328, 324, 320]
    for k, mesh_idx in enumerate(LM_JAWLINE):
        lm[mesh_idx] = [jaw_xs[k], jaw_ys[k]]

    # Sobrancelhas.
    for k, mesh_idx in enumerate(LM_LEFT_BROW):
        lm[mesh_idx] = [80 + k * 15, 140]
    for k, mesh_idx in enumerate(LM_RIGHT_BROW):
        lm[mesh_idx] = [170 + k * 15, 140]

    # Nose bridge.
    for k, mesh_idx in enumerate(LM_NOSE_BRIDGE):
        lm[mesh_idx] = [150, 160 + k * 15]
    nose_tip_pts = [(135, 220), (142, 222), (150, 224), (158, 222), (165, 220)]
    for k, mesh_idx in enumerate(LM_NOSE_TIP):
        lm[mesh_idx] = list(nose_tip_pts[k])

    # Olhos.
    left_eye_pts = [(85, 175), (95, 170), (105, 170), (115, 175), (105, 180), (95, 180)]
    right_eye_pts = [(215, 175), (205, 170), (195, 170), (185, 175), (195, 180), (205, 180)]
    for k, mesh_idx in enumerate(LM_LEFT_EYE):
        lm[mesh_idx] = list(left_eye_pts[k])
    for k, mesh_idx in enumerate(LM_RIGHT_EYE):
        lm[mesh_idx] = list(right_eye_pts[k])

    # Boca externa (12 pontos da dlib 48..59).
    outer_mouth = [
        (120, 270), (135, 265), (145, 263), (150, 263), (155, 263), (165, 265),
        (180, 270), (165, 280), (155, 285), (150, 285), (145, 285), (135, 280),
    ]
    for k, mesh_idx in enumerate(LM_OUTER_MOUTH):
        lm[mesh_idx] = list(outer_mouth[k])

    # Pontos canónicos lidos por simulate.
    lm[P_LEFT_EYE_OUTER] = [85, 175]
    lm[P_LEFT_EYE_INNER] = [115, 175]
    lm[P_RIGHT_EYE_OUTER] = [215, 175]
    lm[P_RIGHT_EYE_INNER] = [185, 175]
    lm[P_LEFT_MOUTH] = [120, 270]
    lm[P_RIGHT_MOUTH] = [180, 270]
    lm[P_NOSE_LEFT] = [135, 220]
    lm[P_NOSE_RIGHT] = [165, 220]
    lm[P_SUBNASALE] = [150, 224]
    lm[P_NASION] = [150, 160]
    lm[P_MENTON] = [150, 350]
    lm[P_BROW_LEFT_INNER] = [110, 138]
    lm[P_BROW_RIGHT_INNER] = [190, 138]
    lm[P_BROW_LEFT_MID] = [95, 140]
    lm[P_BROW_RIGHT_MID] = [205, 140]

    fake_path = os.path.join(tmp_dir, "input.jpg")
    return CanonicalFrame(
        image=img,
        landmarks=lm,
        ipd_px=100.0,
        face_rect=(50, 130, 200, 220),
        source_path=fake_path,
        crop_metadata={"applied": True},
    )


def test_simulate_uses_frame_image_no_disk_read():
    """simulate roda mesmo com source_path inexistente, pois usa frame.image."""
    from app.domain.simulate import simulate

    with tempfile.TemporaryDirectory() as tmp:
        frame = _frame(tmp)
        out = simulate(frame, output_dir=tmp)

        assert "canonical" in out
        assert "symmetrized" in out
        assert "ideal_proportions" in out
        assert "comparison_grid" in out
        for key in ("canonical", "symmetrized", "ideal_proportions", "comparison_grid"):
            assert os.path.exists(out[key]), f"{key} não foi salva"


def test_simulate_rejects_incomplete_landmarks():
    from app.domain.simulate import simulate

    with tempfile.TemporaryDirectory() as tmp:
        frame = _frame(tmp)
        frame.landmarks = frame.landmarks[:50]
        with pytest.raises(ValueError):
            simulate(frame, output_dir=tmp)
