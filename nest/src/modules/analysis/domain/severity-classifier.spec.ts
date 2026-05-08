/**
 * Unit tests for SeverityClassifier (PR-9).
 *
 * All tests are pure — no NestJS bootstrap, no DB, no HTTP.
 */

import { describe, it, expect } from 'vitest';
import {
  SeverityClassifier,
  DEFAULT_COLLAPSE_MAPPING,
} from './severity-classifier.js';
import type { SeverityCollapseMapping } from '../infrastructure/entities/severity-collapse-policy.entity.js';

const clf = new SeverityClassifier();

// ---------------------------------------------------------------------------
// classify5 — boundary tests
// ---------------------------------------------------------------------------

describe('SeverityClassifier.classify5 — null input', () => {
  it('returns null when deviationNormalized is null', () => {
    expect(clf.classify5(null)).toBeNull();
  });
});

describe('SeverityClassifier.classify5 — ideal band [0, 1)', () => {
  it('0.0 → ideal', () => expect(clf.classify5(0.0)).toBe('ideal'));
  it('0.5 → ideal', () => expect(clf.classify5(0.5)).toBe('ideal'));
  it('0.99 → ideal', () => expect(clf.classify5(0.99)).toBe('ideal'));
  it('-0.5 → ideal', () => expect(clf.classify5(-0.5)).toBe('ideal'));
  it('-0.99 → ideal', () => expect(clf.classify5(-0.99)).toBe('ideal'));
});

describe('SeverityClassifier.classify5 — mild band [1, 2)', () => {
  it('1.0 → mild', () => expect(clf.classify5(1.0)).toBe('mild'));
  it('1.5 → mild', () => expect(clf.classify5(1.5)).toBe('mild'));
  it('1.99 → mild', () => expect(clf.classify5(1.99)).toBe('mild'));
  it('-1.0 → mild', () => expect(clf.classify5(-1.0)).toBe('mild'));
  it('-1.99 → mild', () => expect(clf.classify5(-1.99)).toBe('mild'));
});

describe('SeverityClassifier.classify5 — moderate band [2, 3.5)', () => {
  it('2.0 → moderate', () => expect(clf.classify5(2.0)).toBe('moderate'));
  it('3.0 → moderate', () => expect(clf.classify5(3.0)).toBe('moderate'));
  it('3.49 → moderate', () => expect(clf.classify5(3.49)).toBe('moderate'));
  it('-2.5 → moderate', () => expect(clf.classify5(-2.5)).toBe('moderate'));
});

describe('SeverityClassifier.classify5 — strong band [3.5, 5)', () => {
  it('3.5 → strong', () => expect(clf.classify5(3.5)).toBe('strong'));
  it('4.5 → strong', () => expect(clf.classify5(4.5)).toBe('strong'));
  it('4.99 → strong', () => expect(clf.classify5(4.99)).toBe('strong'));
  it('-4.0 → strong', () => expect(clf.classify5(-4.0)).toBe('strong'));
});

describe('SeverityClassifier.classify5 — extreme band [5, ∞)', () => {
  it('5.0 → extreme', () => expect(clf.classify5(5.0)).toBe('extreme'));
  it('10.0 → extreme', () => expect(clf.classify5(10.0)).toBe('extreme'));
  it('-5.0 → extreme', () => expect(clf.classify5(-5.0)).toBe('extreme'));
  it('-100 → extreme', () => expect(clf.classify5(-100)).toBe('extreme'));
});

// ---------------------------------------------------------------------------
// collapse — DEC-3 default mapping
// ---------------------------------------------------------------------------

describe('SeverityClassifier.collapse — default mapping (DEC-3)', () => {
  it('null → null', () => expect(clf.collapse(null)).toBeNull());
  it('ideal → LEVE', () => expect(clf.collapse('ideal')).toBe('LEVE'));
  it('mild → LEVE', () => expect(clf.collapse('mild')).toBe('LEVE'));
  it('moderate → MODERADO', () => expect(clf.collapse('moderate')).toBe('MODERADO'));
  it('strong → SEVERO', () => expect(clf.collapse('strong')).toBe('SEVERO'));
  it('extreme → SEVERO', () => expect(clf.collapse('extreme')).toBe('SEVERO'));
});

describe('SeverityClassifier.collapse — custom mapping', () => {
  const strictMapping: SeverityCollapseMapping = {
    ideal:    'LEVE',
    mild:     'MODERADO',
    moderate: 'SEVERO',
    strong:   'SEVERO',
    extreme:  'SEVERO',
  };

  it('mild → MODERADO with strict mapping', () =>
    expect(clf.collapse('mild', strictMapping)).toBe('MODERADO'));

  it('moderate → SEVERO with strict mapping', () =>
    expect(clf.collapse('moderate', strictMapping)).toBe('SEVERO'));
});

// ---------------------------------------------------------------------------
// classifyAndCollapse — convenience method
// ---------------------------------------------------------------------------

describe('SeverityClassifier.classifyAndCollapse', () => {
  it('null → {severity5: null, severity3: null}', () => {
    const r = clf.classifyAndCollapse(null);
    expect(r.severity5).toBeNull();
    expect(r.severity3).toBeNull();
  });

  it('0.0 → ideal / LEVE', () => {
    const r = clf.classifyAndCollapse(0.0);
    expect(r.severity5).toBe('ideal');
    expect(r.severity3).toBe('LEVE');
  });

  it('1.5 → mild / LEVE', () => {
    const r = clf.classifyAndCollapse(1.5);
    expect(r.severity5).toBe('mild');
    expect(r.severity3).toBe('LEVE');
  });

  it('2.5 → moderate / MODERADO', () => {
    const r = clf.classifyAndCollapse(2.5);
    expect(r.severity5).toBe('moderate');
    expect(r.severity3).toBe('MODERADO');
  });

  it('4.0 → strong / SEVERO', () => {
    const r = clf.classifyAndCollapse(4.0);
    expect(r.severity5).toBe('strong');
    expect(r.severity3).toBe('SEVERO');
  });

  it('6.0 → extreme / SEVERO', () => {
    const r = clf.classifyAndCollapse(6.0);
    expect(r.severity5).toBe('extreme');
    expect(r.severity3).toBe('SEVERO');
  });

  it('uses custom mapping when provided', () => {
    const strictMapping: SeverityCollapseMapping = {
      ideal:    'LEVE',
      mild:     'MODERADO',
      moderate: 'SEVERO',
      strong:   'SEVERO',
      extreme:  'SEVERO',
    };
    const r = clf.classifyAndCollapse(1.5, strictMapping);
    expect(r.severity5).toBe('mild');
    expect(r.severity3).toBe('MODERADO'); // strict: mild→MODERADO
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_COLLAPSE_MAPPING export
// ---------------------------------------------------------------------------

describe('DEFAULT_COLLAPSE_MAPPING', () => {
  it('has all 5 keys', () => {
    const keys = Object.keys(DEFAULT_COLLAPSE_MAPPING);
    expect(keys).toContain('ideal');
    expect(keys).toContain('mild');
    expect(keys).toContain('moderate');
    expect(keys).toContain('strong');
    expect(keys).toContain('extreme');
  });

  it('all values are valid Severity3', () => {
    const valid = new Set(['LEVE', 'MODERADO', 'SEVERO']);
    for (const v of Object.values(DEFAULT_COLLAPSE_MAPPING)) {
      expect(valid).toContain(v);
    }
  });
});
