/**
 * 0013 — Seed M2 phi/golden-ratio family (PR-20).
 *
 * Inserts 4 metric_definition rows for the phi family.
 * NO metric_ideal rows — all metrics are presentation_only=true (DEC-6).
 * NO region_metric_weight rows — presentation_only metrics are never scored.
 *
 * Metrics (4 total):
 *   phi_face_height_to_width   — face_height / bizygomatic_width ≈ φ
 *   phi_lower_face_segments    — (lower_lip−subnasale) / (menton−lower_lip) ≈ φ
 *   phi_eye_to_mouth           — (mouth_mid−iris_mid) / (menton−mouth_mid) ≈ φ
 *   phi_nose_to_lip            — mouth_width / nose_width ≈ φ
 *
 * Golden ratio: φ = (1+√5)/2 ≈ 1.6180339887
 *
 * DEC-6 rationale: φ (1.618) is NOT the population mean for any of these
 * measurements (Farkas 1994 reports ~1.30–1.40 for face H/W; ~1.47 for
 * nose-to-lip). These metrics serve as aesthetic overlays only and must
 * never affect regional_score or global_score.
 *
 * Population references (included here because no metric_ideal rows exist):
 *   phi_face_height_to_width:
 *     Marquardt SR (2002). Beauty Analysis — Phi Mask. https://www.beautyanalysis.com
 *     Livio M (2002). The Golden Ratio. Broadway Books. ISBN 0-7679-0816-X.
 *     Caveat: Farkas (1994) Table 4-2 reports 1.30–1.40 (NOT 1.618).
 *
 *   phi_lower_face_segments:
 *     Ricketts RM (1982). Am J Orthod 81(5):351–370. DOI: 10.1016/0002-9416(82)90073-2
 *     Marquardt SR (2002). Phi Mask — lower face. https://www.beautyanalysis.com
 *     Caveat: Farkas (1994) reports sublabial:mento ≈ 1.2–1.5; Naini (2011) §2.5.
 *
 *   phi_eye_to_mouth:
 *     Marquardt SR (2002). Phi Mask — vertical segments. https://www.beautyanalysis.com
 *     Edler RJ (2001). J Orthod 28(2):159–168. DOI: 10.1093/ortho/28.2.159
 *     Caveat: eye-to-mouth:mouth-to-chin ranges 1.2–1.9 (Naini 2011 §2.4).
 *
 *   phi_nose_to_lip:
 *     Marquardt SR (2002). Phi Mask — horizontal. https://www.beautyanalysis.com
 *     Livio M (2002). The Golden Ratio. Broadway Books. ISBN 0-7679-0816-X.
 *     Edler RJ (2001). J Orthod 28(2):159–168. DOI: 10.1093/ortho/28.2.159
 *     Caveat: Farkas (1994) reports boca:alar ≈ 1.47; Naini (2011) range 1.4–1.6.
 *
 * Landmark index reference (Mesh-478):
 *   P_FOREHEAD_CROWN      = 10
 *   P_MENTON              = 152
 *   P_LEFT_ZYGOMATIC      = 338
 *   P_RIGHT_ZYGOMATIC     = 378
 *   P_LEFT_IRIS_CENTER    = 468
 *   P_RIGHT_IRIS_CENTER   = 473
 *   P_LEFT_MOUTH          = 61
 *   P_RIGHT_MOUTH         = 291
 *   P_SUBNASALE           = 2
 *   P_LOWER_LIP           = 14
 *   P_NOSE_LEFT           = 48
 *   P_NOSE_RIGHT          = 45
 *
 * Idempotent: ON CONFLICT DO NOTHING.
 * Note: 'global' already exists in metric_region_enum since 1746000010000 — no ALTER TYPE needed.
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

// All phi metrics are presentation_only=true (DEC-6). They serve as decorative
// golden-ratio overlays and must never enter regional_score or global_score.
const PHI_DEFINITIONS: MetricDefinitionRow[] = [
  {
    metric_id: 'phi_face_height_to_width',
    version: 'v1.0',
    family: 'phi',
    region: 'global',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção Áurea Altura/Largura' },
    presentation_only: true,  // DEC-6: φ ≠ population mean; Farkas 1994 → ~1.35
    requires_pixel_analysis: false,
    // crown(10), menton(152), zyg_L(338), zyg_R(378)
    dependency_landmarks: [10, 152, 338, 378],
    default_weight_in_region: 0.0,  // excluded from scoring (presentation_only, DEC-6)
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'phi_lower_face_segments',
    version: 'v1.0',
    family: 'phi',
    region: 'global',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Segmentos Áureos do Terço Inferior' },
    presentation_only: true,  // DEC-6: Ricketts aesthetic ideal only; Naini 2011 §2.5
    requires_pixel_analysis: false,
    // subnasale(2), lower_lip(14), menton(152)
    dependency_landmarks: [2, 14, 152],
    default_weight_in_region: 0.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'phi_eye_to_mouth',
    version: 'v1.0',
    family: 'phi',
    region: 'global',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção Áurea Olho-Boca' },
    presentation_only: true,  // DEC-6: Marquardt phi mask overlay; Edler 2001
    requires_pixel_analysis: false,
    // left_iris(468), right_iris(473), left_mouth(61), right_mouth(291), menton(152)
    dependency_landmarks: [468, 473, 61, 291, 152],
    default_weight_in_region: 0.0,
    min_confidence_to_display: 0.4,
  },
  {
    metric_id: 'phi_nose_to_lip',
    version: 'v1.0',
    family: 'phi',
    region: 'global',
    unit: 'ratio',
    display_name: { 'pt-BR': 'Proporção Áurea Nariz-Lábio' },
    presentation_only: true,  // DEC-6: Farkas 1994 → ~1.47, not φ; Naini 2011 range 1.4–1.6
    requires_pixel_analysis: false,
    // left_mouth(61), right_mouth(291), nose_left(48), nose_right(45)
    dependency_landmarks: [61, 291, 48, 45],
    default_weight_in_region: 0.0,
    min_confidence_to_display: 0.4,
  },
];

export class SeedPhiGoldenFamily1746000130000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── metric_definition rows (4 total) ──────────────────────────────────
    // 'global' is already present in metric_region_enum — no ALTER TYPE needed.
    for (const row of PHI_DEFINITIONS) {
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
    // NO metric_ideal rows — all phi metrics are presentation_only=true (DEC-6).
    // NO region_metric_weight rows — presentation_only metrics are never scored.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const allIds = PHI_DEFINITIONS.map((r) => r.metric_id);
    if (allIds.length > 0) {
      // No region_metric_weight or metric_ideal rows to delete (none were inserted).
      await queryRunner.query(
        `DELETE FROM metric_definition WHERE version = 'v1.0' AND metric_id = ANY($1::text[])`,
        [allIds],
      );
    }
  }
}
