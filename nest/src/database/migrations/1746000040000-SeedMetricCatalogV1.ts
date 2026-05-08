/**
 * 0004 — Seed M1 metric catalog (PR-11).
 *
 * Inserts the 21 metric_definition rows (all M1 families: symmetry, thirds,
 * fifths, eyes) and 20 metric_ideal rows (all except dominant_third, which is
 * categorical and not compared against an ideal central value).
 *
 * Idempotent: all INSERTs use ON CONFLICT DO NOTHING.
 *
 * Design decisions:
 *   - metric_definition.version = 'v1.0' (FK to metric_registry_version)
 *   - metric_ideal.ideals_version = 'v1.0' (FK to ideals_version)
 *   - dominant_third has presentation_only=true — categorical, never scored
 *   - No metric_ideal row for dominant_third (range 0..0 would cause ÷0)
 *   - All display_name values are in {"pt-BR": "..."} JSONB format
 *   - default_weight_in_region = 1.0 for all (M2 will refine via YAML)
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

// ---------------------------------------------------------------------------
// metric_definition rows
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

const METRIC_DEFINITIONS: MetricDefinitionRow[] = [
  // ── symmetry ────────────────────────────────────────────────────────────
  {
    metric_id: 'midline_deviation',
    version: 'v1.0',
    family: 'symmetry',
    region: 'symmetry',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Desvio da Linha Média' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'eye_height_asymmetry',
    version: 'v1.0',
    family: 'symmetry',
    region: 'symmetry',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Assimetria de Altura dos Olhos' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'brow_height_asymmetry',
    version: 'v1.0',
    family: 'symmetry',
    region: 'symmetry',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Assimetria de Altura das Sobrancelhas' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'lip_canting_angle',
    version: 'v1.0',
    family: 'symmetry',
    region: 'symmetry',
    unit: 'degrees',
    display_name: { 'pt-BR': 'Ângulo de Inclinação Labial' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'global_asymmetry_index',
    version: 'v1.0',
    family: 'symmetry',
    region: 'symmetry',
    unit: 'index_0_1',
    display_name: { 'pt-BR': 'Índice Global de Assimetria' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.5,
    min_confidence_to_display: 0.4,
  },
  // ── thirds ───────────────────────────────────────────────────────────────
  {
    metric_id: 'upper_third_ratio',
    version: 'v1.0',
    family: 'thirds',
    region: 'symmetry',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção do Terço Superior' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'middle_third_ratio',
    version: 'v1.0',
    family: 'thirds',
    region: 'symmetry',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção do Terço Médio' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'lower_third_ratio',
    version: 'v1.0',
    family: 'thirds',
    region: 'symmetry',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção do Terço Inferior' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'dominant_third',
    version: 'v1.0',
    family: 'thirds',
    region: 'symmetry',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Terço Dominante' },
    presentation_only: true,   // categorical — not used in scoring
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 0.0,
    min_confidence_to_display: 0.4,
  },
  // ── fifths ───────────────────────────────────────────────────────────────
  {
    metric_id: 'fifth_1_ratio',
    version: 'v1.0',
    family: 'fifths',
    region: 'symmetry',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Quinto 1 — Lateral Esquerdo' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'fifth_2_ratio',
    version: 'v1.0',
    family: 'fifths',
    region: 'symmetry',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Quinto 2 — Paramediano Esquerdo' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'fifth_3_ratio',
    version: 'v1.0',
    family: 'fifths',
    region: 'symmetry',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Quinto 3 — Central' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'fifth_4_ratio',
    version: 'v1.0',
    family: 'fifths',
    region: 'symmetry',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Quinto 4 — Paramediano Direito' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'fifth_5_ratio',
    version: 'v1.0',
    family: 'fifths',
    region: 'symmetry',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Quinto 5 — Lateral Direito' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'intercanthal_to_eye_width_ratio',
    version: 'v1.0',
    family: 'fifths',
    region: 'symmetry',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Relação Intercanthal / Largura Ocular' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  // ── eyes ─────────────────────────────────────────────────────────────────
  {
    metric_id: 'eye_aperture_ratio_l',
    version: 'v1.0',
    family: 'eyes',
    region: 'eyes',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Abertura do Olho Esquerdo' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'eye_aperture_ratio_r',
    version: 'v1.0',
    family: 'eyes',
    region: 'eyes',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Abertura do Olho Direito' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'interpupillary_distance',
    version: 'v1.0',
    family: 'eyes',
    region: 'eyes',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Distância Interpupilar' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'intercanthal_distance',
    version: 'v1.0',
    family: 'eyes',
    region: 'eyes',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Distância Intercanthal' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'canthal_tilt_l',
    version: 'v1.0',
    family: 'eyes',
    region: 'eyes',
    unit: 'degrees',
    display_name: { 'pt-BR': 'Inclinação Canthal — Olho Esquerdo' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'canthal_tilt_r',
    version: 'v1.0',
    family: 'eyes',
    region: 'eyes',
    unit: 'degrees',
    display_name: { 'pt-BR': 'Inclinação Canthal — Olho Direito' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
];

// ---------------------------------------------------------------------------
// metric_ideal rows (all except dominant_third)
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

const METRIC_IDEALS: MetricIdealRow[] = [
  // ── symmetry ────────────────────────────────────────────────────────────
  {
    metric_id: 'midline_deviation',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: -0.05,
    green_range_max: 0.05,
    yellow_range_min: -0.15,
    yellow_range_max: 0.15,
    direction_label_above: { 'pt-BR': 'desvio para a direita' },
    direction_label_below: { 'pt-BR': 'desvio para a esquerda' },
    population_reference_note: 'Canonical: ideal = 0 (perfect symmetry)',
  },
  {
    metric_id: 'eye_height_asymmetry',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: -0.05,
    green_range_max: 0.05,
    yellow_range_min: -0.15,
    yellow_range_max: 0.15,
    direction_label_above: { 'pt-BR': 'olho esquerdo mais alto' },
    direction_label_below: { 'pt-BR': 'olho direito mais alto' },
    population_reference_note: null,
  },
  {
    metric_id: 'brow_height_asymmetry',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: -0.05,
    green_range_max: 0.05,
    yellow_range_min: -0.15,
    yellow_range_max: 0.15,
    direction_label_above: { 'pt-BR': 'sobrancelha esquerda mais alta' },
    direction_label_below: { 'pt-BR': 'sobrancelha direita mais alta' },
    population_reference_note: null,
  },
  {
    metric_id: 'lip_canting_angle',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: -1.0,
    green_range_max: 1.0,
    yellow_range_min: -3.0,
    yellow_range_max: 3.0,
    direction_label_above: { 'pt-BR': 'canto labial esquerdo mais alto' },
    direction_label_below: { 'pt-BR': 'canto labial direito mais alto' },
    population_reference_note: null,
  },
  {
    metric_id: 'global_asymmetry_index',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: 0.0,
    green_range_max: 0.05,
    yellow_range_min: 0.0,
    yellow_range_max: 0.15,
    direction_label_above: { 'pt-BR': 'assimetria global elevada' },
    direction_label_below: { 'pt-BR': 'assimetria global mínima' },
    population_reference_note: null,
  },
  // ── thirds ───────────────────────────────────────────────────────────────
  {
    metric_id: 'upper_third_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.333,
    green_range_min: 0.300,
    green_range_max: 0.367,
    yellow_range_min: 0.267,
    yellow_range_max: 0.400,
    direction_label_above: { 'pt-BR': 'terço superior dominante' },
    direction_label_below: { 'pt-BR': 'terço superior reduzido' },
    population_reference_note: 'Canonical: Farkas 1994, thirds rule (1/3 each)',
  },
  {
    metric_id: 'middle_third_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.333,
    green_range_min: 0.300,
    green_range_max: 0.367,
    yellow_range_min: 0.267,
    yellow_range_max: 0.400,
    direction_label_above: { 'pt-BR': 'terço médio dominante' },
    direction_label_below: { 'pt-BR': 'terço médio reduzido' },
    population_reference_note: null,
  },
  {
    metric_id: 'lower_third_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.333,
    green_range_min: 0.300,
    green_range_max: 0.367,
    yellow_range_min: 0.267,
    yellow_range_max: 0.400,
    direction_label_above: { 'pt-BR': 'terço inferior dominante' },
    direction_label_below: { 'pt-BR': 'terço inferior reduzido' },
    population_reference_note: null,
  },
  // dominant_third — intentionally skipped (categorical, presentation_only)
  // ── fifths ───────────────────────────────────────────────────────────────
  {
    metric_id: 'fifth_1_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.20,
    green_range_min: 0.17,
    green_range_max: 0.23,
    yellow_range_min: 0.14,
    yellow_range_max: 0.26,
    direction_label_above: { 'pt-BR': 'quinto lateral esquerdo largo' },
    direction_label_below: { 'pt-BR': 'quinto lateral esquerdo estreito' },
    population_reference_note: 'Canonical: fifths rule (each 1/5 of face width)',
  },
  {
    metric_id: 'fifth_2_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.20,
    green_range_min: 0.17,
    green_range_max: 0.23,
    yellow_range_min: 0.14,
    yellow_range_max: 0.26,
    direction_label_above: { 'pt-BR': 'quinto paramediano esquerdo largo' },
    direction_label_below: { 'pt-BR': 'quinto paramediano esquerdo estreito' },
    population_reference_note: null,
  },
  {
    metric_id: 'fifth_3_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.20,
    green_range_min: 0.17,
    green_range_max: 0.23,
    yellow_range_min: 0.14,
    yellow_range_max: 0.26,
    direction_label_above: { 'pt-BR': 'quinto central largo' },
    direction_label_below: { 'pt-BR': 'quinto central estreito' },
    population_reference_note: null,
  },
  {
    metric_id: 'fifth_4_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.20,
    green_range_min: 0.17,
    green_range_max: 0.23,
    yellow_range_min: 0.14,
    yellow_range_max: 0.26,
    direction_label_above: { 'pt-BR': 'quinto paramediano direito largo' },
    direction_label_below: { 'pt-BR': 'quinto paramediano direito estreito' },
    population_reference_note: null,
  },
  {
    metric_id: 'fifth_5_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.20,
    green_range_min: 0.17,
    green_range_max: 0.23,
    yellow_range_min: 0.14,
    yellow_range_max: 0.26,
    direction_label_above: { 'pt-BR': 'quinto lateral direito largo' },
    direction_label_below: { 'pt-BR': 'quinto lateral direito estreito' },
    population_reference_note: null,
  },
  {
    metric_id: 'intercanthal_to_eye_width_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 1.0,
    green_range_min: 0.85,
    green_range_max: 1.15,
    yellow_range_min: 0.70,
    yellow_range_max: 1.30,
    direction_label_above: { 'pt-BR': 'distância intercantal relativamente ampla' },
    direction_label_below: { 'pt-BR': 'distância intercantal relativamente estreita' },
    population_reference_note: 'Canonical: intercanthal width ≈ one eye width',
  },
  // ── eyes ─────────────────────────────────────────────────────────────────
  {
    metric_id: 'eye_aperture_ratio_l',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.30,
    green_range_min: 0.25,
    green_range_max: 0.35,
    yellow_range_min: 0.18,
    yellow_range_max: 0.45,
    direction_label_above: { 'pt-BR': 'olho esquerdo com abertura ampla' },
    direction_label_below: { 'pt-BR': 'olho esquerdo com abertura reduzida' },
    population_reference_note: 'Canonical: aperture ratio ~0.30 (height/width)',
  },
  {
    metric_id: 'eye_aperture_ratio_r',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.30,
    green_range_min: 0.25,
    green_range_max: 0.35,
    yellow_range_min: 0.18,
    yellow_range_max: 0.45,
    direction_label_above: { 'pt-BR': 'olho direito com abertura ampla' },
    direction_label_below: { 'pt-BR': 'olho direito com abertura reduzida' },
    population_reference_note: null,
  },
  {
    metric_id: 'interpupillary_distance',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 2.0,
    green_range_min: 1.8,
    green_range_max: 2.2,
    yellow_range_min: 1.5,
    yellow_range_max: 2.5,
    direction_label_above: { 'pt-BR': 'olhos afastados (wide-set)' },
    direction_label_below: { 'pt-BR': 'olhos próximos (close-set)' },
    population_reference_note: 'In intercanthal units; ideal ≈ 2.0 (= 2× ICD)',
  },
  {
    metric_id: 'intercanthal_distance',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 1.0,
    green_range_min: 0.90,
    green_range_max: 1.10,
    yellow_range_min: 0.75,
    yellow_range_max: 1.25,
    direction_label_above: { 'pt-BR': 'distância intercantal dilatada' },
    direction_label_below: { 'pt-BR': 'distância intercantal comprimida' },
    population_reference_note: 'Sanity-check: must be ~1.0 after normalisation (DEC-1)',
  },
  {
    metric_id: 'canthal_tilt_l',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: -1.0,
    green_range_max: 1.0,
    yellow_range_min: -5.0,
    yellow_range_max: 5.0,
    direction_label_above: { 'pt-BR': 'inclinação positiva (olho de gato) — esquerdo' },
    direction_label_below: { 'pt-BR': 'inclinação negativa (queda lateral) — esquerdo' },
    population_reference_note: null,
  },
  {
    metric_id: 'canthal_tilt_r',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 0.0,
    green_range_min: -1.0,
    green_range_max: 1.0,
    yellow_range_min: -5.0,
    yellow_range_max: 5.0,
    direction_label_above: { 'pt-BR': 'inclinação positiva (olho de gato) — direito' },
    direction_label_below: { 'pt-BR': 'inclinação negativa (queda lateral) — direito' },
    population_reference_note: null,
  },
];

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------
export class SeedMetricCatalogV1_1746000040000 implements MigrationInterface {
  name = 'SeedMetricCatalogV1_1746000040000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── metric_definition ──────────────────────────────────────────────────
    for (const row of METRIC_DEFINITIONS) {
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

    // ── metric_ideal ───────────────────────────────────────────────────────
    for (const row of METRIC_IDEALS) {
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = METRIC_IDEALS.map((r) => r.metric_id);
    if (ids.length > 0) {
      await queryRunner.query(
        `DELETE FROM metric_ideal WHERE ideals_version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [ids],
      );
    }
    const defIds = METRIC_DEFINITIONS.map((r) => r.metric_id);
    if (defIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM metric_definition WHERE version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [defIds],
      );
    }
  }
}
