/**
 * 0002 — Seed initial catalogs (PR-2.3).
 *
 * Inserts the v1.0 baseline rows for every versioned catalog table so the
 * orchestrator has a working configuration on a fresh database.
 *
 * Idempotent: every INSERT uses ON CONFLICT DO NOTHING so re-running the
 * migration on a partially seeded database is safe.
 *
 * Notes:
 *   - No metric_definition / metric_ideal rows yet — those land in PR-3 with
 *     the four metric-family YAMLs (eyes, midface, mouth, jaw).
 *   - Disclaimer text is the canonical v1 wording locked during planning.
 *     Any change of wording requires a new analysis_threshold_config version.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

const DISCLAIMER_V1 = [
  'Esta análise é uma observação estética e geométrica produzida a partir de uma única foto.',
  'Não constitui diagnóstico médico, odontológico, fisioterapêutico ou de qualquer natureza clínica,',
  'e não substitui avaliação profissional presencial.',
  'Os resultados são sensíveis à qualidade da foto, ângulo, iluminação e expressão capturados.',
  'Se você apresenta dor, dificuldade funcional (na mastigação, respiração ou postura) ou desconforto persistente,',
  'procure um profissional habilitado.',
].join(' ');

const SEVERITY_MAPPING_V1 = {
  ideal: 'LEVE',
  mild: 'LEVE',
  moderate: 'MODERADO',
  strong: 'SEVERO',
  extreme: 'SEVERO',
};

export class SeedInitialCatalogs1746000020000 implements MigrationInterface {
  name = 'SeedInitialCatalogs1746000020000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO metric_registry_version (version, description, is_active)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (version) DO NOTHING`,
      ['v1.0', 'M1 baseline metric registry (eyes, midface, mouth, jaw families).'],
    );

    await queryRunner.query(
      `INSERT INTO ideals_version (version, description, is_active)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (version) DO NOTHING`,
      ['v1.0', 'M1 baseline ideals (canonical type per DEC-2 hybrid-canonical strategy).'],
    );

    await queryRunner.query(
      `INSERT INTO analysis_threshold_config (
         version,
         min_confidence_to_display_metric,
         min_confidence_to_show_global_score,
         score_band_no_number_max,
         score_band_refine_max,
         score_band_good_max,
         disclaimer_text_snapshot,
         is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       ON CONFLICT (version) DO NOTHING`,
      ['v1.0', 0.4, 0.5, 50.0, 70.0, 85.0, DISCLAIMER_V1],
    );

    await queryRunner.query(
      `INSERT INTO severity_collapse_policy (version, mapping, is_active)
       VALUES ($1, $2::jsonb, TRUE)
       ON CONFLICT (version) DO NOTHING`,
      ['v1.0', JSON.stringify(SEVERITY_MAPPING_V1)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM severity_collapse_policy WHERE version = 'v1.0'`);
    await queryRunner.query(`DELETE FROM analysis_threshold_config WHERE version = 'v1.0'`);
    await queryRunner.query(`DELETE FROM ideals_version WHERE version = 'v1.0'`);
    await queryRunner.query(`DELETE FROM metric_registry_version WHERE version = 'v1.0'`);
  }
}
