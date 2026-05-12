/**
 * DiagnosisReport persistence migration (PR-66).
 *
 * Replaces the in-memory ``Map<run_id, DiagnosisReportDto>`` previously held
 * by ``DiagnosisService`` so reports survive process restarts.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class DiagnosisReport1746000410000 implements MigrationInterface {
  name = 'DiagnosisReport1746000410000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS diagnosis_report (
        run_id       TEXT PRIMARY KEY,
        top_concerns JSONB NOT NULL DEFAULT '[]'::jsonb,
        summary      TEXT NOT NULL,
        "timestamp"  TEXT NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_diagnosis_report_created_at ON diagnosis_report (created_at)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS diagnosis_report`);
  }
}
