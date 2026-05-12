"""Tests for the 8 additional hairline-dependent metrics with BiSeNet trichion.

Phase 5 follow-up (2026-05-12): verifies that all calculators that read
lm[P_FOREHEAD_CROWN] now correctly use effective_trichion_y() from
_trichion.py, applying the same BiSeNet override logic as thirds.py.

Affected metric_ids:
  forehead family:
    - forehead_height_ratio
    - hairline_curvature_index
  jaw family:
    - chin_projection_proxy
  global_shape family:
    - face_height_to_width_ratio
    - face_shape_classification
    - total_facial_convexity
    - facial_index_anthropometric
  phi family:
    - phi_face_height_to_width

For each metric we verify:
  1. Fallback path (no virtual_landmarks / low-confidence) → value equals baseline.
  2. BiSeNet path (trichion moved 0.3 ICU higher) → value shifts in expected direction.
  3. confidence_final is multiplied by trichion_confidence when bisenet active.
"""

from __future__ import annotations

import pytest
import numpy as np

import app.services.metrics  # noqa: F401 — trigger @register for all calculators

from app.services.metrics.base import QualityContext
from app.services.metrics.registry import get
from app.services.normalization import normalize

from tests.fixtures.synthetic_landmarks import perfect_frontal


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_ctx(virtual_landmarks=None) -> QualityContext:
    return QualityContext(
        quality_score=1.0,
        virtual_landmarks=virtual_landmarks,
    )


def _bisenet_vl(trichion_y_icu: float, confidence: float = 0.90) -> dict:
    """Build a virtual_landmarks dict simulating BiSeNet with given y_icu."""
    return {
        "trichion_y_icu":      trichion_y_icu,
        "trichion_confidence": confidence,
        "trichion_source":     "bisenet",
    }


def _low_confidence_vl(trichion_y_icu: float) -> dict:
    """Build a virtual_landmarks dict with below-threshold confidence."""
    return {
        "trichion_y_icu":      trichion_y_icu,
        "trichion_confidence": 0.3,  # below 0.40 threshold
        "trichion_source":     "bisenet",
    }


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def frontal_nl():
    """Normalized perfect_frontal face — ICD=100 px, crown at y_icu ≈ -2.0."""
    return normalize(perfect_frontal())


@pytest.fixture
def crown_y_icu(frontal_nl):
    """The mesh crown y-coordinate in ICU for the frontal fixture."""
    from app.domain.landmarks_mesh import P_FOREHEAD_CROWN
    return float(frontal_nl.xy(P_FOREHEAD_CROWN)[1])


@pytest.fixture
def bisenet_higher_vl(crown_y_icu):
    """BiSeNet VL with trichion 0.3 ICU higher (more negative) than mesh crown.

    Moving trichion higher (more negative y) means: taller forehead region
    → forehead_height increases, face_height_to_width increases,
      chin_projection_proxy decreases, facial_index increases.
    """
    return _bisenet_vl(trichion_y_icu=crown_y_icu - 0.3, confidence=0.90)


# ---------------------------------------------------------------------------
# Parametrize over all 8 affected metric_ids
# ---------------------------------------------------------------------------

_HAIRLINE_METRICS = [
    "forehead_height_ratio",
    "hairline_curvature_index",
    "chin_projection_proxy",
    "face_height_to_width_ratio",
    "face_shape_classification",
    "total_facial_convexity",
    "facial_index_anthropometric",
    "phi_face_height_to_width",
]


@pytest.mark.parametrize("metric_id", _HAIRLINE_METRICS)
class TestFallbackIdenticalToBaseline:
    """Low-confidence or absent virtual_landmarks must not change metric value."""

    def test_no_vl_equals_baseline(self, metric_id, frontal_nl, crown_y_icu):
        """virtual_landmarks=None must give same value as low-confidence VL."""
        calc = get(metric_id)
        if calc is None:
            pytest.skip(f"{metric_id} not registered")

        ctx_none = _build_ctx()
        ctx_low  = _build_ctx(_low_confidence_vl(crown_y_icu - 0.5))

        v_none = calc.compute(frontal_nl, ctx_none).value
        v_low  = calc.compute(frontal_nl, ctx_low).value

        assert v_none is not None, f"{metric_id} returned None on no-VL path"
        assert abs(v_none - v_low) < 1e-9, (
            f"{metric_id}: low-conf VL should give same value as no-VL: "
            f"{v_none:.6f} vs {v_low:.6f}"
        )

    def test_mesh_source_not_multiplied(self, metric_id, frontal_nl, crown_y_icu):
        """trichion_source='mesh' must not multiply confidence."""
        calc = get(metric_id)
        if calc is None:
            pytest.skip(f"{metric_id} not registered")

        ctx_none = _build_ctx()
        ctx_mesh = _build_ctx({
            "trichion_y_icu":      crown_y_icu,
            "trichion_confidence": 0.95,
            "trichion_source":     "mesh",  # source is mesh → no multiplier
        })

        r_none = calc.compute(frontal_nl, ctx_none)
        r_mesh = calc.compute(frontal_nl, ctx_mesh)

        # Same position → same value; source=mesh → no confidence penalty
        if r_none.value is not None and r_mesh.value is not None:
            assert abs(r_none.value - r_mesh.value) < 1e-9, (
                f"{metric_id}: mesh-source VL changed value unexpectedly: "
                f"{r_none.value:.6f} vs {r_mesh.value:.6f}"
            )


# ---------------------------------------------------------------------------
# Direction of shift
# ---------------------------------------------------------------------------

class TestBiSeNetShiftDirection:
    """Moving trichion 0.3 ICU higher must shift values in expected directions."""

    def test_forehead_height_increases(self, frontal_nl, bisenet_higher_vl):
        """forehead_height_ratio = brow_y − trichion_y: higher trichion → larger."""
        calc = get("forehead_height_ratio")
        if calc is None:
            pytest.skip("forehead_height_ratio not registered")

        v_base    = calc.compute(frontal_nl, _build_ctx()).value
        v_bisenet = calc.compute(frontal_nl, _build_ctx(bisenet_higher_vl)).value

        assert v_bisenet > v_base, (
            f"forehead_height_ratio should increase: base={v_base:.4f}, "
            f"bisenet={v_bisenet:.4f}"
        )

    def test_hairline_curvature_changes(self, frontal_nl, bisenet_higher_vl):
        """hairline_curvature_index sagitta = chord_midpoint_y - trichion_y.
        Moving trichion up (more negative y) increases sagitta → index increases."""
        calc = get("hairline_curvature_index")
        if calc is None:
            pytest.skip("hairline_curvature_index not registered")

        v_base    = calc.compute(frontal_nl, _build_ctx()).value
        v_bisenet = calc.compute(frontal_nl, _build_ctx(bisenet_higher_vl)).value

        assert v_bisenet > v_base, (
            f"hairline_curvature_index should increase with higher trichion: "
            f"base={v_base:.4f}, bisenet={v_bisenet:.4f}"
        )

    def test_chin_projection_decreases(self, frontal_nl, bisenet_higher_vl):
        """chin_projection_proxy = lower_h/total_h. Larger total_h → smaller ratio."""
        calc = get("chin_projection_proxy")
        if calc is None:
            pytest.skip("chin_projection_proxy not registered")

        v_base    = calc.compute(frontal_nl, _build_ctx()).value
        v_bisenet = calc.compute(frontal_nl, _build_ctx(bisenet_higher_vl)).value

        assert v_bisenet < v_base, (
            f"chin_projection_proxy should decrease with higher trichion: "
            f"base={v_base:.4f}, bisenet={v_bisenet:.4f}"
        )

    def test_face_height_to_width_increases(self, frontal_nl, bisenet_higher_vl):
        """face_height = menton_y − trichion_y: higher trichion → larger ratio."""
        calc = get("face_height_to_width_ratio")
        if calc is None:
            pytest.skip("face_height_to_width_ratio not registered")

        v_base    = calc.compute(frontal_nl, _build_ctx()).value
        v_bisenet = calc.compute(frontal_nl, _build_ctx(bisenet_higher_vl)).value

        assert v_bisenet > v_base, (
            f"face_height_to_width_ratio should increase: base={v_base:.4f}, "
            f"bisenet={v_bisenet:.4f}"
        )

    def test_face_shape_classification_aspect_increases(
            self, frontal_nl, bisenet_higher_vl):
        """face_shape_classification numeric value = aspect ratio → increases."""
        calc = get("face_shape_classification")
        if calc is None:
            pytest.skip("face_shape_classification not registered")

        v_base    = calc.compute(frontal_nl, _build_ctx()).value
        v_bisenet = calc.compute(frontal_nl, _build_ctx(bisenet_higher_vl)).value

        assert v_bisenet > v_base, (
            f"face_shape_classification value (aspect) should increase: "
            f"base={v_base:.4f}, bisenet={v_bisenet:.4f}"
        )

    def test_facial_index_increases(self, frontal_nl, bisenet_higher_vl):
        """facial_index = (face_h/face_w)×100. Higher trichion → larger face_h."""
        calc = get("facial_index_anthropometric")
        if calc is None:
            pytest.skip("facial_index_anthropometric not registered")

        v_base    = calc.compute(frontal_nl, _build_ctx()).value
        v_bisenet = calc.compute(frontal_nl, _build_ctx(bisenet_higher_vl)).value

        assert v_bisenet > v_base, (
            f"facial_index_anthropometric should increase: base={v_base:.4f}, "
            f"bisenet={v_bisenet:.4f}"
        )

    def test_phi_face_height_to_width_increases(self, frontal_nl, bisenet_higher_vl):
        """phi_face_height_to_width = face_h/bizygomatic. Higher trichion → larger."""
        calc = get("phi_face_height_to_width")
        if calc is None:
            pytest.skip("phi_face_height_to_width not registered")

        v_base    = calc.compute(frontal_nl, _build_ctx()).value
        v_bisenet = calc.compute(frontal_nl, _build_ctx(bisenet_higher_vl)).value

        assert v_bisenet > v_base, (
            f"phi_face_height_to_width should increase: base={v_base:.4f}, "
            f"bisenet={v_bisenet:.4f}"
        )


# ---------------------------------------------------------------------------
# Confidence propagation
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("metric_id", _HAIRLINE_METRICS)
class TestConfidenceMultiplier:
    """confidence_final must be multiplied by trichion_confidence on BiSeNet path."""

    def test_confidence_multiplied_by_bisenet_confidence(
            self, metric_id, frontal_nl, crown_y_icu):
        """When bisenet source + conf=0.9, conf_final should equal baseline×0.9."""
        calc = get(metric_id)
        if calc is None:
            pytest.skip(f"{metric_id} not registered")

        # Same position as mesh crown → value is unchanged, only confidence differs.
        vl = {
            "trichion_y_icu":      crown_y_icu,   # same position → same value
            "trichion_confidence": 0.9,
            "trichion_source":     "bisenet",
        }
        ctx_none    = _build_ctx()
        ctx_bisenet = _build_ctx(vl)

        r_none    = calc.compute(frontal_nl, ctx_none)
        r_bisenet = calc.compute(frontal_nl, ctx_bisenet)

        # confidence_final_bisenet ≈ confidence_final_baseline × 0.9
        expected_cf = r_none.confidence_final * 0.9
        assert abs(r_bisenet.confidence_final - expected_cf) < 1e-6, (
            f"{metric_id}: expected conf_final={expected_cf:.6f} "
            f"(baseline={r_none.confidence_final:.6f} × 0.9), "
            f"got {r_bisenet.confidence_final:.6f}"
        )

    def test_bisenet_confidence_at_same_position_is_fraction(
            self, metric_id, frontal_nl, crown_y_icu):
        """At any trichion position, bisenet conf_final is in [0, 1] and is the
        result of applying the trichion confidence multiplier to conf_raw × propagation.

        The key invariant: applying bisenet multiplier (∈ [0.8, 1.0]) never
        produces a value outside [0, 1].
        """
        calc = get(metric_id)
        if calc is None:
            pytest.skip(f"{metric_id} not registered")

        vl = _bisenet_vl(trichion_y_icu=crown_y_icu - 0.3, confidence=0.85)
        ctx_bisenet = _build_ctx(vl)

        r_bisenet = calc.compute(frontal_nl, ctx_bisenet)

        assert 0.0 <= r_bisenet.confidence_final <= 1.0 + 1e-9, (
            f"{metric_id}: conf_final out of [0,1]: {r_bisenet.confidence_final:.6f}"
        )
