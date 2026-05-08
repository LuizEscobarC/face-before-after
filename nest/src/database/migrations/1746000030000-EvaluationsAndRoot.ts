/**
 * 0003 — Evaluation tables (PR-3 / leva 2 do DDL_PLAN_REVIEW.md).
 *
 * Tables:
 *   - analysis_report             PARTITION BY RANGE (generated_at)
 *   - landmark_payload            (1:1 with analysis_report, not partitioned)
 *   - metric_evaluation           PARTITION BY RANGE (generated_at)
 *   - metric_evaluation_against_ideal
 *
 * Design decisions:
 *   - Both partitioned tables use composite PK (id, generated_at) per Postgres
 *     requirement that partition key columns are part of every unique constraint.
 *   - FKs that cross into partitioned tables carry the partner generated_at column
 *     so the FK reference can be exact: (id, generated_at) → PK.
 *   - TypeORM entities are mapped with id as logical PK (synchronize:false means
 *     TypeORM never tries to recreate the Postgres composite PK).
 *   - initial_partitions: current month (2026-05) + 3 forward + DEFAULT catch-all.
 *     Add more partitions with `CREATE TABLE ... PARTITION OF ...` as months roll.
 *
 * Normalization basis is locked to 'intercanthal' (DEC-1); column kept for
 * auditability of future migration if basis changes.
 *
 * Severity ENUMs mirror 5-level and 3-level scales (DEC-3).
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class EvaluationsAndRoot1746000030000 implements MigrationInterface {
  name = 'EvaluationsAndRoot1746000030000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── ENUMs ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TYPE severity_5_enum AS ENUM (
        'ideal',
        'mild',
        'moderate',
        'strong',
        'extreme'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE severity_3_enum AS ENUM (
        'LEVE',
        'MODERADO',
        'SEVERO'
      )
    `);

    // ── analysis_report (partitioned) ────────────────────────────────────
    // PK is (id, generated_at) — Postgres requires partition key in every
    // unique constraint. Application code queries by id; generated_at enables
    // partition pruning.
    await queryRunner.query(`
      CREATE TABLE analysis_report (
        id                          UUID NOT NULL DEFAULT gen_random_uuid(),
        session_id                  TEXT NOT NULL,
        photo_reference             TEXT,
        normalization_basis         TEXT NOT NULL DEFAULT 'intercanthal',
        pose_correction_applied     BOOLEAN NOT NULL DEFAULT FALSE,
        midline_aligned             BOOLEAN NOT NULL DEFAULT FALSE,
        quality_score               NUMERIC(10,6),
        metric_registry_version     TEXT REFERENCES metric_registry_version(version),
        ideals_version              TEXT REFERENCES ideals_version(version),
        threshold_config_version    TEXT REFERENCES analysis_threshold_config(version),
        severity_collapse_version   TEXT REFERENCES severity_collapse_policy(version),
        locale                      TEXT NOT NULL DEFAULT 'pt-BR',
        user_context                JSONB,
        processing_notes            JSONB NOT NULL DEFAULT '[]'::jsonb,
        disclaimer_text_snapshot    TEXT,
        status                      TEXT NOT NULL DEFAULT 'complete',
        generated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, generated_at)
      ) PARTITION BY RANGE (generated_at)
    `);

    // Index on id alone (cross-partition lookup by id without knowing generated_at).
    await queryRunner.query(`
      CREATE INDEX idx_analysis_report_id ON analysis_report (id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_analysis_report_session ON analysis_report (session_id)
    `);

    // Partitions — current month (2026-05) + 3 forward months + DEFAULT.
    await queryRunner.query(`
      CREATE TABLE analysis_report_2026_05
        PARTITION OF analysis_report
        FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
    `);
    await queryRunner.query(`
      CREATE TABLE analysis_report_2026_06
        PARTITION OF analysis_report
        FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')
    `);
    await queryRunner.query(`
      CREATE TABLE analysis_report_2026_07
        PARTITION OF analysis_report
        FOR VALUES FROM ('2026-07-01') TO ('2026-08-01')
    `);
    await queryRunner.query(`
      CREATE TABLE analysis_report_2026_08
        PARTITION OF analysis_report
        FOR VALUES FROM ('2026-08-01') TO ('2026-09-01')
    `);
    await queryRunner.query(`
      CREATE TABLE analysis_report_default
        PARTITION OF analysis_report DEFAULT
    `);

    // ── landmark_payload ─────────────────────────────────────────────────
    // 1:1 with analysis_report. Not partitioned — landmarks are small and
    // are always accessed via analysis_report_id.
    // FK carries analysis_report_generated_at so the reference can hit the
    // composite PK exactly (required for FKs into partitioned tables).
    await queryRunner.query(`
      CREATE TABLE landmark_payload (
        id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_report_id              UUID NOT NULL,
        analysis_report_generated_at    TIMESTAMPTZ NOT NULL,
        raw_landmarks                   JSONB NOT NULL,
        normalized_landmarks            JSONB,
        normalization_basis             TEXT,
        capture_count                   INT NOT NULL DEFAULT 1,
        created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (analysis_report_id, analysis_report_generated_at)
          REFERENCES analysis_report (id, generated_at)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_landmark_payload_report ON landmark_payload (analysis_report_id)
    `);

    // ── metric_evaluation (partitioned) ──────────────────────────────────
    // Composite PK (id, generated_at) same rationale as analysis_report.
    // generated_at mirrors the parent analysis_report.generated_at so partition
    // pruning naturally co-locates evaluations with their report.
    await queryRunner.query(`
      CREATE TABLE metric_evaluation (
        id                              UUID NOT NULL DEFAULT gen_random_uuid(),
        analysis_report_id              UUID NOT NULL,
        analysis_report_generated_at    TIMESTAMPTZ NOT NULL,
        metric_id                       TEXT NOT NULL,
        metric_definition_version       TEXT NOT NULL,
        value                           NUMERIC(10,6),
        error                           TEXT,
        confidence_raw                  NUMERIC(10,6),
        confidence_final                NUMERIC(10,6),
        is_low_confidence               BOOLEAN NOT NULL DEFAULT FALSE,
        displayable                     BOOLEAN NOT NULL DEFAULT TRUE,
        direction                       TEXT,
        generated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, generated_at),
        FOREIGN KEY (analysis_report_id, analysis_report_generated_at)
          REFERENCES analysis_report (id, generated_at)
      ) PARTITION BY RANGE (generated_at)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_metric_evaluation_id ON metric_evaluation (id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_metric_evaluation_report ON metric_evaluation (analysis_report_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_metric_evaluation_metric_id ON metric_evaluation (metric_id)
    `);

    await queryRunner.query(`
      CREATE TABLE metric_evaluation_2026_05
        PARTITION OF metric_evaluation
        FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
    `);
    await queryRunner.query(`
      CREATE TABLE metric_evaluation_2026_06
        PARTITION OF metric_evaluation
        FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')
    `);
    await queryRunner.query(`
      CREATE TABLE metric_evaluation_2026_07
        PARTITION OF metric_evaluation
        FOR VALUES FROM ('2026-07-01') TO ('2026-08-01')
    `);
    await queryRunner.query(`
      CREATE TABLE metric_evaluation_2026_08
        PARTITION OF metric_evaluation
        FOR VALUES FROM ('2026-08-01') TO ('2026-09-01')
    `);
    await queryRunner.query(`
      CREATE TABLE metric_evaluation_default
        PARTITION OF metric_evaluation DEFAULT
    `);

    // ── metric_evaluation_against_ideal ──────────────────────────────────
    // Not partitioned. FK into metric_evaluation requires the composite PK
    // columns (metric_evaluation_id + metric_evaluation_generated_at).
    await queryRunner.query(`
      CREATE TABLE metric_evaluation_against_ideal (
        id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_evaluation_id            UUID NOT NULL,
        metric_evaluation_generated_at  TIMESTAMPTZ NOT NULL,
        metric_ideal_id                 UUID NOT NULL REFERENCES metric_ideal (id),
        deviation_raw                   NUMERIC(10,6),
        deviation_normalized            NUMERIC(10,6),
        severity_5                      severity_5_enum,
        severity_3                      severity_3_enum,
        direction_label                 JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (metric_evaluation_id, metric_evaluation_generated_at)
          REFERENCES metric_evaluation (id, generated_at)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX idx_against_ideal_eval ON metric_evaluation_against_ideal (metric_evaluation_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_against_ideal_ideal ON metric_evaluation_against_ideal (metric_ideal_id)
    `);

    // ── Comments ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      COMMENT ON TABLE analysis_report IS
        'Root aggregate per analysis run. Partitioned RANGE monthly by generated_at. DEC-5.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN analysis_report.normalization_basis IS
        'Always intercanthal in M1 (DEC-1). Column preserved for future basis change auditing.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN analysis_report.user_context IS
        'sex/age accepted but IGNORED in M1 pipeline (DEC-13). Stored for future use.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN metric_evaluation.is_low_confidence IS
        'confidence_final < threshold_config.min_confidence_to_display_metric (default 0.4, DEC-7).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN metric_evaluation.displayable IS
        'presentation_only=FALSE AND is_low_confidence=FALSE AND error IS NULL.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN metric_evaluation_against_ideal.deviation_normalized IS
        'deviation_raw divided by the ideal range width for cross-metric comparison.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN metric_evaluation_against_ideal.severity_5 IS
        'Raw 5-level severity: ideal|mild|moderate|strong|extreme (DEC-3).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN metric_evaluation_against_ideal.severity_3 IS
        'Collapsed 3-level severity per severity_collapse_policy.mapping (DEC-3).'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS metric_evaluation_against_ideal`);

    // Drop partitioned tables (partitions are dropped automatically with parent)
    await queryRunner.query(`DROP TABLE IF EXISTS metric_evaluation`);
    await queryRunner.query(`DROP TABLE IF EXISTS landmark_payload`);
    await queryRunner.query(`DROP TABLE IF EXISTS analysis_report`);

    await queryRunner.query(`DROP TYPE IF EXISTS severity_3_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS severity_5_enum`);
  }
}
