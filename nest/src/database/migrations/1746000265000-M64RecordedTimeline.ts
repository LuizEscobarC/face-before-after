import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-64 — RecordedTimeline support
 *
 * Relaxes `chk_rec_animation_config_schema` so that `primitives` may be an
 * empty array when `recorded_timeline.frames` contains at least one keyframe.
 * This enables webcam-captured landmark animations (LandmarkRig) where the
 * movement is driven entirely by recorded 478-point MediaPipe mesh data rather
 * than by the declarative primitive registry.
 *
 * Old constraint:  primitives.length >= 1 (always)
 * New constraint:  primitives.length >= 1
 *                  OR recorded_timeline.frames.length >= 1
 */
export class M64RecordedTimeline1746000265000 implements MigrationInterface {
  name = 'M64RecordedTimeline1746000265000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop the old constraint first (cannot ALTER CHECK in-place on Postgres).
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS chk_rec_animation_config_schema
    `);

    // Re-add with relaxed rule: primitives OR recorded_timeline.frames must be non-empty.
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD CONSTRAINT chk_rec_animation_config_schema
        CHECK (
          animation_config IS NULL
          OR (
            (animation_config->>'schema_version')::int = 1
            AND (
              jsonb_array_length(animation_config -> 'primitives') > 0
              OR (
                animation_config -> 'recorded_timeline' IS NOT NULL
                AND jsonb_array_length(animation_config -> 'recorded_timeline' -> 'frames') > 0
              )
            )
          )
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restore the original strict constraint (only valid if no rows use
    // recorded_timeline-only configs at this point).
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS chk_rec_animation_config_schema
    `);

    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD CONSTRAINT chk_rec_animation_config_schema
        CHECK (
          animation_config IS NULL
          OR (
            (animation_config->>'schema_version')::int = 1
            AND jsonb_array_length(animation_config -> 'primitives') > 0
          )
        )
    `);
  }
}
