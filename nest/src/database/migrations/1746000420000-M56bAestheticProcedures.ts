/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * PR-56b — Aesthetic Procedures Catalog Seed
 *
 * Seeds aesthetic_procedure entries in recommendation_catalog for severe
 * deviations where non-invasive approaches (exercise/posture/styling) are
 * insufficient. All entries:
 *   - category = 'aesthetic_procedure'
 *   - requires_professional = true
 *   - professional_type = 'plastic_surgeon' (enum-checked)
 *   - invasiveness_level = 3 (minimally invasive: injections / threads)
 *   - evidence_level = 'moderate' (default; no anecdotal disclaimer required)
 *   - version = 'v1.0'
 *
 * Triggers fire only on severity ∈ {moderate, strong, extreme}, per the
 * escada DEC-38 (R1–R5): nível 4a só aparece quando o degrau 1-3 não basta.
 *
 * History note: this file was originally created during PR-56b execution but
 * never committed to the repo (only the compiled `.js` survived in dist/).
 * Reconstructed in 2026-05-12 from the live DB rows and the orphan `.js`,
 * using `ON CONFLICT (id) DO NOTHING` so re-application on a populated DB
 * is a no-op.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

export class M56bAestheticProcedures1746000420000 implements MigrationInterface {
  name = 'M56bAestheticProcedures1746000420000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO recommendation_catalog
        (id, version, category, display_text_short_pt, display_text_long_pt,
         priority_default, effort_estimate, risk_level, requires_professional,
         professional_type, invasiveness_level, evidence_level, created_at)
      VALUES
        ('botox-masseter', 'v1.0', 'aesthetic_procedure',
         'Toxina botulínica no masseter para reduzir a largura mandibular.',
         'Aplicação de toxina botulínica no músculo masseter reduz sua hipertrofia, estreitando a largura mandibular e criando aparência mais oval. Efeito dura 4-6 meses e é reversível.',
         4, 'medium', 0.200, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('botox-frontal', 'v1.0', 'aesthetic_procedure',
         'Toxina botulínica frontal para elevar as sobrancelhas.',
         'Aplicação na região frontal eleva levemente as sobrancelhas, abrindo o olhar e reduzindo rugas horizontais. Efeito dura 3-4 meses.',
         4, 'medium', 0.150, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('filler-malares', 'v1.0', 'aesthetic_procedure',
         'Preenchimento malar com ácido hialurônico.',
         'Restaura volume malar perdido, elevando as maçãs e criando aparência mais jovem e definida. Efeito dura 12-18 meses.',
         4, 'medium', 0.250, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('filler-labial', 'v1.0', 'aesthetic_procedure',
         'Preenchimento labial com ácido hialurônico.',
         'Aumenta volume e definição dos lábios, melhorando a proporção labial. Efeito dura 6-12 meses.',
         4, 'medium', 0.200, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('filler-mento', 'v1.0', 'aesthetic_procedure',
         'Preenchimento mentoniano para projetar o queixo.',
         'Aumenta a projeção do queixo, melhorando o perfil e a definição mandibular. Efeito dura 12-18 meses.',
         4, 'medium', 0.250, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('filler-zigomatic-arch', 'v1.0', 'aesthetic_procedure',
         'Preenchimento do arco zigomático para definição lateral.',
         'Cria uma linha de definição mais nítida da face, melhorando a estrutura óssea aparente. Efeito dura 12-18 meses.',
         4, 'medium', 0.300, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('threads-pdo-jawline', 'v1.0', 'aesthetic_procedure',
         'Fios PDO para sustentação da linha mandibular.',
         'Rede de fios de polidioxanona eleva tecidos e melhora a definição do queixo. Fios se dissolvem em 6-12 meses estimulando colágeno.',
         4, 'medium', 0.400, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('threads-pdo-temporal', 'v1.0', 'aesthetic_procedure',
         'Fios PDO temporais para elevar as sobrancelhas.',
         'Cria efeito lifting não-cirúrgico na região temporal, elevando sobrancelhas e reduzindo rugas frontais.',
         4, 'medium', 0.350, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('rinomodelacao', 'v1.0', 'aesthetic_procedure',
         'Rinomodelação não-cirúrgica com ácido hialurônico.',
         'Corrige irregularidades do dorso nasal, eleva a ponta ou corrige assimetrias leves. Resultado temporário (6-12 meses).',
         4, 'medium', 0.300, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('mentoplastia-filler', 'v1.0', 'aesthetic_procedure',
         'Mentoplastia não-cirúrgica com preenchimento de alta densidade.',
         'Aumenta projeção e largura do queixo com ácido hialurônico denso, melhorando perfil e equilíbrio facial. Efeito dura 12-24 meses.',
         4, 'medium', 0.350, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('temporal-filler', 'v1.0', 'aesthetic_procedure',
         'Preenchimento temporal para rejuvenescimento global.',
         'Restaura volume das fossas temporais, criando aparência mais jovem e harmoniosa. Efeito dura 12-18 meses.',
         4, 'medium', 0.250, true, 'plastic_surgeon', 3, 'moderate', NOW()),

        ('jawline-definition-combo', 'v1.0', 'aesthetic_procedure',
         'Protocolo combinado: fillers + toxina para definição mandibular.',
         'Combina preenchimento mandibular e toxina botulínica no masseter para criar linha mandibular definida e estreitar a largura facial.',
         4, 'high', 0.600, true, 'plastic_surgeon', 3, 'moderate', NOW())
      ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO recommendation_trigger
        (recommendation_id, metric_id, severity, direction, created_at)
      VALUES
        ('botox-masseter', 'jaw_width_pct_ipd', 'strong', 'high', NOW()),
        ('botox-masseter', 'jaw_width_pct_ipd', 'extreme', 'high', NOW()),

        ('filler-malares', 'malar_volume_deviation', 'strong', 'low', NOW()),
        ('filler-malares', 'malar_volume_deviation', 'extreme', 'low', NOW()),
        ('temporal-filler', 'malar_volume_deviation', 'extreme', 'low', NOW()),

        ('filler-mento', 'chin_projection_pct_ipd', 'strong', 'low', NOW()),
        ('filler-mento', 'chin_projection_pct_ipd', 'extreme', 'low', NOW()),
        ('mentoplastia-filler', 'chin_projection_pct_ipd', 'extreme', 'low', NOW()),

        ('threads-pdo-jawline', 'gonial_angle_mean_deg', 'strong', 'high', NOW()),
        ('jawline-definition-combo', 'gonial_angle_mean_deg', 'extreme', 'high', NOW()),

        ('rinomodelacao', 'nose_deviation_pct_ipd', 'moderate', 'any', NOW()),
        ('rinomodelacao', 'nose_deviation_pct_ipd', 'strong', 'any', NOW()),

        ('botox-frontal', 'brow_tilt_left_deg', 'moderate', 'low', NOW()),
        ('botox-frontal', 'brow_tilt_right_deg', 'moderate', 'low', NOW()),
        ('threads-pdo-temporal', 'brow_tilt_left_deg', 'strong', 'low', NOW()),
        ('threads-pdo-temporal', 'brow_tilt_right_deg', 'strong', 'low', NOW()),

        ('filler-labial', 'upper_lower_lip_ratio', 'moderate', 'low', NOW()),
        ('filler-labial', 'upper_lower_lip_ratio', 'strong', 'low', NOW())
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Triggers cascade via FK ON DELETE CASCADE on recommendation_catalog.
    const ids = [
      'botox-masseter', 'botox-frontal',
      'filler-malares', 'filler-labial', 'filler-mento', 'filler-zigomatic-arch',
      'threads-pdo-jawline', 'threads-pdo-temporal',
      'rinomodelacao', 'mentoplastia-filler',
      'temporal-filler', 'jawline-definition-combo',
    ];
    await queryRunner.query(
      `DELETE FROM recommendation_catalog WHERE id = ANY($1)`,
      [ids],
    );
  }
}
