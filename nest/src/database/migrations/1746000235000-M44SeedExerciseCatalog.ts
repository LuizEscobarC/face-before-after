/**
 * PR-55c — Seed do catálogo de exercícios (categoria `exercise`, nível 2).
 *
 * Popula `recommendation_catalog` v1.0 com exercícios faciais e posturais
 * cobrindo todas as 9 regiões de métrica do projeto. Cada região recebe um
 * mix de:
 *   - `evidence_level='moderate'` — prática clínica estabelecida (mioterapia
 *     orofacial, fisioterapia cervical, exercícios oculares).
 *   - `evidence_level='anecdotal'` — práticas populares sem RCT robusto
 *     (mewing, face yoga, massagens linfáticas faciais). Carregam disclaimer
 *     obrigatório (CHECK chk_rec_anecdotal_disclaimer).
 *
 * Filosofia editorial (plano `.claude/plans/fa-a-mais-uma-revis-o-quirky-hopper.md`)
 * --------------------------------------------------------------------------------
 * O app é o protagonista do tratamento. Exercícios são a coluna vertebral
 * da rotina — degrau 2 da escada terapêutica, abaixo de styling (3) e
 * procedimentos (4). Tom: factual, sem promessa de "cura", sem linguagem
 * médica prescritiva. Nunca usar "trata", "corrige", "elimina".
 *
 * Provenance
 * ----------
 *   - Felício C.M. et al. (2010) Orofacial myofunctional therapy. J Oral Rehabil.
 *     https://pubmed.ncbi.nlm.nih.gov/20557431/
 *   - Solow B. & Sandham A. (2002) Cranio-cervical posture. Eur J Orthod.
 *     https://pubmed.ncbi.nlm.nih.gov/12407941/
 *   - Alam M. et al. (2018) Association of facial exercise with the appearance
 *     of aging. JAMA Dermatol. https://pubmed.ncbi.nlm.nih.gov/29299598/
 *     (face yoga — único estudo controlado, amostra pequena, efeito modesto)
 *   - Rocabado M. (1983) Biomechanical relationship of cervical spine and
 *     mandible. CRANIO. https://pubmed.ncbi.nlm.nih.gov/6586148/
 *   - American Optometric Association — vision therapy guidelines (eye exercises)
 *     https://www.aoa.org
 *   - Mewing / orthotropics: site primário https://orthotropics.com — sem RCT.
 *
 * Down: remove apenas as linhas inseridas aqui (não toca em outras
 * recomendações da v1.0).
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

type ExerciseSeed = {
  id: string;
  short: string;
  long: string;
  evidence: 'strong' | 'moderate' | 'anecdotal';
  priority: 1 | 2 | 3 | 4 | 5;
  effort: 'low' | 'medium' | 'high';
  triggerMetrics: string[];
  triggerSeverities?: ('mild' | 'moderate' | 'strong' | 'extreme')[];
  references: { citation: string; url?: string }[];
};

const POPULAR_DISCLAIMER =
  'Esta sugestão tem caráter popular e ainda não possui consenso científico robusto. Não há riscos relatados quando feita corretamente, mas resultados variam.';

const SEED: ExerciseSeed[] = [
  // ─── SYMMETRY (assimetria global, midline_deviation) ─────────────────────
  {
    id: 'exercise-cervical-alignment-drill',
    short: 'Alongamento cervical 2× ao dia para reduzir torção habitual do pescoço.',
    long:
      'A rotina cervical inclui retração do queixo (chin-tuck) por 5 segundos, 10 repetições, duas vezes ao dia. ' +
      'Postura cervical assimétrica é uma das causas mais comuns de assimetria facial percebida em fotos. ' +
      'A rotina não altera estrutura óssea, mas pode reduzir a torção habitual que aparece nas imagens.',
    evidence: 'moderate',
    priority: 2,
    effort: 'low',
    triggerMetrics: ['midline_deviation', 'global_asymmetry_index'],
    triggerSeverities: ['mild', 'moderate', 'strong'],
    references: [
      { citation: 'Solow & Sandham (2002) Cranio-cervical posture.', url: 'https://pubmed.ncbi.nlm.nih.gov/12407941/' },
      { citation: 'Rocabado M. (1983) CRANIO.', url: 'https://pubmed.ncbi.nlm.nih.gov/6586148/' },
    ],
  },
  {
    id: 'exercise-bilateral-chewing-habit',
    short: 'Mastigação bilateral consciente nas refeições.',
    long:
      'Mastigar de forma deliberadamente alternada nos dois lados durante as refeições por 4 a 6 semanas. ' +
      'Hábito unilateral de mastigação está associado a assimetria muscular e percepção de assimetria facial. ' +
      'Ajuste comportamental simples; sem custo ou risco.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    triggerMetrics: ['gonial_angle_asymmetry', 'jaw_width_ratio', 'global_asymmetry_index'],
    triggerSeverities: ['mild', 'moderate'],
    references: [
      { citation: 'Felício C.M. et al. (2010) J Oral Rehabil.', url: 'https://pubmed.ncbi.nlm.nih.gov/20557431/' },
    ],
  },

  // ─── THIRDS / GLOBAL (terços faciais, simetria global) ───────────────────
  {
    id: 'exercise-tongue-posture-mewing',
    short: 'Postura lingual no palato (mewing) durante o dia.',
    long:
      'Manter a língua apoiada no palato superior, com lábios selados e respiração nasal. ' +
      'Conhecido popularmente como "mewing", é proposto como influência sobre o desenvolvimento maxilar. ' +
      'Não há RCTs em adultos demonstrando alteração estrutural; pode ter efeito sobre tônus muscular e postura. ' +
      'Compatível com qualquer rotina e sem risco quando feito sem força excessiva.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    triggerMetrics: ['middle_third_ratio', 'lower_third_ratio', 'jaw_width_ratio'],
    references: [
      { citation: 'Mew J. — orthotropics.com (sem RCT)', url: 'https://orthotropics.com' },
    ],
  },
  {
    id: 'exercise-hyoid-suprahyoid-strengthening',
    short: 'Fortalecimento de músculos supra-hioideos para definição submentual.',
    long:
      'Exercício de elevação isométrica do hioide: pressionar a língua contra o palato e deglutir lentamente, 10 repetições, 2× ao dia. ' +
      'Fortalece a região submentual; pode reduzir a percepção de "papada" em casos leves. ' +
      'Faz parte do protocolo de mioterapia orofacial; evidência moderada para função, baixa para estética isolada.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    triggerMetrics: ['lower_third_ratio', 'chin_height_ratio'],
    triggerSeverities: ['mild', 'moderate', 'strong'],
    references: [
      { citation: 'Felício C.M. et al. (2010) J Oral Rehabil.', url: 'https://pubmed.ncbi.nlm.nih.gov/20557431/' },
    ],
  },

  // ─── EYES (canthal tilt, eye aperture, asymmetry) ────────────────────────
  {
    id: 'exercise-orbicularis-oculi-isometric',
    short: 'Contração isométrica do orbicular dos olhos.',
    long:
      'Fechar os olhos com firmeza moderada por 5 segundos e relaxar; 10 repetições, 1 a 2× ao dia. ' +
      'Trabalha o orbicular do olho — pode contribuir para tônus periocular. ' +
      'Não altera estrutura óssea da órbita nem inclinação do canthal tilt.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    triggerMetrics: ['eye_aperture_ratio_l', 'eye_aperture_ratio_r', 'eye_height_asymmetry'],
    references: [
      { citation: 'Alam M. et al. (2018) JAMA Dermatol.', url: 'https://pubmed.ncbi.nlm.nih.gov/29299598/' },
    ],
  },
  {
    id: 'exercise-eye-tracking-pencil-pushups',
    short: 'Convergência ocular (pencil push-ups) para fadiga visual.',
    long:
      'Aproximar e afastar um lápis dos olhos mantendo o foco nele, por 5 minutos, 1× ao dia. ' +
      'Reduz fadiga ocular, que pode acentuar assimetria temporária na abertura palpebral em fotos. ' +
      'Indicado em terapia visual; sem efeito comprovado sobre estrutura ocular.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    triggerMetrics: ['eye_aperture_ratio_l', 'eye_aperture_ratio_r'],
    triggerSeverities: ['mild', 'moderate'],
    references: [
      { citation: 'American Optometric Association — vision therapy.', url: 'https://www.aoa.org' },
    ],
  },

  // ─── BROWS (brow height, arch, drop, asymmetry) ──────────────────────────
  {
    id: 'exercise-frontalis-conscious-relaxation',
    short: 'Relaxamento consciente do músculo frontal.',
    long:
      'Observar ao espelho 1 minuto por dia se a testa está franzida em repouso e relaxá-la conscientemente. ' +
      'Hábito de tensão frontal contribui para queda assimétrica das sobrancelhas e marcas de expressão. ' +
      'Sem custo, sem risco; resultado depende de consistência por semanas.',
    evidence: 'anecdotal',
    priority: 3,
    effort: 'low',
    triggerMetrics: ['brow_height_l', 'brow_height_r', 'brow_height_asymmetry', 'brow_tail_drop_l'],
    references: [
      { citation: 'Alam M. et al. (2018) JAMA Dermatol.', url: 'https://pubmed.ncbi.nlm.nih.gov/29299598/' },
    ],
  },
  {
    id: 'exercise-brow-lift-isometric',
    short: 'Elevação isométrica das sobrancelhas com resistência manual.',
    long:
      'Posicionar os dedos sobre as sobrancelhas e tentar elevá-las contra a resistência, mantendo 5 segundos; 10 repetições, 1× ao dia. ' +
      'Trabalha o frontal e pode contribuir para tônus de elevação ao longo de semanas. ' +
      'Faz parte do face yoga; estudo controlado de 2018 mostrou efeito modesto em bochechas (não testado especificamente em testa).',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    triggerMetrics: ['brow_height_l', 'brow_height_r', 'brow_tail_drop_l'],
    references: [
      { citation: 'Alam M. et al. (2018) JAMA Dermatol.', url: 'https://pubmed.ncbi.nlm.nih.gov/29299598/' },
    ],
  },

  // ─── NOSE (alar asymmetry, dorsum, nasal tip) ────────────────────────────
  {
    id: 'exercise-nasal-breathing-retraining',
    short: 'Reeducação da respiração nasal exclusiva.',
    long:
      'Vedar a respiração bucal durante o dia e ao dormir (com fita labial específica para sono). ' +
      'Respiração bucal crônica está associada a desenvolvimento facial alterado e congestão nasal habitual que afeta a aparência da base nasal. ' +
      'Verificar permeabilidade nasal antes; em caso de obstrução, avaliar com otorrino.',
    evidence: 'moderate',
    priority: 2,
    effort: 'medium',
    triggerMetrics: ['alar_base_asymmetry', 'alar_to_face_width_ratio', 'nose_width_to_icd'],
    triggerSeverities: ['mild', 'moderate'],
    references: [
      { citation: 'Harari D. et al. (2010) Mouth breathing & facial growth.', url: 'https://pubmed.ncbi.nlm.nih.gov/20602759/' },
    ],
  },
  {
    id: 'exercise-nostril-flare-strengthening',
    short: 'Dilatação consciente das narinas (alar flare).',
    long:
      'Inspirar profundamente pelo nariz forçando a abertura das narinas; 10 repetições por sessão, 2× ao dia. ' +
      'Trabalha o músculo nasal; popularmente associado à definição da base do nariz, sem RCT confirmando alteração estrutural. ' +
      'Útil como aquecimento respiratório para quem usa o nariz pouco.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    triggerMetrics: ['alar_to_face_width_ratio', 'alar_base_asymmetry'],
    references: [
      { citation: 'Face yoga programs (Sikorski, Hagan) — sem RCT específico.' },
    ],
  },

  // ─── MOUTH / LIPS ────────────────────────────────────────────────────────
  {
    id: 'exercise-orbicularis-oris-pursing',
    short: 'Beicinho isométrico para tônus dos lábios.',
    long:
      'Projetar os lábios à frente como em um "beijo", segurar 5 segundos, relaxar; 10 repetições, 2× ao dia. ' +
      'Trabalha o orbicular da boca, contribuindo para definição do contorno labial. ' +
      'Faz parte da mioterapia orofacial e do face yoga.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    triggerMetrics: [
      'upper_lip_height_ratio',
      'lower_lip_height_ratio',
      'vermilion_height_total',
      'mouth_width_to_icd',
    ],
    references: [
      { citation: 'Felício C.M. et al. (2010) J Oral Rehabil.', url: 'https://pubmed.ncbi.nlm.nih.gov/20557431/' },
    ],
  },
  {
    id: 'exercise-mouth-corner-symmetry-drill',
    short: 'Simetrização dos cantos da boca (anti-canting).',
    long:
      'Ao espelho, sorrir levemente e observar qual canto sobe menos; trabalhar isolando cada lado por 30 segundos, 2× ao dia. ' +
      'Treino consciente reduz dominância unilateral em casos leves de canting. ' +
      'Não corrige assimetria estrutural neurológica ou óssea; nesses casos, encaminhamento é informação adicional.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    triggerMetrics: ['lip_corner_canting', 'mouth_midline_deviation'],
    triggerSeverities: ['mild', 'moderate'],
    references: [
      { citation: 'Felício C.M. et al. (2010) J Oral Rehabil.', url: 'https://pubmed.ncbi.nlm.nih.gov/20557431/' },
    ],
  },
  {
    id: 'exercise-tongue-roof-press',
    short: 'Pressão da língua no palato para tônus perioral.',
    long:
      'Pressionar a ponta da língua contra o palato anterior e segurar 10 segundos; 10 repetições, 2× ao dia. ' +
      'Trabalha o complexo lingual-palatal e o tônus de selamento labial. ' +
      'Item central de protocolos de mioterapia orofacial em pacientes com hábito de respiração bucal.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    triggerMetrics: ['mouth_to_face_width_ratio', 'lower_lip_height_ratio', 'philtrum_length_ratio'],
    references: [
      { citation: 'Felício C.M. et al. (2010) J Oral Rehabil.', url: 'https://pubmed.ncbi.nlm.nih.gov/20557431/' },
    ],
  },

  // ─── JAW (gonial angle, mandibular plane, jaw width) ─────────────────────
  {
    id: 'exercise-masseter-isometric-clench',
    short: 'Contração isométrica do masseter (com cautela).',
    long:
      'Cerrar os dentes com firmeza moderada por 5 segundos e relaxar; 10 repetições, 1× ao dia. ' +
      'Tonifica o masseter e pode acentuar definição mandibular ao longo de semanas. ' +
      'Cuidado: em pessoas com bruxismo ou DTM, este exercício é contraindicado. Evitar se houver dor articular.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    triggerMetrics: ['gonial_angle_l', 'gonial_angle_r', 'jaw_width_ratio', 'mandibular_plane_angle'],
    triggerSeverities: ['mild', 'moderate'],
    references: [
      { citation: 'Felício C.M. et al. (2010) J Oral Rehabil.', url: 'https://pubmed.ncbi.nlm.nih.gov/20557431/' },
    ],
  },
  {
    id: 'exercise-jaw-side-symmetrize',
    short: 'Mastigação direcionada ao lado de menor tônus.',
    long:
      'Identificar com a palpação qual lado do masseter está mais flácido e priorizar mastigação naquele lado por 4 semanas. ' +
      'Reequilibra tônus mandibular em casos leves de assimetria gonial — não corrige assimetria óssea estrutural. ' +
      'Para casos extremos com indicação cirúrgica, esta rotina é complementar, nunca substituta.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    triggerMetrics: ['gonial_angle_asymmetry', 'jaw_width_ratio'],
    triggerSeverities: ['mild', 'moderate', 'strong'],
    references: [
      { citation: 'Felício C.M. et al. (2010) J Oral Rehabil.', url: 'https://pubmed.ncbi.nlm.nih.gov/20557431/' },
    ],
  },
  {
    id: 'exercise-chin-jut-platysma',
    short: 'Projeção do queixo (chin jut) para platisma.',
    long:
      'Projetar a mandíbula para frente sentindo o estiramento do pescoço, segurar 5 segundos; 10 repetições, 1× ao dia. ' +
      'Trabalha o platisma e ajuda na percepção de definição submandibular. ' +
      'Popular em programas de face yoga; estudo controlado de 2018 mostrou efeito modesto em outras regiões.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    triggerMetrics: ['chin_height_ratio', 'mandibular_plane_angle', 'lower_third_ratio'],
    references: [
      { citation: 'Alam M. et al. (2018) JAMA Dermatol.', url: 'https://pubmed.ncbi.nlm.nih.gov/29299598/' },
    ],
  },

  // ─── CHEEKBONES (malar projection, cheekbone-jaw ratio, submalar hollow) ─
  {
    id: 'exercise-cheek-lift-smile-hold',
    short: 'Sustentação do sorriso para tônus zigomático.',
    long:
      'Sorrir amplamente e segurar 10 segundos com leve resistência dos dedos sobre as bochechas; 10 repetições, 1× ao dia. ' +
      'Único exercício facial com estudo controlado positivo (Northwestern 2018, Alam et al.) — efeito modesto sobre bochechas em 20 semanas. ' +
      'Sem risco; resultado depende de consistência diária.',
    evidence: 'moderate',
    priority: 2,
    effort: 'low',
    triggerMetrics: ['malar_projection_index', 'submalar_hollow_index', 'cheekbone_to_jaw_ratio'],
    triggerSeverities: ['mild', 'moderate', 'strong'],
    references: [
      { citation: 'Alam M. et al. (2018) JAMA Dermatol.', url: 'https://pubmed.ncbi.nlm.nih.gov/29299598/' },
    ],
  },
  {
    id: 'exercise-buccinator-puff',
    short: 'Insuflar bochechas alternadamente (buccinator puff).',
    long:
      'Encher as bochechas de ar e passar o ar de um lado para o outro, 30 segundos por sessão, 2× ao dia. ' +
      'Trabalha o buccinador e pode contribuir para tônus malar. ' +
      'Item recorrente em face yoga; sem ensaio clínico isolado para esta variação.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    triggerMetrics: ['midface_height_ratio', 'submalar_hollow_index'],
    references: [
      { citation: 'Hagan F. — face yoga programs (sem RCT específico).' },
    ],
  },
  {
    id: 'exercise-lymphatic-face-massage',
    short: 'Drenagem linfática facial matinal.',
    long:
      'Massagem suave das laterais da face em direção aos gânglios cervicais, 3 minutos pela manhã. ' +
      'Reduz edema matinal — efeito puramente temporário (horas), útil para fotos. ' +
      'Sem alteração estrutural; popularizado por programas de skincare asiáticos.',
    evidence: 'anecdotal',
    priority: 3,
    effort: 'low',
    triggerMetrics: ['midface_height_ratio', 'submalar_hollow_index', 'global_asymmetry_index'],
    references: [
      { citation: 'Tradição estética — sem RCT robusto isolado.' },
    ],
  },

  // ─── FOREHEAD (forehead height, width, hairline) ─────────────────────────
  {
    id: 'exercise-frontalis-massage-release',
    short: 'Liberação miofascial da testa.',
    long:
      'Massagem circular suave em toda a testa por 2 minutos, 1× ao dia, com óleo facial de preferência. ' +
      'Ajuda a soltar tensão crônica do frontal — útil quando há marcas horizontais perceptíveis. ' +
      'Sem efeito estrutural; benefício sobre marcas de expressão é principalmente cosmético e temporário.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    triggerMetrics: ['forehead_height_ratio', 'forehead_width_ratio'],
    references: [
      { citation: 'Tradição cosmética — sem RCT robusto.' },
    ],
  },

  // ─── PHOTO_QUALITY (não tem exercício direto — pular) ────────────────────
];

export class M44SeedExerciseCatalog1746000235000 implements MigrationInterface {
  name = 'M44SeedExerciseCatalog1746000235000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const ex of SEED) {
      const disclaimer = ex.evidence === 'anecdotal' ? POPULAR_DISCLAIMER : null;
      const refsJson = JSON.stringify(ex.references);
      // priority_default 1..5; effort enum low/medium/high; risk fixed at 0.05 for exercises (very low)
      await queryRunner.query(
        `
          INSERT INTO recommendation_catalog (
            id, version, category, display_text_short_pt, display_text_long_pt,
            priority_default, effort_estimate, risk_level, requires_professional, professional_type,
            invasiveness_level, evidence_level, clinical_pathway_required, references_jsonb, disclaimer_template
          ) VALUES (
            $1, 'v1.0', 'exercise', $2, $3,
            $4, $5, 0.05, FALSE, NULL,
            2, $6::evidence_level_enum, FALSE, $7::jsonb, $8
          )
          ON CONFLICT (id) DO NOTHING
        `,
        [ex.id, ex.short, ex.long, ex.priority, ex.effort, ex.evidence, refsJson, disclaimer],
      );

      // Triggers — para cada (metric × severity)
      const sevs = ex.triggerSeverities ?? ['mild', 'moderate', 'strong'];
      for (const metricId of ex.triggerMetrics) {
        for (const sev of sevs) {
          await queryRunner.query(
            `
              INSERT INTO recommendation_trigger (
                recommendation_id, metric_id, severity, direction,
                additional_conditions, min_invasiveness_level, clinical_pathway_required
              ) VALUES ($1, $2, $3::severity_5_enum, 'any', NULL, NULL, FALSE)
              ON CONFLICT DO NOTHING
            `,
            [ex.id, metricId, sev],
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const ids = SEED.map((s) => s.id);
    await queryRunner.query(
      `DELETE FROM recommendation_trigger WHERE recommendation_id = ANY($1::text[])`,
      [ids],
    );
    await queryRunner.query(
      `DELETE FROM recommendation_catalog WHERE id = ANY($1::text[])`,
      [ids],
    );
  }
}
