/**
 * 0006 — Seed M2 jaw family (PR-13).
 *
 * Inserts 6 metric_definition rows + 6 metric_ideal rows for the jaw family,
 * plus 6 region_metric_weight rows for the active 'symmetry'/'eyes' weights
 * version v1.0 (extends, does NOT bump version — bump happens in PR-21).
 *
 * Calibration sources (per metric, see population_reference_note):
 *   jaw_width_ratio        → Farkas (1994), bigonial:bizygomatic ~0.80 unified-sex.
 *   gonial_angle_l/r       → Tweed/Steiner cephalometry, ~125° (range 120–130°).
 *                            2D approximation via zygomatic-gonion-menton; gonion
 *                            landmark on Mesh-478 is approximate (TODO upstream).
 *   gonial_angle_asymmetry → derived; ideal=0°, green ±3°, yellow ±6°.
 *   mandibular_plane_angle → Steiner, ~27° (range 22–32°). Per-side averaged.
 *   chin_height_ratio      → Farkas, lower-third subdivided ~0.50 chin / 0.50 lip.
 *
 * All calibrated for unified-sex adult population (BR mixed). Per-sex / per-age
 * refinement deferred to PR-22 (calibration with real photos).
 *
 * Idempotent: all INSERTs use ON CONFLICT DO NOTHING.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

// ---------------------------------------------------------------------------
// metric_definition rows (6)
// ---------------------------------------------------------------------------
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

const JAW_DEFINITIONS: MetricDefinitionRow[] = [
  {
    metric_id: 'jaw_width_ratio',
    version: 'v1.0',
    family: 'jaw',
    region: 'jaw',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção da Largura Mandibular' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [58, 288, 234, 454],
    default_weight_in_region: 1.5,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'gonial_angle_l',
    version: 'v1.0',
    family: 'jaw',
    region: 'jaw',
    unit: 'degrees',
    display_name: { 'pt-BR': 'Ângulo Gonial — Esquerdo' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [234, 58, 152],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'gonial_angle_r',
    version: 'v1.0',
    family: 'jaw',
    region: 'jaw',
    unit: 'degrees',
    display_name: { 'pt-BR': 'Ângulo Gonial — Direito' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [454, 288, 152],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'gonial_angle_asymmetry',
    version: 'v1.0',
    family: 'jaw',
    region: 'jaw',
    unit: 'degrees',
    display_name: { 'pt-BR': 'Assimetria do Ângulo Gonial' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [234, 58, 454, 288, 152],
    default_weight_in_region: 1.2,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'mandibular_plane_angle',
    version: 'v1.0',
    family: 'jaw',
    region: 'jaw',
    unit: 'degrees',
    display_name: { 'pt-BR': 'Ângulo do Plano Mandibular' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [58, 288, 152],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'chin_height_ratio',
    version: 'v1.0',
    family: 'jaw',
    region: 'jaw',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção da Altura do Mento' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [2, 17, 152],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
];

// ---------------------------------------------------------------------------
// metric_ideal rows (6)
// ---------------------------------------------------------------------------
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

const JAW_IDEALS: MetricIdealRow[] = [
  {
    metric_id: 'jaw_width_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.80,
    green_range_min: 0.75,
    green_range_max: 0.85,
    yellow_range_min: 0.70,
    yellow_range_max: 0.90,
    direction_label_above: { 'pt-BR': 'mandíbula mais larga' },
    direction_label_below: { 'pt-BR': 'mandíbula mais afilada' },
    population_reference_note:
      'Farkas (1994), bigonial:bizygomatic ~0.80. Naini (2011) ~0.82 — adopted 0.80 ' +
      'for v1.0 unified-sex BR population. Per-sex split deferred to PR-22.',
  },
  {
    metric_id: 'gonial_angle_l',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 125.0,
    green_range_min: 120.0,
    green_range_max: 130.0,
    yellow_range_min: 115.0,
    yellow_range_max: 135.0,
    direction_label_above: { 'pt-BR': 'ângulo mais aberto' },
    direction_label_below: { 'pt-BR': 'ângulo mais fechado' },
    population_reference_note:
      'Tweed/Steiner cephalometric range 120–130°. 2D approximation noisier than ' +
      'cephalometric; min_confidence_to_display=0.4 reflects gonion landmark uncertainty.',
  },
  {
    metric_id: 'gonial_angle_r',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 125.0,
    green_range_min: 120.0,
    green_range_max: 130.0,
    yellow_range_min: 115.0,
    yellow_range_max: 135.0,
    direction_label_above: { 'pt-BR': 'ângulo mais aberto' },
    direction_label_below: { 'pt-BR': 'ângulo mais fechado' },
    population_reference_note: 'Mirror of gonial_angle_l.',
  },
  {
    metric_id: 'gonial_angle_asymmetry',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 3.0,
    yellow_range_min: 0.0,
    yellow_range_max: 6.0,
    direction_label_above: { 'pt-BR': 'lado esquerdo mais aberto' },
    direction_label_below: { 'pt-BR': 'lado direito mais aberto' },
    population_reference_note: 'Derived metric; ideal=0° symmetric.',
  },
  {
    metric_id: 'mandibular_plane_angle',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 27.0,
    green_range_min: 22.0,
    green_range_max: 32.0,
    yellow_range_min: 17.0,
    yellow_range_max: 37.0,
    direction_label_above: { 'pt-BR': 'plano mandibular mais inclinado' },
    direction_label_below: { 'pt-BR': 'plano mandibular mais horizontal' },
    population_reference_note:
      'Steiner cephalometric ~25-30° (FH-MP). Per-side averaged 2D proxy.',
  },
  {
    metric_id: 'chin_height_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.50,
    green_range_min: 0.45,
    green_range_max: 0.55,
    yellow_range_min: 0.40,
    yellow_range_max: 0.60,
    direction_label_above: { 'pt-BR': 'mento alongado' },
    direction_label_below: { 'pt-BR': 'mento curto' },
    population_reference_note:
      'Farkas (1994), lower-third subdivided ~0.50 (sn-st : st-gn).',
  },
];

// ---------------------------------------------------------------------------
// region_metric_weight rows for the existing active version v1.0 (jaw region)
// ---------------------------------------------------------------------------
const JAW_REGION_WEIGHTS: Array<{ metricId: string; weight: number }> = [
  { metricId: 'jaw_width_ratio',         weight: 1.5 },
  { metricId: 'gonial_angle_l',          weight: 1.0 },
  { metricId: 'gonial_angle_r',          weight: 1.0 },
  { metricId: 'gonial_angle_asymmetry',  weight: 1.2 },
  { metricId: 'mandibular_plane_angle',  weight: 1.0 },
  { metricId: 'chin_height_ratio',       weight: 1.0 },
];

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------
export class SeedJawFamily1746000060000 implements MigrationInterface {
  name = 'SeedJawFamily1746000060000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of JAW_DEFINITIONS) {
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

    for (const row of JAW_IDEALS) {
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

    // Extend the existing active region_metric_weights_version v1.0 with jaw rows.
    // PR-21 will cut a v2.0 once all M2 families are in.
    for (const w of JAW_REGION_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ($1, 'jaw', $2, $3)
           ON CONFLICT ON CONSTRAINT uq_region_metric_weight_version_region_metric DO NOTHING`,
        ['v1.0', w.metricId, w.weight],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = JAW_DEFINITIONS.map((r) => r.metric_id);
    if (ids.length > 0) {
      await queryRunner.query(
        `DELETE FROM region_metric_weight WHERE version = 'v1.0' AND region = 'jaw' AND metric_id = ANY($1::text[])`,
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
