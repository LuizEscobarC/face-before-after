import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-A — M4.4 BiometricConfig — Anatomical biometric exercise schema.
 *
 * Adds `biometric_config JSONB nullable` to `recommendation_catalog` to
 * power the biometric (anatomical zone + verb) exercise instructor system.
 *
 * Schema contract (enforced by CHECK constraint
 * `recommendation_catalog_biometric_config_chk`)
 * ------------------------------------------------------------------
 * When NOT NULL, biometric_config must satisfy:
 *   - schema_version = 1
 *   - steps is a non-empty array
 *   - cycle_ms > 0
 *   - repeat in ('infinite','once','reverse')
 *
 * Full TypeScript shape lives in:
 *   nest/src/modules/diagnosis/domain/types/recommendation.types.ts
 *   (BiometricExerciseConfig, BiometricStep, AnatomicalZoneId, MovementVerb)
 *
 * Frontend mirror:
 *   frontend/src/biometric/types.ts
 */
export class M44BiometricConfig1746000270000 implements MigrationInterface {
  name = 'M44BiometricConfig1746000270000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS biometric_config JSONB
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'recommendation_catalog'
            AND constraint_name = 'recommendation_catalog_biometric_config_chk'
        ) THEN
          ALTER TABLE recommendation_catalog
            ADD CONSTRAINT recommendation_catalog_biometric_config_chk
            CHECK (
              biometric_config IS NULL OR (
                (biometric_config->>'schema_version')::int = 1
                AND jsonb_typeof(biometric_config->'steps') = 'array'
                AND jsonb_array_length(biometric_config->'steps') >= 1
                AND (biometric_config->>'cycle_ms')::int > 0
                AND biometric_config->>'repeat' IN ('infinite','once','reverse')
              )
            );
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS recommendation_catalog_biometric_config_chk
    `);

    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS biometric_config
    `);
  }
}
