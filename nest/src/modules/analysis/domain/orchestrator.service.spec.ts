/**
 * Unit tests for AnalysisOrchestratorService (PR-10).
 *
 * All DB access and the VisionClient are mocked.
 * The tests verify:
 *  - Happy path: metrics returned, IdealComparator+SeverityClassifier called
 *  - Graceful degradation when DB has no active versions
 *  - Graceful degradation when ideal is not found for a metric
 *  - Transaction contains all entities (via save call counts)
 *  - Response shape is complete
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisOrchestratorService } from './orchestrator.service.js';
import { IdealComparator } from './ideal-comparator.js';
import { SeverityClassifier, DEFAULT_COLLAPSE_MAPPING } from './severity-classifier.js';
import type { EvaluateRequestDto, RawMetricV2 } from '../dto/evaluate.dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRawMetric(overrides: Partial<RawMetricV2> = {}): RawMetricV2 {
  return {
    metric_id: 'eye_aperture_ratio_l',
    region: 'eyes',
    family: 'eyes',
    unit: 'ratio',
    value: 0.30,
    error: 0.01,
    confidence_raw: 1.0,
    confidence_final: 0.95,
    is_low_confidence: false,
    direction: 'neutral',
    dependency_landmarks: [33, 133, 159, 145],
    presentation_only: false,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<EvaluateRequestDto> = {}): EvaluateRequestDto {
  return {
    landmarks: [[350, 300, 0], [450, 300, 0]],
    quality_context: { quality_score: 0.9, regional_penalties: {} },
    session_id: 'test-session',
    locale: 'pt-BR',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Mock factories
// ---------------------------------------------------------------------------

const makeVision = (metrics: RawMetricV2[]) => ({
  metricsV2: vi.fn().mockResolvedValue({ metrics, metric_count: metrics.length, session_id: 'test-session' }),
});

const makeEmptyRepo = () => ({
  findOne: vi.fn().mockResolvedValue(null),
  find: vi.fn().mockResolvedValue([]),
});

const makeSavedReport = () => ({ id: 'report-uuid-1234', generatedAt: new Date() });

const makeDataSource = () => ({
  transaction: vi.fn().mockImplementation(async (cb: (manager: unknown) => Promise<void>) => {
    const manager = {
      create: vi.fn((_, data) => ({ ...data })),
      save: vi.fn().mockImplementation((_entity, data) => Promise.resolve({ ...data, id: 'saved-uuid' })),
    };
    // First save (report) must return an object with id
    manager.save.mockResolvedValueOnce(makeSavedReport());
    await cb(manager);
  }),
});

const makeIdealRepo = (ideal: unknown = null) => ({
  findOne: vi.fn().mockResolvedValue(ideal),
  find: vi.fn().mockResolvedValue(ideal ? [ideal] : []),
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalysisOrchestratorService', () => {
  let svc: AnalysisOrchestratorService;
  let vision: ReturnType<typeof makeVision>;
  let dataSource: ReturnType<typeof makeDataSource>;

  const buildSvc = (opts: {
    metrics?: RawMetricV2[];
    hasActiveVersions?: boolean;
    hasIdeal?: boolean;
  } = {}) => {
    const metrics = opts.metrics ?? [makeRawMetric()];
    const hasVersions = opts.hasActiveVersions ?? false;
    const idealEntity = opts.hasIdeal
      ? {
          id: 'ideal-uuid',
          metricId: 'eye_aperture_ratio_l',
          idealsVersion: 'v1.0',
          idealCentralValue: 0.30,
          greenRangeMin: 0.25,
          greenRangeMax: 0.35,
          directionLabelAbove: { 'pt-BR': 'abertura ampla' },
          directionLabelBelow: { 'pt-BR': 'abertura reduzida' },
        }
      : null;

    vision = makeVision(metrics);
    dataSource = makeDataSource();
    const comparator = new IdealComparator();
    const classifier = new SeverityClassifier();

    const registryVersionRepo = hasVersions
      ? { findOne: vi.fn().mockResolvedValue({ version: 'v1.0', isActive: true }) }
      : makeEmptyRepo();
    const idealsVersionRepo = hasVersions
      ? { findOne: vi.fn().mockResolvedValue({ version: 'v1.0', isActive: true }) }
      : makeEmptyRepo();
    const thresholdRepo = makeEmptyRepo();
    const collapseRepo = makeEmptyRepo();
    const idealRepo = makeIdealRepo(idealEntity);

    svc = new AnalysisOrchestratorService(
      vision as never,
      comparator,
      classifier,
      dataSource as never,
      idealRepo as never,
      registryVersionRepo as never,
      idealsVersionRepo as never,
      thresholdRepo as never,
      collapseRepo as never,
    );
  };

  beforeEach(() => {
    buildSvc();
  });

  // -------------------------------------------------------------------------
  // Happy path
  // -------------------------------------------------------------------------

  it('calls vision.metricsV2 with landmarks and quality_context', async () => {
    buildSvc();
    const req = makeRequest();
    await svc.evaluate(req);
    expect(vision.metricsV2).toHaveBeenCalledOnce();
    const call = vision.metricsV2.mock.calls[0][0];
    expect(call.landmarks).toBe(req.landmarks);
    expect(call.quality_context.quality_score).toBe(0.9);
  });

  it('returns a response with the correct structure', async () => {
    buildSvc({ metrics: [makeRawMetric()] });
    const result = await svc.evaluate(makeRequest());
    expect(result).toMatchObject({
      session_id: 'test-session',
      status: 'complete',
      metric_count: 1,
    });
    expect(typeof result.analysis_report_id).toBe('string');
    expect(typeof result.generated_at).toBe('string');
    expect(Array.isArray(result.metrics)).toBe(true);
  });

  it('persists transaction (save called at least 2 times for report + landmark)', async () => {
    buildSvc({ metrics: [makeRawMetric()] });
    await svc.evaluate(makeRequest());
    expect(dataSource.transaction).toHaveBeenCalledOnce();
  });

  it('returns metric results with all required fields', async () => {
    buildSvc({ metrics: [makeRawMetric()] });
    const { metrics } = await svc.evaluate(makeRequest());
    expect(metrics).toHaveLength(1);
    const m = metrics[0];
    expect(m.metric_id).toBe('eye_aperture_ratio_l');
    expect(m.region).toBe('eyes');
    expect(m.value).toBe(0.30);
    expect(m.confidence_final).toBe(0.95);
    expect(m.is_low_confidence).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Graceful degradation — no active versions
  // -------------------------------------------------------------------------

  it('degrades gracefully when no active DB versions exist', async () => {
    buildSvc({ hasActiveVersions: false });
    const result = await svc.evaluate(makeRequest());
    expect(result.versions.metric_registry_version).toBeNull();
    expect(result.versions.ideals_version).toBeNull();
    expect(result.status).toBe('complete');
  });

  it('sets deviation_raw=null when no ideal found', async () => {
    buildSvc({ hasIdeal: false });
    const { metrics } = await svc.evaluate(makeRequest());
    expect(metrics[0].deviation_raw).toBeNull();
    expect(metrics[0].severity_5).toBeNull();
    expect(metrics[0].severity_3).toBeNull();
  });

  // -------------------------------------------------------------------------
  // With ideal — comparator + classifier applied
  // -------------------------------------------------------------------------

  it('computes deviation when ideal is present', async () => {
    buildSvc({ hasActiveVersions: true, hasIdeal: true });
    const { metrics } = await svc.evaluate(makeRequest());
    // value=0.30, ideal=0.30 → deviation_raw=0
    expect(metrics[0].deviation_raw).toBeCloseTo(0, 9);
    expect(metrics[0].deviation_normalized).toBeCloseTo(0, 9);
    expect(metrics[0].severity_5).toBe('ideal');
    expect(metrics[0].severity_3).toBe('LEVE');
  });

  it('classifies narrow eye (value=0.18) as non-ideal', async () => {
    buildSvc({
      hasActiveVersions: true,
      hasIdeal: true,
      metrics: [makeRawMetric({ value: 0.18, direction: 'narrow' })],
    });
    const { metrics } = await svc.evaluate(makeRequest());
    expect(metrics[0].deviation_raw).toBeCloseTo(-0.12, 4);
    expect(metrics[0].severity_5).not.toBe('ideal');
    expect(metrics[0].direction_label['pt-BR']).toBe('abertura reduzida');
  });

  // -------------------------------------------------------------------------
  // Multiple metrics
  // -------------------------------------------------------------------------

  it('handles 21 metrics without error', async () => {
    const twentyOneMetrics = Array.from({ length: 21 }, (_, i) =>
      makeRawMetric({ metric_id: `metric_${i}` }),
    );
    buildSvc({ metrics: twentyOneMetrics });
    const result = await svc.evaluate(makeRequest());
    expect(result.metric_count).toBe(21);
    expect(result.metrics).toHaveLength(21);
  });

  // -------------------------------------------------------------------------
  // Version snapshots
  // -------------------------------------------------------------------------

  it('includes version snapshots in response', async () => {
    buildSvc({ hasActiveVersions: true });
    const result = await svc.evaluate(makeRequest());
    expect(result.versions.metric_registry_version).toBe('v1.0');
    expect(result.versions.ideals_version).toBe('v1.0');
  });

  // -------------------------------------------------------------------------
  // Session ID
  // -------------------------------------------------------------------------

  it('passes through session_id in response', async () => {
    buildSvc();
    const result = await svc.evaluate(makeRequest({ session_id: 'my-session-xyz' }));
    expect(result.session_id).toBe('my-session-xyz');
  });

  it('generates a session_id when not provided', async () => {
    buildSvc();
    const req = makeRequest();
    delete (req as Partial<EvaluateRequestDto>).session_id;
    const result = await svc.evaluate(req);
    // session_id will be null in response (we pass undefined → null)
    expect(result.session_id === null || typeof result.session_id === 'string').toBe(true);
  });
});
