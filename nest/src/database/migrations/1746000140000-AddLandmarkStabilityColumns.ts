import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-23 — Multi-foto / Consistência Longitudinal
 *
 * Adds two columns to ``landmark_payload`` to support multi-capture sessions:
 *
 * 1. ``landmark_stability_scores`` (JSONB, nullable)
 *    Per-landmark stability score array computed by
 *    ``app.services.landmark_stability.compute_stability(frames)``.
 *    Serialised as ``{"scores": [0.98, 1.0, …], "global_instability_index": 0.02,
 *    "icd_px": 102.3, "capture_count": 5}``.
 *    NULL for single-capture analyses (capture_count = 1, DEC-11).
 *    Enables future re-scoring of historical analyses when stability thresholds
 *    are recalibrated (DEC-12 principle applied to stability data).
 *
 * 2. ``normalization_applied`` (BOOLEAN, NOT NULL, DEFAULT FALSE)
 *    Whether the ``normalized_landmarks`` column contains already-normalised
 *    coordinates or raw pixel coordinates.
 *    Required per PLAN_DDL_REVIEW.md §5.2: without this flag, longitudinal
 *    comparisons between analyses normalised at different stages become
 *    ambiguous.
 *
 * References
 * ----------
 * - PLAN_DDL_REVIEW.md §5.2 — "Adicionar normalization_applied (boolean)
 *   + landmark_stability_scores (JSONB, nullable)"
 * - PLAN_M2_BACKLOG.md PR-23 — Multi-foto / consistência longitudinal
 * - DEC-11 — "landmark_payload.capture_count INT DEFAULT 1 reservado"
 * - DEC-12 — snapshot versioning (stability data treated as versioned config)
 */
export class AddLandmarkStabilityColumns1746000140000
  implements MigrationInterface
{
  name = 'AddLandmarkStabilityColumns1746000140000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Per-landmark stability scores from multi-capture analysis
    await queryRunner.query(`
      ALTER TABLE landmark_payload
        ADD COLUMN IF NOT EXISTS landmark_stability_scores JSONB
    `);

    // 2. Whether normalized_landmarks column already has normalised coords
    await queryRunner.query(`
      ALTER TABLE landmark_payload
        ADD COLUMN IF NOT EXISTS normalization_applied
          BOOLEAN NOT NULL DEFAULT FALSE
    `);

    // Partial index: quickly locate rows that have stability data
    // (i.e. multi-capture analyses — minority of rows in production)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_landmark_payload_has_stability
        ON landmark_payload (analysis_report_id)
        WHERE landmark_stability_scores IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_landmark_payload_has_stability
    `);

    await queryRunner.query(`
      ALTER TABLE landmark_payload
        DROP COLUMN IF EXISTS normalization_applied
    `);

    await queryRunner.query(`
      ALTER TABLE landmark_payload
        DROP COLUMN IF EXISTS landmark_stability_scores
    `);
  }
}
