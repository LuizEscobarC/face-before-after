/**
 * 0012 — Seed M2 global_shape family (PR-19).
 *
 * Inserts 4 metric_definition rows, 3 metric_ideal rows, and
 * 2 region_metric_weight rows for the global_shape family.
 * Frontal + slight-pitch metrics; all landmark-based except e_line_deviation.
 *
 * Metrics (4 total):
 *   face_height_to_width_ratio — Farkas aspect ratio (menton→crown / bizygomatic)
 *   face_shape_classification  — categorical shape label (presentation_only=true, DEC-6)
 *   total_facial_convexity     — polygon/convex-hull area ratio via scipy (8-keypoint boundary)
 *   e_line_deviation           — pixel-analysis stub (DEC-10); NO ideal row,
 *                                NO weight row — excluded from scoring until
 *                                pixel-analysis / depth pipeline is available.
 *
 * Calibration sources:
 *   Farkas (1994) Anthropometry of the Head and Face, Table 4-2 (aspect ratio 1.35).
 *   Ricketts (1981) The golden diviner (E-line reference).
 *
 * Idempotent: ON CONFLICT DO NOTHING.
 * Note: 'global' already exists in metric_region_enum since migration 1746000010000 — no ALTER TYPE needed.
 *
 * Landmark index reference (Mesh-478):
 *   P_FOREHEAD_CROWN      = 10
 *   P_MENTON              = 152
 *   P_LEFT_ZYGOMATIC      = LM_JAWLINE[1]    = 338
 *   P_RIGHT_ZYGOMATIC     = LM_JAWLINE[15]   = 378
 *   P_LEFT_GONION         = 58
 *   P_RIGHT_GONION        = 288
 *   P_BROW_LEFT_OUTER     = LM_LEFT_BROW[0]  = 70
 *   P_BROW_RIGHT_OUTER    = LM_RIGHT_BROW[4] = 300
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

const GLOBAL_SHAPE_DEFINITIONS: MetricDefinitionRow[] = [
  {
    metric_id: 'face_height_to_width_ratio',
    version: 'v1.0',
    family: 'global_shape',
    region: 'global',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção Altura/Largura Facial' },
    presentation_only: false,
    requires_pixel_analysis: false,
    // crown(10), menton(152), zyg_L(338), zyg_R(378)
    dependency_landmarks: [10, 152, 338, 378],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'face_shape_classification',
    version: 'v1.0',
    family: 'global_shape',
    region: 'global',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Classificação de Forma do Rosto' },
    presentation_only: true,  // DEC-6: same aspect as face_height_to_width_ratio
    requires_pixel_analysis: false,
    // crown(10), menton(152), zyg_L(338), zyg_R(378), gonion_L(58), gonion_R(288)
    dependency_landmarks: [10, 152, 338, 378, 58, 288],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'total_facial_convexity',
    version: 'v1.0',
    family: 'global_shape',
    region: 'global',
    unit: 'index_0_1',
    display_name: { 'pt-BR': 'Convexidade Frontal Total' },
    presentation_only: false,
    requires_pixel_analysis: false,
    // 8-point boundary: crown(10), brow_L(70), zyg_L(338), gonion_L(58),
    //                   menton(152), gonion_R(288), zyg_R(378), brow_R(300)
    dependency_landmarks: [10, 70, 338, 58, 152, 288, 378, 300],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'e_line_deviation',
    version: 'v1.0',
    family: 'global_shape',
    region: 'global',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Desvio da Linha E de Ricketts' },
    presentation_only: false,
    requires_pixel_analysis: true,
    dependency_landmarks: [],
    default_weight_in_region: 0.0,  // excluded from scoring (DEC-10)
    min_confidence_to_display: 0.9, // effectively never displayed as stub
  },
];

// Only the 3 landmark-based metrics receive ideal rows.
// e_line_deviation is deferred (DEC-10): no ideal, no weight.
const GLOBAL_SHAPE_IDEALS: MetricIdealRow[] = [
  {
    metric_id: 'face_height_to_width_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 1.35,
    green_range_min: 1.25,
    green_range_max: 1.45,
    yellow_range_min: 1.15,
    yellow_range_max: 1.55,
    direction_label_above: { 'pt-BR': 'rosto oblongo' },
    direction_label_below: { 'pt-BR': 'rosto arredondado' },
    population_reference_note:
      'Farkas (1994) Anthropometry of the Head and Face, Table 4-2: facial height / bizygomatic width ≈ 1.35 (unified-sex); green ±0.10, yellow ±0.20.',
  },
  {
    metric_id: 'face_shape_classification',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 1.35,
    green_range_min: 1.20,
    green_range_max: 1.50,
    yellow_range_min: 1.00,
    yellow_range_max: 1.65,
    direction_label_above: { 'pt-BR': 'formato oblongo' },
    direction_label_below: { 'pt-BR': 'formato arredondado' },
    population_reference_note:
      'Canonical oval-face target: aspect ratio 1.35, jaw taper 0.74–0.88. Wider green/yellow bands reflect the multi-axis classification (aspect + taper).',
  },
  {
    metric_id: 'total_facial_convexity',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.98,
    green_range_min: 0.94,
    green_range_max: 1.00,
    yellow_range_min: 0.87,
    yellow_range_max: 1.00,
    direction_label_above: { 'pt-BR': 'região temporal cheia' },
    direction_label_below: { 'pt-BR': 'afundamento temporal' },
    population_reference_note:
      'Canonical ideal: polygon / convex-hull area ≥ 0.98 (no significant temporal hollowing). Green ≥ 0.94, yellow ≥ 0.87. Computed from 8-keypoint frontal boundary using scipy.spatial.ConvexHull.',
  },
];

// Weights for the 2 scoreable global metrics.
// face_shape_classification excluded (presentation_only=true, DEC-6).
// e_line_deviation excluded (requires_pixel_analysis=true, DEC-10 stub).
const GLOBAL_REGION_WEIGHTS: { metricId: string; weight: number }[] = [
  { metricId: 'face_height_to_width_ratio', weight: 1.3 }, // primary shape signal
  { metricId: 'total_facial_convexity',     weight: 0.8 }, // secondary (temporal hollowing)
];

export class SeedGlobalShapeFamily1746000120000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── 1. metric_definition rows ──────────────────────────────────────────
    // 'global' is already present in metric_region_enum — no ALTER TYPE needed.
    for (const row of GLOBAL_SHAPE_DEFINITIONS) {
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

    // ── 2. metric_ideal rows (3 only — e_line_deviation deferred) ─────────
    for (const row of GLOBAL_SHAPE_IDEALS) {
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

    // ── 3. region_metric_weight rows (2 only — shape+convexity scored) ────
    for (const w of GLOBAL_REGION_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ($1, 'global', $2, $3)
           ON CONFLICT ON CONSTRAINT uq_region_metric_weight_version_region_metric DO NOTHING`,
        ['v1.0', w.metricId, w.weight],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 'global' enum value must remain in metric_region_enum (was pre-existing).
    const allIds = GLOBAL_SHAPE_DEFINITIONS.map((r) => r.metric_id);
    if (allIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM region_metric_weight WHERE version = 'v1.0' AND region = 'global' AND metric_id = ANY($1::text[])`,
        [allIds],
      );
      const idealIds = GLOBAL_SHAPE_IDEALS.map((r) => r.metric_id);
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
