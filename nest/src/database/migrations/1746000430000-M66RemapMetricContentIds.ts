/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PR-66 follow-up — Remap legacy metric_content IDs to canonical metric_definition IDs.
 *
 * Problem: the seed in 1746000400000-MetricContent.ts used legacy keys
 * (fwhr, bizygomatic_to_bigonial_ratio, *_pct_ipd, *_deg) that don't match the
 * current metric_definition table (which uses face_height_to_width_ratio,
 * gonial_angle_l/r, etc.). Result: only 1 of 50 seeded feynman entries reaches
 * the /v1/catalog/glossary response.
 *
 * Fix: rewrite metric_content rows in-place to use canonical IDs, splitting
 * mean-style legacy entries (canthal_tilt_mean_deg) so left/right variants
 * inherit the same editorial content.
 *
 * Orphan rows (no canonical match — head pose, image-quality proxies, etc.)
 * are deleted because they don't appear in the glossary anyway.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

// legacy_id  →  canonical_id(s).  Multiple targets = duplicate the content row.
const REMAP: Record<string, string[]> = {
  // mean/left/right groups collapse onto canonical *_l / *_r (no mean variant exists)
  canthal_tilt_left_deg: ['canthal_tilt_l'],
  canthal_tilt_right_deg: ['canthal_tilt_r'],
  canthal_tilt_mean_deg: ['canthal_tilt_l', 'canthal_tilt_r'],

  gonial_angle_left_deg: ['gonial_angle_l'],
  gonial_angle_right_deg: ['gonial_angle_r'],
  gonial_angle_mean_deg: ['gonial_angle_l', 'gonial_angle_r'],

  eye_aspect_ratio_left: ['eye_aperture_ratio_l'],
  eye_aspect_ratio_right: ['eye_aperture_ratio_r'],
  eye_aspect_ratio_mean: ['eye_aperture_ratio_l', 'eye_aperture_ratio_r'],

  brow_tilt_left_deg: ['brow_tail_drop_l'],
  brow_tilt_right_deg: ['brow_tail_drop_r'],

  // ratios
  fwhr: ['face_height_to_width_ratio'],
  bizygomatic_to_bigonial_ratio: ['cheekbone_to_jaw_ratio'],
  jaw_width_pct_ipd: ['jaw_width_ratio'],
  intercanthal_to_eyewidth_ratio: ['intercanthal_to_eye_width_ratio'],
  nasal_to_mouth_width_ratio: ['nose_to_mouth_width_ratio'],
  mouth_to_ipd_ratio: ['mouth_width_to_icd'],
  upper_lower_lip_ratio: ['lip_volume_ratio'],
  philtrum_length_pct_ipd: ['philtrum_width_ratio'],

  // thirds family
  thirds_upper_ratio: ['upper_third_ratio'],
  thirds_middle_ratio: ['middle_third_ratio'],
  thirds_lower_ratio: ['lower_third_ratio'],

  // chin / nose / mouth deviations
  chin_projection_pct_ipd: ['chin_projection_proxy'],
  chin_deviation_pct_ipd: ['midline_deviation'],
  mouth_center_deviation_pct_ipd: ['mouth_midline_deviation'],
  nose_deviation_pct_ipd: ['nasal_tip_deviation'],
  nose_wings_asymmetry_pct_ipd: ['alar_base_asymmetry'],
  mouth_corners_asymmetry_pct_ipd: ['oral_commissure_height_asym'],
  jawline_mean_asymmetry_pct_ipd: ['gonial_angle_asymmetry'],
  eye_level_difference_pct_ipd: ['eye_height_asymmetry'],
  brow_to_eyelid_mean_pct_ipd: ['supratarsal_fold_visibility'],

  // global / structural
  overall_asymmetry_score_pct_ipd: ['global_asymmetry_index'],
  jawline_definition_score: ['mandibular_plane_angle'],
  marquardt_deviation_pct_ipd: ['total_facial_convexity'],

  // eye-region misc
  alar_intercanthal_alignment_pct: ['alar_to_face_width_ratio'],
  eye_horizontal_asymmetry_pct_ipd: ['palpebral_fissure_inclination'],
};

// IDs that have no useful canonical mapping (image-quality / head-pose proxies
// or measurements we don't expose in the editorial glossary).
const DROP_LEGACY = [
  'eye_aspect_ratio_mean', // already split above; drop original row
  'canthal_tilt_mean_deg',
  'gonial_angle_mean_deg',
  'head_pose_pitch_deg',
  'head_pose_roll_deg',
  'head_pose_yaw_deg',
  'ipd_px',
  'face_pixel_width',
  'focal_distortion_ratio',
  'fifths_std_dev',
  'thirds_std_dev',
  'lighting_asymmetry_delta_e',
  'marquardt_deviation_px',
  'sharpness_laplacian_var',
  'skin_lighting_delta_e_lr',
  'skin_uniformity_std_lab_forehead',
  'skin_uniformity_std_lab_left',
  'skin_uniformity_std_lab_right',
  'under_eye_darkness_left',
  'under_eye_darkness_right',
];

export class M66RemapMetricContentIds1746000430000 implements MigrationInterface {
  name = 'M66RemapMetricContentIds1746000430000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert canonical rows by copying existing legacy content.
    //    ON CONFLICT (metric_id, locale) DO NOTHING keeps existing rows intact.
    for (const [legacy, targets] of Object.entries(REMAP)) {
      for (const canonical of targets) {
        await queryRunner.query(
          `
          INSERT INTO metric_content
            (metric_id, locale, feynman_text, description, how_measured,
             ranges_text, common_issues, "references", created_at, updated_at)
          SELECT $2, locale, feynman_text, description, how_measured,
                 ranges_text, common_issues, "references", NOW(), NOW()
          FROM metric_content
          WHERE metric_id = $1
          ON CONFLICT (metric_id, locale) DO NOTHING
          `,
          [legacy, canonical],
        );
      }
    }

    // 2. Drop legacy rows that have been remapped or are unmappable.
    const legacyIds = [...Object.keys(REMAP), ...DROP_LEGACY];
    await queryRunner.query(
      `DELETE FROM metric_content WHERE metric_id = ANY($1)`,
      [legacyIds],
    );
  }

  public async down(): Promise<void> {
    // Forward-only: re-running the original seed would restore the legacy keys.
    // No-op rollback to avoid resurrecting broken IDs.
  }
}
