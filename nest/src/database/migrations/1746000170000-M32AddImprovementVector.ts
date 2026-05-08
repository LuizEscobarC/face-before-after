/**
 * PR-35 — M3.2 Add improvement_vector columns to metric_evaluation_against_ideal.
 *
 * Each metric evaluation against ideal may carry a 2D improvement vector
 * (dx, dy) in normalised intercanthal units (ICU) describing the direction
 * and approximate magnitude the relevant facial feature should shift to move
 * closer to the ideal. Computed by the Python metric calculators and
 * persisted here for the frontend SVG arrow renderer (PR-36, M3.2).
 *
 * Columns are nullable — only emitted by calculators that have a clear
 * geometric improvement direction (e.g. midline_deviation, chin_height_ratio,
 * brow_height_l/r). Metrics without a meaningful vector leave them NULL.
 *
 * References:
 *   - PLAN_M3_OVERLAYS §2, sub-marco M3.2
 *   - DEC-25 (z-order): vectors render at z=40, above grids and contours
 *   - Naini 2011 §4-6 (thirds/fifths), Farkas 1994 (brow height, chin),
 *     Powell & Humphreys 1984 (proportions)
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class M32AddImprovementVector1746000170000 implements MigrationInterface {
  name = 'M32AddImprovementVector1746000170000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE metric_evaluation_against_ideal
        ADD COLUMN IF NOT EXISTS improvement_vector_x NUMERIC(10,6),
        ADD COLUMN IF NOT EXISTS improvement_vector_y NUMERIC(10,6)
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN metric_evaluation_against_ideal.improvement_vector_x IS
        'Horizontal component of the improvement vector in normalised intercanthal units (ICU). NULL when not applicable.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN metric_evaluation_against_ideal.improvement_vector_y IS
        'Vertical component of the improvement vector in normalised intercanthal units (ICU). NULL when not applicable. Positive = downward (screen coords).'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE metric_evaluation_against_ideal
        DROP COLUMN IF EXISTS improvement_vector_x,
        DROP COLUMN IF EXISTS improvement_vector_y
    `);
  }
}
