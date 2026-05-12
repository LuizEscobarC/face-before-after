/**
 * PR-C2 Wave 2 — Seed 10 new metrics (mouth/nose/jaw extensions).
 *
 * NEW metrics (10 inserts):
 *   nose region (2):
 *     - nasolabial_angle_proxy        (degrees)  — pixel-dep stub (DEC-10)
 *     - alar_flare_index              (intercanthal_units)
 *
 *   mouth region (5):
 *     - cupids_bow_definition         (index_0_1)
 *     - lip_volume_ratio              (ratio)
 *     - oral_commissure_height_asym   (intercanthal_units)
 *     - philtrum_width_ratio          (ratio)
 *     - smile_line_curvature          (index_0_1)
 *
 *   jaw region (3):
 *     - chin_projection_proxy            (ratio)
 *     - mandibular_corpus_length_ratio   (ratio)
 *     - masseteric_prominence_proxy      (ratio)
 *
 * NEW metric_ideal rows (9 scoreable; nasolabial_angle_proxy stub gets none).
 *
 * NEW region_metric_weight v1.5 rows (9 scoreable metrics).
 *
 * Idempotent: ON CONFLICT DO NOTHING for all INSERTs.
 *
 * Landmark index reference (Mesh-478):
 *   nose:    P_NOSE_LEFT=48  P_NOSE_RIGHT=45  P_SUBNASALE=2  P_UPPER_LIP_TOP=82
 *   mouth:   P_PHILTRUM_LEFT=37  P_PHILTRUM_RIGHT=267
 *            P_LEFT_MOUTH=61  P_RIGHT_MOUTH=291
 *            P_UPPER_LIP_TOP=82  P_UPPER_LIP=13  P_LOWER_LIP=14  P_LOWER_LIP_BOT=17
 *   jaw:     P_LEFT_GONION=172  P_RIGHT_GONION=397  P_MENTON=152
 *            P_LEFT_ZYGOMATIC=234  P_RIGHT_ZYGOMATIC=454
 *            P_MASSETER_L=132  P_MASSETER_R=361  P_FOREHEAD_CROWN=10
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

// ---------------------------------------------------------------------------
// Types
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
// 1. NEW metric_definition rows (10 entirely new metrics)
// ---------------------------------------------------------------------------
const NEW_DEFINITIONS: MetricDefinitionRow[] = [
  // ── nose ──────────────────────────────────────────────────────────────
  {
    metric_id: 'nasolabial_angle_proxy',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'degrees',
    display_name: { 'pt-BR': 'Ângulo Nasolabial (proxy)' },
    presentation_only: false,
    requires_pixel_analysis: true,  // DEC-10: 2D frontal proxy degenerate; stub
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.5,
  },
  {
    metric_id: 'alar_flare_index',
    version: 'v1.0',
    family: 'nose',
    region: 'nose',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Índice de Abertura Alar' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [48, 45], // P_NOSE_LEFT, P_NOSE_RIGHT
    default_weight_in_region: 1.1,
    min_confidence_to_display: 0.4,
  },

  // ── mouth ─────────────────────────────────────────────────────────────
  {
    metric_id: 'cupids_bow_definition',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'index_0_1',
    display_name: { 'pt-BR': 'Definição do Arco do Cupido' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [37, 267, 82, 61, 291], // philtrum L/R, upper_lip_top, mouth L/R
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'lip_volume_ratio',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Razão de Volume Labial' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [82, 13, 14, 17], // P_UPPER_LIP_TOP, P_UPPER_LIP, P_LOWER_LIP, P_LOWER_LIP_BOT
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'oral_commissure_height_asym',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Assimetria de Altura das Comissuras Orais' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [61, 291], // P_LEFT_MOUTH, P_RIGHT_MOUTH
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'philtrum_width_ratio',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Razão da Largura do Filtro' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [37, 267, 61, 291], // philtrum L/R, mouth L/R
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'smile_line_curvature',
    version: 'v1.0',
    family: 'mouth',
    region: 'mouth',
    unit: 'index_0_1',
    display_name: { 'pt-BR': 'Curvatura da Linha do Sorriso' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [61, 291, 82], // mouth L/R, upper_lip_top
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },

  // ── jaw ───────────────────────────────────────────────────────────────
  {
    metric_id: 'chin_projection_proxy',
    version: 'v1.0',
    family: 'jaw',
    region: 'jaw',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Projeção do Mento (proxy)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [2, 152, 10], // P_SUBNASALE, P_MENTON, P_FOREHEAD_CROWN
    default_weight_in_region: 1.1,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'mandibular_corpus_length_ratio',
    version: 'v1.0',
    family: 'jaw',
    region: 'jaw',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Razão do Comprimento do Corpo Mandibular' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [172, 397, 152, 234, 454], // gonion L/R, menton, zygomatic L/R
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'masseteric_prominence_proxy',
    version: 'v1.0',
    family: 'jaw',
    region: 'jaw',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proeminência Massetérica (proxy)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [132, 361, 234, 454], // masseter L/R, zygomatic L/R
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
];

// ---------------------------------------------------------------------------
// 2. NEW metric_ideal rows (9 — skip nasolabial_angle_proxy stub)
// ---------------------------------------------------------------------------
const NEW_IDEALS: MetricIdealRow[] = [
  // ── alar_flare_index ────────────────────────────────────────────────────
  {
    metric_id: 'alar_flare_index',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 1.00,
    green_range_min: 0.85,
    green_range_max: 1.15,
    yellow_range_min: 0.70,
    yellow_range_max: 1.30,
    direction_label_above: { 'pt-BR': 'base alar larga' },
    direction_label_below: { 'pt-BR': 'base alar estreita' },
    population_reference_note:
      'Naini (2011) §6: alar base width ≈ intercanthal distance (1.0 ICU) is canonical. ' +
      'Green [0.85, 1.15]. Yellow [0.70, 1.30].',
  },

  // ── cupids_bow_definition ──────────────────────────────────────────────
  {
    metric_id: 'cupids_bow_definition',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.05,
    green_range_min: 0.02,
    green_range_max: 0.10,
    yellow_range_min: 0.0,
    yellow_range_max: 0.15,
    direction_label_above: { 'pt-BR': 'arco do cupido pronunciado' },
    direction_label_below: { 'pt-BR': 'arco do cupido plano' },
    population_reference_note:
      'Naini (2011) §7 lip aesthetics: moderate cupid\'s bow (3–6% of mouth width) ' +
      'preferred over flat or excessive peak. Green [0.02, 0.10]. Yellow [0, 0.15].',
  },

  // ── lip_volume_ratio ───────────────────────────────────────────────────
  {
    metric_id: 'lip_volume_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.625,
    green_range_min: 0.45,
    green_range_max: 0.85,
    yellow_range_min: 0.30,
    yellow_range_max: 1.00,
    direction_label_above: { 'pt-BR': 'lábio superior dominante' },
    direction_label_below: { 'pt-BR': 'lábio inferior dominante' },
    population_reference_note:
      'Naini (2011) §7: upper:lower vermilion ≈ 1:1.6 (golden-section), ' +
      'i.e. upper/lower = 0.625. Green [0.45, 0.85]. Yellow [0.30, 1.00].',
  },

  // ── oral_commissure_height_asym ─────────────────────────────────────────
  {
    metric_id: 'oral_commissure_height_asym',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.025,
    yellow_range_min: 0.0,
    yellow_range_max: 0.05,
    direction_label_above: { 'pt-BR': 'comissuras desniveladas' },
    direction_label_below: { 'pt-BR': 'neutro' },
    population_reference_note:
      'Farkas (1994); Naini (2011): level oral commissures (0 ICU) is canonical. ' +
      'Green [0, 0.025] ≈ [0, 0.8 mm]. Yellow [0, 0.05] ≈ [0, 1.6 mm].',
  },

  // ── philtrum_width_ratio ───────────────────────────────────────────────
  {
    metric_id: 'philtrum_width_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.30,
    green_range_min: 0.20,
    green_range_max: 0.45,
    yellow_range_min: 0.10,
    yellow_range_max: 0.55,
    direction_label_above: { 'pt-BR': 'filtro largo' },
    direction_label_below: { 'pt-BR': 'filtro estreito' },
    population_reference_note:
      'Naini (2011) §7: philtrum width ≈ 30% of mouth width. ' +
      'Green [0.20, 0.45]. Yellow [0.10, 0.55].',
  },

  // ── smile_line_curvature ───────────────────────────────────────────────
  {
    metric_id: 'smile_line_curvature',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.08,
    green_range_min: 0.04,
    green_range_max: 0.15,
    yellow_range_min: 0.0,
    yellow_range_max: 0.20,
    direction_label_above: { 'pt-BR': 'lábio muito arqueado' },
    direction_label_below: { 'pt-BR': 'lábio plano' },
    population_reference_note:
      'Hulsey (1970); Naini (2011) §7 smile aesthetics: slight upper-lip arch ' +
      '(4–15% of mouth width) preferred over flat. Green [0.04, 0.15]. Yellow [0, 0.20].',
  },

  // ── chin_projection_proxy ──────────────────────────────────────────────
  {
    metric_id: 'chin_projection_proxy',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.33,
    green_range_min: 0.30,
    green_range_max: 0.36,
    yellow_range_min: 0.27,
    yellow_range_max: 0.40,
    direction_label_above: { 'pt-BR': 'terço inferior alongado' },
    direction_label_below: { 'pt-BR': 'terço inferior curto' },
    population_reference_note:
      'Farkas (1994) facial-thirds rule: lower third (subnasale → menton) ≈ 1/3 of total face height. ' +
      'Frontal proxy for chin projection (true sagittal projection requires lateral view). ' +
      'Green [0.30, 0.36]. Yellow [0.27, 0.40].',
  },

  // ── mandibular_corpus_length_ratio ─────────────────────────────────────
  {
    metric_id: 'mandibular_corpus_length_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.25,
    green_range_min: 0.20,
    green_range_max: 0.30,
    yellow_range_min: 0.15,
    yellow_range_max: 0.35,
    direction_label_above: { 'pt-BR': 'corpo mandibular longo' },
    direction_label_below: { 'pt-BR': 'corpo mandibular curto' },
    population_reference_note:
      'Farkas (1994) mandibular corpus norms: gonion-to-menton chord ≈ 0.20–0.30 of bizygomatic width. ' +
      'Green [0.20, 0.30]. Yellow [0.15, 0.35].',
  },

  // ── masseteric_prominence_proxy ────────────────────────────────────────
  {
    metric_id: 'masseteric_prominence_proxy',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.55,
    green_range_min: 0.45,
    green_range_max: 0.65,
    yellow_range_min: 0.35,
    yellow_range_max: 0.75,
    direction_label_above: { 'pt-BR': 'masseter proeminente' },
    direction_label_below: { 'pt-BR': 'masseter retraído' },
    population_reference_note:
      'Naini (2011) §8 lower-face contour: masseter width ≈ 0.50–0.60 of bizygomatic width. ' +
      'Frontal landmark proxy. Green [0.45, 0.65]. Yellow [0.35, 0.75].',
  },
];

// ---------------------------------------------------------------------------
// 3. region_metric_weight v1.5 rows (9 scoreable metrics)
// ---------------------------------------------------------------------------
const C2_WEIGHTS: Array<{ metricId: string; region: string; weight: number }> = [
  { metricId: 'alar_flare_index',                region: 'nose',  weight: 1.1 },
  { metricId: 'cupids_bow_definition',           region: 'mouth', weight: 1.0 },
  { metricId: 'lip_volume_ratio',                region: 'mouth', weight: 1.0 },
  { metricId: 'oral_commissure_height_asym',     region: 'mouth', weight: 1.0 },
  { metricId: 'philtrum_width_ratio',            region: 'mouth', weight: 1.0 },
  { metricId: 'smile_line_curvature',            region: 'mouth', weight: 1.0 },
  { metricId: 'chin_projection_proxy',           region: 'jaw',   weight: 1.1 },
  { metricId: 'mandibular_corpus_length_ratio',  region: 'jaw',   weight: 1.0 },
  { metricId: 'masseteric_prominence_proxy',     region: 'jaw',   weight: 1.0 },
];

// ---------------------------------------------------------------------------
// Migration class
// ---------------------------------------------------------------------------
export class SeedMetricsWaveC21746000310000 implements MigrationInterface {
  name = 'SeedMetricsWaveC21746000310000';

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

    // 2. Insert new metric_ideal rows
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

    // 3. Insert region_metric_weight v1.5 rows
    for (const w of C2_WEIGHTS) {
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

    // Remove weights
    if (newIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM region_metric_weight
           WHERE version = 'v1.5' AND metric_id = ANY($1::text[])`,
        [newIds],
      );
    }

    // Remove ideals
    if (newIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM metric_ideal
           WHERE ideals_version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [newIds],
      );
    }

    // Remove definitions
    if (newIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM metric_definition
           WHERE version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [newIds],
      );
    }
  }
}
