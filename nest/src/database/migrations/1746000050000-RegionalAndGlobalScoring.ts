/**
 * 0005 — Regional & global scoring (PR-12 / M2 first slice).
 *
 * Tables:
 *   - region_metric_weights_version   (versioned container)
 *   - region_metric_weight            (FK to version)
 *   - global_weights_version          (versioned container + critical_regions snapshot)
 *   - global_weight                   (FK to version)
 *   - regional_score                  (one per (analysis_report, region))
 *   - global_score                    (one per analysis_report)
 *
 * Plus ALTER analysis_report ADD COLUMN region_metric_weights_version,
 *                                ADD COLUMN global_weights_version
 * (snapshots for audit / reproducibility).
 *
 * Seeds v1.0 of region_metric_weights and global_weights matching
 * the YAMLs at nest/src/config/yaml/{region_metric_weights,global_weights}.yaml.
 *
 * Per DEC-6 presentation_only metrics MUST NOT appear in seeds (dominant_third
 * deliberately omitted).
 *
 * Per DEC-8 critical_regions snapshot is persisted on the global_weights_version
 * row so historical analyses preserve the gating list.
 *
 * score_band_enum (DEC-9) banding labels persisted on global_score.band.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

const REGION_WEIGHTS_VERSION = 'v1.0';
const GLOBAL_WEIGHTS_VERSION = 'v1.0';

const SYMMETRY_WEIGHTS: Array<[string, number]> = [
  ['midline_deviation', 1.5],
  ['eye_height_asymmetry', 1.0],
  ['brow_height_asymmetry', 1.0],
  ['lip_canting_angle', 1.0],
  ['global_asymmetry_index', 2.0],
  ['upper_third_ratio', 1.0],
  ['middle_third_ratio', 1.0],
  ['lower_third_ratio', 1.0],
  // dominant_third intentionally excluded — presentation_only.
  ['fifth_1_ratio', 0.8],
  ['fifth_2_ratio', 0.8],
  ['fifth_3_ratio', 0.8],
  ['fifth_4_ratio', 0.8],
  ['fifth_5_ratio', 0.8],
  ['intercanthal_to_eye_width_ratio', 1.0],
];

const EYES_WEIGHTS: Array<[string, number]> = [
  ['eye_aperture_ratio_l', 1.0],
  ['eye_aperture_ratio_r', 1.0],
  ['interpupillary_distance', 1.5],
  ['intercanthal_distance', 0.5],
  ['canthal_tilt_l', 1.0],
  ['canthal_tilt_r', 1.0],
];

const GLOBAL_DIMENSION_WEIGHTS: Array<[string, number]> = [
  ['symmetry', 0.65],
  ['eyes', 0.35],
];

const CRITICAL_REGIONS = ['symmetry', 'eyes'];

export class RegionalAndGlobalScoring1746000050000 implements MigrationInterface {
  name = 'RegionalAndGlobalScoring1746000050000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ENUM (DEC-9 banding) ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE score_band_enum AS ENUM (
        'no_number',
        'refine',
        'good',
        'high'
      )
    `);

    // ── region_metric_weights_version ────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE region_metric_weights_version (
        version       TEXT PRIMARY KEY,
        description   TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_region_weights_version_active
        ON region_metric_weights_version (is_active) WHERE is_active = TRUE
    `);

    // ── region_metric_weight ─────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE region_metric_weight (
        id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version      TEXT NOT NULL REFERENCES region_metric_weights_version(version),
        region       metric_region_enum NOT NULL,
        metric_id    TEXT NOT NULL,
        weight       NUMERIC(10,6) NOT NULL DEFAULT 1.0,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_region_metric_weight_version_region_metric
          UNIQUE (version, region, metric_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_region_metric_weight_version
        ON region_metric_weight (version)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_region_metric_weight_region
        ON region_metric_weight (region)
    `);

    // ── global_weights_version ───────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE global_weights_version (
        version            TEXT PRIMARY KEY,
        description        TEXT,
        is_active          BOOLEAN NOT NULL DEFAULT FALSE,
        critical_regions   JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_global_weights_version_active
        ON global_weights_version (is_active) WHERE is_active = TRUE
    `);

    // ── global_weight ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE global_weight (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version     TEXT NOT NULL REFERENCES global_weights_version(version),
        region      metric_region_enum NOT NULL,
        weight      NUMERIC(10,6) NOT NULL DEFAULT 1.0,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_global_weight_version_region UNIQUE (version, region)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_global_weight_version ON global_weight (version)
    `);

    // ── analysis_report extra version snapshot columns ───────────────────
    await queryRunner.query(`
      ALTER TABLE analysis_report
        ADD COLUMN region_metric_weights_version TEXT
          REFERENCES region_metric_weights_version(version),
        ADD COLUMN global_weights_version TEXT
          REFERENCES global_weights_version(version)
    `);

    // ── regional_score ───────────────────────────────────────────────────
    // Composite FK into partitioned analysis_report.
    await queryRunner.query(`
      CREATE TABLE regional_score (
        id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_report_id              UUID NOT NULL,
        analysis_report_generated_at    TIMESTAMPTZ NOT NULL,
        region                          metric_region_enum NOT NULL,
        score_0_100                     NUMERIC(6,3),
        confidence_aggregate            NUMERIC(10,6),
        contributing_metric_ids         JSONB NOT NULL DEFAULT '[]'::jsonb,
        weights_version                 TEXT REFERENCES region_metric_weights_version(version),
        created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (analysis_report_id, analysis_report_generated_at)
          REFERENCES analysis_report (id, generated_at)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_regional_score_report ON regional_score (analysis_report_id)
    `);

    // ── global_score ─────────────────────────────────────────────────────
    // CHECK: cannot have a numeric score while is_displayable=FALSE (DEC gating).
    await queryRunner.query(`
      CREATE TABLE global_score (
        id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_report_id              UUID NOT NULL,
        analysis_report_generated_at    TIMESTAMPTZ NOT NULL,
        score_0_100                     NUMERIC(6,3),
        is_displayable                  BOOLEAN NOT NULL DEFAULT FALSE,
        band                            score_band_enum,
        regional_breakdown              JSONB NOT NULL DEFAULT '[]'::jsonb,
        global_weights_version          TEXT REFERENCES global_weights_version(version),
        created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (analysis_report_id, analysis_report_generated_at)
          REFERENCES analysis_report (id, generated_at),
        CONSTRAINT uq_global_score_report UNIQUE (analysis_report_id),
        CONSTRAINT ck_global_score_displayable_consistency
          CHECK ( NOT (score_0_100 IS NOT NULL AND is_displayable = FALSE) )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_global_score_report ON global_score (analysis_report_id)
    `);

    // ── Comments ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      COMMENT ON TABLE region_metric_weight IS
        'Per (version, region, metric_id) weight. presentation_only metrics MUST NOT appear (DEC-6).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN global_weights_version.critical_regions IS
        'DEC-8 snapshot: regions that gate global score. Any with confidence_aggregate < 0.5 → score null.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN global_score.band IS
        'DEC-9 score band: <50 no_number, 50-70 refine, 70-85 good, >85 high.'
    `);
    await queryRunner.query(`
      COMMENT ON CONSTRAINT ck_global_score_displayable_consistency ON global_score IS
        'Cannot persist a numeric score while marking it not displayable.'
    `);

    // ── Seed v1.0 ────────────────────────────────────────────────────────
    await queryRunner.query(
      `INSERT INTO region_metric_weights_version (version, description, is_active)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (version) DO NOTHING`,
      [REGION_WEIGHTS_VERSION, 'M1 baseline weights (PR-12 seed).'],
    );

    for (const [metricId, weight] of SYMMETRY_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ($1, 'symmetry', $2, $3)
           ON CONFLICT ON CONSTRAINT uq_region_metric_weight_version_region_metric DO NOTHING`,
        [REGION_WEIGHTS_VERSION, metricId, weight],
      );
    }
    for (const [metricId, weight] of EYES_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO region_metric_weight (version, region, metric_id, weight)
           VALUES ($1, 'eyes', $2, $3)
           ON CONFLICT ON CONSTRAINT uq_region_metric_weight_version_region_metric DO NOTHING`,
        [REGION_WEIGHTS_VERSION, metricId, weight],
      );
    }

    await queryRunner.query(
      `INSERT INTO global_weights_version (version, description, is_active, critical_regions)
         VALUES ($1, $2, TRUE, $3::jsonb)
         ON CONFLICT (version) DO NOTHING`,
      [
        GLOBAL_WEIGHTS_VERSION,
        'M1 binary split (symmetry-dominant). DEC-8 critical regions = symmetry+eyes.',
        JSON.stringify(CRITICAL_REGIONS),
      ],
    );

    for (const [region, weight] of GLOBAL_DIMENSION_WEIGHTS) {
      await queryRunner.query(
        `INSERT INTO global_weight (version, region, weight)
           VALUES ($1, $2::metric_region_enum, $3)
           ON CONFLICT ON CONSTRAINT uq_global_weight_version_region DO NOTHING`,
        [GLOBAL_WEIGHTS_VERSION, region, weight],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS global_score`);
    await queryRunner.query(`DROP TABLE IF EXISTS regional_score`);
    await queryRunner.query(`
      ALTER TABLE analysis_report
        DROP COLUMN IF EXISTS global_weights_version,
        DROP COLUMN IF EXISTS region_metric_weights_version
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS global_weight`);
    await queryRunner.query(`DROP TABLE IF EXISTS global_weights_version`);
    await queryRunner.query(`DROP TABLE IF EXISTS region_metric_weight`);
    await queryRunner.query(`DROP TABLE IF EXISTS region_metric_weights_version`);
    await queryRunner.query(`DROP TYPE IF EXISTS score_band_enum`);
  }
}
