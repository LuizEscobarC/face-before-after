/**
 * PR-55d — Seed completo do catálogo de recomendações (100 itens, escada terapêutica).
 *
 * Adiciona 100 recomendações cobrindo todos os degraus da escada (exercise,
 * posture, lifestyle, styling, professional_referral) à versão v1.0 do
 * recommendation_catalog. Lista canônica fornecida pelo produto em
 * 2026-05-09 (ver chat history).
 *
 * Filosofia editorial
 * -------------------
 * O app é o protagonista do tratamento. As recomendações professional_referral
 * (avaliação ortodôntica/fonoaudiológica/otorrino) são informativas, não
 * exigência: aparecem como caminho complementar para casos estruturais.
 * Severidade típica de gatilho:
 *   - posture/lifestyle: mild → strong
 *   - exercise: mild → strong (4 itens disparam em strong/extreme)
 *   - styling: moderate → strong
 *   - professional_referral: strong → extreme (clinical_pathway_required em alguns)
 *
 * Overlap com seed anterior (1746000235000)
 * -----------------------------------------
 * 9 itens da lista canônica sobrepõem semanticamente o seed de exercícios:
 *   #11 mewing, #21 mastigação bilateral, #31 relaxamento frontal, #35 anti-canting,
 *   #39 buccinator puff, #45 nostril flare, #53 drenagem linfática,
 *   #61 pencil pushups, #62 orbicular isométrico. Esses NÃO são reinseridos —
 *   o INSERT usa ON CONFLICT (id) DO NOTHING quando o id já existe (com prefixo
 *   distinto) e os items canônicos pulados são listados em CANONICAL_OVERLAP_NOTE.
 *
 * Provenance
 * ----------
 *   - Felício C.M. et al. (2010) Mioterapia orofacial. J Oral Rehabil.
 *     https://pubmed.ncbi.nlm.nih.gov/20557431/
 *   - Solow & Sandham (2002) Cranio-cervical posture. Eur J Orthod.
 *     https://pubmed.ncbi.nlm.nih.gov/12407941/
 *   - Alam M. et al. (2018) Face yoga / facial exercise. JAMA Dermatol.
 *     https://pubmed.ncbi.nlm.nih.gov/29299598/
 *   - McKenzie R.A. — Treat Your Own Neck (cervical retraction protocol).
 *   - Buteyko Clinic — buteykoclinic.com (respiração nasal, sem RCT robusto p/ estética).
 *   - American Optometric Association — vision therapy guidelines.
 *   - SBD/SBCP — guidelines BR para procedimentos estéticos não-invasivos.
 *   - Travell & Simons — Myofascial Pain & Dysfunction (trigger points).
 *
 * Down: remove apenas as linhas inseridas aqui.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

type Severity = 'mild' | 'moderate' | 'strong' | 'extreme';
type Cat =
  | 'photo'
  | 'presentation_only'
  | 'posture'
  | 'lifestyle'
  | 'exercise'
  | 'styling'
  | 'aesthetic_procedure'
  | 'professional_referral';
type Evidence = 'strong' | 'moderate' | 'anecdotal';
type Effort = 'low' | 'medium' | 'high';
type ProfType =
  | 'dentist'
  | 'physiotherapist'
  | 'dermatologist'
  | 'otolaryngologist'
  | 'plastic_surgeon'
  | 'orthodontist'
  | 'oral_maxillofacial_surgeon';

type Seed = {
  id: string;
  category: Cat;
  invasiveness: 0 | 1 | 2 | 3 | 4;
  short: string;
  long: string;
  evidence: Evidence;
  priority: 1 | 2 | 3 | 4 | 5;
  effort: Effort;
  risk?: number;
  requiresProfessional?: boolean;
  professionalType?: ProfType;
  clinicalPathway?: boolean;
  metrics: string[];
  severities?: Severity[];
  references: { citation: string; url?: string }[];
  disclaimer?: string;
};

const POPULAR_DISCLAIMER =
  'Esta sugestão tem caráter popular e ainda não possui consenso científico robusto. Não há riscos relatados quando feita corretamente, mas resultados variam.';
const REFERRAL_DISCLAIMER =
  'A rotina do app cobre as principais melhorias possíveis sem intervenção clínica. Em casos como o seu, alguns usuários optam por consultar este profissional para resolução estrutural — não é exigência nem condição de melhora. Esta menção é informativa, não prescrição médica.';

/** Métricas globais de "tudo o que é simétrico/proporção" — usadas como fallback. */
const SYM = ['midline_deviation', 'global_asymmetry_index'];
const JAW = ['gonial_angle_l', 'gonial_angle_r', 'gonial_angle_asymmetry', 'jaw_width_ratio', 'mandibular_plane_angle'];
const NOSE = ['alar_base_asymmetry', 'alar_to_face_width_ratio', 'nose_width_to_icd', 'nasal_tip_deviation', 'dorsum_deviation'];
const MOUTH = ['lip_corner_canting', 'mouth_midline_deviation', 'lip_canting_angle', 'mouth_to_face_width_ratio', 'upper_lip_height_ratio', 'lower_lip_height_ratio', 'vermilion_height_total', 'mouth_width_to_icd'];
const EYES = ['eye_aperture_ratio_l', 'eye_aperture_ratio_r', 'eye_height_asymmetry', 'canthal_tilt_l', 'canthal_tilt_r', 'intercanthal_distance', 'intercanthal_to_eye_width_ratio'];
const BROWS = ['brow_height_l', 'brow_height_r', 'brow_height_asymmetry', 'brow_arch_peak_l', 'brow_arch_peak_r', 'brow_tail_drop_l', 'brow_thickness_l', 'brow_thickness_r', 'interbrow_distance_ratio'];
const FOREHEAD = ['forehead_height_ratio', 'forehead_width_ratio', 'temporal_width_ratio', 'hairline_curvature_index'];
const CHEEK = ['malar_projection_index', 'submalar_hollow_index', 'cheekbone_to_jaw_ratio', 'midface_height_ratio', 'zygomatic_width_ratio'];
const THIRDS = ['upper_third_ratio', 'middle_third_ratio', 'lower_third_ratio'];
const CHIN = ['chin_height_ratio', 'lower_third_ratio', 'mandibular_plane_angle'];

const FELICIO = { citation: 'Felício C.M. et al. (2010) J Oral Rehabil.', url: 'https://pubmed.ncbi.nlm.nih.gov/20557431/' };
const SOLOW = { citation: 'Solow & Sandham (2002) Eur J Orthod.', url: 'https://pubmed.ncbi.nlm.nih.gov/12407941/' };
const ALAM = { citation: 'Alam M. et al. (2018) JAMA Dermatol.', url: 'https://pubmed.ncbi.nlm.nih.gov/29299598/' };
const MCKENZIE = { citation: 'McKenzie R.A. — Treat Your Own Neck.', url: 'https://www.mckenzieinstituteusa.org' };
const TRAVELL = { citation: 'Travell & Simons — Myofascial Pain & Dysfunction.', url: 'https://www.lww.com' };
const HARARI = { citation: 'Harari D. et al. (2010) Mouth breathing & facial growth.', url: 'https://pubmed.ncbi.nlm.nih.gov/20602759/' };
const BUTEYKO = { citation: 'Buteyko Clinic Method (sem RCT robusto p/ estética).', url: 'https://buteykoclinic.com' };
const AOA = { citation: 'American Optometric Association — vision therapy.', url: 'https://www.aoa.org' };
const SBD = { citation: 'Sociedade Brasileira de Dermatologia.', url: 'https://www.sbd.org.br' };
const SBCP = { citation: 'Sociedade Brasileira de Cirurgia Plástica.', url: 'https://www2.cirurgiaplastica.org.br' };
const ROCABADO = { citation: 'Rocabado M. (1983) CRANIO.', url: 'https://pubmed.ncbi.nlm.nih.gov/6586148/' };
const HALLAWELL = { citation: 'Hallawell P. — Visagismo: Harmonia e Estética (Senac).' };

const SEED: Seed[] = [
  // ──────────── 1. POSTURA CERVICAL & ERGONOMIA (#1-#10) ────────────
  {
    id: 'posture-chin-tucks',
    category: 'posture',
    invasiveness: 1,
    short: 'Chin tucks (retração cervical) 2× ao dia.',
    long:
      'Sentado ou em pé com a coluna ereta, recue o queixo paralelamente ao chão (sem inclinar para baixo) por 5 segundos; 10 repetições, 2× ao dia. ' +
      'Reduz o padrão de "cabeça anteriorizada" que distorce a percepção do contorno mandibular e do terço inferior em fotos.',
    evidence: 'moderate',
    priority: 1,
    effort: 'low',
    metrics: [...SYM, ...JAW, 'lower_third_ratio'],
    severities: ['mild', 'moderate', 'strong'],
    references: [SOLOW, MCKENZIE, ROCABADO],
  },
  {
    id: 'posture-wall-angel',
    category: 'posture',
    invasiveness: 1,
    short: 'Wall Angel para abertura de tórax e alinhamento escapular.',
    long:
      'De costas para a parede, encostando occipital, escápulas e sacro, deslize os braços em forma de Y → W mantendo contato; 10 repetições, 1× ao dia. ' +
      'Trabalha a postura escapular que sustenta o alinhamento cervical — útil para quem trabalha sentado.',
    evidence: 'moderate',
    priority: 2,
    effort: 'low',
    metrics: [...SYM],
    severities: ['mild', 'moderate'],
    references: [SOLOW, MCKENZIE],
  },
  {
    id: 'posture-scm-stretch',
    category: 'posture',
    invasiveness: 1,
    short: 'Alongamento do esternocleidomastóideo (SCM).',
    long:
      'Sentado, incline a cabeça para o lado oposto e gire levemente o queixo para cima; segure 30 segundos cada lado, 2× ao dia. ' +
      'Reduz tensão unilateral do SCM, frequentemente associada à torção habitual do pescoço que aparece como assimetria em fotos.',
    evidence: 'moderate',
    priority: 2,
    effort: 'low',
    metrics: [...SYM, 'gonial_angle_asymmetry'],
    severities: ['mild', 'moderate', 'strong'],
    references: [TRAVELL, ROCABADO],
  },
  {
    id: 'posture-cervical-extensor-isometric',
    category: 'posture',
    invasiveness: 1,
    short: 'Isometria de extensão cervical contra a mão.',
    long:
      'Pressione a nuca contra a palma da mão por 5 segundos sem mover a cabeça; 10 repetições, 1× ao dia. ' +
      'Fortalece extensores cervicais profundos — base para sustentação postural na fotografia.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...SYM],
    references: [MCKENZIE],
  },
  {
    id: 'posture-mckenzie-retraction',
    category: 'posture',
    invasiveness: 1,
    short: 'McKenzie neck retraction (protocolo de Robin McKenzie).',
    long:
      'Em pé, retraia o queixo ao máximo e leve a cabeça suavemente para trás, segurando 2 segundos; 10 repetições, 3× ao dia. ' +
      'Protocolo padrão para correção postural cervical em fisioterapia. Ideal para quem usa muito celular ou computador.',
    evidence: 'strong',
    priority: 1,
    effort: 'low',
    metrics: [...SYM, 'lower_third_ratio'],
    severities: ['mild', 'moderate', 'strong'],
    references: [MCKENZIE],
  },
  {
    id: 'posture-upper-trapezius-stretch',
    category: 'posture',
    invasiveness: 1,
    short: 'Alongamento do trapézio superior.',
    long:
      'Sentado, segure a borda da cadeira com uma mão e incline a cabeça para o ombro oposto; 30 segundos cada lado, 2× ao dia. ' +
      'Reduz elevação assimétrica dos ombros que se reflete em torção da cabeça em fotos.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...SYM],
    references: [TRAVELL],
  },
  {
    id: 'posture-pec-minor-release',
    category: 'posture',
    invasiveness: 1,
    short: 'Liberação miofascial do peitoral menor.',
    long:
      'Com bola de tênis ou massageadora, pressione a região anterior do ombro logo abaixo da clavícula por 1-2 minutos cada lado. ' +
      'Peitoral menor encurtado puxa as escápulas para frente e contribui para postura "fechada" — afeta a percepção do alinhamento facial.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...SYM],
    references: [TRAVELL],
  },
  {
    id: 'posture-supine-sleep',
    category: 'posture',
    invasiveness: 1,
    short: 'Dormir em decúbito supino (de costas).',
    long:
      'Adotar a posição supina como padrão de sono; usar travesseiros laterais para impedir lateralização. ' +
      'Dormir lateralmente por décadas amassa um lado da face — efeito documentado em estudos de cirurgia plástica. ' +
      'Mudança lenta (semanas), benefício a longo prazo.',
    evidence: 'moderate',
    priority: 3,
    effort: 'medium',
    metrics: [...SYM, ...CHEEK],
    severities: ['mild', 'moderate', 'strong'],
    references: [
      { citation: 'Anson, Pearl, Vesper (2016) Sleep position & facial distortion. Aesthet Surg J.', url: 'https://pubmed.ncbi.nlm.nih.gov/26961994/' },
    ],
  },
  {
    id: 'posture-monitor-ergonomics',
    category: 'posture',
    invasiveness: 1,
    short: 'Ajuste ergonômico da altura do monitor (topo na linha dos olhos).',
    long:
      'Posicionar o topo do monitor na altura dos olhos a aproximadamente um braço de distância. ' +
      'Reduz forward head posture crônica — causa estrutural de desalinhamento cervical em quem trabalha 8h/dia frente a tela.',
    evidence: 'strong',
    priority: 1,
    effort: 'low',
    metrics: [...SYM],
    severities: ['mild', 'moderate', 'strong'],
    references: [
      { citation: 'OSHA — Computer Workstations Ergonomics.', url: 'https://www.osha.gov/etools/computer-workstations' },
    ],
  },
  {
    id: 'posture-cervical-pillow',
    category: 'posture',
    invasiveness: 1,
    short: 'Travesseiro cervical ortopédico noturno.',
    long:
      'Substituir o travesseiro padrão por um cervical (com curvatura anatômica), na altura adequada à largura do ombro. ' +
      'Suporte cervical noturno reduz tensão acumulada que se reflete em torção pela manhã.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...SYM],
    references: [
      { citation: 'Liu et al. (2021) Pillow design & cervical alignment. PLoS One.' },
    ],
  },

  // ──────────── 2. MIOFUNCIONAL ORAL (#11-#20) ────────────
  // #11 mewing → JÁ EXISTE em seed anterior (exercise-tongue-posture-mewing). PULAR.
  {
    id: 'exercise-swallow-sweep',
    category: 'exercise',
    invasiveness: 2,
    short: 'Swallow sweep (deglutição controlada).',
    long:
      'Posicione a língua no palato, encha a boca com pouca saliva e degluta sem usar bochechas ou lábios; 10 repetições, 2× ao dia. ' +
      'Re-treina o padrão deglutório atípico (deglutição infantil) que mantém a língua baixa e contribui para estreitamento maxilar.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: ['middle_third_ratio', 'lower_third_ratio', 'mouth_to_face_width_ratio'],
    references: [FELICIO],
  },
  {
    id: 'exercise-tongue-chewing',
    category: 'exercise',
    invasiveness: 2,
    short: 'Tongue chewing (chiclete contra o palato).',
    long:
      'Mastigar um chiclete sem açúcar pressionando-o contra o palato (em vez de entre os dentes), 10 minutos por sessão, 1× ao dia. ' +
      'Trabalha o complexo lingual e supra-hioide, contribuindo para tônus do assoalho bucal. Popular em comunidades de "looksmaxxing".',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    metrics: ['lower_third_ratio', 'chin_height_ratio'],
    references: [{ citation: 'Looksmaxxing community — sem RCT robusto.' }],
  },
  {
    id: 'exercise-tongue-sweep',
    category: 'exercise',
    invasiveness: 2,
    short: 'Tongue sweep (limpeza palatal com a língua).',
    long:
      'Passe a língua firme em todo o palato, do incisivo ao palato mole, lentamente; 10 ciclos, 2× ao dia. ' +
      'Estimula propriocepção lingual e tônus — coadjuvante de mioterapia orofacial.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: ['middle_third_ratio', 'mouth_to_face_width_ratio'],
    references: [FELICIO],
  },
  {
    id: 'exercise-cave-suction-hold',
    category: 'exercise',
    invasiveness: 2,
    short: 'Vácuo intraoral (cave/suction hold).',
    long:
      'Pressione a língua contra o palato, faça vácuo (escutando o som de "selo") e mantenha por 30 segundos; 5 repetições, 1× ao dia. ' +
      'Trabalha tônus de língua e palato mole; reportado por adeptos de mewing como "advanced tongue posture".',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    metrics: ['middle_third_ratio', 'lower_third_ratio'],
    references: [{ citation: 'Mewing community guides — sem RCT.' }],
  },
  {
    id: 'lifestyle-lip-seal-rest',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Repouso labial selado consciente (lip seal).',
    long:
      'Treinar manter os lábios suavemente selados em repouso, com língua no palato e respiração nasal. ' +
      'Padrão fisiológico — quem mantém boca aberta cronicamente desenvolve face longa e estreita ao longo de anos.',
    evidence: 'moderate',
    priority: 2,
    effort: 'low',
    metrics: ['mouth_to_face_width_ratio', 'middle_third_ratio', 'lower_third_ratio'],
    severities: ['mild', 'moderate', 'strong'],
    references: [HARARI],
  },
  {
    id: 'exercise-water-suction-control',
    category: 'exercise',
    invasiveness: 2,
    short: 'Sucção de água controlada com canudo.',
    long:
      'Sugar pequenos goles de água por canudo fino mantendo selamento labial firme; 10 ciclos, 1× ao dia. ' +
      'Trabalha orbicular dos lábios e padrão deglutório.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    metrics: ['upper_lip_height_ratio', 'lower_lip_height_ratio', 'mouth_width_to_icd'],
    references: [{ citation: 'Práticas de fonoaudiologia infantil adaptadas — sem RCT em adultos.' }],
  },
  {
    id: 'exercise-phoneme-mn-ng-training',
    category: 'exercise',
    invasiveness: 2,
    short: 'Treino de pronúncia M/N/NG.',
    long:
      'Repetir as sílabas "ma-na-nga" lentamente, com clareza de articulação, por 2 minutos, 1× ao dia. ' +
      'Trabalha lábios, língua e palato mole simultaneamente — útil para fala e tônus perioral.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: ['mouth_to_face_width_ratio', 'upper_lip_height_ratio'],
    references: [FELICIO],
  },
  {
    id: 'exercise-tongue-click',
    category: 'exercise',
    invasiveness: 2,
    short: 'Estalo de língua (tongue click).',
    long:
      'Pressione a língua contra o palato e solte produzindo um estalo audível; 20 repetições, 1× ao dia. ' +
      'Estimula tônus lingual e propriocepção palatal.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    metrics: ['middle_third_ratio'],
    references: [{ citation: 'Looksmaxxing / fonoaudiologia popular — sem RCT específico.' }],
  },
  {
    id: 'professional-lingual-frenectomy-eval',
    category: 'professional_referral',
    invasiveness: 4,
    short: 'Avaliação fonoaudiológica/odonto para frênulo lingual curto.',
    long:
      'Frênulo lingual encurtado (anquiloglossia) impede a postura correta da língua no palato e pode ter influência no desenvolvimento maxilofacial. ' +
      'O app não diagnostica anquiloglossia — alguns usuários optam por avaliação fonoaudiológica ou odontológica para verificar mobilidade lingual.',
    evidence: 'moderate',
    priority: 4,
    effort: 'medium',
    risk: 0.2,
    requiresProfessional: true,
    professionalType: 'dentist',
    metrics: ['middle_third_ratio', 'lower_third_ratio', 'mouth_to_face_width_ratio'],
    severities: ['strong', 'extreme'],
    references: [{ citation: 'Marchesan I.Q. — anquiloglossia em adultos.', url: 'https://pubmed.ncbi.nlm.nih.gov/22473374/' }],
  },

  // ──────────── 3. MASTIGAÇÃO & MANDÍBULA (#21-#30) ────────────
  // #21 mastigação bilateral → JÁ EXISTE (exercise-bilateral-chewing-habit). PULAR.
  {
    id: 'lifestyle-hard-foods-diet',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Inclusão de alimentos duros na dieta (cenoura, maçã).',
    long:
      'Incluir alimentos duros e fibrosos (cenoura crua, maçã, nozes) regularmente nas refeições. ' +
      'Mastigação vigorosa estimula desenvolvimento e manutenção do tônus mandibular. Hipotético, mas com plausibilidade evolutiva (Lieberman, "The Story of the Human Body").',
    evidence: 'anecdotal',
    priority: 3,
    effort: 'low',
    metrics: [...JAW, 'lower_third_ratio'],
    references: [{ citation: 'Lieberman D. (2013) The Story of the Human Body.' }],
  },
  {
    id: 'exercise-mastic-gum-training',
    category: 'exercise',
    invasiveness: 2,
    short: 'Treino com mastic gum / resina (chiclete duro).',
    long:
      'Mastigar resina de mastic ou chicletes ultra-duros 10-20 minutos por dia, alternando lados. ' +
      'Reportado por comunidades de looksmaxxing como ferramenta para hipertrofia do masseter. Sem RCT, mas hipertrofia muscular por uso é princípio fisiológico.',
    evidence: 'anecdotal',
    priority: 3,
    effort: 'low',
    risk: 0.15,
    metrics: [...JAW],
    references: [{ citation: 'Mastic gum / looksmaxx community — sem RCT.' }],
    disclaimer: 'Esta sugestão tem caráter popular e ainda não possui consenso científico robusto. Pessoas com bruxismo ou DTM devem evitar — pode agravar disfunção articular.',
  },
  {
    id: 'exercise-mandibular-isometric-resistance',
    category: 'exercise',
    invasiveness: 2,
    short: 'Isometria mandibular com resistência manual.',
    long:
      'Apoie o punho sob o queixo e tente abrir a boca contra a resistência por 5 segundos; 10 repetições, 1× ao dia. ' +
      'Fortalece pterigóideos e músculos suprahióideos. Cuidado em casos de DTM.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    risk: 0.1,
    metrics: [...JAW, 'chin_height_ratio'],
    references: [FELICIO],
  },
  {
    id: 'exercise-mandibular-opening-resistance',
    category: 'exercise',
    invasiveness: 2,
    short: 'Abertura mandibular com resistência.',
    long:
      'Abra a boca lentamente enquanto resiste com os dedos no queixo; 10 repetições, 1× ao dia. ' +
      'Trabalha músculos depressores da mandíbula. Evitar em caso de estalo articular ou dor.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    risk: 0.1,
    metrics: [...JAW],
    references: [FELICIO],
  },
  {
    id: 'exercise-mandibular-decompression',
    category: 'exercise',
    invasiveness: 2,
    short: 'Descompressão mandibular passiva.',
    long:
      'Apoie a língua no palato, respire lentamente e deixe a mandíbula "cair" sem tensão por 30 segundos; 5 repetições, 1× ao dia. ' +
      'Reduz tensão crônica em quem tem hábito de cerrar os dentes (clenching).',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...JAW],
    references: [FELICIO, TRAVELL],
  },
  {
    id: 'exercise-masseter-intraoral-release',
    category: 'exercise',
    invasiveness: 2,
    short: 'Liberação miofascial intraoral do masseter.',
    long:
      'Com luva ou dedo limpo, pressione o masseter pela face interna da bochecha e deslize lentamente; 1-2 minutos cada lado, 1× ao dia. ' +
      'Libera trigger points do masseter — comuns em quem aperta os dentes. Procedimento conservador da fisioterapia orofacial.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    risk: 0.05,
    metrics: [...JAW, 'gonial_angle_asymmetry'],
    references: [TRAVELL, FELICIO],
  },
  {
    id: 'exercise-masseter-external-release',
    category: 'exercise',
    invasiveness: 2,
    short: 'Liberação miofascial externa do masseter.',
    long:
      'Pressione com os dedos a região do masseter externamente em movimentos circulares por 2 minutos cada lado, 1× ao dia. ' +
      'Versão mais simples da liberação intraoral; menor efeito mas acessível.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...JAW],
    references: [TRAVELL],
  },
  {
    id: 'exercise-jaw-lateral-mirror',
    category: 'exercise',
    invasiveness: 2,
    short: 'Movimentação lateral da mandíbula ao espelho.',
    long:
      'Em frente ao espelho, mova a mandíbula para a direita e esquerda lentamente, mantendo simetria visual; 10 ciclos, 2× ao dia. ' +
      'Re-treino proprioceptivo — útil para casos de assimetria gonial leve.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: ['gonial_angle_asymmetry', 'jaw_width_ratio'],
    severities: ['mild', 'moderate'],
    references: [FELICIO],
  },
  {
    id: 'lifestyle-jaw-warm-compress',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Compressa morna na mandíbula à noite.',
    long:
      'Aplicar compressa morna sobre o masseter por 10 minutos antes de dormir, especialmente após dias estressantes. ' +
      'Reduz tensão muscular crônica e bruxismo noturno. Coadjuvante simples de protocolos para DTM.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...JAW],
    references: [TRAVELL],
  },

  // ──────────── 4. RELAXAMENTO MUSCULAR FACIAL (#31-#40) ────────────
  // #31 relaxamento frontalis → JÁ EXISTE (exercise-frontalis-conscious-relaxation). PULAR.
  {
    id: 'exercise-temporal-decompression-massage',
    category: 'exercise',
    invasiveness: 2,
    short: 'Massagem descompressiva das têmporas.',
    long:
      'Pressione com os dedos a região temporal em movimentos circulares lentos por 2 minutos, 1× ao dia. ' +
      'Reduz tensão do temporal — coadjuvante em quadros de cefaleia tensional e bruxismo.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: ['temporal_width_ratio', 'forehead_width_ratio'],
    references: [TRAVELL],
  },
  {
    id: 'exercise-platysma-stretch',
    category: 'exercise',
    invasiveness: 2,
    short: 'Alongamento de platisma (mento projetado para cima).',
    long:
      'Com a cabeça inclinada para trás, projete a mandíbula para frente e segure 5 segundos; 10 repetições, 1× ao dia. ' +
      'Alonga o platisma — músculo do pescoço cuja contração crônica acentua linhas verticais cervicais.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: ['lower_third_ratio', 'chin_height_ratio'],
    references: [ALAM],
  },
  {
    id: 'exercise-corrugator-relaxation',
    category: 'exercise',
    invasiveness: 2,
    short: 'Relaxamento de corrugadores (área entre as sobrancelhas).',
    long:
      'Com os dedos, suavize a área entre as sobrancelhas com pressão circular por 1 minuto, 2× ao dia. ' +
      'Reduz tensão crônica do "11" entre as sobrancelhas, hábito comum em quem trabalha concentrado.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...BROWS, 'forehead_height_ratio'],
    references: [TRAVELL, ALAM],
  },
  // #35 anti-canting → JÁ EXISTE (exercise-mouth-corner-symmetry-drill). PULAR.
  {
    id: 'lifestyle-resting-face-training',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Treino de "resting face" neutra.',
    long:
      'Várias vezes ao dia, observe como sua face está em repouso e relaxe conscientemente músculos tensos (testa, mandíbula, lábios). ' +
      'Padrão crônico de tensão facial molda expressão habitual ao longo de anos. Mudança mental + comportamental.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...SYM, ...BROWS, ...MOUTH],
    severities: ['mild', 'moderate'],
    references: [ALAM],
  },
  {
    id: 'exercise-occipital-release',
    category: 'exercise',
    invasiveness: 2,
    short: 'Liberação miofascial do occipital.',
    long:
      'Deite-se de costas com 2 bolas de tênis sob a base do crânio (suboccipital) por 2 minutos. ' +
      'Reduz tensão suboccipital — base postural cervical. Útil para quem sente "peso" na nuca.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...SYM],
    references: [TRAVELL, ROCABADO],
  },
  {
    id: 'exercise-zygomatic-manual-stretch',
    category: 'exercise',
    invasiveness: 2,
    short: 'Alongamento zigomático manual.',
    long:
      'Posicione os polegares sob os zigomáticos e deslize suavemente em direção às orelhas; 1 minuto, 1× ao dia. ' +
      'Libera tensão do zigomático maior — pode contribuir para sorriso mais fluido.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    metrics: [...CHEEK, ...MOUTH],
    references: [{ citation: 'Face yoga programs — sem RCT específico.' }],
  },
  // #39 buccinator puff → JÁ EXISTE (exercise-buccinator-puff). PULAR.
  {
    id: 'exercise-mentalis-inhibition',
    category: 'exercise',
    invasiveness: 2,
    short: 'Inibição consciente do músculo mentual.',
    long:
      'Observar ao espelho 1 minuto por dia se há contração do mentual (rugas no queixo) durante a fala ou em repouso, e relaxá-lo. ' +
      'Hábito de tensão mentual crônica acentua a saliência do queixo e pode contribuir para sulco mentolabial profundo.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: ['chin_height_ratio', 'lower_third_ratio'],
    references: [ALAM, TRAVELL],
  },

  // ──────────── 5. RESPIRAÇÃO (#41-#50) ────────────
  {
    id: 'lifestyle-nasal-breathing-day',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Respiração exclusivamente nasal durante o dia.',
    long:
      'Sustentar respiração nasal em todos os momentos do dia (incluindo exercício leve). ' +
      'Respiração bucal crônica em adultos está associada a desenvolvimento facial alterado e pior qualidade de sono.',
    evidence: 'strong',
    priority: 1,
    effort: 'medium',
    metrics: [...NOSE, 'lower_third_ratio', 'middle_third_ratio'],
    severities: ['mild', 'moderate', 'strong'],
    references: [HARARI],
  },
  {
    id: 'lifestyle-mouth-taping-night',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Mouth taping (fita labial noturna).',
    long:
      'Aplicar fita específica para mouth taping (3M Micropore ou similar dermatologicamente segura) durante o sono. ' +
      'Garante respiração nasal noturna, melhora qualidade do sono e reduz boca seca matinal. ' +
      'Verificar permeabilidade nasal antes — em caso de obstrução, contraindicado.',
    evidence: 'moderate',
    priority: 2,
    effort: 'low',
    risk: 0.1,
    metrics: [...NOSE, 'lower_third_ratio'],
    references: [
      { citation: 'Lee Y.C. et al. (2022) Mouth taping in OSA. Healthcare.', url: 'https://pubmed.ncbi.nlm.nih.gov/36141328/' },
    ],
    disclaimer: 'Esta prática só deve ser feita após confirmação de respiração nasal patente. Em caso de obstrução nasal severa, congestão crônica ou apneia não tratada, pode ser perigosa.',
  },
  {
    id: 'exercise-diaphragmatic-breathing',
    category: 'exercise',
    invasiveness: 2,
    short: 'Respiração diafragmática focada.',
    long:
      'Sentado ou deitado, inspire lentamente pelo nariz expandindo o abdômen (não o peito) por 4 segundos, segure 2, expire 6. 10 ciclos, 1× ao dia. ' +
      'Reduz tensão acessória do pescoço e melhora oxigenação. Base para protocolos de relaxamento.',
    evidence: 'strong',
    priority: 2,
    effort: 'low',
    metrics: [...SYM],
    references: [
      { citation: 'Hopper S.I. et al. (2019) Effectiveness of diaphragmatic breathing. JBI Database Syst Rev.' },
    ],
  },
  {
    id: 'lifestyle-saline-nasal-rinse',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Limpeza nasal diária com soro fisiológico.',
    long:
      'Lavagem nasal com soro fisiológico ou solução salina isotônica (Sinus Rinse, neti pot) 1-2× ao dia. ' +
      'Reduz congestão crônica e melhora a permeabilidade nasal — pré-requisito para respiração nasal exclusiva.',
    evidence: 'strong',
    priority: 2,
    effort: 'low',
    metrics: [...NOSE],
    references: [
      { citation: 'Hermelingmeier K.E. et al. (2012) Nasal saline irrigation. Am J Rhinol Allergy.' },
    ],
  },
  // #45 dilatação alar → JÁ EXISTE (exercise-nostril-flare-strengthening). PULAR.
  {
    id: 'lifestyle-nasal-dilator-use',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Uso de dilatador nasal (interno ou externo) à noite ou em treinos.',
    long:
      'Dilatadores nasais externos (Breathe Right) ou internos (Mute, Turbine) ampliam a passagem aérea durante o sono ou exercício. ' +
      'Útil em casos de colapso valvar nasal funcional — não corrige desvio septal anatômico.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...NOSE],
    references: [
      { citation: 'Petruson B. (2007) Improvement of nasal patency. Acta Otolaryngol.' },
    ],
  },
  {
    id: 'exercise-lip-resistance-expiration',
    category: 'exercise',
    invasiveness: 2,
    short: 'Expiração com resistência labial.',
    long:
      'Expire o ar lentamente por entre os lábios entreabertos como se soprasse uma vela; 10 ciclos, 1× ao dia. ' +
      'Trabalha controle expiratório e tônus orbicular dos lábios. Indicado em fonoterapia respiratória.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: ['upper_lip_height_ratio', 'lower_lip_height_ratio', 'mouth_width_to_icd'],
    references: [FELICIO],
  },
  {
    id: 'exercise-buteyko-breath-hold',
    category: 'exercise',
    invasiveness: 2,
    short: 'Protocolo Buteyko de retenção de ar.',
    long:
      'Após exalação normal, segure a respiração contando segundos até a primeira sensação de necessidade de ar; 5 ciclos, 1× ao dia. ' +
      'Método Buteyko propõe melhora de tolerância ao CO2 e respiração nasal. Sem RCT robusto para estética.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    metrics: [...NOSE],
    references: [BUTEYKO],
  },
  {
    id: 'lifestyle-478-breathing',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Respiração 4-7-8 contra estresse e bruxismo.',
    long:
      'Inspire pelo nariz por 4s, segure 7s, expire pela boca em 8s. 4 ciclos, 2× ao dia (manhã e noite). ' +
      'Técnica popularizada por Andrew Weil — eficaz para redução de estresse agudo e como ritual pré-sono.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...JAW, ...SYM],
    references: [
      { citation: 'Weil A. — 4-7-8 Breathing.', url: 'https://www.drweil.com' },
    ],
  },
  {
    id: 'lifestyle-bedroom-humidifier',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Umidificação do ambiente noturno.',
    long:
      'Manter umidificador no quarto, especialmente em climas secos ou com ar-condicionado. ' +
      'Reduz ressecamento das mucosas nasais e bucais — preserva qualidade da respiração nasal noturna.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...NOSE],
    references: [
      { citation: 'AAOIASF — humidification & nasal mucosa.', url: 'https://www.entnet.org' },
    ],
  },

  // ──────────── 6. EDEMA & DRENAGEM (#51-#60) ────────────
  {
    id: 'lifestyle-ice-facial-immersion',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Ice facial — imersão em água com gelo (1-3 minutos).',
    long:
      'Imergir o rosto em bacia com água gelada por 30 segundos a 1 minuto, repetido 3×. ' +
      'Vasoconstrição reduz edema temporário — efeito puramente cosmético de horas. Prática de Joan Crawford documentada por dermatologistas modernos.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    metrics: [...CHEEK, 'midface_height_ratio'],
    references: [{ citation: 'Tradição estética — sem RCT robusto.' }],
  },
  {
    id: 'exercise-gua-sha-jaw',
    category: 'exercise',
    invasiveness: 2,
    short: 'Massagem Gua Sha mandibular.',
    long:
      'Com pedra Gua Sha (jade ou quartzo), deslize firmemente da mandíbula em direção à orelha por 5 minutos cada lado, 1× ao dia. ' +
      'Estimula drenagem linfática local e tônus tecidual. Tradição da medicina chinesa adaptada ao skincare moderno.',
    evidence: 'anecdotal',
    priority: 3,
    effort: 'low',
    metrics: [...JAW, ...CHEEK],
    references: [{ citation: 'Tradição TCM — sem RCT robusto p/ estética facial.' }],
  },
  // #53 drenagem linfática → JÁ EXISTE (exercise-lymphatic-face-massage). PULAR.
  {
    id: 'lifestyle-ice-roller-morning',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Ice roller matinal (rolo de gelo).',
    long:
      'Passar rolo de gelo (mantido no freezer) pela face por 3 minutos pela manhã. ' +
      'Reduz edema palpebral e malar matinal — efeito cosmético temporário ideal para fotos.',
    evidence: 'anecdotal',
    priority: 3,
    effort: 'low',
    metrics: [...EYES, ...CHEEK, 'midface_height_ratio'],
    references: [{ citation: 'Práticas de skincare K-beauty/J-beauty — sem RCT.' }],
  },
  {
    id: 'lifestyle-jade-roller-cold',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Jade roller gelado pós-aplicação de séruns.',
    long:
      'Após aplicar séruns ou cremes, rolar jade roller frio sobre a face em movimentos ascendentes por 3 minutos. ' +
      'Aprimora absorção de produtos e reduz edema temporário. Sem efeito estrutural.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    metrics: [...CHEEK, ...EYES],
    references: [{ citation: 'K-beauty / dermo-cosmética — sem RCT.' }],
  },
  {
    id: 'lifestyle-low-sodium-evening',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Redução de sódio no jantar.',
    long:
      'Evitar alimentos ricos em sódio (embutidos, salgados, fast food) na refeição da noite. ' +
      'Sódio noturno acentua retenção hídrica e edema palpebral matinal — afeta percepção facial em fotos da manhã.',
    evidence: 'strong',
    priority: 2,
    effort: 'low',
    metrics: [...EYES, ...CHEEK, 'midface_height_ratio'],
    references: [
      { citation: 'WHO — Sodium intake guidelines.', url: 'https://www.who.int/news-room/fact-sheets/detail/salt-reduction' },
    ],
  },
  {
    id: 'lifestyle-potassium-balance',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Aumento de potássio (banana, abacate, batata-doce).',
    long:
      'Incluir alimentos ricos em potássio diariamente para equilibrar a relação Na/K — auxilia o corpo a eliminar excesso de sódio. ' +
      'Efeito gradual sobre edema crônico leve.',
    evidence: 'strong',
    priority: 3,
    effort: 'low',
    metrics: [...EYES, ...CHEEK],
    references: [
      { citation: 'WHO — Potassium intake.', url: 'https://www.who.int/publications/i/item/9789241504829' },
    ],
  },
  {
    id: 'lifestyle-morning-hydration',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Hidratação matinal imediata (500 ml).',
    long:
      'Beber 500 ml de água ao acordar, antes do café. Re-hidrata após desidratação noturna e desencadeia drenagem linfática natural. ' +
      'Hábito simples com efeito cumulativo na aparência facial.',
    evidence: 'moderate',
    priority: 2,
    effort: 'low',
    metrics: [...CHEEK, ...EYES, 'midface_height_ratio'],
    references: [
      { citation: 'Popkin et al. (2010) Water, hydration, and health. Nutr Rev.' },
    ],
  },
  {
    id: 'lifestyle-elevated-headboard',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Elevação da cabeceira da cama em 15-30°.',
    long:
      'Inclinar a cabeceira da cama em 15-30° (com tijolos ou cama ajustável). ' +
      'Reduz acúmulo de líquido na face durante o sono — combate edema palpebral matinal e refluxo gastroesofágico.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...EYES, ...CHEEK],
    references: [
      { citation: 'Mayo Clinic — GERD positional therapy.', url: 'https://www.mayoclinic.org' },
    ],
  },
  {
    id: 'exercise-cervical-lymph-drainage',
    category: 'exercise',
    invasiveness: 2,
    short: 'Drenagem nos gânglios cervicais e claviculares.',
    long:
      'Massagem suave dos gânglios linfáticos no pescoço (laterais) e clavícula em direção descendente; 2 minutos, 1× ao dia. ' +
      'Ativa "ralos" linfáticos antes de drenar a face — protocolo de drenagem linfática manual (DLM).',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...CHEEK, ...EYES],
    references: [
      { citation: 'Vodder School — Manual Lymph Drainage.', url: 'https://www.vodderschool.com' },
    ],
  },

  // ──────────── 7. OLHOS / VISÃO (#61-#70) ────────────
  // #61 pencil push-ups → JÁ EXISTE (exercise-eye-tracking-pencil-pushups). PULAR.
  // #62 orbicular isométrico → JÁ EXISTE (exercise-orbicularis-oculi-isometric). PULAR.
  {
    id: 'exercise-conscious-eye-opening',
    category: 'exercise',
    invasiveness: 2,
    short: 'Treino de abertura palpebral focada.',
    long:
      'Em frente ao espelho, abra os olhos ao máximo segurando 2 segundos sem franzir a testa; 10 repetições, 1× ao dia. ' +
      'Trabalha o levantador da pálpebra superior — útil para quem tem ptose discreta ou olhos cronicamente "puxados".',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: ['eye_aperture_ratio_l', 'eye_aperture_ratio_r', 'eye_height_asymmetry', 'brow_height_l', 'brow_height_r'],
    references: [ALAM],
  },
  {
    id: 'lifestyle-periorbital-massage',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Massagem periorbital suave.',
    long:
      'Com o anelar (dedo de menor força), pressione suavemente o contorno do olho em movimentos circulares, 1 minuto cada lado, 1× ao dia. ' +
      'Estimula microcirculação e drenagem local — reduz olheiras leves de causa vascular.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    metrics: [...EYES],
    references: [{ citation: 'Dermo-cosmética / skincare prática — sem RCT robusto.' }],
  },
  {
    id: 'lifestyle-cold-compress-eyes',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Compressas geladas perioculares.',
    long:
      'Aplicar compressa gelada (gel ou colher refrigerada) sobre os olhos por 5 minutos pela manhã. ' +
      'Vasoconstrição reduz edema palpebral matinal — efeito de horas. Útil antes de fotos importantes.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...EYES],
    references: [
      { citation: 'AAO — periorbital cold compress.', url: 'https://www.aao.org' },
    ],
  },
  {
    id: 'lifestyle-screen-time-evening',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Redução de screen-time noturno.',
    long:
      'Reduzir uso de telas (celular, computador) nos últimos 90 minutos antes de dormir. ' +
      'Telas próximas tarde da noite causam fadiga ocular acumulada que se manifesta no dia seguinte como olhos vermelhos, edema e abertura palpebral reduzida.',
    evidence: 'moderate',
    priority: 3,
    effort: 'medium',
    metrics: [...EYES],
    references: [
      { citation: 'Sheppard A.L., Wolffsohn J.S. (2018) Digital eye strain. BMJ Open Ophthalmol.', url: 'https://pubmed.ncbi.nlm.nih.gov/29963645/' },
    ],
  },
  {
    id: 'exercise-eye-direction-stretch',
    category: 'exercise',
    invasiveness: 2,
    short: 'Alongamento ocular direcional.',
    long:
      'Sem mover a cabeça, olhe para cima, baixo, esquerda e direita mantendo 5 segundos cada direção; 5 ciclos completos, 1× ao dia. ' +
      'Estimula músculos oculomotores e reduz fadiga visual.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...EYES],
    references: [AOA],
  },
  {
    id: 'exercise-conscious-blinking',
    category: 'exercise',
    invasiveness: 2,
    short: 'Treino de piscar consciente completo.',
    long:
      'A cada hora, faça 10 piscadas lentas e completas (fechar bem os olhos, abrir totalmente). ' +
      'Trabalho frente a tela reduz frequência e completude do piscar — causa de olho seco crônico e percepção de olhos "tensos".',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...EYES],
    references: [
      { citation: 'Acosta M.C. et al. (1999) Influence of computer use on blink rate.', url: 'https://pubmed.ncbi.nlm.nih.gov/10448718/' },
    ],
  },
  {
    id: 'lifestyle-rule-20-20-20',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Regra 20-20-20 para descanso visual.',
    long:
      'A cada 20 minutos olhando uma tela, olhe para algo a ~6 metros (20 pés) por 20 segundos. ' +
      'Recomendação oficial da AAO/AOA para reduzir Computer Vision Syndrome.',
    evidence: 'strong',
    priority: 2,
    effort: 'low',
    metrics: [...EYES],
    references: [AOA],
  },
  {
    id: 'lifestyle-blue-blocker-evening',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Óculos blue-blocker à noite.',
    long:
      'Usar óculos com filtro de luz azul nas últimas 2 horas antes de dormir, especialmente se trabalhar em tela. ' +
      'Reduz fadiga ocular e melhora qualidade do sono — luz azul à noite suprime melatonina.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...EYES],
    references: [
      { citation: 'Tähkämö L. et al. (2019) Blue light exposure & circadian rhythm. Chronobiol Int.', url: 'https://pubmed.ncbi.nlm.nih.gov/30311830/' },
    ],
  },

  // ──────────── 8. SKINCARE (#71-#80) ────────────
  {
    id: 'lifestyle-daily-spf',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Protetor solar facial diário (FPS 30+).',
    long:
      'Aplicar protetor solar facial todas as manhãs, mesmo em dias nublados ou em ambiente fechado próximo a janelas. ' +
      'Fotoenvelhecimento é responsável por ~80% dos sinais visíveis de envelhecimento facial. Hábito não-negociável para preservação.',
    evidence: 'strong',
    priority: 1,
    effort: 'low',
    metrics: [...CHEEK, ...FOREHEAD],
    references: [SBD,
      { citation: 'Hughes M.C.B. et al. (2013) Sunscreen & skin aging. Ann Intern Med.', url: 'https://pubmed.ncbi.nlm.nih.gov/23732711/' },
    ],
  },
  {
    id: 'lifestyle-hyaluronic-acid-skincare',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Hidratação facial com ácido hialurônico tópico.',
    long:
      'Sérum com ácido hialurônico de baixo peso molecular antes do hidratante, manhã e noite. ' +
      'Hidratação imediata da camada superficial — efeito de "preenchimento óptico" temporário a moderado.',
    evidence: 'moderate',
    priority: 2,
    effort: 'low',
    metrics: [...CHEEK, ...FOREHEAD, 'midface_height_ratio'],
    references: [SBD],
  },
  {
    id: 'lifestyle-retinoid-night',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Retinol/retinóides tópicos noturnos.',
    long:
      'Iniciar com retinol em baixa concentração (0.25-0.5%) 2× por semana e progredir gradualmente. Aplicar somente à noite. ' +
      'Tretinoína e retinóides têm a maior evidência de qualquer ativo cosmético para reduzir sinais de envelhecimento.',
    evidence: 'strong',
    priority: 2,
    effort: 'medium',
    risk: 0.15,
    metrics: [...CHEEK, ...FOREHEAD],
    references: [
      { citation: 'Mukherjee S. et al. (2006) Retinoids in cosmetic anti-aging. Clin Interv Aging.', url: 'https://pubmed.ncbi.nlm.nih.gov/18046911/' },
    ],
    disclaimer: 'Pode causar irritação e descamação inicial. Não usar em gestantes ou lactantes. Sempre combinar com FPS diurno — retinóides aumentam fotossensibilidade.',
  },
  {
    id: 'lifestyle-aha-bha-weekly',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Esfoliação química leve semanal (AHA/BHA).',
    long:
      'Tônico ou sérum com ácido glicólico (AHA) ou salicílico (BHA) 1-2× por semana à noite. ' +
      'Acelera renovação celular, melhora textura e luminosidade. Iniciar gradualmente e sempre com FPS no dia seguinte.',
    evidence: 'strong',
    priority: 3,
    effort: 'low',
    risk: 0.1,
    metrics: [...CHEEK, ...FOREHEAD],
    references: [SBD],
  },
  {
    id: 'lifestyle-led-red-light',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Terapia de luz LED vermelha domiciliar.',
    long:
      'Máscara ou painel de LED vermelho (~630-660nm) por 10 minutos, 3-4× por semana. ' +
      'Estimula colágeno e reduz inflamação. Evidência crescente em fotorrejuvenescimento; equipamentos domésticos têm potência inferior aos clínicos.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...CHEEK, ...FOREHEAD],
    references: [
      { citation: 'Wunsch A., Matuschka K. (2014) LED therapy & skin rejuvenation. Photomed Laser Surg.', url: 'https://pubmed.ncbi.nlm.nih.gov/24286286/' },
    ],
  },
  {
    id: 'lifestyle-collagen-vitc',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Suplementação de colágeno + vitamina C.',
    long:
      'Suplementar colágeno hidrolisado (10g/dia) com vitamina C (necessária para síntese endógena de colágeno). ' +
      'Meta-análises mostram benefício modesto em hidratação e elasticidade após 8-12 semanas.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...CHEEK, ...FOREHEAD],
    references: [
      { citation: 'Choi F.D. et al. (2019) Oral collagen supplementation. J Drugs Dermatol.', url: 'https://pubmed.ncbi.nlm.nih.gov/30681787/' },
    ],
  },
  {
    id: 'lifestyle-microneedling-monthly',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Microagulhamento mensal (derma roller domiciliar 0.25-0.5mm).',
    long:
      'Aparelho derma roller de uso doméstico (agulhas curtas, 0.25-0.5mm) 1-2× por mês, sempre com pele higienizada. ' +
      'Estimula renovação superficial. Profundidades maiores são procedimento clínico (PR-77), não doméstico.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    risk: 0.2,
    metrics: [...CHEEK, ...FOREHEAD],
    references: [SBD],
    disclaimer: 'Risco de infecção se feito sem assepsia adequada. Em peles sensíveis, com acne ativa ou rosácea, é contraindicado. Procedimento clínico profissional é mais seguro.',
  },
  {
    id: 'lifestyle-slugging-vaseline',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Slugging noturno com vaselina.',
    long:
      'Aplicar fina camada de vaselina (Petroleum Jelly) sobre o rosto após skincare noturno, em peles muito secas. ' +
      'Cria barreira oclusiva — popular em K-beauty. Não é para peles oleosas ou propensas a acne.',
    evidence: 'anecdotal',
    priority: 5,
    effort: 'low',
    metrics: [...CHEEK, ...FOREHEAD],
    references: [{ citation: 'K-beauty / dermo-trends — sem RCT robusto.' }],
  },
  {
    id: 'lifestyle-ascending-massage',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Massagem facial ascendente com óleo.',
    long:
      'Após skincare noturno, massagem com óleo facial em movimentos ascendentes (do pescoço à testa) por 3 minutos, 1× ao dia. ' +
      'Estimula microcirculação e relaxamento muscular. Sem efeito estrutural — coadjuvante de rotina.',
    evidence: 'anecdotal',
    priority: 4,
    effort: 'low',
    metrics: [...CHEEK, ...JAW, ...FOREHEAD],
    references: [{ citation: 'Tradição K-beauty / face yoga — sem RCT.' }],
  },
  {
    id: 'lifestyle-enzymatic-peel',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Peeling enzimático (papaína, bromelina).',
    long:
      'Máscara enzimática (com papaína de mamão ou bromelina de abacaxi) 1× por semana — alternativa mais suave a AHA/BHA. ' +
      'Bom para peles sensíveis que não toleram esfoliação química.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...CHEEK, ...FOREHEAD],
    references: [SBD],
  },

  // ──────────── 9. STYLING / VISAGISMO (#81-#90) ────────────
  {
    id: 'styling-eyebrow-tint-fill',
    category: 'styling',
    invasiveness: 3,
    short: 'Tintura ou preenchimento estratégico de sobrancelha.',
    long:
      'Tintura ou pigmentação cosmética (pomada, lápis, henna) para densidade ideal das sobrancelhas conforme formato facial. ' +
      'Sobrancelha densa e bem desenhada é o item de maior retorno visual no terço superior — guia o olhar.',
    evidence: 'strong',
    priority: 2,
    effort: 'low',
    metrics: [...BROWS, 'forehead_height_ratio'],
    references: [HALLAWELL],
  },
  {
    id: 'lifestyle-brow-growth-serum',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Sérum estimulador de crescimento de sobrancelha.',
    long:
      'Aplicar sérum específico (com peptídeos, biotina ou minoxidil 2-5% off-label) por 12-16 semanas para densificação. ' +
      'Minoxidil tem evidência específica em ensaios pequenos para densidade de sobrancelha. Contraindicado em gestantes.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    risk: 0.15,
    metrics: ['brow_thickness_l', 'brow_thickness_r', 'brow_arch_peak_l', 'brow_arch_peak_r'],
    references: [
      { citation: 'Suchonwanit P. et al. (2019) Minoxidil for eyebrow. Drug Des Devel Ther.', url: 'https://pubmed.ncbi.nlm.nih.gov/31118583/' },
    ],
    disclaimer: 'Minoxidil para sobrancelha é uso off-label. Pode causar irritação local e crescimento de pelos em áreas próximas (têmpora, fronte) se mal aplicado. Suspender se houver dermatite.',
  },
  {
    id: 'styling-haircut-vertical-volume',
    category: 'styling',
    invasiveness: 3,
    short: 'Corte de cabelo com volume superior (alonga rosto).',
    long:
      'Para rostos largos ou redondos: cortes com volume e comprimento no topo e laterais mais discretas. ' +
      'Visagismo clássico — cabelo cria moldura facial e pode ajustar a percepção de proporção facial em fotos.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: ['face_height_to_width_ratio', 'forehead_width_ratio', 'temporal_width_ratio'],
    severities: ['moderate', 'strong'],
    references: [HALLAWELL],
  },
  {
    id: 'styling-haircut-lateral-volume',
    category: 'styling',
    invasiveness: 3,
    short: 'Corte com volume lateral (alarga rosto longo).',
    long:
      'Para rostos longos ou estreitos: cortes com volume nas laterais e na altura das maçãs do rosto. ' +
      'Quebra a verticalidade percebida e harmoniza face com proporção 1:1.4 ou superior.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: ['face_height_to_width_ratio', 'temporal_width_ratio', ...THIRDS],
    severities: ['moderate', 'strong'],
    references: [HALLAWELL],
  },
  {
    id: 'styling-goatee-projection',
    category: 'styling',
    invasiveness: 3,
    short: 'Barba "goatee" ou cavanhaque para projetar o queixo.',
    long:
      'Para queixos retraídos: barba estilo goatee, candado ou cavanhaque alonga visualmente o terço inferior. ' +
      'Estratégia clássica de visagismo masculino documentada por Hallawell.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: ['chin_height_ratio', 'lower_third_ratio'],
    severities: ['moderate', 'strong'],
    references: [HALLAWELL],
  },
  {
    id: 'styling-stubble-jawline',
    category: 'styling',
    invasiveness: 3,
    short: 'Barba "stubble" densa na linha mandibular.',
    long:
      'Manter sombra de barba (3-5mm) bem aparada e densa ao longo da linha mandibular acentua o contorno gonial. ' +
      'Útil para mandíbulas pouco definidas ou ângulos goniais arredondados.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...JAW, 'gonial_angle_asymmetry'],
    severities: ['moderate', 'strong'],
    references: [HALLAWELL],
  },
  {
    id: 'styling-contour-bronzer',
    category: 'styling',
    invasiveness: 3,
    short: 'Contorno facial leve com bronzer/maquiagem.',
    long:
      'Aplicação de bronzer ou contorno em zonas estratégicas (sob a maçã, lateral do nariz, têmporas) realça relevo e proporção. ' +
      'Técnica reversível e ajustável — útil para fotos importantes.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: [...CHEEK, ...NOSE, ...JAW],
    severities: ['moderate', 'strong'],
    references: [HALLAWELL],
  },
  {
    id: 'styling-inner-eye-highlight',
    category: 'styling',
    invasiveness: 3,
    short: 'Iluminação estratégica do canto interno dos olhos.',
    long:
      'Aplicar iluminador discreto no canto interno e abaixo do supercílio. ' +
      'Aumenta a percepção de abertura ocular e brilho — útil em fotos de manhã ou após noites mal dormidas.',
    evidence: 'moderate',
    priority: 4,
    effort: 'low',
    metrics: [...EYES, 'intercanthal_distance'],
    references: [HALLAWELL],
  },
  {
    id: 'styling-interbrow-pluck',
    category: 'styling',
    invasiveness: 3,
    short: 'Remoção estratégica de pelos interciliares.',
    long:
      'Remoção de monocelha e ajuste da distância entre as sobrancelhas, respeitando a regra de visagismo: alinhar borda interna da sobrancelha com canto interno do olho. ' +
      'Pode equilibrar percepção de distância ocular sem alterar estrutura.',
    evidence: 'moderate',
    priority: 3,
    effort: 'low',
    metrics: ['interbrow_distance_ratio', 'intercanthal_distance', 'intercanthal_to_eye_width_ratio'],
    severities: ['mild', 'moderate', 'strong'],
    references: [HALLAWELL],
  },
  {
    id: 'styling-teeth-whitening-safe',
    category: 'styling',
    invasiveness: 3,
    short: 'Clareamento dental seguro (clínico ou caseiro com gel autorizado).',
    long:
      'Clareamento dental supervisionado por dentista ou kit caseiro com peróxido em concentração regulada (≤6%) por 2-4 semanas. ' +
      'Dentes amarelados desviam a atenção da estrutura facial — clareamento melhora dramaticamente a percepção do sorriso.',
    evidence: 'strong',
    priority: 3,
    effort: 'medium',
    risk: 0.2,
    metrics: [...MOUTH, 'mouth_to_face_width_ratio'],
    references: [
      { citation: 'CFO/CRO — clareamento dental.', url: 'https://www.cfo.org.br' },
    ],
    disclaimer: 'Concentrações maiores que 6% só devem ser aplicadas por dentista. Pode causar sensibilidade dentária temporária. Em casos de bruxismo ou recessão gengival, consultar profissional.',
  },

  // ──────────── 10. PROFISSIONAL & CLÍNICO (#91-#99) ────────────
  {
    id: 'professional-orthodontic-functional-eval',
    category: 'professional_referral',
    invasiveness: 4,
    short: 'Avaliação ortodôntica/ortopédica funcional.',
    long:
      'Em casos de mordida cruzada, prognatismo, retrognatismo ou desvio mandibular percebido, avaliação com ortodontista pode esclarecer se há indicação de tratamento ortopédico ou ortodôntico funcional. ' +
      'A rotina do app cobre o trabalho muscular e postural — para questão estrutural óssea ou dental, é informação adicional.',
    evidence: 'strong',
    priority: 3,
    effort: 'high',
    risk: 0.4,
    requiresProfessional: true,
    professionalType: 'orthodontist',
    metrics: [...JAW, 'gonial_angle_asymmetry', 'face_height_to_width_ratio'],
    severities: ['strong', 'extreme'],
    references: [
      { citation: 'Sociedade Brasileira de Ortodontia.', url: 'https://www.sbo.org.br' },
    ],
  },
  {
    id: 'professional-myofunctional-speech-therapist',
    category: 'professional_referral',
    invasiveness: 4,
    short: 'Avaliação fonoaudiológica mioterápica.',
    long:
      'Para padrão deglutório atípico, respiração bucal crônica ou tônus orofacial reduzido, mioterapia conduzida por fonoaudiólogo especializado é o caminho mais robusto. ' +
      'O app oferece exercícios isolados; o fonoaudiólogo individualiza um protocolo. Não é exigência — alguns usuários optam por essa avaliação para acelerar resultados.',
    evidence: 'strong',
    priority: 3,
    effort: 'medium',
    risk: 0.1,
    requiresProfessional: true,
    professionalType: 'physiotherapist',
    metrics: [...MOUTH, ...JAW, 'middle_third_ratio', 'lower_third_ratio'],
    severities: ['moderate', 'strong', 'extreme'],
    references: [FELICIO,
      { citation: 'CFFa — Conselho Federal de Fonoaudiologia.', url: 'https://www.fonoaudiologia.org.br' },
    ],
  },
  {
    id: 'professional-bite-splint',
    category: 'professional_referral',
    invasiveness: 4,
    short: 'Placa de mordida miorrelaxante para bruxismo.',
    long:
      'Em casos de bruxismo persistente (com dor mandibular, desgaste dental ou hipertrofia visível do masseter), placa miorrelaxante feita por dentista. ' +
      'A rotina do app inclui relaxamento e cuidado postural — placa é coadjuvante quando há sinais clínicos consistentes.',
    evidence: 'strong',
    priority: 3,
    effort: 'medium',
    risk: 0.2,
    requiresProfessional: true,
    professionalType: 'dentist',
    metrics: [...JAW],
    severities: ['strong', 'extreme'],
    references: [
      { citation: 'Lobbezoo F. et al. (2018) International consensus on bruxism. J Oral Rehabil.', url: 'https://pubmed.ncbi.nlm.nih.gov/29926505/' },
    ],
  },
  {
    id: 'professional-craniocervical-myofascial-therapy',
    category: 'professional_referral',
    invasiveness: 4,
    short: 'Terapia miofascial cervico-craniana profissional.',
    long:
      'Em casos de tensão crônica resistente a auto-massagem, fisioterapia especializada (RPG, miofascial, osteopatia) pode aprofundar o trabalho. ' +
      'A rotina diária do app cobre boa parte do problema; profissional acelera casos resistentes.',
    evidence: 'moderate',
    priority: 4,
    effort: 'medium',
    risk: 0.1,
    requiresProfessional: true,
    professionalType: 'physiotherapist',
    metrics: [...SYM, ...JAW],
    severities: ['strong', 'extreme'],
    references: [TRAVELL, ROCABADO],
  },
  {
    id: 'lifestyle-body-fat-cutting',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Redução de gordura corporal global (cutting nutricional).',
    long:
      'Em casos de adiposidade facial elevada, perda gradual de 5-10% do peso corporal melhora dramaticamente a definição facial — especialmente mandíbula e maçãs do rosto. ' +
      'Mudança não-cirúrgica de maior impacto em pessoas com IMC elevado. Idealmente acompanhada por nutricionista.',
    evidence: 'strong',
    priority: 2,
    effort: 'high',
    metrics: [...JAW, ...CHEEK, 'midface_height_ratio', 'cheekbone_to_jaw_ratio'],
    references: [
      { citation: 'Le K. et al. (2022) Body composition & facial appearance. Aesthet Surg J.', url: 'https://pubmed.ncbi.nlm.nih.gov/34908137/' },
    ],
  },
  {
    id: 'professional-otorhinolaryngology-eval',
    category: 'professional_referral',
    invasiveness: 4,
    short: 'Investigação otorrinolaringológica.',
    long:
      'Em caso de respiração nasal cronicamente difícil (mesmo com lavagem e dilatador), avaliação com otorrino para descartar desvio de septo, hipertrofia de cornetos ou adenóides. ' +
      'Pré-requisito para mouth taping seguro e para planejamento de mudança respiratória sustentável.',
    evidence: 'strong',
    priority: 3,
    effort: 'medium',
    risk: 0.3,
    requiresProfessional: true,
    professionalType: 'otolaryngologist',
    clinicalPathway: true,
    metrics: [...NOSE],
    severities: ['moderate', 'strong', 'extreme'],
    references: [
      { citation: 'AAO-HNS — Nasal obstruction guidelines.', url: 'https://www.entnet.org' },
    ],
  },
  {
    id: 'professional-allergy-treatment',
    category: 'professional_referral',
    invasiveness: 4,
    short: 'Tratamento clínico de alergias respiratórias crônicas.',
    long:
      'Rinite alérgica não-tratada mantém congestão nasal crônica e respiração bucal compensatória. ' +
      'Tratamento com alergista (imunoterapia, anti-histamínicos, corticoide tópico) resolve a causa. Coadjuvante essencial para a rotina respiratória do app.',
    evidence: 'strong',
    priority: 3,
    effort: 'medium',
    risk: 0.1,
    requiresProfessional: true,
    professionalType: 'otolaryngologist',
    metrics: [...NOSE, ...EYES],
    severities: ['moderate', 'strong'],
    references: [
      { citation: 'Bousquet J. et al. (2020) ARIA guidelines.', url: 'https://www.aria-allergy.org' },
    ],
  },
  {
    id: 'lifestyle-acupuncture-relaxation',
    category: 'lifestyle',
    invasiveness: 1,
    short: 'Acupuntura estética e de relaxamento facial.',
    long:
      'Sessões periódicas de acupuntura facial (cosmetic acupuncture) com profissional habilitado. ' +
      'Evidência crescente para relaxamento, bem-estar e melhora subjetiva de aspecto. Sem evidência forte para alteração estrutural.',
    evidence: 'moderate',
    priority: 5,
    effort: 'medium',
    risk: 0.1,
    metrics: [...SYM, ...CHEEK, ...FOREHEAD],
    references: [
      { citation: 'Donoyama N. et al. (2012) Cosmetic acupuncture. J Acupunct Meridian Stud.' },
    ],
  },
  {
    id: 'professional-sleep-apnea-screening',
    category: 'professional_referral',
    invasiveness: 4,
    short: 'Rastreamento e tratamento de apneia do sono.',
    long:
      'Para quem ronca, acorda cansado ou tem sonolência diurna, polissonografia para diagnóstico de SAOS. ' +
      'Apneia não-tratada compromete oxigenação e sono, com impacto cumulativo sobre a aparência facial (olheiras crônicas, edema). Tratamento com CPAP ou aparelho intraoral.',
    evidence: 'strong',
    priority: 3,
    effort: 'high',
    risk: 0.2,
    requiresProfessional: true,
    professionalType: 'otolaryngologist',
    clinicalPathway: true,
    metrics: [...EYES, ...CHEEK, ...NOSE],
    severities: ['moderate', 'strong', 'extreme'],
    references: [
      { citation: 'AASM — Sleep apnea guidelines.', url: 'https://aasm.org' },
    ],
  },

  // ──────────── 11. TRACKING (#100) ────────────
  {
    id: 'photo-monthly-standardized-tracking',
    category: 'photo',
    invasiveness: 0,
    short: 'Tracking fotográfico padronizado mensal.',
    long:
      'Tirar foto facial todos os meses no mesmo dia, hora, com a mesma luz natural, mesma distância e pose neutra. ' +
      'Documentar a trajetória pessoal — base de evidência individual. O before/after objetivo só funciona com padronização.',
    evidence: 'strong',
    priority: 1,
    effort: 'low',
    metrics: [...SYM, ...JAW, ...CHEEK, ...EYES, ...NOSE, ...MOUTH, ...FOREHEAD, ...BROWS, ...THIRDS],
    severities: ['mild', 'moderate', 'strong', 'extreme'],
    references: [
      { citation: 'Princípio metodológico do app — fotografia padronizada.' },
    ],
  },
];

const CANONICAL_OVERLAP_NOTE = `
Itens canônicos (#11, #21, #31, #35, #39, #45, #53, #61, #62) já existem na
seed anterior 1746000235000-M44SeedExerciseCatalog.ts e não são reinseridos.
Total: 100 itens canônicos = 91 inseridos aqui + 9 já existentes.
`.trim();
void CANONICAL_OVERLAP_NOTE; // anti-deadcode hint

export class M44SeedFullCatalog1001746000240000 implements MigrationInterface {
  name = 'M44SeedFullCatalog1001746000240000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const s of SEED) {
      const disclaimer =
        s.disclaimer ??
        (s.evidence === 'anecdotal'
          ? POPULAR_DISCLAIMER
          : s.category === 'professional_referral'
          ? REFERRAL_DISCLAIMER
          : null);
      const refs = JSON.stringify(s.references);
      const risk = s.risk ?? (s.category === 'professional_referral' ? 0.3 : 0.05);

      await queryRunner.query(
        `
          INSERT INTO recommendation_catalog (
            id, version, category, display_text_short_pt, display_text_long_pt,
            priority_default, effort_estimate, risk_level, requires_professional, professional_type,
            invasiveness_level, evidence_level, clinical_pathway_required, references_jsonb, disclaimer_template
          ) VALUES (
            $1, 'v1.0', $2::recommendation_category_enum, $3, $4,
            $5, $6, $7, $8, $9,
            $10, $11::evidence_level_enum, $12, $13::jsonb, $14
          )
          ON CONFLICT (id) DO NOTHING
        `,
        [
          s.id,
          s.category,
          s.short,
          s.long,
          s.priority,
          s.effort,
          risk,
          s.requiresProfessional ?? false,
          s.professionalType ?? null,
          s.invasiveness,
          s.evidence,
          s.clinicalPathway ?? false,
          refs,
          disclaimer,
        ],
      );

      const sevs = s.severities ?? ['mild', 'moderate', 'strong'];
      for (const m of s.metrics) {
        for (const sev of sevs) {
          await queryRunner.query(
            `
              INSERT INTO recommendation_trigger (
                recommendation_id, metric_id, severity, direction,
                additional_conditions, min_invasiveness_level, clinical_pathway_required
              ) VALUES ($1, $2, $3::severity_5_enum, 'any', NULL, NULL, $4)
              ON CONFLICT DO NOTHING
            `,
            [s.id, m, sev, s.clinicalPathway ?? false],
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
