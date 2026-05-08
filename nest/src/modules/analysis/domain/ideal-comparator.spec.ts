/**
 * Unit tests for IdealComparator (PR-9).
 *
 * All tests are pure — no NestJS bootstrap, no DB, no HTTP.
 */

import { describe, it, expect } from 'vitest';
import { IdealComparator } from './ideal-comparator.js';
import type { IdealSpec } from './ideal-comparator.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Perfect "canonical" ideal for a ratio metric with symmetric green range. */
const symmetricIdeal: IdealSpec = {
  idealCentralValue: 0.333,
  greenRangeMin: 0.300,
  greenRangeMax: 0.367,
  directionLabelAbove: { 'pt-BR': 'terço dominante' },
  directionLabelBelow: { 'pt-BR': 'terço reduzido' },
};

/** Ideal anchored at 0.0 (symmetry metrics). */
const zeroIdeal: IdealSpec = {
  idealCentralValue: 0.0,
  greenRangeMin: -0.05,
  greenRangeMax: 0.05,
  directionLabelAbove: { 'pt-BR': 'desvio positivo' },
  directionLabelBelow: { 'pt-BR': 'desvio negativo' },
};

/** Ideal with no range defined (presentation_only). */
const noRangeIdeal: IdealSpec = {
  idealCentralValue: null,
  greenRangeMin: null,
  greenRangeMax: null,
  directionLabelAbove: {},
  directionLabelBelow: {},
};

const cmp = new IdealComparator();

// ---------------------------------------------------------------------------
// Basic contract
// ---------------------------------------------------------------------------

describe('IdealComparator — null inputs', () => {
  it('returns all-null result when value is null', () => {
    const r = cmp.compare(null, symmetricIdeal);
    expect(r.deviationRaw).toBeNull();
    expect(r.deviationNormalized).toBeNull();
    expect(r.rawDirection).toBe('neutral');
    expect(r.directionLabel).toEqual({});
  });

  it('returns all-null result when ideal central value is null', () => {
    const r = cmp.compare(0.4, noRangeIdeal);
    expect(r.deviationRaw).toBeNull();
    expect(r.deviationNormalized).toBeNull();
    expect(r.rawDirection).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// deviationRaw
// ---------------------------------------------------------------------------

describe('IdealComparator — deviationRaw', () => {
  it('is 0 when value equals central', () => {
    expect(cmp.compare(0.333, symmetricIdeal).deviationRaw).toBeCloseTo(0, 9);
  });

  it('is positive when value > central', () => {
    const r = cmp.compare(0.4, symmetricIdeal);
    expect(r.deviationRaw).toBeCloseTo(0.067, 5);
  });

  it('is negative when value < central', () => {
    const r = cmp.compare(0.267, symmetricIdeal);
    expect(r.deviationRaw).toBeCloseTo(-0.066, 4);
  });

  it('works for zero-anchored ideal', () => {
    expect(cmp.compare(0.0, zeroIdeal).deviationRaw).toBeCloseTo(0, 9);
    expect(cmp.compare(0.1, zeroIdeal).deviationRaw).toBeCloseTo(0.1, 9);
    expect(cmp.compare(-0.08, zeroIdeal).deviationRaw).toBeCloseTo(-0.08, 9);
  });
});

// ---------------------------------------------------------------------------
// deviationNormalized
// ---------------------------------------------------------------------------

describe('IdealComparator — deviationNormalized', () => {
  it('is 0 when value equals central', () => {
    expect(cmp.compare(0.333, symmetricIdeal).deviationNormalized).toBeCloseTo(0, 9);
  });

  it('is 1 at green edge (above)', () => {
    // greenRangeMax=0.367, central=0.333, half-width=min(0.033,0.034)=0.033
    const r = cmp.compare(0.366, symmetricIdeal);
    // deviationRaw = 0.033, halfWidth = 0.033 → dn ≈ 1.0
    expect(r.deviationNormalized).toBeCloseTo(1.0, 1);
  });

  it('is -1 at green edge (below)', () => {
    const r = cmp.compare(0.300, symmetricIdeal);
    // deviationRaw = -0.033, halfWidth = 0.033 → dn ≈ -1.0
    expect(r.deviationNormalized).toBeCloseTo(-1.0, 1);
  });

  it('is null when green range is undefined', () => {
    const ideal: IdealSpec = {
      ...symmetricIdeal,
      greenRangeMin: null,
      greenRangeMax: null,
    };
    expect(cmp.compare(0.4, ideal).deviationNormalized).toBeNull();
  });

  it('zero-ideal: inside green (value=0.03) → |dn| < 1', () => {
    const r = cmp.compare(0.03, zeroIdeal);
    expect(Math.abs(r.deviationNormalized!)).toBeLessThan(1);
  });

  it('zero-ideal: outside green (value=0.10) → |dn| > 1', () => {
    const r = cmp.compare(0.10, zeroIdeal);
    expect(Math.abs(r.deviationNormalized!)).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// rawDirection
// ---------------------------------------------------------------------------

describe('IdealComparator — rawDirection', () => {
  it('"above" when value > central', () => {
    expect(cmp.compare(0.5, symmetricIdeal).rawDirection).toBe('above');
  });

  it('"below" when value < central', () => {
    expect(cmp.compare(0.1, symmetricIdeal).rawDirection).toBe('below');
  });

  it('"neutral" when value == central', () => {
    expect(cmp.compare(0.333, symmetricIdeal).rawDirection).toBe('neutral');
  });
});

// ---------------------------------------------------------------------------
// directionLabel
// ---------------------------------------------------------------------------

describe('IdealComparator — directionLabel', () => {
  it('is empty {} when value is inside green range (neutral zone)', () => {
    // 0.333 (ideal centre) → inside green
    expect(cmp.compare(0.333, symmetricIdeal).directionLabel).toEqual({});
  });

  it('is empty {} when value is at green boundary (exactly on edge)', () => {
    // greenRangeMax = 0.367 → on edge, still "inside"
    expect(cmp.compare(0.367, symmetricIdeal).directionLabel).toEqual({});
  });

  it('returns above label when value is outside green range (above)', () => {
    const r = cmp.compare(0.5, symmetricIdeal);
    expect(r.directionLabel).toEqual({ 'pt-BR': 'terço dominante' });
  });

  it('returns below label when value is outside green range (below)', () => {
    const r = cmp.compare(0.2, symmetricIdeal);
    expect(r.directionLabel).toEqual({ 'pt-BR': 'terço reduzido' });
  });

  it('label is a copy, not the same reference', () => {
    const r = cmp.compare(0.5, symmetricIdeal);
    r.directionLabel['en-US'] = 'mutated';
    expect(symmetricIdeal.directionLabelAbove['en-US']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Eye-metric spot checks (regression)
// ---------------------------------------------------------------------------

describe('IdealComparator — eye metrics spot checks', () => {
  const eyeApertureIdeal: IdealSpec = {
    idealCentralValue: 0.30,
    greenRangeMin: 0.25,
    greenRangeMax: 0.35,
    directionLabelAbove: { 'pt-BR': 'abertura ampla' },
    directionLabelBelow: { 'pt-BR': 'abertura reduzida' },
  };

  it('perfect_frontal aperture (0.30) → deviation = 0, dn = 0, label = {}', () => {
    const r = cmp.compare(0.30, eyeApertureIdeal);
    expect(r.deviationRaw).toBeCloseTo(0, 9);
    expect(r.deviationNormalized).toBeCloseTo(0, 9);
    expect(r.directionLabel).toEqual({});
  });

  it('narrow eye (0.18) → direction below, label populated', () => {
    const r = cmp.compare(0.18, eyeApertureIdeal);
    expect(r.rawDirection).toBe('below');
    expect(r.directionLabel['pt-BR']).toBe('abertura reduzida');
  });
});
