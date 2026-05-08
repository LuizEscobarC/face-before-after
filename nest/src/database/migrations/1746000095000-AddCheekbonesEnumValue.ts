/**
 * 0009b — Add 'cheekbones' to metric_region_enum (PR-17 prerequisite).
 *
 * PostgreSQL requires ALTER TYPE ADD VALUE to be committed BEFORE the new value
 * can be used in subsequent queries. This migration runs outside a transaction
 * so the commit happens immediately, allowing 1746000100000-SeedCheekbonesFamily
 * to use 'cheekbones' as a region in the same migration:run invocation.
 *
 * NOTE: PostgreSQL does not support removing enum values, so the down() migration
 * is a no-op. The 'cheekbones' value will remain in the enum after rollback.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheekbonesEnumValue1746000095000 implements MigrationInterface {
  // Must run outside a transaction so the new enum value is committed
  // before 1746000100000-SeedCheekbonesFamily uses it.
  public readonly transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE metric_region_enum ADD VALUE IF NOT EXISTS 'cheekbones'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL cannot remove enum values — this is intentionally a no-op.
    // Run the down migration of 1746000100000 to remove the data rows first.
  }
}
