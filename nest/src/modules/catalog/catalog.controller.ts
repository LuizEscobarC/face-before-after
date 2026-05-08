/**
 * CatalogController — GET /v1/catalog/*
 *
 * Read-only catalog API for metric discovery and configuration inspection.
 *
 * All endpoints are unauthenticated (public catalog data) and are safe
 * to call from client-side applications for label rendering, ideal ranges,
 * and version provenance.
 *
 * Data sources referenced:
 *   - metric_definition      (66 rows, active version v1)
 *   - metric_ideal           (59 rows, active version v1.0)
 *   - metric_registry_version, ideals_version, analysis_threshold_config,
 *     severity_collapse_policy, region_metric_weights_version,
 *     global_weights_version
 *
 * Literature referenced in metric population_reference_note fields:
 *   - Farkas LG (1994) Anthropometric Facial Proportions in Medicine
 *   - Naini FB (2011) Facial Aesthetics: Concepts and Clinical Diagnosis
 *   - Powell N, Humphreys B (1984) Proportions of the Aesthetic Face
 *   - Bashour M (2006) An objective system for measuring facial attractiveness
 *   - Sarver DM, Jacobson RS (2014) The aesthetic dentofacial analysis
 *   - Edler RJ (2001) Background considerations to facial aesthetics
 */

import {
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';
import {
  ListIdealsQuery,
  ListMetricsQuery,
  METRIC_REGIONS,
} from './dto/catalog.dto.js';

@ApiTags('Catalog')
@Controller('v1/catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // -------------------------------------------------------------------------
  // GET /v1/catalog/metrics
  // -------------------------------------------------------------------------

  @Get('metrics')
  @ApiOperation({
    summary: 'List metric definitions',
    description:
      'Returns all metric definitions for the active (or requested) ' +
      'metric_registry_version. Filterable by region and family. ' +
      'Data source: metric_definition table (66 rows). ' +
      'Ideal values are NOT included — use GET /v1/catalog/metrics/:id or ' +
      'GET /v1/catalog/ideals for those.',
  })
  @ApiQuery({ name: 'region', required: false, enum: METRIC_REGIONS })
  @ApiQuery({ name: 'family', required: false, type: String })
  @ApiQuery({ name: 'version', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Array of metric definitions' })
  listMetrics(@Query() query: ListMetricsQuery) {
    return this.catalogService.listMetrics(query);
  }

  // -------------------------------------------------------------------------
  // GET /v1/catalog/metrics/:metricId
  // -------------------------------------------------------------------------

  @Get('metrics/:metricId')
  @ApiOperation({
    summary: 'Get single metric definition + active ideal',
    description:
      'Returns one metric_definition row plus its active ideal from ' +
      'metric_ideal (if available). Ideal ranges are sourced from Farkas (1994), ' +
      'Naini (2011), and published literature — see population_reference_note.',
  })
  @ApiParam({ name: 'metricId', description: 'Metric identifier (e.g. jaw_mandibular_width)' })
  @ApiQuery({ name: 'version', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Metric + ideal' })
  @ApiResponse({ status: 404, description: 'Metric not found in the requested version' })
  getMetric(
    @Param('metricId') metricId: string,
    @Query('version') version?: string,
  ) {
    return this.catalogService.getMetric(metricId, version);
  }

  // -------------------------------------------------------------------------
  // GET /v1/catalog/ideals
  // -------------------------------------------------------------------------

  @Get('ideals')
  @ApiOperation({
    summary: 'List all metric ideals',
    description:
      'Returns all metric_ideal rows for the active (or requested) ' +
      'ideals_version. Filterable by region. ' +
      'Data source: metric_ideal table (59 rows). ' +
      'Sources per metric in population_reference_note: Farkas 1994, Naini 2011, ' +
      'Powell & Humphreys 1984, Bashour 2006, Sarver & Jacobson 2014, Edler 2001.',
  })
  @ApiQuery({ name: 'version', required: false, type: String })
  @ApiQuery({ name: 'region', required: false, enum: METRIC_REGIONS })
  @ApiResponse({ status: 200, description: 'Array of metric ideals' })
  listIdeals(@Query() query: ListIdealsQuery) {
    return this.catalogService.listIdeals(query);
  }

  // -------------------------------------------------------------------------
  // GET /v1/catalog/versions
  // -------------------------------------------------------------------------

  @Get('versions')
  @ApiOperation({
    summary: 'Get all active configuration versions',
    description:
      'Returns the active version for each of the 6 configuration dimensions: ' +
      'metric_registry, ideals, threshold_config, severity_collapse, ' +
      'region_metric_weights, global_weights. ' +
      'Also returns all historical versions for traceability. ' +
      'Provisional versions (is_provisional=true) are awaiting PR-22 real-photo calibration.',
  })
  @ApiResponse({ status: 200, description: 'Active and all-versions map' })
  getActiveVersions() {
    return this.catalogService.getActiveVersions();
  }

  // -------------------------------------------------------------------------
  // GET /v1/catalog/score-bands
  // -------------------------------------------------------------------------

  @Get('score-bands')
  @ApiOperation({
    summary: 'Get score band configuration',
    description:
      'Returns the active analysis_threshold_config: score band cutoffs ' +
      '(no_number / refine / good / high), confidence thresholds, and ' +
      'disclaimer text. ' +
      'Band mapping: ' +
      '0–50 = no_number, 50–70 = refine, 70–85 = good, 85–100 = high. ' +
      'Sources: Bashour (2006) percentile mapping + DEC-9 calibration.',
  })
  @ApiResponse({ status: 200, description: 'Score band configuration' })
  @ApiResponse({ status: 404, description: 'No active threshold configuration found' })
  getScoreBands() {
    return this.catalogService.getScoreBands();
  }

  // -------------------------------------------------------------------------
  // GET /v1/catalog/regions
  // -------------------------------------------------------------------------

  @Get('regions')
  @ApiOperation({
    summary: 'List metric regions with counts',
    description:
      'Returns one entry per region with metric count, presentation_only count, ' +
      'and requires_pixel_analysis count. ' +
      'Useful for frontend region selector and coverage overview. ' +
      'Regions: eyes, brows, nose, mouth, jaw, chin, midface, cheeks, ' +
      'forehead, global, symmetry, photo_quality.',
  })
  @ApiResponse({ status: 200, description: 'Region summaries with active metrics' })
  listRegions() {
    return this.catalogService.listRegions();
  }
}
