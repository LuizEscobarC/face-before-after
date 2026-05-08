/**
 * SeverityClassifier — pure domain service (PR-9).
 *
 * Two responsibilities:
 *
 *  1. classify5(): float deviation_normalized → Severity5
 *     Thresholds (deviation_normalized, i.e. deviation / green_half_width):
 *
 *       |dn| ∈ [0, 1.0)   → 'ideal'    (inside green range)
 *       |dn| ∈ [1.0, 2.0) → 'mild'     (outside green, approaching yellow)
 *       |dn| ∈ [2.0, 3.5) → 'moderate' (within yellow band)
 *       |dn| ∈ [3.5, 5.0) → 'strong'   (beyond yellow, approaching red)
 *       |dn| ≥ 5.0         → 'extreme'  (clearly outside all bands)
 *
 *     These correspond to the green/yellow ranges in metric_ideals.yaml:
 *       green half-width  = 1 dn unit
 *       yellow half-width ≈ 2–3 dn units
 *
 *  2. collapse(): Severity5 + collapse policy → Severity3
 *     Policy is the `mapping` field from `severity_collapse_policy` (DB row).
 *     Default DEC-3 collapse: ideal+mild→LEVE, moderate→MODERADO, strong+extreme→SEVERO.
 *
 * This service is stateless, has no DB access, and can be tested standalone.
 */

import type { Severity3, Severity5 } from './types/catalog.types.js';
import type { SeverityCollapseMapping } from '../infrastructure/entities/severity-collapse-policy.entity.js';

// ---------------------------------------------------------------------------
// Default collapse mapping (DEC-3)
// ---------------------------------------------------------------------------

export const DEFAULT_COLLAPSE_MAPPING: SeverityCollapseMapping = {
  ideal:    'LEVE',
  mild:     'LEVE',
  moderate: 'MODERADO',
  strong:   'SEVERO',
  extreme:  'SEVERO',
};

// Thresholds in deviation_normalized units
const IDEAL_MAX    = 1.0;
const MILD_MAX     = 2.0;
const MODERATE_MAX = 3.5;
const STRONG_MAX   = 5.0;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SeverityClassifier {
  /**
   * Map a normalised deviation to a 5-level severity.
   *
   * @param deviationNormalized  deviationRaw / green_half_width.
   *                             Null returns null (e.g. presentation_only metrics).
   */
  classify5(deviationNormalized: number | null): Severity5 | null {
    if (deviationNormalized === null) return null;

    const abs = Math.abs(deviationNormalized);

    if (abs < IDEAL_MAX)    return 'ideal';
    if (abs < MILD_MAX)     return 'mild';
    if (abs < MODERATE_MAX) return 'moderate';
    if (abs < STRONG_MAX)   return 'strong';
    return 'extreme';
  }

  /**
   * Collapse a 5-level severity to 3-level using the provided policy mapping.
   * Falls back to DEFAULT_COLLAPSE_MAPPING when mapping is undefined/null.
   *
   * @param severity5  The raw 5-level severity from classify5().
   * @param mapping    The `mapping` JSONB from severity_collapse_policy row.
   */
  collapse(
    severity5: Severity5 | null,
    mapping: SeverityCollapseMapping = DEFAULT_COLLAPSE_MAPPING,
  ): Severity3 | null {
    if (severity5 === null) return null;
    return mapping[severity5] ?? DEFAULT_COLLAPSE_MAPPING[severity5];
  }

  /**
   * Convenience: classify and collapse in one call.
   *
   * @returns  `{ severity5, severity3 }` — both null when deviationNormalized is null.
   */
  classifyAndCollapse(
    deviationNormalized: number | null,
    mapping: SeverityCollapseMapping = DEFAULT_COLLAPSE_MAPPING,
  ): { severity5: Severity5 | null; severity3: Severity3 | null } {
    const severity5 = this.classify5(deviationNormalized);
    const severity3 = this.collapse(severity5, mapping);
    return { severity5, severity3 };
  }
}
