/**
 * PR-55b — Pre-step for M44RecommendationLadder.
 *
 * PostgreSQL requires `ALTER TYPE ... ADD VALUE` to be committed BEFORE the
 * new value can be referenced in `UPDATE` / `CHECK` / generated columns.
 * Splitting this into its own non-transactional migration lets the next
 * migration (`1746000230000-M44RecommendationLadder`) use 'exercise' and
 * 'aesthetic_procedure' immediately for backfill.
 *
 * Same pattern as `1746000095000-AddCheekbonesEnumValue`.
 *
 * NOTE: PostgreSQL cannot remove enum values, so down() is a no-op.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class M44LadderEnumValues1746000225000 implements MigrationInterface {
  public readonly transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE recommendation_category_enum ADD VALUE IF NOT EXISTS 'exercise'`,
    );
    await queryRunner.query(
      `ALTER TYPE recommendation_category_enum ADD VALUE IF NOT EXISTS 'aesthetic_procedure'`,
    );
    // evidence_level_enum is a brand new TYPE — safe to create here too.
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE evidence_level_enum AS ENUM ('strong', 'moderate', 'anecdotal');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL cannot remove enum values; companion migration drops
    // evidence_level_enum (which is fine since no enum members reference it
    // post-rollback). Leaving 'exercise' and 'aesthetic_procedure' in place
    // is harmless — they become unused values.
  }
}
