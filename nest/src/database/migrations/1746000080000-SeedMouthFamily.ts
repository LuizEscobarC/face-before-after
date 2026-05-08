/**
 * 0008 — Seed M2 mouth family (PR-15).
 *
 * Inserts 7 metric_definition + 7 metric_ideal + 7 region_metric_weight rows
 * for the mouth family. Frontal-only metrics (no profile/sagittal required).
 *
 * Substitutions vs original PLAN_M2_BACKLOG.md (frontal-only constraint &
 * Mesh-478 landmark availability):
 *   - mouth_width_ratio  → split into mouth_width_to_icd + mouth_to_face_width_ratio
 *     (mirrors PR-14 nose pattern: same numerator, different denominators).
 *   - lip_height_ratio_upper / _lower → upper_lip_height_ratio / lower_lip_height_ratio
 *     (renamed for consistency with PR-14 naming).
 *   - cupids_bow_definition (needs philtral peaks not stable on Mesh-478)
 *     → mouth_midline_deviation (frontal asymmetry of mouth centre vs midline).
 *   - philtrum_width_ratio   → DEFERRED to PR-23 (multi-photo / refined detector).
 *
 * Calibration sources:
 *   mouth_width_to_icd        → Naini (2011) ~1.5 (mouth ≈ 1.5 × ICD).
 *   mouth_to_face_width_ratio → Naini ~0.30 (mouth ≈ 30% of bizygomatic).
 *   upper/lower_lip_height_ratio → Naini U:L = 1:1.6 → upper = 0.385, round 0.40.
 *   vermilion_height_total    → Naini ~17 mm at ICD ~32 mm → ~0.53; adopted 0.55.
 *   lip_corner_canting / mouth_midline_deviation → canonical 0.
 *
 * Idempotent: ON CONFLICT DO NOTHING. Extends region_metric_weights v1.0
 * (does NOT bump version — bump deferred to PR-21).
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

type MetricDefinitionRow = {
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
};

const MOUTH_DEFINITIONS: MetricDefinitionRow[] = [
  {
    metric_id: 'mouth_width_to_icd',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Largura da Boca (em ICU)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [61, 291],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'mouth_to_face_width_ratio',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Largura da Boca / Largura da Face' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [61, 291, 234, 454],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'upper_lip_height_ratio',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Altura do Lábio Superior (proporção)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [82, 13, 14, 17],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'lower_lip_height_ratio',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Altura do Lábio Inferior (proporção)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [82, 13, 14, 17],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'vermilion_height_total',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Altura Total do Vermelhão Labial' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [82, 13, 14, 17],
    default_weight_in_region: 1.1,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'lip_corner_canting',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Inclinação dos Cantos da Boca' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [61, 291],
    default_weight_in_region: 1.3,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'mouth_midline_deviation',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Desvio da Boca em relação à Linha Média' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [61, 291],
    default_weight_in_region: 1.2,
    min_confidence_to_display: 0.4,
  },
];

type MetricIdealRow = {
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
  population_reference_note: string | null;
};

const MOUTH_IDEALS: MetricIdealRow[] = [
  {
    metric_id: 'mouth_width_to_icd',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 1.50,
    green_range_min: 1.35,
    green_range_max: 1.65,
    yellow_range_min: 1.20,
    yellow_range_max: 1.80,
    direction_label_above: { 'pt-BR': 'boca larga' },
    direction_label_below: { 'pt-BR': 'boca estreita' },
    population_reference_note:
      'Naini (2011): mouth width ≈ 1.5 × intercanthal distance, unified-sex.',
  },
  {
    metric_id: 'mouth_to_face_width_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.30,
    green_range_min: 0.26,
    green_range_max: 0.34,
    yellow_range_min: 0.22,
    yellow_range_max: 0.38,
    direction_label_above: { 'pt-BR': 'boca larga em relação à face' },
    direction_label_below: { 'pt-BR': 'boca estreita em relação à face' },
    population_reference_note:
      'Naini (2011): mouth ≈ 30% of bizygomatic width.',
  },
  {
    metric_id: 'upper_lip_height_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.40,
    green_range_min: 0.35,
    green_range_max: 0.45,
    yellow_range_min: 0.30,
    yellow_range_max: 0.50,
    direction_label_above: { 'pt-BR': 'lábio superior espesso' },
    direction_label_below: { 'pt-BR': 'lábio superior fino' },
    population_reference_note:
      'Naini (2011) U:L = 1:1.6 → upper / total = 0.385; adopted 0.40.',
  },
  {
    metric_id: 'lower_lip_height_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.60,
    green_range_min: 0.55,
    green_range_max: 0.65,
    yellow_range_min: 0.50,
    yellow_range_max: 0.70,
    direction_label_above: { 'pt-BR': 'lábio inferior espesso' },
    direction_label_below: { 'pt-BR': 'lábio inferior fino' },
    population_reference_note:
      'Complement of upper_lip_height_ratio (lower / total = 0.615 → 0.60).',
  },
  {
    metric_id: 'vermilion_height_total',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.55,
    green_range_min: 0.45,
    green_range_max: 0.65,
    yellow_range_min: 0.35,
    yellow_range_max: 0.75,
    direction_label_above: { 'pt-BR': 'lábios espessos' },
    direction_label_below: { 'pt-BR': 'lábios finos' },
    population_reference_note:
      'Naini (2011): total vermilion ~17 mm at ICD ~32 mm → ~0.53; adopted 0.55.',
  },
  {
    metric_id: 'lip_corner_canting',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.03,
    yellow_range_min: 0.0,
    yellow_range_max: 0.07,
    direction_label_above: { 'pt-BR': 'canto esquerdo mais baixo' },
    direction_label_below: { 'pt-BR': 'canto direito mais baixo' },
    population_reference_note: 'Canonical: ideal = 0 (lips perfectly level).',
  },
  {
    metric_id: 'mouth_midline_deviation',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.03,
    yellow_range_min: 0.0,
    yellow_range_max: 0.07,
    direction_label_above: { 'pt-BR': 'boca deslocada para a esquerda' },
    direction_label_below: { 'pt-BR': 'boca deslocada para a direita' },
    population_reference_note:
      'Canonical: ideal = 0 (mouth centred on facial midline).',
  },
];

const MOUTH_REGION_WEIGHTS: Array<{ metricId: string; weight: number }> = [
  { metricId: 'mouth_width_to_icd',         weight: 1.0 },
  { metricId: 'mouth_to_face_width_ratio',  weight: 1.0 },
  { metricId: 'upper_lip_height_ratio',     weight: 1.0 },
  { metricId: 'lower_lip_height_ratio',     weight: 1.0 },
  { metricId: 'vermilion_height_total',     weight: 1.1 },
  { metricId: 'lip_corner_canting',         weight: 1.3 },
  { metricId: 'mouth_midline_deviation',    weight: 1.2 },
];

export class SeedMouthFamily1746000080000 implements MigrationInterface {
  name = 'SeedMouthFamily1746000080000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of MOUTH_DEFINITIONS) {
      await queryRunner.query(
        `INSERT INTO metric_definition (
           metric_id, version, family, region, unit,
           display_name, presentation_only, requires_pixel_analysis,
           dependency_landmarks, default_weight_in_region, min_confidence_to_display
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6::jsonb, $7, $8,
           $9::jsonb, $10, $11
         ) ON CONFLICT (metric_id, version) DO NOTHING`,
        [
          row.metric_id,
          row.version,
          row.family,
          row.region,
          row.unit,
          JSON.stringify(row.display_name),
          row.presentation_only,
          row.requires_pixel_analysis,
          JSON.stringify(row.dependency_landmarks),
          row.default_weight_in_region,
          row.min_confidence_to_display,
        ],
      );
    }

    for (const row of MOUTH_IDEALS) {
      await queryRunner.query(
        `INSERT INTO metric_ideal (
           metric_id, metric_definition_version, ideals_version,
           ideal_type, ideal_central_value,
           green_range_min, green_range_max,
           yellow_range_min, yellow_range_max,
           direction_label_above, direction_label_below,
           population_reference_note
         ) VALUES (
           $1, $2, $3,
           $4::ideal_type_enum, $5,
           $6, $7,
           $8, $9,
           $10::jsonb, $11::jsonb,
           $12
         ) ON CONFLICT (metric_id, metric_definition_version, ideals_version) DO NOTHING`,
        [
          row.metric_id,
          row.metric_definition_version,
          row.ideals_version,
          row.ideal_type,
          row.ideal_central_value,
          row.green_range_min,
          row.green_range_max,
          row.yellow_range_min,
          row.yellow_range_max,
          JSON.stringify(row.direction_label_above),
          JSON.stringify(row.direction_label_below),
          row.population_reference_note,
        ],
      );
    }

    for (const w of MOUTH_REGION_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ($1, 'mouth', $2, $3)
           ON CONFLICT ON CONSTRAINT uq_region_metric_weight_version_region_metric DO NOTHING`,
        ['v1.0', w.metricId, w.weight],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = MOUTH_DEFINITIONS.map((r) => r.metric_id);
    if (ids.length > 0) {
      await queryRunner.query(
        `DELETE FROM region_metric_weight WHERE version = 'v1.0' AND region = 'mouth' AND metric_id = ANY($1::text[])`,
        [ids],
      );
      await queryRunner.query(
        `DELETE FROM metric_ideal WHERE ideals_version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [ids],
      );
      await queryRunner.query(
        `DELETE FROM metric_definition WHERE version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [ids],
      );
    }
  }
}
