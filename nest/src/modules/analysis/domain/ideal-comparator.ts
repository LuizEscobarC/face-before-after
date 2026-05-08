/**
 * IdealComparator — pure domain service (PR-9).
 *
 * Computes the comparison of a raw metric value against its stored ideal
 * (MetricIdealEntity or a plain IdealSpec).
 *
 * This service is stateless and has no DB access. It receives all the data
 * it needs as arguments so it can be unit-tested without any NestJS wiring.
 *
 * Outputs:
 *   deviationRaw        — value − ideal_central_value, in the metric's native unit
 *   deviationNormalized — deviationRaw / green_half_width  (unitless)
 *                         Null when green range is undefined (presentation_only metrics)
 *   directionLabel      — LocalizedText snapshot; empty {} when metric is neutral
 */

import type { LocalizedText } from '../domain/types/catalog.types.js';

// ---------------------------------------------------------------------------
// Input & output types
// ---------------------------------------------------------------------------

/**
 * Minimal ideal specification — matches MetricIdealEntity fields.
 * Accepts the entity directly or a plain DTO.
 */
export interface IdealSpec {
  idealCentralValue: number | null;
  greenRangeMin: number | null;
  greenRangeMax: number | null;
  directionLabelAbove: LocalizedText;
  directionLabelBelow: LocalizedText;
}

export interface ComparisonResult {
  deviationRaw: number | null;
  /** deviationRaw / green_half_width. Null when ranges not defined. */
  deviationNormalized: number | null;
  /** Snapshot of the i18n label applied. Empty {} when value is in green range. */
  directionLabel: LocalizedText;
  /** 'above' | 'below' | 'neutral' — raw string direction for downstream logic. */
  rawDirection: 'above' | 'below' | 'neutral';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class IdealComparator {
  /**
   * Compare a numeric metric value against its ideal specification.
   *
   * @param value  The metric value produced by the Python vision service.
   * @param ideal  The ideal specification loaded from metric_ideal table / YAML.
   * @returns      ComparisonResult — all nullable fields are null when inputs
   *               are null or when ranges are not defined.
   */
  compare(value: number | null, ideal: IdealSpec): ComparisonResult {
    if (value === null || ideal.idealCentralValue === null) {
      return {
        deviationRaw: null,
        deviationNormalized: null,
        directionLabel: {},
        rawDirection: 'neutral',
      };
    }

    const deviationRaw = value - ideal.idealCentralValue;

    const deviationNormalized = this._normalise(
      deviationRaw,
      ideal.greenRangeMin,
      ideal.greenRangeMax,
      ideal.idealCentralValue,
    );

    const rawDirection = this._direction(deviationRaw);
    const directionLabel = this._resolveLabel(
      rawDirection,
      deviationRaw,
      ideal.greenRangeMin,
      ideal.greenRangeMax,
      ideal.idealCentralValue,
      ideal.directionLabelAbove,
      ideal.directionLabelBelow,
    );

    return { deviationRaw, deviationNormalized, directionLabel, rawDirection };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private _normalise(
    deviationRaw: number,
    greenMin: number | null,
    greenMax: number | null,
    central: number,
  ): number | null {
    if (greenMin === null || greenMax === null) return null;

    // green_half_width = distance from centre to nearest green edge
    const halfWidth = Math.min(
      Math.abs(central - greenMin),
      Math.abs(greenMax - central),
    );

    if (halfWidth <= 0) return null;

    return deviationRaw / halfWidth;
  }

  /** Return 'above' | 'below' | 'neutral'. 'neutral' only when raw == 0. */
  private _direction(deviationRaw: number): 'above' | 'below' | 'neutral' {
    if (deviationRaw > 0) return 'above';
    if (deviationRaw < 0) return 'below';
    return 'neutral';
  }

  /**
   * Only populate directionLabel when value is OUTSIDE the green range.
   * When inside green range the label is empty {} (avoid showing "it's fine").
   */
  private _resolveLabel(
    direction: 'above' | 'below' | 'neutral',
    deviationRaw: number,
    greenMin: number | null,
    greenMax: number | null,
    central: number,
    labelAbove: LocalizedText,
    labelBelow: LocalizedText,
  ): LocalizedText {
    if (direction === 'neutral') return {};

    // Inside green range — return empty label (no directionality shown)
    if (
      greenMin !== null &&
      greenMax !== null &&
      central + deviationRaw >= greenMin &&
      central + deviationRaw <= greenMax
    ) {
      return {};
    }

    return direction === 'above' ? { ...labelAbove } : { ...labelBelow };
  }
}
