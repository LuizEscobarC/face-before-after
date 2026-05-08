/**
 * CatalogService — read-only access to metric catalog data.
 *
 * Provides a stable, versioned API surface for:
 *   - Metric definitions  (metric_definition table, 66 rows)
 *   - Metric ideals       (metric_ideal table, 59 rows)
 *   - Active config versions across all 6 version dimensions
 *   - Score band thresholds
 *   - Region summaries
 *
 * Data sources:
 *   - DB tables: metric_definition, metric_registry_version, ideals_version,
 *     metric_ideal, analysis_threshold_config, severity_collapse_policy,
 *     region_metric_weights_version, global_weights_version
 *
 * Literature embedded in metric_ideal.population_reference_note:
 *   - Farkas LG (1994) Anthropometric Facial Proportions in Medicine
 *   - Naini FB (2011) Facial Aesthetics: Concepts and Clinical Diagnosis
 *   - Powell N, Humphreys B (1984) Proportions of the Aesthetic Face
 *   - Bashour M (2006) An objective system for measuring facial attractiveness
 *   - Sarver DM, Jacobson RS (2014) The aesthetic dentofacial analysis
 *   - Edler RJ (2001) Background considerations to facial aesthetics
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MetricDefinitionEntity } from '../analysis/infrastructure/entities/metric-definition.entity.js';
import { MetricIdealEntity } from '../analysis/infrastructure/entities/metric-ideal.entity.js';
import { MetricRegistryVersionEntity } from '../analysis/infrastructure/entities/metric-registry-version.entity.js';
import { IdealsVersionEntity } from '../analysis/infrastructure/entities/ideals-version.entity.js';
import { AnalysisThresholdConfigEntity } from '../analysis/infrastructure/entities/analysis-threshold-config.entity.js';
import { SeverityCollapsePolicyEntity } from '../analysis/infrastructure/entities/severity-collapse-policy.entity.js';
import { RegionMetricWeightsVersionEntity } from '../analysis/infrastructure/entities/region-metric-weights-version.entity.js';
import { GlobalWeightsVersionEntity } from '../analysis/infrastructure/entities/global-weights-version.entity.js';
import type {
  ActiveVersionsDto,
  ListIdealsQuery,
  ListMetricsQuery,
  MetricDefinitionDto,
  MetricIdealDto,
  MetricWithIdealDto,
  RegionSummaryDto,
  ScoreBandConfigDto,
  VersionEntryDto,
} from './dto/catalog.dto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMetricDto(e: MetricDefinitionEntity): MetricDefinitionDto {
  return {
    metric_id: e.metricId,
    version: e.version,
    family: e.family,
    region: e.region,
    unit: e.unit,
    display_name: e.displayName as Record<string, string>,
    presentation_only: e.presentationOnly,
    requires_pixel_analysis: e.requiresPixelAnalysis,
    dependency_landmarks: (e.dependencyLandmarks as number[]) ?? [],
    default_weight_in_region: e.defaultWeightInRegion,
    min_confidence_to_display: e.minConfidenceToDisplay,
  };
}

function toIdealDto(e: MetricIdealEntity): MetricIdealDto {
  return {
    id: e.id,
    metric_id: e.metricId,
    metric_definition_version: e.metricDefinitionVersion,
    ideals_version: e.idealsVersion,
    ideal_type: e.idealType,
    ideal_central_value: e.idealCentralValue,
    green_range_min: e.greenRangeMin,
    green_range_max: e.greenRangeMax,
    yellow_range_min: e.yellowRangeMin,
    yellow_range_max: e.yellowRangeMax,
    direction_label_above: e.directionLabelAbove as Record<string, string>,
    direction_label_below: e.directionLabelBelow as Record<string, string>,
    population_reference_note: e.populationReferenceNote,
  };
}

function toVersionEntry(
  e: { version: string; description: string | null; isActive: boolean; createdAt: Date; isProvisional?: boolean },
): VersionEntryDto {
  return {
    version: e.version,
    description: e.description,
    is_active: e.isActive,
    ...(e.isProvisional !== undefined ? { is_provisional: e.isProvisional } : {}),
    created_at: e.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(MetricDefinitionEntity)
    private readonly metricDefs: Repository<MetricDefinitionEntity>,

    @InjectRepository(MetricIdealEntity)
    private readonly metricIdeals: Repository<MetricIdealEntity>,

    @InjectRepository(MetricRegistryVersionEntity)
    private readonly metricRegistryVersions: Repository<MetricRegistryVersionEntity>,

    @InjectRepository(IdealsVersionEntity)
    private readonly idealsVersions: Repository<IdealsVersionEntity>,

    @InjectRepository(AnalysisThresholdConfigEntity)
    private readonly thresholdConfigs: Repository<AnalysisThresholdConfigEntity>,

    @InjectRepository(SeverityCollapsePolicyEntity)
    private readonly severityPolicies: Repository<SeverityCollapsePolicyEntity>,

    @InjectRepository(RegionMetricWeightsVersionEntity)
    private readonly regionWeightVersions: Repository<RegionMetricWeightsVersionEntity>,

    @InjectRepository(GlobalWeightsVersionEntity)
    private readonly globalWeightVersions: Repository<GlobalWeightsVersionEntity>,
  ) {}

  // -------------------------------------------------------------------------
  // listMetrics
  // -------------------------------------------------------------------------

  async listMetrics(query: ListMetricsQuery): Promise<MetricDefinitionDto[]> {
    // Resolve target version
    const version = await this._resolveMetricVersion(query.version);

    const qb = this.metricDefs
      .createQueryBuilder('md')
      .where('md.version = :version', { version })
      .orderBy('md.region', 'ASC')
      .addOrderBy('md.family', 'ASC')
      .addOrderBy('md.metric_id', 'ASC');

    if (query.region) {
      qb.andWhere('md.region = :region', { region: query.region });
    }
    if (query.family) {
      qb.andWhere('md.family = :family', { family: query.family });
    }

    const rows = await qb.getMany();
    return rows.map(toMetricDto);
  }

  // -------------------------------------------------------------------------
  // getMetric — single metric + active ideal
  // -------------------------------------------------------------------------

  async getMetric(
    metricId: string,
    queryVersion?: string,
  ): Promise<MetricWithIdealDto> {
    const version = await this._resolveMetricVersion(queryVersion);

    const metricDef = await this.metricDefs.findOne({
      where: { metricId, version },
    });

    if (!metricDef) {
      throw new NotFoundException(
        `Metric '${metricId}' not found in version '${version}'`,
      );
    }

    const activeIdealVersion = await this._resolveIdealVersion(undefined);
    const ideal = activeIdealVersion
      ? await this.metricIdeals.findOne({
          where: {
            metricId,
            metricDefinitionVersion: version,
            idealsVersion: activeIdealVersion,
          },
        })
      : null;

    return {
      metric: toMetricDto(metricDef),
      ideal: ideal ? toIdealDto(ideal) : null,
    };
  }

  // -------------------------------------------------------------------------
  // listIdeals
  // -------------------------------------------------------------------------

  async listIdeals(query: ListIdealsQuery): Promise<MetricIdealDto[]> {
    const idealsVersion = await this._resolveIdealVersion(query.version);
    if (!idealsVersion) return [];

    const metricVersion = await this._resolveMetricVersion(undefined);

    // If region filter, resolve matching metricIds first (avoids complex joins)
    let metricIdFilter: string[] | undefined;
    if (query.region) {
      const metricsInRegion = await this.metricDefs.find({
        where: { version: metricVersion, region: query.region as MetricDefinitionEntity['region'] },
        select: ['metricId'],
      });
      metricIdFilter = metricsInRegion.map((m) => m.metricId);
      if (metricIdFilter.length === 0) return [];
    }

    const rows = await this.metricIdeals.find({
      where: {
        idealsVersion,
        metricDefinitionVersion: metricVersion,
        ...(metricIdFilter ? { metricId: In(metricIdFilter) } : {}),
      },
      order: { metricId: 'ASC' },
    });
    return rows.map(toIdealDto);
  }

  // -------------------------------------------------------------------------
  // getActiveVersions
  // -------------------------------------------------------------------------

  async getActiveVersions(): Promise<ActiveVersionsDto> {
    const [
      metricRegistryList,
      idealsList,
      thresholdList,
      severityList,
      regionWeightsList,
      globalWeightsList,
    ] = await Promise.all([
      this.metricRegistryVersions.find({ order: { createdAt: 'DESC' } }),
      this.idealsVersions.find({ order: { createdAt: 'DESC' } }),
      this.thresholdConfigs.find({ order: { createdAt: 'DESC' } }),
      this.severityPolicies.find({ order: { createdAt: 'DESC' } }),
      this.regionWeightVersions.find({ order: { createdAt: 'DESC' } }),
      this.globalWeightVersions.find({ order: { createdAt: 'DESC' } }),
    ]);

    const active = <T extends { isActive: boolean }>(list: T[]): T | null =>
      list.find((v) => v.isActive) ?? null;

    return {
      metric_registry_version: active(metricRegistryList)
        ? toVersionEntry(active(metricRegistryList)!)
        : null,
      ideals_version: active(idealsList)
        ? toVersionEntry(active(idealsList)!)
        : null,
      threshold_config_version: active(thresholdList)
        ? toVersionEntry(active(thresholdList)!)
        : null,
      severity_collapse_version: active(severityList)
        ? toVersionEntry(active(severityList)!)
        : null,
      region_metric_weights_version: active(regionWeightsList)
        ? toVersionEntry(active(regionWeightsList)!)
        : null,
      global_weights_version: active(globalWeightsList)
        ? toVersionEntry(active(globalWeightsList)!)
        : null,
      all_versions: {
        metric_registry: metricRegistryList.map(toVersionEntry),
        ideals: idealsList.map(toVersionEntry),
        threshold_config: thresholdList.map(toVersionEntry),
        severity_collapse: severityList.map(toVersionEntry),
        region_metric_weights: regionWeightsList.map(toVersionEntry),
        global_weights: globalWeightsList.map(toVersionEntry),
      },
    };
  }

  // -------------------------------------------------------------------------
  // getScoreBands
  // -------------------------------------------------------------------------

  async getScoreBands(): Promise<ScoreBandConfigDto | null> {
    const active = await this.thresholdConfigs.findOne({
      where: { isActive: true },
    });
    if (!active) return null;
    return {
      version: active.version,
      no_number_max: active.scoreBandNoNumberMax,
      refine_max: active.scoreBandRefineMax,
      good_max: active.scoreBandGoodMax,
      min_confidence_to_display_metric: active.minConfidenceToDisplayMetric,
      min_confidence_to_show_global_score: active.minConfidenceToShowGlobalScore,
      disclaimer_text_snapshot: active.disclaimerTextSnapshot,
    };
  }

  // -------------------------------------------------------------------------
  // listRegions
  // -------------------------------------------------------------------------

  async listRegions(): Promise<RegionSummaryDto[]> {
    const version = await this._resolveMetricVersion(undefined);
    const all = await this.metricDefs.find({
      where: { version },
      order: { region: 'ASC', metricId: 'ASC' },
    });

    const byRegion = new Map<string, MetricDefinitionEntity[]>();
    for (const m of all) {
      const arr = byRegion.get(m.region) ?? [];
      arr.push(m);
      byRegion.set(m.region, arr);
    }

    const result: RegionSummaryDto[] = [];
    for (const [region, metrics] of byRegion.entries()) {
      result.push({
        region,
        metric_count: metrics.length,
        active_metrics: metrics.map(toMetricDto),
        presentation_only_count: metrics.filter((m) => m.presentationOnly).length,
        requires_pixel_analysis_count: metrics.filter((m) => m.requiresPixelAnalysis).length,
      });
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private async _resolveMetricVersion(explicit?: string): Promise<string> {
    if (explicit) return explicit;
    const active = await this.metricRegistryVersions.findOne({
      where: { isActive: true },
    });
    if (!active) throw new NotFoundException('No active metric_registry_version found');
    return active.version;
  }

  private async _resolveIdealVersion(explicit?: string): Promise<string | null> {
    if (explicit) return explicit;
    const active = await this.idealsVersions.findOne({
      where: { isActive: true },
    });
    return active?.version ?? null;
  }
}
