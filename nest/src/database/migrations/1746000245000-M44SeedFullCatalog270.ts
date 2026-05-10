/**
 * PR-55e — Seed da "Cauda Longa" do catálogo (270 itens, escada terapêutica).
 *
 * Adiciona itens das listas 201-400 e Cauda Longa (LT 1-70) do arquivo
 * `solucoes_para_rotina.md`. Total: 270 recomendações novas em v1.0.
 *
 * Domínios cobertos
 * -----------------
 *   201-225 Postura cervical avançada / ergonomia / fisio postural
 *   226-250 Mioterapia orofacial / ATM / lábios / língua (long tail)
 *   251-275 Skincare avançado (ácidos, séruns, peptídeos, máscaras)
 *   276-300 Dieta / suplementação / drenagem nutricional
 *   301-325 Olhos / pálpebras / sobrancelhas / cílios / ortóptica
 *   326-350 Styling avançado / barba / cabelo / acessórios visagísticos
 *   351-375 Sono / quarto / mindfulness / monitoramento HRV / ronco
 *   376-400 Tracking fotográfico avançado / cefalometria / mapeamento
 *   LT 1-15 Mioterapia ultra-avançada (estalo segmentar, pastilha, etc.)
 *   LT 16-25 ATM clínico (rastreio condilar, pterigóideo, tração caudal)
 *   LT 26-36 Isolamento muscular facial (face yoga avançado)
 *   LT 37-44 Ortóptica e musculatura ocular
 *   LT 45-56 Fisio cervical avançada (SNAGs, neural, serrátil, escapular)
 *   LT 57-70 Liberação craniana / fáscia / suturas
 *
 * Filosofia editorial mantida
 * ---------------------------
 * Todos itens entram como `lifestyle`, `posture`, `exercise`, `styling`,
 * `photo` ou (em casos clínicos óbvios) `professional_referral`. Nenhum
 * item dispara cirurgia. Pseudo-ciência (oil pulling, EFT tapping, ouro
 * 24k, água termal, jade roller, etc.) entra como `evidence_level='anecdotal'`
 * com disclaimer popular padrão.
 *
 * Risco editorial:
 * - itens com risco real (mouth taping, peróxido benzoíla, retinol pescoço,
 *   bimatoprosta, microagulhamento, jejum prolongado) carregam disclaimer
 *   específico além do popular padrão.
 *
 * Down: remove apenas as linhas inseridas aqui.
 *
 * Provenance & references: ver arquivo `solucoes_para_rotina.md` (curadoria
 * do produto) + `recommendations_full_catalog_index.md` (provenance bibliográfica).
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

interface Seed {
  id: string;
  category: Cat;
  invasiveness: 0 | 1 | 2 | 3 | 4;
  short: string;
  long: string;
  evidence: Evidence;
  priority: 1 | 2 | 3 | 4 | 5;
  effort: Effort;
  metrics: string[];
  severities?: Severity[];
  risk?: number;
  requiresProfessional?: boolean;
  professionalType?:
    | 'dentist'
    | 'physiotherapist'
    | 'dermatologist'
    | 'otolaryngologist'
    | 'plastic_surgeon'
    | 'orthodontist'
    | 'oral_maxillofacial_surgeon';
  clinicalPathway?: boolean;
  disclaimer?: string;
}

const POPULAR_DISCLAIMER =
  'Esta sugestão tem caráter popular e ainda não possui consenso científico robusto. Não há riscos relatados quando feita corretamente, mas resultados variam.';
const REFERRAL_DISCLAIMER =
  'A rotina do app cobre as principais melhorias possíveis sem intervenção clínica. Em casos como o seu, alguns usuários optam por consultar este profissional para resolução estrutural — não é exigência nem condição de melhora. Esta menção é informativa, não prescrição médica.';

// Métricas agrupadas por região para reaproveitamento
const SYM = ['midline_deviation', 'global_asymmetry_index'];
const JAW = ['gonial_angle_l', 'gonial_angle_r', 'gonial_angle_asymmetry', 'jaw_width_ratio', 'mandibular_plane_angle'];
const NOSE = ['alar_base_asymmetry', 'alar_to_face_width_ratio', 'nose_width_to_icd', 'nasal_tip_deviation', 'dorsum_deviation'];
const MOUTH = ['lip_corner_canting', 'mouth_midline_deviation', 'lip_canting_angle', 'mouth_to_face_width_ratio', 'upper_lip_height_ratio', 'lower_lip_height_ratio', 'vermilion_height_total', 'mouth_width_to_icd'];
const EYES = ['eye_aperture_ratio_l', 'eye_aperture_ratio_r', 'eye_height_asymmetry', 'canthal_tilt_l', 'canthal_tilt_r', 'intercanthal_distance'];
const BROWS = ['brow_height_l', 'brow_height_r', 'brow_height_asymmetry', 'brow_arch_peak_l', 'brow_arch_peak_r', 'brow_tail_drop_l', 'brow_thickness_l', 'brow_thickness_r', 'interbrow_distance_ratio'];
const FOREHEAD = ['forehead_height_ratio', 'forehead_width_ratio', 'temporal_width_ratio', 'hairline_curvature_index'];
const CHEEK = ['malar_projection_index', 'submalar_hollow_index', 'cheekbone_to_jaw_ratio', 'midface_height_ratio', 'zygomatic_width_ratio'];
const THIRDS = ['upper_third_ratio', 'middle_third_ratio', 'lower_third_ratio'];
const FACE_SHAPE = ['face_height_to_width_ratio', 'face_shape_classification'];

const ALL_FACIAL = [...SYM, ...JAW, ...CHEEK, ...EYES, ...NOSE, ...MOUTH, ...FOREHEAD, ...BROWS, ...THIRDS, ...FACE_SHAPE];

// Helper para criar item com defaults
const ex = (
  id: string,
  short: string,
  long: string,
  category: Cat,
  invasiveness: 0 | 1 | 2 | 3 | 4,
  evidence: Evidence,
  priority: 1 | 2 | 3 | 4 | 5,
  effort: Effort,
  metrics: string[],
  opts: Partial<Seed> = {},
): Seed => ({ id, short, long, category, invasiveness, evidence, priority, effort, metrics, ...opts });

const SEED: Seed[] = [
  // ════════════════════ POSTURA / ERGONOMIA AVANÇADA (201-225) ════════════════════
  ex('routine-201-text-neck-correction', 'Elevar celular à altura dos olhos para evitar "text neck".',
    'Sustentar o aparelho à altura da linha dos olhos durante o uso, em vez de inclinar a cabeça para baixo. Reduz a sobrecarga cervical em ~27kg que ocorre na flexão cervical de 60°.', 'posture', 1, 'strong', 1, 'low', SYM),
  ex('routine-202-levator-scapulae-stretch', 'Alongamento do levantador da escápula.',
    'Sentado, gire a cabeça 45° para um lado e olhe para a axila do mesmo lado, puxando a cabeça suavemente; 30s cada lado, 2× ao dia. Reduz tensão que rotaciona a cabeça lateralmente.', 'exercise', 2, 'moderate', 3, 'low', [...SYM, 'gonial_angle_asymmetry']),
  ex('routine-203-bruggers-relief', 'Brugger\'s Relief para abertura peitoral.',
    'Sentado na ponta da cadeira, abra os braços com palmas para frente, retraia escápulas, projete o peito; 20s, 3× ao dia. Antagonista direto da postura "fechada" de quem trabalha em tela.', 'posture', 1, 'moderate', 2, 'low', SYM),
  ex('routine-204-rhomboids-strengthening', 'Fortalecimento de romboides para estabilidade cervical.',
    'Em pé, faça remada com elástico mantendo cotovelos rentes ao corpo; 3 séries de 12. Romboides fortes estabilizam a escápula e indiretamente sustentam o pescoço.', 'exercise', 2, 'moderate', 3, 'medium', SYM),
  ex('routine-205-lacrosse-ball-scapula', 'Liberação fascial com bola de lacrosse na escápula.',
    'Apoie a bola entre escápula e parede, deslize devagar buscando trigger points; 3 minutos cada lado. Libera tensão em romboides e infra/supraespinhal.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-206-ergonomic-chair-cervical', 'Cadeira ergonômica com apoio cervical ajustado.',
    'Investir em cadeira que sustente coluna lombar e apoio cervical na altura correta. Item base de quem trabalha sentado >6h/dia.', 'lifestyle', 1, 'strong', 2, 'medium', SYM),
  ex('routine-207-scalene-stretch-shower', 'Alongamento isométrico de escalenos no chuveiro quente.',
    'Sob o jato de água quente, incline a cabeça para o lado oposto à clavícula deprimida e respire profundo; 30s cada lado. Calor + alongamento = liberação muscular profunda.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-208-driving-headrest-position', 'Encosto de cabeça do carro a 2cm do crânio.',
    'Ajustar o encosto para tocar a parte posterior do crânio (não o pescoço) — protege em caso de impacto e induz postura cervical correta no dia a dia.', 'lifestyle', 1, 'strong', 4, 'low', SYM),
  ex('routine-209-front-plank-core', 'Prancha frontal diária para sustentação global.',
    'Manter prancha por 30-60s, 3× ao dia. Core forte é base para postura ereta sem esforço — afeta diretamente alinhamento cervical.', 'exercise', 2, 'strong', 3, 'medium', SYM),
  ex('routine-210-diaphragm-subcostal-massage', 'Liberação do diafragma com massagem subcostal.',
    'Deitado, polegares deslizam sob as costelas inferiores na expiração; 1 minuto cada lado. Diafragma tenso afeta postura torácica e cervical em cadeia.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-211-foam-roller-thoracic', 'Foam roller torácico para extensão.',
    'Posicione o rolo sob a coluna torácica e estenda a coluna para trás; 1 minuto, 1× ao dia. Mobiliza vértebras travadas que comprometem alinhamento cervical.', 'exercise', 2, 'moderate', 3, 'low', SYM),
  ex('routine-212-bilateral-backpack', 'Substituir mochila unilateral por bilateral/transversal.',
    'Bolsa de ombro único causa elevação assimétrica crônica do trapézio. Mochila com 2 alças ou tiracolo cruzado distribuem a carga.', 'lifestyle', 1, 'moderate', 3, 'low', SYM),
  ex('routine-213-walking-external-rotation', 'Caminhar com rotação externa dos ombros.',
    'Durante caminhadas, lembre-se conscientemente de rotacionar levemente as palmas para frente. Combate a postura "fechada" de quem trabalha sentado.', 'lifestyle', 1, 'moderate', 4, 'low', SYM),
  ex('routine-214-cervical-isometric-lateral', 'Isometria cervical lateral com resistência das mãos.',
    'Posicione a mão lateralmente na cabeça e empurre a cabeça contra a mão por 5s sem movimento; 10 repetições cada lado. Fortalece flexores laterais profundos.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-215-pelvic-retroversion', 'Retroversão pélvica para correção de hiperlordose.',
    'Deitado, pressione a região lombar contra o chão por 5s; 10 repetições. Hiperlordose lombar puxa a cadeia anterior e desestabiliza coluna cervical.', 'exercise', 2, 'moderate', 3, 'low', SYM),
  ex('routine-216-laptop-stand', 'Suporte de notebook inclinado ou mesa digitalizadora.',
    'Elevar o notebook para a altura dos olhos, usando teclado e mouse externos. Evita flexão cervical sustentada de 8h/dia.', 'lifestyle', 1, 'strong', 1, 'low', SYM),
  ex('routine-217-inversion-traction', 'Suspensão invertida leve com botas de inversão.',
    'Inversão parcial (30°-45°) por 2-3 minutos, 1× ao dia, descomprime a coluna. Contraindicado em hipertensão, glaucoma, gravidez.', 'exercise', 2, 'anecdotal', 5, 'medium', SYM,
    { risk: 0.3, disclaimer: 'Procedimento com risco em hipertensos, glaucoma, gravidez. Não usar sem orientação médica em quadros pré-existentes.' }),
  ex('routine-218-epicranial-fascia-release', 'Liberação da fáscia epicraniana (couro cabeludo).',
    'Massagem firme do couro cabeludo com as pontas dos dedos por 2 minutos, 1× ao dia. Libera fáscia que conecta frontal-parietal-occipital — afeta tensão facial em cadeia.', 'exercise', 2, 'anecdotal', 4, 'low', FOREHEAD),
  ex('routine-219-yes-no-maybe-neck', 'Mobilidade dinâmica do pescoço "sim-não-talvez".',
    'Movimentos lentos de afirmação (sim), negação (não) e talvez (lateral); 10 ciclos cada, 2× ao dia. Mantém amplitude articular em todas as direções.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-220-splenius-trigger-points', 'Desativação de pontos gatilho no esplênio da cabeça.',
    'Pressão sustentada de 30-60s sobre trigger points laterais à coluna cervical alta. Esplênio tenso causa cefaleia tensional e torção crônica.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-221-psoas-stretch', 'Alongamento de psoas (afeta postura torácica).',
    'Em apoio de joelho (posição cavalheiro), avance o quadril e mantenha 30s cada lado. Psoas encurtado puxa a coluna anteriormente — afeta postura facial em cadeia.', 'exercise', 2, 'moderate', 3, 'medium', SYM),
  ex('routine-222-thoracic-extension-bench', 'Extensão torácica no banco.',
    'Sentado, mãos atrás da cabeça, estenda a coluna torácica em direção ao teto; 10 repetições, 2× ao dia. Combate cifose torácica que arrasta cabeça para frente.', 'exercise', 2, 'moderate', 3, 'low', SYM),
  ex('routine-223-scapular-positioning', 'Reposicionamento escapular constante ("ombros no bolso").',
    'Lembrete consciente de retrair levemente as escápulas para baixo e para trás várias vezes ao dia. Cria memória postural progressiva.', 'lifestyle', 1, 'moderate', 3, 'low', SYM),
  ex('routine-224-double-chin-wall-rotation', 'Queixo duplo na parede com rotação leve.',
    'De costas para a parede, encoste occipital e faça queixo duplo; gire suavemente o queixo para um lado, segure 5s. Trabalha extensores cervicais profundos com componente rotacional.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-225-walking-horizon-gaze', 'Caminhar com olhar no horizonte.',
    'Durante caminhadas diárias, mantenha o olhar fixo no horizonte (não no chão ou celular). Mantém pescoço em extensão neutra e coluna alinhada.', 'lifestyle', 1, 'moderate', 3, 'low', SYM),

  // ════════════════════ MIOTERAPIA / LÁBIOS / LÍNGUA (226-250) ════════════════════
  ex('routine-226-tongue-scraper-copper', 'Raspador de língua de cobre diário.',
    'Limpar a língua com raspador de cobre (Ayurveda) toda manhã. Reduz biofilme e estimula propriocepção lingual; benefício colateral para hálito.', 'lifestyle', 1, 'moderate', 4, 'low', MOUTH),
  ex('routine-227-waterpik-night', 'Waterpik (irrigação oral) noturno.',
    'Jato de água sob pressão para limpeza interdental e gengival após escovação; 1× à noite. Saúde periodontal afeta diretamente aparência da boca.', 'lifestyle', 1, 'strong', 3, 'low', MOUTH),
  ex('routine-228-oil-pulling', 'Bochecho com óleo de coco matinal (oil pulling).',
    'Bochechar 1 colher de sopa de óleo de coco virgem por 10-15 minutos em jejum, então cuspir (não engolir). Tradição ayurvédica — sem RCT robusto para estética.', 'lifestyle', 1, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-229-tongue-suction-no-cheek', 'Sucção lingual no palato sem vácuo nas bochechas.',
    'Aspirar a língua para o palato isolando as bochechas (sem encavar bochechas). 10 repetições, 1× ao dia. Refinamento técnico do mewing avançado.', 'exercise', 2, 'anecdotal', 4, 'low', [...MOUTH, 'middle_third_ratio']),
  ex('routine-230-licorice-root-chew', 'Mastigar raiz de alcaçuz (alternativa natural a resinas).',
    'Mastigar raiz de alcaçuz (Glycyrrhiza glabra) 10-15 minutos por dia. Mais leve que mastic gum; tradição antiga em fitoterapia.', 'exercise', 2, 'anecdotal', 5, 'low', JAW),
  ex('routine-231-tmj-warm-compress', 'Massagem na ATM com calor seco (bolsa de gel).',
    'Aplicar bolsa térmica seca sobre a ATM por 10 minutos, então massagem circular suave. Coadjuvante em DTM com tensão dolorosa.', 'lifestyle', 1, 'moderate', 3, 'low', JAW),
  ex('routine-232-tongue-floor-relax', 'Relaxamento consciente da língua no assoalho da boca (contraste).',
    'Após exercícios de mewing, deixe a língua repousar relaxada no assoalho por 1 minuto. Equilibra tônus e evita compensação por hiperativação.', 'exercise', 2, 'moderate', 4, 'low', MOUTH),
  ex('routine-233-loud-articulated-reading', 'Leitura em voz alta excessivamente articulada.',
    'Ler em voz alta 5 minutos por dia exagerando a articulação. Trabalho funcional integrado de lábios, língua, palato e tônus respiratório.', 'exercise', 2, 'moderate', 4, 'low', MOUTH),
  ex('routine-234-tongue-lateral-expansion', 'Expansão lateral da língua contra os molares.',
    'Pressionar a língua lateralmente contra a face interna dos molares por 10 segundos cada lado; 5 ciclos. Estímulo para crescimento lingual e propriocepção lateral.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-235-button-floss-lip-seal', 'Selamento labial com botão preso a fio dental.',
    'Posicionar botão entre lábios e dentes; manter selamento por 1-2 minutos contra leve tração do fio. Trabalha orbicular da boca por resistência.', 'exercise', 2, 'moderate', 4, 'low', MOUTH),
  ex('routine-236-shower-cheek-puff', 'Bochecho inflado bilateral no chuveiro.',
    'Encher as bochechas de ar bilateralmente e segurar por 30s; repetir várias vezes durante o banho. Trabalha buccinador e elasticidade da mucosa.', 'exercise', 2, 'anecdotal', 5, 'low', CHEEK),
  ex('routine-237-jaw-thumb-slide', 'Polegares deslizando sob a linha da mandíbula.',
    'Deslize firme dos polegares de baixo para cima ao longo da mandíbula, 3 ciclos cada lado. Reduz acumulação linfática submandibular.', 'lifestyle', 1, 'anecdotal', 4, 'low', JAW),
  ex('routine-238-upper-lip-frenum-massage', 'Massagem longitudinal no frênulo labial superior.',
    'Movimentos suaves verticais no frênulo entre lábio superior e gengiva por 1 minuto. Pode auxiliar mobilidade labial em casos de frênulo curto.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-239-spoon-resistance-lip-seal', 'Selamento labial contra colher de chá.',
    'Manter colher entre os lábios apenas com força labial (sem dentes) por 1-2 minutos; aumentar progressivamente. Versão acessível de exercícios fonoaudiológicos.', 'exercise', 2, 'moderate', 4, 'low', MOUTH),
  ex('routine-240-lip-trill', 'Vibração labial sustentada (lip trill).',
    'Soprar mantendo lábios vibrando ("brrr") por 30 segundos, 5 ciclos. Relaxa tensão perioral e equilibra fluxo expiratório.', 'exercise', 2, 'moderate', 4, 'low', MOUTH),
  ex('routine-241-cork-jaw-stretch', 'Alongamento maxilar com rolhas de cortiça (P/M/G).',
    'Sustentar rolhas de tamanho progressivo entre os dentes por 5 minutos, 2× ao dia, em casos de mobilidade mandibular reduzida (trismo leve).', 'exercise', 2, 'moderate', 5, 'low', JAW,
    { disclaimer: 'Não usar em casos de DTM aguda ou estalo articular com dor. Em dúvida, suspender e consultar fisioterapeuta orofacial.' }),
  ex('routine-242-medial-pterygoid-release', 'Liberação intraoral do pterigóideo medial.',
    'Com luva, polegar acessa a região medial da mandíbula por dentro da boca e pressiona o pterigóideo medial; 30s cada lado. Trigger point comum em DTM.', 'exercise', 2, 'moderate', 5, 'low', JAW),
  ex('routine-243-chin-fist-isometric', 'Isometria do queixo contra punho fechado.',
    'Punho fechado sob o mento, tentar abrir a boca contra a resistência por 5s; 10 repetições, 1× ao dia. Trabalha músculos suprahioides.', 'exercise', 2, 'moderate', 4, 'low', JAW),
  ex('routine-244-mandible-infinity-closed', 'Movimento mandibular em "infinito" com boca fechada.',
    'Desenhe um "8" lento com a mandíbula mantendo os lábios selados; 10 ciclos, 2× ao dia. Mobiliza ATM em todos os planos.', 'exercise', 2, 'moderate', 4, 'low', JAW),
  ex('routine-245-fake-smile-swallow', 'Deglutição com sorriso forçado.',
    'Engolir saliva mantendo sorriso fixo (lábios afastados, dentes leves em contato). Isola força lingual da musculatura perioral.', 'exercise', 2, 'moderate', 5, 'low', MOUTH),
  ex('routine-246-pursed-lip-breathing', 'Respiração com lábios franzidos.',
    'Inspirar pelo nariz, expirar pelos lábios franzidos como soprando vela por 6 segundos; 10 ciclos, 1× ao dia. Padrão respiratório indicado em DPOC e relaxamento.', 'exercise', 2, 'strong', 3, 'low', [...NOSE, ...MOUTH]),
  ex('routine-247-frog-floor-mouth', 'Exercício do "sapo" — inflar assoalho da boca.',
    'Encher de ar a região sob a língua/assoalho bucal e segurar por 10s. Trabalha musculatura submentual em padrão pouco usual.', 'exercise', 2, 'anecdotal', 5, 'low', ['chin_height_ratio', 'lower_third_ratio']),
  ex('routine-248-tongue-vestibule-rotation', 'Rotação lenta da língua no vestíbulo oral.',
    'Língua percorre lentamente a face vestibular dos dentes superiores e depois inferiores em movimento circular; 10 ciclos cada arco. Tônus lingual + propriocepção.', 'exercise', 2, 'moderate', 4, 'low', MOUTH),
  ex('routine-249-cheek-detach-conscious', 'Descolamento consciente das bochechas dos dentes.',
    'Lembrete múltiplas vezes ao dia para soltar a bochecha pressionada contra os dentes (hábito comum de quem aperta a face). Reduz indentação dental.', 'lifestyle', 1, 'anecdotal', 5, 'low', CHEEK),
  ex('routine-250-gum-massage-silicone', 'Massagem gengival com dedeira de silicone.',
    'Massagem circular suave nas gengivas por 1 minuto após escovação. Estímulo de circulação periodontal — coadjuvante em prevenção de retração gengival.', 'lifestyle', 1, 'moderate', 4, 'low', MOUTH),

  // ════════════════════ SKINCARE AVANÇADO (251-275) ════════════════════
  ex('routine-251-lactic-acid-weekly', 'Aplicação semanal de ácido láctico.',
    'AHA mais suave que glicólico — esfoliação + hidratação simultâneas, 1× por semana. Boa porta de entrada em ácidos para peles sensíveis.', 'lifestyle', 1, 'strong', 3, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-252-zinc-mineral-spf', 'Protetor solar físico/mineral à base de zinco.',
    'Filtros físicos (óxido de zinco/titânio) são a opção segura para peles sensíveis, gestantes e crianças. Alternativa aos químicos.', 'lifestyle', 1, 'strong', 2, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-253-salicylic-toner-tzone', 'Tônico de ácido salicílico na zona T.',
    'BHA específico para zona T oleosa (testa, nariz, queixo); 1-2× por semana. Penetra poro lipídico — ideal para acne comedônica.', 'lifestyle', 1, 'strong', 3, 'low', [...NOSE, ...FOREHEAD], { risk: 0.1 }),
  ex('routine-254-benzoyl-peroxide-spot', 'Tratamento localizado com peróxido de benzoíla.',
    'Aplicação spot de BPO 2.5-5% em lesões inflamatórias de acne. Antibacteriano + comedolítico. Iniciar em concentração baixa.', 'lifestyle', 1, 'strong', 3, 'low', [...CHEEK, ...FOREHEAD], { risk: 0.2,
    disclaimer: 'Pode descolorir tecidos (toalhas, fronhas). Pele extremamente irritada deve interromper. Combinar com FPS — aumenta fotossensibilidade.' }),
  ex('routine-255-copper-peptide-serum', 'Sérum diário de peptídeos de cobre.',
    'Tripeptídeo GHK-Cu — estimula colágeno e cicatrização. Evidência crescente em literatura dermatológica.', 'lifestyle', 1, 'moderate', 4, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-256-rosehip-oil-night', 'Óleo de rosa mosqueta noturno alternado.',
    'Rico em ácidos graxos essenciais e vitamina A natural. Alternativa noturna leve para hidratação + reparo.', 'lifestyle', 1, 'moderate', 4, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-257-thermal-water-selenium', 'Spray de água termal rica em selênio.',
    'Águas termais (Avène, La Roche-Posay) acalmam pele reativa. Uso ao longo do dia, especialmente após sol ou exposição a poluentes.', 'lifestyle', 1, 'anecdotal', 5, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-258-bifasic-micellar', 'Limpeza facial com água micelar bifásica.',
    'Bifásica (óleo + água) remove maquiagem resistente sem fricção. Etapa 1 da rotina dupla de limpeza (double cleanse).', 'lifestyle', 1, 'moderate', 4, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-259-enzymatic-foam-cleanser', 'Espuma de limpeza enzimática (papaína/abacaxi).',
    'Limpeza + esfoliação enzimática suave em peles que não toleram ácidos. Uso 2-3× por semana.', 'lifestyle', 1, 'moderate', 4, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-260-hot-cold-towel-therapy', 'Terapia de choque facial alternada (toalhas quente/fria).',
    'Toalha quente 30s → toalha fria 30s, 3 ciclos. Estímulo vasomotor — efeito tônico imediato. Tradição estética antiga.', 'lifestyle', 1, 'anecdotal', 5, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-261-hypochlorous-acid-spray', 'Borrifar ácido hipocloroso pós-treino.',
    'Tônico antimicrobiano natural produzido pelo próprio organismo (forma sintetizada). Indicado pós-suor para evitar acne mecânica.', 'lifestyle', 1, 'moderate', 5, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-262-cica-centella', 'Extrato de Centella Asiática (Cica) para vermelhidão.',
    'Acalma rosácea e dermatite. Ingrediente coreano popularizado globalmente — RCTs pequenos com efeito anti-inflamatório.', 'lifestyle', 1, 'moderate', 4, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-263-microneedle-eye-patches', 'Patches de microagulhas descartáveis para olheiras.',
    'Patches com microagulhas dissolvíveis (peptídeos + cafeína) entregam ativos no contorno dos olhos. 1-2× por semana.', 'lifestyle', 1, 'moderate', 4, 'low', EYES, { risk: 0.1 }),
  ex('routine-264-hydrogel-mask-cold', 'Máscara facial de hidrogel calmante de geladeira.',
    'Máscara hidrogel mantida em geladeira — efeito "ice facial" por 20 minutos com ativos hidratantes. Pré-eventos importantes.', 'lifestyle', 1, 'anecdotal', 5, 'low', [...CHEEK, ...EYES]),
  ex('routine-265-filtered-water-rinse', 'Enxágue facial com água filtrada (vs água dura).',
    'Água dura (rica em cálcio/magnésio) deixa resíduo na pele. Filtro de chuveiro ou água engarrafada para enxágue final pode reduzir irritação crônica.', 'lifestyle', 1, 'anecdotal', 5, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-266-paper-towel-drying', 'Secagem facial exclusiva com lenços de papel descartáveis.',
    'Toalhas de pano acumulam bactérias entre lavagens. Lenços descartáveis evitam contaminação para peles propensas a acne.', 'lifestyle', 1, 'anecdotal', 5, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-267-glycerin-boost', 'Adicionar glicerina vegetal pura ao hidratante.',
    'Umectante econômico — 5% no creme habitual aumenta hidratação. DIY clássico de skincare.', 'lifestyle', 1, 'moderate', 5, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-268-caffeine-topical-eye', 'Cafeína tópica 5% no contorno dos olhos.',
    'Vasoconstrictor — reduz olheiras de causa vascular. Aplicar pela manhã. Eficácia maior em olheiras tipo I (vasculares).', 'lifestyle', 1, 'moderate', 3, 'low', EYES),
  ex('routine-269-alpha-arbutin-pigmentation', 'Sérum de alfa-arbutin para hiperpigmentação.',
    'Despigmentante mais suave que hidroquinona, sem fotossensibilidade. 12-16 semanas para efeito visível.', 'lifestyle', 1, 'moderate', 4, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-270-mandelic-acid-spots', 'Tratamento tópico com ácido mandélico.',
    'AHA de molécula maior — penetra mais lento, ideal para peles sensíveis com manchas. Uso noturno alternado.', 'lifestyle', 1, 'moderate', 4, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-271-konjac-sponge', 'Esfoliação suave com esponja Konjac.',
    'Fibra natural vegetal extremamente suave. Limpeza diária + esfoliação mecânica leve em peles intolerantes a outros métodos.', 'lifestyle', 1, 'anecdotal', 5, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-272-glycolic-7-glow', 'Aplicação contínua de ácido glicólico 7% (glow polish).',
    'Concentração baixa diária para efeito de polimento contínuo. Combina com vitamina C matinal.', 'lifestyle', 1, 'strong', 3, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-273-spf-lip-balm', 'Protetor solar labial específico (SPF 30+) diário.',
    'Lábios são pele sem melanina — fotodano e câncer labial são reais. Hidratante labial com FPS é base de proteção.', 'lifestyle', 1, 'strong', 2, 'low', [...MOUTH]),
  ex('routine-274-neck-retinol', 'Retinol específico para pescoço.',
    'A pele cervical envelhece como a facial mas raramente recebe ativos. Retinol específico (formulação para pescoço) previne "tech neck wrinkles".', 'lifestyle', 1, 'moderate', 4, 'low', [...JAW], { risk: 0.1,
    disclaimer: 'Mesmas restrições do retinol facial — gestação, lactação, irritação inicial. Nunca aplicar antes do sol sem FPS.' }),
  ex('routine-275-gold-mask-pre-event', 'Máscara de ouro 24k antioxidante pré-evento.',
    'Folha de ouro coloidal com antioxidantes — efeito visual imediato (luminosidade) por horas. Skincare de evento.', 'lifestyle', 1, 'anecdotal', 5, 'low', [...CHEEK, ...FOREHEAD]),

  // ════════════════════ DIETA / SUPLEMENTAÇÃO (276-300) ════════════════════
  ex('routine-276-magnesium-glycinate-night', 'Magnésio glicinato noturno.',
    '300-400mg de magnésio glicinato à noite. Forma altamente biodisponível — relaxamento muscular, sono profundo, redução de bruxismo.', 'lifestyle', 1, 'moderate', 3, 'low', [...JAW, ...EYES]),
  ex('routine-277-vitamin-k2-mk7', 'Suplementação diária de Vitamina K2 (MK-7).',
    'K2 direciona cálcio para ossos e dentes (em vez de tecidos moles e artérias). Pode ter papel em manutenção da estrutura óssea facial. Combinar com vitamina D3.', 'lifestyle', 1, 'moderate', 4, 'low', [...JAW, ...FACE_SHAPE]),
  ex('routine-278-bone-broth', 'Caldo de ossos diário (bone broth).',
    'Rico em colágeno tipo I, II e III + glicina. Tradição milenar; estudos modernos sugerem benefício articular e cutâneo.', 'lifestyle', 1, 'moderate', 5, 'low', [...CHEEK, ...JAW]),
  ex('routine-279-low-carb-cycle', 'Redução cíclica drástica de carboidratos refinados.',
    'Períodos curtos (2-4 semanas) de restrição de carboidratos refinados. Reduz inflamação sistêmica e edema crônico — aparece na face em poucos dias.', 'lifestyle', 1, 'moderate', 4, 'medium', [...CHEEK, ...EYES]),
  ex('routine-280-aip-protocol', 'Protocolo AIP (dieta autoimune anti-inflamatória).',
    'Fase de eliminação rigorosa (30-60 dias) seguida de reintrodução controlada. Em pessoas com inflamação subclínica, pode mudar dramaticamente o aspecto facial.', 'lifestyle', 1, 'moderate', 5, 'high', [...CHEEK, ...EYES],
    { disclaimer: 'Protocolo restritivo de longa duração — idealmente acompanhado por nutricionista. Não recomendado em transtornos alimentares.' }),
  ex('routine-281-acv-lemon-morning', 'Vinagre de maçã + limão matinal.',
    '1 colher de vinagre de maçã + suco de meio limão em água ao acordar. Tradição naturopata — evidência limitada, mas sem riscos para a maioria.', 'lifestyle', 1, 'anecdotal', 5, 'low', [...CHEEK]),
  ex('routine-282-green-tea-extract', 'Extrato de chá verde em cápsulas.',
    'EGCG concentrado — antioxidante potente. Possível benefício em fotoenvelhecimento e inflamação crônica.', 'lifestyle', 1, 'moderate', 4, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-283-astaxanthin-cyclic', 'Astaxantina cíclica (12 semanas on / 4 off).',
    'Carotenoide marinho — fotoprotetor sistêmico, reduz fotoenvelhecimento. Estudo japonês de 12 semanas mostrou redução de rugas perioculares.', 'lifestyle', 1, 'moderate', 4, 'low', [...CHEEK, ...EYES]),
  ex('routine-284-raw-ginger-chew', 'Mastigar gengibre cru diariamente.',
    'Anti-inflamatório natural + estímulo digestivo. Mastigação adicional contribui para tônus mandibular.', 'lifestyle', 1, 'moderate', 5, 'low', [...JAW]),
  ex('routine-285-no-beer-fermented-alcohol', 'Restrição absoluta de cerveja e álcool fermentado.',
    'Cerveja causa edema facial em pessoas sensíveis a glúten e levedura. Eliminação de 30 dias revela impacto individual.', 'lifestyle', 1, 'moderate', 3, 'medium', [...CHEEK, ...EYES]),
  ex('routine-286-msm-supplementation', 'Suplementação diária de MSM (enxofre orgânico).',
    'Cofator para síntese de colágeno e queratina. RCTs pequenos sugerem benefício em pele e articulações.', 'lifestyle', 1, 'moderate', 5, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-287-pumpkin-seeds-toasted', 'Sementes de abóbora tostadas na dieta.',
    'Ricas em zinco, magnésio e ácidos graxos. Nutrientes-chave para pele, cabelo e cicatrização.', 'lifestyle', 1, 'moderate', 5, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-288-gluten-casein-elimination', 'Ciclo temporário de eliminação de glúten + caseína.',
    '30 dias sem glúten e laticínios para identificar sensibilidade subclínica. Pessoas reativas mostram melhora em edema, acne e olheiras.', 'lifestyle', 1, 'anecdotal', 5, 'medium', [...CHEEK, ...EYES]),
  ex('routine-289-bromelain-post-procedure', 'Bromelina pós-procedimentos ou lesões leves.',
    'Enzima do abacaxi — efeito anti-inflamatório e redutor de edema. Útil pós-treino intenso ou procedimento estético.', 'lifestyle', 1, 'moderate', 5, 'low', [...CHEEK, ...EYES]),
  ex('routine-290-no-artificial-sweeteners', 'Eliminação total de adoçantes artificiais.',
    'Aspartame, sucralose e outros podem desregular microbiota e causar inflamação subclínica. Substituir por estévia ou eliminar.', 'lifestyle', 1, 'moderate', 5, 'medium', [...CHEEK, ...EYES]),
  ex('routine-291-kefir-kombucha', 'Kefir ou kombucha diariamente.',
    'Probióticos naturais — eixo intestino-pele. Microbiota saudável reduz inflamação cutânea crônica.', 'lifestyle', 1, 'moderate', 4, 'low', [...CHEEK, ...FOREHEAD]),
  ex('routine-292-decaf-coffee-mix', 'Substituir parte do café tradicional por descafeinado.',
    'Cafeína em excesso aumenta cortisol — afeta sono, edema e qualidade de pele. Mix 50/50 reduz carga sem retirada brusca.', 'lifestyle', 1, 'moderate', 5, 'low', [...CHEEK, ...EYES]),
  ex('routine-293-cardamom-clove-post-meal', 'Mastigar cardamomo ou cravo pós-refeição.',
    'Tradição ayurvédica — digestivo + halitose. Mastigação adicional contribui para tônus mandibular.', 'lifestyle', 1, 'anecdotal', 5, 'low', [...JAW]),
  ex('routine-294-soy-non-fermented-reduction', 'Redução de soja não-fermentada.',
    'Isoflavonas em excesso podem afetar equilíbrio hormonal. Soja fermentada (missô, tempeh) tem perfil seguro.', 'lifestyle', 1, 'anecdotal', 5, 'medium', [...CHEEK]),
  ex('routine-295-creatine-pause-test', 'Pausa estratégica de creatina para teste de retenção.',
    'Creatina retém ~1L de água intramuscular — efeito visível na face. 2 semanas off mostram baseline real para fotos comparativas.', 'lifestyle', 1, 'moderate', 5, 'low', [...CHEEK, ...EYES]),
  ex('routine-296-watermelon-melon', 'Aumentar consumo de melancia e melão.',
    'Frutas com alta hidratação + L-citrulina (em melancia) = vasodilatação + drenagem. Coadjuvante anti-edema diário.', 'lifestyle', 1, 'moderate', 5, 'low', [...CHEEK, ...EYES]),
  ex('routine-297-vitamin-d3-with-fat', 'Vitamina D3 cíclica com lipídios.',
    'Vitamina D lipossolúvel — absorção depende de gordura na refeição. Deficiência causa palidez, fadiga, baixa vitalidade aparente.', 'lifestyle', 1, 'strong', 3, 'low', [...CHEEK, ...EYES]),
  ex('routine-298-igg-ige-blood-test', 'Teste sanguíneo de IgG/IgE para intolerâncias ocultas.',
    'Identifica reatividade alimentar subclínica. Resultado guia eliminação direcionada — mais eficiente que dietas de eliminação às cegas.', 'professional_referral', 4, 'moderate', 4, 'medium', [...CHEEK, ...EYES],
    { requiresProfessional: true, professionalType: 'dermatologist', risk: 0.1, severities: ['moderate', 'strong'] }),
  ex('routine-299-no-carbs-4h-pre-sleep', 'Jejum de carboidratos 4h antes do sono.',
    'Carboidratos noturnos elevam insulina + cortisol noturno = sono ruim + edema matinal. Última refeição idealmente low-carb.', 'lifestyle', 1, 'moderate', 4, 'medium', [...CHEEK, ...EYES]),
  ex('routine-300-oral-rehydration-salts', 'Sais de reidratação oral matinal.',
    'Eletrólitos balanceados (Na+K+Cl+glicose) — reidratação celular eficiente após noite de jejum hídrico.', 'lifestyle', 1, 'strong', 4, 'low', [...CHEEK, ...EYES]),

  // ════════════════════ OLHOS / SOBRANCELHAS (301-325) ════════════════════
  ex('routine-301-squinch-training', 'Treino de "squinch" (tensionar pálpebra inferior).',
    'Subir leve e voluntariamente a pálpebra inferior, mantendo a superior aberta. Cria expressão "Hunter Eyes" — popular em fotografia.', 'exercise', 2, 'anecdotal', 4, 'low', EYES),
  ex('routine-302-castor-oil-brows-lashes', 'Óleo de rícino noturno em sobrancelhas e cílios.',
    'Aplicar óleo de rícino puro com cotonete antes de dormir. Tradição popular — RCTs ausentes mas sem riscos relatados.', 'lifestyle', 1, 'anecdotal', 4, 'low', [...BROWS, ...EYES]),
  ex('routine-303-brow-gel-direction', 'Gel fixador direcional para sobrancelhas.',
    'Pentear sobrancelhas para cima/lateralmente com gel transparente e fixar. Técnica diária para desenho consistente.', 'styling', 3, 'moderate', 3, 'low', BROWS),
  ex('routine-304-eyelid-tape', 'Fitas invisíveis de levantamento palpebral.',
    'Fitas de elevação palpebral (técnica usada em K-pop) criam vinco temporário ou levantam ptose leve. Solução cosmética reversível.', 'styling', 3, 'anecdotal', 5, 'low', EYES,
    { disclaimer: 'Adesivo pode causar irritação periocular em pele sensível. Não usar diariamente sem alternar pausas.' }),
  ex('routine-305-brow-lamination-monthly', 'Manutenção mensal de brow lamination.',
    'Procedimento estético mensal que alinha pelos da sobrancelha em direção uniforme. Efeito ~6 semanas.', 'styling', 3, 'moderate', 4, 'low', BROWS, { risk: 0.15 }),
  ex('routine-306-brow-flat-horizontal', 'Design de sobrancelha em base reta horizontal.',
    'Sobrancelha mais reta horizontalmente — alarga e suaviza traços. Adequado para rostos longos.', 'styling', 3, 'moderate', 4, 'low', BROWS),
  ex('routine-307-brow-arched-elevated', 'Design de sobrancelha com arco elevado.',
    'Arco mais pronunciado — afina rostos largos e cria foco vertical. Adequado para rostos largos/redondos.', 'styling', 3, 'moderate', 4, 'low', BROWS),
  ex('routine-308-chamomile-cold-eye-compress', 'Compressas geladas de chá de camomila.',
    'Chá de camomila resfriado em sachês ou bolas de algodão sobre os olhos por 10 min. Anti-inflamatório suave + frio = redução de edema.', 'lifestyle', 1, 'anecdotal', 5, 'low', EYES),
  ex('routine-309-lacrimal-canal-massage', 'Massagem circular no canal lacrimal.',
    'Movimentos circulares suaves no canto interno dos olhos — ajuda drenagem de obstruções leves do ducto.', 'exercise', 2, 'moderate', 4, 'low', EYES),
  ex('routine-310-uv400-sunglasses', 'Óculos escuros com proteção UV400 sempre que sol.',
    'Proteção UV total previne fotoenvelhecimento periorbital + reduz hábito de apertar os olhos. Essencial em qualquer rotina facial.', 'lifestyle', 1, 'strong', 2, 'low', [...EYES, ...FOREHEAD]),
  ex('routine-311-remove-heavy-eyelash-extensions', 'Remover extensões pesadas de cílios.',
    'Extensões prolongadas causam queda real dos cílios próprios e tensão palpebral. Pausas regulares preservam cílios.', 'lifestyle', 1, 'moderate', 4, 'low', EYES),
  ex('routine-312-lash-tinting', 'Tingimento profissional de cílios.',
    'Alternativa a rímel diário — tingimento profissional dura 4-6 semanas, reduz manipulação ocular crônica.', 'styling', 3, 'moderate', 4, 'low', EYES),
  ex('routine-313-eyelid-margin-cleansing', 'Desinfecção diária das margens palpebrais.',
    'Espumas específicas (Blephadex, Naviblef) limpam glândulas de Meibomius. Previne blefarite e olho seco crônicos.', 'lifestyle', 1, 'moderate', 4, 'low', EYES),
  ex('routine-314-no-eye-rubbing', 'Protocolo rígido de não esfregar os olhos.',
    'Fricção crônica afeta integridade corneana, aumenta risco de queratocone e marca a pele periocular. Hábito a quebrar conscientemente.', 'lifestyle', 1, 'strong', 2, 'low', EYES),
  ex('routine-315-bimatoprost-serum', 'Sérum de bimatoprosta (uso controlado).',
    'Análogo de prostaglandina aprovado para crescimento de cílios (Latisse). Off-label para sobrancelhas. Usar com supervisão dermatológica.', 'lifestyle', 1, 'moderate', 5, 'low', EYES,
    { risk: 0.3, requiresProfessional: true, professionalType: 'dermatologist',
    disclaimer: 'Pode causar pigmentação periorbital, hiperpigmentação iriana (em olhos claros) e crescimento de pelos onde aplicado. Uso só com prescrição.' }),
  ex('routine-316-figure-8-eye-tracking', 'Movimento ocular em "figura 8" lento.',
    'Olhos seguem desenho de "8" no ar lentamente; 5 ciclos cada direção. Mobilidade oculomotora completa.', 'exercise', 2, 'moderate', 4, 'low', EYES),
  ex('routine-317-near-far-focus-shift', 'Foco alternado nariz/horizonte.',
    'Olhar para o polegar perto do nariz por 2s, depois horizonte por 2s; 10 ciclos. Treina acomodação cristaliniana.', 'exercise', 2, 'moderate', 4, 'low', EYES),
  ex('routine-318-orthoptic-blind-spot', 'Exercício ortóptico de ponto cego periférico.',
    'Exercício clínico de visão periférica — olhar de canto a canto sem mover a cabeça. Útil em terapia ortóptica.', 'exercise', 2, 'moderate', 5, 'low', EYES),
  ex('routine-319-orbicularis-passive-stretch', 'Alongamento passivo do orbicular.',
    'Polegares deslizam delicadamente para fora dos olhos no sentido temporal por 30s. Suaviza tensão crônica do músculo.', 'exercise', 2, 'anecdotal', 4, 'low', EYES),
  ex('routine-320-thick-glasses-to-contacts', 'Lentes de contato em vez de óculos pesados.',
    'Óculos de grau alto deixam marca visível no nariz, distorcem percepção dos olhos. Lentes diárias resolvem em dias.', 'styling', 3, 'moderate', 3, 'low', [...EYES, ...NOSE]),
  ex('routine-321-cylindrical-correction', 'Correção visual com lentes cilíndricas adequadas.',
    'Astigmatismo não-corrigido causa fadiga ocular crônica + entortar olhos para focar. Correção precisa elimina o problema.', 'professional_referral', 4, 'strong', 3, 'medium', EYES,
    { requiresProfessional: true, professionalType: 'otolaryngologist' }),
  ex('routine-322-zygoma-temporal-slide', 'Massagem deslizante zigomática para a têmpora superior.',
    'Polegares sob os zigomáticos, deslizando ascendentemente para a têmpora; 1 minuto cada lado. Lifting manual temporário.', 'exercise', 2, 'anecdotal', 5, 'low', CHEEK),
  ex('routine-323-weighted-sleep-mask', 'Máscara de dormir ponderada.',
    'Máscara com 200-300g de peso — pressão suave reduz movimentos oculares e melhora sono profundo.', 'lifestyle', 1, 'anecdotal', 4, 'low', EYES),
  ex('routine-324-bathroom-led-lighting', 'Substituir lâmpadas do banheiro por LED frio diurno.',
    'Lâmpada incandescente quente engana percepção de cor e tons da pele. LED 5000K (luz do dia) revela a pele real.', 'lifestyle', 1, 'moderate', 4, 'low', ALL_FACIAL),
  ex('routine-325-fox-eye-makeup', 'Técnica de delineamento "Fox Eye".',
    'Linha alongada para cima nas extremidades dos olhos — efeito visual de "Hunter Eyes". Reversível, custo zero.', 'styling', 3, 'moderate', 4, 'low', EYES),

  // ════════════════════ STYLING AVANÇADO (326-350) ════════════════════
  ex('routine-326-fade-haircut-brow-line', 'Corte "Fade" alinhado à altura da sobrancelha.',
    'Fade reto na altura exata da sobrancelha cria moldura simétrica para o rosto.', 'styling', 3, 'moderate', 4, 'low', [...FOREHEAD, ...BROWS]),
  ex('routine-327-beard-neckline-position', 'Linha cervical da barba a 2 dedos acima do pomo de Adão.',
    'Padrão estético de barbeiros — define a transição rosto/pescoço sem cortar muito alto (parece pescoço gordo) nem baixo (parece desleixo).', 'styling', 3, 'moderate', 4, 'low', JAW),
  ex('routine-328-mustache-darker-than-beard', 'Bigode escurecido mais intensamente que a barba.',
    'Truque de visagismo — bigode mais escuro destaca o lábio superior e cria foco horizontal.', 'styling', 3, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-329-nose-hair-trimming', 'Aparo semanal de pelos nasais excedentes.',
    'Pelos nasais visíveis quebram completamente harmonia facial. Tesoura específica ou aparador semanal.', 'styling', 3, 'strong', 2, 'low', NOSE),
  ex('routine-330-cheek-line-diagonal', 'Cheek line da barba em linha diagonal perfeita.',
    'Linha diagonal limpa da barba na bochecha — visual mais sharp/anguloso.', 'styling', 3, 'moderate', 4, 'low', JAW),
  ex('routine-331-cheek-line-curve', 'Cheek line da barba em curva suave.',
    'Curva suave em vez de linha reta — visual mais orgânico, indicado para rostos angulosos.', 'styling', 3, 'moderate', 4, 'low', JAW),
  ex('routine-332-texturizing-powder-roots', 'Pó texturizador na raiz superior do cabelo.',
    'Aplicar pó texturizador (Schwarzkopf Got2b, etc.) na raiz para volume vertical em cabelos finos. Alonga rosto.', 'styling', 3, 'moderate', 4, 'low', [...FOREHEAD, ...FACE_SHAPE]),
  ex('routine-333-beard-greys-tinting', 'Matização específica para fios brancos da barba.',
    'Tinturas específicas (Just for Men) para uniformizar barba com fios brancos esparsos. Discreto e duradouro.', 'styling', 3, 'moderate', 4, 'low', JAW),
  ex('routine-334-beard-matte-balm', 'Cera/balm de barba com efeito matte.',
    'Acabamento fosco em vez de brilhante — mais natural e moderno. Manteiga de karité + cera de candelilla.', 'styling', 3, 'moderate', 5, 'low', JAW),
  ex('routine-335-baby-hair-removal-front', 'Depilação química/laser dos baby hairs frontais.',
    'Penugem na linha frontal capilar pode dar aspecto "felpudo" em fotos. Depilação a laser elimina permanentemente.', 'styling', 3, 'moderate', 5, 'low', FOREHEAD, { risk: 0.15 }),
  ex('routine-336-asymmetric-hair-part', 'Inverter o lado da divisão do cabelo conforme assimetria facial.',
    'Cabelo dividido para o lado dominante (mais "alto") da face equilibra assimetria visual. Reversível diariamente.', 'styling', 3, 'moderate', 4, 'low', SYM),
  ex('routine-337-dark-turtleneck', 'Camisas/blusas com gola rolê escura.',
    'Gola rolê escura cria moldura limpa e enquadra o rosto. Truque visagista clássico — alonga pescoço, destaca traços.', 'styling', 3, 'moderate', 4, 'low', [...FACE_SHAPE]),
  ex('routine-338-shirt-collar-jaw-width', 'Colarinho proporcional à largura do maxilar.',
    'Colarinho largo demais "engole" mandíbulas finas; estreito demais sobrecarrega rostos largos. Equilíbrio visual.', 'styling', 3, 'moderate', 5, 'low', JAW),
  ex('routine-339-small-stud-earrings', 'Brincos pequenos como ponto de luz zigomático.',
    'Brincos pequenos, brilhantes, alinhados com as maçãs — desviam o olhar para o terço médio.', 'styling', 3, 'moderate', 5, 'low', CHEEK),
  ex('routine-340-long-thin-earrings', 'Brincos longos e delgados para alongamento cervical.',
    'Brincos verticais alongam pescoço e quebram horizontalidade de mandíbula quadrada.', 'styling', 3, 'moderate', 5, 'low', JAW),
  ex('routine-341-slick-back-gel', 'Penteado slick back com gel molhado.',
    'Cabelo penteado para trás expõe testa e linha temporal — destaca traços ósseos.', 'styling', 3, 'moderate', 5, 'low', FOREHEAD),
  ex('routine-342-papaya-enzyme-shave-area', 'Papaína na área de barbear.',
    'Loção pós-barba com papaína dissolve queratina e previne pelo encravado.', 'lifestyle', 1, 'moderate', 5, 'low', JAW),
  ex('routine-343-mandible-enzymatic-exfoliation', 'Esfoliação enzimática focada na mandíbula.',
    'Para quem se barbeia, esfoliação 2× por semana na linha mandibular reduz pelos encravados e foliculite.', 'lifestyle', 1, 'moderate', 4, 'low', JAW),
  ex('routine-344-witch-hazel-aftershave', 'Loção pós-barba com hamamélis (witch hazel).',
    'Adstringente natural — fecha poros, reduz vermelhidão e previne foliculite. Tradição clássica.', 'lifestyle', 1, 'moderate', 5, 'low', JAW),
  ex('routine-345-translucent-powder-tzone', 'Pó translúcido matificante na zona T.',
    'Reduz brilho da zona T para fotografia. Não tem cor — funciona em qualquer tom de pele.', 'styling', 3, 'moderate', 5, 'low', [...NOSE, ...FOREHEAD]),
  ex('routine-346-thermal-beard-brush', 'Escova alisadora térmica matinal para barba.',
    'Escova com calor leve (60-80°C) modela barba ondulada/crespa. Alternativa segura ao secador + escova manual.', 'styling', 3, 'anecdotal', 5, 'low', JAW),
  ex('routine-347-haircut-15-day-schedule', 'Calendário rígido de corte capilar a cada 15 dias.',
    'Manutenção quinzenal preserva forma do corte. Cabelo mal mantido descaracteriza visagismo planejado.', 'lifestyle', 1, 'moderate', 4, 'low', [...FOREHEAD, ...FACE_SHAPE]),
  ex('routine-348-face-framing-highlights', 'Mechas frontais clareadas (face framing).',
    'Iluminam o rosto e criam profundidade. Custo-benefício alto entre intervenções de cabelo.', 'styling', 3, 'moderate', 5, 'low', [...FOREHEAD]),
  ex('routine-349-vertical-textured-style', 'Penteado desfiado vertical para topo do crânio.',
    'Volume vertical alonga rostos largos. Corte com camadas + finalização vertical.', 'styling', 3, 'moderate', 4, 'low', [...FOREHEAD, ...FACE_SHAPE]),
  ex('routine-350-clear-brow-wax', 'Cera modeladora transparente nas sobrancelhas.',
    'Alternativa diária ao gel — mantém sobrancelhas penteadas com fixação leve, sem cor adicional.', 'styling', 3, 'moderate', 5, 'low', BROWS),

  // ════════════════════ SONO / MINDFULNESS / TRACKING (351-400) ════════════════════
  ex('routine-351-blackout-curtains', 'Cortinas blackout no quarto.',
    'Quarto totalmente escuro maximiza melatonina e qualidade do sono profundo. Impacto direto em olheiras e edema matinal.', 'lifestyle', 1, 'strong', 2, 'low', [...EYES, ...CHEEK]),
  ex('routine-352-mouth-tape-partial', 'Fita bucal de cobertura parcial (fase de adaptação).',
    'Versão suave de mouth taping para iniciantes — fita horizontal apenas no centro do lábio.', 'lifestyle', 1, 'moderate', 4, 'low', NOSE,
    { risk: 0.1, disclaimer: 'Verificar permeabilidade nasal antes. Em obstrução, suspender imediatamente.' }),
  ex('routine-353-silicone-ear-plugs', 'Protetor auricular de silicone noturno.',
    'Bloqueio sonoro = sono profundo ininterrupto. Impacto cumulativo grande em qualidade de pele e olheiras.', 'lifestyle', 1, 'moderate', 4, 'low', [...EYES, ...CHEEK]),
  ex('routine-354-bedroom-temperature-1820', 'Quarto a 18-20°C durante o sono.',
    'Temperatura ideal para sono REM. Sono em ambiente quente é raso e fragmentado.', 'lifestyle', 1, 'strong', 3, 'low', [...EYES, ...CHEEK]),
  ex('routine-355-snore-tracking-app', 'App de rastreamento de ronco noturno.',
    'Apps como SnoreLab gravam padrão de ronco — base para identificar apneia e respiração bucal noturna.', 'lifestyle', 1, 'moderate', 4, 'low', NOSE),
  ex('routine-356-screen-detox-1h-pre-sleep', 'Detox de telas 1h antes de dormir.',
    'Última hora sem celular/computador = melatonina natural intacta = sono profundo. Maior alavanca para qualidade de sono.', 'lifestyle', 1, 'strong', 2, 'medium', [...EYES, ...CHEEK]),
  ex('routine-357-kinesio-tape-asymmetry', 'Kinesio tape direcionado à assimetria labial.',
    'Bandagem elástica fina aplicada por fisioterapeuta orienta tônus muscular durante o sono. Coadjuvante em paralisias leves.', 'professional_referral', 4, 'moderate', 5, 'low', [...MOUTH], { requiresProfessional: true, professionalType: 'physiotherapist' }),
  ex('routine-358-pillow-under-knees', 'Travesseiro cilíndrico sob os joelhos (decúbito supino).',
    'Pequena flexão do quadril alivia coluna lombar — postura noturna mais simétrica. Útil para quem está iniciando o sono supino.', 'lifestyle', 1, 'moderate', 5, 'low', SYM),
  ex('routine-359-hrv-morning-tracking', 'Monitoramento matinal de HRV.',
    'Variabilidade da Frequência Cardíaca = marcador objetivo de recuperação. Apps como HRV4Training mostram quando o corpo está estressado.', 'lifestyle', 1, 'strong', 4, 'low', [...EYES, ...CHEEK]),
  ex('routine-360-symmetry-meditation', 'Meditação com visualização de simetria facial.',
    'Visualização guiada — neuroplasticidade pode reforçar percepção corporal interna. Sem RCT robusto, mas sem riscos.', 'lifestyle', 1, 'anecdotal', 5, 'low', SYM),
  ex('routine-361-morning-sun-exposure', 'Exposição matinal à luz solar 15 minutos.',
    'Luz solar direta nos olhos pela manhã (sem óculos escuros, 15min) — sincroniza ritmo circadiano. Maior alavanca para sono saudável.', 'lifestyle', 1, 'strong', 2, 'low', [...EYES, ...CHEEK]),
  ex('routine-362-warm-foot-bath-night', 'Escalda-pés quente noturno (10 min).',
    'Vasodilatação periférica + sinal de relaxamento ao sistema nervoso. Tradição com mecanismo termorregulatório validado.', 'lifestyle', 1, 'moderate', 5, 'low', SYM),
  ex('routine-363-mindful-eating', 'Mindful eating em todas as refeições.',
    'Mastigar lenta e conscientemente: 20-30 vezes por garfada. Trabalho mandibular real + saciedade + digestão.', 'lifestyle', 1, 'moderate', 3, 'low', JAW),
  ex('routine-364-no-stress-content-2h-pre-sleep', 'Sem conteúdo estressante 2h antes de dormir.',
    'Notícias, redes sociais, séries violentas elevam cortisol. Substituir por leitura, podcast leve, música.', 'lifestyle', 1, 'moderate', 3, 'medium', [...EYES, ...CHEEK]),
  ex('routine-365-eft-tapping-meridians', 'EFT tapping nos meridianos faciais.',
    'Técnica de tapotamento em pontos específicos (medicina chinesa) — RCTs pequenos sugerem redução de ansiedade. Sem evidência para estética.', 'lifestyle', 1, 'anecdotal', 5, 'low', SYM),
  ex('routine-366-no-electronics-in-bedroom', 'Eletrônicos fora do quarto.',
    'Remover TV, celular e qualquer LED do quarto. Cada fonte de luz suprime melatonina mesmo em níveis baixos.', 'lifestyle', 1, 'strong', 3, 'low', [...EYES, ...CHEEK]),
  ex('routine-367-wake-up-light', 'Despertador com simulador de luz solar.',
    'Wake-up light (Philips, etc.) simula amanhecer 30min antes do alarme — despertar gradual sem cortisol pico.', 'lifestyle', 1, 'moderate', 4, 'low', [...EYES]),
  ex('routine-368-spo2-monitoring-night', 'Monitoramento de SpO2 noturno (smartwatch/anel).',
    'Apple Watch, Oura, Whoop registram saturação de oxigênio noturna — flag para apneia. Quedas <90% indicam investigação.', 'lifestyle', 1, 'moderate', 4, 'medium', [...EYES, ...NOSE]),
  ex('routine-369-rearview-postural-check', 'Auto-observação postural no espelho retrovisor.',
    'Espelho do carro como lembrete diário de chin tuck e ombros para baixo. 5 segundos a cada parada.', 'lifestyle', 1, 'moderate', 5, 'low', SYM),
  ex('routine-370-postural-vibration-alarm', 'Alarme vibratório de lembrete postural a cada 45min.',
    'Smartwatch vibra a cada 45 minutos — pausa para postura. Combate "creep" postural durante o trabalho.', 'lifestyle', 1, 'moderate', 4, 'low', SYM),
  ex('routine-371-saliva-swallow-reminder', 'Lembrete consciente de engolir saliva acumulada.',
    'A cada hora, lembrar de engolir conscientemente com a língua no palato. Re-treina padrão deglutório atípico.', 'lifestyle', 1, 'moderate', 4, 'low', MOUTH),
  ex('routine-372-doorway-pec-stretch', 'Alongamento de peitorais no batente da porta (5×/dia).',
    '5 sessões de 30s ao longo do dia abrem cadeia anterior e mantêm postura ereta. Acessível em qualquer ambiente.', 'exercise', 2, 'moderate', 3, 'low', SYM),
  ex('routine-373-tongue-position-phone-use', 'Vigilância da língua no palato durante uso do celular.',
    'Maior fonte de respiração bucal moderna — ao usar celular, lembrar de manter língua no palato e lábios selados.', 'lifestyle', 1, 'moderate', 3, 'low', [...MOUTH, ...NOSE]),
  ex('routine-374-nasal-breathing-during-exercise', 'Respiração exclusivamente nasal durante exercício.',
    'Manter respiração nasal mesmo em treino moderado. Treina tolerância ao CO2 e padrão respiratório robusto.', 'exercise', 2, 'strong', 3, 'medium', NOSE),
  ex('routine-375-jaw-relax-pause-work', 'Pausa de 2 minutos focada em relaxamento mandibular no trabalho.',
    'A cada 90 minutos, pausa específica para soltar mandíbula, língua, ombros. Quebra ciclo de tensão crônica.', 'lifestyle', 1, 'moderate', 4, 'low', JAW),
  ex('routine-376-photo-checkin-natural-light', 'Check-in fotográfico semanal em luz natural.',
    'Foto sempre na mesma janela (luz norte/sul, sem sol direto), mesma hora, mesma distância. Base de comparação real.', 'photo', 0, 'strong', 1, 'low', ALL_FACIAL),
  ex('routine-377-neck-angle-app-ruler', 'Medição angular do pescoço com app Ruler.',
    'App de transferidor mede ângulo cervical em fotos de perfil. Tracking objetivo do progresso postural.', 'photo', 0, 'moderate', 4, 'low', SYM),
  ex('routine-378-photo-bite-gum-isolated', 'Check-in fotográfico isolado da exposição gengival.',
    'Foto frontal mostrando exposição gengival ao sorriso. Base para tracking de gummy smile e proporção.', 'photo', 0, 'moderate', 4, 'low', MOUTH),
  ex('routine-379-tripod-photo-15m', 'Calibração fotográfica a 1.5m com tripé fixo.',
    'Distância fixa de 1.5m + tripé + marcador de chão = comparações longitudinais válidas.', 'photo', 0, 'strong', 1, 'low', ALL_FACIAL),
  ex('routine-380-flexible-tape-measurement', 'Medição quinzenal de assimetrias com fita métrica.',
    'Fita dermatológica flexível mede distâncias canto-canto, mandíbula etc. Tracking métrico complementar à foto.', 'photo', 0, 'moderate', 4, 'low', ALL_FACIAL),
  ex('routine-381-phi-compass-quarterly', 'Compasso de proporção áurea trimestral.',
    'Compasso de proporção (Φ caliper) verifica relações 1:1.618 nas distâncias faciais. Tracking visagista clássico.', 'photo', 0, 'anecdotal', 5, 'low', ['phi_face_height_to_width', 'phi_eye_to_mouth', 'phi_nose_to_lip']),
  ex('routine-382-true-mirror-analysis', 'Análise diária em espelho verdadeiro (não-invertido).',
    'Espelho verdadeiro (true mirror, dois espelhos a 90°) mostra a imagem real — diferente da imagem invertida diária. Revela assimetrias que passam despercebidas.', 'photo', 0, 'anecdotal', 4, 'low', SYM),
  ex('routine-383-jaw-protrusion-profile', 'Posicionamento tático do maxilar para fotos de perfil.',
    'Em foto de perfil, leve protrusão mandibular alonga e define o contorno. Truque consciente para ângulo.', 'photo', 0, 'moderate', 4, 'low', JAW),
  ex('routine-384-camera-5-degree-below', 'Câmera 5° abaixo da linha do olhar para fotos.',
    'Inclinação levemente baixa em vez de neutra evita aspecto "papada" e alonga o pescoço.', 'photo', 0, 'moderate', 3, 'low', JAW),
  ex('routine-385-tongue-palate-during-photo', 'Posicionar língua no palato exatamente ao capturar foto.',
    'Língua no palato no momento da foto define ligeiramente a linha mandibular. Truque imediato.', 'photo', 0, 'anecdotal', 3, 'low', JAW),
  ex('routine-386-saliva-swallow-photo', 'Engolir saliva e prender respiração durante captura.',
    'Reduz movimento da garganta e tensão facial momentânea para foto natural.', 'photo', 0, 'anecdotal', 5, 'low', JAW),
  ex('routine-387-orbicularis-tension-photo', 'Tensão lateral do orbicular para contenção escleral em fotos.',
    'Suaviza efeito "escleral" — quando se vê branco abaixo da íris. Prática de modelos.', 'photo', 0, 'anecdotal', 5, 'low', EYES),
  ex('routine-388-duchenne-smile-training', 'Sorriso de Duchenne (com canais lacrimais comprimidos).',
    'Sorriso autêntico com olhos engajados (orbicular contraído lateralmente). Treino no espelho gera memória.', 'exercise', 2, 'moderate', 3, 'low', [...EYES, ...MOUTH]),
  ex('routine-389-360-rotating-video', 'Gravação em vídeo 360° trimestral.',
    'Vídeo giratório lento captura todos os ângulos. Análise mais rica que foto frontal isolada.', 'photo', 0, 'moderate', 4, 'low', ALL_FACIAL),
  ex('routine-390-ring-light-photo', 'Foto exclusiva sob ring light centralizada.',
    'Iluminação controlada elimina sombras assimétricas e produz comparações consistentes.', 'photo', 0, 'moderate', 3, 'low', ALL_FACIAL),
  ex('routine-391-overhead-lighting-photo', 'Foto sob iluminação overhead estrita.',
    'Luz superior simula condição de fotógrafo profissional — revela estrutura óssea real (sombras nasais, malares, mandibular).', 'photo', 0, 'moderate', 4, 'low', ALL_FACIAL),
  ex('routine-392-monthly-hair-loss-photo', 'Foto mensal específica de queda capilar.',
    'Topo do crânio em foto vertical fixa — tracking objetivo de calvície ou alopecia.', 'photo', 0, 'strong', 3, 'low', FOREHEAD),
  ex('routine-393-cephalometric-app-semester', 'Foto lateral semestral em app cefalométrico básico.',
    'Apps como CephX permitem traçados básicos de cefalometria caseira — útil para progresso longitudinal.', 'photo', 0, 'moderate', 5, 'low', JAW),
  ex('routine-394-pain-mapping-textual', 'Registro textual diário de pontos de dor referida.',
    'Mapeamento muscular textual no app — correlaciona tensão crônica a sintomas faciais.', 'lifestyle', 1, 'moderate', 5, 'low', SYM),
  ex('routine-395-nasolabial-angle-protractor', 'Tracking semanal do ângulo nasolabial.',
    'Foto de perfil + transferidor virtual mede ângulo nasolabial (90-95° em homens, 100-115° em mulheres é estética padrão).', 'photo', 0, 'moderate', 4, 'low', NOSE),
  ex('routine-396-nostril-control-smile', 'Controle muscular da narina ao sorrir.',
    'Bloquear conscientemente alargamento nasal durante sorriso amplo — refinamento técnico de sorriso.', 'exercise', 2, 'anecdotal', 5, 'low', NOSE),
  ex('routine-397-reduced-lip-opening-speech', 'Abertura labial reduzida e contida durante fala.',
    'Falar com menos abertura labial reduz tensão muscular crônica em fala animada.', 'lifestyle', 1, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-398-exaggerated-articulation-shower', 'Articulação exagerada temporária no banho.',
    '5 minutos por dia falando frases de jornal exagerando articulação. Trabalha músculos da fala em amplitude máxima.', 'exercise', 2, 'moderate', 5, 'low', MOUTH),
  ex('routine-399-photo-peak-puffiness', 'Foto diária no momento do despertar (peak puffiness).',
    'Foto matinal ao acordar mostra edema máximo. Comparar com foto de meio-dia revela variação real.', 'photo', 0, 'moderate', 4, 'low', [...EYES, ...CHEEK]),
  ex('routine-400-photo-post-workout-vascular', 'Foto 10 min pós-treino intenso (peak vascularity).',
    'Vasodilatação pós-treino mostra contorno mais definido e cor saudável. Útil para tracking longitudinal de "best version".', 'photo', 0, 'anecdotal', 5, 'low', ALL_FACIAL),

  // ════════════════════ CAUDA LONGA - LT 1-15: MIOTERAPIA ULTRA-AVANÇADA ════════════════════
  ex('routine-lt-01-tongue-segmental-click', 'Estalo de língua segmentar (ápice, médio, base).',
    'Isolar estalo em três segmentos da língua: ponta, parte média e base. 10 ciclos de cada, 1× ao dia. Refinamento de propriocepção lingual.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-lt-02-horizontal-pencil-lips', 'Lápis horizontal segurado apenas com lábios.',
    'Manter lápis sem usar dentes por 1-2 minutos. Trabalho intenso de orbicular dos lábios.', 'exercise', 2, 'moderate', 4, 'low', MOUTH),
  ex('routine-lt-03-pastille-palate-suction', 'Sustentar pastilha no palato sem mastigar.',
    'Uma pastilha sublingual sustentada apenas pela língua contra o palato — força lingual sustentada.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-lt-04-tongue-cheek-resistance', 'Empurre lateral da língua contra a bochecha (com resistência externa).',
    'Língua empurra a bochecha por dentro enquanto dedo resiste por fora; 30s cada lado. Trabalho lingual contra resistência.', 'exercise', 2, 'moderate', 4, 'low', [...MOUTH, ...CHEEK]),
  ex('routine-lt-05-tongue-vestibular-sweep', 'Varredura lingual vestibular (limpar dentes 360°).',
    'Língua percorre face vestibular de todos os dentes em sentido completo. Mobilidade + tônus.', 'exercise', 2, 'moderate', 4, 'low', MOUTH),
  ex('routine-lt-06-tongue-extra-oral-stretch', 'Alongamento lingual extra-oral.',
    'Esticar a língua ao máximo para baixo, depois para cima, depois lados; 10s cada direção. Mobilidade extrema lingual.', 'exercise', 2, 'moderate', 4, 'low', MOUTH),
  ex('routine-lt-07-horse-click-floor', 'Estalo do "cavalinho" para assoalho da boca.',
    'Estalo forte e sustentado simulando galope. Trabalha musculatura submentual ativamente.', 'exercise', 2, 'anecdotal', 5, 'low', ['chin_height_ratio']),
  ex('routine-lt-08-tongue-tip-lower-teeth', 'Pressão isométrica do ápice contra dentes inferiores.',
    'Ponta da língua pressiona forte contra incisivos inferiores por 10s; 10 repetições. Variação do mewing — assoalho lingual.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-lt-09-tongue-base-elevation', 'Elevação da base da língua com boca aberta (dessensibilização).',
    'Tentar levantar base da língua mantendo a boca aberta. Reduz reflexo de vômito e trabalha musculatura faringeal.', 'exercise', 2, 'moderate', 5, 'low', MOUTH),
  ex('routine-lt-10-fake-smile-swallow-isolation', 'Deglutição com sorriso forçado (isolar língua).',
    'Engolir mantendo sorriso fixo isola força lingual de musculatura perioral. Teste de padrão deglutório atípico.', 'exercise', 2, 'moderate', 5, 'low', MOUTH),
  ex('routine-lt-11-air-rotation-upper-lip', 'Rotação de ar sob lábio superior.',
    'Mover bolha de ar sob o lábio superior em movimento circular; 30 segundos cada direção. Isola buccinador superior.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-lt-12-air-rotation-lower-lip', 'Rotação de ar sob lábio inferior.',
    'Bolha de ar sob lábio inferior, movimento circular; 30 segundos cada direção. Isola buccinador inferior.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-lt-13-upper-lip-resistance', 'Isometria de lábio superior puxado.',
    'Dedos puxam lábio superior para baixo enquanto lábio resiste tentando subir; 5 segundos, 10 repetições. Levantador do lábio superior.', 'exercise', 2, 'moderate', 5, 'low', MOUTH),
  ex('routine-lt-14-unilateral-cheek-puff', 'Bochecho de ar unilateral (uma bochecha de cada vez).',
    'Encher apenas uma bochecha mantendo a outra colada aos dentes. Força lateral assimétrica.', 'exercise', 2, 'moderate', 5, 'low', CHEEK),
  ex('routine-lt-15-mentalis-tactile-inhibition', 'Inibição tátil do mentual ao engolir.',
    'Dedo firme no queixo durante deglutição — bloqueia contração compensatória do mentual. Re-treino reflexo.', 'exercise', 2, 'moderate', 4, 'low', ['chin_height_ratio']),

  // ════════════════════ LT 16-25: ATM CLÍNICO ════════════════════
  ex('routine-lt-16-mandibular-rotation-mirror', 'Abertura mandibular com rotação ao espelho.',
    'Abrir e fechar acompanhando o eixo condilar no espelho — corrige desvio em "C" ou em "S" durante a abertura.', 'exercise', 2, 'moderate', 4, 'low', JAW),
  ex('routine-lt-17-mandibular-protrusion-isometric', 'Isometria de protrusão mandibular.',
    'Projetar o maxilar inferior contra resistência da mão; 5 segundos, 10 repetições. Fortalece pterigóideo lateral.', 'exercise', 2, 'moderate', 5, 'low', JAW),
  ex('routine-lt-18-mandibular-retrusion-isometric', 'Isometria de retrusão mandibular.',
    'Tentar puxar mandíbula para trás contra a mão posicionada à frente do queixo; 5s, 10 repetições. Trabalha temporal.', 'exercise', 2, 'moderate', 5, 'low', JAW),
  ex('routine-lt-19-hinge-jaw-tongue-up', 'Dobradiça mandibular com língua presa no palato.',
    'Abertura mínima da boca mantendo a língua presa no palato. Treina abertura sem deslocamento condilar.', 'exercise', 2, 'moderate', 4, 'low', JAW),
  ex('routine-lt-20-lateral-pterygoid-release', 'Liberação intraoral do pterigóideo lateral.',
    'Massagem profunda no alto da bochecha interna (intraoral). Trigger point profundo, comum em DTM.', 'professional_referral', 4, 'moderate', 5, 'medium', JAW,
    { requiresProfessional: true, professionalType: 'physiotherapist',
    disclaimer: 'Procedimento profissional — auto-massagem na região é arriscada e pode lesar mucosa. Procure fisioterapeuta orofacial.' }),
  ex('routine-lt-21-mandibular-caudal-traction', 'Tração caudal passiva da mandíbula.',
    'Polegares puxam levemente os dentes inferiores para baixo por 30s, 1× ao dia. Descomprime ATM.', 'exercise', 2, 'moderate', 5, 'low', JAW),
  ex('routine-lt-22-masseter-friction-massage', 'Massagem friccional profunda no masseter superior.',
    'Pressão e fricção transversal lenta no terço superior do masseter por 1-2 minutos cada lado. Libera trigger points clássicos.', 'exercise', 2, 'moderate', 4, 'low', JAW),
  ex('routine-lt-23-jaw-wood-spatula-stretch', 'Alongamento maxilar com espátulas (trismo leve).',
    'Espátulas de madeira empilhadas progressivamente para abrir a boca em casos de trismo. Use sob orientação.', 'exercise', 2, 'moderate', 5, 'low', JAW,
    { disclaimer: 'Em DTM aguda, NÃO usar. Apenas em rigidez funcional sem dor articular.' }),
  ex('routine-lt-24-mandibular-elastic-resistance', 'Lateralidade mandibular com resistência elástica.',
    'Elástico ortodôntico leve entre dedos, mandíbula desliza lateralmente contra resistência. Avançado — fisio orofacial.', 'professional_referral', 4, 'moderate', 5, 'low', JAW,
    { requiresProfessional: true, professionalType: 'physiotherapist' }),
  ex('routine-lt-25-jaw-tap-relax-reflex', 'Tapinhas no queixo para relaxamento reflexo.',
    'Tapas leves e ritmados no queixo induzem relaxamento mandibular reflexo. Útil para iniciar relaxamento consciente.', 'exercise', 2, 'anecdotal', 5, 'low', JAW),

  // ════════════════════ LT 26-36: FACE YOGA AVANÇADO ════════════════════
  ex('routine-lt-26-dao-isometric', 'Isometria de "sorriso triste" (depressor do ângulo da boca).',
    'Forçar comissuras da boca para baixo (DAO ativado) por 5s; 10 repetições. Tonifica músculo subutilizado.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-lt-27-risorius-tension', 'Tensão do risório (sorriso esticado horizontal).',
    'Esticar lábios horizontalmente sem mostrar dentes; 5s, 10 repetições. Tonifica risório.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-lt-28-nasolabial-fold-traction', 'Pinçamento ortogonal do sulco nasolabial.',
    'Polegar e indicador beliscam o sulco e tracionam para fora; deslize pelo sulco completo. 1 min cada lado.', 'exercise', 2, 'anecdotal', 5, 'low', [...MOUTH, ...CHEEK]),
  ex('routine-lt-29-temple-isometric-blink', 'Isometria direcional de têmporas (puxar e piscar).',
    'Puxar pele da têmpora para trás e piscar o olho do mesmo lado por 5s; 10 repetições cada lado.', 'exercise', 2, 'anecdotal', 5, 'low', [...EYES, ...FOREHEAD]),
  ex('routine-lt-30-disgust-lip-elevation', 'Isometria unilateral do levantador do lábio (face de "nojo").',
    'Imitar expressão de nojo isolando um lado por 3s; 10 cada lado. Isola levantador do lábio superior.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-lt-31-nasalis-transversus-activation', 'Ativação do nasal transverso (enrugar nariz).',
    'Enrugar nariz com dedo resistindo na ponte nasal; 5s, 10 repetições. Tonifica nasalis transversus.', 'exercise', 2, 'anecdotal', 5, 'low', NOSE),
  ex('routine-lt-32-sliding-supraciliary-pinch', 'Pinçamento deslizante do arco superciliar.',
    'Beliscar e deslizar polegar e indicador sobre a sobrancelha completa; 1-2 minutos. Estímulo + drenagem local.', 'exercise', 2, 'anecdotal', 5, 'low', BROWS),
  ex('routine-lt-33-procerus-static-compression', 'Compressão estática do prócero (entre os olhos).',
    'Pressão sustentada no ponto entre as sobrancelhas por 30s. Libera tensão crônica do "11".', 'exercise', 2, 'moderate', 4, 'low', BROWS),
  ex('routine-lt-34-frontal-circular-massage', 'Massagem circular da fáscia epicraniana frontal.',
    'Movimentos circulares com pressão moderada na testa e couro cabeludo frontal por 2 minutos. Solta tensão acumulada.', 'exercise', 2, 'anecdotal', 4, 'low', FOREHEAD),
  ex('routine-lt-35-frontalis-elastic-band', 'Isometria de testa contra faixa elástica.',
    'Faixa elástica viscoelástica posicionada na testa, tentar elevar sobrancelhas contra a resistência. Trabalho do frontalis.', 'exercise', 2, 'anecdotal', 5, 'low', [...FOREHEAD, ...BROWS]),
  ex('routine-lt-36-reverse-squinting', 'Squinting reverso (arregalar focando ponto).',
    'Arregalar olhos ao máximo focando ponto distante, sem subir sobrancelhas; 5 segundos, 10 repetições.', 'exercise', 2, 'anecdotal', 5, 'low', EYES),

  // ════════════════════ LT 37-44: ORTÓPTICA ════════════════════
  ex('routine-lt-37-saccadic-eye-movements', 'Movimentos oculares sacádicos.',
    'Pular foco rapidamente entre dois alvos distantes (paredes opostas) sem virar a cabeça; 30s, 2× ao dia.', 'exercise', 2, 'moderate', 5, 'low', EYES),
  ex('routine-lt-38-pendulum-tracking', 'Acompanhamento de pêndulo (smooth pursuit).',
    'Acompanhar dedo desenhando "8" lentamente no ar com os olhos sem mover a cabeça; 1 minuto.', 'exercise', 2, 'moderate', 4, 'low', EYES),
  ex('routine-lt-39-thumb-horizon-shift', 'Foco e desfoco rítmico (polegar/horizonte).',
    'Olhar polegar próximo (1s) → horizonte (1s) ritmadamente por 30 segundos.', 'exercise', 2, 'moderate', 4, 'low', EYES),
  ex('routine-lt-40-extreme-360-rotation-closed', 'Rotação ocular 360° de olhos fechados.',
    'Olhos fechados, rotacionar globos oculares em círculo completo lentamente; 5 ciclos cada direção.', 'exercise', 2, 'moderate', 5, 'low', EYES),
  ex('routine-lt-41-lower-eyelid-isometric', 'Contração isométrica exclusiva da pálpebra inferior.',
    'Tentar fechar o olho apenas levantando a parte de baixo (não descer a superior). 5s, 10 repetições. Isola orbicular inferior.', 'exercise', 2, 'anecdotal', 4, 'low', EYES),
  ex('routine-lt-42-asymmetric-eyelid-blink', 'Piscadela super lenta de um olho só.',
    'Piscar um olho devagar (3-5 segundos) mantendo o outro totalmente aberto; alternar lados.', 'exercise', 2, 'moderate', 5, 'low', EYES),
  ex('routine-lt-43-orthoptic-reading-lens', 'Leitura com lentes de grau diferente (ortóptica).',
    'Prática clínica ortóptica supervisionada — uso de lentes não prescritas para treinar acomodação. Apenas em consultório.', 'professional_referral', 4, 'moderate', 5, 'medium', EYES,
    { requiresProfessional: true, professionalType: 'otolaryngologist' }),
  ex('routine-lt-44-orbital-bone-palming', 'Palming ocular com pressão periférica.',
    'Pressão suave da base da mão sobre as bordas ósseas da órbita, com olhos fechados; 1 minuto. Relaxamento profundo.', 'exercise', 2, 'anecdotal', 5, 'low', EYES),

  // ════════════════════ LT 45-56: FISIO CERVICAL AVANÇADA ════════════════════
  ex('routine-lt-45-levator-scapulae-armpit', 'Alongamento elevador escápula ("cheirar a axila").',
    'Cabeça gira 45° para um lado e olha para a axila do mesmo lado, mão puxa cabeça suavemente; 30s cada lado.', 'exercise', 2, 'moderate', 3, 'low', SYM),
  ex('routine-lt-46-cervical-snags-towel', 'SNAGs cervicais com toalha (Mulligan).',
    'Toalha enrolada sob a cervical + flexão+rotação ativa. Técnica de fisio para mobilização articular sustentada.', 'professional_referral', 4, 'moderate', 5, 'low', SYM,
    { requiresProfessional: true, professionalType: 'physiotherapist' }),
  ex('routine-lt-47-median-nerve-glide', 'Deslizamento neural do nervo mediano.',
    'Braço estendido lateralmente, mão flexionada para cima, cabeça inclina para o lado oposto; 10 ciclos suaves.', 'exercise', 2, 'moderate', 5, 'low', SYM),
  ex('routine-lt-48-supine-cervical-retraction', 'Retração cervical isométrica em decúbito dorsal.',
    'Deitado com travesseiro fino, empurrar nuca contra travesseiro por 5s; 10 repetições, 1× ao dia.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-lt-49-serratus-wall-slides', 'Wall slides para serrátil anterior.',
    'Antebraços na parede em "W", deslizar para "Y" mantendo contato; 10 repetições. Estabiliza escápula em rotação superior.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-lt-50-turtle-neck-inverted', 'Pescoço de tartaruga invertido (4 apoios).',
    'Em quatro apoios no chão, levantar a cabeça contra a gravidade mantendo coluna neutra. Fortalece extensores cervicais profundos.', 'exercise', 2, 'moderate', 5, 'low', SYM),
  ex('routine-lt-51-suboccipital-peanut-roller', 'Liberação suboccipital com bolas amarradas (peanut).',
    'Duas bolas de tênis amarradas formando "amendoim", posicionadas na base do crânio; 2 minutos. Libera suboccipitais.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-lt-52-pec-major-pilates-roller', 'Alongamento de peitoral maior no rolo de pilates.',
    'Deitar com rolo verticalmente sob a coluna, braços abertos a 90° por 5 minutos. Abertura torácica passiva profunda.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-lt-53-anterior-scalene-ais', 'AIS de escalenos anteriores.',
    'Active Isolated Stretching: contração leve do antagonista + alongamento de 2s + relaxamento. 10 ciclos cada lado.', 'exercise', 2, 'moderate', 5, 'low', SYM),
  ex('routine-lt-54-scm-fascia-pinch', 'Liberação manual da fáscia do esternocleidomastóideo.',
    'Beliscar SCM em toda extensão (clavícula a mastóide), 1-2 minutos cada lado. Libera fáscia que altera postura cervical.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-lt-55-thoracic-bow-arrow', 'Rotação torácica em "arco e flecha".',
    'Sentado, braços cruzados, rotação torácica máxima cada lado; 10 ciclos. Mobilidade torácica destrava a cervical.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-lt-56-psoas-major-stretch', 'Alongamento de psoas maior.',
    'Posição cavalheiro, avançar pelve mantendo tronco ereto; 30s cada lado. Psoas tenso puxa coluna toda.', 'exercise', 2, 'moderate', 4, 'low', SYM),

  // ════════════════════ LT 57-70: LIBERAÇÃO CRANIANA / FÁSCIA ════════════════════
  ex('routine-lt-57-hair-traction-fascia', 'Tracionamento da fáscia puxando o cabelo.',
    'Agarrar mechas próximas à raiz e puxar para cima suavemente por 5 segundos cada região. Descola fáscia epicraniana.', 'exercise', 2, 'anecdotal', 5, 'low', FOREHEAD),
  ex('routine-lt-58-sagittal-suture-release', 'Liberação da sutura sagital.',
    'Pressão lenta dos polegares ao longo da linha central do crânio (osso parietal); 1-2 minutos. Técnica de osteopatia craniana.', 'exercise', 2, 'anecdotal', 5, 'low', SYM),
  ex('routine-lt-59-mastoid-compression', 'Massagem compressiva da mastóide.',
    'Pressão sustentada atrás das orelhas por 30s cada lado. Libera tensão da inserção do SCM e esplênio.', 'exercise', 2, 'moderate', 5, 'low', SYM),
  ex('routine-lt-60-auricular-traction', 'Deslizamento auricular (puxar orelhas para trás-cima).',
    'Puxar lóbulo e hélice das orelhas para trás e cima lentamente; 1 minuto. Estímulo de drenagem regional.', 'exercise', 2, 'anecdotal', 5, 'low', SYM),
  ex('routine-lt-61-anterior-neck-fascial-stretch', 'Estiramento fáscico anterior do pescoço (âncora na clavícula).',
    'Polegares fixos na clavícula, cabeça estende para trás. 30s, 3 repetições. Alonga fáscia cervical anterior.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-lt-62-skin-rolling-jaw-angle', 'Skin rolling no ângulo da mandíbula.',
    'Pinçar e rolar a pele lentamente sobre o ângulo gonial; 1 minuto cada lado. Mobiliza tecido subcutâneo.', 'exercise', 2, 'anecdotal', 5, 'low', JAW),
  ex('routine-lt-63-cheeks-intraoral-release', 'Liberação miofascial intraoral das bochechas.',
    'Polegar por dentro da boca pressiona buccinador e mucosa interna por 1 minuto cada lado. Profissional ou auto-massagem cuidadosa.', 'exercise', 2, 'moderate', 5, 'low', CHEEK),
  ex('routine-lt-64-atypical-swallow-inhibition', 'Inibição do reflexo de deglutição atípica.',
    'Lembretes ao longo do dia para engolir com língua no palato (não empurrando dentes anteriores). Re-treino padrão deglutório.', 'exercise', 2, 'moderate', 4, 'low', MOUTH),
  ex('routine-lt-65-submentual-tapping', 'Tapotamento rítmico submentual.',
    'Tapas leves e ritmados na região submentual (entre queixo e pescoço) por 1 minuto. Ativa drenagem local.', 'exercise', 2, 'anecdotal', 5, 'low', ['chin_height_ratio', 'lower_third_ratio']),
  ex('routine-lt-66-lip-corner-static-stretch', 'Alongamento estático das comissuras labiais.',
    'Dedos indicadores em cada comissura, tracionar lateralmente sustentando 30s; 3 repetições.', 'exercise', 2, 'anecdotal', 5, 'low', MOUTH),
  ex('routine-lt-67-stomach-vacuum', 'Stomach vacuum (vácuo abdominal).',
    'Exalar ar completamente, contrair abdômen sustentando 10s; 5 repetições. Ativa transverso do abdômen e diafragma.', 'exercise', 2, 'moderate', 4, 'low', SYM),
  ex('routine-lt-68-c1-c2-mobilization', 'Mobilização articular C1-C2 com movimento de queixo.',
    'Pequenos movimentos de "sim" cervicais lentos e controlados; 10 ciclos. Mobiliza vértebras cervicais altas.', 'exercise', 2, 'moderate', 5, 'low', SYM),
  ex('routine-lt-69-mandibular-bite-block', 'Deslizamento mandibular com bloqueio de dedo.',
    'Posicionar dedo entre dentes, impedindo fechamento, deslizar mandíbula lateralmente; 10 ciclos cada lado.', 'exercise', 2, 'moderate', 5, 'low', JAW),
  ex('routine-lt-70-jacobson-progressive-relaxation', 'Relaxamento progressivo de Jacobson facial.',
    'Tensionar todo o rosto (testa, olhos, nariz, lábios, mandíbula) por 10 segundos, então soltar abruptamente; 5 ciclos. Reset muscular total.', 'exercise', 2, 'moderate', 4, 'low', SYM),
];

export class M44SeedFullCatalog2701746000245000 implements MigrationInterface {
  name = 'M44SeedFullCatalog2701746000245000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const s of SEED) {
      const disclaimer =
        s.disclaimer ??
        (s.evidence === 'anecdotal'
          ? POPULAR_DISCLAIMER
          : s.category === 'professional_referral'
          ? REFERRAL_DISCLAIMER
          : null);
      const refs = JSON.stringify([{ citation: 'Curadoria do produto — solucoes_para_rotina.md (2026-05-09).' }]);
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
          s.id, s.category, s.short, s.long,
          s.priority, s.effort, risk,
          s.requiresProfessional ?? false, s.professionalType ?? null,
          s.invasiveness, s.evidence, s.clinicalPathway ?? false,
          refs, disclaimer,
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
