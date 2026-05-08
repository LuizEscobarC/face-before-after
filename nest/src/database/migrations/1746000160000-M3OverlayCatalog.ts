import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-30 — M3.1 Overlay Catalog
 *
 * First migration of the M3 (overlays) milestone. Creates the four tables
 * required to support visual overlays per PLAN_M3_OVERLAYS.md §2 and
 * PLAN_DDL_REVIEW.md §3:
 *
 *   1. ``overlay_catalog_version`` — versioned container (matches the pattern
 *      of ``ideals_version``, ``metric_registry_version``).
 *   2. ``overlay_definition`` — catalog of overlays (composite PK overlay_id+version).
 *   3. ``overlay_metric_dependency`` — N:N map between an overlay and the
 *      ``metric_definition`` rows whose confidence gates rendering. Carries
 *      ``is_critical`` for the L2 cascade-suppression rule (PLAN_M3_OVERLAYS §1.1).
 *   4. ``rendered_asset`` — registry of every server-side render. Mirrors
 *      ``photo_storage`` retention semantics with ``expires_at``.
 *
 * The seed populates ``overlay_catalog_version v1.0`` (active=TRUE) with five
 * baseline overlays from PLAN_M3_OVERLAYS §2 (M3.1):
 *   - ``axis_vertical``       — vertical midline reference
 *   - ``axis_intercanthal``   — horizontal line through the inner canthi
 *   - ``grid_thirds``         — horizontal facial thirds grid
 *   - ``grid_fifths``         — vertical facial fifths grid
 *   - ``outline_face``        — face hull contour
 *
 * Cross-references for population_reference_note style provenance
 * --------------------------------------------------------------
 * The five overlays follow conventions from:
 *   - Naini, F.B. (2011) Facial Aesthetics: Concepts and Clinical Diagnosis
 *     — facial thirds, fifths, midline (chapters 4 & 6).
 *   - Powell, N. & Humphreys, B. (1984) Proportions of the Aesthetic Face
 *     — original thirds/fifths formalisation.
 *   - Edler, R.J. (2001) Background considerations to facial aesthetics
 *     — clinical use of axes/grids in orthodontic photo overlays.
 *   - Farkas, L.G. (1994) Anthropometric Facial Proportions in Medicine
 *     — intercanthal as canonical normalisation reference.
 *
 * Decisions persisted
 * -------------------
 *   - DEC-25 z_order: image base 0 → grids 10 → contours 20 → heatmaps 30
 *     → vectors 40 → labels 50. Seeded with grids @10, contours @20.
 *   - DEC-24 TTL: ``rendered_asset.expires_at`` MUST be filled at insert time
 *     by the renderer service (no DEFAULT — renderer chooses 7d default or
 *     30d opt-in based on user preference).
 *   - PLAN_M3_OVERLAYS §1.3 ``is_decorative`` flag: forced TRUE for any
 *     overlay built around presentation_only metrics (e.g. future phi grids).
 *
 * Schema notes
 * ------------
 *   - ``overlay_definition`` uses composite PK (overlay_id, version) to mirror
 *     ``metric_definition`` so historical analyses keep referential integrity
 *     after a new overlay catalog version ships.
 *   - ``overlay_metric_dependency`` carries both ``overlay_version`` AND
 *     ``metric_definition_version`` so the dependency snapshot is exact.
 *   - ``rendered_asset`` is NOT partitioned (mirrors ``landmark_payload``).
 *     Volume forecast: ~5 assets per analysis_report → assumes ~10 K rows /
 *     month at MVP scale. Range partitioning by ``generated_at`` can be added
 *     later via a single ALTER TABLE ... PARTITION BY when volumes warrant.
 *   - The composite FK ``(analysis_report_id, analysis_report_generated_at)
 *     → analysis_report (id, generated_at)`` follows the same pattern as
 *     ``landmark_payload`` and ``metric_evaluation`` (PLAN_DDL_REVIEW §2.2,
 *     migration 0003 line 127/156).
 *
 * References
 * ----------
 *   - PLAN_M3_OVERLAYS.md §2 (M3.1 backlog) and §3 (DEC-21..DEC-26)
 *   - PLAN_DDL_REVIEW.md §3 (overlay layer creation)
 *   - PLAN_METRICS.md §0 (PR-30 row, M3.1 sub-marco)
 */
export class M3OverlayCatalog1746000160000 implements MigrationInterface {
  name = 'M3OverlayCatalog1746000160000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ────────────────────────────────────────────────────────────────────
    // 1. ENUMs
    // ────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TYPE overlay_category_enum AS ENUM (
        'axis', 'grid', 'contour', 'mask', 'vector', 'heatmap', 'label'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE rendered_asset_type_enum AS ENUM (
        'single_annotated',
        'region_gallery_item',
        'before_ideal_composition',
        'heatmap_asymmetry',
        'heatmap_ideal_adherence',
        'report_pdf'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE rendered_asset_format_enum AS ENUM (
        'png', 'jpg', 'svg', 'pdf'
      )
    `);

    // ────────────────────────────────────────────────────────────────────
    // 2. overlay_catalog_version (versioning container)
    // ────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE overlay_catalog_version (
        version       TEXT PRIMARY KEY,
        description   TEXT,
        is_active     BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_overlay_catalog_version_active
        ON overlay_catalog_version (is_active)
        WHERE is_active = TRUE
    `);

    // ────────────────────────────────────────────────────────────────────
    // 3. overlay_definition (catalog of overlay specs)
    // ────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE overlay_definition (
        overlay_id        TEXT NOT NULL,
        version           TEXT NOT NULL,
        display_name      JSONB NOT NULL DEFAULT '{}'::jsonb,
        description       JSONB NOT NULL DEFAULT '{}'::jsonb,
        category          overlay_category_enum NOT NULL,
        default_visible   BOOLEAN NOT NULL DEFAULT TRUE,
        z_order           INT NOT NULL DEFAULT 10,
        legend_text       JSONB NOT NULL DEFAULT '{}'::jsonb,
        is_decorative     BOOLEAN NOT NULL DEFAULT FALSE,
        rendering_hints   JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (overlay_id, version),
        CONSTRAINT fk_overlay_definition_version
          FOREIGN KEY (version)
          REFERENCES overlay_catalog_version (version)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_overlay_definition_version ON overlay_definition (version)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_overlay_definition_category ON overlay_definition (category)`,
    );

    // ────────────────────────────────────────────────────────────────────
    // 4. overlay_metric_dependency (N:N overlay ↔ metric_definition)
    // ────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE overlay_metric_dependency (
        id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        overlay_id                  TEXT NOT NULL,
        overlay_version             TEXT NOT NULL,
        metric_id                   TEXT NOT NULL,
        metric_definition_version   TEXT NOT NULL,
        is_critical                 BOOLEAN NOT NULL DEFAULT FALSE,
        notes                       TEXT,
        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_overlay_metric_dep
          UNIQUE (overlay_id, overlay_version, metric_id, metric_definition_version),
        CONSTRAINT fk_overlay_metric_dep_overlay
          FOREIGN KEY (overlay_id, overlay_version)
          REFERENCES overlay_definition (overlay_id, version)
          ON DELETE CASCADE,
        CONSTRAINT fk_overlay_metric_dep_metric
          FOREIGN KEY (metric_id, metric_definition_version)
          REFERENCES metric_definition (metric_id, version)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_overlay_metric_dep_overlay ON overlay_metric_dependency (overlay_id, overlay_version)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_overlay_metric_dep_metric ON overlay_metric_dependency (metric_id)`,
    );

    // ────────────────────────────────────────────────────────────────────
    // 5. rendered_asset (per-analysis render registry)
    //    Mirrors landmark_payload pattern: NOT partitioned but carries
    //    analysis_report_generated_at to satisfy composite FK into
    //    partitioned analysis_report.
    // ────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      CREATE TABLE rendered_asset (
        id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        analysis_report_id              UUID NOT NULL,
        analysis_report_generated_at    TIMESTAMPTZ NOT NULL,
        asset_type                      rendered_asset_type_enum NOT NULL,
        region                          TEXT,
        overlay_ids_applied             JSONB NOT NULL DEFAULT '[]'::jsonb,
        overlay_catalog_version         TEXT,
        format                          rendered_asset_format_enum NOT NULL,
        storage_url                     TEXT NOT NULL,
        dimensions                      JSONB,
        byte_size                       BIGINT,
        generated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at                      TIMESTAMPTZ NOT NULL,
        is_expired                      BOOLEAN NOT NULL DEFAULT FALSE,
        processing_notes                JSONB,
        created_at                      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_rendered_asset_report
          FOREIGN KEY (analysis_report_id, analysis_report_generated_at)
          REFERENCES analysis_report (id, generated_at)
          ON DELETE CASCADE,
        CONSTRAINT fk_rendered_asset_overlay_version
          FOREIGN KEY (overlay_catalog_version)
          REFERENCES overlay_catalog_version (version),
        CONSTRAINT chk_rendered_asset_expiry_after_generation
          CHECK (expires_at > generated_at)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX idx_rendered_asset_report ON rendered_asset (analysis_report_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX idx_rendered_asset_type ON rendered_asset (asset_type)`,
    );
    // Partial index: tracks renders that still need expiry sweep (reduces
    // CRON scan cost — expired rows are filtered out).
    await queryRunner.query(`
      CREATE INDEX idx_rendered_asset_expiry
        ON rendered_asset (expires_at)
        WHERE is_expired = FALSE
    `);

    // ────────────────────────────────────────────────────────────────────
    // 6. SEED — overlay_catalog_version v1.0 + 5 overlays + dependencies
    // ────────────────────────────────────────────────────────────────────

    await queryRunner.query(`
      INSERT INTO overlay_catalog_version (version, description, is_active)
      VALUES (
        'v1.0',
        'M3.1 baseline — axis + grid + outline overlays. Sources: Naini 2011 §4-6, Powell & Humphreys 1984, Edler 2001, Farkas 1994.',
        TRUE
      )
    `);

    // Seed each overlay individually (clearer than a single multi-row insert
    // with JSON literals; also easier to grep when calibrating).

    // 6.1 axis_vertical — vertical midline reference
    await queryRunner.query(`
      INSERT INTO overlay_definition (
        overlay_id, version, display_name, description, category,
        default_visible, z_order, legend_text, is_decorative, rendering_hints
      ) VALUES (
        'axis_vertical',
        'v1.0',
        '{"pt-BR": "Eixo vertical (linha média)", "en": "Vertical axis (midline)"}'::jsonb,
        '{"pt-BR": "Linha vertical pelo ponto médio entre os cantos internos dos olhos. Referência geométrica para avaliar simetria horizontal.", "en": "Vertical line through midpoint between inner canthi. Geometric reference for horizontal symmetry."}'::jsonb,
        'axis',
        TRUE,
        10,
        '{"pt-BR": "Eixo de referência — não usado no cálculo do score.", "en": "Reference axis — not used in score calculation."}'::jsonb,
        FALSE,
        '{"stroke": "#22d3ee", "stroke_width": 1.5, "stroke_dasharray": "4 2"}'::jsonb
      )
    `);

    // 6.2 axis_intercanthal — horizontal line through inner canthi
    await queryRunner.query(`
      INSERT INTO overlay_definition (
        overlay_id, version, display_name, description, category,
        default_visible, z_order, legend_text, is_decorative, rendering_hints
      ) VALUES (
        'axis_intercanthal',
        'v1.0',
        '{"pt-BR": "Eixo intercantal", "en": "Intercanthal axis"}'::jsonb,
        '{"pt-BR": "Linha horizontal entre os cantos internos dos olhos. Referência canônica de normalização (Farkas 1994).", "en": "Horizontal line between inner canthi. Canonical normalisation reference (Farkas 1994)."}'::jsonb,
        'axis',
        TRUE,
        10,
        '{"pt-BR": "Distância intercantal — base de normalização das medidas.", "en": "Intercanthal distance — measurement normalisation basis."}'::jsonb,
        FALSE,
        '{"stroke": "#22d3ee", "stroke_width": 1.5}'::jsonb
      )
    `);

    // 6.3 grid_thirds — horizontal thirds (Naini §4)
    await queryRunner.query(`
      INSERT INTO overlay_definition (
        overlay_id, version, display_name, description, category,
        default_visible, z_order, legend_text, is_decorative, rendering_hints
      ) VALUES (
        'grid_thirds',
        'v1.0',
        '{"pt-BR": "Grade de terços faciais", "en": "Facial thirds grid"}'::jsonb,
        '{"pt-BR": "Linhas horizontais dividindo a face em terço superior (cabelo→sobrancelha), médio (sobrancelha→base nariz) e inferior (base nariz→queixo). Convenção clínica (Naini 2011 §4; Powell & Humphreys 1984).", "en": "Horizontal lines splitting face in upper (hairline→brow), middle (brow→nasal base) and lower (nasal base→chin) thirds. Clinical convention (Naini 2011 §4; Powell & Humphreys 1984)."}'::jsonb,
        'grid',
        FALSE,
        10,
        '{"pt-BR": "Terços faciais — convenção clínica de proporção.", "en": "Facial thirds — clinical proportion convention."}'::jsonb,
        FALSE,
        '{"stroke": "#a5b4fc", "stroke_width": 1, "stroke_dasharray": "6 3"}'::jsonb
      )
    `);

    // 6.4 grid_fifths — vertical fifths (Naini §6)
    await queryRunner.query(`
      INSERT INTO overlay_definition (
        overlay_id, version, display_name, description, category,
        default_visible, z_order, legend_text, is_decorative, rendering_hints
      ) VALUES (
        'grid_fifths',
        'v1.0',
        '{"pt-BR": "Grade de quintos faciais", "en": "Facial fifths grid"}'::jsonb,
        '{"pt-BR": "Linhas verticais dividindo a largura facial em cinco segmentos iguais à largura ocular. Convenção clínica (Naini 2011 §6).", "en": "Vertical lines splitting facial width in five equal eye-width segments. Clinical convention (Naini 2011 §6)."}'::jsonb,
        'grid',
        FALSE,
        10,
        '{"pt-BR": "Quintos faciais — proporção horizontal canônica.", "en": "Facial fifths — canonical horizontal proportion."}'::jsonb,
        FALSE,
        '{"stroke": "#a5b4fc", "stroke_width": 1, "stroke_dasharray": "6 3"}'::jsonb
      )
    `);

    // 6.5 outline_face — face hull contour
    await queryRunner.query(`
      INSERT INTO overlay_definition (
        overlay_id, version, display_name, description, category,
        default_visible, z_order, legend_text, is_decorative, rendering_hints
      ) VALUES (
        'outline_face',
        'v1.0',
        '{"pt-BR": "Contorno facial", "en": "Face outline"}'::jsonb,
        '{"pt-BR": "Polilinha conectando os landmarks do contorno facial (face hull). Útil para visualizar shape global e aderência da detecção.", "en": "Polyline connecting facial outline landmarks (face hull). Useful for global shape and detection adherence."}'::jsonb,
        'contour',
        FALSE,
        20,
        '{"pt-BR": "Contorno detectado — ajuda a verificar qualidade do tracking.", "en": "Detected outline — helps verify tracking quality."}'::jsonb,
        FALSE,
        '{"stroke": "#67e8f9", "stroke_width": 1.5, "fill": "none"}'::jsonb
      )
    `);

    // ────────────────────────────────────────────────────────────────────
    // 7. SEED — overlay_metric_dependency
    //    All metric_id references point to existing rows in metric_definition
    //    version 'v1.0' (metric_registry_version active row, see PR-11..20).
    //    is_critical=TRUE means: if dependency confidence_final<threshold,
    //    overlay is fully suppressed (L2). is_critical=FALSE means: degraded
    //    rendering with warning legend (L3 per PLAN_M3_OVERLAYS §1.1).
    // ────────────────────────────────────────────────────────────────────

    // axis_vertical — non-critical link to midline_deviation (axis is geometric)
    await queryRunner.query(`
      INSERT INTO overlay_metric_dependency (
        overlay_id, overlay_version, metric_id, metric_definition_version,
        is_critical, notes
      ) VALUES (
        'axis_vertical', 'v1.0', 'midline_deviation', 'v1.0',
        FALSE,
        'Non-critical: axis renders even if midline deviation is low-confidence; legend shows confidence indicator instead of suppression.'
      )
    `);

    // axis_intercanthal — critical: needs intercanthal distance to compute scale
    await queryRunner.query(`
      INSERT INTO overlay_metric_dependency (
        overlay_id, overlay_version, metric_id, metric_definition_version,
        is_critical, notes
      ) VALUES (
        'axis_intercanthal', 'v1.0', 'intercanthal_distance', 'v1.0',
        TRUE,
        'Critical: axis position depends on the inner canthi being reliably detected. If confidence_final<0.4 the overlay must be suppressed (L2 per PLAN_M3_OVERLAYS §1.1).'
      )
    `);

    // grid_thirds — critical on each of the three thirds metrics
    for (const metricId of ['upper_third_ratio', 'middle_third_ratio', 'lower_third_ratio']) {
      await queryRunner.query(`
        INSERT INTO overlay_metric_dependency (
          overlay_id, overlay_version, metric_id, metric_definition_version,
          is_critical, notes
        ) VALUES (
          'grid_thirds', 'v1.0', '${metricId}', 'v1.0',
          TRUE,
          'Critical: grid line position is derived from the corresponding thirds ratio.'
        )
      `);
    }

    // grid_fifths — critical on each of the five fifths metrics
    for (const metricId of [
      'fifth_1_ratio',
      'fifth_2_ratio',
      'fifth_3_ratio',
      'fifth_4_ratio',
      'fifth_5_ratio',
    ]) {
      await queryRunner.query(`
        INSERT INTO overlay_metric_dependency (
          overlay_id, overlay_version, metric_id, metric_definition_version,
          is_critical, notes
        ) VALUES (
          'grid_fifths', 'v1.0', '${metricId}', 'v1.0',
          TRUE,
          'Critical: vertical line at fifth boundary depends on this ratio being reliable.'
        )
      `);
    }

    // outline_face — non-critical link to global_asymmetry_index
    await queryRunner.query(`
      INSERT INTO overlay_metric_dependency (
        overlay_id, overlay_version, metric_id, metric_definition_version,
        is_critical, notes
      ) VALUES (
        'outline_face', 'v1.0', 'global_asymmetry_index', 'v1.0',
        FALSE,
        'Non-critical: outline still renders if asymmetry is low-confidence; legend shows confidence indicator.'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS rendered_asset`);
    await queryRunner.query(`DROP TABLE IF EXISTS overlay_metric_dependency`);
    await queryRunner.query(`DROP TABLE IF EXISTS overlay_definition`);
    await queryRunner.query(`DROP TABLE IF EXISTS overlay_catalog_version`);
    await queryRunner.query(`DROP TYPE IF EXISTS rendered_asset_format_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS rendered_asset_type_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS overlay_category_enum`);
  }
}
