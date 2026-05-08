/**
 * Unit tests for ReportReaderService (PR-24).
 *
 * All TypeORM repository calls are mocked via vi.fn().
 *
 * Coverage:
 *  - getReportById: happy path, not-found (NotFoundException), missing global score
 *  - listBySession: single report, multiple reports, empty result, limit forwarded
 *  - buildResponseDto: metric enrichment from MetricDefinitionEntity,
 *    fallback when definition is missing, against-ideal mapping
 */

import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReportReaderService } from './report-reader.service.js';

// ---------------------------------------------------------------------------
// Helpers / fixture factories
// ---------------------------------------------------------------------------

function makeReport(overrides: Record<string, unknown> = {}) {
  return {
    id: 'report-uuid-001',
    sessionId: 'session-abc',
    generatedAt: new Date('2025-01-15T10:00:00Z'),
    status: 'complete',
    qualityScore: 0.9,
    metricRegistryVersion: 'v1',
    idealsVersion: 'v1',
    thresholdConfigVersion: 'v1',
    severityCollapseVersion: 'v1',
    regionMetricWeightsVersion: 'v1.0',
    globalWeightsVersion: 'v1.0',
    ...overrides,
  };
}

function makeEval(id: string, metricId: string) {
  return {
    id,
    metricId,
    analysisReportId: 'report-uuid-001',
    analysisReportGeneratedAt: new Date('2025-01-15T10:00:00Z'),
    value: 0.3,
    confidenceRaw: 0.95,
    confidenceFinal: 0.92,
    isLowConfidence: false,
    direction: 'neutral',
    generatedAt: new Date('2025-01-15T10:00:00Z'),
    createdAt: new Date('2025-01-15T10:00:00Z'),
    error: null,
    displayable: true,
  };
}

function makeAgainstIdeal(metricEvaluationId: string) {
  return {
    id: `against-${metricEvaluationId}`,
    metricEvaluationId,
    metricEvaluationGeneratedAt: new Date('2025-01-15T10:00:00Z'),
    metricIdealId: 'ideal-uuid-01',
    deviationRaw: 0.05,
    deviationNormalized: 0.12,
    severity5: 'mild',
    severity3: 'LEVE',
    directionLabel: { 'pt-BR': 'ligeiramente acima' },
    createdAt: new Date('2025-01-15T10:00:00Z'),
  };
}

function makeRegionalScore(region: string) {
  return {
    id: `rs-${region}`,
    region,
    analysisReportId: 'report-uuid-001',
    analysisReportGeneratedAt: new Date('2025-01-15T10:00:00Z'),
    score0to100: 72.5,
    confidenceAggregate: 0.88,
    contributingMetricIds: ['eye_aperture_ratio_l'],
    weightsVersion: 'v1.0',
    createdAt: new Date('2025-01-15T10:00:00Z'),
  };
}

function makeGlobalScore() {
  return {
    id: 'gs-001',
    analysisReportId: 'report-uuid-001',
    analysisReportGeneratedAt: new Date('2025-01-15T10:00:00Z'),
    score0to100: 75.3,
    isDisplayable: true,
    band: 'good',
    regionalBreakdown: [
      { region: 'eyes', score_0_100: 72.5, weight: 0.2, confidence_aggregate: 0.88, contributed: true },
    ],
    globalWeightsVersion: 'v1.0',
    createdAt: new Date('2025-01-15T10:00:00Z'),
  };
}

function makeDefinition(metricId: string) {
  return {
    metricId,
    version: 'v1',
    region: 'eyes',
    family: 'eyes',
    unit: 'ratio',
  };
}

// ---------------------------------------------------------------------------
// Mock repository factories
// ---------------------------------------------------------------------------

function makeRepo(defaults: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    ...defaults,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ReportReaderService', () => {
  let service: ReportReaderService;
  let reportRepo: ReturnType<typeof makeRepo>;
  let evalRepo: ReturnType<typeof makeRepo>;
  let againstIdealRepo: ReturnType<typeof makeRepo>;
  let regionalRepo: ReturnType<typeof makeRepo>;
  let globalRepo: ReturnType<typeof makeRepo>;
  let definitionRepo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    reportRepo = makeRepo();
    evalRepo = makeRepo();
    againstIdealRepo = makeRepo();
    regionalRepo = makeRepo();
    globalRepo = makeRepo();
    definitionRepo = makeRepo();

    service = new ReportReaderService(
      reportRepo as never,
      evalRepo as never,
      againstIdealRepo as never,
      regionalRepo as never,
      globalRepo as never,
      definitionRepo as never,
    );
  });

  // ---------------------------------------------------------------------------
  // getReportById
  // ---------------------------------------------------------------------------

  describe('getReportById', () => {
    it('returns full EvaluateResponseDto for a valid report id', async () => {
      const report = makeReport();
      const ev = makeEval('eval-01', 'eye_aperture_ratio_l');
      const against = makeAgainstIdeal('eval-01');
      const rs = makeRegionalScore('eyes');
      const gs = makeGlobalScore();
      const def = makeDefinition('eye_aperture_ratio_l');

      reportRepo.findOne.mockResolvedValue(report);
      evalRepo.find.mockResolvedValue([ev]);
      againstIdealRepo.find.mockResolvedValue([against]);
      regionalRepo.find.mockResolvedValue([rs]);
      globalRepo.findOne.mockResolvedValue(gs);
      definitionRepo.find.mockResolvedValue([def]);

      const result = await service.getReportById('report-uuid-001');

      expect(result.analysis_report_id).toBe('report-uuid-001');
      expect(result.session_id).toBe('session-abc');
      expect(result.generated_at).toBe('2025-01-15T10:00:00.000Z');
      expect(result.status).toBe('complete');
      expect(result.quality_score).toBe(0.9);
      expect(result.metric_count).toBe(1);
      expect(result.metrics).toHaveLength(1);

      const m = result.metrics[0];
      expect(m.metric_id).toBe('eye_aperture_ratio_l');
      expect(m.region).toBe('eyes');
      expect(m.family).toBe('eyes');
      expect(m.unit).toBe('ratio');
      expect(m.value).toBe(0.3);
      expect(m.deviation_raw).toBe(0.05);
      expect(m.severity_5).toBe('mild');
      expect(m.severity_3).toBe('LEVE');
      expect(m.direction_label).toEqual({ 'pt-BR': 'ligeiramente acima' });

      expect(result.regional_scores).toHaveLength(1);
      expect(result.regional_scores[0].region).toBe('eyes');
      expect(result.regional_scores[0].score_0_100).toBe(72.5);

      expect(result.global_score.score_0_100).toBe(75.3);
      expect(result.global_score.band).toBe('good');
      expect(result.global_score.is_displayable).toBe(true);

      expect(result.versions.metric_registry_version).toBe('v1');
      expect(result.versions.region_metric_weights_version).toBe('v1.0');
    });

    it('throws NotFoundException when report does not exist', async () => {
      reportRepo.findOne.mockResolvedValue(null);

      await expect(service.getReportById('nonexistent-id')).rejects.toThrow(NotFoundException);
    });

    it('returns null-safe global_score when no global score row exists', async () => {
      const report = makeReport();
      reportRepo.findOne.mockResolvedValue(report);
      evalRepo.find.mockResolvedValue([]);
      againstIdealRepo.find.mockResolvedValue([]);
      regionalRepo.find.mockResolvedValue([]);
      globalRepo.findOne.mockResolvedValue(null);
      definitionRepo.find.mockResolvedValue([]);

      const result = await service.getReportById('report-uuid-001');

      expect(result.global_score.score_0_100).toBeNull();
      expect(result.global_score.is_displayable).toBe(false);
      expect(result.global_score.band).toBeNull();
      expect(result.global_score.regional_breakdown).toEqual([]);
    });

    it('falls back to unknown region/family/unit when no definition found', async () => {
      const report = makeReport();
      const ev = makeEval('eval-02', 'some_unknown_metric');
      reportRepo.findOne.mockResolvedValue(report);
      evalRepo.find.mockResolvedValue([ev]);
      againstIdealRepo.find.mockResolvedValue([]);
      regionalRepo.find.mockResolvedValue([]);
      globalRepo.findOne.mockResolvedValue(null);
      definitionRepo.find.mockResolvedValue([]); // no definition

      const result = await service.getReportById('report-uuid-001');

      const m = result.metrics[0];
      expect(m.region).toBe('unknown');
      expect(m.family).toBe('unknown');
      expect(m.unit).toBe('unknown');
    });

    it('sets deviation/severity fields to null when no against-ideal row exists', async () => {
      const report = makeReport();
      const ev = makeEval('eval-03', 'eye_aperture_ratio_l');
      reportRepo.findOne.mockResolvedValue(report);
      evalRepo.find.mockResolvedValue([ev]);
      againstIdealRepo.find.mockResolvedValue([]); // no against-ideal
      regionalRepo.find.mockResolvedValue([]);
      globalRepo.findOne.mockResolvedValue(null);
      definitionRepo.find.mockResolvedValue([makeDefinition('eye_aperture_ratio_l')]);

      const result = await service.getReportById('report-uuid-001');

      const m = result.metrics[0];
      expect(m.deviation_raw).toBeNull();
      expect(m.deviation_normalized).toBeNull();
      expect(m.severity_5).toBeNull();
      expect(m.severity_3).toBeNull();
      expect(m.direction_label).toEqual({});
    });

    it('queries child tables with partition-key generatedAt', async () => {
      const report = makeReport();
      reportRepo.findOne.mockResolvedValue(report);
      evalRepo.find.mockResolvedValue([]);
      againstIdealRepo.find.mockResolvedValue([]);
      regionalRepo.find.mockResolvedValue([]);
      globalRepo.findOne.mockResolvedValue(null);
      definitionRepo.find.mockResolvedValue([]);

      await service.getReportById('report-uuid-001');

      // Child queries must include generatedAt for partition pruning.
      expect(evalRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            analysisReportGeneratedAt: report.generatedAt,
          }),
        }),
      );
      expect(regionalRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            analysisReportGeneratedAt: report.generatedAt,
          }),
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // listBySession
  // ---------------------------------------------------------------------------

  describe('listBySession', () => {
    it('returns empty array when session has no reports', async () => {
      reportRepo.find.mockResolvedValue([]);

      const result = await service.listBySession('unknown-session');

      expect(result).toEqual([]);
    });

    it('returns mapped DTOs for each report in the session', async () => {
      const r1 = makeReport({ id: 'rpt-1', sessionId: 'sess-xyz' });
      const r2 = makeReport({ id: 'rpt-2', sessionId: 'sess-xyz', generatedAt: new Date('2025-01-16T10:00:00Z') });

      reportRepo.find.mockResolvedValue([r1, r2]);
      // Child repos return empty for both (minimal happy path)
      evalRepo.find.mockResolvedValue([]);
      againstIdealRepo.find.mockResolvedValue([]);
      regionalRepo.find.mockResolvedValue([]);
      globalRepo.findOne.mockResolvedValue(null);
      definitionRepo.find.mockResolvedValue([]);

      const result = await service.listBySession('sess-xyz');

      expect(result).toHaveLength(2);
      expect(result[0].analysis_report_id).toBe('rpt-1');
      expect(result[1].analysis_report_id).toBe('rpt-2');
    });

    it('forwards limit to repository find', async () => {
      reportRepo.find.mockResolvedValue([]);

      await service.listBySession('session-abc', 25);

      expect(reportRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25 }),
      );
    });

    it('uses default limit of 10 when not provided', async () => {
      reportRepo.find.mockResolvedValue([]);

      await service.listBySession('session-abc');

      expect(reportRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it('orders results by generatedAt DESC', async () => {
      reportRepo.find.mockResolvedValue([]);

      await service.listBySession('session-abc');

      expect(reportRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { generatedAt: 'DESC' },
        }),
      );
    });
  });
});
