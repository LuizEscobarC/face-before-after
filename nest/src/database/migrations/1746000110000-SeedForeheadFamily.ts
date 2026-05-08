/**
 * 0011 — Seed M2 forehead family (PR-18).
 *
 * Inserts 4 metric_definition rows, 3 metric_ideal rows, and
 * 3 region_metric_weight rows for the forehead family.
 * Frontal-only metrics; all landmark-based except hairline_curvature_index.
 *
 * Metrics (4 total):
 *   forehead_height_ratio   — absolute forehead height in ICU (trichion→glabella)
 *   forehead_width_ratio    — biocular / bizygomatic width ratio
 *   temporal_width_ratio    — outer brow span / bizygomatic (temporal crest proxy)
 *   hairline_curvature_index — pixel-analysis stub (DEC-10); NO ideal row,
 *                              NO weight row — excluded from scoring until
 *                              pixel-analysis pipeline is available.
 *
 * Calibration sources:
 *   Farkas (1994) Anthropometry of the Head and Face.
 *   Naini (2011) Facial Aesthetics, §4.3.
 *
 * Idempotent: ON CONFLICT DO NOTHING.
 * Note: 'forehead' already exists in metric_region_enum — no ALTER TYPE needed.
 *
 * Landmark index reference (Mesh-478):
 *   P_FOREHEAD_CROWN   = 10
 *   P_BROW_LEFT_INNER  = LM_LEFT_BROW[4]  = 107
 *   P_BROW_RIGHT_INNER = LM_RIGHT_BROW[0] = 336
 *   P_LEFT_EYE_OUTER   = 33   P_RIGHT_EYE_OUTER  = 263
 *   P_BROW_LEFT_OUTER  = LM_LEFT_BROW[0]  = 70
 *   P_BROW_RIGHT_OUTER = LM_RIGHT_BROW[4] = 300
 *   P_LEFT_ZYGOMATIC   = LM_JAWLINE[1]    = 338
 *   P_RIGHT_ZYGOMATIC  = LM_JAWLINE[15]   = 378
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

const FOREHEAD_DEFINITIONS: MetricDefinitionRow[] = [
  {
    metric_id: 'forehead_height_ratio',
    version: 'v1.0',
    family: 'forehead',
    region: 'forehead',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Proporção de Altura da Testa (ICU)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [10, 107, 336],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'forehead_width_ratio',
    version: 'v1.0',
    family: 'forehead',
    region: 'forehead',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção de Largura da Testa' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [33, 263, 338, 378],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'temporal_width_ratio',
    version: 'v1.0',
    family: 'forehead',
    region: 'forehead',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção de Largura Temporal' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [70, 300, 338, 378],
    default_weight_in_region: 1.1,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'hairline_curvature_index',
    version: 'v1.0',
    family: 'forehead',
    region: 'forehead',
    unit: 'index_0_1',
    display_name: { 'pt-BR': 'Índice de Curvatura do Contorno Capilar' },
    presentation_only: false,
    requires_pixel_analysis: true,
    dependency_landmarks: [],
    default_weight_in_region: 0.0,  // excluded from scoring (DEC-10)
    min_confidence_to_display: 0.9, // effectively never displayed as stub
  },
];

// Only the 3 landmark-based metrics receive ideal rows.
// hairline_curvature_index is deferred (DEC-10): no ideal, no weight.
const FOREHEAD_IDEALS: MetricIdealRow[] = [
  {
    metric_id: 'forehead_height_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 1.90,
    green_range_min: 1.60,
    green_range_max: 2.20,
    yellow_range_min: 1.30,
    yellow_range_max: 2.50,
    direction_label_above: { 'pt-BR': 'testa alta' },
    direction_label_below: { 'pt-BR': 'testa baixa' },
    population_reference_note:
      'Farkas (1994) Anthropometry of the Head and Face, Table 4-1: trichion–glabella ≈ 60 mm / ICD 32 mm = 1.875 ICU; rounded to 1.90 as unified-sex canonical target.',
  },
  {
    metric_id: 'forehead_width_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.70,
    green_range_min: 0.63,
    green_range_max: 0.77,
    yellow_range_min: 0.57,
    yellow_range_max: 0.83,
    direction_label_above: { 'pt-BR': 'testa larga em relação às maçãs' },
    direction_label_below: { 'pt-BR': 'testa estreita em relação às maçãs' },
    population_reference_note:
      'Farkas (1994): outer-canthal breadth ≈ 90 mm / bizygomatic ≈ 128 mm = 0.703. Naini (2011) Facial Aesthetics §4.3 corroborates the same range.',
  },
  {
    metric_id: 'temporal_width_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.75,
    green_range_min: 0.68,
    green_range_max: 0.82,
    yellow_range_min: 0.62,
    yellow_range_max: 0.88,
    direction_label_above: { 'pt-BR': 'região temporal larga' },
    direction_label_below: { 'pt-BR': 'região temporal estreita' },
    population_reference_note:
      'Farkas (1994): biofrontal / bizygomatic ≈ 0.86 (110 mm / 128 mm). Outer brow arch endpoints (Mesh-478 idx 70/300) lie slightly medial to the temporal crest, giving an empirical proxy ideal of 0.75.',
  },
];

// Weights for the 3 scoreable forehead metrics.
// hairline_curvature_index is intentionally excluded (DEC-10).
const FOREHEAD_REGION_WEIGHTS: { metricId: string; weight: number }[] = [
  { metricId: 'forehead_height_ratio', weight: 1.0 },
  { metricId: 'forehead_width_ratio',  weight: 1.0 },
  { metricId: 'temporal_width_ratio',  weight: 1.1 },
];

export class SeedForeheadFamily1746000110000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. metric_definition rows ──────────────────────────────────────────
    // 'forehead' is already present in metric_region_enum — no ALTER TYPE needed.
    for (const row of FOREHEAD_DEFINITIONS) {
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

    // ── 2. metric_ideal rows (3 only — hairline deferred) ─────────────────
    for (const row of FOREHEAD_IDEALS) {
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

    // ── 3. region_metric_weight rows (3 only — hairline excluded) ─────────
    for (const w of FOREHEAD_REGION_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ($1, 'forehead', $2, $3)
           ON CONFLICT ON CONSTRAINT uq_region_metric_weight_version_region_metric DO NOTHING`,
        ['v1.0', w.metricId, w.weight],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 'forehead' enum value must remain in metric_region_enum (was pre-existing).
    const allIds = FOREHEAD_DEFINITIONS.map((r) => r.metric_id);
    if (allIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM region_metric_weight WHERE version = 'v1.0' AND region = 'forehead' AND metric_id = ANY($1::text[])`,
        [allIds],
      );
      const idealIds = FOREHEAD_IDEALS.map((r) => r.metric_id);
      if (idealIds.length > 0) {
        await queryRunner.query(
          `DELETE FROM metric_ideal WHERE ideals_version = 'v1.0' AND metric_id = ANY($1::text[])`,
          [idealIds],
        );
      }
      await queryRunner.query(
        `DELETE FROM metric_definition WHERE version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [allIds],
      );
    }
  }
}
