/**
 * 1746000150000 — Rebalance Weights v1.5 (PR-21 provisional)
 * ============================================================
 *
 * **Status**: PROVISIONAL (is_provisional=TRUE, is_active=FALSE).
 * v1.0 stays is_active=TRUE — production behaviour unchanged.
 *
 * **Why this migration exists**:
 *
 * 1. STRUCTURAL BUG in v1.0: `global_weight` v1.0 only seeded 2 regions
 *    (symmetry=0.65, eyes=0.35). After PR-13..19 added 7 more regions
 *    (jaw, nose, mouth, brows, cheekbones, forehead, global), those
 *    7 regions contributed ZERO to the global_score because they had
 *    no row in `global_weight`. RegionalScorer correctly produced
 *    region scores 0-100 for them, but GlobalScorer ignored them.
 *
 * 2. SCALAR-COUNT DOMINANCE (latent bug): symmetry has 14 metrics in
 *    region_metric_weight v1.0; eyes has 6. RegionalScorer normalises
 *    intra-region (divides by Σweight), so per-metric counts don't
 *    inflate the regional score. But the original v1.0 design (only
 *    symmetry+eyes in global_weight) effectively hard-coded the
 *    "symmetry dominates" regime.
 *
 * **What v1.5 does**:
 *
 * 1. Adds `is_provisional BOOLEAN DEFAULT FALSE` column to both
 *    region_metric_weights_version and global_weights_version. This
 *    column is for documentation/UX only — the runtime selection
 *    (orchestrator's findOne({where:{isActive:true}})) is not affected
 *    because v1.5 has is_active=FALSE.
 *
 * 2. Seeds region_metric_weights_version v1.5 + region_metric_weight
 *    rows = exact copy of v1.0 (per-metric weights from PR-13..19 were
 *    sound; not changing them in v1.5).
 *
 * 3. Seeds global_weights_version v1.5 + global_weight rows for ALL
 *    9 regions, with literature-backed allocation summing to 1.0:
 *
 *      symmetry   0.18  | eyes      0.16  | jaw      0.14
 *      nose       0.12  | mouth     0.12  | brows    0.10
 *      cheekbones 0.08  | forehead  0.05  | global   0.05
 *      ───────────────────────────────────────────────────
 *      TOTAL      1.00
 *
 *    critical_regions extended to {symmetry, eyes, jaw, nose} per
 *    Naini §10 (lower-third dominance) + Bashour 2006 (central-feature
 *    importance).
 *
 * **References for global_weight v1.5 allocation**:
 *
 *   - Naini FB (2011). Facial Aesthetics: Concepts and Clinical
 *     Diagnosis. Wiley-Blackwell. ISBN 978-1-4051-8192-7.
 *     §6 (eye region attention), §10 (lower-third dominance).
 *
 *   - Bashour M (2006). "An objective system for measuring facial
 *     attractiveness". Plast Reconstr Surg 118(3):757-774.
 *     DOI: 10.1097/01.prs.0000232980.81704.83
 *     Symmetry identified as most-cited single factor across
 *     ~100 reviewed studies.
 *
 *   - Sarver DM, Ackerman MB (2003). "Dynamic smile visualization
 *     and quantification". Am J Orthod Dentofacial Orthop
 *     124(2):116-127. DOI: 10.1016/S0889-5406(03)00307-X
 *     Mouth/lips weight justification.
 *
 *   - Edler RJ (2001). "Background considerations to facial
 *     aesthetics". J Orthod 28(2):159-168.
 *     DOI: 10.1093/ortho/28.2.159
 *     Forehead/cheekbones secondary-signal classification.
 *
 *   - Farkas LG (1994). Anthropometry of the Head and Face, 2nd ed.
 *     Raven Press. ISBN 0-7817-0159-7. Baseline anthropometric data.
 *
 * **Promotion to v2.0**: see PLAN_PR21_V15_TO_V20_PROMOTION.md.
 * v1.5 stays provisional until PR-22 (real-photo calibration, ≥30
 * photos) validates these allocations empirically.
 *
 * **Rollback**: down() drops v1.5 rows + is_provisional column.
 * v1.0 is untouched in both up() and down(); production behaviour
 * is preserved end-to-end.
 */

import { MigrationInterface, QueryRunner } from 'typeorm';

const REGION_VERSION_V15 = 'v1.5';
const GLOBAL_VERSION_V15 = 'v1.5';

// ─── Per-metric weights (copy of v1.0 from PR-13..19) ────────────────
// Kept separate from v1.0 source so future v2.0 can edit without diff
// confusion. Same numeric values; they're sound per-region calibration.

const REGION_METRIC_WEIGHTS_V15: Array<{
  region: string;
  metricId: string;
  weight: number;
}> = [
  // symmetry (14)
  { region: 'symmetry', metricId: 'midline_deviation', weight: 1.5 },
  { region: 'symmetry', metricId: 'eye_height_asymmetry', weight: 1.0 },
  { region: 'symmetry', metricId: 'brow_height_asymmetry', weight: 1.0 },
  { region: 'symmetry', metricId: 'lip_canting_angle', weight: 1.0 },
  { region: 'symmetry', metricId: 'global_asymmetry_index', weight: 2.0 },
  { region: 'symmetry', metricId: 'upper_third_ratio', weight: 1.0 },
  { region: 'symmetry', metricId: 'middle_third_ratio', weight: 1.0 },
  { region: 'symmetry', metricId: 'lower_third_ratio', weight: 1.0 },
  { region: 'symmetry', metricId: 'fifth_1_ratio', weight: 0.8 },
  { region: 'symmetry', metricId: 'fifth_2_ratio', weight: 0.8 },
  { region: 'symmetry', metricId: 'fifth_3_ratio', weight: 0.8 },
  { region: 'symmetry', metricId: 'fifth_4_ratio', weight: 0.8 },
  { region: 'symmetry', metricId: 'fifth_5_ratio', weight: 0.8 },
  { region: 'symmetry', metricId: 'intercanthal_to_eye_width_ratio', weight: 1.0 },

  // eyes (6)
  { region: 'eyes', metricId: 'eye_aperture_ratio_l', weight: 1.0 },
  { region: 'eyes', metricId: 'eye_aperture_ratio_r', weight: 1.0 },
  { region: 'eyes', metricId: 'interpupillary_distance', weight: 1.5 },
  { region: 'eyes', metricId: 'intercanthal_distance', weight: 0.5 },
  { region: 'eyes', metricId: 'canthal_tilt_l', weight: 1.0 },
  { region: 'eyes', metricId: 'canthal_tilt_r', weight: 1.0 },

  // jaw (6)
  { region: 'jaw', metricId: 'jaw_width_ratio', weight: 1.5 },
  { region: 'jaw', metricId: 'gonial_angle_l', weight: 1.0 },
  { region: 'jaw', metricId: 'gonial_angle_r', weight: 1.0 },
  { region: 'jaw', metricId: 'gonial_angle_asymmetry', weight: 1.2 },
  { region: 'jaw', metricId: 'mandibular_plane_angle', weight: 1.0 },
  { region: 'jaw', metricId: 'chin_height_ratio', weight: 1.0 },

  // nose (7)
  { region: 'nose', metricId: 'nose_length_to_icd', weight: 1.0 },
  { region: 'nose', metricId: 'nose_width_to_icd', weight: 1.2 },
  { region: 'nose', metricId: 'alar_to_face_width_ratio', weight: 1.0 },
  { region: 'nose', metricId: 'nose_to_mouth_width_ratio', weight: 1.0 },
  { region: 'nose', metricId: 'dorsum_deviation', weight: 1.3 },
  { region: 'nose', metricId: 'nasal_tip_deviation', weight: 1.3 },
  { region: 'nose', metricId: 'alar_base_asymmetry', weight: 1.2 },

  // mouth (7)
  { region: 'mouth', metricId: 'mouth_width_to_icd', weight: 1.0 },
  { region: 'mouth', metricId: 'mouth_to_face_width_ratio', weight: 1.0 },
  { region: 'mouth', metricId: 'upper_lip_height_ratio', weight: 1.0 },
  { region: 'mouth', metricId: 'lower_lip_height_ratio', weight: 1.0 },
  { region: 'mouth', metricId: 'vermilion_height_total', weight: 1.1 },
  { region: 'mouth', metricId: 'lip_corner_canting', weight: 1.3 },
  { region: 'mouth', metricId: 'mouth_midline_deviation', weight: 1.2 },

  // brows (6)
  { region: 'brows', metricId: 'brow_height_l', weight: 1.0 },
  { region: 'brows', metricId: 'brow_height_r', weight: 1.0 },
  { region: 'brows', metricId: 'brow_arch_peak_l', weight: 1.0 },
  { region: 'brows', metricId: 'brow_arch_peak_r', weight: 1.0 },
  { region: 'brows', metricId: 'brow_tail_drop_l', weight: 1.2 },
  { region: 'brows', metricId: 'interbrow_distance_ratio', weight: 1.1 },

  // cheekbones (5)
  { region: 'cheekbones', metricId: 'zygomatic_width_ratio', weight: 1.0 },
  { region: 'cheekbones', metricId: 'malar_projection_index', weight: 1.2 },
  { region: 'cheekbones', metricId: 'midface_height_ratio', weight: 1.0 },
  { region: 'cheekbones', metricId: 'cheekbone_to_jaw_ratio', weight: 1.1 },
  { region: 'cheekbones', metricId: 'submalar_hollow_index', weight: 1.0 },

  // forehead (3)
  { region: 'forehead', metricId: 'forehead_height_ratio', weight: 1.0 },
  { region: 'forehead', metricId: 'forehead_width_ratio', weight: 1.0 },
  { region: 'forehead', metricId: 'temporal_width_ratio', weight: 1.1 },

  // global (2)
  { region: 'global', metricId: 'face_height_to_width_ratio', weight: 1.3 },
  { region: 'global', metricId: 'total_facial_convexity', weight: 0.8 },
];

// ─── Global weights v1.5 (REAL FIX — 9 regions, sums to 1.0) ─────────
const GLOBAL_WEIGHTS_V15: Array<{ region: string; weight: number }> = [
  // Tier S — symmetry + eyes (Bashour 2006: most-cited factor; Naini §6)
  { region: 'symmetry', weight: 0.18 },
  { region: 'eyes', weight: 0.16 },
  // Tier A — central facial features (Naini §8, §10)
  { region: 'jaw', weight: 0.14 },
  { region: 'nose', weight: 0.12 },
  { region: 'mouth', weight: 0.12 },
  // Tier B — periorbital + lateral
  { region: 'brows', weight: 0.10 },
  { region: 'cheekbones', weight: 0.08 },
  // Tier C — secondary (Edler 2001)
  { region: 'forehead', weight: 0.05 },
  { region: 'global', weight: 0.05 },
];

const CRITICAL_REGIONS_V15: string[] = [
  // DEC-8 extended: Naini §10 (jaw lower-third dominance) + Bashour
  // (nose central-feature importance) added to symmetry+eyes baseline.
  'symmetry',
  'eyes',
  'jaw',
  'nose',
];

export class RebalanceWeightsV15_1746000150000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── 1. Add is_provisional column to both *_version tables ────────
    // Idempotent (IF NOT EXISTS) so re-running is safe.
    await queryRunner.query(`
      ALTER TABLE region_metric_weights_version
        ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN region_metric_weights_version.is_provisional IS
        'TRUE when this version is a candidate awaiting empirical validation (PR-22). Production runtime selects via is_active=TRUE; is_provisional is documentation/UX only.'
    `);

    await queryRunner.query(`
      ALTER TABLE global_weights_version
        ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN global_weights_version.is_provisional IS
        'TRUE when this version is a candidate awaiting empirical validation (PR-22). Production runtime selects via is_active=TRUE; is_provisional is documentation/UX only.'
    `);

    // ─── 2. Seed region_metric_weights_version v1.5 ───────────────────
    // is_active=FALSE — v1.0 stays the production version until PR-22.
    // is_provisional=TRUE — flags for documentation.
    await queryRunner.query(
      `INSERT INTO region_metric_weights_version
         (version, description, is_active, is_provisional)
       VALUES ($1, $2, FALSE, TRUE)
       ON CONFLICT (version) DO NOTHING`,
      [
        REGION_VERSION_V15,
        'PR-21 provisional: per-metric weights identical to v1.0 (PR-13..19 calibration preserved). Global structural fix is in global_weight v1.5. Do not activate until PR-22 (real-photo calibration) validates allocation. See PLAN_PR21_V15_TO_V20_PROMOTION.md.',
      ],
    );

    // ─── 3. Seed region_metric_weight v1.5 rows ──────────────────────
    for (const { region, metricId, weight } of REGION_METRIC_WEIGHTS_V15) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight
           (version, region, metric_id, weight)
         VALUES ($1, $2::metric_region_enum, $3, $4)
         ON CONFLICT (version, region, metric_id) DO NOTHING`,
        [REGION_VERSION_V15, region, metricId, weight],
      );
    }

    // ─── 4. Seed global_weights_version v1.5 ─────────────────────────
    await queryRunner.query(
      `INSERT INTO global_weights_version
         (version, description, is_active, is_provisional, critical_regions)
       VALUES ($1, $2, FALSE, TRUE, $3::jsonb)
       ON CONFLICT (version) DO NOTHING`,
      [
        GLOBAL_VERSION_V15,
        'PR-21 provisional: 9-region allocation (vs v1.0 which only had symmetry+eyes). Sums to 1.0. Allocation by tier per Bashour 2006 + Naini 2011 + Sarver 2003 + Edler 2001 (literature-backed; NOT empirically validated). Critical regions extended to {symmetry,eyes,jaw,nose} per Naini §10 + Bashour. Do not activate until PR-22 validates.',
        JSON.stringify(CRITICAL_REGIONS_V15),
      ],
    );

    // ─── 5. Seed global_weight v1.5 rows ─────────────────────────────
    for (const { region, weight } of GLOBAL_WEIGHTS_V15) {
      await queryRunner.query(
        `INSERT INTO global_weight
           (version, region, weight)
         VALUES ($1, $2::metric_region_enum, $3)
         ON CONFLICT (version, region) DO NOTHING`,
        [GLOBAL_VERSION_V15, region, weight],
      );
    }

    // ─── 6. Verify allocation sums to 1.0 (defensive) ────────────────
    const sumRows = (await queryRunner.query(
      `SELECT COALESCE(SUM(weight), 0)::float8 AS s
         FROM global_weight WHERE version = $1`,
      [GLOBAL_VERSION_V15],
    )) as Array<{ s: number }>;
    const sum = sumRows[0]?.s ?? 0;
    if (Math.abs(sum - 1.0) > 1e-6) {
      throw new Error(
        `[PR-21 migration] global_weight v1.5 sum = ${sum}, expected 1.0. ` +
          `Allocation broken — aborting migration. Fix GLOBAL_WEIGHTS_V15 array.`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove v1.5 rows in reverse order (FK-safe).
    await queryRunner.query(
      `DELETE FROM global_weight WHERE version = $1`,
      [GLOBAL_VERSION_V15],
    );
    await queryRunner.query(
      `DELETE FROM global_weights_version WHERE version = $1`,
      [GLOBAL_VERSION_V15],
    );
    await queryRunner.query(
      `DELETE FROM region_metric_weight WHERE version = $1`,
      [REGION_VERSION_V15],
    );
    await queryRunner.query(
      `DELETE FROM region_metric_weights_version WHERE version = $1`,
      [REGION_VERSION_V15],
    );

    // Drop is_provisional column. Safe because no v1.0 row uses it
    // (defaults to FALSE; only v1.5 sets TRUE; v1.5 just got deleted).
    await queryRunner.query(
      `ALTER TABLE global_weights_version DROP COLUMN IF EXISTS is_provisional`,
    );
    await queryRunner.query(
      `ALTER TABLE region_metric_weights_version DROP COLUMN IF EXISTS is_provisional`,
    );
  }
}
