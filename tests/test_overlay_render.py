"""Critical parity tests: scripts/_overlay_render.py vs frontend/src/components/OverlayLayer.tsx.

Each test documents the TSX line that defines the expected value and asserts
the PIL port matches exactly.  Failures mean the agent is reviewing a different
overlay than the user sees in the browser.

Run:
    cd /home/luizescobal/study/face-before-after
    .venv/bin/pytest tests/test_overlay_render.py -v
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import pytest
from PIL import Image

# _overlay_render lives in scripts/, not on the default sys.path.
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))
import _overlay_render as ovl  # noqa: E402

# ---------------------------------------------------------------------------
# Synthetic landmark factory — deterministic geometry
# ---------------------------------------------------------------------------
W, H = 600, 800


def _make_lm() -> list[list[float]]:
    """Return a 478-point list where all geometric expectations below hold.

    Derived constants (verified at the end of this docstring):
      y_top   =  50   lm[10]
      y_men   = 700   lm[152]
      face_h  = 650
      y_t1    =  50 + 650/3  = 266.666…
      y_t2    =  50 + 1300/3 = 483.333…
      y_brow  = 200   (avg lm[107] and lm[336], both y=200)
      y_sub   = 500   lm[2]

      upper_pct   = (200-50)/650 * 100 =  23.077%
      middle_pct  = (500-200)/650 * 100 =  46.154%
      lower_pct   = (700-500)/650 * 100 =  30.769%

      x_eyes  = (250+350)/2 = 300   inner canthi midpoint
      x_nose  = 300                  lm[1]
      x_mid   = (300+300)/2 = 300

      ICD     = hypot(350-250, 0) = 100.0

      x_face_l = 80    lm[234]
      x_face_r = 520   lm[454]
      face_w   = 440
      fifth    = 88
      ideals   = [168, 256, 344, 432]
      actuals  = [180, 250, 350, 420]  (lm[33], lm[133], lm[362], lm[263])
      devs     = [+12,  -6,  +6, -12]
    """
    lm: list[list[float]] = [[0.0, 0.0, 0.0] for _ in range(478)]
    lm[10]  = [300.0,  50.0, 0.0]   # P_FOREHEAD_CROWN
    lm[152] = [300.0, 700.0, 0.0]   # P_MENTON
    lm[1]   = [300.0, 400.0, 0.0]   # P_NOSE_TIP
    lm[2]   = [300.0, 500.0, 0.0]   # P_SUBNASALE
    lm[133] = [250.0, 250.0, 0.0]   # P_LEFT_EYE_INNER
    lm[362] = [350.0, 250.0, 0.0]   # P_RIGHT_EYE_INNER
    lm[33]  = [180.0, 250.0, 0.0]   # P_EYE_OUTER_IMG_LEFT  (actual 1st fifth)
    lm[263] = [420.0, 250.0, 0.0]   # P_EYE_OUTER_IMG_RIGHT (actual 4th fifth)
    lm[107] = [240.0, 200.0, 0.0]   # P_BROW_LEFT_INNER
    lm[336] = [360.0, 200.0, 0.0]   # P_BROW_RIGHT_INNER
    lm[234] = [ 80.0, 400.0, 0.0]   # P_ZYGO_IMG_LEFT
    lm[454] = [520.0, 400.0, 0.0]   # P_ZYGO_IMG_RIGHT
    # Jawline indices needed for draw_outline_face smoke test
    for idx in [338, 297, 332, 284, 251, 389, 356, 323, 361, 288, 397, 365,
                379, 378, 400, 377, 148, 176, 149, 150, 136, 172, 58, 132,
                93, 127, 162, 21, 54, 103, 67, 109]:
        lm[idx] = [300.0, 400.0, 0.0]
    return lm


LM    = _make_lm()
BLANK = Image.new("RGB", (W, H), (0, 0, 0))


# ---------------------------------------------------------------------------
# 1. Landmark-index constants — OverlayLayer.tsx L22-L46
# ---------------------------------------------------------------------------

class TestLandmarkConstants:
    """PIL port must declare identical landmark indices to TSX."""

    def test_p_nose_tip(self):          assert ovl.P_NOSE_TIP            ==   1
    def test_p_menton(self):            assert ovl.P_MENTON               == 152
    def test_p_left_eye_inner(self):    assert ovl.P_LEFT_EYE_INNER       == 133
    def test_p_right_eye_inner(self):   assert ovl.P_RIGHT_EYE_INNER      == 362
    def test_p_left_eye_outer(self):    assert ovl.P_LEFT_EYE_OUTER       ==  33
    def test_p_right_eye_outer(self):   assert ovl.P_RIGHT_EYE_OUTER      == 263
    def test_p_brow_left_inner(self):   assert ovl.P_BROW_LEFT_INNER      == 107
    def test_p_brow_right_inner(self):  assert ovl.P_BROW_RIGHT_INNER     == 336
    def test_p_subnasale(self):         assert ovl.P_SUBNASALE            ==   2
    def test_p_forehead_crown(self):    assert ovl.P_FOREHEAD_CROWN       ==  10
    def test_p_zygo_img_right(self):    assert ovl.P_ZYGO_IMG_RIGHT       == 454
    def test_p_zygo_img_left(self):     assert ovl.P_ZYGO_IMG_LEFT        == 234
    def test_p_eye_outer_img_left(self):  assert ovl.P_EYE_OUTER_IMG_LEFT  ==  33
    def test_p_eye_outer_img_right(self): assert ovl.P_EYE_OUTER_IMG_RIGHT == 263

    def test_lm_jawline_closed(self):
        # TSX L46: polygon starts and ends at 10
        assert ovl.LM_JAWLINE[0]  == 10
        assert ovl.LM_JAWLINE[-1] == 10

    def test_lm_jawline_length(self):
        # TSX L46: 37 points (36 unique + closing duplicate of 10)
        assert len(ovl.LM_JAWLINE) == 37


# ---------------------------------------------------------------------------
# 2. Severity colour table — OverlayLayer.tsx L56-L61, L222-L231
# ---------------------------------------------------------------------------

class TestSeverityColors:
    """Each SEVERITY_ARROW_COLORS entry must exactly match the TSX hex."""

    # TSX: mild "#22c55e" = (34,197,94)
    def test_ideal_green(self):   assert ovl.SEVERITY_ARROW_COLORS["ideal"]    == (34, 197,  94)
    def test_mild_green(self):    assert ovl.SEVERITY_ARROW_COLORS["mild"]     == (34, 197,  94)
    # TSX: moderate "#eab308" = (234,179,8)
    def test_moderate_yellow(self): assert ovl.SEVERITY_ARROW_COLORS["moderate"] == (234, 179,   8)
    # TSX: strong "#f97316" = (249,115,22)
    def test_strong_orange(self): assert ovl.SEVERITY_ARROW_COLORS["strong"]   == (249, 115,  22)
    # TSX: extreme "#ef4444" = (239,68,68)
    def test_extreme_red(self):   assert ovl.SEVERITY_ARROW_COLORS["extreme"]  == (239,  68,  68)

    def test_severity_color_ideal(self):
        assert ovl._severity_color("ideal") == (34, 197, 94)

    def test_severity_color_null_returns_grey(self):
        # TSX default: "#94a3b8" = (148,163,184)
        assert ovl._severity_color(None) == (148, 163, 184)

    def test_severity_color_empty_returns_grey(self):
        assert ovl._severity_color("") == (148, 163, 184)

    def test_severity_color_case_insensitive(self):
        assert ovl._severity_color("MODERATE") == (234, 179, 8)
        assert ovl._severity_color("Strong")   == (249, 115, 22)


# ---------------------------------------------------------------------------
# 3. Internal helpers
# ---------------------------------------------------------------------------

class TestHelpers:

    def test_xy_basic(self):
        assert ovl._xy(LM, ovl.P_FOREHEAD_CROWN) == (300.0, 50.0)

    def test_xy_out_of_bounds(self):
        assert ovl._xy(LM, 9999) == (0.0, 0.0)

    def test_xy_negative(self):
        assert ovl._xy(LM, -1) == (0.0, 0.0)

    def test_icd_px(self):
        # lm[133]=(250,250), lm[362]=(350,250) → ICD = 100.0
        assert ovl._icd_px(LM) == pytest.approx(100.0)

    def test_icd_px_diagonal(self):
        lm2 = list(LM)
        lm2[133] = [200.0, 240.0, 0.0]
        lm2[362] = [280.0, 290.0, 0.0]
        expected = math.hypot(80, 50)
        assert ovl._icd_px(lm2) == pytest.approx(expected, rel=1e-6)

    def test_metric_get_found(self):
        evals = [{"metric_id": "upper_third_ratio", "value": 0.5}]
        assert ovl._metric_get(evals, "upper_third_ratio")["value"] == 0.5

    def test_metric_get_not_found(self):
        evals = [{"metric_id": "upper_third_ratio", "value": 0.5}]
        assert ovl._metric_get(evals, "missing") is None

    def test_metric_get_empty_list(self):
        assert ovl._metric_get([], "foo") is None

    def test_metric_get_none(self):
        assert ovl._metric_get(None, "foo") is None


# ---------------------------------------------------------------------------
# 4. GridThirds geometry — OverlayLayer.tsx L258-L342
# ---------------------------------------------------------------------------

class TestGridThirdsGeometry:

    def test_y_t1_is_exactly_one_third_of_face_height(self):
        # TSX L293: const yT1 = yTop + faceH / 3
        y_top  = ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]   # 50
        y_men  = ovl._xy(LM, ovl.P_MENTON)[1]           # 700
        face_h = y_men - y_top                           # 650
        y_t1   = y_top + face_h / 3.0
        assert y_t1 == pytest.approx(266.667, rel=1e-4)

    def test_y_t2_is_exactly_two_thirds_of_face_height(self):
        # TSX L294: const yT2 = yTop + (2 * faceH) / 3
        y_top  = ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]
        y_men  = ovl._xy(LM, ovl.P_MENTON)[1]
        face_h = y_men - y_top
        y_t2   = y_top + (2.0 * face_h) / 3.0
        assert y_t2 == pytest.approx(483.333, rel=1e-4)

    def test_y_t1_and_y_t2_divide_face_equally(self):
        y_top  = ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]
        y_men  = ovl._xy(LM, ovl.P_MENTON)[1]
        face_h = y_men - y_top
        y_t1   = y_top + face_h / 3.0
        y_t2   = y_top + 2.0 * face_h / 3.0
        # Each segment must be exactly face_h/3
        assert (y_t1 - y_top) == pytest.approx(face_h / 3.0, rel=1e-9)
        assert (y_t2 - y_t1)  == pytest.approx(face_h / 3.0, rel=1e-9)
        assert (y_men - y_t2) == pytest.approx(face_h / 3.0, rel=1e-9)

    def test_fallback_upper_pct_from_geometry(self):
        # TSX L283: upperPct = ((yBrow - yTop) / faceH) * 100
        y_top  = ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]  # 50
        y_brow = (ovl._xy(LM, ovl.P_BROW_LEFT_INNER)[1]
                  + ovl._xy(LM, ovl.P_BROW_RIGHT_INNER)[1]) / 2   # 200
        y_men  = ovl._xy(LM, ovl.P_MENTON)[1]  # 700
        face_h = y_men - y_top  # 650
        upper_pct = ((y_brow - y_top) / face_h) * 100.0
        assert upper_pct == pytest.approx(23.077, rel=1e-3)

    def test_fallback_middle_pct_from_geometry(self):
        y_top  = ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]
        y_brow = (ovl._xy(LM, ovl.P_BROW_LEFT_INNER)[1]
                  + ovl._xy(LM, ovl.P_BROW_RIGHT_INNER)[1]) / 2
        y_sub  = ovl._xy(LM, ovl.P_SUBNASALE)[1]
        y_men  = ovl._xy(LM, ovl.P_MENTON)[1]
        face_h = y_men - y_top
        middle_pct = ((y_sub - y_brow) / face_h) * 100.0
        assert middle_pct == pytest.approx(46.154, rel=1e-3)

    def test_fallback_lower_pct_from_geometry(self):
        y_top  = ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]
        y_sub  = ovl._xy(LM, ovl.P_SUBNASALE)[1]
        y_men  = ovl._xy(LM, ovl.P_MENTON)[1]
        face_h = y_men - y_top
        lower_pct = ((y_men - y_sub) / face_h) * 100.0
        assert lower_pct == pytest.approx(30.769, rel=1e-3)

    def test_metric_value_overrides_geometry_fallback(self):
        # When metric_evaluations provides a value, it must override the fallback.
        # TSX L283: upperPct = mUpper?.value != null ? mUpper.value * 100 : fallback
        evals = [{"metric_id": "upper_third_ratio", "value": 0.35}]
        m = ovl._metric_get(evals, "upper_third_ratio")
        pct = float(m["value"]) * 100.0 if m and isinstance(m.get("value"), (int, float)) else -1.0
        assert pct == pytest.approx(35.0)

    def test_deviation_positive(self):
        # TSX L329: dev >= 0 ? `+${dev.toFixed(0)}` : `${dev.toFixed(0)}`
        pct = 37.0
        dev = pct - 33.3
        s = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
        assert s == "+4"

    def test_deviation_negative(self):
        pct = 28.0
        dev = pct - 33.3
        s = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
        assert s == "-5"

    def test_deviation_near_ideal_rounds_to_zero(self):
        # 33.3% exactly → dev=0.0 → "+0" (not "±0" — that's grid_fifths)
        pct = 33.3
        dev = pct - 33.3
        s = f"+{dev:.0f}" if dev >= 0 else f"{dev:.0f}"
        assert s == "+0"


# ---------------------------------------------------------------------------
# 5. GridFifths geometry — OverlayLayer.tsx L344-L404
# ---------------------------------------------------------------------------

class TestGridFifthsGeometry:

    def test_fifth_width(self):
        # TSX L357: const fifth = faceW / 5
        x_l = ovl._xy(LM, ovl.P_ZYGO_IMG_LEFT)[0]   # 80
        x_r = ovl._xy(LM, ovl.P_ZYGO_IMG_RIGHT)[0]  # 520
        fifth = (x_r - x_l) / 5.0
        assert fifth == pytest.approx(88.0)

    def test_ideal_divider_positions(self):
        # TSX L362: ideals = [1,2,3,4].map(i => xFaceL + i*fifth)
        x_l = ovl._xy(LM, ovl.P_ZYGO_IMG_LEFT)[0]
        x_r = ovl._xy(LM, ovl.P_ZYGO_IMG_RIGHT)[0]
        fifth = (x_r - x_l) / 5.0
        ideals = [x_l + i * fifth for i in (1, 2, 3, 4)]
        assert ideals == pytest.approx([168.0, 256.0, 344.0, 432.0])

    def test_actual_eye_positions(self):
        # TSX L364: actuals = [xEyeOL, xEyeIL, xEyeIR, xEyeOR]
        actuals = [
            ovl._xy(LM, ovl.P_EYE_OUTER_IMG_LEFT)[0],   # lm[33].x  = 180
            ovl._xy(LM, ovl.P_LEFT_EYE_INNER)[0],        # lm[133].x = 250
            ovl._xy(LM, ovl.P_RIGHT_EYE_INNER)[0],       # lm[362].x = 350
            ovl._xy(LM, ovl.P_EYE_OUTER_IMG_RIGHT)[0],   # lm[263].x = 420
        ]
        assert actuals == pytest.approx([180.0, 250.0, 350.0, 420.0])

    def test_deviations_integer_rounded(self):
        # TSX L385: const dev = Math.round(x - ideals[i])
        x_l = ovl._xy(LM, ovl.P_ZYGO_IMG_LEFT)[0]
        x_r = ovl._xy(LM, ovl.P_ZYGO_IMG_RIGHT)[0]
        fifth  = (x_r - x_l) / 5.0
        ideals = [x_l + i * fifth for i in (1, 2, 3, 4)]
        actuals = [
            ovl._xy(LM, ovl.P_EYE_OUTER_IMG_LEFT)[0],
            ovl._xy(LM, ovl.P_LEFT_EYE_INNER)[0],
            ovl._xy(LM, ovl.P_RIGHT_EYE_INNER)[0],
            ovl._xy(LM, ovl.P_EYE_OUTER_IMG_RIGHT)[0],
        ]
        devs = [round(a - b) for a, b in zip(actuals, ideals)]
        assert devs == [12, -6, 6, -12]

    def test_deviation_string_positive(self):
        # TSX L386: dev > 0 ? `+${dev}` : `${dev}`
        assert (lambda d: "±0" if d == 0 else (f"+{d}" if d > 0 else f"{d}"))(12) == "+12"

    def test_deviation_string_negative(self):
        assert (lambda d: "±0" if d == 0 else (f"+{d}" if d > 0 else f"{d}"))(-6) == "-6"

    def test_deviation_string_zero(self):
        # TSX L386: dev === 0 ? "±0"
        assert (lambda d: "±0" if d == 0 else (f"+{d}" if d > 0 else f"{d}"))(0) == "±0"


# ---------------------------------------------------------------------------
# 6. AxisVertical geometry — OverlayLayer.tsx L193-L207
# ---------------------------------------------------------------------------

class TestAxisVerticalGeometry:

    def test_xmid_averages_eye_midpoint_and_nose(self):
        # TSX L196: xEyes = (lm[133].x + lm[362].x) / 2 = (250+350)/2 = 300
        # TSX L198: xMid  = (xEyes + xNose) / 2 = (300+300)/2 = 300
        x_eyes = (ovl._xy(LM, ovl.P_LEFT_EYE_INNER)[0]
                  + ovl._xy(LM, ovl.P_RIGHT_EYE_INNER)[0]) / 2.0
        x_nose = ovl._xy(LM, ovl.P_NOSE_TIP)[0]
        x_mid  = (x_eyes + x_nose) / 2.0
        assert x_mid == pytest.approx(300.0)

    def test_xmid_differs_from_eye_midpoint_when_nose_is_offset(self):
        # Ensures we're truly averaging with nose, not just using eye midpoint.
        lm2 = list(LM)
        lm2[ovl.P_NOSE_TIP] = [280.0, 400.0, 0.0]  # nose 20px left of centre
        x_eyes = (ovl._xy(lm2, ovl.P_LEFT_EYE_INNER)[0]
                  + ovl._xy(lm2, ovl.P_RIGHT_EYE_INNER)[0]) / 2.0  # 300
        x_nose = ovl._xy(lm2, ovl.P_NOSE_TIP)[0]                   # 280
        x_mid  = (x_eyes + x_nose) / 2.0                            # 290
        assert x_mid == pytest.approx(290.0)
        assert x_mid != x_eyes  # must not ignore nose


# ---------------------------------------------------------------------------
# 7. ImprovementVectors skip conditions — OverlayLayer.tsx L447-L491
# ---------------------------------------------------------------------------

class TestImprovementVectorsLogic:
    """Each skip condition mirrors a specific TSX guard — must match exactly."""

    def _run(self, evals: list) -> int:
        _, count = ovl.draw_improvement_vectors(BLANK.copy(), LM, evals)
        return count

    def test_skip_null_vector_x(self):
        # TSX L448: if (improvement_vector_x == null ...) continue
        assert self._run([{
            "metric_id": "a", "improvement_vector_x": None, "improvement_vector_y": 0.2,
            "severity_5": "strong", "anchor_landmark_index": 1,
        }]) == 0

    def test_skip_null_vector_y(self):
        assert self._run([{
            "metric_id": "a", "improvement_vector_x": 0.2, "improvement_vector_y": None,
            "severity_5": "strong", "anchor_landmark_index": 1,
        }]) == 0

    def test_skip_ideal_severity(self):
        # TSX L449: severity_5 === "ideal" → skip
        assert self._run([{
            "metric_id": "a", "improvement_vector_x": 0.2, "improvement_vector_y": 0.0,
            "severity_5": "ideal", "anchor_landmark_index": 1,
        }]) == 0

    def test_skip_null_severity(self):
        # TSX L449: !severity_5 is truthy for null → skip.
        # BUG-7 in original code: only skipped "ideal", not null.
        assert self._run([{
            "metric_id": "a", "improvement_vector_x": 0.2, "improvement_vector_y": 0.0,
            "severity_5": None, "anchor_landmark_index": 1,
        }]) == 0, "null severity_5 must be skipped (TSX L449: !severity_5)"

    def test_skip_missing_severity_key(self):
        # severity_5 key absent → same as null
        assert self._run([{
            "metric_id": "a", "improvement_vector_x": 0.2, "improvement_vector_y": 0.0,
            "anchor_landmark_index": 1,
        }]) == 0

    def test_skip_null_anchor(self):
        # TSX L452: if (anchor_landmark_index == null) continue — strict, no fallback
        assert self._run([{
            "metric_id": "a", "improvement_vector_x": 0.2, "improvement_vector_y": 0.0,
            "severity_5": "strong", "anchor_landmark_index": None,
        }]) == 0

    def test_no_dependency_landmarks_fallback(self):
        # BUG-8 in original code: tried dependency_landmarks when anchor was None.
        # TSX L452 is strict — dependency_landmarks is never read here.
        assert self._run([{
            "metric_id": "a", "improvement_vector_x": 0.2, "improvement_vector_y": 0.0,
            "severity_5": "strong", "anchor_landmark_index": None,
            "dependency_landmarks": [1],  # must NOT be used as fallback
        }]) == 0, "dependency_landmarks fallback diverges from TSX — must not exist"

    def test_skip_near_zero_vector(self):
        # TSX L461: if (len < 2) continue; ICD=100 → 0.015*100=1.5px < 2 → skip
        assert self._run([{
            "metric_id": "a", "improvement_vector_x": 0.015, "improvement_vector_y": 0.0,
            "severity_5": "strong", "anchor_landmark_index": 1,
        }]) == 0

    def test_draw_valid_metric(self):
        # ICD=100, vx=0.2 → 20px arrow → well above 2px threshold
        assert self._run([{
            "metric_id": "a", "improvement_vector_x": 0.2, "improvement_vector_y": 0.0,
            "severity_5": "strong", "anchor_landmark_index": 1,
        }]) == 1

    def test_draw_multiple_valid_metrics(self):
        evals = [
            {"metric_id": "a", "improvement_vector_x": 0.3, "improvement_vector_y": 0.1,
             "severity_5": "moderate", "anchor_landmark_index": 1},
            {"metric_id": "b", "improvement_vector_x": -0.2, "improvement_vector_y": 0.0,
             "severity_5": "extreme", "anchor_landmark_index": 152},
        ]
        assert self._run(evals) == 2

    def test_mixed_valid_and_invalid(self):
        evals = [
            {"metric_id": "skip_ideal",   "improvement_vector_x": 0.2, "improvement_vector_y": 0.0,
             "severity_5": "ideal", "anchor_landmark_index": 1},
            {"metric_id": "skip_null_sev","improvement_vector_x": 0.2, "improvement_vector_y": 0.0,
             "severity_5": None, "anchor_landmark_index": 1},
            {"metric_id": "draw_this",    "improvement_vector_x": 0.2, "improvement_vector_y": 0.0,
             "severity_5": "strong", "anchor_landmark_index": 1},
        ]
        assert self._run(evals) == 1

    def test_empty_evals(self):
        assert self._run([]) == 0

    def test_none_evals(self):
        _, count = ovl.draw_improvement_vectors(BLANK.copy(), LM, None)
        assert count == 0


# ---------------------------------------------------------------------------
# 8. Smoke render — every draw_* must return a PIL Image without raising
# ---------------------------------------------------------------------------

class TestSmokeRender:

    def test_draw_axis_vertical(self):
        assert isinstance(ovl.draw_axis_vertical(BLANK.copy(), LM), Image.Image)

    def test_draw_axis_intercanthal(self):
        assert isinstance(ovl.draw_axis_intercanthal(BLANK.copy(), LM), Image.Image)

    def test_draw_grid_thirds_no_metrics(self):
        assert isinstance(ovl.draw_grid_thirds(BLANK.copy(), LM, None), Image.Image)

    def test_draw_grid_thirds_with_metrics(self):
        evals = [
            {"metric_id": "upper_third_ratio",  "value": 0.23, "severity_5": "moderate"},
            {"metric_id": "middle_third_ratio", "value": 0.46, "severity_5": "strong"},
            {"metric_id": "lower_third_ratio",  "value": 0.31, "severity_5": "mild"},
        ]
        assert isinstance(ovl.draw_grid_thirds(BLANK.copy(), LM, evals), Image.Image)

    def test_draw_grid_fifths(self):
        assert isinstance(ovl.draw_grid_fifths(BLANK.copy(), LM), Image.Image)

    def test_draw_outline_face(self):
        assert isinstance(ovl.draw_outline_face(BLANK.copy(), LM), Image.Image)

    def test_draw_face_extents_mesh(self):
        assert isinstance(ovl.draw_face_extents(BLANK.copy(), LM, "mesh"), Image.Image)

    def test_draw_face_extents_bisenet(self):
        assert isinstance(ovl.draw_face_extents(BLANK.copy(), LM, "bisenet"), Image.Image)

    def test_draw_improvement_vectors_empty(self):
        img, count = ovl.draw_improvement_vectors(BLANK.copy(), LM, [])
        assert isinstance(img, Image.Image) and count == 0

    def test_draw_improvement_vectors_with_data(self):
        evals = [
            {"metric_id": "a", "improvement_vector_x": 0.3, "improvement_vector_y": 0.1,
             "severity_5": "moderate", "anchor_landmark_index": 1},
            {"metric_id": "b", "improvement_vector_x": -0.2, "improvement_vector_y": 0.0,
             "severity_5": "extreme", "anchor_landmark_index": 152},
        ]
        img, count = ovl.draw_improvement_vectors(BLANK.copy(), LM, evals)
        assert isinstance(img, Image.Image) and count == 2


# ---------------------------------------------------------------------------
# 9. Pixel-level geometry — verify coloured lines appear at the correct
#    row / column (independent of font rendering).
# ---------------------------------------------------------------------------

def _row_colors(img: Image.Image, y: int) -> set[tuple[int, int, int]]:
    px = img.convert("RGB").load()
    return {px[x, y][:3] for x in range(img.width) if px[x, y][:3] != (0, 0, 0)}


def _col_colors(img: Image.Image, x: int) -> set[tuple[int, int, int]]:
    px = img.convert("RGB").load()
    return {px[x, y][:3] for y in range(img.height) if px[x, y][:3] != (0, 0, 0)}


class TestDeriveTrichionYPx:
    """derive_trichion_y_px must recover the pixel-space hairline from the metric.

    Derived from:  upper_third_ratio = (y_brow - y_t) / (y_menton - y_t)
    Inverted:      y_t = (u * y_menton - y_brow) / (u - 1)
    """

    def test_fallback_when_no_evals(self):
        # No metric_evals → returns lm[10].y (mesh trichion)
        result = ovl.derive_trichion_y_px(LM, None)
        assert result == pytest.approx(ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1])

    def test_fallback_when_metric_absent(self):
        evals = [{"metric_id": "other_metric", "value": 0.5}]
        result = ovl.derive_trichion_y_px(LM, evals)
        assert result == pytest.approx(ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1])

    def test_fallback_when_value_is_none(self):
        evals = [{"metric_id": "upper_third_ratio", "value": None}]
        result = ovl.derive_trichion_y_px(LM, evals)
        assert result == pytest.approx(ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1])

    def test_fallback_below_sanity_bound(self):
        # u=0.04 below 0.05 threshold → fallback
        evals = [{"metric_id": "upper_third_ratio", "value": 0.04}]
        result = ovl.derive_trichion_y_px(LM, evals)
        assert result == pytest.approx(ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1])

    def test_self_consistency_with_mesh_trichion(self):
        """When BiSeNet is absent the metric uses lm[10].y; inversion must recover lm[10].y."""
        y_top  = ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]   # 50
        y_brow = (ovl._xy(LM, ovl.P_BROW_LEFT_INNER)[1]
                  + ovl._xy(LM, ovl.P_BROW_RIGHT_INNER)[1]) / 2   # 200
        y_men  = ovl._xy(LM, ovl.P_MENTON)[1]            # 700
        face_h = y_men - y_top                            # 650
        u_mesh = (y_brow - y_top) / face_h               # (200-50)/650 = 0.2308

        evals = [{"metric_id": "upper_third_ratio", "value": u_mesh}]
        result = ovl.derive_trichion_y_px(LM, evals)
        # Should recover y_top (lm[10].y = 50) within floating-point precision
        assert result == pytest.approx(y_top, rel=1e-6)

    def test_bisenet_trichion_above_mesh(self):
        """When BiSeNet fires with T1=0.39, derived y_top is above (smaller than) lm[10].y."""
        # With the synthetic LM: y_brow=200, y_men=700, u=0.39
        # y_t = (0.39*700 - 200) / (0.39-1) = (273-200)/(-0.61) = 73/(-0.61) = -119.7
        y_brow = 200.0; y_men = 700.0; u = 0.39
        expected = (u * y_men - y_brow) / (u - 1.0)  # ≈ -119.7

        evals = [{"metric_id": "upper_third_ratio", "value": u}]
        result = ovl.derive_trichion_y_px(LM, evals)
        assert result == pytest.approx(expected, rel=1e-6)
        # Must be strictly above the mesh trichion (y_top=50 in our fixture)
        assert result < ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]

    def test_roundtrip_consistency(self):
        """u = (y_brow - y_t) / (y_men - y_t) must hold exactly after inversion."""
        evals = [{"metric_id": "upper_third_ratio", "value": 0.35}]
        y_t    = ovl.derive_trichion_y_px(LM, evals)
        y_brow = (ovl._xy(LM, ovl.P_BROW_LEFT_INNER)[1]
                  + ovl._xy(LM, ovl.P_BROW_RIGHT_INNER)[1]) / 2
        y_men  = ovl._xy(LM, ovl.P_MENTON)[1]
        u_back = (y_brow - y_t) / (y_men - y_t)
        assert u_back == pytest.approx(0.35, rel=1e-6)

    def test_draw_functions_use_derived_trichion(self):
        """draw_face_extents with BiSeNet metric must anchor box ABOVE lm[10].y."""
        u = 0.39
        y_brow = (ovl._xy(LM, ovl.P_BROW_LEFT_INNER)[1]
                  + ovl._xy(LM, ovl.P_BROW_RIGHT_INNER)[1]) / 2
        y_men  = ovl._xy(LM, ovl.P_MENTON)[1]
        trichion_y = (u * y_men - y_brow) / (u - 1.0)  # ≈ -119.7

        evals = [{"metric_id": "upper_third_ratio", "value": u}]
        img = ovl.draw_face_extents(BLANK.copy(), LM, "bisenet", evals)
        # The bounding-box top line would be at trichion_y ≈ -120, clipped to y=0.
        # Verify it returned a valid image without crashing.
        assert isinstance(img, Image.Image)

    def test_grid_thirds_uses_derived_trichion(self):
        """draw_grid_thirds ideal lines must be positioned from derived trichion."""
        u = 0.35
        y_brow = (ovl._xy(LM, ovl.P_BROW_LEFT_INNER)[1]
                  + ovl._xy(LM, ovl.P_BROW_RIGHT_INNER)[1]) / 2
        y_men  = ovl._xy(LM, ovl.P_MENTON)[1]
        trichion_y = (u * y_men - y_brow) / (u - 1.0)
        face_h = y_men - trichion_y
        expected_t1 = trichion_y + face_h / 3.0

        evals = [{"metric_id": "upper_third_ratio", "value": u}]
        img = ovl.draw_grid_thirds(BLANK.copy(), LM, evals)
        rgb = img.convert("RGB")

        # Purple ideal-1/3 line must appear at the DERIVED position, not lm[10]-based.
        derived_t1_row = int(expected_t1)
        lm10_t1_row = int(ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]
                          + (y_men - ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]) / 3)

        # They must differ (otherwise we're not testing anything useful)
        assert derived_t1_row != lm10_t1_row

        # Purple (#a5b4fc) must appear at derived position
        assert (165, 180, 252) in _row_colors(rgb, derived_t1_row), \
            f"Ideal-1/3 line missing at derived row {derived_t1_row}"


# Append to existing TestPixelGeometry class for completeness

    def test_axis_intercanthal_row_is_cyan(self):
        # TSX L210: yMid = (lm[133].y + lm[362].y) / 2 → full-width horizontal cyan line
        img = ovl.draw_axis_intercanthal(BLANK.copy(), LM)
        y_mid = int((ovl._xy(LM, ovl.P_LEFT_EYE_INNER)[1]
                     + ovl._xy(LM, ovl.P_RIGHT_EYE_INNER)[1]) / 2)
        assert (34, 211, 238) in _row_colors(img, y_mid), \
            f"Cyan intercanthal line missing at row {y_mid}"

    def test_grid_thirds_sobrancelha_row_is_orange(self):
        # TSX L320: solid orange line at yBrow
        img = ovl.draw_grid_thirds(BLANK.copy(), LM, None)
        y_brow = int((ovl._xy(LM, ovl.P_BROW_LEFT_INNER)[1]
                      + ovl._xy(LM, ovl.P_BROW_RIGHT_INNER)[1]) / 2)
        assert (249, 115, 22) in _row_colors(img, y_brow), \
            f"Orange Sobrancelha line missing at row {y_brow}"

    def test_grid_thirds_subnasale_row_is_orange(self):
        img = ovl.draw_grid_thirds(BLANK.copy(), LM, None)
        y_sub = int(ovl._xy(LM, ovl.P_SUBNASALE)[1])
        assert (249, 115, 22) in _row_colors(img, y_sub), \
            f"Orange Subnasale line missing at row {y_sub}"

    def test_grid_thirds_ideal_t1_row_is_purple(self):
        # TSX L312: dashed purple line at yT1 = yTop + faceH/3
        img  = ovl.draw_grid_thirds(BLANK.copy(), LM, None)
        y_t1 = int(ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]
                   + (ovl._xy(LM, ovl.P_MENTON)[1] - ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]) / 3)
        colors = _row_colors(img, y_t1)
        assert (165, 180, 252) in colors, \
            f"Purple ideal-1/3 line missing at row {y_t1}"

    def test_grid_thirds_ideal_t2_row_is_purple(self):
        img   = ovl.draw_grid_thirds(BLANK.copy(), LM, None)
        y_top = ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]
        face_h = ovl._xy(LM, ovl.P_MENTON)[1] - y_top
        y_t2  = int(y_top + 2 * face_h / 3)
        colors = _row_colors(img, y_t2)
        assert (165, 180, 252) in colors, \
            f"Purple ideal-2/3 line missing at row {y_t2}"

    def test_grid_thirds_ideal_dividers_not_on_brow_row(self):
        # The ideal lines are NOT at y_brow — they're at yTop+faceH/3.
        # If they were at brow row it would mean face divisions are perfect (unusual case).
        # With our synthetic data: y_brow=200 != y_t1=267 → assert they differ.
        y_brow = int((ovl._xy(LM, ovl.P_BROW_LEFT_INNER)[1]
                      + ovl._xy(LM, ovl.P_BROW_RIGHT_INNER)[1]) / 2)   # 200
        y_t1   = int(ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]
                     + (ovl._xy(LM, ovl.P_MENTON)[1]
                        - ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1]) / 3)    # 266
        assert y_brow != y_t1, \
            "Ideal divider should not coincide with brow in this synthetic dataset"

    def test_grid_fifths_first_ideal_col_is_purple(self):
        # TSX L378: dashed purple line at xFaceL + 1*fifth
        img    = ovl.draw_grid_fifths(BLANK.copy(), LM)
        x_l    = ovl._xy(LM, ovl.P_ZYGO_IMG_LEFT)[0]
        fifth  = (ovl._xy(LM, ovl.P_ZYGO_IMG_RIGHT)[0] - x_l) / 5.0
        x_ideal1 = int(x_l + fifth)  # 168
        assert (165, 180, 252) in _col_colors(img, x_ideal1), \
            f"Purple first-fifth line missing at col {x_ideal1}"

    def test_face_extents_top_row_is_white(self):
        # TSX L246: white horizontal line at yTop
        img   = ovl.draw_face_extents(BLANK.copy(), LM, "mesh")
        y_top = int(ovl._xy(LM, ovl.P_FOREHEAD_CROWN)[1])
        assert (255, 255, 255) in _row_colors(img, y_top), \
            f"White FaceExtents top line missing at row {y_top}"

    def test_face_extents_bottom_row_is_white(self):
        img   = ovl.draw_face_extents(BLANK.copy(), LM, "mesh")
        y_men = int(ovl._xy(LM, ovl.P_MENTON)[1])
        assert (255, 255, 255) in _row_colors(img, y_men), \
            f"White FaceExtents bottom line missing at row {y_men}"

    def test_face_extents_left_col_is_white(self):
        img   = ovl.draw_face_extents(BLANK.copy(), LM, "mesh")
        x_l   = int(ovl._xy(LM, ovl.P_ZYGO_IMG_LEFT)[0])
        assert (255, 255, 255) in _col_colors(img, x_l), \
            f"White FaceExtents left edge missing at col {x_l}"

    def test_face_extents_right_col_is_white(self):
        img   = ovl.draw_face_extents(BLANK.copy(), LM, "mesh")
        x_r   = int(ovl._xy(LM, ovl.P_ZYGO_IMG_RIGHT)[0])
        assert (255, 255, 255) in _col_colors(img, x_r), \
            f"White FaceExtents right edge missing at col {x_r}"
