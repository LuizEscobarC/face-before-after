/**
 * Unit tests for GlobalScorer (PR-12 / M2 first slice).
 */
import { describe, it, expect } from 'vitest';
import { GlobalScorer } from './global-scorer.js';
import { ScoreBander } from './score-bander.js';
import type { RegionalScoreResult } from './regional-scorer.js';

const scorer = new GlobalScorer(new ScoreBander());

const region = (
  name: string,
  score: number | null,
  conf: number | null,
  ids: string[] = [],
): RegionalScoreResult => ({
  region: name,
  score0to100: score,
  confidenceAggregate: conf,
  contributingMetricIds: ids,
});

describe('GlobalScorer — happy path', () => {
  it('two regions weighted', () => {
    const r = scorer.score(
      [region('symmetry', 80, 0.9), region('eyes', 60, 0.9)],
      [{ region: 'symmetry', weight: 0.65 }, { region: 'eyes', weight: 0.35 }],
      ['symmetry', 'eyes'],
    );
    // 80 * 0.65 + 60 * 0.35 = 52 + 21 = 73
    expect(r.score0to100).toBeCloseTo(73, 3);
    expect(r.isDisplayable).toBe(true);
    expect(r.band).toBe('good');
    expect(r.regionalBreakdown).toHaveLength(2);
    for (const e of r.regionalBreakdown) {
      expect(e.contributed).toBe(true);
    }
  });

  it('returns no_number band for low score', () => {
    const r = scorer.score(
      [region('symmetry', 30, 0.9), region('eyes', 40, 0.9)],
      [{ region: 'symmetry', weight: 0.65 }, { region: 'eyes', weight: 0.35 }],
      ['symmetry', 'eyes'],
    );
    expect(r.score0to100).toBeLessThan(50);
    expect(r.band).toBe('no_number');
    expect(r.isDisplayable).toBe(true);
  });
});

describe('GlobalScorer — DEC-8 critical-region gating', () => {
  it('null when a critical region is missing', () => {
    const r = scorer.score(
      [region('symmetry', 80, 0.9)],
      [{ region: 'symmetry', weight: 0.65 }, { region: 'eyes', weight: 0.35 }],
      ['symmetry', 'eyes'],
    );
    expect(r.score0to100).toBeNull();
    expect(r.isDisplayable).toBe(false);
    expect(r.band).toBeNull();
  });

  it('null when a critical region has confidence < 0.5', () => {
    const r = scorer.score(
      [region('symmetry', 80, 0.9), region('eyes', 60, 0.45)],
      [{ region: 'symmetry', weight: 0.65 }, { region: 'eyes', weight: 0.35 }],
      ['symmetry', 'eyes'],
    );
    expect(r.score0to100).toBeNull();
    expect(r.isDisplayable).toBe(false);
  });

  it('null when a critical region has confidence_aggregate=null', () => {
    const r = scorer.score(
      [region('symmetry', 80, 0.9), region('eyes', null, null)],
      [{ region: 'symmetry', weight: 0.65 }, { region: 'eyes', weight: 0.35 }],
      ['symmetry', 'eyes'],
    );
    expect(r.score0to100).toBeNull();
  });

  it('passes when no critical regions defined', () => {
    const r = scorer.score(
      [region('symmetry', 80, 0.3)], // low conf
      [{ region: 'symmetry', weight: 1.0 }],
      [],
    );
    expect(r.score0to100).toBe(80);
    expect(r.isDisplayable).toBe(true);
  });

  it('respects custom critical confidence floor', () => {
    const r = scorer.score(
      [region('symmetry', 80, 0.6), region('eyes', 60, 0.55)],
      [{ region: 'symmetry', weight: 0.5 }, { region: 'eyes', weight: 0.5 }],
      ['symmetry', 'eyes'],
      0.7, // raise floor
    );
    expect(r.score0to100).toBeNull();
  });
});

describe('GlobalScorer — null region scores', () => {
  it('skips region whose score is null but counts it in breakdown', () => {
    const r = scorer.score(
      [region('symmetry', 80, 0.9), region('eyes', null, 0.9)],
      [{ region: 'symmetry', weight: 0.65 }, { region: 'eyes', weight: 0.35 }],
      ['symmetry', 'eyes'],
    );
    // only symmetry contributes → 80
    expect(r.score0to100).toBe(80);
    const eyes = r.regionalBreakdown.find((b) => b.region === 'eyes');
    expect(eyes?.contributed).toBe(false);
  });

  it('null when no region contributes (all scores null)', () => {
    const r = scorer.score(
      [region('symmetry', null, 0.9), region('eyes', null, 0.9)],
      [{ region: 'symmetry', weight: 0.65 }, { region: 'eyes', weight: 0.35 }],
      ['symmetry', 'eyes'],
    );
    expect(r.score0to100).toBeNull();
    expect(r.isDisplayable).toBe(false);
  });
});

describe('GlobalScorer — banding integration', () => {
  it('high band for excellent score', () => {
    const r = scorer.score(
      [region('symmetry', 95, 0.9), region('eyes', 90, 0.9)],
      [{ region: 'symmetry', weight: 0.5 }, { region: 'eyes', weight: 0.5 }],
      ['symmetry', 'eyes'],
    );
    expect(r.band).toBe('high');
  });

  it('refine band for borderline', () => {
    const r = scorer.score(
      [region('symmetry', 60, 0.9), region('eyes', 60, 0.9)],
      [{ region: 'symmetry', weight: 0.5 }, { region: 'eyes', weight: 0.5 }],
      ['symmetry', 'eyes'],
    );
    expect(r.band).toBe('refine');
  });
});
