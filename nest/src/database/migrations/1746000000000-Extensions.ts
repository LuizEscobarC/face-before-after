/**
 * 0000 — Postgres extensions (pgcrypto for gen_random_uuid()).
 *
 * Kept isolated from catalog tables so additional extensions (pg_trgm,
 * uuid-ossp, etc.) can land here without touching domain migrations.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Extensions1746000000000 implements MigrationInterface {
  name = 'Extensions1746000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Intentionally do not DROP EXTENSION — other databases on the same
    // cluster may rely on it. Down is a no-op.
  }
}
