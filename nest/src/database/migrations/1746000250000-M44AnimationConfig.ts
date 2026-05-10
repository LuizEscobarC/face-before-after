import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-A — M4.4 AnimationConfig — SVG Facial Exercise Instructor
 *
 * Adds `animation_config JSONB nullable` to `recommendation_catalog` to
 * power the declarative SVG animation system for facial exercises.
 *
 * Scope
 * -----
 * Only `category='exercise'` rows with visible facial movement will receive
 * a non-NULL `animation_config`. Rows for drenagem linfática, gua sha,
 * compressas, suplementação, breathing-only, skincare remain NULL (static
 * fallback). ~120 of the ~160 exercise rows will be populated in migration
 * `1746000260000-M44AnimationConfigSeed` (PR-D, Opus 4.7).
 *
 * Schema contract (enforced by CHECK constraint)
 * ------------------------------------------------
 * When NOT NULL, animation_config must satisfy:
 *   - `schema_version` = 1  (integer, not string, per JSONB cast)
 *   - `primitives` array length ≥ 1  (cannot store an empty animation)
 *
 * Full TypeScript shape lives in:
 *   nest/src/modules/diagnosis/domain/types/recommendation.types.ts
 *   (AnimationConfig, FacialPrimitiveId, HeatRegionId)
 *
 * Frontend mirror:
 *   frontend/src/types/animationConfig.ts  (PR-B)
 *
 * Decisions: DEC-SVG-1 (declarative JSON over Lottie/Rive — zero asset),
 *            DEC-SVG-2 (schema_version guard for future migrations).
 * Sources: plan `.claude/plans/fa-a-mais-uma-revis-o-quirky-hopper.md` §PR-A.
 */
export class M44AnimationConfig1746000250000 implements MigrationInterface {
  name = 'M44AnimationConfig1746000250000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add nullable column (all existing rows default to NULL = no animation).
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS animation_config JSONB
    `);

    // 2. CHECK constraint: when set, must have schema_version=1 and ≥1 primitive.
    //    Using IF NOT EXISTS (Postgres 9.6+ via DO block) for idempotency.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE table_name = 'recommendation_catalog'
            AND constraint_name = 'chk_rec_animation_config_schema'
        ) THEN
          ALTER TABLE recommendation_catalog
            ADD CONSTRAINT chk_rec_animation_config_schema
            CHECK (
              animation_config IS NULL
              OR (
                (animation_config->>'schema_version')::int = 1
                AND jsonb_array_length(animation_config -> 'primitives') > 0
              )
            );
        END IF;
      END
      $$;
    `);

    // 3. Partial index — fast lookup for "exercises with animation defined".
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_rec_catalog_animation_config_not_null
        ON recommendation_catalog (id)
        WHERE animation_config IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_rec_catalog_animation_config_not_null
    `);

    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS chk_rec_animation_config_schema
    `);

    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS animation_config
    `);
  }
}
