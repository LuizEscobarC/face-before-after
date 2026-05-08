/**
 * 0010 — Seed M2 cheekbones / midface family (PR-17).
 *
 * Inserts 5 metric_definition + 5 metric_ideal + 5 region_metric_weight rows
 * for the cheekbones family. Frontal-only metrics.
 *
 * Metrics (5 total, all non-presentation_only):
 *   zygomatic_width_ratio   — bizygomatic width in ICU (Farkas, 1994)
 *   malar_projection_index  — bizygomatic / biocular width ratio
 *   midface_height_ratio    — midface height in ICU (subnasale to inner canthus midpoint)
 *   cheekbone_to_jaw_ratio  — bizygomatic / bigonial width ratio (facial taper)
 *   submalar_hollow_index   — 1 − (bicheek / bizygomatic) concavity index
 *
 * Calibration sources: Farkas (1994) Anthropometry of the Head and Face;
 * Powell & Humphreys (1984) Proportions of the Aesthetic Face.
 *
 * Idempotent: ON CONFLICT DO NOTHING. Extends region_metric_weights v1.0
 * (does NOT bump version — bump deferred to PR-21).
 *
 * Landmark index reference (Mesh-478):
 *   P_LEFT_ZYGOMATIC  = LM_JAWLINE[1]  = 338
 *   P_RIGHT_ZYGOMATIC = LM_JAWLINE[15] = 378
 *   P_LEFT_GONION     = 58   P_RIGHT_GONION     = 288
 *   P_LEFT_EYE_OUTER  = 33   P_RIGHT_EYE_OUTER  = 263
 *   P_LEFT_EYE_INNER  = 133  P_RIGHT_EYE_INNER  = 362
 *   P_SUBNASALE       = 2
 *   P_LEFT_CHEEK      = LM_JAWLINE[3]  = 332
 *   P_RIGHT_CHEEK     = LM_JAWLINE[13] = 365
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

type MetricIdealRow = {
  metric_id: string;
  metric_definition_version: string;
  ideals_version: string;
  ideal_type: string;
  ideal_central_value: number;
  green_range_min: number;
  green_range_max: number;
  yellow_range_min: number;
  yellow_range_max: number;
  direction_label_above: Record<string, string>;
  direction_label_below: Record<string, string>;
  population_reference_note: string;
};

const CHEEKBONE_DEFINITIONS: MetricDefinitionRow[] = [
  {
    metric_id: 'zygomatic_width_ratio',
    version: 'v1.0',
    family: 'cheekbones',
    region: 'cheekbones',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Proporção de Largura Zigomática (ICU)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [338, 378],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'malar_projection_index',
    version: 'v1.0',
    family: 'cheekbones',
    region: 'cheekbones',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Índice de Projeção Malar' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [338, 378, 33, 263],
    default_weight_in_region: 1.2,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'midface_height_ratio',
    version: 'v1.0',
    family: 'cheekbones',
    region: 'cheekbones',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Proporção de Altura do Terço Médio (ICU)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [133, 362, 2],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'cheekbone_to_jaw_ratio',
    version: 'v1.0',
    family: 'cheekbones',
    region: 'cheekbones',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Razão Maçãs–Mandíbula' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [338, 378, 58, 288],
    default_weight_in_region: 1.1,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'submalar_hollow_index',
    version: 'v1.0',
    family: 'cheekbones',
    region: 'cheekbones',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Índice de Concavidade Submalar' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [338, 378, 332, 365],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
];

const CHEEKBONE_IDEALS: MetricIdealRow[] = [
  {
    metric_id: 'zygomatic_width_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 4.00,
    green_range_min: 3.70,
    green_range_max: 4.30,
    yellow_range_min: 3.40,
    yellow_range_max: 4.60,
    direction_label_above: { 'pt-BR': 'rosto muito largo nas maçãs' },
    direction_label_below: { 'pt-BR': 'rosto estreito nas maçãs' },
    population_reference_note: 'Farkas (1994) Anthropometry of the Head and Face, Table 4-1',
  },
  {
    metric_id: 'malar_projection_index',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 1.33,
    green_range_min: 1.23,
    green_range_max: 1.43,
    yellow_range_min: 1.13,
    yellow_range_max: 1.53,
    direction_label_above: { 'pt-BR': 'maçãs proeminentes' },
    direction_label_below: { 'pt-BR': 'maçãs planas' },
    population_reference_note: 'Powell & Humphreys (1984) Proportions of the Aesthetic Face',
  },
  {
    metric_id: 'midface_height_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 1.50,
    green_range_min: 1.30,
    green_range_max: 1.70,
    yellow_range_min: 1.10,
    yellow_range_max: 1.90,
    direction_label_above: { 'pt-BR': 'terço médio longo' },
    direction_label_below: { 'pt-BR': 'terço médio curto' },
    population_reference_note:
      'Farkas (1994) Anthropometry of the Head and Face; Powell & Humphreys (1984)',
  },
  {
    metric_id: 'cheekbone_to_jaw_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 1.25,
    green_range_min: 1.17,
    green_range_max: 1.33,
    yellow_range_min: 1.10,
    yellow_range_max: 1.40,
    direction_label_above: { 'pt-BR': 'maçãs muito proeminentes' },
    direction_label_below: { 'pt-BR': 'mandíbula quadrada' },
    population_reference_note: 'Farkas (1994) Anthropometry of the Head and Face, Table 4-2',
  },
  {
    metric_id: 'submalar_hollow_index',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.10,
    green_range_min: 0.03,
    green_range_max: 0.17,
    yellow_range_min: -0.05,
    yellow_range_max: 0.25,
    direction_label_above: { 'pt-BR': 'submalar côncavo' },
    direction_label_below: { 'pt-BR': 'submalar muito cheio' },
    population_reference_note: 'Derived from facial volume analysis, Farkas (1994) normative data',
  },
];

const CHEEKBONE_REGION_WEIGHTS: { metricId: string; weight: number }[] = [
  { metricId: 'zygomatic_width_ratio',  weight: 1.0 },
  { metricId: 'malar_projection_index', weight: 1.2 },
  { metricId: 'midface_height_ratio',   weight: 1.0 },
  { metricId: 'cheekbone_to_jaw_ratio', weight: 1.1 },
  { metricId: 'submalar_hollow_index',  weight: 1.0 },
];

export class SeedCheekbonesFamily1746000100000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. metric_definition rows ──────────────────────────────────────────
    // Note: 'cheekbones' enum value was added in migration 1746000095000.
    for (const row of CHEEKBONE_DEFINITIONS) {
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

    // ── 2. metric_ideal rows ───────────────────────────────────────────────
    for (const row of CHEEKBONE_IDEALS) {
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

    // ── 3. region_metric_weight rows ───────────────────────────────────────
    for (const w of CHEEKBONE_REGION_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ($1, 'cheekbones', $2, $3)
           ON CONFLICT ON CONSTRAINT uq_region_metric_weight_version_region_metric DO NOTHING`,
        ['v1.0', w.metricId, w.weight],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL does not support removing enum values.
    // The 'cheekbones' value will remain in metric_region_enum after rollback.
    const ids = CHEEKBONE_DEFINITIONS.map((r) => r.metric_id);
    if (ids.length > 0) {
      await queryRunner.query(
        `DELETE FROM region_metric_weight WHERE version = 'v1.0' AND region = 'cheekbones' AND metric_id = ANY($1::text[])`,
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
