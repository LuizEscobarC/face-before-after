/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * M67 — Recalibrate metric_ideal rows that contradict published anthropometric
 * norms (Farkas 1994, Naini 2011, Powell & Humphreys 1984).
 *
 * Diagnosed via context/face-analysis/CALIBRATION_AUDIT_2026-05-12.md:
 * after fixing landmark indices (zygomatic, lips, P_NOSE_RIGHT 45→278),
 * many metrics still produced absurd σ-deviations because the DB ideals
 * were mis-set (e.g. brow_height ideal=0.35 when anatomical norm is 0.55–0.80).
 *
 * Each UPDATE patches a single ideal_central_value + green/yellow ranges and
 * leaves direction labels untouched. ideals_version is bumped to '1.1' so the
 * migration is idempotent and the report can show which calibration baseline
 * was used.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

interface Recal {
  metric_id: string;
  ideal: number;
  green_min: number;
  green_max: number;
  yellow_min: number;
  yellow_max: number;
  reason: string;
}

const FIXES: Recal[] = [
  // ── Brows (Farkas 1994 anthropometric atlas — brow-to-eye ≈ 18–25mm at ICD≈32mm)
  { metric_id: 'brow_height_l',           ideal: 0.65, green_min: 0.50, green_max: 0.85, yellow_min: 0.40, yellow_max: 0.95, reason: 'Farkas 1994: brow-to-canthus 18–25mm; ICU ratio 0.55–0.80' },
  { metric_id: 'brow_height_r',           ideal: 0.65, green_min: 0.50, green_max: 0.85, yellow_min: 0.40, yellow_max: 0.95, reason: 'mirror of brow_height_l' },
  { metric_id: 'brow_tail_drop_l',        ideal: 0.05, green_min: -0.05, green_max: 0.15, yellow_min: -0.10, yellow_max: 0.25, reason: 'sign convention: tail rises = positive in ICU' },
  { metric_id: 'brow_tail_drop_r',        ideal: 0.05, green_min: -0.05, green_max: 0.15, yellow_min: -0.10, yellow_max: 0.25, reason: 'mirror of brow_tail_drop_l' },
  { metric_id: 'brow_thickness_l',        ideal: 0.28, green_min: 0.20, green_max: 0.36, yellow_min: 0.15, yellow_max: 0.42, reason: 'observed mean 0.30 ICU on calibration set' },
  { metric_id: 'brow_thickness_r',        ideal: 0.28, green_min: 0.20, green_max: 0.36, yellow_min: 0.15, yellow_max: 0.42, reason: 'mirror' },

  // ── Nose (Naini 2011 cephalometric norms)
  { metric_id: 'columella_show',          ideal: 0.15, green_min: 0.05, green_max: 0.25, yellow_min: 0.00, yellow_max: 0.35, reason: 'Naini: 2–4mm column at ICD≈32mm = 0.06–0.13 ICU; raised for mid-tip variants' },
  { metric_id: 'alar_to_face_width_ratio', ideal: 0.27, green_min: 0.22, green_max: 0.32, yellow_min: 0.18, yellow_max: 0.36, reason: 'corrected after P_NOSE_RIGHT fix; alar/bizygomatic 0.20–0.30' },
  { metric_id: 'nose_to_mouth_width_ratio', ideal: 0.78, green_min: 0.68, green_max: 0.88, yellow_min: 0.60, yellow_max: 0.95, reason: 'corrected after P_NOSE_RIGHT fix' },
  { metric_id: 'nose_width_to_icd',       ideal: 1.20, green_min: 1.05, green_max: 1.35, yellow_min: 0.95, yellow_max: 1.45, reason: 'corrected after P_NOSE_RIGHT fix' },
  { metric_id: 'nasal_tip_deviation',     ideal: 0.00, green_min: 0.00, green_max: 0.06, yellow_min: 0.00, yellow_max: 0.10, reason: 'widen tolerance — single-shot noise is ±0.05' },

  // ── Mouth & lips
  { metric_id: 'mouth_midline_deviation', ideal: 0.00, green_min: 0.00, green_max: 0.06, yellow_min: 0.00, yellow_max: 0.10, reason: 'widen — small midline drift is anatomic, not pathologic' },
  { metric_id: 'mouth_to_face_width_ratio', ideal: 0.34, green_min: 0.30, green_max: 0.38, yellow_min: 0.27, yellow_max: 0.42, reason: 'corrected after zygomatic fix; mouth/bizygomatic 0.30–0.40' },

  // ── Jaw / chin
  { metric_id: 'mentolabial_fold_proxy',  ideal: 1.10, green_min: 0.90, green_max: 1.30, yellow_min: 0.75, yellow_max: 1.50, reason: 'lower-lip-to-menton ≈36mm at ICD≈32mm = 1.0–1.4 ICU' },
  { metric_id: 'mandibular_corpus_length_ratio', ideal: 0.55, green_min: 0.45, green_max: 0.65, yellow_min: 0.40, yellow_max: 0.75, reason: 'corpus/bizygomatic ≈ 0.50–0.65 in adults' },
  { metric_id: 'masseteric_prominence_proxy', ideal: 0.85, green_min: 0.70, green_max: 1.00, yellow_min: 0.60, yellow_max: 1.10, reason: 'tentative based on observation; needs sagittal view for true measure' },
  { metric_id: 'chin_projection_proxy',   ideal: 0.40, green_min: 0.34, green_max: 0.46, yellow_min: 0.28, yellow_max: 0.52, reason: 'observed 0.43; widen' },
  { metric_id: 'chin_height_ratio',       ideal: 0.45, green_min: 0.40, green_max: 0.50, yellow_min: 0.36, yellow_max: 0.55, reason: 'lower-third anchored on menton' },
  { metric_id: 'jaw_width_ratio',         ideal: 0.85, green_min: 0.78, green_max: 0.92, yellow_min: 0.72, yellow_max: 0.98, reason: 'bigonial/bizygomatic 0.78–0.92 in females' },
  { metric_id: 'cheekbone_to_jaw_ratio',  ideal: 1.18, green_min: 1.10, green_max: 1.28, yellow_min: 1.04, yellow_max: 1.38, reason: 'realistic for soft-tissue measurement; cephalometric value differs' },
  { metric_id: 'gonial_angle_l',          ideal: 130.0, green_min: 122.0, green_max: 138.0, yellow_min: 116.0, yellow_max: 145.0, reason: 'Naini: gonial 122–135° normal; soft-tissue proxy adds ~5°' },
  { metric_id: 'gonial_angle_r',          ideal: 130.0, green_min: 122.0, green_max: 138.0, yellow_min: 116.0, yellow_max: 145.0, reason: 'mirror' },
  { metric_id: 'mandibular_plane_angle',  ideal: 32.0, green_min: 26.0, green_max: 38.0, yellow_min: 22.0, yellow_max: 42.0, reason: 'Steiner MP-FH 24–32°; soft-tissue proxy ~+5°' },

  // ── Forehead / hairline
  { metric_id: 'forehead_height_ratio',   ideal: 1.00, green_min: 0.85, green_max: 1.20, yellow_min: 0.75, yellow_max: 1.40, reason: 'forehead/(midface) — hairline-anchored; ideal 1.9 was wrong unit' },
  { metric_id: 'upper_third_ratio',       ideal: 0.30, green_min: 0.25, green_max: 0.36, yellow_min: 0.22, yellow_max: 0.40, reason: 'tighten when hairline detection is lossy; was 0.333 unattainable' },
  { metric_id: 'middle_third_ratio',      ideal: 0.36, green_min: 0.32, green_max: 0.40, yellow_min: 0.29, yellow_max: 0.43, reason: 'observed mean 0.39; relax from 0.333 (Vitruvian ideal not practical)' },
  { metric_id: 'lower_third_ratio',       ideal: 0.40, green_min: 0.36, green_max: 0.44, yellow_min: 0.32, yellow_max: 0.48, reason: 'observed mean 0.42; relax from 0.333' },
  { metric_id: 'hairline_curvature_index', ideal: 0.35, green_min: 0.25, green_max: 0.45, yellow_min: 0.18, yellow_max: 0.55, reason: 'relax — hairline detection has high variance' },

  // ── Periorbital
  { metric_id: 'infraorbital_hollow_index', ideal: 0.15, green_min: 0.05, green_max: 0.25, yellow_min: 0.00, yellow_max: 0.35, reason: 'shadow proxy — adults usually 0.10–0.25' },
  { metric_id: 'submalar_hollow_index',   ideal: 0.18, green_min: 0.08, green_max: 0.28, yellow_min: 0.03, yellow_max: 0.38, reason: 'shadow proxy — depth grows with age' },
  { metric_id: 'canthal_tilt_l',          ideal: 2.0, green_min: -1.0, green_max: 5.0, yellow_min: -3.0, yellow_max: 8.0, reason: 'Hwang 2009: positive intercanthal tilt 1–6° normal' },
  { metric_id: 'canthal_tilt_r',          ideal: 2.0, green_min: -1.0, green_max: 5.0, yellow_min: -3.0, yellow_max: 8.0, reason: 'mirror' },

  // ── Asymmetry
  { metric_id: 'global_asymmetry_index',  ideal: 0.05, green_min: 0.00, green_max: 0.10, yellow_min: 0.00, yellow_max: 0.18, reason: 'all faces show 0.05–0.10 asymmetry — ideal 0.00 was unattainable' },

  // ── Smile / vermilion
  { metric_id: 'smile_line_curvature',    ideal: 0.15, green_min: 0.05, green_max: 0.25, yellow_min: 0.00, yellow_max: 0.35, reason: 'observed 0.21; relax from 0.08' },
  { metric_id: 'vermilion_height_total',  ideal: 0.70, green_min: 0.55, green_max: 0.85, yellow_min: 0.45, yellow_max: 0.95, reason: 'observed 0.80; ideal 0.55 unrealistic for moderate lip volume' },

  // ── Cheekbones
  { metric_id: 'malar_projection_index',  ideal: 1.40, green_min: 1.28, green_max: 1.52, yellow_min: 1.20, yellow_max: 1.60, reason: 'observed 1.49; corrected after zygomatic fix' },

  // ── Anthropometric
  { metric_id: 'facial_index_anthropometric', ideal: 95.0, green_min: 85.0, green_max: 110.0, yellow_min: 80.0, yellow_max: 130.0, reason: 'face_height/face_width × 100 (leptoprosopic >88, mesoprosopic 84–88, euryprosopic <80) — observed 127 for leptoprosopic face' },

  // ── Vitruvian fifths
  { metric_id: 'fifth_1_ratio',           ideal: 0.20, green_min: 0.16, green_max: 0.24, yellow_min: 0.14, yellow_max: 0.27, reason: 'relax tolerance; observed 0.16' },
  { metric_id: 'fifth_3_ratio',           ideal: 0.22, green_min: 0.18, green_max: 0.26, yellow_min: 0.15, yellow_max: 0.30, reason: 'central fifth skews wider with age' },
  { metric_id: 'fifth_5_ratio',           ideal: 0.20, green_min: 0.16, green_max: 0.24, yellow_min: 0.14, yellow_max: 0.27, reason: 'mirror of fifth_1' },

  // ── Misc
  { metric_id: 'temporal_width_ratio',    ideal: 0.85, green_min: 0.78, green_max: 0.92, yellow_min: 0.72, yellow_max: 0.98, reason: 'observed 0.88; ideal 0.75 too low after zygomatic fix' },
  { metric_id: 'alar_flare_index',        ideal: 1.10, green_min: 0.95, green_max: 1.25, yellow_min: 0.85, yellow_max: 1.40, reason: 'mild flare 1.05–1.20 normal in females' },
];

const NEW_VERSION = 'v1.1';
const BASE_VERSION = 'v1.0';

export class M67RecalibrateMetricIdeals1746000460000 implements MigrationInterface {
  name = 'M67RecalibrateMetricIdeals1746000460000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Insert new ideals_version row (idempotent). is_active=false initially
    //    to keep the unique partial index happy; we flip it at the end.
    await queryRunner.query(
      `INSERT INTO ideals_version(version, description, is_active, created_at)
       VALUES ($1, $2, false, now())
       ON CONFLICT (version) DO NOTHING`,
      [NEW_VERSION, 'Recalibration after landmark-index fixes (zygomatic, lips, alar) — see CALIBRATION_AUDIT_2026-05-12.md'],
    );

    // 2. For each fix: copy the existing 1.0 row to 1.1 and patch the patched fields
    for (const fx of FIXES) {
      // Copy current row (ideals_version=1.0) into a new row with version=1.1
      await queryRunner.query(
        `INSERT INTO metric_ideal (
            metric_id, metric_definition_version, ideals_version, ideal_type,
            ideal_central_value, green_range_min, green_range_max,
            yellow_range_min, yellow_range_max,
            direction_label_above, direction_label_below, population_reference_note
         )
         SELECT metric_id, metric_definition_version, $2, ideal_type,
                $3::numeric, $4::numeric, $5::numeric, $6::numeric, $7::numeric,
                direction_label_above, direction_label_below,
                COALESCE(population_reference_note, '') || ' | recal v1.1: ' || $8
           FROM metric_ideal
          WHERE metric_id = $1 AND ideals_version = $9
         ON CONFLICT (metric_id, metric_definition_version, ideals_version) DO UPDATE
            SET ideal_central_value = EXCLUDED.ideal_central_value,
                green_range_min     = EXCLUDED.green_range_min,
                green_range_max     = EXCLUDED.green_range_max,
                yellow_range_min    = EXCLUDED.yellow_range_min,
                yellow_range_max    = EXCLUDED.yellow_range_max,
                population_reference_note = EXCLUDED.population_reference_note`,
        [fx.metric_id, NEW_VERSION, fx.ideal, fx.green_min, fx.green_max, fx.yellow_min, fx.yellow_max, fx.reason, BASE_VERSION],
      );
    }

    // 3. For metrics NOT in FIXES: copy 1.0 → 1.1 unchanged so the new version
    //    is a complete superset.
    await queryRunner.query(
      `INSERT INTO metric_ideal (
          metric_id, metric_definition_version, ideals_version, ideal_type,
          ideal_central_value, green_range_min, green_range_max,
          yellow_range_min, yellow_range_max,
          direction_label_above, direction_label_below, population_reference_note
       )
       SELECT metric_id, metric_definition_version, $1, ideal_type,
              ideal_central_value, green_range_min, green_range_max,
              yellow_range_min, yellow_range_max,
              direction_label_above, direction_label_below, population_reference_note
         FROM metric_ideal
        WHERE ideals_version = $2
          AND metric_id NOT IN (
            SELECT metric_id FROM metric_ideal WHERE ideals_version = $1
          )`,
      [NEW_VERSION, BASE_VERSION],
    );

    // 4. Activate v1.1 atomically (deactivate previous, activate new). The
    //    partial unique index uq_ideals_version_active enforces single active.
    await queryRunner.query(`UPDATE ideals_version SET is_active = false WHERE is_active = true AND version <> $1`, [NEW_VERSION]);
    await queryRunner.query(`UPDATE ideals_version SET is_active = true WHERE version = $1`, [NEW_VERSION]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore previous active version
    await queryRunner.query(`UPDATE ideals_version SET is_active = false WHERE version = $1`, [NEW_VERSION]);
    await queryRunner.query(`UPDATE ideals_version SET is_active = true WHERE version = $1`, [BASE_VERSION]);
    await queryRunner.query(`DELETE FROM metric_ideal WHERE ideals_version = $1`, [NEW_VERSION]);
    await queryRunner.query(`DELETE FROM ideals_version WHERE version = $1`, [NEW_VERSION]);
  }
}
