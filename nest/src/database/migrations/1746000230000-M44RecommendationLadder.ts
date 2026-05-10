import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-55b — M4.3 Recommendation Ladder (taxonomy expansion)
 *
 * Refines the recommendation catalog created in PR-55 (1746000200000) to
 * support the 5-level invasiveness ladder agreed with product on
 * 2026-05-09. See plan: `.claude/plans/fa-a-mais-uma-revis-o-quirky-hopper.md`.
 *
 * Changes (additive — no data loss)
 * ---------------------------------
 *   1. `recommendation_category_enum`: append values
 *      - `exercise`           (level 2 — mioterapia, face yoga, etc.)
 *      - `aesthetic_procedure` (level 4a — botox masseter, fillers, PDO)
 *      Total: 8 categories.
 *   2. New TYPE `evidence_level_enum` ('strong' | 'moderate' | 'anecdotal').
 *   3. `recommendation_catalog` adds:
 *      - `invasiveness_level`        SMALLINT NOT NULL (0..4)
 *      - `evidence_level`            evidence_level_enum NOT NULL DEFAULT 'moderate'
 *      - `requires_anecdotal_disclaimer` BOOLEAN GENERATED ALWAYS AS
 *                                    (evidence_level='anecdotal') STORED
 *      - `clinical_pathway_required` BOOLEAN NOT NULL DEFAULT FALSE
 *      - `references_jsonb`          JSONB NOT NULL DEFAULT '[]'
 *      - `disclaimer_template`       TEXT nullable
 *      Existing rows backfilled with invasiveness derived from category.
 *   4. `recommendation_catalog.professional_type` CHECK extended to allow
 *      `'oral_maxillofacial_surgeon'` (jaw / bucomaxilo cases).
 *   5. `recommendation_trigger` adds:
 *      - `min_invasiveness_level` SMALLINT NULL
 *      - `clinical_pathway_required` BOOLEAN NOT NULL DEFAULT FALSE
 *
 * Editorial constraint
 * --------------------
 * `clinical_pathway_required=TRUE` allows level-4b professional_referral to
 * fire BEFORE severity=extreme — used only for clinically-mandated regions
 * (oclusão dentária, função respiratória, dermato clara). The default
 * (FALSE) keeps the engine in the "app-first" posture per plan §Visão de
 * produto: app cobre a maior parte das melhorias; profissional é informação
 * adicional, não exigência.
 */
export class M44RecommendationLadder1746000230000 implements MigrationInterface {
  name = 'M44RecommendationLadder1746000230000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enum values 'exercise', 'aesthetic_procedure' and evidence_level_enum
    // are created by 1746000225000-M44LadderEnumValues (must run outside
    // transaction so they are usable here for UPDATE / CHECK).

    // 3a. New columns on recommendation_catalog (nullable first, backfill, then NOT NULL)
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS invasiveness_level SMALLINT
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS evidence_level evidence_level_enum
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS clinical_pathway_required BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS references_jsonb JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS disclaimer_template TEXT
    `);

    // Backfill invasiveness_level from category for any existing rows.
    await queryRunner.query(`
      UPDATE recommendation_catalog
         SET invasiveness_level = CASE category
           WHEN 'photo'                 THEN 0
           WHEN 'presentation_only'     THEN 0
           WHEN 'posture'               THEN 1
           WHEN 'lifestyle'             THEN 1
           WHEN 'exercise'              THEN 2
           WHEN 'styling'               THEN 3
           WHEN 'aesthetic_procedure'   THEN 4
           WHEN 'professional_referral' THEN 4
         END
       WHERE invasiveness_level IS NULL
    `);
    await queryRunner.query(`
      UPDATE recommendation_catalog
         SET evidence_level = 'moderate'
       WHERE evidence_level IS NULL
    `);

    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ALTER COLUMN invasiveness_level SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ALTER COLUMN evidence_level SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ALTER COLUMN evidence_level SET DEFAULT 'moderate'
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD CONSTRAINT chk_rec_catalog_invasiveness_range
        CHECK (invasiveness_level BETWEEN 0 AND 4)
    `);

    // 3b. Generated column for anecdotal disclaimer flag.
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD COLUMN IF NOT EXISTS requires_anecdotal_disclaimer BOOLEAN
        GENERATED ALWAYS AS (evidence_level = 'anecdotal') STORED
    `);

    // 3c. CHECK enforcing disclaimer presence when evidence is anecdotal.
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD CONSTRAINT chk_rec_anecdotal_disclaimer
        CHECK (evidence_level <> 'anecdotal' OR (disclaimer_template IS NOT NULL AND length(disclaimer_template) > 0))
    `);

    // 4. Extend professional_type CHECK to include oral_maxillofacial_surgeon.
    //    PostgreSQL doesn't support modifying inline CHECK constraints in place;
    //    drop the unnamed one (auto-named by Postgres) and recreate with full set.
    await queryRunner.query(`
      DO $$
      DECLARE
        cname TEXT;
      BEGIN
        SELECT conname INTO cname
        FROM pg_constraint
        WHERE conrelid = 'recommendation_catalog'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) ILIKE '%professional_type%'
        LIMIT 1;
        IF cname IS NOT NULL THEN
          EXECUTE format('ALTER TABLE recommendation_catalog DROP CONSTRAINT %I', cname);
        END IF;
      END $$
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD CONSTRAINT chk_rec_professional_type
        CHECK (professional_type IS NULL OR professional_type IN (
          'dentist',
          'physiotherapist',
          'dermatologist',
          'otolaryngologist',
          'plastic_surgeon',
          'orthodontist',
          'oral_maxillofacial_surgeon'
        ))
    `);

    // 5. recommendation_trigger expansions.
    await queryRunner.query(`
      ALTER TABLE recommendation_trigger
        ADD COLUMN IF NOT EXISTS min_invasiveness_level SMALLINT
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_trigger
        ADD COLUMN IF NOT EXISTS clinical_pathway_required BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_trigger
        ADD CONSTRAINT chk_rec_trigger_min_invasiveness_range
        CHECK (min_invasiveness_level IS NULL OR min_invasiveness_level BETWEEN 0 AND 4)
    `);

    // Comments for auditability.
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_catalog.invasiveness_level IS
        'PR-55b: 0..4 ladder. 0=photo/info, 1=lifestyle/posture, 2=exercise, 3=styling, 4=aesthetic_procedure or professional_referral. Engine (PR-57) prefers lower levels first; level 4 only when severity=extreme OR clinical_pathway_required=TRUE.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_catalog.evidence_level IS
        'PR-55b: strong (RCT/consensus), moderate (clinical practice), anecdotal (popular without RCT — mewing, face yoga). anecdotal rows MUST carry disclaimer_template (CHECK chk_rec_anecdotal_disclaimer).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_catalog.clinical_pathway_required IS
        'PR-55b: When TRUE, allows level-4b professional_referral to fire before severity=extreme. Use only for clinically-mandated regions (oclusão dentária, função respiratória, derma clara). Default FALSE preserves the "app-first" posture.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_catalog.references_jsonb IS
        'PR-55b: JSONB array of {citation, url} for editorial provenance (Felício et al., Naini, SBD, etc.). Audit-only — not rendered to user.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_catalog.disclaimer_template IS
        'PR-55b: Optional disclaimer text rendered alongside the recommendation. Required when evidence_level=anecdotal. Supports {professional_type_pt} placeholder for professional_referral / aesthetic_procedure rows.'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_trigger.min_invasiveness_level IS
        'PR-55b: Optional floor on invasiveness ladder for this trigger. NULL = no floor (engine selects globally).'
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN recommendation_trigger.clinical_pathway_required IS
        'PR-55b: When TRUE, this specific trigger bypasses the severity=extreme gate for level-4b recommendations.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse engineering of ENUMs requires recreate — keep additions in down
    // for catalog/trigger columns only, since dropping enum values is not
    // supported by PostgreSQL without rewriting the type.
    await queryRunner.query(`
      ALTER TABLE recommendation_trigger
        DROP CONSTRAINT IF EXISTS chk_rec_trigger_min_invasiveness_range
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_trigger
        DROP COLUMN IF EXISTS clinical_pathway_required
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_trigger
        DROP COLUMN IF EXISTS min_invasiveness_level
    `);

    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS chk_rec_professional_type
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS chk_rec_anecdotal_disclaimer
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP CONSTRAINT IF EXISTS chk_rec_catalog_invasiveness_range
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS requires_anecdotal_disclaimer
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS disclaimer_template
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS references_jsonb
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS clinical_pathway_required
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS evidence_level
    `);
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        DROP COLUMN IF EXISTS invasiveness_level
    `);

    await queryRunner.query(`DROP TYPE IF EXISTS evidence_level_enum`);

    // Restore narrower professional_type CHECK (without oral_maxillofacial_surgeon).
    await queryRunner.query(`
      ALTER TABLE recommendation_catalog
        ADD CONSTRAINT chk_rec_professional_type
        CHECK (professional_type IS NULL OR professional_type IN (
          'dentist',
          'physiotherapist',
          'dermatologist',
          'otolaryngologist',
          'plastic_surgeon',
          'orthodontist'
        ))
    `);

    // Note: enum values 'exercise' and 'aesthetic_procedure' are NOT removed
    // (PostgreSQL has no DROP VALUE). They remain unused after rollback.
  }
}
