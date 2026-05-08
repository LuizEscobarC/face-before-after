import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-50 — M4.1 Diagnostic Template Infrastructure
 *
 * First migration of the M4.1 (infra de templates) sub-marco of M4
 * (narrative / textual diagnostics). Creates the four tables required to
 * support versioned diagnostic templates and term blacklisting per
 * PLAN_M4_NARRATIVE.md §1.1 and §2 (M4.1 backlog).
 *
 *   1. `diagnostic_template_version` — versioned container (matches the pattern
 *      of `ideals_version`, `overlay_catalog_version`, `metric_registry_version`).
 *   2. `diagnostic_template` — catalog of versioned diagnostic templates indexed
 *      by `(metric_id, severity, direction, size)` for runtime lookup.
 *   3. `template_blacklist_version` — versioned container for forbidden terms.
 *   4. `template_blacklist_term` — individual forbidden term per version.
 *
 * Seed v0.1 populates 5 exemplary templates (one per M1-active region) and ~10
 * baseline blacklist terms. Catalog v1.0 with full ~300–500 templates is
 * deferred to PR-53 (Opus required, judgment of tone).
 *
 * Tone convention (PLAN_M4_NARRATIVE §1.1 — linha vermelha)
 * ---------------------------------------------------------
 *   - Use OBSERVATION verbs: "observa-se", "indica", "apresenta", "tende a apresentar".
 *   - NEVER diagnostic verbs: "diagnostica-se", "patologia", "deformidade", "anomalia".
 *   - NEVER guarantee verbs: "garantimos", "vai melhorar", "corrige".
 *   - NEVER pejorative tone: "muito ruim", "péssimo".
 *
 * Bibliographic provenance for tone & vocabulary
 * ----------------------------------------------
 *   - Naini, F.B. (2011) Facial Aesthetics: Concepts and Clinical Diagnosis
 *     — clinical-observation language for proportions and asymmetries (cap. 2-6).
 *   - Powell, N. & Humphreys, B. (1984) Proportions of the Aesthetic Face
 *     — canonical proportion vocabulary in pt-BR aesthetic literature.
 *   - Farkas, L.G. (1994) Anthropometric Facial Proportions in Medicine
 *     — descriptive style for facial measurements (no clinical diagnosis tone).
 *
 * Decisions persisted
 * -------------------
 *   - DEC-30 (PLAN_M4 §3): single locale `pt-BR` in v1; schema accommodates
 *     future multi-locale via a `locale` column added by a later migration.
 *   - DEC-31: 3 sizes — `short` (≤120 char, card), `medium` (≤350 char,
 *     detalhamento), `long` (parágrafo completo, PDF).
 *   - DEC-39 (this PR): templates indexed by `(metric_id, severity, direction, size)`
 *     UNIQUE within a version. Direction is free-text TEXT, NOT enum, because
 *     valid directions vary per metric (`left_dominant` vs `wider` vs `longer`).
 *   - DEC-40 (this PR): `placeholders_used` JSONB array is the contract between
 *     template author and renderer (PR-51) — renderer rejects template if any
 *     `{x}` token in `template_pt` is not declared here.
 *   - DEC-41 (this PR): blacklist terms stored lowercase; CI lint (PR-52)
 *     lowercases `template_pt` before substring match. No regex initially —
 *     plain-text substring keeps signal/noise predictable.
 *
 * Notes for downstream PRs
 * ------------------------
 *   - PR-51: implement `TemplateRendererService` with strict allowlist of
 *     placeholders: `{value}`, `{ideal}`, `{deviation_pct}`, `{direction_label}`,
 *     `{region_pt}`. Reject template if it uses anything else.
 *   - PR-52: CI script that loads all rows from active `diagnostic_template_version`
 *     and asserts none contain any active blacklist term (after lowercasing).
 *   - PR-53 (Opus): write the full ~300-500 template catalog v1.0.
 *
 * References
 * ----------
 *   - PLAN_M4_NARRATIVE.md §1.1 (linha vermelha — verbos proibidos), §2 (M4.1
 *     backlog), §3 (DEC-30..DEC-34)
 *   - PLAN_DDL_REVIEW.md §4.1 (diagnostic_template), §4.2 (recommendations)
 *   - PLAN_METRICS.md §0 (PR-50 row, M4.1 sub-marco)
 *
 * Schema notes
 * ------------
 *   - Tables NOT partitioned (template catalog is small; ~500 rows total for v1.0).
 *   - `severity` reuses existing `severity_5_enum` from migration
 *     `1746000030000-EvaluationsAndRoot.ts` (DEC-3).
 *   - Partial-unique-index pattern for `is_active=TRUE` mirrors
 *     `metric_registry_version` and `ideals_version`.
 */
export class M41DiagnosticTemplates1746000180000 implements MigrationInterface {
  name = 'M41DiagnosticTemplates1746000180000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ────────────────────────────────────────────────────────────────────
    // 1. diagnostic_template_version (versioning container)
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS diagnostic_template_version (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version     TEXT NOT NULL UNIQUE,
        is_active   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes       TEXT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_diag_tpl_version_active
        ON diagnostic_template_version (is_active)
        WHERE is_active = TRUE
    `);
    await queryRunner.query(`
      COMMENT ON TABLE diagnostic_template_version IS
        'PR-50 M4.1: versioned container for diagnostic_template catalogs. Only one is_active=TRUE per env (partial unique index ux_diag_tpl_version_active). Mirrors ideals_version pattern.'
    `);

    // ────────────────────────────────────────────────────────────────────
    // 2. diagnostic_template (catalog rows)
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS diagnostic_template (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version             TEXT NOT NULL REFERENCES diagnostic_template_version (version) ON DELETE RESTRICT,
        metric_id           TEXT NOT NULL,
        severity            severity_5_enum NOT NULL,
        direction           TEXT NOT NULL,
        size                TEXT NOT NULL CHECK (size IN ('short','medium','long')),
        template_pt         TEXT NOT NULL,
        placeholders_used   JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_diagnostic_template_lookup
          UNIQUE (version, metric_id, severity, direction, size)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_diagnostic_template_lookup
        ON diagnostic_template (metric_id, severity, direction, size)
    `);
    await queryRunner.query(`
      COMMENT ON TABLE diagnostic_template IS
        'PR-50 M4.1: versioned diagnostic templates. Lookup via (metric_id, severity, direction, size); UNIQUE per version. metric_id is a soft snapshot (no FK; same pattern as metric_ideal). placeholders_used declares allowed {x} tokens for the renderer (PR-51).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN diagnostic_template.direction IS
        'Free-text TEXT (not enum) because valid direction values vary per metric (left_dominant, right_dominant, longer, shorter, wider, narrower, above, below, neutral). Snapshotted from MetricEvaluationResult.direction at orchestration time.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN diagnostic_template.size IS
        'short (≤120 char, card), medium (≤350 char, detalhamento), long (parágrafo completo, PDF). DEC-31.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN diagnostic_template.placeholders_used IS
        'JSONB array of placeholder names declared in template_pt. PR-51 renderer rejects template at runtime if any {x} token is not declared here. Allowlist v1: value, ideal, deviation_pct, direction_label, region_pt.'
    `);

    // ────────────────────────────────────────────────────────────────────
    // 3. template_blacklist_version
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS template_blacklist_version (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version     TEXT NOT NULL UNIQUE,
        is_active   BOOLEAN NOT NULL DEFAULT FALSE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes       TEXT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_tpl_blacklist_version_active
        ON template_blacklist_version (is_active)
        WHERE is_active = TRUE
    `);
    await queryRunner.query(`
      COMMENT ON TABLE template_blacklist_version IS
        'PR-50 M4.1: versioned container for template_blacklist_term entries. PR-52 CI lint loads the active version and scans every active diagnostic_template.template_pt against it.'
    `);

    // ────────────────────────────────────────────────────────────────────
    // 4. template_blacklist_term
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS template_blacklist_term (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        version     TEXT NOT NULL REFERENCES template_blacklist_version (version) ON DELETE RESTRICT,
        term        TEXT NOT NULL,
        category    TEXT NOT NULL CHECK (category IN (
                      'diagnostic_verb',
                      'pathology_word',
                      'guarantee_word',
                      'medical_intervention',
                      'pejorative'
                    )),
        notes       TEXT,
        CONSTRAINT uq_template_blacklist_term UNIQUE (version, term)
      )
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN template_blacklist_term.term IS
        'Stored lowercase. CI lint (PR-52) lowercases template_pt before substring matching. Plain text — no regex in v1 to keep signal/noise predictable.'
    `);

    // ────────────────────────────────────────────────────────────────────
    // 5. SEED — diagnostic_template_version v0.1
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template_version (version, is_active, notes)
      VALUES (
        'v0.1',
        TRUE,
        'M4.1 PR-50 baseline — 5 exemplary templates (one per M1 region: symmetry, proportion, eyes, jaw, brows). Schema validation only; full catalog v1.0 with ~300-500 templates is PR-53 (Opus required).'
      )
      ON CONFLICT (version) DO NOTHING
    `);

    // ────────────────────────────────────────────────────────────────────
    // 6. SEED — 5 exemplary diagnostic_template rows (v0.1, all size=medium)
    // Tone source: PLAN_M4_NARRATIVE §1.1 + Naini 2011 §2-6 + Powell&Humphreys 1984
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO diagnostic_template (version, metric_id, severity, direction, size, template_pt, placeholders_used)
      VALUES
        (
          'v0.1', 'midline_deviation', 'moderate', 'right_dominant', 'medium',
          'A linha mediana facial apresenta desvio de {deviation_pct}% em direção ao lado direito da imagem. Padrão visual de leve assimetria axial.',
          '["deviation_pct"]'::jsonb
        ),
        (
          'v0.1', 'upper_third_ratio', 'mild', 'longer', 'medium',
          'A proporção do terço superior da face indica {value} ({deviation_pct}% acima do valor de referência {ideal}). Observa-se contorno levemente mais alongado na região da testa.',
          '["value","ideal","deviation_pct"]'::jsonb
        ),
        (
          'v0.1', 'eye_aperture_ratio_l', 'moderate', 'shorter', 'medium',
          'A abertura ocular esquerda mede {value} ({deviation_pct}% abaixo da referência {ideal}). Tende a apresentar olhar visualmente mais fechado neste lado.',
          '["value","ideal","deviation_pct"]'::jsonb
        ),
        (
          'v0.1', 'jaw_width_ratio', 'mild', 'wider', 'medium',
          'A largura mandibular relativa apresenta valor {value}, indicando linha de mandíbula visualmente mais larga que a referência {ideal}.',
          '["value","ideal"]'::jsonb
        ),
        (
          'v0.1', 'brow_height_l', 'moderate', 'shorter', 'medium',
          'A altura da sobrancelha esquerda mede {value} unidades intercanthais ({deviation_pct}% abaixo da referência {ideal}). Padrão visual de sobrancelha esquerda mais baixa.',
          '["value","ideal","deviation_pct"]'::jsonb
        )
      ON CONFLICT ON CONSTRAINT uq_diagnostic_template_lookup DO NOTHING
    `);

    // ────────────────────────────────────────────────────────────────────
    // 7. SEED — template_blacklist_version v0.1 + ~10 baseline terms
    // Source: PLAN_M4_NARRATIVE §1.1 (linha vermelha)
    // ────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO template_blacklist_version (version, is_active, notes)
      VALUES (
        'v0.1',
        TRUE,
        'M4.1 PR-50 minimal blacklist. Curated against PLAN_M4_NARRATIVE §1.1 forbidden verbs/concepts. Lowercase substring match.'
      )
      ON CONFLICT (version) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO template_blacklist_term (version, term, category, notes)
      VALUES
        ('v0.1', 'diagnostico',     'diagnostic_verb',      'Verbo diagnóstico: implica condição médica.'),
        ('v0.1', 'diagnostica',     'diagnostic_verb',      'Verbo diagnóstico conjugado.'),
        ('v0.1', 'patologia',       'pathology_word',       'Conota doença; análise é estética/geométrica.'),
        ('v0.1', 'deficiencia',     'pathology_word',       'Conota condição médica anormal.'),
        ('v0.1', 'disturbio',       'pathology_word',       'Conota condição médica.'),
        ('v0.1', 'deformidade',     'pathology_word',       'Tom pejorativo + médico.'),
        ('v0.1', 'anomalia',        'pathology_word',       'Conota anormalidade clínica.'),
        ('v0.1', 'garantimos',      'guarantee_word',       'Promessa de resultado proibida.'),
        ('v0.1', 'vai melhorar',    'guarantee_word',       'Promessa de resultado proibida.'),
        ('v0.1', 'corrige',         'guarantee_word',       'Sugere correção médica garantida.')
      ON CONFLICT ON CONSTRAINT uq_template_blacklist_term DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order of CREATE; CASCADE handles FK + index dependencies.
    await queryRunner.query(`DROP TABLE IF EXISTS template_blacklist_term CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS template_blacklist_version CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS diagnostic_template CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS diagnostic_template_version CASCADE`);
  }
}
