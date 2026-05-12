import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-58 — M4.4 priority_score_audit
 *
 * Creates the audit table for `DiagnosticPriorityService` (PR-58). One row
 * per `recommendation_link` records the full decomposition of the score
 * formula `(I × S × C × A) × (1 − R) × (1 − E × 0.5)`, the cascade
 * `raw → penalized → final`, the source FKs (DDL_REVIEW §5.7), and the
 * suppression reason when DEC-38 ladder rules or risk/actionability
 * guardrails zero out the final score.
 *
 * NOT partitioned: row volume is bounded by recommendation_link count per
 * report (≤500 typical, ~50–80 average); partitioning is overkill at this
 * stage. Reassess post-MVP if rendered_asset / analysis_report rotation
 * pressures storage.
 *
 * UNIQUE (recommendation_link_id) enforces 1:1 with the link and enables
 * idempotent UPSERT on re-run of `prioritize()`.
 *
 * References
 * ----------
 *   - PLAN_M4_NARRATIVE.md §2.4 (PR-58 backlog row)
 *   - PLAN_DDL_REVIEW.md §5.7 (priority_score_audit + 5 source FKs)
 *   - .claude/database/ddl.sql lines 597–630 (legacy DDL of the table)
 *   - .claude/local/plans/marcos/M4_PR58_DiagnosticPriorityService.md §2 (PR-58.1)
 */
export class M44PriorityScoreAudit1746000290000 implements MigrationInterface {
  name = 'M44PriorityScoreAudit1746000290000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS priority_score_audit (
        id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        recommendation_link_id          UUID NOT NULL,
        analysis_report_id              UUID NOT NULL,
        analysis_report_generated_at    TIMESTAMPTZ NOT NULL,

        "I"                             NUMERIC(6,5),
        "S"                             NUMERIC(6,5),
        "C"                             NUMERIC(6,5),
        "A"                             NUMERIC(6,5),
        "E"                             NUMERIC(6,5),
        "R"                             NUMERIC(6,5),

        raw_score                       NUMERIC(8,6) NOT NULL,
        penalized_score                 NUMERIC(8,6) NOT NULL,
        final_score                     NUMERIC(8,6) NOT NULL,
        photo_quality_score_applied     NUMERIC(6,5),

        severity_source_against_ideal_id  UUID,
        confidence_source_evaluation_id   UUID,
        risk_source_recommendation_id     TEXT,
        invasiveness_level_applied        SMALLINT,

        suppression_reason              TEXT,
        dec38_rank_position             INTEGER,

        scored_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        service_version                 TEXT NOT NULL DEFAULT 'pr-58.v1',

        CONSTRAINT chk_psa_raw_ge_penalized
          CHECK (raw_score >= penalized_score - 1e-9),
        CONSTRAINT chk_psa_penalized_ge_final
          CHECK (penalized_score >= final_score - 1e-9),
        CONSTRAINT chk_psa_invasiveness
          CHECK (invasiveness_level_applied IS NULL
                 OR invasiveness_level_applied BETWEEN 0 AND 4),
        CONSTRAINT chk_psa_suppression
          CHECK (suppression_reason IS NULL OR suppression_reason IN (
            'high_risk_self_application',
            'no_actionability',
            'clinical_pathway_not_required',
            'dec38_ladder_isolated_4b',
            'dec38_max_category_exceeded'
          )),
        CONSTRAINT uq_psa_link UNIQUE (recommendation_link_id)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_psa_report
        ON priority_score_audit (analysis_report_id, analysis_report_generated_at)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_psa_suppression
        ON priority_score_audit (suppression_reason)
        WHERE suppression_reason IS NOT NULL
    `);

    await queryRunner.query(`
      COMMENT ON TABLE priority_score_audit IS
        'PR-58: audit log for DiagnosticPriorityService. 1:1 with recommendation_link. Records all formula components, raw→penalized→final cascade, source FKs (DDL_REVIEW §5.7), and DEC-38 suppression reasons.'
    `);

    const componentComments: Array<[string, string]> = [
      ['"I"', 'Impact in [0,1]. Normalized recommendation_catalog.priority_default (1→0.2…5→1.0).'],
      ['"S"', 'Severity in [0,1]. Worst severity_5 across triggering metric_evaluation_against_ideal rows.'],
      ['"C"', 'Confidence in [0,1]. confidence_final from the evaluation that produced worst S.'],
      ['"A"', 'Actionability in [0,1]. Inverse of effort_estimate (low=1.0, medium=0.6, high=0.3).'],
      ['"E"', 'Effort in [0,1]. Encoded effort_estimate (low=0.0, medium=0.5, high=1.0).'],
      ['"R"', 'Risk in [0,1]. recommendation_catalog.risk_level. R>0.7 → bloqueio total via guardrail.'],
      ['raw_score', '(I·S·C·A)·(1−R)·(1−E·0.5) puro, sem penalidade nem guardrail.'],
      ['penalized_score', 'raw_score · (1 − quality_penalty), com quality_penalty = (1−photo_quality_score)·0.3 capped.'],
      ['final_score', 'penalized_score após guardrails (R>0.7, A=0 fora de professional_referral, DEC-38). Pode ser 0.'],
      ['suppression_reason', 'NULL quando exibido. Caso contrário identifica qual regra zerou final_score.'],
      ['dec38_rank_position', 'Posição final (1-based) após reordenação DEC-38. NULL para suprimidos da exibição.'],
    ];

    for (const [col, text] of componentComments) {
      await queryRunner.query(
        `COMMENT ON COLUMN priority_score_audit.${col} IS '${text.replace(/'/g, "''")}'`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_psa_suppression`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_psa_report`);
    await queryRunner.query(`DROP TABLE IF EXISTS priority_score_audit`);
  }
}
