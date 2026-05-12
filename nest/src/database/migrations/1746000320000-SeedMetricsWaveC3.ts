/**
 * PR-C3 Wave 3 — Seed final 10 metrics (jaw/brows/cheekbones/forehead/global).
 *
 * NEW metrics (10 inserts):
 *   jaw region (1):
 *     - mentolabial_fold_proxy           (intercanthal_units)
 *
 *   brows region (3):
 *     - brow_arch_peak_position_l        (index_0_1)
 *     - brow_arch_peak_position_r        (index_0_1)
 *     - intersuperciliary_distance_ratio (ratio)
 *
 *   cheekbones region (3):
 *     - buccal_fat_index                 (index_0_1)
 *     - ogee_curve_proxy                 (index_0_1)  pixel-dep stub
 *     - infraorbital_hollow_index        (intercanthal_units)
 *
 *   forehead region (2):
 *     - forehead_slope_proxy             (degrees)    pixel-dep stub
 *     - glabella_prominence_proxy        (intercanthal_units)
 *
 *   global region (1):
 *     - facial_index_anthropometric      (ratio)
 *
 * NEW metric_ideal rows (8 scoreable; ogee_curve_proxy + forehead_slope_proxy stubs skipped).
 *
 * NEW region_metric_weight v1.5 rows (8 scoreable metrics).
 *
 * Idempotent: ON CONFLICT DO NOTHING for all INSERTs.
 *
 * Landmark index reference (Mesh-478):
 *   jaw:        P_LOWER_LIP_BOT=17  P_MENTON=152
 *   brows:      LM_LEFT_BROW=[70,63,105,66,107]  LM_RIGHT_BROW=[336,296,334,293,300]
 *               P_BROW_LEFT_INNER=107  P_BROW_RIGHT_INNER=336
 *               P_BROW_LEFT_OUTER=70   P_BROW_RIGHT_OUTER=300
 *   cheekbones: P_LEFT_CHEEK=205  P_RIGHT_CHEEK=425  (LM_JAWLINE[3,13])
 *               P_LEFT_EYE_OUTER=33  P_RIGHT_EYE_OUTER=263
 *               P_LEFT_GONION=172  P_RIGHT_GONION=397
 *               P_TEAR_TROUGH_L=228  P_TEAR_TROUGH_R=448
 *               P_LEFT_EYE_BOT=145  P_RIGHT_EYE_BOT=374
 *   forehead:   P_NASION=168  P_BROW_LEFT_INNER=107  P_BROW_RIGHT_INNER=336
 *   global:     P_FOREHEAD_CROWN=10  P_MENTON=152
 *               P_LEFT_ZYGOMATIC=234  P_RIGHT_ZYGOMATIC=454
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
  // ── jaw ───────────────────────────────────────────────────────────────
  {
    metric_id: 'mentolabial_fold_proxy',
    version: 'v1.0',
    family: 'jaw',
    region: 'jaw',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Sulco Mentolabial (proxy)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [17, 152], // P_LOWER_LIP_BOT, P_MENTON
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },

  // ── brows ─────────────────────────────────────────────────────────────
  {
    metric_id: 'brow_arch_peak_position_l',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'index_0_1',
    display_name: { 'pt-BR': 'Posição do Pico do Arco da Sobrancelha Esq.' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [70, 63, 105, 66, 107], // LM_LEFT_BROW
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'brow_arch_peak_position_r',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'index_0_1',
    display_name: { 'pt-BR': 'Posição do Pico do Arco da Sobrancelha Dir.' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [336, 296, 334, 293, 300], // LM_RIGHT_BROW
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'intersuperciliary_distance_ratio',
    version: 'v1.0',
    family: 'brows',
    region: 'brows',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Razão de Distância Intersupercílio' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [107, 336], // P_BROW_LEFT_INNER, P_BROW_RIGHT_INNER
    default_weight_in_region: 1.1,
    min_confidence_to_display: 0.4,
  },

  // ── cheekbones ────────────────────────────────────────────────────────
  {
    metric_id: 'buccal_fat_index',
    version: 'v1.0',
    family: 'cheekbones',
    region: 'cheekbones',
    unit: 'index_0_1',
    display_name: { 'pt-BR': 'Índice de Bola de Bichat' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [205, 425, 33, 263, 172, 397], // cheek L/R, eye_outer L/R, gonion L/R
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'ogee_curve_proxy',
    version: 'v1.0',
    family: 'cheekbones',
    region: 'cheekbones',
    unit: 'index_0_1',
    display_name: { 'pt-BR': 'Curva Ogee (proxy)' },
    presentation_only: false,
    requires_pixel_analysis: true,  // DEC-10: requires lateral/oblique view
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.5,
  },
  {
    metric_id: 'infraorbital_hollow_index',
    version: 'v1.0',
    family: 'cheekbones',
    region: 'cheekbones',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Índice de Concavidade Infraorbital' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [228, 448, 145, 374], // tear_trough L/R, eye_bot L/R
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },

  // ── forehead ──────────────────────────────────────────────────────────
  {
    metric_id: 'forehead_slope_proxy',
    version: 'v1.0',
    family: 'forehead',
    region: 'forehead',
    unit: 'degrees',
    display_name: { 'pt-BR': 'Inclinação Frontal (proxy)' },
    presentation_only: false,
    requires_pixel_analysis: true,  // DEC-10: requires lateral view
    dependency_landmarks: [],
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.5,
  },
  {
    metric_id: 'glabella_prominence_proxy',
    version: 'v1.0',
    family: 'forehead',
    region: 'forehead',
    unit: 'intercanthal_units',
    display_name: { 'pt-BR': 'Proeminência da Glabela (proxy)' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [168, 107, 336], // P_NASION, brow inners
    default_weight_in_region: 1.0,
    min_confidence_to_display: 0.4,
  },

  // ── global ────────────────────────────────────────────────────────────
  {
    metric_id: 'facial_index_anthropometric',
    version: 'v1.0',
    family: 'global_shape',
    region: 'global',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Índice Facial Antropométrico' },
    presentation_only: false,
    requires_pixel_analysis: false,
    dependency_landmarks: [10, 152, 234, 454], // crown, menton, zyg L/R
    default_weight_in_region: 1.1,
    min_confidence_to_display: 0.4,
  },
];

// ---------------------------------------------------------------------------
// 2. NEW metric_ideal rows (8 — skip stubs ogee_curve_proxy + forehead_slope_proxy)
// ---------------------------------------------------------------------------
const NEW_IDEALS: MetricIdealRow[] = [
  // ── mentolabial_fold_proxy ────────────────────────────────────────────
  {
    metric_id: 'mentolabial_fold_proxy',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.40,
    green_range_min: 0.30,
    green_range_max: 0.50,
    yellow_range_min: 0.20,
    yellow_range_max: 0.60,
    direction_label_above: { 'pt-BR': 'distância lábio-mento alongada' },
    direction_label_below: { 'pt-BR': 'distância lábio-mento curta' },
    population_reference_note:
      'Naini (2011) §8: lower-lip-to-chin vertical ≈ 0.40 ICU in normocephalic adults. ' +
      'Frontal proxy for sagittal mentolabial sulcus depth. ' +
      'Green [0.30, 0.50]. Yellow [0.20, 0.60].',
  },

  // ── brow_arch_peak_position_l ─────────────────────────────────────────
  {
    metric_id: 'brow_arch_peak_position_l',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.50,
    green_range_min: 0.35,
    green_range_max: 0.75,
    yellow_range_min: 0.20,
    yellow_range_max: 0.85,
    direction_label_above: { 'pt-BR': 'pico lateral da sobrancelha' },
    direction_label_below: { 'pt-BR': 'pico medial da sobrancelha' },
    population_reference_note:
      'Position of arch peak between inner (0) and outer (1) brow points. ' +
      'Naini (2011) §4: lateral 2/3 (≈0.66) classically aesthetic; ' +
      'midline (0.50) used as conservative ideal. Green [0.35, 0.75]. Yellow [0.20, 0.85].',
  },

  // ── brow_arch_peak_position_r ─────────────────────────────────────────
  {
    metric_id: 'brow_arch_peak_position_r',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.50,
    green_range_min: 0.35,
    green_range_max: 0.75,
    yellow_range_min: 0.20,
    yellow_range_max: 0.85,
    direction_label_above: { 'pt-BR': 'pico lateral da sobrancelha' },
    direction_label_below: { 'pt-BR': 'pico medial da sobrancelha' },
    population_reference_note:
      'Mirror of brow_arch_peak_position_l. Naini (2011) §4.',
  },

  // ── intersuperciliary_distance_ratio ──────────────────────────────────
  {
    metric_id: 'intersuperciliary_distance_ratio',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'canonical',
    ideal_central_value: 1.00,
    green_range_min: 0.85,
    green_range_max: 1.20,
    yellow_range_min: 0.70,
    yellow_range_max: 1.35,
    direction_label_above: { 'pt-BR': 'sobrancelhas afastadas' },
    direction_label_below: { 'pt-BR': 'sobrancelhas próximas' },
    population_reference_note:
      'Naini (2011) §4: intersuperciliary distance ≈ ICD (1.0) is canonical. ' +
      'Green [0.85, 1.20]. Yellow [0.70, 1.35].',
  },

  // ── buccal_fat_index ──────────────────────────────────────────────────
  {
    metric_id: 'buccal_fat_index',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.45,
    green_range_min: 0.30,
    green_range_max: 0.60,
    yellow_range_min: 0.20,
    yellow_range_max: 0.70,
    direction_label_above: { 'pt-BR': 'preenchimento bucal acentuado' },
    direction_label_below: { 'pt-BR': 'pomada zigomática proeminente' },
    population_reference_note:
      'Vertical position of cheek anchor between eye line (0) and gonion (1); ' +
      'proxy for buccal-fat (Bichat) volume distribution. Naini (2011) §8: ' +
      'mid-position (≈0.45) typical of healthy adult mid-face. Green [0.30, 0.60]. Yellow [0.20, 0.70].',
  },

  // ── infraorbital_hollow_index ─────────────────────────────────────────
  {
    metric_id: 'infraorbital_hollow_index',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.08,
    green_range_min: 0.0,
    green_range_max: 0.13,
    yellow_range_min: 0.0,
    yellow_range_max: 0.18,
    direction_label_above: { 'pt-BR': 'sulco infraorbital profundo' },
    direction_label_below: { 'pt-BR': 'região infraorbital plana' },
    population_reference_note:
      'Average vertical drop from lower-lid to tear-trough anchor / ICD. ' +
      'Naini (2011) §5: 2–3 mm in young adults (≈0.06–0.10 ICU). ' +
      'Green [0, 0.13]. Yellow [0, 0.18].',
  },

  // ── glabella_prominence_proxy ─────────────────────────────────────────
  {
    metric_id: 'glabella_prominence_proxy',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 0.50,
    green_range_min: 0.35,
    green_range_max: 0.65,
    yellow_range_min: 0.25,
    yellow_range_max: 0.75,
    direction_label_above: { 'pt-BR': 'glabela larga' },
    direction_label_below: { 'pt-BR': 'glabela estreita' },
    population_reference_note:
      'Average lateral offset of inner brows from nasion midline / ICD. ' +
      'Naini (2011) §4: brow inners typically ≈ 0.5 ICU lateral to midline. ' +
      'Green [0.35, 0.65]. Yellow [0.25, 0.75].',
  },

  // ── facial_index_anthropometric ───────────────────────────────────────
  {
    metric_id: 'facial_index_anthropometric',
    metric_definition_version: 'v1.0',
    ideals_version: 'v1.0',
    ideal_type: 'population_statistical',
    ideal_central_value: 87.5,
    green_range_min: 85.0,
    green_range_max: 89.9,
    yellow_range_min: 80.0,
    yellow_range_max: 94.9,
    direction_label_above: { 'pt-BR': 'face longa (leptoprosópica)' },
    direction_label_below: { 'pt-BR': 'face larga (euriprosópica)' },
    population_reference_note:
      'Martin-Saller facial index = (face_height / bizygomatic_width) × 100. ' +
      'Anthropometric classes: hypereuryprosopic <80, euryprosopic 80–84.9, ' +
      'mesoprosopic 85–89.9 (adopted ideal centre 87.5), leptoprosopic 90–94.9, ' +
      'hyperleptoprosopic >95. Green [85, 89.9]. Yellow [80, 94.9].',
  },
];

// ---------------------------------------------------------------------------
// 3. region_metric_weight v1.5 rows (8 scoreable metrics)
// ---------------------------------------------------------------------------
const C3_WEIGHTS: Array<{ metricId: string; region: string; weight: number }> = [
  { metricId: 'mentolabial_fold_proxy',           region: 'jaw',         weight: 1.0 },
  { metricId: 'brow_arch_peak_position_l',        region: 'brows',       weight: 1.0 },
  { metricId: 'brow_arch_peak_position_r',        region: 'brows',       weight: 1.0 },
  { metricId: 'intersuperciliary_distance_ratio', region: 'brows',       weight: 1.1 },
  { metricId: 'buccal_fat_index',                 region: 'cheekbones',  weight: 1.0 },
  { metricId: 'infraorbital_hollow_index',        region: 'cheekbones',  weight: 1.0 },
  { metricId: 'glabella_prominence_proxy',        region: 'forehead',    weight: 1.0 },
  { metricId: 'facial_index_anthropometric',      region: 'global',      weight: 1.1 },
];

// ---------------------------------------------------------------------------
// Migration class
// ---------------------------------------------------------------------------
export class SeedMetricsWaveC31746000320000 implements MigrationInterface {
  name = 'SeedMetricsWaveC31746000320000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert metric_definition rows
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

    // 2. Insert metric_ideal rows
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
    for (const w of C3_WEIGHTS) {
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

    if (newIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM region_metric_weight
           WHERE version = 'v1.5' AND metric_id = ANY($1::text[])`,
        [newIds],
      );
      await queryRunner.query(
        `DELETE FROM metric_ideal
           WHERE ideals_version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [newIds],
      );
      await queryRunner.query(
        `DELETE FROM metric_definition
           WHERE version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [newIds],
      );
    }
  }
}
