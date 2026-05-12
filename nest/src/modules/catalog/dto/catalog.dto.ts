/**
 * DTOs for GET /v1/catalog/* endpoints (PR-25).
 *
 * All response shapes are plain interfaces (no class-validator decorators
 * needed — these are outputs, not inputs).
 *
 * Sources / references embedded in population_reference_note per metric are
 * drawn from:
 *   - Farkas LG, Anthropometric Facial Proportions in Medicine (1994)
 *   - Naini FB, Facial Aesthetics: Concepts and Clinical Diagnosis (2011)
 *   - Powell N, Humphreys B, Proportions of the Aesthetic Face (1984)
 *   - Bashour M, An objective system for measuring facial attractiveness (2006)
 *   - Sarver DM, Jacobson RS, The aesthetic dentofacial analysis (2014)
 *   - Edler RJ, Background considerations to facial aesthetics (2001)
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

// ---------------------------------------------------------------------------
// Query DTOs (inputs)
// ---------------------------------------------------------------------------

/** Valid metric region enum values — kept in sync with MetricDefinitionEntity. */
export const METRIC_REGIONS = [
  'eyes', 'brows', 'nose', 'mouth', 'jaw', 'chin',
  'midface', 'cheeks', 'forehead', 'global', 'symmetry', 'photo_quality',
] as const;

export type MetricRegion = (typeof METRIC_REGIONS)[number];

export class ListMetricsQuery {
  @ApiPropertyOptional({
    description: 'Filter by metric region (e.g. jaw, nose, eyes)',
    enum: METRIC_REGIONS,
  })
  @IsOptional()
  @IsString()
  @IsIn(METRIC_REGIONS)
  region?: MetricRegion;

  @ApiPropertyOptional({
    description: 'Filter by metric family (e.g. symmetry, fifths, jaw)',
  })
  @IsOptional()
  @IsString()
  family?: string;

  @ApiPropertyOptional({
    description: 'Metric registry version to query (default: active version)',
  })
  @IsOptional()
  @IsString()
  version?: string;
}

export class ListIdealsQuery {
  @ApiPropertyOptional({
    description: 'Ideals version to query (default: active version)',
  })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({
    description: 'Filter by metric region',
    enum: METRIC_REGIONS,
  })
  @IsOptional()
  @IsString()
  @IsIn(METRIC_REGIONS)
  region?: MetricRegion;
}

// ---------------------------------------------------------------------------
// Response DTOs (outputs)
// ---------------------------------------------------------------------------

export interface MetricDefinitionDto {
  metric_id: string;
  version: string;
  family: string;
  region: string;
  unit: string;
  display_name: Record<string, string>;
  presentation_only: boolean;
  requires_pixel_analysis: boolean;
  dependency_landmarks: number[];
  default_weight_in_region: number;
  min_confidence_to_display: number;
}

export interface MetricIdealDto {
  id: string;
  metric_id: string;
  metric_definition_version: string;
  ideals_version: string;
  ideal_type: string;
  ideal_central_value: number | null;
  green_range_min: number | null;
  green_range_max: number | null;
  yellow_range_min: number | null;
  yellow_range_max: number | null;
  direction_label_above: Record<string, string>;
  direction_label_below: Record<string, string>;
  /** Literature reference note. Links to Farkas 1994, Naini 2011, etc. */
  population_reference_note: string | null;
}

export interface MetricWithIdealDto {
  metric: MetricDefinitionDto;
  /** Active ideal for this metric (null if presentation_only or not yet calibrated). */
  ideal: MetricIdealDto | null;
}

// ---------------------------------------------------------------------------
// Version summary
// ---------------------------------------------------------------------------

export interface VersionEntryDto {
  version: string;
  description: string | null;
  is_active: boolean;
  is_provisional?: boolean;
  created_at: string;
}

export interface ActiveVersionsDto {
  /**
   * Active configuration versions as of this response.
   * References:
   *  - metric_registry_version: schema for metric definitions
   *  - ideals_version: calibration sources (Farkas 1994, Naini 2011, etc.)
   *  - threshold_config_version: DEC-7 confidence thresholds
   *  - severity_collapse_version: DEC-3 severity mapping
   *  - region_metric_weights_version: regional scoring weights
   *  - global_weights_version: global score composition (DEC-8 critical regions)
   */
  metric_registry_version: VersionEntryDto | null;
  ideals_version: VersionEntryDto | null;
  threshold_config_version: VersionEntryDto | null;
  severity_collapse_version: VersionEntryDto | null;
  region_metric_weights_version: VersionEntryDto | null;
  global_weights_version: VersionEntryDto | null;
  /** All known versions for each dimension (active + historical). */
  all_versions: {
    metric_registry: VersionEntryDto[];
    ideals: VersionEntryDto[];
    threshold_config: VersionEntryDto[];
    severity_collapse: VersionEntryDto[];
    region_metric_weights: VersionEntryDto[];
    global_weights: VersionEntryDto[];
  };
}

export interface ScoreBandConfigDto {
  /**
   * DEC-9 score band thresholds from active analysis_threshold_config.
   * Sources: clinical judgement + Bashour (2006) percentile mapping.
   */
  no_number_max: number;
  refine_max: number;
  good_max: number;
  min_confidence_to_display_metric: number;
  min_confidence_to_show_global_score: number;
  version: string;
  disclaimer_text_snapshot: string;
}

export interface RegionSummaryDto {
  region: string;
  metric_count: number;
  active_metrics: MetricDefinitionDto[];
  presentation_only_count: number;
  requires_pixel_analysis_count: number;
}

// ---------------------------------------------------------------------------
// Glossary (PR-66) — replaces frontend/src/data/{glossary,feynman}.ts
// ---------------------------------------------------------------------------

/** External reference link for a metric explainer. */
export interface MetricReferenceDto {
  titulo: string;
  url: string;
}

/**
 * Single glossary entry returned by GET /v1/catalog/glossary.
 *
 * One entry per metric_id (the i18n locale is fixed per request, defaults
 * to 'pt-BR'). Built by joining ``metric_definition`` with the optional
 * ``metric_content`` editorial table.
 *
 * Fields are nullable when no content has been seeded yet — UIs should
 * treat the fields as progressive disclosure: skip the section when null.
 */
export interface GlossaryEntryDto {
  metric_id: string;
  /** Localised metric label (matches metric_definition.display_name[locale]). */
  termo: string;
  /** Unit of measure (e.g. "graus (°)", "razão adimensional"). */
  unidade: string;
  /** Layer 1 — plain language analogy ("Feynman"). */
  feynman: string | null;
  /** Layer 2 — short technical description. */
  descricao: string | null;
  /** Layer 3 — measurement method. */
  como_medido: string | null;
  /** Layer 4 — typical value ranges. */
  faixas: string | null;
  /** Layer 5 — known caveats / failure modes. */
  problemas_comuns: string[];
  /** External references. */
  referencias: MetricReferenceDto[];
}

/** Response for GET /v1/catalog/glossary — keyed by metric_id. */
export type GlossaryResponseDto = Record<string, GlossaryEntryDto>;
