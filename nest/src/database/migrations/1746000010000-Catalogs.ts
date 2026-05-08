/**
 * 0001 — Catalog tables (PR-2.2 / leva 1 do PLAN_DDL_REVIEW.md).
 *
 * Tables:
 *   - metric_registry_version       (versioned catalog)
 *   - metric_definition             (composite PK metric_id+version)
 *   - ideals_version
 *   - metric_ideal
 *   - analysis_threshold_config     (versioned config + disclaimer snapshot)
 *   - severity_collapse_policy      (versioned 5→3 mapping — DEC-3)
 *
 * Conventions:
 *   - Postgres ENUMs created explicitly (CREATE TYPE) for stable text identity.
 *   - Partial UNIQUE INDEX (... WHERE is_active = TRUE) on every *_version table
 *     to enforce "only one active version" at the DB layer.
 *   - All ranges/weights/ideals stored as numeric(10,6) to avoid float drift.
 *   - JSONB for i18n display_name + dependency_landmarks + direction_label_*.
 *
 * No domain rows are inserted here — see 0002_seed_initial_catalogs.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Catalogs1746000010000 implements MigrationInterface {
  name = 'Catalogs1746000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ENUMs ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE metric_unit_enum AS ENUM (
        'px',
        'mm_normalized',
        'ratio',
        'intercanthal_units',
        'degrees',
        'percent',
        'index_0_1'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE metric_region_enum AS ENUM (
        'eyes',
        'brows',
        'nose',
        'mouth',
        'jaw',
        'chin',
        'midface',
        'cheeks',
        'forehead',
        'global',
        'symmetry',
        'photo_quality'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE ideal_type_enum AS ENUM (
        'canonical',
        'population_statistical',
        'presentation_only'
      )
    `);

    // ── metric_registry_version ──────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE metric_registry_version (
        version       TEXT PRIMARY KEY,
        description   TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_metric_registry_version_active
        ON metric_registry_version (is_active)
        WHERE is_active = TRUE
    `);
    await queryRunner.query(`
      COMMENT ON TABLE metric_registry_version IS
        'Versioned catalog of metric definitions. Only one row may have is_active=TRUE.'
    `);

    // ── metric_definition ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE metric_definition (
        metric_id                   TEXT NOT NULL,
        version                     TEXT NOT NULL REFERENCES metric_registry_version(version),
        family                      TEXT NOT NULL,
        region                      metric_region_enum NOT NULL,
        unit                        metric_unit_enum NOT NULL,
        display_name                JSONB NOT NULL DEFAULT '{}'::jsonb,
        presentation_only           BOOLEAN NOT NULL DEFAULT FALSE,
        requires_pixel_analysis     BOOLEAN NOT NULL DEFAULT FALSE,
        dependency_landmarks        JSONB NOT NULL DEFAULT '[]'::jsonb,
        default_weight_in_region    NUMERIC(10,6) NOT NULL DEFAULT 1.0,
        min_confidence_to_display   NUMERIC(10,6) NOT NULL DEFAULT 0.4,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (metric_id, version)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_metric_definition_version ON metric_definition(version)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_metric_definition_region ON metric_definition(region)
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN metric_definition.display_name IS
        'i18n map: { "pt-BR": "Largura ocular", "en-US": "Eye width" } — DEC-4.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN metric_definition.dependency_landmarks IS
        'JSON array of MediaPipe Face Mesh indices (e.g. [33, 133, 263]).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN metric_definition.presentation_only IS
        'DEC-6: hard rule. Metrics with presentation_only=TRUE are rejected by regional/global scorers.'
    `);

    // ── ideals_version ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE ideals_version (
        version       TEXT PRIMARY KEY,
        description   TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_ideals_version_active
        ON ideals_version (is_active)
        WHERE is_active = TRUE
    `);

    // ── metric_ideal ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE metric_ideal (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_id                   TEXT NOT NULL,
        metric_definition_version   TEXT NOT NULL,
        ideals_version              TEXT NOT NULL REFERENCES ideals_version(version),
        ideal_type                  ideal_type_enum NOT NULL,
        ideal_central_value         NUMERIC(10,6),
        green_range_min             NUMERIC(10,6),
        green_range_max             NUMERIC(10,6),
        yellow_range_min            NUMERIC(10,6),
        yellow_range_max            NUMERIC(10,6),
        direction_label_above       JSONB NOT NULL DEFAULT '{}'::jsonb,
        direction_label_below       JSONB NOT NULL DEFAULT '{}'::jsonb,
        population_reference_note   TEXT,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (metric_id, metric_definition_version)
          REFERENCES metric_definition(metric_id, version),
        UNIQUE (metric_id, metric_definition_version, ideals_version)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_metric_ideal_version ON metric_ideal(ideals_version)
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN metric_ideal.direction_label_above IS
        'i18n map: { "pt-BR": "olho mais alto" } when value > ideal.'
    `);

    // ── analysis_threshold_config ────────────────────────────────────────
    // DEC-7 (thresholds editáveis), DEC-9 (bandas de score),
    // disclaimer congelado (texto canônico v1).
    await queryRunner.query(`
      CREATE TABLE analysis_threshold_config (
        version                                 TEXT PRIMARY KEY,
        min_confidence_to_display_metric        NUMERIC(10,6) NOT NULL DEFAULT 0.4,
        min_confidence_to_show_global_score     NUMERIC(10,6) NOT NULL DEFAULT 0.5,
        score_band_no_number_max                NUMERIC(10,6) NOT NULL DEFAULT 50.0,
        score_band_refine_max                   NUMERIC(10,6) NOT NULL DEFAULT 70.0,
        score_band_good_max                     NUMERIC(10,6) NOT NULL DEFAULT 85.0,
        disclaimer_text_snapshot                TEXT NOT NULL,
        is_active                               BOOLEAN NOT NULL DEFAULT FALSE,
        created_at                              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_analysis_threshold_config_active
        ON analysis_threshold_config (is_active)
        WHERE is_active = TRUE
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN analysis_threshold_config.disclaimer_text_snapshot IS
        'Frozen disclaimer text shown to user. Any change of wording requires a new version row.'
    `);

    // ── severity_collapse_policy ─────────────────────────────────────────
    // DEC-3: 5-level (ideal|mild|moderate|strong|extreme) collapses to 3-level
    // (LEVE|MODERADO|SEVERO). Mapping is a versioned JSONB document so it can
    // be recalibrated without code changes.
    await queryRunner.query(`
      CREATE TABLE severity_collapse_policy (
        version       TEXT PRIMARY KEY,
        mapping       JSONB NOT NULL,
        is_active     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_severity_collapse_policy_active
        ON severity_collapse_policy (is_active)
        WHERE is_active = TRUE
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN severity_collapse_policy.mapping IS
        'JSON object mapping 5-level severity to 3-level. Default: {"ideal":"LEVE","mild":"LEVE","moderate":"MODERADO","strong":"SEVERO","extreme":"SEVERO"}.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS severity_collapse_policy`);
    await queryRunner.query(`DROP TABLE IF EXISTS analysis_threshold_config`);
    await queryRunner.query(`DROP TABLE IF EXISTS metric_ideal`);
    await queryRunner.query(`DROP TABLE IF EXISTS ideals_version`);
    await queryRunner.query(`DROP TABLE IF EXISTS metric_definition`);
    await queryRunner.query(`DROP TABLE IF EXISTS metric_registry_version`);
    await queryRunner.query(`DROP TYPE IF EXISTS ideal_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS metric_region_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS metric_unit_enum`);
  }
}
