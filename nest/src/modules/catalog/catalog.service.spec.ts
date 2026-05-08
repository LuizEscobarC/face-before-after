/**
 * Unit tests for CatalogService (PR-25).
 *
 * All TypeORM repository calls are mocked via vi.fn().
 *
 * Coverage:
 *  - listMetrics: all metrics, region filter, family filter, explicit version
 *  - getMetric: found with ideal, found without ideal, not found (NotFoundException)
 *  - listIdeals: all ideals, region filter, empty region, explicit version
 *  - getActiveVersions: all dimensions active, all null
 *  - getScoreBands: active config, null when none
 *  - listRegions: groups by region, counts per region
 *
 * Data source references:
 *   - metric_definition (66 rows), metric_ideal (59 rows)
 *   - Farkas LG (1994), Naini FB (2011), Powell & Humphreys (1984),
 *     Bashour M (2006), Sarver & Jacobson (2014), Edler RJ (2001)
 */

import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogService } from './catalog.service.js';

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

function makeMetricDef(overrides: Record<string, unknown> = {}) {
  return {
    metricId: 'jaw_mandibular_width',
    version: 'v1',
    family: 'jaw',
    region: 'jaw',
    unit: 'ratio',
    displayName: { 'pt-BR': 'Largura Mandibular', en: 'Mandibular Width' },
    presentationOnly: false,
    requiresPixelAnalysis: false,
    dependencyLandmarks: [234, 454],
    defaultWeightInRegion: 1.0,
    minConfidenceToDisplay: 0.4,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeMetricIdeal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ideal-uuid-001',
    metricId: 'jaw_mandibular_width',
    metricDefinitionVersion: 'v1',
    idealsVersion: 'v1.0',
    idealType: 'canonical',
    idealCentralValue: 1.3,
    greenRangeMin: 1.2,
    greenRangeMax: 1.4,
    yellowRangeMin: 1.1,
    yellowRangeMax: 1.5,
    directionLabelAbove: { 'pt-BR': 'largo demais', en: 'too wide' },
    directionLabelBelow: { 'pt-BR': 'estreito demais', en: 'too narrow' },
    populationReferenceNote: 'Farkas LG (1994) Anthropometric Facial Proportions',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeRegistryVersion(version = 'v1', isActive = true) {
  return { version, description: 'Metric registry v1', isActive, createdAt: new Date() };
}

function makeIdealsVersion(version = 'v1.0', isActive = true) {
  return { version, description: 'Ideals v1.0 — Farkas 1994 based', isActive, createdAt: new Date() };
}

function makeThresholdConfig() {
  return {
    version: 'v1',
    isActive: true,
    scoreBandNoNumberMax: 50.0,
    scoreBandRefineMax: 70.0,
    scoreBandGoodMax: 85.0,
    minConfidenceToDisplayMetric: 0.4,
    minConfidenceToShowGlobalScore: 0.5,
    disclaimerTextSnapshot: 'For informational purposes only.',
    createdAt: new Date(),
  };
}

function makeSeverityPolicy() {
  return {
    version: 'v1',
    isActive: true,
    mapping: { ideal: 'LEVE', mild: 'LEVE', moderate: 'MODERADO', strong: 'SEVERO', extreme: 'SEVERO' },
    createdAt: new Date(),
  };
}

function makeRegionWeightVersion() {
  return { version: 'v1.5', description: 'PR-21 v1.5 provisional', isActive: true, isProvisional: true, createdAt: new Date() };
}

function makeGlobalWeightVersion() {
  return { version: 'v1.5', description: 'PR-21 v1.5 provisional', isActive: true, isProvisional: true, criticalRegions: ['symmetry', 'eyes'], createdAt: new Date() };
}

// ---------------------------------------------------------------------------
// Mock repo factory
// ---------------------------------------------------------------------------

function makeRepo(defaults: Record<string, unknown> = {}) {
  return {
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    createQueryBuilder: vi.fn(),
    ...defaults,
  };
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function buildService(repoOverrides: {
  metricDefs?: ReturnType<typeof makeRepo>;
  metricIdeals?: ReturnType<typeof makeRepo>;
  metricRegistryVersions?: ReturnType<typeof makeRepo>;
  idealsVersions?: ReturnType<typeof makeRepo>;
  thresholdConfigs?: ReturnType<typeof makeRepo>;
  severityPolicies?: ReturnType<typeof makeRepo>;
  regionWeightVersions?: ReturnType<typeof makeRepo>;
  globalWeightVersions?: ReturnType<typeof makeRepo>;
} = {}) {
  const metricDefs = repoOverrides.metricDefs ?? makeRepo();
  const metricIdeals = repoOverrides.metricIdeals ?? makeRepo();
  const metricRegistryVersions = repoOverrides.metricRegistryVersions ?? makeRepo({
    findOne: vi.fn().mockResolvedValue(makeRegistryVersion()),
    find: vi.fn().mockResolvedValue([makeRegistryVersion()]),
  });
  const idealsVersions = repoOverrides.idealsVersions ?? makeRepo({
    findOne: vi.fn().mockResolvedValue(makeIdealsVersion()),
    find: vi.fn().mockResolvedValue([makeIdealsVersion()]),
  });
  const thresholdConfigs = repoOverrides.thresholdConfigs ?? makeRepo({
    findOne: vi.fn().mockResolvedValue(makeThresholdConfig()),
    find: vi.fn().mockResolvedValue([makeThresholdConfig()]),
  });
  const severityPolicies = repoOverrides.severityPolicies ?? makeRepo({
    findOne: vi.fn().mockResolvedValue(makeSeverityPolicy()),
    find: vi.fn().mockResolvedValue([makeSeverityPolicy()]),
  });
  const regionWeightVersions = repoOverrides.regionWeightVersions ?? makeRepo({
    findOne: vi.fn().mockResolvedValue(makeRegionWeightVersion()),
    find: vi.fn().mockResolvedValue([makeRegionWeightVersion()]),
  });
  const globalWeightVersions = repoOverrides.globalWeightVersions ?? makeRepo({
    findOne: vi.fn().mockResolvedValue(makeGlobalWeightVersion()),
    find: vi.fn().mockResolvedValue([makeGlobalWeightVersion()]),
  });

  // @ts-expect-error – injecting partial mocks
  return new CatalogService(
    metricDefs,
    metricIdeals,
    metricRegistryVersions,
    idealsVersions,
    thresholdConfigs,
    severityPolicies,
    regionWeightVersions,
    globalWeightVersions,
  );
}

// ---------------------------------------------------------------------------
// Tests: listMetrics
// ---------------------------------------------------------------------------

describe('CatalogService.listMetrics', () => {
  let metricDefs: ReturnType<typeof makeRepo>;
  let service: CatalogService;

  beforeEach(() => {
    metricDefs = makeRepo();
    // Stub createQueryBuilder chain
    const qbMock = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([makeMetricDef()]),
    };
    metricDefs.createQueryBuilder = vi.fn().mockReturnValue(qbMock);
    service = buildService({ metricDefs });
  });

  it('returns mapped metric definitions for active version', async () => {
    const result = await service.listMetrics({});
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].metric_id).toBe('jaw_mandibular_width');
    expect(result[0].region).toBe('jaw');
    expect(result[0].display_name['pt-BR']).toBe('Largura Mandibular');
  });

  it('passes region filter to query builder', async () => {
    await service.listMetrics({ region: 'jaw' });
    const qb = (metricDefs.createQueryBuilder as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(qb.andWhere).toHaveBeenCalledWith('md.region = :region', { region: 'jaw' });
  });

  it('passes family filter to query builder', async () => {
    await service.listMetrics({ family: 'fifths' });
    const qb = (metricDefs.createQueryBuilder as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(qb.andWhere).toHaveBeenCalledWith('md.family = :family', { family: 'fifths' });
  });

  it('uses explicit version when provided', async () => {
    const registryVersions = makeRepo({
      findOne: vi.fn().mockResolvedValue(makeRegistryVersion('v2', true)),
      find: vi.fn().mockResolvedValue([makeRegistryVersion('v2', true)]),
    });
    const svc = buildService({ metricDefs, metricRegistryVersions: registryVersions });

    const qbMock = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    };
    metricDefs.createQueryBuilder = vi.fn().mockReturnValue(qbMock);

    await svc.listMetrics({ version: 'v2' });
    expect(qbMock.where).toHaveBeenCalledWith('md.version = :version', { version: 'v2' });
  });

  it('throws NotFoundException when no active registry version', async () => {
    const registryVersions = makeRepo({
      findOne: vi.fn().mockResolvedValue(null),
    });
    const svc = buildService({ metricDefs, metricRegistryVersions: registryVersions });
    await expect(svc.listMetrics({})).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// Tests: getMetric
// ---------------------------------------------------------------------------

describe('CatalogService.getMetric', () => {
  it('returns metric + ideal when both exist', async () => {
    const metricDefs = makeRepo({
      findOne: vi.fn().mockResolvedValue(makeMetricDef()),
    });
    const metricIdeals = makeRepo({
      findOne: vi.fn().mockResolvedValue(makeMetricIdeal()),
    });
    const service = buildService({ metricDefs, metricIdeals });

    const result = await service.getMetric('jaw_mandibular_width');
    expect(result.metric.metric_id).toBe('jaw_mandibular_width');
    expect(result.ideal).not.toBeNull();
    expect(result.ideal!.ideal_central_value).toBe(1.3);
    expect(result.ideal!.population_reference_note).toContain('Farkas');
  });

  it('returns metric with null ideal when no ideal exists', async () => {
    const metricDefs = makeRepo({
      findOne: vi.fn().mockResolvedValue(makeMetricDef()),
    });
    const metricIdeals = makeRepo({
      findOne: vi.fn().mockResolvedValue(null),
    });
    const service = buildService({ metricDefs, metricIdeals });

    const result = await service.getMetric('jaw_mandibular_width');
    expect(result.metric.metric_id).toBe('jaw_mandibular_width');
    expect(result.ideal).toBeNull();
  });

  it('throws NotFoundException when metric does not exist', async () => {
    const metricDefs = makeRepo({ findOne: vi.fn().mockResolvedValue(null) });
    const service = buildService({ metricDefs });
    await expect(service.getMetric('nonexistent_metric')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns null ideal when no active ideals_version', async () => {
    const metricDefs = makeRepo({ findOne: vi.fn().mockResolvedValue(makeMetricDef()) });
    const idealsVersions = makeRepo({ findOne: vi.fn().mockResolvedValue(null) });
    const service = buildService({ metricDefs, idealsVersions });

    const result = await service.getMetric('jaw_mandibular_width');
    expect(result.ideal).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: listIdeals
// ---------------------------------------------------------------------------

describe('CatalogService.listIdeals', () => {
  it('returns all ideals for active version', async () => {
    const ideals = [makeMetricIdeal(), makeMetricIdeal({ metricId: 'nose_tip_projection' })];
    const metricIdeals = makeRepo({ find: vi.fn().mockResolvedValue(ideals) });
    const service = buildService({ metricIdeals });

    const result = await service.listIdeals({});
    expect(result).toHaveLength(2);
    expect(result[0].metric_id).toBe('jaw_mandibular_width');
  });

  it('returns empty array when no active ideals_version', async () => {
    const idealsVersions = makeRepo({ findOne: vi.fn().mockResolvedValue(null) });
    const service = buildService({ idealsVersions });

    const result = await service.listIdeals({});
    expect(result).toHaveLength(0);
  });

  it('filters by region: fetches metric IDs first, then ideals', async () => {
    const metricDefs = makeRepo({
      find: vi.fn().mockResolvedValue([makeMetricDef({ metricId: 'jaw_mandibular_width', region: 'jaw' })]),
    });
    const expectedIdeal = makeMetricIdeal();
    const metricIdeals = makeRepo({
      find: vi.fn().mockResolvedValue([expectedIdeal]),
    });
    const service = buildService({ metricDefs, metricIdeals });

    const result = await service.listIdeals({ region: 'jaw' });
    expect(result).toHaveLength(1);
    expect(result[0].metric_id).toBe('jaw_mandibular_width');
  });

  it('returns empty array when no metrics found in region', async () => {
    const metricDefs = makeRepo({
      find: vi.fn().mockResolvedValue([]),
    });
    const service = buildService({ metricDefs });

    const result = await service.listIdeals({ region: 'forehead' });
    expect(result).toHaveLength(0);
  });

  it('uses explicit version when provided', async () => {
    const idealsVersions = makeRepo({
      findOne: vi.fn().mockResolvedValue(makeIdealsVersion('v2.0')),
      find: vi.fn().mockResolvedValue([makeIdealsVersion('v2.0')]),
    });
    const ideals = [makeMetricIdeal({ idealsVersion: 'v2.0' })];
    const metricIdeals = makeRepo({ find: vi.fn().mockResolvedValue(ideals) });
    const service = buildService({ metricIdeals, idealsVersions });

    const result = await service.listIdeals({ version: 'v2.0' });
    expect(result[0].ideals_version).toBe('v2.0');
  });
});

// ---------------------------------------------------------------------------
// Tests: getActiveVersions
// ---------------------------------------------------------------------------

describe('CatalogService.getActiveVersions', () => {
  it('returns active version for all 6 dimensions', async () => {
    const service = buildService();
    const result = await service.getActiveVersions();

    expect(result.metric_registry_version?.version).toBe('v1');
    expect(result.ideals_version?.version).toBe('v1.0');
    expect(result.threshold_config_version?.version).toBe('v1');
    expect(result.severity_collapse_version?.version).toBe('v1');
    expect(result.region_metric_weights_version?.version).toBe('v1.5');
    expect(result.global_weights_version?.version).toBe('v1.5');
  });

  it('marks provisional versions correctly', async () => {
    const service = buildService();
    const result = await service.getActiveVersions();
    expect(result.region_metric_weights_version?.is_provisional).toBe(true);
    expect(result.global_weights_version?.is_provisional).toBe(true);
  });

  it('returns null for versions when no active record exists', async () => {
    const emptyRepo = makeRepo({ findOne: vi.fn().mockResolvedValue(null), find: vi.fn().mockResolvedValue([]) });
    const service = buildService({
      metricRegistryVersions: emptyRepo,
      idealsVersions: emptyRepo,
      thresholdConfigs: emptyRepo,
      severityPolicies: emptyRepo,
      regionWeightVersions: emptyRepo,
      globalWeightVersions: emptyRepo,
    });
    const result = await service.getActiveVersions();
    expect(result.metric_registry_version).toBeNull();
    expect(result.ideals_version).toBeNull();
    expect(result.threshold_config_version).toBeNull();
    expect(result.severity_collapse_version).toBeNull();
    expect(result.region_metric_weights_version).toBeNull();
    expect(result.global_weights_version).toBeNull();
  });

  it('includes all_versions lists for each dimension', async () => {
    const service = buildService();
    const result = await service.getActiveVersions();
    expect(Array.isArray(result.all_versions.metric_registry)).toBe(true);
    expect(Array.isArray(result.all_versions.ideals)).toBe(true);
    expect(result.all_versions.metric_registry[0].version).toBe('v1');
  });
});

// ---------------------------------------------------------------------------
// Tests: getScoreBands
// ---------------------------------------------------------------------------

describe('CatalogService.getScoreBands', () => {
  it('returns score band config from active threshold', async () => {
    const service = buildService();
    const result = await service.getScoreBands();
    expect(result).not.toBeNull();
    expect(result!.no_number_max).toBe(50.0);
    expect(result!.refine_max).toBe(70.0);
    expect(result!.good_max).toBe(85.0);
    expect(result!.version).toBe('v1');
    expect(result!.disclaimer_text_snapshot).toBe('For informational purposes only.');
  });

  it('returns null when no active threshold config', async () => {
    const thresholdConfigs = makeRepo({ findOne: vi.fn().mockResolvedValue(null) });
    const service = buildService({ thresholdConfigs });
    const result = await service.getScoreBands();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests: listRegions
// ---------------------------------------------------------------------------

describe('CatalogService.listRegions', () => {
  it('groups metrics by region and counts correctly', async () => {
    const metrics = [
      makeMetricDef({ metricId: 'jaw_mandibular_width', region: 'jaw' }),
      makeMetricDef({ metricId: 'jaw_chin_height', region: 'jaw' }),
      makeMetricDef({ metricId: 'eye_aperture_ratio_l', region: 'eyes', requiresPixelAnalysis: false }),
      makeMetricDef({ metricId: 'eye_texture_score', region: 'eyes', requiresPixelAnalysis: true }),
      makeMetricDef({ metricId: 'photo_blur_score', region: 'photo_quality', presentationOnly: true }),
    ];
    const metricDefs = makeRepo({ find: vi.fn().mockResolvedValue(metrics) });
    const service = buildService({ metricDefs });

    const result = await service.listRegions();
    const jaw = result.find((r) => r.region === 'jaw')!;
    const eyes = result.find((r) => r.region === 'eyes')!;
    const photoQuality = result.find((r) => r.region === 'photo_quality')!;

    expect(jaw.metric_count).toBe(2);
    expect(jaw.presentation_only_count).toBe(0);

    expect(eyes.requires_pixel_analysis_count).toBe(1);

    expect(photoQuality.presentation_only_count).toBe(1);
  });

  it('returns empty array when no metrics found', async () => {
    const metricDefs = makeRepo({ find: vi.fn().mockResolvedValue([]) });
    const service = buildService({ metricDefs });
    const result = await service.listRegions();
    expect(result).toHaveLength(0);
  });

  it('active_metrics array contains full metric dto', async () => {
    const metricDefs = makeRepo({ find: vi.fn().mockResolvedValue([makeMetricDef()]) });
    const service = buildService({ metricDefs });
    const result = await service.listRegions();
    expect(result[0].active_metrics[0].metric_id).toBe('jaw_mandibular_width');
    expect(result[0].active_metrics[0].family).toBe('jaw');
  });
});
