"""Garante que simulate.simulate consome CanonicalFrame, sem reler do disco."""

from __future__ import annotations

import os
import tempfile

import dlib
import numpy as np
import pytest

from app.domain.canonical_frame import CanonicalFrame


def _frame(tmp_dir: str) -> CanonicalFrame:
    img = np.full((400, 300, 3), 200, dtype=np.uint8)
    lm = np.zeros((68, 2), dtype=np.int32)
    for i in range(17):
        lm[i] = [30 + i * 15, 320 + (8 - abs(i - 8)) * 4]
    for i in range(17, 27):
        lm[i] = [80 + (i - 17) * 15, 140]
    for i in range(27, 31):
        lm[i] = [150, 160 + (i - 27) * 15]
    lm[31] = [135, 220]; lm[32] = [142, 222]; lm[33] = [150, 224]
    lm[34] = [158, 222]; lm[35] = [165, 220]
    lm[36] = [85, 175]; lm[37] = [95, 170]; lm[38] = [105, 170]
    lm[39] = [115, 175]; lm[40] = [105, 180]; lm[41] = [95, 180]
    lm[42] = [185, 175]; lm[43] = [195, 170]; lm[44] = [205, 170]
    lm[45] = [215, 175]; lm[46] = [205, 180]; lm[47] = [195, 180]
    lm[48] = [120, 270]; lm[49] = [135, 265]; lm[50] = [145, 263]
    lm[51] = [150, 263]; lm[52] = [155, 263]; lm[53] = [165, 265]
    lm[54] = [180, 270]; lm[55] = [165, 280]; lm[56] = [155, 285]
    lm[57] = [150, 285]; lm[58] = [145, 285]; lm[59] = [135, 280]
    lm[60] = [128, 271]; lm[61] = [145, 268]; lm[62] = [150, 268]
    lm[63] = [155, 268]; lm[64] = [172, 271]; lm[65] = [155, 278]
    lm[66] = [150, 280]; lm[67] = [145, 278]

    fake_path = os.path.join(tmp_dir, "input.jpg")
    return CanonicalFrame(
        image=img,
        landmarks=lm,
        ipd_px=100.0,
        face_rect=dlib.rectangle(50, 130, 250, 320),
        source_path=fake_path,
        crop_metadata={"applied": True},
    )


def test_simulate_uses_frame_image_no_disk_read():
    """simulate roda mesmo com source_path inexistente, pois usa frame.image."""
    from app.domain.simulate import simulate

    with tempfile.TemporaryDirectory() as tmp:
        frame = _frame(tmp)
        # source_path NÃO existe no disco; se simulate lesse de lá, crasharia.
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
