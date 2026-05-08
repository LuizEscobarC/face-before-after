/**
 * Shared enum literals mirroring Postgres ENUMs in 0001_catalogs.
 * Single source of truth on the TS side; entities import from here.
 */

export const METRIC_UNITS = [
  'px',
  'mm_normalized',
  'ratio',
  'intercanthal_units',
  'degrees',
  'percent',
  'index_0_1',
] as const;
export type MetricUnit = (typeof METRIC_UNITS)[number];

export const METRIC_REGIONS = [
  'eyes',
  'brows',
  'nose',
  'mouth',
  'jaw',
  'chin',
  'midface',
  'cheeks',
  'forehead',
  'global',
  'symmetry',
  'photo_quality',
] as const;
export type MetricRegion = (typeof METRIC_REGIONS)[number];

export const IDEAL_TYPES = [
  'canonical',
  'population_statistical',
  'presentation_only',
] as const;
export type IdealType = (typeof IDEAL_TYPES)[number];

export const SEVERITY_5 = [
  'ideal',
  'mild',
  'moderate',
  'strong',
  'extreme',
] as const;
export type Severity5 = (typeof SEVERITY_5)[number];

export const SEVERITY_3 = ['LEVE', 'MODERADO', 'SEVERO'] as const;
export type Severity3 = (typeof SEVERITY_3)[number];

/** i18n display name map: `{ "pt-BR": "Largura ocular", "en-US": "Eye width" }`. */
export type LocalizedText = Record<string, string>;
