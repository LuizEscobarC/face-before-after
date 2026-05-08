/**
 * 0007 — Seed M2 nose family (PR-14).
 *
 * Inserts 7 metric_definition + 7 metric_ideal + 7 region_metric_weight rows
 * for the nose family. Frontal-only metrics (no profile/sagittal required).
 *
 * Substitutions vs original PLAN_M2_BACKLOG.md (frontal-only constraint):
 *   - nasal_tip_projection (sagittal) → nasal_tip_deviation (frontal asymmetry)
 *   - nasolabial_angle (sagittal)     → alar_base_asymmetry (frontal asymmetry)
 *   - nose_width_ratio split into 3 ratios with different denominators:
 *       nose_width_to_icd, alar_to_face_width_ratio, nose_to_mouth_width_ratio
 *
 * Calibration sources:
 *   nose_length_to_icd      → Farkas (1994) ~50mm:32mm = 1.56 → adopted 1.5.
 *   nose_width_to_icd       → Rule of fifths (Farkas, neoclassical canons) = 1.0.
 *   alar_to_face_width      → Rule of fifths = 0.20 (one fifth).
 *   nose_to_mouth_width     → Naini (2011) ~0.65 unified-sex.
 *   dorsum/tip/alar deviations → canonical 0 (perfect symmetry).
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

const NOSE_DEFINITIONS: MetricDefinitionRow[] = [
  {
    metric_id: 'nose_length_to_icd',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Comprimento do Nariz (em ICU)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [168, 2],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'nose_width_to_icd',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Largura do Nariz (em ICU)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [48, 45],
    default_weight_in_region: 1.2,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'alar_to_face_width_ratio',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Largura do Nariz / Largura da Face' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [48, 45, 234, 454],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'nose_to_mouth_width_ratio',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Largura do Nariz / Largura da Boca' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [48, 45, 61, 291],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'dorsum_deviation',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Desvio do Dorso Nasal' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [168, 1],
    default_weight_in_region: 1.3,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'nasal_tip_deviation',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Desvio da Ponta Nasal' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [1],
    default_weight_in_region: 1.3,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'alar_base_asymmetry',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Assimetria da Base Alar' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [48, 45],
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

const NOSE_IDEALS: MetricIdealRow[] = [
  {
    metric_id: 'nose_length_to_icd',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 1.50,
    green_range_min: 1.35,
    green_range_max: 1.65,
    yellow_range_min: 1.20,
    yellow_range_max: 1.80,
    direction_label_above: { 'pt-BR': 'nariz alongado' },
    direction_label_below: { 'pt-BR': 'nariz curto' },
    population_reference_note:
      'Farkas (1994), nasal length / ICD ~1.56; Naini (2011) reports 1.45-1.65 ' +
      'unified-sex. Adopted 1.5 for v1.0 BR population.',
  },
  {
    metric_id: 'nose_width_to_icd',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 1.00,
    green_range_min: 0.90,
    green_range_max: 1.10,
    yellow_range_min: 0.80,
    yellow_range_max: 1.20,
    direction_label_above: { 'pt-BR': 'nariz mais largo' },
    direction_label_below: { 'pt-BR': 'nariz mais estreito' },
    population_reference_note:
      'Rule of fifths (Farkas, neoclassical canons): alar base ≈ central fifth ≈ ICD.',
  },
  {
    metric_id: 'alar_to_face_width_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.20,
    green_range_min: 0.17,
    green_range_max: 0.23,
    yellow_range_min: 0.14,
    yellow_range_max: 0.26,
    direction_label_above: { 'pt-BR': 'asas nasais proeminentes' },
    direction_label_below: { 'pt-BR': 'asas nasais discretas' },
    population_reference_note: 'Rule of fifths = 0.20 (one fifth of bizygomatic).',
  },
  {
    metric_id: 'nose_to_mouth_width_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.65,
    green_range_min: 0.57,
    green_range_max: 0.73,
    yellow_range_min: 0.50,
    yellow_range_max: 0.80,
    direction_label_above: { 'pt-BR': 'nariz largo em relação à boca' },
    direction_label_below: { 'pt-BR': 'nariz estreito em relação à boca' },
    population_reference_note: 'Naini (2011) ~0.65 unified-sex (alar < mouth typically).',
  },
  {
    metric_id: 'dorsum_deviation',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.03,
    yellow_range_min: 0.0,
    yellow_range_max: 0.07,
    direction_label_above: { 'pt-BR': 'dorso desviado para a esquerda' },
    direction_label_below: { 'pt-BR': 'dorso desviado para a direita' },
    population_reference_note: 'Canonical: ideal = 0 (perfect vertical bridge).',
  },
  {
    metric_id: 'nasal_tip_deviation',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.03,
    yellow_range_min: 0.0,
    yellow_range_max: 0.07,
    direction_label_above: { 'pt-BR': 'ponta desviada para a esquerda' },
    direction_label_below: { 'pt-BR': 'ponta desviada para a direita' },
    population_reference_note: 'Canonical: ideal = 0 (tip on facial midline).',
  },
  {
    metric_id: 'alar_base_asymmetry',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.03,
    yellow_range_min: 0.0,
    yellow_range_max: 0.07,
    direction_label_above: { 'pt-BR': 'asa esquerda mais baixa' },
    direction_label_below: { 'pt-BR': 'asa direita mais baixa' },
    population_reference_note: 'Canonical: ideal = 0 (alar bases at same height).',
  },
];

const NOSE_REGION_WEIGHTS: Array<{ metricId: string; weight: number }> = [
  { metricId: 'nose_length_to_icd',         weight: 1.0 },
  { metricId: 'nose_width_to_icd',          weight: 1.2 },
  { metricId: 'alar_to_face_width_ratio',   weight: 1.0 },
  { metricId: 'nose_to_mouth_width_ratio',  weight: 1.0 },
  { metricId: 'dorsum_deviation',           weight: 1.3 },
  { metricId: 'nasal_tip_deviation',        weight: 1.3 },
  { metricId: 'alar_base_asymmetry',        weight: 1.2 },
];

export class SeedNoseFamily1746000070000 implements MigrationInterface {
  name = 'SeedNoseFamily1746000070000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of NOSE_DEFINITIONS) {
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

    for (const row of NOSE_IDEALS) {
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

    for (const w of NOSE_REGION_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ($1, 'nose', $2, $3)
           ON CONFLICT ON CONSTRAINT uq_region_metric_weight_version_region_metric DO NOTHING`,
        ['v1.0', w.metricId, w.weight],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = NOSE_DEFINITIONS.map((r) => r.metric_id);
    if (ids.length > 0) {
      await queryRunner.query(
        `DELETE FROM region_metric_weight WHERE version = 'v1.0' AND region = 'nose' AND metric_id = ANY($1::text[])`,
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
