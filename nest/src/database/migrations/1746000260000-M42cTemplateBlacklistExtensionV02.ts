import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-54 — M4.2 Template Blacklist v0.2 extension
 *
 * Adds 15 new forbidden terms (Opus tone audit) on top of v0.1's 10 baseline
 * terms. Activates v0.2 and deactivates v0.1 atomically. Reseeds the original
 * 10 terms under v0.2 so the active version remains a complete corpus rather
 * than a delta-only set.
 *
 * Categories used (from M41 CHECK constraint):
 *   diagnostic_verb | pathology_word | guarantee_word | medical_intervention | pejorative
 *
 * New v0.2 terms (15)
 * -------------------
 *   pejorative           → severo, gravíssimo, alarmante, fraco, ruim,
 *                          irreversível, drástico, preocupante
 *   pathology_word       → comprometido, deficitário
 *   guarantee_word       → garantido, transformador, milagre, definitivo,
 *                          único caminho
 *
 * Pre-validation
 * --------------
 *   psql query confirmed zero existing diagnostic_template rows in
 *   v1.0 (M42 mediums + M42b shorts/longs) contain any of the 15 new terms,
 *   so activating v0.2 is lint-safe immediately upon migration.
 *
 * References
 * ----------
 *   - PLAN_M4_NARRATIVE.md §1.1 (linha vermelha) + §3 DEC-32
 *   - PR-50 (M41) — schema + v0.1 seed
 *   - .claude/local/plans/marcos/M4_PR54_TONE_REVIEW.md — full audit report
 */
export class M42cTemplateBlacklistExtensionV021746000260000
  implements MigrationInterface
{
  name = 'M42cTemplateBlacklistExtensionV021746000260000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Deactivate previous active version, then create v0.2 as active.
    //    Two-step guarantees the partial-unique index (one active version)
    //    is never violated mid-transaction.
    await queryRunner.query(`
      UPDATE template_blacklist_version
         SET is_active = FALSE
       WHERE is_active = TRUE
    `);

    await queryRunner.query(`
      INSERT INTO template_blacklist_version (version, is_active, notes)
      VALUES (
        'v0.2',
        TRUE,
        'PR-54 M4 tone-review extension — adds 15 vendedor/pejorative/promise terms on top of v0.1 baseline. Reseeds v0.1''s 10 terms under v0.2 so the active corpus is self-contained.'
      )
      ON CONFLICT (version) DO UPDATE SET is_active = TRUE, notes = EXCLUDED.notes
    `);

    // 2. Reseed v0.1 baseline under v0.2 (10 terms).
    await queryRunner.query(`
      INSERT INTO template_blacklist_term (version, term, category, notes)
      VALUES
        ('v0.2', 'diagnostico',     'diagnostic_verb',  'Verbo diagnóstico: implica condição médica.'),
        ('v0.2', 'diagnostica',     'diagnostic_verb',  'Verbo diagnóstico conjugado.'),
        ('v0.2', 'patologia',       'pathology_word',   'Conota doença; análise é estética/geométrica.'),
        ('v0.2', 'deficiencia',     'pathology_word',   'Conota condição médica anormal.'),
        ('v0.2', 'disturbio',       'pathology_word',   'Conota condição médica.'),
        ('v0.2', 'deformidade',     'pathology_word',   'Tom pejorativo + médico.'),
        ('v0.2', 'anomalia',        'pathology_word',   'Conota anormalidade clínica.'),
        ('v0.2', 'garantimos',      'guarantee_word',   'Promessa de resultado proibida.'),
        ('v0.2', 'vai melhorar',    'guarantee_word',   'Promessa de resultado proibida.'),
        ('v0.2', 'corrige',         'guarantee_word',   'Sugere correção médica garantida.')
      ON CONFLICT ON CONSTRAINT uq_template_blacklist_term DO NOTHING
    `);

    // 3. Add the 15 new v0.2 extension terms.
    await queryRunner.query(`
      INSERT INTO template_blacklist_term (version, term, category, notes)
      VALUES
        -- pejorative tone (8)
        ('v0.2', 'severo',          'pejorative',       'Substituir por "considerável" (linha vermelha §1.1).'),
        ('v0.2', 'gravíssimo',      'pejorative',       'Tom alarmista; análise é estética, não clínica.'),
        ('v0.2', 'alarmante',       'pejorative',       'Tom sensacionalista; viola observação neutra.'),
        ('v0.2', 'fraco',           'pejorative',       'Pejorativo; substituir por "discreto" / "leve".'),
        ('v0.2', 'ruim',            'pejorative',       'Pejorativo direto; viola tom neutro.'),
        ('v0.2', 'irreversível',    'pejorative',       'Tom fatalista; análise é descritiva, não prognóstica.'),
        ('v0.2', 'drástico',        'pejorative',       'Tom alarmista; substituir por "considerável".'),
        ('v0.2', 'preocupante',     'pejorative',       'Tom alarmista; análise é geométrica, não clínica.'),
        -- pathology connotation (2)
        ('v0.2', 'comprometido',    'pathology_word',   'Conota dano clínico; uso reservado a contextos médicos.'),
        ('v0.2', 'deficitário',     'pathology_word',   'Conota déficit clínico; substituir por "abaixo da referência".'),
        -- guarantee / sales tone (5)
        ('v0.2', 'garantido',       'guarantee_word',   'Promessa de resultado; viola DEC-32 (no-promise rule).'),
        ('v0.2', 'transformador',   'guarantee_word',   'Tom vendedor; promete transformação.'),
        ('v0.2', 'milagre',         'guarantee_word',   'Tom vendedor / sensacionalista; proibido.'),
        ('v0.2', 'definitivo',      'guarantee_word',   'Promessa de resultado permanente; proibido.'),
        ('v0.2', 'único caminho',   'guarantee_word',   'Tom vendedor coercitivo; proibido.')
      ON CONFLICT ON CONSTRAINT uq_template_blacklist_term DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove all v0.2 terms then v0.2 version, then reactivate v0.1.
    await queryRunner.query(`
      DELETE FROM template_blacklist_term WHERE version = 'v0.2'
    `);
    await queryRunner.query(`
      DELETE FROM template_blacklist_version WHERE version = 'v0.2'
    `);
    await queryRunner.query(`
      UPDATE template_blacklist_version
         SET is_active = TRUE
       WHERE version = 'v0.1'
    `);
  }
}
