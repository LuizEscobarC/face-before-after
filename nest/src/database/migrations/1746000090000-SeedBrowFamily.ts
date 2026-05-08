/**
 * 0009 — Seed M2 brow family (PR-16).
 *
 * Inserts 8 metric_definition + 8 metric_ideal + 6 region_metric_weight rows
 * for the brows family. Frontal-only metrics (no profile/sagittal required).
 *
 * Metrics (8 total, 2 presentation_only):
 *   brow_height_l / _r           — vertical distance inner brow → inner canthus (ICU)
 *   brow_arch_peak_l / _r        — fractional position of arch apex along brow span
 *   brow_thickness_l / _r        — vertical span of brow landmarks (proxy; presentation_only)
 *   brow_tail_drop_l              — signed: outer_y − inner_y (negative = elevated outer)
 *   interbrow_distance_ratio      — |inner_brow_r.x − inner_brow_l.x| / ICD
 *
 * DEC-6 compliance: brow_thickness_l/r are marked presentation_only=true and
 * have NO rows in region_metric_weight (they NEVER enter the regional score).
 *
 * Calibration sources:
 *   brow_height            → Farkas (1994): ~11 mm at ICD 32 mm → 0.34; adopted 0.35.
 *   brow_arch_peak         → Farkas / Romo (2006): apex at ~2/3 from inner to outer.
 *   brow_thickness         → Farkas (1994): ~7–8 mm at ICD 32 mm → ~0.22–0.25; adopted 0.20
 *                            (vertical span proxy — conservative for Mesh-478).
 *   brow_tail_drop_l       → Farkas outer brow ~1 mm above inner brow; Naini (2011)
 *                            upswept tail canonical → ideal = −0.05 ICU.
 *   interbrow_distance_ratio → Farkas (1994): interbrow = ICD; ideal = 1.0.
 *
 * Idempotent: ON CONFLICT DO NOTHING. Extends region_metric_weights v1.0
 * (does NOT bump version — bump deferred to PR-21).
 *
 * Landmark index reference (Mesh-478):
 *   LM_LEFT_BROW  = [70, 63, 105, 66, 107]  (outer→inner, dlib 17–21)
 *   LM_RIGHT_BROW = [336, 296, 334, 293, 300] (inner→outer, dlib 22–26)
 *   P_BROW_LEFT_INNER  = 107   P_BROW_LEFT_OUTER  = 70
 *   P_BROW_RIGHT_INNER = 336   P_BROW_RIGHT_OUTER = 300
 *   P_LEFT_EYE_INNER = 133     P_RIGHT_EYE_INNER = 362
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

const BROW_DEFINITIONS: MetricDefinitionRow[] = [
  {
    metric_id: 'brow_height_l',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Altura da Sobrancelha Esq. (ICU)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [107, 133],   // P_BROW_LEFT_INNER, P_LEFT_EYE_INNER
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'brow_height_r',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Altura da Sobrancelha Dir. (ICU)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [336, 362],   // P_BROW_RIGHT_INNER, P_RIGHT_EYE_INNER
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'brow_arch_peak_l',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Ápice do Arco Esq. (razão)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [70, 63, 105, 66, 107],   // LM_LEFT_BROW
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'brow_arch_peak_r',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Ápice do Arco Dir. (razão)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [336, 296, 334, 293, 300],  // LM_RIGHT_BROW
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'brow_thickness_l',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Espessura da Sobrancelha Esq. (proxy)' },
    presentation_only: true,    // Mesh-478 cannot reliably resolve brow edges
    requires_pixel_analysis: false,
    dependency_landmarks: [70, 63, 105, 66, 107],   // LM_LEFT_BROW
    default_weight_in_region: 0.0,  // ignored in score (DEC-6)
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'brow_thickness_r',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Espessura da Sobrancelha Dir. (proxy)' },
    presentation_only: true,
    requires_pixel_analysis: false,
    dependency_landmarks: [336, 296, 334, 293, 300],  // LM_RIGHT_BROW
    default_weight_in_region: 0.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'brow_tail_drop_l',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Queda da Cauda da Sobrancelha Esq.' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [70, 107],  // P_BROW_LEFT_OUTER, P_BROW_LEFT_INNER
    default_weight_in_region: 1.2,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'interbrow_distance_ratio',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Distância Intersobrancelhar (ICU)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [107, 336],  // P_BROW_LEFT_INNER, P_BROW_RIGHT_INNER
    default_weight_in_region: 1.1,
    min_confidence_to_display: 0.4,
  },
];

const BROW_IDEALS: MetricIdealRow[] = [
  {
    metric_id: 'brow_height_l',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.35,
    green_range_min: 0.25,
    green_range_max: 0.45,
    yellow_range_min: 0.15,
    yellow_range_max: 0.55,
    direction_label_above: { 'pt-BR': 'sobrancelha elevada' },
    direction_label_below: { 'pt-BR': 'sobrancelha baixa' },
    population_reference_note:
      'Farkas (1994): brow–to–eye distance ~11 mm at ICD ~32 mm → 0.34 ICU; adopted 0.35.',
  },
  {
    metric_id: 'brow_height_r',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.35,
    green_range_min: 0.25,
    green_range_max: 0.45,
    yellow_range_min: 0.15,
    yellow_range_max: 0.55,
    direction_label_above: { 'pt-BR': 'sobrancelha elevada' },
    direction_label_below: { 'pt-BR': 'sobrancelha baixa' },
    population_reference_note:
      'Farkas (1994): brow–to–eye distance ~11 mm at ICD ~32 mm → 0.34 ICU; adopted 0.35.',
  },
  {
    metric_id: 'brow_arch_peak_l',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.67,
    green_range_min: 0.57,
    green_range_max: 0.77,
    yellow_range_min: 0.47,
    yellow_range_max: 0.87,
    direction_label_above: { 'pt-BR': 'arco muito lateral' },
    direction_label_below: { 'pt-BR': 'arco muito medial' },
    population_reference_note:
      'Farkas (1994) / Romo (2006): arch apex at ~2/3 from inner to outer corner, above lateral limbus.',
  },
  {
    metric_id: 'brow_arch_peak_r',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.67,
    green_range_min: 0.57,
    green_range_max: 0.77,
    yellow_range_min: 0.47,
    yellow_range_max: 0.87,
    direction_label_above: { 'pt-BR': 'arco muito lateral' },
    direction_label_below: { 'pt-BR': 'arco muito medial' },
    population_reference_note:
      'Farkas (1994) / Romo (2006): arch apex at ~2/3 from inner to outer corner, above lateral limbus.',
  },
  {
    metric_id: 'brow_thickness_l',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.20,
    green_range_min: 0.13,
    green_range_max: 0.27,
    yellow_range_min: 0.08,
    yellow_range_max: 0.32,
    direction_label_above: { 'pt-BR': 'sobrancelha espessa' },
    direction_label_below: { 'pt-BR': 'sobrancelha fina' },
    population_reference_note:
      'Farkas (1994): brow height ~7–8 mm at ICD ~32 mm → 0.22–0.25; proxy via arch vertical span; adopted 0.20.',
  },
  {
    metric_id: 'brow_thickness_r',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.20,
    green_range_min: 0.13,
    green_range_max: 0.27,
    yellow_range_min: 0.08,
    yellow_range_max: 0.32,
    direction_label_above: { 'pt-BR': 'sobrancelha espessa' },
    direction_label_below: { 'pt-BR': 'sobrancelha fina' },
    population_reference_note:
      'Farkas (1994): brow height ~7–8 mm at ICD ~32 mm → 0.22–0.25; proxy via arch vertical span; adopted 0.20.',
  },
  {
    metric_id: 'brow_tail_drop_l',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: -0.05,
    green_range_min: -0.13,
    green_range_max: 0.03,
    yellow_range_min: -0.25,
    yellow_range_max: 0.10,
    direction_label_above: { 'pt-BR': 'cauda caída' },
    direction_label_below: { 'pt-BR': 'cauda muito levantada' },
    population_reference_note:
      'Farkas (1994): outer brow ~1 mm above inner brow level; Naini (2011): upswept tail; canonical ideal −0.05 ICU (outer slightly elevated).',
  },
  {
    metric_id: 'interbrow_distance_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 1.0,
    green_range_min: 0.85,
    green_range_max: 1.15,
    yellow_range_min: 0.70,
    yellow_range_max: 1.30,
    direction_label_above: { 'pt-BR': 'sobrancelhas muito afastadas' },
    direction_label_below: { 'pt-BR': 'sobrancelhas muito próximas' },
    population_reference_note:
      'Farkas (1994): interbrow space = ICD (1.0 ICU); ideal = 1.0.',
  },
];

// DEC-6: brow_thickness_l/r are presentation_only → EXCLUDED from region_metric_weight.
const BROW_REGION_WEIGHTS: Array<{ metricId: string; weight: number }> = [
  { metricId: 'brow_height_l',             weight: 1.0 },
  { metricId: 'brow_height_r',             weight: 1.0 },
  { metricId: 'brow_arch_peak_l',          weight: 1.0 },
  { metricId: 'brow_arch_peak_r',          weight: 1.0 },
  { metricId: 'brow_tail_drop_l',          weight: 1.2 },
  { metricId: 'interbrow_distance_ratio',  weight: 1.1 },
  // brow_thickness_l / brow_thickness_r intentionally omitted (presentation_only)
];

export class SeedBrowFamily1746000090000 implements MigrationInterface {
  name = 'SeedBrowFamily1746000090000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const row of BROW_DEFINITIONS) {
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

    for (const row of BROW_IDEALS) {
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

    for (const w of BROW_REGION_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ($1, 'brows', $2, $3)
           ON CONFLICT ON CONSTRAINT uq_region_metric_weight_version_region_metric DO NOTHING`,
        ['v1.0', w.metricId, w.weight],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = BROW_DEFINITIONS.map((r) => r.metric_id);
    if (ids.length > 0) {
      await queryRunner.query(
        `DELETE FROM region_metric_weight WHERE version = 'v1.0' AND region = 'brows' AND metric_id = ANY($1::text[])`,
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
