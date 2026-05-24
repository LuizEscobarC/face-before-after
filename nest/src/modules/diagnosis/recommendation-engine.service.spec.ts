/**
 * PR-57 — RecommendationEngine invasiveness ladder rule unit tests.
 *
 * Tests focus exclusively on `_applyLadderRule`. No database involved.
 * Repos are passed as `null` — they are only used in `findForReport`,
 * not in the private method under test.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RecommendationEngine, type AccEntry } from './recommendation-engine.service.js';
import { RecommendationCatalogEntity } from './infrastructure/entities/recommendation-catalog.entity.js';
import { RecommendationCatalogVersionEntity } from './infrastructure/entities/recommendation-catalog-version.entity.js';

function makeCatalog(overrides: Partial<RecommendationCatalogEntity>): RecommendationCatalogEntity {
  return {
    id: 'rec-default',
    version: 'v1',
    category: 'lifestyle',
    displayTextShortPt: '',
    displayTextLongPt: '',
    priorityDefault: 3,
    effortEstimate: 'low',
    riskLevel: 0,
    requiresProfessional: false,
    professionalType: null,
    invasivenessLevel: 1,
    evidenceLevel: 'moderate',
    requiresAnecdotalDisclaimer: false,
    clinicalPathwayRequired: false,
    references: [],
    disclaimerTemplate: null,
    animationConfig: null,
    biometricConfig: null,
    createdAt: new Date(),
    triggers: [],
    links: [],
    catalogVersion: {} as RecommendationCatalogVersionEntity,
    ...overrides,
  } as RecommendationCatalogEntity;
}

function entry(catalog: RecommendationCatalogEntity, score: number): [string, AccEntry] {
  return [catalog.id, { score, triggeredBy: new Set(['eval-1']), catalog }];
}

describe('RecommendationEngine._applyLadderRule', () => {
  let engine: RecommendationEngine;

  beforeEach(() => {
    // Repos not needed — only testing the private pure method
    engine = new RecommendationEngine(
      null as any, null as any, null as any,
      null as any, null as any, null as any,
    );
  });

  const ladder = (sorted: Array<[string, AccEntry]>, extreme: boolean) =>
    (engine as any)._applyLadderRule(sorted, extreme);

  it('passes lifestyle entries through without modification', () => {
    const cat = makeCatalog({ id: 'a', category: 'lifestyle', invasivenessLevel: 1 });
    expect(ladder([entry(cat, 0.9)], false)).toHaveLength(1);
  });

  it('drops professional_referral when no extreme and clinicalPathwayRequired=false', () => {
    const pro = makeCatalog({ id: 'pro', category: 'professional_referral', invasivenessLevel: 4, clinicalPathwayRequired: false });
    const life = makeCatalog({ id: 'life', category: 'lifestyle', invasivenessLevel: 1 });
    const result: Array<[string, AccEntry]> = ladder([entry(pro, 0.99), entry(life, 0.5)], false);
    expect(result.map(([id]) => id)).not.toContain('pro');
    expect(result.map(([id]) => id)).toContain('life');
  });

  it('allows professional_referral when hasExtremeEval=true', () => {
    const pro = makeCatalog({ id: 'pro', category: 'professional_referral', invasivenessLevel: 4, clinicalPathwayRequired: false });
    const result: Array<[string, AccEntry]> = ladder([entry(pro, 0.99)], true);
    expect(result.map(([id]) => id)).toContain('pro');
  });

  it('allows professional_referral when clinicalPathwayRequired=true without extreme', () => {
    const pro = makeCatalog({ id: 'pro', category: 'professional_referral', invasivenessLevel: 4, clinicalPathwayRequired: true });
    const result: Array<[string, AccEntry]> = ladder([entry(pro, 0.99)], false);
    expect(result.map(([id]) => id)).toContain('pro');
  });

  it('enforces max 2 distinct categories', () => {
    const c1 = makeCatalog({ id: 'a', category: 'lifestyle', invasivenessLevel: 1 });
    const c2 = makeCatalog({ id: 'b', category: 'exercise', invasivenessLevel: 2 });
    const c3 = makeCatalog({ id: 'c', category: 'styling', invasivenessLevel: 3 });
    const result: Array<[string, AccEntry]> = ladder([entry(c1, 0.9), entry(c2, 0.8), entry(c3, 0.7)], false);
    const cats = new Set(result.map(([, e]) => e.catalog.category));
    expect(cats.size).toBeLessThanOrEqual(2);
  });

  it('sorts lower invasiveness first regardless of score', () => {
    const high = makeCatalog({ id: 'high', category: 'styling', invasivenessLevel: 3 });
    const low = makeCatalog({ id: 'low', category: 'lifestyle', invasivenessLevel: 1 });
    const result: Array<[string, AccEntry]> = ladder([entry(high, 0.99), entry(low, 0.1)], false);
    expect(result[0][0]).toBe('low');
  });

  it('within same invasiveness level, higher score comes first', () => {
    const a = makeCatalog({ id: 'a', category: 'lifestyle', invasivenessLevel: 1 });
    const b = makeCatalog({ id: 'b', category: 'lifestyle', invasivenessLevel: 1 });
    const result: Array<[string, AccEntry]> = ladder([entry(a, 0.5), entry(b, 0.9)], false);
    expect(result[0][0]).toBe('b');
  });

  it('returns at most 5 entries', () => {
    const entries = Array.from({ length: 10 }, (_, i) =>
      entry(makeCatalog({ id: `rec-${i}`, category: 'lifestyle', invasivenessLevel: 1 }), 1 - i * 0.05),
    );
    expect(ladder(entries, false)).toHaveLength(5);
  });
});
