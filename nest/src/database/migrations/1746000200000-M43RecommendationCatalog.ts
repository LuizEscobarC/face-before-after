import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-55 — M4.3 Recommendation Catalog Infrastructure
 *
 * Creates the four tables required to support versioned recommendations per
 * PLAN_M4_NARRATIVE.md §2 (M4.3 backlog) and PLAN_DDL_REVIEW.md §4.2.
 *
 *   1. `recommendation_catalog_version` — versioned container (matches the
 *      pattern of `diagnostic_template_version`, `overlay_catalog_version`,
 *      `metric_registry_version`).
 *   2. `recommendation_catalog` — catalog of recommendations indexed by
 *      slug id and version; carries display texts, category, priority,
 *      effort, risk, and professional-referral flags.
 *   3. `recommendation_trigger` — rules that map (metric_id, severity,
 *      direction) → recommendation. Drives `RecommendationEngine` matching.
 *   4. `recommendation_link` — per-session instance: which recommendations
 *      fired for an analysis_report, their final priority, and whether they
 *      were shown to the user. Replaces `solution_reference` (now deprecated
 *      per PLAN_DDL_REVIEW §5.8).
 *
 * Seed v0.1 inserts the version container row only — the catalog content
 * (display texts + triggers) is deferred to PR-56 (Opus required, judgment
 * of legal/ethical category per metric).
 *
 * Decisions persisted
 * -------------------
 *   - DEC-33 (PLAN_M4 §3): top-5 cut applied by RecommendationEngine (PR-57);
 *     `is_displayed_to_user` records which ones cleared the cut.
 *   - DEC-34: `professional_referral` fires when severity ∈ {strong, extreme}
 *     OR metric.region ∈ {jaw, nose, eyes_occlusion} OR clinical condition.
 *   - DEC-35: additional disclaimer text for `professional_referral` rows is
 *     rendered by DiagnosisService at narrative time.
 *   - `recommendation_link.analysis_report_id` is a SOFT FK (UUID column
 *     without FK constraint) because `analysis_report` is partitioned —
 *     same pattern as `rendered_asset`.
 *   - `recommendation_catalog.id` is a TEXT slug (not UUID) for human
 *     readability in triggers and in PDF; uniqueness is guaranteed by PK.
 *   - `risk_level` (0.0–1.0) feeds the R component of the priority formula
 *     (I × S × C × A) × (1−R) × (1 − E×0.5) in PR-58 (DiagnosticPriorityService).
 *   - `effort_estimate` is stored as TEXT with a CHECK constraint (not enum)
 *     to avoid the ALTER TYPE dance for future values.
 *   - `recommendation_trigger.direction` is TEXT (not enum) — same decision
 *     as `diagnostic_template.direction` (DEC-39): valid directions vary per
 *     metric (`left_dominant`, `wider`, `above`, `neutral`, …).
 *
 * Notes for downstream PRs
 * ------------------------
 *   - PR-56 (Opus): populate `recommendation_catalog` rows + matching
 *     `recommendation_trigger` rows for all M1-active metrics.
 *   - PR-57 (Sonnet): implement `RecommendationEngine` in Nest: given an
 *     `analysis_report`, load active triggers, match against
 *     `metric_evaluation_against_ideal`, score by
 *     (severity × confidence × priority_default), top-5, persist links.
 *   - PR-58 (Opus): `DiagnosticPriorityService` applies full formula.
 *   - PR-59 (Sonnet): `GET /api/analysis/:id/narrative` returns links.
 *
 * References
 * ----------
 *   - PLAN_M4_NARRATIVE.md §2.3 (M4.3 backlog), §3 (DEC-33..DEC-36)
 *   - PLAN_DDL_REVIEW.md §4.2 (schema description), §5.8 (solution_reference)
 *   - PLAN_METRICS.md §0 (PR-55 row)
 */
export class M43RecommendationCatalog1746000200000 implements MigrationInterface {
  name = 'M43RecommendationCatalog1746000200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ────────────────────────────────────────────────────────────────────
    // 1. recommendation_category_enum (PostgreSQL TYPE)
    //    Not an independent table — inline enum on the catalog column.
    //    Categories match PLAN_M4_NARRATIVE §2.3 + PLAN_DDL_REVIEW §4.2.
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE recommendation_category_enum AS ENUM (
          'photo',
          'posture',
          'lifestyle',
          'styling',
          'professional_referral',
          'presentation_only'
        );
      EXCEPTION WHEN duplicate_object THEN NULL; END $$
    `);

    // ────────────────────────────────────────────────────────────────────
    // 2. recommendation_catalog_version (versioning container)
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recommendation_catalog_version (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version     TEXT NOT NULL UNIQUE,
        is_active   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes       TEXT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_rec_catalog_version_active
        ON recommendation_catalog_version (is_active)
        WHERE is_active = TRUE
    `);
    await queryRunner.query(`
      COMMENT ON TABLE recommendation_catalog_version IS
        'PR-55 M4.3: versioned container for recommendation_catalog. Only one is_active=TRUE per env (partial unique index ux_rec_catalog_version_active). Mirrors diagnostic_template_version pattern.'
    `);

    // ────────────────────────────────────────────────────────────────────
    // 3. recommendation_catalog (catalog rows)
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recommendation_catalog (
        id                    TEXT PRIMARY KEY,
        version               TEXT NOT NULL REFERENCES recommendation_catalog_version (version) ON DELETE RESTRICT,
        category              recommendation_category_enum NOT NULL,
        display_text_short_pt TEXT NOT NULL,
        display_text_long_pt  TEXT NOT NULL,
        priority_default      SMALLINT NOT NULL CHECK (priority_default BETWEEN 1 AND 5),
        effort_estimate       TEXT NOT NULL CHECK (effort_estimate IN ('low', 'medium', 'high')),
        risk_level            NUMERIC(4,3) NOT NULL DEFAULT 0.0 CHECK (risk_level BETWEEN 0.0 AND 1.0),
        requires_professional BOOLEAN NOT NULL DEFAULT FALSE,
        professional_type     TEXT CHECK (professional_type IN (
                                'dentist',
                                'physiotherapist',
                                'dermatologist',
                                'otolaryngologist',
                                'plastic_surgeon',
                                'orthodontist'
                              )),
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_rec_catalog_version
        ON recommendation_catalog (version)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_rec_catalog_category
        ON recommendation_catalog (category)
    `);
    await queryRunner.query(`
      COMMENT ON TABLE recommendation_catalog IS
        'PR-55 M4.3: versioned recommendation catalog. PK is a human-readable snake_case slug (e.g. improve-head-posture). Content (display_text_* + triggers) populated in PR-56 (Opus). risk_level feeds R in priority formula (PR-58).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_catalog.id IS
        'Human-readable snake_case slug — unique per catalog (not per version). Allows stable references in code and in PDF without knowing the UUID.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_catalog.risk_level IS
        'Float 0.0–1.0. Feeds R in priority formula (I×S×C×A)×(1−R)×(1−E×0.5) (PR-58). 0 = no risk (e.g. change camera angle). 1 = high risk (e.g. surgical intervention).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_catalog.professional_type IS
        'Populated when requires_professional=TRUE. Indicates which specialty to refer to. NULL for non-clinical recommendations.'
    `);

    // ────────────────────────────────────────────────────────────────────
    // 4. recommendation_trigger (mapping rules: metric × severity × direction → catalog)
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recommendation_trigger (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recommendation_id     TEXT NOT NULL REFERENCES recommendation_catalog (id) ON DELETE CASCADE,
        metric_id             TEXT NOT NULL,
        severity              severity_5_enum NOT NULL,
        direction             TEXT NOT NULL DEFAULT 'any',
        additional_conditions JSONB,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_rec_trigger_recommendation
        ON recommendation_trigger (recommendation_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_rec_trigger_metric_severity
        ON recommendation_trigger (metric_id, severity)
    `);
    await queryRunner.query(`
      COMMENT ON TABLE recommendation_trigger IS
        'PR-55 M4.3: trigger rules mapping (metric_id, severity, direction) to a recommendation_catalog row. A single recommendation can have multiple triggers (OR semantics). RecommendationEngine (PR-57) loads all active triggers and matches against metric_evaluation_against_ideal.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_trigger.direction IS
        'Free-text TEXT (not enum). Valid values vary per metric: left_dominant, right_dominant, longer, shorter, wider, narrower, above, below, neutral, any. Use "any" to match all directions at a given severity.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_trigger.additional_conditions IS
        'Optional JSONB for compound trigger conditions, e.g. {"also_requires": [{"metric_id": "midline_deviation", "min_severity": "moderate"}]}. NULL = unconditional.'
    `);

    // ────────────────────────────────────────────────────────────────────
    // 5. recommendation_link (per-session instance)
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS recommendation_link (
        id                                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_report_id                  UUID NOT NULL,
        analysis_report_generated_at        TIMESTAMPTZ NOT NULL,
        recommendation_id                   TEXT NOT NULL REFERENCES recommendation_catalog (id) ON DELETE RESTRICT,
        triggered_by_metric_evaluation_ids  JSONB NOT NULL DEFAULT '[]'::jsonb,
        final_priority_in_session           SMALLINT,
        is_displayed_to_user                BOOLEAN NOT NULL DEFAULT FALSE,
        created_at                          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_rec_link_report
        ON recommendation_link (analysis_report_id, analysis_report_generated_at)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_rec_link_recommendation
        ON recommendation_link (recommendation_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_rec_link_displayed
        ON recommendation_link (analysis_report_id, is_displayed_to_user)
        WHERE is_displayed_to_user = TRUE
    `);
    await queryRunner.query(`
      COMMENT ON TABLE recommendation_link IS
        'PR-55 M4.3: per-session recommendation instances. Replaces solution_reference (deprecated per PLAN_DDL_REVIEW §5.8). analysis_report_id is a SOFT FK (no constraint) because analysis_report is partitioned — same pattern as rendered_asset. final_priority_in_session set by DiagnosticPriorityService (PR-58). is_displayed_to_user=TRUE for top-5 (DEC-33).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_link.analysis_report_id IS
        'Soft FK to analysis_report.id (no constraint — table is partitioned). Always pair with analysis_report_generated_at for partition pruning.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_link.triggered_by_metric_evaluation_ids IS
        'JSONB array of metric_evaluation_against_ideal.id UUIDs that caused this recommendation to fire. Enables audit: "why did this recommendation appear?"'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_link.final_priority_in_session IS
        'Computed by DiagnosticPriorityService (PR-58). NULL until priority pass runs. Lower number = higher priority (1 = top).'
    `);

    // ────────────────────────────────────────────────────────────────────
    // 6. Seed v0.1 — version container only (content in PR-56 / Opus)
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_catalog_version (version, is_active, notes)
      VALUES (
        'v0.1',
        TRUE,
        'PR-55 seed — catalog container created. Content (display_text_* + triggers) deferred to PR-56 (Opus: judgment of professional_referral vs lifestyle per metric).'
      )
      ON CONFLICT (version) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS recommendation_link`);
    await queryRunner.query(`DROP TABLE IF EXISTS recommendation_trigger`);
    await queryRunner.query(`DROP TABLE IF EXISTS recommendation_catalog`);
    await queryRunner.query(`DROP TABLE IF EXISTS recommendation_catalog_version`);
    await queryRunner.query(`DROP TYPE IF EXISTS recommendation_category_enum`);
  }
}
