/**
 * PR-C1 Wave 1 — Seed 10 new metrics + promote 3 stubs (PR-C1).
 *
 * NEW metrics (6 inserts):
 *   brow_tail_drop_r          — brows   — mirror of brow_tail_drop_l
 *   scleral_show_lower_l/r    — eyes    — inferior scleral show via iris-bottom vs. lid
 *   palpebral_fissure_inc.    — eyes    — bilateral mean canthal tilt (°)
 *   supratarsal_fold_vis.     — eyes    — pixel-dep stub (DEC-10)
 *   nasal_dorsum_straightness — nose    — max perpendicular bridge deviation (ICU)
 *   columella_show            — nose    — subnasale vs. alar-base vertical (ICU)
 *
 * PROMOTIONS (UPDATE existing rows):
 *   hairline_curvature_index  — forehead — requires_pixel_analysis: true → false
 *   e_line_deviation          — global   — requires_pixel_analysis: true → false,
 *                                          unit: 'ratio' → 'intercanthal_units'
 *   face_shape_classification — global   — presentation_only: true → false
 *
 * NEW metric_ideal rows (9 scoreable + 0 for supratarsal stub):
 *   + INSERT for all 6 new scoreable metrics
 *   + INSERT for hairline_curvature_index (none existed)
 *   + INSERT for e_line_deviation (none existed)
 *   + face_shape_classification already had ideal row — SKIP
 *
 * NEW region_metric_weight v1.5 rows (9 scoreable metrics):
 *   all except supratarsal_fold_visibility (requires_pixel_analysis=true)
 *
 * Idempotent: ON CONFLICT DO NOTHING for all INSERTs.
 *
 * Landmark index reference (Mesh-478):
 *   P_BROW_RIGHT_OUTER = 300  P_BROW_RIGHT_INNER = 336
 *   P_LEFT_EYE_BOT  = 145    P_RIGHT_EYE_BOT = 374
 *   P_LEFT_IRIS_BOT = 470    P_RIGHT_IRIS_BOT = 475
 *   P_LEFT_EYE_INNER/OUTER = 133/33  P_RIGHT_EYE_INNER/OUTER = 362/263
 *   P_NASION = 168  P_NOSE_TIP = 1  LM_NOSE_BRIDGE = [168,6,197,195]
 *   P_SUBNASALE = 2  P_NOSE_LEFT = 48  P_NOSE_RIGHT = 45
 *   P_UPPER_LIP_TOP = 82  P_MENTON = 152
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

// ---------------------------------------------------------------------------
// Types (mirror SeedBrowFamily pattern)
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

// ---------------------------------------------------------------------------
// 1. NEW metric_definition rows (6 entirely new metrics)
// ---------------------------------------------------------------------------
const NEW_DEFINITIONS: MetricDefinitionRow[] = [
  // ── brows ──────────────────────────────────────────────────────────────
  {
    metric_id: 'brow_tail_drop_r',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Queda da Cauda da Sobrancelha Dir.' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [336, 300], // P_BROW_RIGHT_INNER, P_BROW_RIGHT_OUTER
    default_weight_in_region: 1.2,
    min_confidence_to_display: 0.4,
  },

  // ── eyes ───────────────────────────────────────────────────────────────
  {
    metric_id: 'scleral_show_lower_l',
    version: 'v1.0',
    family: 'eyes',
    region: 'eyes',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Exposição Escleral Inferior Esq.' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [470, 145], // P_LEFT_IRIS_BOT, P_LEFT_EYE_BOT
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'scleral_show_lower_r',
    version: 'v1.0',
    family: 'eyes',
    region: 'eyes',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Exposição Escleral Inferior Dir.' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [475, 374], // P_RIGHT_IRIS_BOT, P_RIGHT_EYE_BOT
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'palpebral_fissure_inclination',
    version: 'v1.0',
    family: 'eyes',
    region: 'eyes',
    unit: 'degrees',
    display_name: { 'pt-BR': 'Inclinação da Fissura Palpebral' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [133, 33, 362, 263], // L inner/outer, R inner/outer canthi
    default_weight_in_region: 1.1,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'supratarsal_fold_visibility',
    version: 'v1.0',
    family: 'eyes',
    region: 'eyes',
    unit: 'index_0_1',
    display_name: { 'pt-BR': 'Visibilidade da Prega Supratarsal' },
    presentation_only: false,
    requires_pixel_analysis: true,  // DEC-10: pixel-dep stub
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.5,
  },

  // ── nose ───────────────────────────────────────────────────────────────
  {
    metric_id: 'nasal_dorsum_straightness',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Retidão do Dorso Nasal' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [168, 6, 197, 195, 1], // LM_NOSE_BRIDGE + P_NOSE_TIP
    default_weight_in_region: 1.1,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'columella_show',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Exposição da Columela' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [2, 48, 45], // P_SUBNASALE, P_NOSE_LEFT, P_NOSE_RIGHT
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
];

// ---------------------------------------------------------------------------
// 2. NEW metric_ideal rows
//    Includes: all 6 new scoreable metrics + hairline_curvature_index + e_line_deviation
//    Excludes: supratarsal_fold_visibility (stub, no ideal)
//    Excludes: face_shape_classification (already has v1.0 ideal row)
// ---------------------------------------------------------------------------
const NEW_IDEALS: MetricIdealRow[] = [
  // ── brow_tail_drop_r ────────────────────────────────────────────────────
  {
    metric_id: 'brow_tail_drop_r',
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
      'Mirror of brow_tail_drop_l. Farkas (1994): outer brow ~1 mm above inner brow; Naini (2011): upswept tail; canonical ideal −0.05 ICU.',
  },

  // ── scleral_show_lower_l ────────────────────────────────────────────────
  {
    metric_id: 'scleral_show_lower_l',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.015,
    yellow_range_min: 0.0,
    yellow_range_max: 0.035,
    direction_label_above: { 'pt-BR': 'exposição escleral inferior' },
    direction_label_below: { 'pt-BR': 'neutro' },
    population_reference_note:
      'Naini (2011) §5: inferior scleral show absent in primary gaze is ideal. ' +
      'Green [0, 0.015 ICU] ≈ [0, 0.5 mm]. Yellow [0, 0.035] ≈ [0, 1 mm].',
  },

  // ── scleral_show_lower_r ────────────────────────────────────────────────
  {
    metric_id: 'scleral_show_lower_r',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.015,
    yellow_range_min: 0.0,
    yellow_range_max: 0.035,
    direction_label_above: { 'pt-BR': 'exposição escleral inferior' },
    direction_label_below: { 'pt-BR': 'neutro' },
    population_reference_note:
      'Mirror of scleral_show_lower_l. Naini (2011) §5.',
  },

  // ── palpebral_fissure_inclination ───────────────────────────────────────
  {
    metric_id: 'palpebral_fissure_inclination',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 2.0,
    green_range_min: -1.0,
    green_range_max: 5.0,
    yellow_range_min: -4.0,
    yellow_range_max: 8.0,
    direction_label_above: { 'pt-BR': 'inclinação positiva acentuada' },
    direction_label_below: { 'pt-BR': 'inclinação negativa (antimongolóide)' },
    population_reference_note:
      'Naini (2011) §5: 3–5° positive slant associated with femininity/youth. ' +
      'Sex-neutral adopted midpoint 2°. Green [−1°, +5°]. Yellow [−4°, +8°].',
  },

  // ── nasal_dorsum_straightness ────────────────────────────────────────────
  {
    metric_id: 'nasal_dorsum_straightness',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.025,
    yellow_range_min: 0.0,
    yellow_range_max: 0.05,
    direction_label_above: { 'pt-BR': 'dorso desviado' },
    direction_label_below: { 'pt-BR': 'dorso reto' },
    population_reference_note:
      'Naini (2011) §6; Rohrich & Muzaffar (2003): nasal deviation < 0.025 ICU (~0.8 mm) clinically imperceptible. ' +
      'Green [0, 0.025]. Yellow [0, 0.05].',
  },

  // ── columella_show ───────────────────────────────────────────────────────
  {
    metric_id: 'columella_show',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.05,
    green_range_min: -0.03,
    green_range_max: 0.13,
    yellow_range_min: -0.08,
    yellow_range_max: 0.18,
    direction_label_above: { 'pt-BR': 'exposição de columela excessiva' },
    direction_label_below: { 'pt-BR': 'exposição de columela insuficiente' },
    population_reference_note:
      'Naini (2011) §6: 1–2 mm columella show desirable. ' +
      'At ICD = 32 mm → 0.03–0.06 ICU; adopted ideal 0.05 ICU. ' +
      'Green [−0.03, 0.13]. Yellow [−0.08, 0.18].',
  },

  // ── hairline_curvature_index (promoted — new ideal) ─────────────────────
  {
    metric_id: 'hairline_curvature_index',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.48,
    green_range_min: 0.38,
    green_range_max: 0.58,
    yellow_range_min: 0.28,
    yellow_range_max: 0.68,
    direction_label_above: { 'pt-BR': 'arco frontal muito pronunciado' },
    direction_label_below: { 'pt-BR': 'arco frontal plano' },
    population_reference_note:
      'PR-C1 landmark proxy: sagitta / chord of brow–crown–brow arc. ' +
      'Ideal 0.48 derived from Farkas (1994) and Naini (2011) §4 forehead curvature norms. ' +
      'Green [0.38, 0.58]. Yellow [0.28, 0.68].',
  },

  // ── e_line_deviation (promoted — new ideal) ──────────────────────────────
  {
    metric_id: 'e_line_deviation',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.025,
    yellow_range_min: 0.0,
    yellow_range_max: 0.05,
    direction_label_above: { 'pt-BR': 'desvio lateral do lábio superior' },
    direction_label_below: { 'pt-BR': 'neutro' },
    population_reference_note:
      'PR-C1 frontal proxy (Ricketts 1954 sagittal adapted to 2D frontal). ' +
      'Ideal 0.0 ICU (symmetric lip-on-midline). Green [0, 0.025]. Yellow [0, 0.05]. ' +
      'Note: true sagittal E-line deferred to multi-photo PR.',
  },
];

// ---------------------------------------------------------------------------
// 3. region_metric_weight v1.5 rows (all scoreable C1 metrics)
//    Excludes: supratarsal_fold_visibility (requires_pixel_analysis=true)
// ---------------------------------------------------------------------------
const C1_WEIGHTS: Array<{ metricId: string; region: string; weight: number }> = [
  { metricId: 'brow_tail_drop_r',              region: 'brows',   weight: 1.2 },
  { metricId: 'scleral_show_lower_l',          region: 'eyes',    weight: 1.0 },
  { metricId: 'scleral_show_lower_r',          region: 'eyes',    weight: 1.0 },
  { metricId: 'palpebral_fissure_inclination', region: 'eyes',    weight: 1.1 },
  { metricId: 'nasal_dorsum_straightness',     region: 'nose',    weight: 1.1 },
  { metricId: 'columella_show',                region: 'nose',    weight: 1.0 },
  { metricId: 'hairline_curvature_index',      region: 'forehead', weight: 1.0 },
  { metricId: 'e_line_deviation',              region: 'global',  weight: 1.0 },
  { metricId: 'face_shape_classification',     region: 'global',  weight: 1.1 },
];

// ---------------------------------------------------------------------------
// Migration class
// ---------------------------------------------------------------------------
export class SeedMetricsWaveC11746000300000 implements MigrationInterface {
  name = 'SeedMetricsWaveC11746000300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert new metric_definition rows
    for (const row of NEW_DEFINITIONS) {
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

    // 2. Promote existing stubs
    // hairline_curvature_index: lift requires_pixel_analysis
    await queryRunner.query(
      `UPDATE metric_definition
         SET requires_pixel_analysis = false
       WHERE metric_id = 'hairline_curvature_index' AND version = 'v1.0'`,
    );

    // e_line_deviation: lift requires_pixel_analysis + fix unit
    await queryRunner.query(
      `UPDATE metric_definition
         SET requires_pixel_analysis = false,
             unit = 'intercanthal_units'
       WHERE metric_id = 'e_line_deviation' AND version = 'v1.0'`,
    );

    // face_shape_classification: promote to scored metric
    await queryRunner.query(
      `UPDATE metric_definition
         SET presentation_only = false
       WHERE metric_id = 'face_shape_classification' AND version = 'v1.0'`,
    );

    // 3. Insert new metric_ideal rows
    for (const row of NEW_IDEALS) {
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

    // 4. Insert region_metric_weight v1.5 rows
    for (const w of C1_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ('v1.5', $1, $2, $3)
           ON CONFLICT ON CONSTRAINT uq_region_metric_weight_version_region_metric DO NOTHING`,
        [w.region, w.metricId, w.weight],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const newIds = NEW_DEFINITIONS.map((r) => r.metric_id);

    // Remove weights for new metrics
    if (newIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM region_metric_weight
           WHERE version = 'v1.5' AND metric_id = ANY($1::text[])`,
        [newIds],
      );
    }

    // Remove weights for promoted metrics
    await queryRunner.query(
      `DELETE FROM region_metric_weight
         WHERE version = 'v1.5'
           AND metric_id IN ('hairline_curvature_index', 'e_line_deviation', 'face_shape_classification')`,
    );

    // Remove new ideals
    if (newIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM metric_ideal
           WHERE ideals_version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [newIds],
      );
    }

    // Remove promoted ideals (hairline + e_line — face_shape_classification ideal pre-existed)
    await queryRunner.query(
      `DELETE FROM metric_ideal
         WHERE ideals_version = 'v1.0'
           AND metric_id IN ('hairline_curvature_index', 'e_line_deviation')`,
    );

    // Revert promotions
    await queryRunner.query(
      `UPDATE metric_definition
         SET requires_pixel_analysis = true
       WHERE metric_id IN ('hairline_curvature_index', 'e_line_deviation') AND version = 'v1.0'`,
    );
    await queryRunner.query(
      `UPDATE metric_definition
         SET unit = 'ratio'
       WHERE metric_id = 'e_line_deviation' AND version = 'v1.0'`,
    );
    await queryRunner.query(
      `UPDATE metric_definition
         SET presentation_only = true
       WHERE metric_id = 'face_shape_classification' AND version = 'v1.0'`,
    );

    // Remove new definitions
    if (newIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM metric_definition
           WHERE version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [newIds],
      );
    }
  }
}
