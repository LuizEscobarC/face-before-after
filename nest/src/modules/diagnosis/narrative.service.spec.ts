/**
 * PR-59 — NarrativeService unit tests.
 *
 * Test groups:
 *   1. Report not found              (1 test)
 *   2. Empty findings (all ideal)    (1 test)
 *   3. Top-3 selection by severity   (2 tests)
 *   4. Template rendering            (2 tests)
 *   5. Global score passthrough      (2 tests)
 *   6. Recommendations               (2 tests)
 *   7. DiagnosticPriorityService     (2 tests)
 *   8. Engine failure non-fatal      (1 test)
 *   9. Disclaimer always present     (1 test)
 *  10. Full response shape           (1 test)
 *                                  ─────────
 *                                    15 tests
 */
import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { NarrativeService } from './narrative.service.js';
import type { NarrativeResponseDto } from './narrative.service.js';
import type { RecommendationMatch } from './recommendation-engine.service.js';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers — fixture factories
// ──────────────────────────────────────────────────────────────────────────────

const BASE_GENERATED_AT = new Date('2025-03-01T12:00:00Z');
const REPORT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: REPORT_ID,
    sessionId: 'sess-001',
    generatedAt: BASE_GENERATED_AT,
    status: 'complete',
    qualityScore: 0.9,
    ...overrides,
  };
}

function makeGlobalScore(score: number | null = 78.5) {
  return score === null
    ? null
    : {
        id: 'gs-1',
        analysisReportId: REPORT_ID,
        score0to100: score,
        isDisplayable: true,
      };
}

function makeEval(id: string, metricId = 'midline_deviation') {
  return {
    id,
    metricId,
    analysisReportId: REPORT_ID,
    analysisReportGeneratedAt: BASE_GENERATED_AT,
    confidenceFinal: 0.9,
  };
}

function makeAgainstIdeal(id: string, evalId: string, severity5: string, directionPt = 'à direita') {
  return {
    id,
    metricEvaluationId: evalId,
    severity5,
    severity3: severity5 === 'extreme' || severity5 === 'strong' ? 'SEVERO'
               : severity5 === 'moderate' ? 'MODERADO' : 'LEVE',
    directionLabel: { 'pt-BR': directionPt },
    deviationNormalized: 0.4,
  };
}

function makeTemplate(metricId: string, severity: string) {
  return {
    id: `tpl-${metricId}-${severity}`,
    metricId,
    severity,
    size: 'medium',
    templatePt: 'O {metric_id} apresenta desvio de {deviation_pct}%.',
    placeholdersUsed: ['deviation_pct'],
  };
}

function makeMatch(id: string, rank = 1, category = 'lifestyle'): RecommendationMatch {
  return {
    recommendationId: id,
    score: 0.8,
    rank,
    triggeredByMetricEvaluationIds: ['eval-1'],
    requiresProfessional: false,
    professionalType: null,
    category,
    displayTextShortPt: `Texto curto ${id}`,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock builder
// ──────────────────────────────────────────────────────────────────────────────

type MockService = ReturnType<typeof buildService>;

function buildService(opts: {
  report?: ReturnType<typeof makeReport> | null;
  evals?: ReturnType<typeof makeEval>[];
  againstIdeals?: ReturnType<typeof makeAgainstIdeal>[];
  globalScore?: ReturnType<typeof makeGlobalScore>;
  template?: ReturnType<typeof makeTemplate> | null;
  engineMatches?: RecommendationMatch[];
  priorityMatches?: RecommendationMatch[];
  engineThrows?: boolean;
  priorityThrows?: boolean;
  rendererResult?: string;
}) {
  const {
    report = makeReport(),
    evals = [],
    againstIdeals = [],
    globalScore = makeGlobalScore(),
    template = null,
    engineMatches = [],
    priorityMatches = engineMatches,
    engineThrows = false,
    priorityThrows = false,
    rendererResult = 'texto renderizado',
  } = opts;

  // Repos
  const reportRepo = { findOne: vi.fn().mockResolvedValue(report) };
  const globalScoreRepo = { findOne: vi.fn().mockResolvedValue(globalScore) };
  const evalRepo = { find: vi.fn().mockResolvedValue(evals) };

  // evalAgainstIdealRepo uses createQueryBuilder
  const getMany = vi.fn().mockResolvedValue(againstIdeals);
  const where = vi.fn().mockReturnValue({ getMany });
  const evalAgainstIdealRepo = {
    createQueryBuilder: vi.fn().mockReturnValue({ where }),
  };

  const templateRepo = { findOne: vi.fn().mockResolvedValue(template) };

  // Unused by NarrativeService directly (used by sub-services which are mocked)
  const linkRepo = { find: vi.fn().mockResolvedValue([]) };
  const catalogRepo = { find: vi.fn().mockResolvedValue([]) };

  // Metric-definition repo backs getMetricLabel(); empty result → fallback to
  // metricId.replace(/_/g, ' '), which the fallback-sentence test asserts.
  const metricDefRepo = { find: vi.fn().mockResolvedValue([]) };

  // Sub-services
  const renderer = {
    render: vi.fn().mockReturnValue(rendererResult),
  };

  const recommendationEngine = {
    findForReport: engineThrows
      ? vi.fn().mockRejectedValue(new Error('engine error'))
      : vi.fn().mockResolvedValue(engineMatches),
  };

  const priorityService = {
    prioritize: priorityThrows
      ? vi.fn().mockRejectedValue(new Error('priority error'))
      : vi.fn().mockResolvedValue(priorityMatches),
  };

  const svc = new NarrativeService(
    renderer as any,
    recommendationEngine as any,
    priorityService as any,
    templateRepo as any,
    evalAgainstIdealRepo as any,
    evalRepo as any,
    reportRepo as any,
    globalScoreRepo as any,
    linkRepo as any,
    catalogRepo as any,
    metricDefRepo as any,
  );

  return { svc, reportRepo, globalScoreRepo, evalRepo, evalAgainstIdealRepo, templateRepo, renderer, recommendationEngine, priorityService, metricDefRepo };
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Report not found
// ──────────────────────────────────────────────────────────────────────────────

describe('NarrativeService — report not found', () => {
  it('throws NotFoundException when report is missing', async () => {
    const { svc } = buildService({ report: null });
    await expect(svc.narrativeForReport(REPORT_ID)).rejects.toThrow(NotFoundException);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 2. Empty findings
// ──────────────────────────────────────────────────────────────────────────────

describe('NarrativeService — empty findings', () => {
  it('returns empty findings array when all evals are ideal severity', async () => {
    const eval_ = makeEval('eval-1');
    const ai = makeAgainstIdeal('ai-1', 'eval-1', 'ideal');
    const { svc } = buildService({ evals: [eval_], againstIdeals: [ai] });
    const r = await svc.narrativeForReport(REPORT_ID);
    expect(r.findings).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 3. Top-3 finding selection
// ──────────────────────────────────────────────────────────────────────────────

describe('NarrativeService — top-3 finding selection', () => {
  it('picks the 3 most severe findings when more than 3 exist', async () => {
    const evals = ['e1','e2','e3','e4','e5'].map((id) => makeEval(id, `metric_${id}`));
    const severities = ['mild', 'extreme', 'strong', 'moderate', 'mild'];
    const ais = evals.map((e, i) => makeAgainstIdeal(`ai-${i}`, e.id, severities[i]));

    const { svc } = buildService({ evals, againstIdeals: ais });
    const r = await svc.narrativeForReport(REPORT_ID);

    // Should pick extreme, strong, moderate (top 3)
    expect(r.findings).toHaveLength(3);
    expect(r.findings[0].severity_5).toBe('extreme');
    expect(r.findings[1].severity_5).toBe('strong');
    expect(r.findings[2].severity_5).toBe('moderate');
  });

  it('returns fewer than 3 findings when fewer non-ideal evals exist', async () => {
    const evals = ['e1', 'e2'].map((id) => makeEval(id, `metric_${id}`));
    const ais = [
      makeAgainstIdeal('ai-1', 'e1', 'moderate'),
      makeAgainstIdeal('ai-2', 'e2', 'mild'),
    ];

    const { svc } = buildService({ evals, againstIdeals: ais });
    const r = await svc.narrativeForReport(REPORT_ID);
    expect(r.findings).toHaveLength(2);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 4. Template rendering
// ──────────────────────────────────────────────────────────────────────────────

describe('NarrativeService — template rendering', () => {
  it('uses medium template when one exists for the metric+severity', async () => {
    const eval_ = makeEval('e1', 'chin_height_ratio');
    const ai = makeAgainstIdeal('ai-1', 'e1', 'moderate');
    const tpl = makeTemplate('chin_height_ratio', 'moderate');

    const { svc, renderer } = buildService({
      evals: [eval_],
      againstIdeals: [ai],
      template: tpl,
      rendererResult: 'Texto do template renderizado.',
    });
    const r = await svc.narrativeForReport(REPORT_ID);

    expect(renderer.render).toHaveBeenCalled();
    expect(r.findings[0].narrative_text).toBe('Texto do template renderizado.');
  });

  it('uses fallback sentence when no template exists', async () => {
    const eval_ = makeEval('e1', 'jaw_width_ratio');
    const ai = makeAgainstIdeal('ai-1', 'e1', 'mild', 'mais larga');

    const { svc, renderer } = buildService({
      evals: [eval_],
      againstIdeals: [ai],
      template: null,
    });
    const r = await svc.narrativeForReport(REPORT_ID);

    expect(renderer.render).not.toHaveBeenCalled();
    // Fallback includes metric_id and severity
    expect(r.findings[0].narrative_text).toContain('jaw width ratio');
    expect(r.findings[0].narrative_text).toContain('leve');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 5. Global score passthrough
// ──────────────────────────────────────────────────────────────────────────────

describe('NarrativeService — global score', () => {
  it('passes global_score when present', async () => {
    const { svc } = buildService({ globalScore: makeGlobalScore(82.3) });
    const r = await svc.narrativeForReport(REPORT_ID);
    expect(r.global_score).toBe(82.3);
  });

  it('returns null global_score when no global_score row exists', async () => {
    const { svc } = buildService({ globalScore: null });
    const r = await svc.narrativeForReport(REPORT_ID);
    expect(r.global_score).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 6. Recommendations
// ──────────────────────────────────────────────────────────────────────────────

describe('NarrativeService — recommendations', () => {
  it('maps RecommendationMatch array to NarrativeRecommendationDto', async () => {
    const matches = [
      makeMatch('rec-A', 1, 'lifestyle'),
      makeMatch('rec-B', 2, 'exercise'),
    ];
    const { svc } = buildService({ engineMatches: matches, priorityMatches: matches });
    const r = await svc.narrativeForReport(REPORT_ID);

    expect(r.recommendations).toHaveLength(2);
    expect(r.recommendations[0].recommendation_id).toBe('rec-A');
    expect(r.recommendations[0].rank).toBe(1);
    expect(r.recommendations[0].category).toBe('lifestyle');
    expect(r.recommendations[0].display_text_short_pt).toBe('Texto curto rec-A');
  });

  it('returns empty recommendations when RecommendationEngine returns none', async () => {
    const { svc } = buildService({ engineMatches: [], priorityMatches: [] });
    const r = await svc.narrativeForReport(REPORT_ID);
    expect(r.recommendations).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 7. DiagnosticPriorityService integration
// ──────────────────────────────────────────────────────────────────────────────

describe('NarrativeService — DiagnosticPriorityService', () => {
  it('calls prioritize with qualityScore from report when engine returns matches', async () => {
    const matches = [makeMatch('rec-A', 1)];
    const priorityMatches = [makeMatch('rec-X', 1, 'posture')];
    const { svc, priorityService } = buildService({
      report: makeReport({ qualityScore: 0.75 }),
      engineMatches: matches,
      priorityMatches,
    });
    const r = await svc.narrativeForReport(REPORT_ID);

    expect(priorityService.prioritize).toHaveBeenCalledWith(
      REPORT_ID,
      BASE_GENERATED_AT,
      0.75,
    );
    // Should use priorityService result, not engine result
    expect(r.recommendations[0].category).toBe('posture');
  });

  it('falls back to engine matches when DiagnosticPriorityService throws', async () => {
    const engineMatches = [makeMatch('rec-fallback', 1, 'lifestyle')];
    const { svc } = buildService({
      engineMatches,
      priorityThrows: true,
    });
    const r = await svc.narrativeForReport(REPORT_ID);
    // Should have the engine's baseline result since priority service threw
    expect(r.recommendations[0].recommendation_id).toBe('rec-fallback');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 8. RecommendationEngine failure is non-fatal
// ──────────────────────────────────────────────────────────────────────────────

describe('NarrativeService — engine failure non-fatal', () => {
  it('returns empty recommendations (not a thrown error) when engine throws', async () => {
    const eval_ = makeEval('e1', 'midline_deviation');
    const ai = makeAgainstIdeal('ai-1', 'e1', 'moderate');
    const { svc } = buildService({ evals: [eval_], againstIdeals: [ai], engineThrows: true });

    // Should not throw; still returns findings + disclaimer
    const r = await svc.narrativeForReport(REPORT_ID);
    expect(r.recommendations).toHaveLength(0);
    expect(r.findings).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 9. Disclaimer always present
// ──────────────────────────────────────────────────────────────────────────────

describe('NarrativeService — disclaimer', () => {
  it('always includes DEC-35 disclaimer text', async () => {
    const { svc } = buildService({});
    const r = await svc.narrativeForReport(REPORT_ID);
    expect(r.disclaimer).toContain('inteligência artificial');
    expect(r.disclaimer).toContain('Não substitui');
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// 10. Full response shape
// ──────────────────────────────────────────────────────────────────────────────

describe('NarrativeService — response shape', () => {
  it('returns all required top-level fields', async () => {
    const eval_ = makeEval('e1', 'brow_height_l');
    const ai = makeAgainstIdeal('ai-1', 'e1', 'mild');
    const matches = [makeMatch('rec-1', 1)];
    const { svc } = buildService({ evals: [eval_], againstIdeals: [ai], engineMatches: matches, priorityMatches: matches });

    const r: NarrativeResponseDto = await svc.narrativeForReport(REPORT_ID);

    expect(r.report_id).toBe(REPORT_ID);
    expect(r.generated_at).toBe(BASE_GENERATED_AT.toISOString());
    expect(typeof r.global_score === 'number' || r.global_score === null).toBe(true);
    expect(Array.isArray(r.findings)).toBe(true);
    expect(Array.isArray(r.recommendations)).toBe(true);
    expect(typeof r.disclaimer).toBe('string');
    expect(r.disclaimer.length).toBeGreaterThan(0);

    // Finding shape
    const f = r.findings[0];
    expect(typeof f.metric_id).toBe('string');
    expect(typeof f.narrative_text).toBe('string');

    // Recommendation shape
    const rec = r.recommendations[0];
    expect(typeof rec.recommendation_id).toBe('string');
    expect(typeof rec.rank).toBe('number');
    expect(typeof rec.score).toBe('number');
    expect(typeof rec.category).toBe('string');
    expect(typeof rec.display_text_short_pt).toBe('string');
  });
});
