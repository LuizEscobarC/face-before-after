"""Tests for thirds.py with BiSeNet virtual_landmarks context.

Covers:
  - Fallback (no virtual_landmarks): values identical to baseline
  - BiSeNet path (virtual_landmarks.trichion_confidence >= 0.8): upper shifts
  - Confidence multiplication by trichion_confidence
  - Ratios always sum to 1.0
"""

from __future__ import annotations

import pytest
import numpy as np

import app.services.metrics  # noqa: F401 — trigger @register

from app.services.metrics.base import QualityContext
from app.services.metrics.registry import get, compute_all
from app.services.normalization import normalize

from tests.fixtures.synthetic_landmarks import perfect_frontal, perfect_thirds


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #

def _build_ctx(virtual_landmarks=None) -> QualityContext:
    return QualityContext(
        quality_score=1.0,
        virtual_landmarks=virtual_landmarks,
    )


def _bisenet_vl(trichion_y_icu: float, confidence: float = 0.90) -> dict:
    """Build a virtual_landmarks dict that simulates BiSeNet with given y_icu."""
    return {
        "trichion_y_icu":      trichion_y_icu,
        "trichion_confidence": confidence,
        "trichion_source":     "bisenet",
    }


# --------------------------------------------------------------------------- #
# Fixtures
# --------------------------------------------------------------------------- #

@pytest.fixture
def frontal_nl():
    return normalize(perfect_frontal())


@pytest.fixture
def thirds_nl():
    return normalize(perfect_thirds())


# --------------------------------------------------------------------------- #
# Fallback: no virtual_landmarks → identical to baseline
# --------------------------------------------------------------------------- #

class TestFallbackIdenticalToBaseline:

    def test_upper_third_fallback_equals_baseline(self, frontal_nl):
        """Without virtual_landmarks, upper_third_ratio must equal the baseline."""
        ctx_no_vl = _build_ctx(virtual_landmarks=None)
        ctx_low   = _build_ctx(virtual_landmarks={
            "trichion_y_icu":      -2.0,
            "trichion_confidence": 0.5,  # below threshold
            "trichion_source":     "mesh",
        })

        upper_no_vl = get("upper_third_ratio").compute(frontal_nl, ctx_no_vl).value
        upper_low   = get("upper_third_ratio").compute(frontal_nl, ctx_low).value
        assert abs(upper_no_vl - upper_low) < 1e-9, (
            f"Low confidence VL should give same value as no VL: "
            f"{upper_no_vl:.4f} vs {upper_low:.4f}"
        )

    def test_middle_third_no_change_on_fallback(self, frontal_nl):
        """Middle third is identical whether virtual_landmarks is None or low-confidence."""
        ctx_none = _build_ctx()
        ctx_low  = _build_ctx(virtual_landmarks={
            "trichion_y_icu": -1.0, "trichion_confidence": 0.3, "trichion_source": "mesh"
        })
        m_none = get("middle_third_ratio").compute(frontal_nl, ctx_none).value
        m_low  = get("middle_third_ratio").compute(frontal_nl, ctx_low).value
        assert abs(m_none - m_low) < 1e-9


# --------------------------------------------------------------------------- #
# BiSeNet active path: upper_third shifts
# --------------------------------------------------------------------------- #

class TestBiSeNetActiveUpperThird:

    def test_higher_trichion_y_icu_increases_upper_third(self, frontal_nl):
        """Moving trichion HIGHER (more negative y_icu) increases upper_third_ratio."""
        ctx_default = _build_ctx()
        # Get baseline forehead y from normalized landmarks
        from app.domain.landmarks_mesh import P_FOREHEAD_CROWN
        baseline_forehead_y = float(frontal_nl.xy(P_FOREHEAD_CROWN)[1])

        # Move trichion higher in image (more negative y_icu) → taller forehead → bigger upper third
        vl = _bisenet_vl(trichion_y_icu=baseline_forehead_y - 0.3)
        ctx_bisenet = _build_ctx(virtual_landmarks=vl)

        u_default = get("upper_third_ratio").compute(frontal_nl, ctx_default).value
        u_bisenet = get("upper_third_ratio").compute(frontal_nl, ctx_bisenet).value

        assert u_bisenet > u_default, (
            f"Expected upper_third_ratio to increase with higher trichion (more negative y_icu): "
            f"default={u_default:.4f}, bisenet={u_bisenet:.4f}"
        )

    def test_ratios_sum_to_one_with_bisenet(self, frontal_nl):
        """upper + middle + lower must sum to 1.0 when BiSeNet is active."""
        from app.domain.landmarks_mesh import P_FOREHEAD_CROWN
        baseline_y = float(frontal_nl.xy(P_FOREHEAD_CROWN)[1])
        vl = _bisenet_vl(trichion_y_icu=baseline_y + 0.5)
        ctx = _build_ctx(virtual_landmarks=vl)

        u = get("upper_third_ratio").compute(frontal_nl, ctx).value
        m = get("middle_third_ratio").compute(frontal_nl, ctx).value
        l = get("lower_third_ratio").compute(frontal_nl, ctx).value

        assert abs(u + m + l - 1.0) < 1e-9, f"Ratios sum={u+m+l:.10f} (expected 1.0)"

    def test_bisenet_confidence_multiplied_into_conf_final(self, frontal_nl):
        """confidence_final for upper_third must be multiplied by trichion_confidence."""
        ctx_full   = _build_ctx()
        vl = _bisenet_vl(trichion_y_icu=-1.8, confidence=0.85)
        ctx_bisenet = _build_ctx(virtual_landmarks=vl)

        r_full    = get("upper_third_ratio").compute(frontal_nl, ctx_full)
        r_bisenet = get("upper_third_ratio").compute(frontal_nl, ctx_bisenet)

        # With confidence 0.85, bisenet conf_final should be ≤ full conf_final
        assert r_bisenet.confidence_final <= r_full.confidence_final + 1e-9, (
            f"Expected bisenet conf_final ≤ baseline: "
            f"{r_bisenet.confidence_final:.4f} > {r_full.confidence_final:.4f}"
        )

    def test_trichion_source_bisenet_triggers_conf_multiplication(self, thirds_nl):
        """trichion_source='bisenet' with confidence 0.8 → conf is multiplied."""
        from app.domain.landmarks_mesh import P_FOREHEAD_CROWN
        mesh_y = float(thirds_nl.xy(P_FOREHEAD_CROWN)[1])

        ctx_no_vl = _build_ctx()
        vl = {
            "trichion_y_icu": mesh_y,  # same position → same ratio
            "trichion_confidence": 0.8,
            "trichion_source": "bisenet",
        }
        ctx_bisenet = _build_ctx(virtual_landmarks=vl)

        r_no_vl  = get("upper_third_ratio").compute(thirds_nl, ctx_no_vl)
        r_bisenet = get("upper_third_ratio").compute(thirds_nl, ctx_bisenet)

        # Same position → same value; but bisenet conf multiplied by 0.8
        assert abs(r_no_vl.value - r_bisenet.value) < 1e-6
        assert abs(r_bisenet.confidence_final - r_no_vl.confidence_final * 0.8) < 1e-6, (
            f"Expected conf_final *= 0.8: "
            f"got {r_bisenet.confidence_final:.6f}, "
            f"expected {r_no_vl.confidence_final * 0.8:.6f}"
        )


# --------------------------------------------------------------------------- #
# Non-thirds metrics unaffected
# --------------------------------------------------------------------------- #

class TestNonThirdsMetricsUnchanged:

    def test_nose_metrics_not_affected_by_virtual_landmarks(self, frontal_nl):
        """Virtual landmarks must not change nose_length_to_icd metric value."""
        ctx_none    = _build_ctx()
        ctx_bisenet = _build_ctx(virtual_landmarks=_bisenet_vl(-1.5))

        from app.services.metrics.registry import get as _get
        nose_calc = _get("nose_length_to_icd")
        if nose_calc is None:
            pytest.skip("nose_length_to_icd not registered")

        v_none    = nose_calc.compute(frontal_nl, ctx_none).value
        v_bisenet = nose_calc.compute(frontal_nl, ctx_bisenet).value
        assert abs(v_none - v_bisenet) < 1e-9, (
            f"Nose metric changed with bisenet context: {v_none} → {v_bisenet}"
        )
