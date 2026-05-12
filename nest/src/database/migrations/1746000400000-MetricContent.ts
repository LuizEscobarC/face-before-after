/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MetricContent — DDL + seed migration.
 *
 * Creates the ``metric_content`` table that backs ``GET /v1/catalog/glossary``
 * and seeds it from the (now removed) frontend bundles
 * ``frontend/src/data/glossary.ts`` and ``frontend/src/data/feynman.ts``.
 *
 * Schema:
 *   PK (metric_id, locale)
 *
 * Aliasing: the original frontend used a static ``glossaryKeyFor()`` map to
 * collapse e.g. ``canthal_tilt_left_deg``, ``canthal_tilt_right_deg`` and
 * ``canthal_tilt_mean_deg`` into one shared glossary entry. This migration
 * resolves the alias at seed-time and writes one fully-denormalised row per
 * concrete ``metric_id`` so the frontend can use the metric_id directly.
 */
import { MigrationInterface, QueryRunner } from 'typeorm';

// ---------------------------------------------------------------------------
// SHARED GLOSSARY ENTRIES (12 base concepts)
// Source: frontend/src/data/glossary.ts (verbatim, pre-removal)
// ---------------------------------------------------------------------------

interface GlossaryEntry {
  termo: string;
  unidade: string;
  descricao: string;
  como_medido: string;
  faixas: string;
  problemas_comuns: string[];
  referencias: { titulo: string; url: string }[];
}

const GLOSSARY: Record<string, GlossaryEntry> = {
  ipd: {
    termo: 'IPD — Distância Interpupilar',
    unidade: 'px (na imagem) / mm (na vida real, ~63 mm em adultos)',
    descricao:
      'Distância entre os centros das pupilas. Usamos como referência de escala para que métricas em pixels possam ser comparadas entre fotos diferentes.',
    como_medido:
      'Centro do olho esquerdo (média dos landmarks 36..41) e do direito (42..47); norma euclidiana entre os dois centros, em pixels.',
    faixas: 'Adulto típico: 54–74 mm. Em pixels depende da resolução.',
    problemas_comuns: [
      'Foto não-frontal subestima IPD',
      'Lente curta (selfie) distorce IPD',
    ],
    referencias: [
      { titulo: 'Wikipedia — Pupillary distance', url: 'https://en.wikipedia.org/wiki/Pupillary_distance' },
      { titulo: 'Dodgson 2004 — Variation and extrema of human IPD', url: 'https://www.cl.cam.ac.uk/~nad10/pubs/SPIE5291A-36.pdf' },
    ],
  },

  fwhr: {
    termo: 'fWHR — Facial Width-to-Height Ratio',
    unidade: 'razão adimensional',
    descricao: 'Largura bizigomática dividida pela altura entre lábio superior e linha das sobrancelhas.',
    como_medido: '‖p0 − p16‖ / (y(p51) − y(média(p19,p24))). Implementação em face_metrics.proportions.',
    faixas: 'Masculino típico: 1.7–2.0. Ideal estético: ~1.85.',
    problemas_comuns: [
      'Pose com pitch para cima/baixo distorce a altura',
      'Cabelo cobrindo testa pode falsear a sobrancelha detectada',
    ],
    referencias: [
      { titulo: 'Lefevre 2012 — fWHR e dominância', url: 'https://doi.org/10.1098/rspb.2012.0884' },
      { titulo: 'Wikipedia — fWHR', url: 'https://en.wikipedia.org/wiki/Facial_width-to-height_ratio' },
    ],
  },

  canthal_tilt: {
    termo: 'Canthal Tilt',
    unidade: 'graus (°)',
    descricao: 'Inclinação da linha que une o canto medial e o lateral do olho. Positivo = canto lateral mais alto.',
    como_medido:
      'atan2(Δy, |Δx|) entre landmarks medial (39/42) e lateral (36/45). Como o canto lateral é sempre temporal, |Δx| é equivalente a Δx anatomicamente; se a relação se inverter (landmark falho), a métrica retorna null em vez de valor enganoso.',
    faixas: 'Atrativo masculino: +3° a +8°. Negativo dá ar cansado.',
    problemas_comuns: [
      'Roll da cabeça aparenta tilt onde não há',
      'Edema palpebral muda o ponto detectado',
    ],
    referencias: [
      { titulo: 'Rhee SC 2012', url: 'https://pubmed.ncbi.nlm.nih.gov/22743893/' },
      { titulo: 'Wikipedia — Canthus', url: 'https://en.wikipedia.org/wiki/Canthus' },
    ],
  },

  gonial_angle: {
    termo: 'Ângulo Gonial',
    unidade: 'graus (°)',
    descricao: 'Ângulo formado no canto inferior da mandíbula (gônio).',
    como_medido: 'Ângulo entre vetores (gônio→têmpora) e (gônio→mento) usando landmarks 4/12, 0/16 e 8.',
    faixas: 'Masculino típico: 110°–130°. Quanto menor, mais quadrada/definida.',
    problemas_comuns: [
      'Pose 3/4 muda projeção do gônio',
      'Adiposidade submentoniana mascara o ponto real',
    ],
    referencias: [
      { titulo: 'Naini — Facial Aesthetics (capítulo mandibular)', url: 'https://onlinelibrary.wiley.com/doi/10.1002/9781118786109' },
    ],
  },

  marquardt: {
    termo: 'Desvio bilateral global (Marquardt)',
    unidade: '% IPD',
    descricao: 'Quanto cada landmark do lado direito desvia da posição espelhada do equivalente do esquerdo.',
    como_medido: 'Reflete cada landmark direito sobre x_midline e calcula RMSE com o esquerdo correspondente; resultado dividido pela IPD.',
    faixas: 'Excelente: <1%. Severo: >8%.',
    problemas_comuns: [
      'Roll/yaw produz pseudo-assimetria',
      'Linha média mal estimada amplifica o erro',
    ],
    referencias: [
      { titulo: 'Marquardt — Phi Mask', url: 'https://en.wikipedia.org/wiki/Marquardt_Beauty_Mask' },
    ],
  },

  skin_uniformity: {
    termo: 'Uniformidade da pele (LAB std magnitude)',
    unidade: 'magnitude do vetor de desvios em CIE Lab',
    descricao:
      'Mede o quanto o tom da pele varia dentro da bochecha/testa. NÃO é Delta-E — é a magnitude do vetor [σ_L, σ_a, σ_b] dentro do ROI; rostos uniformemente iluminados e sem manchas tendem a 0.',
    como_medido:
      'Converte ROI para Lab, calcula desvio-padrão por canal, devolve a norma euclidiana do vetor de desvios. Implementação em face_metrics._roi_std_lab.',
    faixas: 'Excelente <10. Aceitável <15. Visivelmente irregular >25.',
    problemas_comuns: [
      'Sombras laterais aumentam σ_L sem haver lesão',
      'Barba ou cabelo dentro da ROI inflam todos os canais',
    ],
    referencias: [
      { titulo: 'OpenCV — cvtColor BGR2Lab', url: 'https://docs.opencv.org/4.x/de/d25/imgproc_color_conversions.html' },
    ],
  },

  under_eye_darkness: {
    termo: 'Olheiras (escuridão infra-orbital)',
    unidade: 'razão em [0, 1]',
    descricao:
      'Quanto a região logo abaixo do olho é mais escura que a bochecha média. 0 = igual à bochecha (saudável); >0.2 = olheira visível.',
    como_medido:
      '(L_bochecha − L_under) / L_bochecha em CIE Lab, clampado em [0, 1]. Inverte sinal automaticamente quando a iluminação satura a bochecha.',
    faixas: 'Excelente <0.05. Visível 0.10–0.20. Severo >0.25.',
    problemas_comuns: [
      'Iluminação por baixo cria sombra que vira falso-positivo',
      'Maquiagem corretiva mascara olheira real',
    ],
    referencias: [
      { titulo: 'Mac-Mary 2019 — Quantification of skin tone heterogeneity', url: 'https://onlinelibrary.wiley.com/doi/10.1111/srt.12715' },
    ],
  },

  jawline_definition_score: {
    termo: 'Definição da linha mandibular',
    unidade: 'desvio-padrão de ângulos (clampado em [0, 30])',
    descricao:
      'Mede o quão consistente é o contorno mandibular. Valores baixos indicam uma linha contínua e nítida; valores altos refletem irregularidade ou landmarks ruidosos (clampados em 30 para não explodir o score derivado).',
    como_medido:
      'Calcula o ângulo entre segmentos consecutivos da jawline (landmarks 0–16); retorna std(ângulos) limitada a 30.',
    faixas: 'Excelente <5. Aceitável <12. Suspeito >20 (revisar landmarks).',
    problemas_comuns: [
      'Adiposidade submentoniana suaviza segmentos sem indicar má-definição estrutural',
      'Pose 3/4 deforma os ângulos',
    ],
    referencias: [
      { titulo: 'Naini — Facial Aesthetics (capítulo mandibular)', url: 'https://onlinelibrary.wiley.com/doi/10.1002/9781118786109' },
    ],
  },

  lab_delta_e: {
    termo: 'ΔE Lab — Diferença perceptual de cor',
    unidade: 'unidades CIE Lab (DE76)',
    descricao: 'Distância no espaço Lab. Aproxima o quanto duas regiões parecem diferentes a olho nu.',
    como_medido: 'Converte ROIs para Lab, calcula a diferença euclidiana média entre a cor das bochechas esquerda e direita.',
    faixas: '<2 = imperceptível; 2–10 = perceptível; >10 = muito visível.',
    problemas_comuns: [
      'Iluminação lateral assimétrica fabrica ΔE alto sem haver lesão',
      'Reflexos de óculos ou cabelo sobre a face poluem a ROI',
    ],
    referencias: [
      { titulo: 'Wikipedia — Color difference', url: 'https://en.wikipedia.org/wiki/Color_difference' },
      { titulo: 'OpenCV — cvtColor BGR2Lab', url: 'https://docs.opencv.org/4.x/de/d25/imgproc_color_conversions.html' },
    ],
  },

  laplacian_sharpness: {
    termo: 'Sharpness Laplaciana',
    unidade: 'variância (adimensional)',
    descricao: 'Estimador de nitidez. Quanto maior a variância da Laplaciana, mais nítida a foto.',
    como_medido: 'cv2.Laplacian(grayscale, CV_64F).var() sobre a região da face.',
    faixas: 'Tipicamente: <100 borrado, 100–500 ok, >500 nítido.',
    problemas_comuns: [
      'Imagem comprimida em JPG agressivo gera valor falso baixo',
      'Textura (barba, sardas) eleva o valor mesmo em imagem desfocada',
    ],
    referencias: [
      { titulo: 'Pech-Pacheco 2000 — Diatom autofocusing', url: 'https://ieeexplore.ieee.org/document/903548' },
      { titulo: 'OpenCV — Laplacian', url: 'https://docs.opencv.org/4.x/d4/d86/group__imgproc__filter.html' },
    ],
  },

  solvepnp_pose: {
    termo: 'Pose da cabeça (yaw/pitch/roll)',
    unidade: 'graus (°)',
    descricao: 'Orientação 3D da cabeça em relação à câmera.',
    como_medido:
      'cv2.solvePnP com 6 landmarks (nariz, queixo, cantos dos olhos e da boca) contra um modelo 3D genérico em mm; matriz de rotação decomposta via cv2.RQDecomp3x3.',
    faixas: 'Frontal aceitável: |yaw|≤7° e |pitch|≤7°. Roll tolera ±5° (girando a foto resolve).',
    problemas_comuns: [
      'Sem calibração de câmera, focal aproximada (=largura) introduz erro',
      'Smile + mouth corners deslocados afetam pose estimada',
    ],
    referencias: [
      { titulo: 'Mallick — Head Pose Estimation tutorial', url: 'https://learnopencv.com/head-pose-estimation-using-opencv-and-dlib/' },
      { titulo: 'OpenCV — solvePnP', url: 'https://docs.opencv.org/4.x/d9/d0c/group__calib3d.html#ga549c2075fac14829ff4a58bc931c033d' },
    ],
  },

  thirds_fifths: {
    termo: 'Cânones neoclássicos (terços e quintos)',
    unidade: 'razão adimensional',
    descricao: 'Regras estéticas históricas: face dividida em 3 alturas iguais e 5 larguras iguais.',
    como_medido: 'Razões entre alturas (trichion-glabella-nasion-mento) e larguras (faces e olhos).',
    faixas: 'Desvio padrão das razões idealmente 0; aceitável <0.03.',
    problemas_comuns: [
      'Trichion (linha do cabelo) é estimado por reflexão — calvície altera',
      'Sorriso e expressão alteram boca/olhos',
    ],
    referencias: [
      { titulo: 'Wikipedia — Neoclassical canons', url: 'https://en.wikipedia.org/wiki/Neoclassical_canons_of_facial_proportions' },
    ],
  },

  face_shape: {
    termo: 'Forma facial',
    unidade: 'rótulo (oval, oblongo, etc.)',
    descricao: 'Silhueta classificada por razões altura/largura e zigomática/bigonial.',
    como_medido: 'Regras heurísticas sobre as razões; ver face_metrics.face_shape().',
    faixas: 'Não há ‘ideal’; cada formato pede grooming distinto.',
    problemas_comuns: ['Cabelo/barba mudam silhueta percebida'],
    referencias: [
      { titulo: 'GQ — face shape guide', url: 'https://www.gq.com/story/grooming-tips-by-face-shape' },
    ],
  },

  ear: {
    termo: 'EAR — Eye Aspect Ratio',
    unidade: 'razão adimensional',
    descricao: 'Razão entre alturas e largura do olho. Detecta abertura ocular (piscadas).',
    como_medido: '(‖p1−p5‖ + ‖p2−p4‖) / (2·‖p0−p3‖) sobre os 6 pontos do olho.',
    faixas: 'Aberto: 0.25–0.35. Fechado: <0.20.',
    problemas_comuns: ['Foto com olhos parcialmente fechados rebaixa EAR'],
    referencias: [
      { titulo: 'Soukupová & Čech 2016 — Real-Time Eye Blink Detection', url: 'https://vision.fe.uni-lj.si/cvww2016/proceedings/papers/05.pdf' },
    ],
  },
};

// ---------------------------------------------------------------------------
// ALIAS MAP (metric_id → glossary_key)
// Source: frontend/src/components/MetricExplainer.tsx::glossaryKeyFor (verbatim)
// ---------------------------------------------------------------------------
const ALIAS_TO_GLOSSARY_KEY: Record<string, string> = {
  fwhr: 'fwhr',
  canthal_tilt_left_deg: 'canthal_tilt',
  canthal_tilt_right_deg: 'canthal_tilt',
  canthal_tilt_mean_deg: 'canthal_tilt',
  gonial_angle_left_deg: 'gonial_angle',
  gonial_angle_right_deg: 'gonial_angle',
  gonial_angle_mean_deg: 'gonial_angle',
  marquardt_deviation_pct_ipd: 'marquardt',
  marquardt_deviation_px: 'marquardt',
  skin_uniformity_std_lab_left: 'skin_uniformity',
  skin_uniformity_std_lab_right: 'skin_uniformity',
  skin_uniformity_std_lab_forehead: 'skin_uniformity',
  skin_lighting_delta_e_lr: 'lab_delta_e',
  lighting_asymmetry_delta_e: 'lab_delta_e',
  under_eye_darkness_left: 'under_eye_darkness',
  under_eye_darkness_right: 'under_eye_darkness',
  sharpness_laplacian_var: 'laplacian_sharpness',
  head_pose_yaw_deg: 'solvepnp_pose',
  head_pose_pitch_deg: 'solvepnp_pose',
  head_pose_roll_deg: 'solvepnp_pose',
  thirds_std_dev: 'thirds_fifths',
  fifths_std_dev: 'thirds_fifths',
  thirds_upper_ratio: 'thirds_fifths',
  thirds_middle_ratio: 'thirds_fifths',
  thirds_lower_ratio: 'thirds_fifths',
  jawline_definition_score: 'jawline_definition_score',
  ipd_px: 'ipd',
};

// ---------------------------------------------------------------------------
// FEYNMAN — plain-language analogies, keyed by full metric_id.
// Source: frontend/src/data/feynman.ts (verbatim)
// ---------------------------------------------------------------------------
const FEYNMAN: Record<string, string> = {
  fwhr:
    "Mostra se seu rosto é mais largo que alto. Imagina dois retângulos: um quase quadrado passa 'imponência' e força; um magrinho passa suavidade. Não é melhor nem pior — é o que cada formato comunica em fotos.",
  bizygomatic_to_bigonial_ratio:
    "Compara a largura do alto do rosto (na altura das maçãs) com a do queixo. Quando as maçãs são mais largas, o rosto parece mais 'esculpido'. Quando o queixo é tão largo quanto, o rosto parece mais sólido.",
  jaw_width_pct_ipd:
    'É o quanto a sua mandíbula é larga em relação à distância dos olhos. Mandíbula mais larga = aparência mais marcada. Mais estreita = mais suave.',
  lower_third_ratio:
    'É o quanto o terço de baixo do rosto (do nariz até o queixo) ocupa do total. Mais alto = queixo mais imponente; mais baixo = boca mais comprimida.',
  thirds_std_dev:
    "Os artistas dividem o rosto em 3 alturas iguais (testa, meio, queixo). Quanto mais parecidas, mais 'harmônico' parece. É a mesma coisa que dividir um pão em 3 fatias iguais — se uma é gorda demais, a gente repara.",
  thirds_upper_ratio:
    'Tamanho da testa em relação ao rosto inteiro. Testa muito alta puxa atenção para cima; muito baixa, para o meio.',
  thirds_middle_ratio: 'Quanto a região central (olhos até o nariz) ocupa do rosto.',
  thirds_lower_ratio:
    "Quanto a região do nariz até o queixo ocupa. É onde mora a 'presença' do queixo.",
  fifths_std_dev:
    'Os mesmos artistas dividem a largura do rosto em 5 partes iguais (uma para cada olho, três para os espaços entre eles e as têmporas). Quanto mais iguais, mais simétrico parece.',
  canthal_tilt_mean_deg:
    'É a inclinação dos seus olhos. Se a ponta de fora do olho está mais alta que a de dentro, o ângulo é positivo — passa energia juvenil. Se está mais baixa, dá cara de cansaço, mesmo se você dormiu bem.',
  canthal_tilt_left_deg: 'Inclinação só do olho esquerdo. Idealmente os dois lados são parecidos.',
  canthal_tilt_right_deg: 'Inclinação só do olho direito.',
  intercanthal_to_eyewidth_ratio:
    "Compara o espaço entre os olhos com a largura de cada olho. O 'ideal estético' clássico diz: o espaço entre os olhos deve caber um olho inteiro.",
  eye_aspect_ratio_mean:
    'Mede o quão abertos seus olhos estão na foto. Mais aberto = energia. Mais fechado = pode parecer cansaço, mesmo que seja só seu jeito natural.',
  eye_aspect_ratio_left: 'Abertura só do olho esquerdo.',
  eye_aspect_ratio_right: 'Abertura só do olho direito.',
  brow_to_eyelid_mean_pct_ipd:
    "Distância entre a sobrancelha e a pálpebra. Curta = olhar 'pesado'. Longa = olhar 'aberto'. Tudo relativo à sua cabeça (% IPD).",
  brow_tilt_left_deg:
    "Inclinação da sobrancelha esquerda. Sobrancelha mais erguida na ponta = expressão mais 'levantada'.",
  brow_tilt_right_deg: 'Inclinação da sobrancelha direita.',
  gonial_angle_mean_deg:
    "Ângulo do canto da mandíbula. Quanto menor, mais 'quadrada' a mandíbula parece. Quanto maior, mais arredondada.",
  jawline_definition_score:
    'É o quão nítida e contínua é a linha do seu queixo. Linha bem definida = sombra clara entre rosto e pescoço, parece mais força. Linha menos definida = mais suavidade.',
  chin_projection_pct_ipd:
    'O quanto o queixo se projeta para frente em relação aos lábios. Mais projetado = perfil mais marcado.',
  mouth_to_ipd_ratio:
    "Quanto a boca é larga em relação ao espaço entre os olhos. Boca proporcional dá 'equilíbrio'; muito pequena ou muito larga puxa atenção sem necessidade.",
  upper_lower_lip_ratio:
    "Compara a espessura do lábio de cima com o de baixo. Lábio inferior um pouco mais cheio é o que costuma ser visto como 'natural'.",
  philtrum_length_pct_ipd:
    "Distância entre o nariz e o lábio superior. Curto = olhar mais juvenil; longo = aspecto mais 'sério'.",
  nasal_to_mouth_width_ratio:
    'Compara a largura das narinas com a largura da boca. Quando a boca é cerca de 1.4× a largura do nariz, o rosto parece equilibrado.',
  alar_intercanthal_alignment_pct:
    'Verifica se a largura das narinas bate com o espaço entre os olhos (referência clássica neoclássica).',
  overall_asymmetry_score_pct_ipd:
    'Mede o quanto seu rosto NÃO é igual dos dois lados. Todo mundo tem alguma assimetria — a questão é se o olho percebe. Abaixo de 2% é invisível; acima disso o cérebro começa a reparar sem saber por quê.',
  marquardt_deviation_pct_ipd:
    'Pega cada ponto do seu rosto e compara com o ponto espelhado do outro lado. Quanto mais diferentes, maior o desvio. É como dobrar uma foto ao meio e ver onde os contornos não batem.',
  eye_level_difference_pct_ipd:
    'Diferença de altura entre os dois olhos. Geralmente é causada por inclinação da cabeça na hora da foto.',
  eye_horizontal_asymmetry_pct_ipd:
    'Diferença de posição horizontal entre os dois olhos em relação ao centro do rosto.',
  nose_deviation_pct_ipd: 'O quanto a ponta do nariz desvia da linha central do rosto.',
  nose_wings_asymmetry_pct_ipd: 'Diferença entre o tamanho/posição das duas asas do nariz.',
  mouth_center_deviation_pct_ipd:
    'Quanto o centro do lábio superior desvia da linha do nariz.',
  mouth_corners_asymmetry_pct_ipd: 'Diferença de altura entre os dois cantos da boca.',
  chin_deviation_pct_ipd: 'Quanto o queixo desvia da linha central do rosto.',
  jawline_mean_asymmetry_pct_ipd:
    'Média de quanto o lado esquerdo da mandíbula difere do lado direito espelhado.',
  skin_uniformity_std_lab_left:
    'Mede o quanto o tom da sua pele varia naquela bochecha. Pele lisa, bem iluminada = número baixo. Manchas, sombras ou textura forte = número alto.',
  skin_uniformity_std_lab_right: 'Mesma medida do outro lado.',
  skin_uniformity_std_lab_forehead:
    'Mesma medida, mas na testa. Como tem menos textura natural, costuma ser mais limpa.',
  skin_lighting_delta_e_lr:
    'Diferença de cor/luz entre as duas bochechas. Em luz frontal e simétrica isso é quase zero. Quando uma luz vem só de um lado, a sombra puxa o número para cima.',
  under_eye_darkness_left:
    'Olheira do olho esquerdo: o quanto a região logo abaixo do olho é mais escura que a bochecha. Zero = sem olheira. Acima de 0.2 já aparece visivelmente.',
  under_eye_darkness_right: 'Mesma medida do lado direito.',
  head_pose_yaw_deg:
    'O quanto sua cabeça está virada para o lado. Acima de 7° já vira de perfil e bagunça métricas frontais.',
  head_pose_pitch_deg:
    'O quanto sua cabeça está inclinada para cima ou para baixo. Acima de 7° o nariz some ou ganha sombra estranha.',
  head_pose_roll_deg:
    'O quanto sua cabeça está tombada para o lado (como se fosse encostar a orelha no ombro).',
  sharpness_laplacian_var:
    'Estimador de nitidez. Quanto maior, mais nítida a foto. Abaixo de 50 está borrada e as métricas perdem confiança.',
  focal_distortion_ratio:
    "Selfies muito próximas (< 30cm) deformam o nariz, deixando ele 'maior do que é'. Esse número detecta se isso aconteceu.",
  lighting_asymmetry_delta_e:
    'O quanto a luz da foto bate em um lado mais que no outro. Luz lateral cria sombra e fabrica assimetria que não existe no rosto.',
  face_pixel_width:
    'Quantos pixels de largura sua face ocupa. Abaixo de 200, a foto não tem resolução suficiente para detectar bem os detalhes.',
};

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

export class MetricContent1746000400000 implements MigrationInterface {
  name = 'MetricContent1746000400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // 1. DDL
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS metric_content (
        metric_id     TEXT NOT NULL,
        locale        TEXT NOT NULL DEFAULT 'pt-BR',
        feynman_text  TEXT,
        description   TEXT,
        how_measured  TEXT,
        ranges_text   TEXT,
        common_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
        "references"  JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (metric_id, locale)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_metric_content_metric_id ON metric_content (metric_id)`,
    );

    // 2. Build the seed rowset.
    //    Union of FEYNMAN keys and ALIAS_TO_GLOSSARY_KEY keys.
    //    Each row gets its feynman_text directly; the technical glossary
    //    fields come from the entry referenced by ALIAS_TO_GLOSSARY_KEY,
    //    or from a same-keyed glossary entry if no alias exists.
    const metricIds = new Set<string>([
      ...Object.keys(FEYNMAN),
      ...Object.keys(ALIAS_TO_GLOSSARY_KEY),
    ]);

    for (const metricId of metricIds) {
      const glossaryKey = ALIAS_TO_GLOSSARY_KEY[metricId] ?? metricId;
      const glossary = GLOSSARY[glossaryKey] ?? null;
      const feynmanText = FEYNMAN[metricId] ?? null;

      await queryRunner.query(
        `
        INSERT INTO metric_content
          (metric_id, locale, feynman_text, description, how_measured,
           ranges_text, common_issues, "references")
        VALUES
          ($1, 'pt-BR', $2, $3, $4, $5, $6::jsonb, $7::jsonb)
        ON CONFLICT (metric_id, locale) DO UPDATE SET
          feynman_text  = EXCLUDED.feynman_text,
          description   = EXCLUDED.description,
          how_measured  = EXCLUDED.how_measured,
          ranges_text   = EXCLUDED.ranges_text,
          common_issues = EXCLUDED.common_issues,
          "references"  = EXCLUDED."references",
          updated_at    = NOW()
        `,
        [
          metricId,
          feynmanText,
          glossary?.descricao ?? null,
          glossary?.como_medido ?? null,
          glossary?.faixas ?? null,
          JSON.stringify(glossary?.problemas_comuns ?? []),
          JSON.stringify(glossary?.referencias ?? []),
        ],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS metric_content`);
  }
}
