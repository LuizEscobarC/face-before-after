/**
 * Unit tests for RegionalScorer (PR-12 / M2 first slice).
 *
 * Pure tests — no NestJS bootstrap.
 */
import { describe, it, expect } from 'vitest';
import {
  RegionalScorer,
  type RegionalScorerMetricInput,
  type RegionalScorerWeight,
} from './regional-scorer.js';

const scorer = new RegionalScorer();

const baseMetric = (overrides: Partial<RegionalScorerMetricInput> = {}): RegionalScorerMetricInput => ({
  metricId: 'm1',
  region: 'symmetry',
  value: 0.0,
  deviationNormalized: 0.0,
  confidenceFinal: 1.0,
  presentationOnly: false,
  ...overrides,
});

const w = (metricId: string, weight: number): RegionalScorerWeight => ({ metricId, weight });

describe('RegionalScorer — empty / unscorable', () => {
  it('no metrics → null score', () => {
    const r = scorer.score('symmetry', [], [w('m1', 1)]);
    expect(r.score0to100).toBeNull();
    expect(r.confidenceAggregate).toBeNull();
    expect(r.contributingMetricIds).toEqual([]);
  });

  it('all metrics with value=null → null score', () => {
    const r = scorer.score(
      'symmetry',
      [baseMetric({ metricId: 'm1', value: null }), baseMetric({ metricId: 'm2', value: null })],
      [w('m1', 1), w('m2', 1)],
    );
    expect(r.score0to100).toBeNull();
  });

  it('all metrics with deviationNormalized=null → null', () => {
    const r = scorer.score(
      'symmetry',
      [baseMetric({ metricId: 'm1', deviationNormalized: null })],
      [w('m1', 1)],
    );
    expect(r.score0to100).toBeNull();
  });

  it('confidence_final below 0.4 → metric skipped', () => {
    const r = scorer.score(
      'symmetry',
      [baseMetric({ metricId: 'm1', confidenceFinal: 0.3 })],
      [w('m1', 1)],
    );
    expect(r.score0to100).toBeNull();
  });
});

describe('RegionalScorer — perfect ideal', () => {
  it('single metric at deviation=0 → 100', () => {
    const r = scorer.score(
      'symmetry',
      [baseMetric()],
      [w('m1', 1)],
    );
    expect(r.score0to100).toBe(100);
    expect(r.confidenceAggregate).toBe(1.0);
    expect(r.contributingMetricIds).toEqual(['m1']);
  });

  it('three metrics all at 0 → 100', () => {
    const r = scorer.score(
      'symmetry',
      [
        baseMetric({ metricId: 'm1' }),
        baseMetric({ metricId: 'm2' }),
        baseMetric({ metricId: 'm3' }),
      ],
      [w('m1', 1), w('m2', 1), w('m3', 1)],
    );
    expect(r.score0to100).toBe(100);
  });
});

describe('RegionalScorer — at green-edge / yellow', () => {
  it('deviation=1.0 → quality=0 → score=0', () => {
    const r = scorer.score(
      'symmetry',
      [baseMetric({ deviationNormalized: 1.0 })],
      [w('m1', 1)],
    );
    expect(r.score0to100).toBe(0);
  });

  it('deviation=0.5 → quality=0.5 → score=50', () => {
    const r = scorer.score(
      'symmetry',
      [baseMetric({ deviationNormalized: 0.5 })],
      [w('m1', 1)],
    );
    expect(r.score0to100).toBe(50);
  });

  it('deviation=2.0 (clipped) → score=0', () => {
    const r = scorer.score(
      'symmetry',
      [baseMetric({ deviationNormalized: 2.0 })],
      [w('m1', 1)],
    );
    expect(r.score0to100).toBe(0);
  });

  it('deviation=-0.3 (sign-agnostic) → quality=0.7 → 70', () => {
    const r = scorer.score(
      'symmetry',
      [baseMetric({ deviationNormalized: -0.3 })],
      [w('m1', 1)],
    );
    expect(r.score0to100).toBe(70);
  });
});

describe('RegionalScorer — weighted aggregation', () => {
  it('higher weight pulls score toward heavy metric', () => {
    const r = scorer.score(
      'symmetry',
      [
        baseMetric({ metricId: 'good', deviationNormalized: 0.0 }), // q=1.0
        baseMetric({ metricId: 'bad', deviationNormalized: 1.0 }),  // q=0.0
      ],
      [w('good', 3), w('bad', 1)],
    );
    // (1*3*1 + 0*1*1) / (3*1 + 1*1) * 100 = 75
    expect(r.score0to100).toBe(75);
    expect(r.contributingMetricIds.sort()).toEqual(['bad', 'good']);
  });

  it('missing weight defaults to 1.0', () => {
    const r = scorer.score(
      'symmetry',
      [baseMetric({ metricId: 'unknown', deviationNormalized: 0.0 })],
      [],
    );
    expect(r.score0to100).toBe(100);
  });

  it('zero weight → metric skipped', () => {
    const r = scorer.score(
      'symmetry',
      [
        baseMetric({ metricId: 'a', deviationNormalized: 0.0 }),
        baseMetric({ metricId: 'b', deviationNormalized: 1.0 }),
      ],
      [w('a', 1), w('b', 0)],
    );
    expect(r.contributingMetricIds).toEqual(['a']);
    expect(r.score0to100).toBe(100);
  });
});

describe('RegionalScorer — confidence weighting', () => {
  it('low confidence (but >= 0.4) reduces influence', () => {
    const r = scorer.score(
      'symmetry',
      [
        baseMetric({ metricId: 'high', deviationNormalized: 0.0, confidenceFinal: 1.0 }), // q=1
        baseMetric({ metricId: 'low', deviationNormalized: 1.0, confidenceFinal: 0.5 }),  // q=0
      ],
      [w('high', 1), w('low', 1)],
    );
    // (1*1*1 + 0*1*0.5) / (1*1 + 1*0.5) * 100 = 1/1.5*100 ≈ 66.667
    expect(r.score0to100).toBeCloseTo(66.667, 2);
  });

  it('confidence_aggregate is weighted-mean of confidence_final', () => {
    const r = scorer.score(
      'symmetry',
      [
        baseMetric({ metricId: 'a', confidenceFinal: 0.8 }),
        baseMetric({ metricId: 'b', confidenceFinal: 0.6 }),
      ],
      [w('a', 1), w('b', 1)],
    );
    // (1*0.8 + 1*0.6) / (1 + 1) = 0.7
    expect(r.confidenceAggregate).toBeCloseTo(0.7, 4);
  });
});

describe('RegionalScorer — DEC-6 enforcement', () => {
  it('throws when a presentation_only metric appears in inputs', () => {
    expect(() =>
      scorer.score(
        'symmetry',
        [baseMetric({ metricId: 'phi', presentationOnly: true })],
        [w('phi', 1)],
      ),
    ).toThrowError(/presentation_only/);
  });
});

describe('RegionalScorer — custom min_confidence threshold', () => {
  it('respects custom threshold', () => {
    const r = scorer.score(
      'symmetry',
      [baseMetric({ confidenceFinal: 0.55 })],
      [w('m1', 1)],
      0.6, // higher threshold rejects this metric
    );
    expect(r.score0to100).toBeNull();
  });
});
