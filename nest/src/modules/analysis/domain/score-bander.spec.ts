/**
 * Unit tests for ScoreBander (PR-12 / DEC-9).
 */
import { describe, it, expect } from 'vitest';
import { ScoreBander } from './score-bander.js';

const b = new ScoreBander();

describe('ScoreBander.band — null/NaN', () => {
  it('null → null', () => expect(b.band(null)).toBeNull());
  it('NaN → null', () => expect(b.band(Number.NaN)).toBeNull());
});

describe('ScoreBander.band — boundaries (DEC-9)', () => {
  it('0 → no_number', () => expect(b.band(0)).toBe('no_number'));
  it('49.999 → no_number', () => expect(b.band(49.999)).toBe('no_number'));
  it('50 → refine', () => expect(b.band(50)).toBe('refine'));
  it('69.999 → refine', () => expect(b.band(69.999)).toBe('refine'));
  it('70 → good', () => expect(b.band(70)).toBe('good'));
  it('84.999 → good', () => expect(b.band(84.999)).toBe('good'));
  it('85 → high', () => expect(b.band(85)).toBe('high'));
  it('100 → high', () => expect(b.band(100)).toBe('high'));
});
