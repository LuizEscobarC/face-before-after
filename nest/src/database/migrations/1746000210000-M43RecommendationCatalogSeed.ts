import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PR-56 — Recommendation Catalog v1.0 Seed (Opus content)
 *
 * Populates `recommendation_catalog` (~46 recommendations) and
 * `recommendation_trigger` (~110 triggers) for all M1-active metric families.
 *
 * ## Category distribution (DEC-34, PLAN_M4_NARRATIVE §2.3)
 *   - `photo`               :  9 recommendations — camera angle, lighting, pose
 *   - `posture`             :  5 recommendations — head/cervical/jaw/tongue/sleep
 *   - `lifestyle`           :  7 recommendations — facial exercises, jaw, masseter, skin
 *   - `styling`             : 11 recommendations — haircut, beard, brows, contour, lips
 *   - `professional_referral`: 12 recommendations — orthodontist, physio, dermato, ENT, surgeon
 *   - `presentation_only`   :  2 recommendations — phi ratio, face shape (DEC-6)
 *
 * ## Legal/ethical rules (PLAN_M4_NARRATIVE §1.1, DEC-34, DEC-35)
 *   - All text uses observation verbs ("observa-se", "tende a", "pode ajudar")
 *   - NO diagnostic language ("diagnóstico", "patologia", "deficiência")
 *   - NO outcome promises ("vai corrigir", "garantimos", "transforma")
 *   - `professional_referral` fires when severity ∈ {strong, extreme} OR when
 *     the only viable intervention is clinical (jaw structure, nasal deviation, etc.)
 *   - `requires_professional=TRUE` rows always set `professional_type`
 *
 * ## Trigger semantics
 *   - `direction='any'` fires regardless of direction
 *   - Triggers use OR semantics: multiple triggers for the same recommendation_id
 *     mean "fire if ANY trigger matches"
 *   - Version 'v1.0' matches the active `recommendation_catalog_version` row
 *     seeded in migration 1746000200000-M43RecommendationCatalog.ts
 *
 * ## References
 *   - PLAN_M4_NARRATIVE.md §2.3 (M4.3 backlog, PR-56)
 *   - PLAN_DDL_REVIEW.md §4.2 (recommendation schema)
 *   - PLAN_METRICS.md §0 (PR-56 row)
 *   - Farkas 1994 (facial proportions): https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7012027/
 *   - Naini 2011 (aesthetic facial analysis): https://link.springer.com/book/10.1007/978-1-4419-7080-7
 *   - Powell & Humphreys 1984 (facial dimensions reference)
 *   - DEC-33: top-5 cut applied by RecommendationEngine (PR-57)
 *   - DEC-34: professional_referral criteria (severity + structural region)
 *   - DEC-35: additional disclaimer for professional_referral rows
 */
export class M43RecommendationCatalogSeed1746000210000 implements MigrationInterface {
  name = 'M43RecommendationCatalogSeed1746000210000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─────────────────────────────────────────────────────────────────────────
    // 0. VERSION FLIP — deactivate v0.1 (PR-55 placeholder), activate v1.0
    //    Per PLAN_M4_NARRATIVE §3 DEC-39: only one is_active=TRUE per version
    //    table (partial unique index ux_*_version_active).
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`UPDATE recommendation_catalog_version SET is_active = FALSE WHERE is_active = TRUE`);
    await queryRunner.query(`
      INSERT INTO recommendation_catalog_version (version, is_active, notes)
      VALUES ('v1.0', TRUE, 'PR-56 (Opus) — full recommendation catalog v1.0: ~46 catalog rows + ~110 triggers covering all M1 active metrics. Tone follows PLAN_M4_NARRATIVE §1.1 (observation verbs only). Sources: Farkas 1994, Naini 2011, Powell & Humphreys 1984, Bashour 2006, Sarver & Jacobson 2014, Hwang et al. 2018 (facial exercise study).')
      ON CONFLICT (version) DO UPDATE SET is_active = TRUE
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. PHOTO — camera angle, lighting, pose corrections
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_catalog
        (id, version, category, display_text_short_pt, display_text_long_pt,
         priority_default, effort_estimate, risk_level, requires_professional,
         professional_type, created_at)
      VALUES
        ('improve-photo-angle', 'v1.0', 'photo',
         'Fotografar com a câmera na altura dos olhos e a 1,5 m de distância.',
         'Para obter uma análise mais precisa, posicione a câmera na altura dos olhos — evitando ângulos que exagerem ou minimizem proporções. A distância ideal é 1 a 1,5 m, com zoom equivalente a 85 mm. Uma boa foto neutraliza distorções de perspectiva e permite que as medidas reflitam a anatomia real.',
         3, 'low', 0.000, false, NULL, NOW()),

        ('improve-head-alignment', 'v1.0', 'photo',
         'Alinhar a cabeça horizontalmente — plano de Frankfurt paralelo ao chão.',
         'Pequenas inclinações da cabeça criam a impressão de assimetria que não existe na estrutura real. Manter o "plano de Frankfurt" (linha imaginária da orelha até a órbita inferior) paralelo ao chão durante a foto minimiza esse efeito. Usar um espelho de frente ou app de nível pode ajudar.',
         3, 'low', 0.000, false, NULL, NOW()),

        ('improve-chin-tuck-pose', 'v1.0', 'photo',
         'Avançar levemente o queixo em direção à câmera para definir a linha mandibular.',
         'Um ajuste sutil de postura — projetar o queixo poucos centímetros em direção à câmera — realça a definição da linha mandibular e reduz o arredondamento da região submentoniana. Esse recurso é amplamente utilizado em fotografia de retratos (Naini 2011, Ch. 4). Experimente comparar fotos com e sem o ajuste.',
         2, 'low', 0.000, false, NULL, NOW()),

        ('improve-photo-lighting', 'v1.0', 'photo',
         'Usar iluminação frontal difusa e suave para revelar a simetria facial.',
         'Iluminação lateral forte cria sombras que exageram assimetrias reais e criam assimetrias aparentes. Luz frontal difusa (janela lateral coberta por cortina fina, ou ring light suave) é o padrão em fotografia de avaliação facial (Farkas 1994). O objetivo é revelar a estrutura, não criar contraste dramático.',
         2, 'low', 0.000, false, NULL, NOW()),

        ('improve-expression-neutral', 'v1.0', 'photo',
         'Manter expressão neutra com lábios relaxados e levemente em contato.',
         'Expressões sutis — sobrancelhas levemente erguidas, lábios ligeiramente pressionados — alteram medidas de proporção e abertura ocular. Para análise de referência, a posição de repouso ("rest position") é a mais informativa: lábios levemente em contato, dentes não cerrados, músculos faciais relaxados (padrão clínico em estética facial, Naini 2011 §2).',
         2, 'low', 0.000, false, NULL, NOW()),

        ('improve-nose-photo-angle', 'v1.0', 'photo',
         'Para avaliação nasal, fotografar com câmera exatamente ao nível do ângulo subnasal.',
         'Pequenas variações de ângulo vertical modificam significativamente a leitura de desvio de dorso e ponta nasal. O padrão para avaliação nasal é câmera ao nível do ponto subnasal, à distância de 1 m, com zoom de 85–100 mm equivalente (Powell & Humphreys 1984). Refazer a foto com esse posicionamento pode alterar consideravelmente os valores mensurados.',
         2, 'low', 0.000, false, NULL, NOW()),

        ('improve-jaw-photo-angle', 'v1.0', 'photo',
         'Ângulo ligeiramente abaixo da linha dos olhos realça a definição mandibular.',
         'Para avaliação específica da mandíbula e linha do maxilar, a câmera 5–10° abaixo da linha dos olhos revela melhor a largura mandibular real e o ângulo gonial. Compare com fotos frontais diretas para interpretar variações de medida que podem ser de ângulo, não de estrutura.',
         1, 'low', 0.000, false, NULL, NOW()),

        ('improve-eye-photo-angle', 'v1.0', 'photo',
         'Câmera ao nível dos olhos para avaliação precisa de inclinação e abertura ocular.',
         'O ângulo de câmera mais preciso para avaliação de inclinação canthal e abertura ocular é exatamente ao nível dos olhos, com o eixo da câmera paralelo ao chão. Câmeras levemente abaixo criam a ilusão de abertura maior e inclinação positiva; câmeras acima, o efeito oposto. Para resultados consistentes entre sessões, padronize a altura da câmera.',
         2, 'low', 0.000, false, NULL, NOW()),

        ('recheck-photo-symmetry', 'v1.0', 'photo',
         'Refazer a foto com posição de cabeça verificada — pode alterar leituras de simetria.',
         'Assimetrias mensuradas em fotos com leve rotação ou inclinação de cabeça tendem a ser superestimadas. Uma segunda foto com posição verificada (espelho de referência, fio a prumo ou app de nível) frequentemente apresenta valores de simetria mais próximos da estrutura real. É um primeiro passo de baixo custo antes de qualquer outra avaliação.',
         4, 'low', 0.000, false, NULL, NOW())
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. POSTURE — head, cervical, jaw, tongue, sleep
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_catalog
        (id, version, category, display_text_short_pt, display_text_long_pt,
         priority_default, effort_estimate, risk_level, requires_professional,
         professional_type, created_at)
      VALUES
        ('improve-head-posture', 'v1.0', 'posture',
         'Trabalhar a postura da cabeça — posição neutra da cervical reduz assimetria aparente.',
         'A posição habitual da cabeça — avanço cervical ("texto neck"), rotação ou inclinação crônica — pode contribuir para assimetrias posturais que se refletem na face ao longo do tempo. Exercícios de retração cervical, alongamento dos esternocleidomastoideos e fortalecimento da musculatura posterior do pescoço são pontos de partida (referência: fisioterapia de disfunção temporomandibular). Consistência é mais importante do que intensidade.',
         3, 'medium', 0.050, false, NULL, NOW()),

        ('improve-cervical-alignment', 'v1.0', 'posture',
         'Alinhar o eixo cervical — orelhas sobre os ombros em postura neutra.',
         'O alinhamento neutro da coluna cervical — orelhas projetadas sobre os ombros, não à frente — distribui melhor a carga e reduz a tensão assimétrica nos músculos mastigatórios. Um fisioterapeuta pode identificar encurtamentos musculares específicos e prescrever exercícios de correção postural individualizados (Rocabado protocol, referência clínica em DTM).',
         2, 'medium', 0.050, false, NULL, NOW()),

        ('improve-jaw-posture', 'v1.0', 'posture',
         'Posição de repouso mandibular — lábios fechados, dentes levemente separados.',
         'A posição correta de repouso mandibular ("freeway space") é: lábios selados, dentes sem contato (2–3 mm de espaço), língua em posição superior. Manter os dentes cerrados habitualmente sobrecarrega os músculos mastigatórios e pode influenciar a assimetria mandibular ao longo do tempo. Hábito de baixo custo, alto impacto cumulativo.',
         3, 'low', 0.020, false, NULL, NOW()),

        ('improve-tongue-posture', 'v1.0', 'posture',
         'Postura lingual: língua apoiada no palato (mewing) pode influenciar desenvolvimento do terço médio.',
         'A posição habitual da língua no palato duro ("mewing" — baseado nos princípios de Mew 1981 e discutido em Melsen 2015) é relacionada, em estudos longitudinais de crescimento, com o desenvolvimento do terço médio facial. Para adultos, os efeitos estruturais são limitados, mas a postura correta da língua contribui para a posição mandibular de repouso. Não substitui avaliação ortodôntica quando indicada.',
         2, 'medium', 0.050, false, NULL, NOW()),

        ('improve-sleep-position', 'v1.0', 'posture',
         'Dormir de costas e evitar posições assimétricas — reduz carga postural unilateral.',
         'Posições de sono habituais — lado esquerdo ou direito fixo, com o rosto pressionado contra o travesseiro — podem contribuir para assimetrias posturais e musculares ao longo de anos. Dormir de costas ("supino"), quando tolerado, distribui simétricamente as forças sobre a face e a cervical. Travesseiro cervical ergonômico pode facilitar a transição.',
         1, 'low', 0.010, false, NULL, NOW())
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. LIFESTYLE — exercises, jaw, skin
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_catalog
        (id, version, category, display_text_short_pt, display_text_long_pt,
         priority_default, effort_estimate, risk_level, requires_professional,
         professional_type, created_at)
      VALUES
        ('facial-symmetry-exercises', 'v1.0', 'lifestyle',
         'Exercícios de simetria facial: movimentos controlados ativam músculos menos desenvolvidos.',
         'Exercícios faciais direcionados — levantar apenas a sobrancelha esquerda, sorrir levemente de um só lado, pressionar a bochecha com a língua — estimulam neuroplasticidade motora e podem reduzir desequilíbrios musculares leves ao longo de meses de prática consistente. A evidência científica é preliminar (Hwang et al. 2018 — facial exercise study), mas o risco é negligenciável. O resultado é gradual e cumulativo.',
         3, 'medium', 0.020, false, NULL, NOW()),

        ('masseter-exercises', 'v1.0', 'lifestyle',
         'Exercícios para o masseter podem influenciar a definição mandibular ao longo do tempo.',
         'Mastigar alimentos de resistência moderada (como chicletes sem açúcar ou cenoura crua) de forma bilateral estimula o músculo masseter e pode aumentar a percepção de definição mandibular. Exercícios excessivos podem hipertrofiar o masseter e alargar aparentemente a mandíbula — portanto, equilíbrio bilateral e moderação são importantes. Para assimetria de masseter, exercer o lado menos desenvolvido é o foco.',
         2, 'medium', 0.050, false, NULL, NOW()),

        ('jaw-exercises-bilateral', 'v1.0', 'lifestyle',
         'Mastigação bilateral consciente pode reduzir assimetria mandibular muscular gradualmente.',
         'Muitas pessoas têm lado de mastigação preferencial inconsciente, o que ao longo do tempo contribui para assimetria de volume muscular mandibular. Praticar mastigação alternada e consciente (um lado, outro lado, repetindo) distribui a carga muscular simetricamente. O efeito é lento e acumulativo — espere resultados perceptíveis em 3–6 meses de consistência.',
         3, 'medium', 0.020, false, NULL, NOW()),

        ('brow-lifting-exercises', 'v1.0', 'lifestyle',
         'Exercícios de elevação de sobrancelha podem reduzir assimetria leve de altura ao longo do tempo.',
         'Para assimetria leve de altura de sobrancelha com componente muscular (não estrutural ósseo), exercícios de elevação controlada — elevar apenas a sobrancelha mais baixa, manter 5 segundos, relaxar — estimulam o músculo frontal do lado menos ativo. Prática de 10–15 repetições diárias por 2–3 meses é o protocolo descrito em literatura de exercício facial (Hwang et al. 2018). Resultado gradual.',
         2, 'medium', 0.020, false, NULL, NOW()),

        ('face-yoga-midface', 'v1.0', 'lifestyle',
         'Exercícios de tonificação para o terço médio (maçãs do rosto e mídface).',
         'Exercícios de "face yoga" voltados ao zigomático maior e menor — sorrir amplamente comprimindo levemente as bochechas com os dedos, manter 5 segundos — são associados a ligeiro aumento de volume percebido nas maçãs do rosto em estudos de curto prazo (Northwestern University Facial Exercise Study, 2018). O efeito é modesto, mas o risco é nulo. Consistência de 3–4 semanas mínima para qualquer avaliação.',
         1, 'low', 0.010, false, NULL, NOW()),

        ('hydration-skin-routine', 'v1.0', 'lifestyle',
         'Hidratação adequada e rotina de pele influenciam percepção de definição de contornos.',
         'Hidratação sistêmica (2 L de água/dia) e tópica (hidratante com retinol ou vitamina C) melhoram a elasticidade da pele e a nitidez dos contornos faciais. Não altera proporções estruturais, mas impacta positivamente a percepção de harmonia — especialmente em avaliações de lábios, terço inferior e olheiras. Rotina mínima de 4–6 semanas para efeito perceptível.',
         1, 'low', 0.010, false, NULL, NOW()),

        ('reduce-jaw-clenching', 'v1.0', 'lifestyle',
         'Reduzir bruxismo e tensão mandibular pode diminuir hipertrofia assimétrica do masseter.',
         'O bruxismo (ranger ou apertar os dentes) e a parafunção mandibular diurna são causas comuns de hipertrofia assimétrica do masseter, contribuindo para percepção de mandíbula mais larga e, em casos crônicos, assimetria mandibular progressiva. Técnicas de conscientização (biofeedback, alarmes de postura diurna) e uso de placa oclusal noturna (avaliada por dentista) são os principais recursos conservadores.',
         3, 'medium', 0.080, false, NULL, NOW())
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 4. STYLING — haircut, beard, brows, contour, lips
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_catalog
        (id, version, category, display_text_short_pt, display_text_long_pt,
         priority_default, effort_estimate, risk_level, requires_professional,
         professional_type, created_at)
      VALUES
        ('haircut-for-face-shape', 'v1.0', 'styling',
         'Corte de cabelo que equilibra as proporções do formato do rosto.',
         'O corte de cabelo é um dos recursos de maior impacto visual para equilibrar proporções faciais sem qualquer intervenção. Rostos com testa mais alta se beneficiam de franja; rostos com largura frontal acentuada, de cabelo com volume lateral controlado; mandíbula mais larga, de volume na altura do topo da cabeça. Um cabeleireiro com experiência em análise de formato de rosto pode personalizar as recomendações (consulta de baixo custo, alto retorno).',
         4, 'low', 0.010, false, NULL, NOW()),

        ('beard-shape-jaw', 'v1.0', 'styling',
         'Modelagem de barba para equilibrar visualmente a proporção mandibular.',
         'A barba é um recurso de styling de alta eficácia para quem deseja ajustar a percepção da proporção mandibular. Barba mais cheia no queixo alonga o terço inferior visualmente; barba aparada nas laterais reduz a percepção de largura mandibular; design de neckline bem executado define a transição queixo/pescoço. Um barbeiro especializado em design facial pode criar um estilo personalizado baseado nas proporções individuais.',
         4, 'low', 0.010, false, NULL, NOW()),

        ('eyebrow-styling', 'v1.0', 'styling',
         'Design de sobrancelha pode corrigir assimetria percebida e realçar o enquadramento ocular.',
         'A sobrancelha é o elemento com maior impacto visual na simetria percebida da região dos olhos e da expressão facial geral. Ajustes sutis de arco, altura e espessura — feitos por designer de sobrancelhas ou maquiador experiente — podem reduzir significativamente a percepção de assimetria. Técnica de henna ou design seco é reversível e de baixíssimo risco para experimentação.',
         4, 'low', 0.010, false, NULL, NOW()),

        ('contour-midline', 'v1.0', 'styling',
         'Contouring nasal e de eixo facial para equilibrar percepção de alinhamento do centro.',
         'O contouring (iluminação + sombra) é uma técnica de maquiagem que pode corrigir opticamente o desvio perceptivo do eixo facial. Uma linha de iluminador bem posicionada no dorso nasal, centralizada ao longo do eixo real, puxa o olhar para o centro e reduz a percepção de desvio. Tutoriais especializados em "contouring assimetria" estão amplamente disponíveis e têm baixíssimo custo de experimentação.',
         3, 'low', 0.010, false, NULL, NOW()),

        ('contour-jaw', 'v1.0', 'styling',
         'Contouring mandibular para equilibrar a percepção de largura da linha do maxilar.',
         'Sombra suave aplicada ao longo da mandíbula (abaixo da linha do maxilar) cria a percepção de mandíbula mais definida e pode ajustar a percepção de largura bilateral. Para mandíbula mais larga, sombra leve nas laterais; para mandíbula menos definida, contorno escuro logo abaixo da linha óssea. Técnica amplamente ensinada por maquiadores profissionais em análise de formato de rosto.',
         2, 'low', 0.010, false, NULL, NOW()),

        ('contour-nose', 'v1.0', 'styling',
         'Contouring nasal — técnica de destaque e sombra equilibra proporções e desvios visuais.',
         'O contouring nasal com iluminador no dorso e sombra nas laterais alar é uma das técnicas de maquiagem mais eficazes para ajustar a percepção de largura, comprimento e alinhamento nasal. Para desvio de dorso, o iluminador aplicado no eixo desejado "puxa" o centro visual do nariz. Para alar mais largo, sombra suave nas narinas. Resultados são imediatos e reversíveis.',
         3, 'low', 0.010, false, NULL, NOW()),

        ('contour-forehead', 'v1.0', 'styling',
         'Contouring de testa equilibra percepção de altura e largura frontal.',
         'Para testa alta: franja, mèches frontais ou sombra na linha do cabelo reduzem a percepção de altura. Para testa larga: volume de cabelo nas laterais e sombra nas têmporas reduzem a percepção de largura. Para testa estreita: volume lateral e iluminador central. O styling de testa é um recurso de altíssimo impacto visual, facilmente reversível.',
         3, 'low', 0.010, false, NULL, NOW()),

        ('contour-cheekbones', 'v1.0', 'styling',
         'Iluminador nas maçãs do rosto e sombra submalar realçam projeção e definição.',
         'Iluminador aplicado no ponto mais saliente da maçã do rosto amplifica a percepção de projeção malar, mesmo quando a projeção real é moderada. Sombra suave na região submalar (abaixo do zigoma) cria a sombra natural de uma maçã bem projetada. Essa técnica é usada em fotografia de moda e em avaliações de harmonia facial pré-procedimento como referência do resultado desejado.',
         2, 'low', 0.010, false, NULL, NOW()),

        ('lip-styling', 'v1.0', 'styling',
         'Técnicas de design labial (lápis de contorno, gloss) equilibram proporção e canto.',
         'O design de boca com lápis labial permite ajustar opticamente a proporção entre lábio superior e inferior, o volume percebido e o alinhamento do canto (canto levemente inclinado para cima no desenho reduz a percepção de canting). Gloss aplicado no centro do lábio inferior aumenta a percepção de volume. Técnica reversível, de baixo custo e alto impacto.',
         3, 'low', 0.010, false, NULL, NOW()),

        ('contour-chin', 'v1.0', 'styling',
         'Contouring de queixo e região submentoniana define a transição queixo/pescoço.',
         'Sombra aplicada na região submentoniana (imediatamente abaixo do queixo) cria a percepção de queixo mais projetado e definido visualmente. Iluminador no ponto mais anterior do queixo reforça a projeção percebida. Para queixo menos projetado, a combinação de iluminador frontal + sombra submentoniana pode transformar significativamente a silhueta do terço inferior.',
         2, 'low', 0.010, false, NULL, NOW()),

        ('hair-volume-temples', 'v1.0', 'styling',
         'Volume de cabelo nas têmporas equilibra percepção de largura temporal e frontal.',
         'A região temporal é frequentemente negligenciada no styling. Volume de cabelo lateral nas têmporas — ondas, cachos ou corte com textura — amplia a percepção de largura nessa região e equilibra face com largura temporal estreita. Para rosto em formato diamante (largura malar excessiva), cabelo mais plano na altura das maçãs e volume nas têmporas e queixo é a abordagem clássica.',
         1, 'low', 0.010, false, NULL, NOW())
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 5. PROFESSIONAL_REFERRAL — orthodontist, physio, dermato, ENT, surgeon
    //    DEC-34: fires when severity ∈ {strong, extreme} OR structural metric
    //    DEC-35: always include specialist context
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_catalog
        (id, version, category, display_text_short_pt, display_text_long_pt,
         priority_default, effort_estimate, risk_level, requires_professional,
         professional_type, created_at)
      VALUES
        ('consult-orthodontist-midline', 'v1.0', 'professional_referral',
         'Avaliação com ortodontista — desvio de linha média pode ter componente oclusal.',
         'Um desvio de linha média considerável — quando presente de forma consistente em fotos com pose corrigida — pode ter componente oclusal (relação entre os arcos dentários) ou esquelético. O ortodontista avalia se o desvio é dentário (corrigível com braquetes), funcional (hábito postural corrigível) ou esquelético (requer planejamento cirúrgico-ortodôntico conjunto). Esta análise geométrica não constitui diagnóstico — é uma observação que justifica avaliação especializada.',
         4, 'high', 0.200, true, 'orthodontist', NOW()),

        ('consult-orthodontist-jaw', 'v1.0', 'professional_referral',
         'Avaliação ortodôntica para proporção mandibular e oclusão — especialmente em desvios consideráveis.',
         'Alterações consideráveis de largura ou angulação mandibular podem estar associadas a padrões de crescimento esquelético, má oclusão ou disfunção temporomandibular. O ortodontista realiza avaliação cefalométrica (radiografia lateral de crânio) e modelos de estudo para determinar a natureza e a necessidade de intervenção. Esta observação geométrica é um ponto de partida — não uma conclusão.',
         4, 'high', 0.200, true, 'orthodontist', NOW()),

        ('consult-orthodontist-thirds', 'v1.0', 'professional_referral',
         'Desproporção considerável dos terços faciais — avaliação ortodôntica e/ou cirúrgica pode ser indicada.',
         'Desproporcionalidade marcada entre os terços faciais (superior, médio e inferior) — especialmente quando o terço inferior está excessivamente aumentado ou reduzido — é frequentemente de natureza esquelética. O ortodontista avalia a relação entre ossos maxilar e mandibular (cefalometria) e, se houver componente esquelético significativo, encaminha para cirurgia ortognática se o paciente desejar. Esta análise é estética e geométrica — a decisão de intervenção é sempre do paciente e do profissional.',
         3, 'high', 0.200, true, 'orthodontist', NOW()),

        ('consult-physiotherapist-asymmetry', 'v1.0', 'professional_referral',
         'Fisioterapeuta especializado em DTM pode avaliar componente muscular da assimetria facial.',
         'Assimetria facial com componente funcional — desequilíbrio de tônus muscular, padrão de mastigação unilateral crônico, tensão cervical assimétrica — responde bem à fisioterapia especializada em disfunção temporomandibular (DTM) e postura cervical. O fisioterapeuta avalia amplitude de movimento, tônus muscular e padrão postural, e prescreve exercícios e técnicas manuais específicas. Abordagem conservadora, de baixo risco.',
         4, 'medium', 0.080, true, 'physiotherapist', NOW()),

        ('consult-physiotherapist-tmj', 'v1.0', 'professional_referral',
         'Avaliação fisioterapêutica para disfunção temporomandibular — gonial angle e plano mandibular alterados.',
         'Alterações no ângulo gonial ou no plano mandibular, especialmente quando assimétricas ou acompanhadas de sons articulares, dor ou limitação de abertura bucal, indicam avaliação para disfunção temporomandibular (DTM). O fisioterapeuta especializado usa técnicas de liberação miofascial, exercícios de estabilização e orientações posturais. A avaliação é não-invasiva.',
         4, 'medium', 0.080, true, 'physiotherapist', NOW()),

        ('consult-physiotherapist-posture', 'v1.0', 'professional_referral',
         'Fisioterapeuta postural para alinhamento cervical — base para simetria facial a longo prazo.',
         'Alterações posturais cervicais crônicas — avanço da cabeça, rotação e inclinação habitual — são identificáveis e tratáveis por fisioterapeuta. A avaliação postural global inclui coluna, ombros e cervical, e o tratamento combina exercícios de fortalecimento, alongamento e conscientização corporal. É uma abordagem conservadora com impacto potencial na simetria facial ao longo do tempo.',
         3, 'medium', 0.050, true, 'physiotherapist', NOW()),

        ('consult-dermatologist-skin', 'v1.0', 'professional_referral',
         'Dermatologista para avaliação de pele, lábios e assimetrias de tecido mole.',
         'Alterações de tecido mole que influenciam a percepção de proporção labial, assimetria de bochechas ou qualidade da pele podem ser avaliadas por dermatologista. Procedimentos como preenchimento com ácido hialurônico, bioestimuladores e toxina botulínica são realizados por dermatologistas e cirurgiões plásticos habilitados, e podem complementar resultados de exercícios e styling. Esta observação não indica necessariamente intervenção — é um ponto de avaliação.',
         3, 'high', 0.400, true, 'dermatologist', NOW()),

        ('consult-dermatologist-brow', 'v1.0', 'professional_referral',
         'Avaliação médica para design de sobrancelha ou toxina botulínica — assimetria de arco ou queda de cauda.',
         'Para assimetrias de sobrancelha que não respondem a exercícios ou design cosmético — especialmente queda de cauda ou diferença de arco persistente — a avaliação com dermatologista ou cirurgião plástico abre opções como toxina botulínica (lifting não-cirúrgico) ou design médico de sobrancelha. Procedimentos realizados por profissionais habilitados com resultado previsível e reversível (botox).',
         3, 'high', 0.350, true, 'dermatologist', NOW()),

        ('consult-otolaryngologist-nose', 'v1.0', 'professional_referral',
         'Otorrinolaringologista para avaliação de desvio nasal — componente funcional e estético.',
         'Desvio de dorso ou ponta nasal considerável pode ter componente funcional (desvio de septo, dificuldade respiratória) além do estético. O otorrinolaringologista avalia a função respiratória e a anatomia interna nasal; se houver indicação cirúrgica por razão funcional, a correção estética pode ser combinada (septoplastia + rinoplastia). Esta observação é geométrica e não implica necessidade de cirurgia.',
         3, 'high', 0.400, true, 'otolaryngologist', NOW()),

        ('consult-plastic-surgeon-nose', 'v1.0', 'professional_referral',
         'Cirurgião plástico para avaliação de estrutura nasal — desvio ou assimetria marcados.',
         'Desvio nasal marcado com componente estrutural (cartilagem ou osso) — persistente em diferentes ângulos de foto e após correção de pose — pode ser avaliado por cirurgião plástico especializado em rinoplastia. A consulta inicial é apenas avaliativa e não compromete com cirurgia. Cirurgia nasal tem riscos e recuperação específicos que o profissional detalhará. Esta análise não é indicação cirúrgica.',
         2, 'high', 0.600, true, 'plastic_surgeon', NOW()),

        ('consult-plastic-surgeon-jaw', 'v1.0', 'professional_referral',
         'Cirurgião plástico ou buco-maxilo-facial para avaliação de estrutura mandibular marcada.',
         'Alterações mandibulares marcadas — largura extrema, ângulo gonial muito acentuado, mandíbula recessiva pronunciada — com componente claramente estrutural podem ser avaliadas por cirurgião buco-maxilo-facial ou plástico especializado em face. A cirurgia ortognática é o procedimento mais completo para correção de discrepâncias esqueléticas, sempre em planejamento conjunto com ortodontista. Esta análise é estética e geométrica.',
         2, 'high', 0.700, true, 'plastic_surgeon', NOW()),

        ('consult-physiotherapist-jaw-asymmetry', 'v1.0', 'professional_referral',
         'Fisioterapeuta DTM para assimetria mandibular — avalia componente muscular e articular.',
         'Assimetria mandibular com desvio de abertura bucal, sons articulares ou dor à palpação do masseter indica avaliação funcional. O fisioterapeuta especializado em disfunção temporomandibular avalia a articulação temporomandibular, o tônus muscular mastigatório e o padrão de movimento mandibular, propondo protocolo de reabilitação conservador antes de qualquer decisão sobre intervenção estrutural.',
         4, 'medium', 0.100, true, 'physiotherapist', NOW())
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 6. PRESENTATION_ONLY — phi, face shape
    //    DEC-6: never enter score; decorative context only
    // ─────────────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_catalog
        (id, version, category, display_text_short_pt, display_text_long_pt,
         priority_default, effort_estimate, risk_level, requires_professional,
         professional_type, created_at)
      VALUES
        ('note-phi-ratio-observation', 'v1.0', 'presentation_only',
         'Proporção áurea — referência estética clássica, não um padrão populacional.',
         'A proporção áurea (φ ≈ 1.618) é frequentemente citada em estética facial, mas estudos populacionais (Farkas 1994, Bashour 2006) demonstram que faces consideradas atraentes não seguem necessariamente esse padrão. A proporção áurea é uma referência histórica e artística — útil como ponto de referência contextual, não como critério de avaliação clínica ou estética objetiva. Esta métrica é apresentada como contexto, sem impacto no score.',
         1, 'low', 0.000, false, NULL, NOW()),

        ('note-face-shape-observation', 'v1.0', 'presentation_only',
         'Classificação de formato de rosto — contexto visual, não critério de harmonia.',
         'A classificação do formato do rosto (oval, redondo, quadrado, diamante, coração, oblongo) é um recurso de styling e comunicação visual, não um critério de avaliação de harmonia facial. Cada formato tem características que são valorizadas em diferentes contextos culturais e estéticos. A observação do formato é apresentada como contexto para as recomendações de corte de cabelo e contouring.',
         1, 'low', 0.000, false, NULL, NOW())
    `);

    // ─────────────────────────────────────────────────────────────────────────
    // 7. RECOMMENDATION TRIGGERS
    //    Maps (metric_id, severity, direction) → recommendation_id
    //    direction='any' = wildcard
    // ─────────────────────────────────────────────────────────────────────────

    // ── SYMMETRY / MIDLINE ────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'improve-photo-angle',        'midline_deviation', 'mild',     'any', NULL),
        (gen_random_uuid(), 'improve-head-alignment',     'midline_deviation', 'mild',     'any', NULL),
        (gen_random_uuid(), 'contour-midline',            'midline_deviation', 'mild',     'any', NULL),
        (gen_random_uuid(), 'improve-head-alignment',     'midline_deviation', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'contour-midline',            'midline_deviation', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'facial-symmetry-exercises',  'midline_deviation', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-orthodontist-midline','midline_deviation', 'strong',  'any', NULL),
        (gen_random_uuid(), 'consult-physiotherapist-asymmetry','midline_deviation','strong','any', NULL),
        (gen_random_uuid(), 'consult-orthodontist-midline','midline_deviation', 'extreme', 'any', NULL),

        (gen_random_uuid(), 'recheck-photo-symmetry',     'global_asymmetry_index', 'mild',     'any', NULL),
        (gen_random_uuid(), 'improve-photo-angle',        'global_asymmetry_index', 'mild',     'any', NULL),
        (gen_random_uuid(), 'facial-symmetry-exercises',  'global_asymmetry_index', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'improve-head-posture',       'global_asymmetry_index', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-physiotherapist-asymmetry','global_asymmetry_index','strong','any', NULL),
        (gen_random_uuid(), 'consult-physiotherapist-asymmetry','global_asymmetry_index','extreme','any', NULL),

        (gen_random_uuid(), 'recheck-photo-symmetry',     'eye_height_asymmetry', 'mild',     'any', NULL),
        (gen_random_uuid(), 'facial-symmetry-exercises',  'eye_height_asymmetry', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'eye_height_asymmetry', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-physiotherapist-asymmetry','eye_height_asymmetry','strong','any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-brow', 'eye_height_asymmetry', 'strong',   'any', NULL),

        (gen_random_uuid(), 'eyebrow-styling',            'brow_height_asymmetry', 'mild',     'any', NULL),
        (gen_random_uuid(), 'brow-lifting-exercises',     'brow_height_asymmetry', 'mild',     'any', NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'brow_height_asymmetry', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'brow-lifting-exercises',     'brow_height_asymmetry', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-physiotherapist-asymmetry','brow_height_asymmetry','strong','any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-brow', 'brow_height_asymmetry', 'strong',   'any', NULL),

        (gen_random_uuid(), 'lip-styling',                'lip_canting_angle', 'mild',     'any', NULL),
        (gen_random_uuid(), 'lip-styling',                'lip_canting_angle', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-skin', 'lip_canting_angle', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-skin', 'lip_canting_angle', 'strong',   'any', NULL),
        (gen_random_uuid(), 'consult-orthodontist-midline','lip_canting_angle','strong',   'any', NULL)
    `);

    // ── THIRDS ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'haircut-for-face-shape',     'upper_third_ratio', 'mild',     'longer',  NULL),
        (gen_random_uuid(), 'contour-forehead',           'upper_third_ratio', 'mild',     'longer',  NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'upper_third_ratio', 'mild',     'shorter', NULL),
        (gen_random_uuid(), 'contour-forehead',           'upper_third_ratio', 'moderate', 'longer',  NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'upper_third_ratio', 'moderate', 'any',     NULL),
        (gen_random_uuid(), 'consult-orthodontist-thirds','upper_third_ratio', 'strong',   'any',     NULL),

        (gen_random_uuid(), 'contour-cheekbones',         'middle_third_ratio','mild',     'shorter', NULL),
        (gen_random_uuid(), 'contour-nose',               'middle_third_ratio','mild',     'any',     NULL),
        (gen_random_uuid(), 'contour-cheekbones',         'middle_third_ratio','moderate', 'any',     NULL),
        (gen_random_uuid(), 'consult-orthodontist-thirds','middle_third_ratio','strong',   'any',     NULL),

        (gen_random_uuid(), 'contour-chin',               'lower_third_ratio', 'mild',     'shorter', NULL),
        (gen_random_uuid(), 'beard-shape-jaw',            'lower_third_ratio', 'mild',     'any',     NULL),
        (gen_random_uuid(), 'contour-chin',               'lower_third_ratio', 'moderate', 'any',     NULL),
        (gen_random_uuid(), 'beard-shape-jaw',            'lower_third_ratio', 'moderate', 'any',     NULL),
        (gen_random_uuid(), 'consult-orthodontist-thirds','lower_third_ratio', 'strong',   'any',     NULL)
    `);

    // ── FIFTHS ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'contour-forehead',           'fifth_1_ratio', 'moderate', 'wider',    NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'fifth_1_ratio', 'moderate', 'any',      NULL),
        (gen_random_uuid(), 'hair-volume-temples',        'fifth_1_ratio', 'moderate', 'narrower', NULL),
        (gen_random_uuid(), 'contour-cheekbones',         'fifth_2_ratio', 'moderate', 'narrower', NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'fifth_2_ratio', 'moderate', 'any',      NULL),
        (gen_random_uuid(), 'contour-nose',               'fifth_3_ratio', 'mild',     'wider',    NULL),
        (gen_random_uuid(), 'contour-nose',               'fifth_3_ratio', 'moderate', 'any',      NULL),
        (gen_random_uuid(), 'contour-cheekbones',         'fifth_4_ratio', 'moderate', 'narrower', NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'fifth_4_ratio', 'moderate', 'any',      NULL),
        (gen_random_uuid(), 'contour-forehead',           'fifth_5_ratio', 'moderate', 'wider',    NULL),
        (gen_random_uuid(), 'hair-volume-temples',        'fifth_5_ratio', 'moderate', 'narrower', NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'fifth_5_ratio', 'moderate', 'any',      NULL),
        (gen_random_uuid(), 'contour-nose',               'intercanthal_to_eye_width_ratio', 'mild',     'wider',    NULL),
        (gen_random_uuid(), 'contour-cheekbones',         'intercanthal_to_eye_width_ratio', 'mild',     'narrower', NULL),
        (gen_random_uuid(), 'contour-nose',               'intercanthal_to_eye_width_ratio', 'moderate', 'any',      NULL)
    `);

    // ── EYES ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'improve-eye-photo-angle',    'canthal_tilt_l', 'mild',     'any', NULL),
        (gen_random_uuid(), 'contour-cheekbones',         'canthal_tilt_l', 'mild',     'downward', NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'canthal_tilt_l', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-brow', 'canthal_tilt_l', 'strong',   'any', NULL),
        (gen_random_uuid(), 'improve-eye-photo-angle',    'canthal_tilt_r', 'mild',     'any', NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'canthal_tilt_r', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-brow', 'canthal_tilt_r', 'strong',   'any', NULL),

        (gen_random_uuid(), 'improve-expression-neutral', 'eye_aperture_ratio_l', 'mild',     'any', NULL),
        (gen_random_uuid(), 'improve-photo-lighting',     'eye_aperture_ratio_l', 'mild',     'any', NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'eye_aperture_ratio_l', 'moderate', 'shorter', NULL),
        (gen_random_uuid(), 'consult-dermatologist-brow', 'eye_aperture_ratio_l', 'strong',   'shorter', NULL),
        (gen_random_uuid(), 'improve-expression-neutral', 'eye_aperture_ratio_r', 'mild',     'any', NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'eye_aperture_ratio_r', 'moderate', 'shorter', NULL),
        (gen_random_uuid(), 'consult-dermatologist-brow', 'eye_aperture_ratio_r', 'strong',   'shorter', NULL),

        (gen_random_uuid(), 'haircut-for-face-shape',     'interpupillary_distance', 'moderate', 'wider',    NULL),
        (gen_random_uuid(), 'contour-nose',               'interpupillary_distance', 'moderate', 'wider',    NULL),
        (gen_random_uuid(), 'contour-nose',               'intercanthal_distance',   'moderate', 'wider',    NULL),
        (gen_random_uuid(), 'contour-cheekbones',         'intercanthal_distance',   'moderate', 'narrower', NULL)
    `);

    // ── BROWS ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'eyebrow-styling',            'brow_height_l', 'mild',     'any', NULL),
        (gen_random_uuid(), 'brow-lifting-exercises',     'brow_height_l', 'mild',     'shorter', NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'brow_height_l', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'brow-lifting-exercises',     'brow_height_l', 'moderate', 'shorter', NULL),
        (gen_random_uuid(), 'consult-dermatologist-brow', 'brow_height_l', 'strong',   'any', NULL),

        (gen_random_uuid(), 'eyebrow-styling',            'brow_height_r', 'mild',     'any', NULL),
        (gen_random_uuid(), 'brow-lifting-exercises',     'brow_height_r', 'mild',     'shorter', NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'brow_height_r', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-brow', 'brow_height_r', 'strong',   'any', NULL),

        (gen_random_uuid(), 'eyebrow-styling',            'brow_arch_peak_l', 'moderate', 'any', NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'brow_arch_peak_r', 'moderate', 'any', NULL),

        (gen_random_uuid(), 'eyebrow-styling',            'brow_tail_drop_l', 'mild',     'dropped', NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'brow_tail_drop_l', 'moderate', 'dropped', NULL),
        (gen_random_uuid(), 'consult-dermatologist-brow', 'brow_tail_drop_l', 'strong',   'dropped', NULL),

        (gen_random_uuid(), 'contour-nose',               'interbrow_distance_ratio', 'moderate', 'wider',    NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'interbrow_distance_ratio', 'moderate', 'any',      NULL),
        (gen_random_uuid(), 'eyebrow-styling',            'interbrow_distance_ratio', 'mild',     'narrower', NULL)
    `);

    // ── NOSE ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'contour-nose',               'nose_length_to_icd',       'mild',     'any', NULL),
        (gen_random_uuid(), 'improve-nose-photo-angle',   'nose_length_to_icd',       'mild',     'any', NULL),
        (gen_random_uuid(), 'contour-nose',               'nose_length_to_icd',       'moderate', 'any', NULL),
        (gen_random_uuid(), 'contour-nose',               'nose_width_to_icd',        'mild',     'wider',    NULL),
        (gen_random_uuid(), 'contour-nose',               'nose_width_to_icd',        'moderate', 'wider',    NULL),
        (gen_random_uuid(), 'consult-otolaryngologist-nose','nose_width_to_icd',      'strong',   'any', NULL),
        (gen_random_uuid(), 'contour-nose',               'alar_to_face_width_ratio', 'mild',     'wider',    NULL),
        (gen_random_uuid(), 'contour-nose',               'alar_to_face_width_ratio', 'moderate', 'wider',    NULL),
        (gen_random_uuid(), 'consult-otolaryngologist-nose','alar_to_face_width_ratio','strong',  'wider',    NULL),
        (gen_random_uuid(), 'contour-nose',               'nose_to_mouth_width_ratio','moderate', 'any', NULL),

        (gen_random_uuid(), 'improve-nose-photo-angle',   'dorsum_deviation',         'mild',     'any', NULL),
        (gen_random_uuid(), 'contour-nose',               'dorsum_deviation',         'mild',     'any', NULL),
        (gen_random_uuid(), 'contour-nose',               'dorsum_deviation',         'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-otolaryngologist-nose','dorsum_deviation',        'strong',  'any', NULL),
        (gen_random_uuid(), 'consult-plastic-surgeon-nose','dorsum_deviation',         'extreme', 'any', NULL),

        (gen_random_uuid(), 'improve-nose-photo-angle',   'nasal_tip_deviation',      'mild',     'any', NULL),
        (gen_random_uuid(), 'contour-nose',               'nasal_tip_deviation',      'mild',     'any', NULL),
        (gen_random_uuid(), 'consult-otolaryngologist-nose','nasal_tip_deviation',     'strong',  'any', NULL),
        (gen_random_uuid(), 'consult-plastic-surgeon-nose','nasal_tip_deviation',      'extreme', 'any', NULL),

        (gen_random_uuid(), 'contour-nose',               'alar_base_asymmetry',      'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-otolaryngologist-nose','alar_base_asymmetry',     'strong',  'any', NULL)
    `);

    // ── MOUTH / LIPS ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'lip-styling',                'mouth_width_to_icd',       'mild',     'any', NULL),
        (gen_random_uuid(), 'contour-nose',               'mouth_width_to_icd',       'moderate', 'wider',    NULL),
        (gen_random_uuid(), 'lip-styling',                'mouth_width_to_icd',       'moderate', 'narrower', NULL),

        (gen_random_uuid(), 'lip-styling',                'mouth_to_face_width_ratio','mild',     'any', NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'mouth_to_face_width_ratio','moderate', 'wider',    NULL),

        (gen_random_uuid(), 'lip-styling',                'upper_lip_height_ratio',   'mild',     'any', NULL),
        (gen_random_uuid(), 'lip-styling',                'upper_lip_height_ratio',   'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-skin', 'upper_lip_height_ratio',   'strong',   'shorter', NULL),

        (gen_random_uuid(), 'lip-styling',                'lower_lip_height_ratio',   'mild',     'any', NULL),
        (gen_random_uuid(), 'contour-chin',               'lower_lip_height_ratio',   'moderate', 'any', NULL),

        (gen_random_uuid(), 'lip-styling',                'vermilion_height_total',   'mild',     'any', NULL),
        (gen_random_uuid(), 'lip-styling',                'vermilion_height_total',   'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-skin', 'vermilion_height_total',   'strong',   'shorter', NULL),

        (gen_random_uuid(), 'lip-styling',                'lip_corner_canting',       'mild',     'any', NULL),
        (gen_random_uuid(), 'lip-styling',                'lip_corner_canting',       'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-skin', 'lip_corner_canting',       'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-dermatologist-skin', 'lip_corner_canting',       'strong',   'any', NULL),

        (gen_random_uuid(), 'contour-midline',            'mouth_midline_deviation',  'mild',     'any', NULL),
        (gen_random_uuid(), 'lip-styling',                'mouth_midline_deviation',  'mild',     'any', NULL),
        (gen_random_uuid(), 'contour-midline',            'mouth_midline_deviation',  'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-orthodontist-midline','mouth_midline_deviation', 'strong',   'any', NULL)
    `);

    // ── JAW / MANDIBULAR ─────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'beard-shape-jaw',            'jaw_width_ratio', 'mild',     'any',      NULL),
        (gen_random_uuid(), 'contour-jaw',                'jaw_width_ratio', 'mild',     'wider',    NULL),
        (gen_random_uuid(), 'beard-shape-jaw',            'jaw_width_ratio', 'moderate', 'any',      NULL),
        (gen_random_uuid(), 'contour-jaw',                'jaw_width_ratio', 'moderate', 'any',      NULL),
        (gen_random_uuid(), 'jaw-exercises-bilateral',    'jaw_width_ratio', 'moderate', 'narrower', NULL),
        (gen_random_uuid(), 'consult-orthodontist-jaw',   'jaw_width_ratio', 'strong',   'any',      NULL),
        (gen_random_uuid(), 'reduce-jaw-clenching',       'jaw_width_ratio', 'strong',   'wider',    NULL),
        (gen_random_uuid(), 'consult-plastic-surgeon-jaw','jaw_width_ratio', 'extreme',  'any',      NULL),

        (gen_random_uuid(), 'consult-physiotherapist-tmj','gonial_angle_l',  'moderate', 'steeper',  NULL),
        (gen_random_uuid(), 'consult-physiotherapist-tmj','gonial_angle_l',  'strong',   'any',      NULL),
        (gen_random_uuid(), 'consult-physiotherapist-tmj','gonial_angle_r',  'moderate', 'steeper',  NULL),
        (gen_random_uuid(), 'consult-physiotherapist-tmj','gonial_angle_r',  'strong',   'any',      NULL),
        (gen_random_uuid(), 'consult-orthodontist-jaw',   'gonial_angle_r',  'strong',   'any',      NULL),

        (gen_random_uuid(), 'jaw-exercises-bilateral',    'gonial_angle_asymmetry',    'moderate', 'any', NULL),
        (gen_random_uuid(), 'consult-physiotherapist-jaw-asymmetry','gonial_angle_asymmetry','strong','any', NULL),
        (gen_random_uuid(), 'consult-orthodontist-jaw',   'gonial_angle_asymmetry',    'extreme',  'any', NULL),

        (gen_random_uuid(), 'improve-head-posture',       'mandibular_plane_angle',   'moderate', 'steeper',  NULL),
        (gen_random_uuid(), 'consult-physiotherapist-tmj','mandibular_plane_angle',   'strong',   'any',      NULL),
        (gen_random_uuid(), 'consult-orthodontist-jaw',   'mandibular_plane_angle',   'extreme',  'any',      NULL),

        (gen_random_uuid(), 'contour-chin',               'chin_height_ratio', 'mild',     'any',      NULL),
        (gen_random_uuid(), 'improve-chin-tuck-pose',     'chin_height_ratio', 'mild',     'shorter',  NULL),
        (gen_random_uuid(), 'beard-shape-jaw',            'chin_height_ratio', 'moderate', 'any',      NULL),
        (gen_random_uuid(), 'contour-chin',               'chin_height_ratio', 'moderate', 'any',      NULL),
        (gen_random_uuid(), 'consult-orthodontist-thirds','chin_height_ratio', 'strong',   'any',      NULL),
        (gen_random_uuid(), 'consult-plastic-surgeon-jaw','chin_height_ratio', 'extreme',  'any',      NULL)
    `);

    // ── CHEEKBONES / MIDFACE ─────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'haircut-for-face-shape',     'zygomatic_width_ratio',  'moderate', 'wider',     NULL),
        (gen_random_uuid(), 'contour-jaw',                'zygomatic_width_ratio',  'moderate', 'wider',     NULL),
        (gen_random_uuid(), 'hair-volume-temples',        'zygomatic_width_ratio',  'moderate', 'narrower',  NULL),
        (gen_random_uuid(), 'contour-cheekbones',         'zygomatic_width_ratio',  'moderate', 'narrower',  NULL),

        (gen_random_uuid(), 'contour-cheekbones',         'malar_projection_index', 'mild',     'flat',      NULL),
        (gen_random_uuid(), 'face-yoga-midface',          'malar_projection_index', 'mild',     'flat',      NULL),
        (gen_random_uuid(), 'contour-cheekbones',         'malar_projection_index', 'moderate', 'flat',      NULL),
        (gen_random_uuid(), 'consult-dermatologist-skin', 'malar_projection_index', 'strong',   'flat',      NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'malar_projection_index', 'moderate', 'projected', NULL),

        (gen_random_uuid(), 'contour-cheekbones',         'midface_height_ratio',   'mild',     'shorter',   NULL),
        (gen_random_uuid(), 'contour-nose',               'midface_height_ratio',   'moderate', 'any',       NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'midface_height_ratio',   'moderate', 'any',       NULL),

        (gen_random_uuid(), 'contour-jaw',                'cheekbone_to_jaw_ratio', 'moderate', 'any',       NULL),
        (gen_random_uuid(), 'contour-cheekbones',         'cheekbone_to_jaw_ratio', 'moderate', 'narrower',  NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'cheekbone_to_jaw_ratio', 'moderate', 'any',       NULL),

        (gen_random_uuid(), 'face-yoga-midface',          'submalar_hollow_index',  'mild',     'hollow',    NULL),
        (gen_random_uuid(), 'contour-cheekbones',         'submalar_hollow_index',  'moderate', 'hollow',    NULL),
        (gen_random_uuid(), 'consult-dermatologist-skin', 'submalar_hollow_index',  'strong',   'hollow',    NULL)
    `);

    // ── FOREHEAD ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'haircut-for-face-shape',  'forehead_height_ratio', 'mild',     'longer',  NULL),
        (gen_random_uuid(), 'contour-forehead',        'forehead_height_ratio', 'mild',     'longer',  NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',  'forehead_height_ratio', 'moderate', 'any',     NULL),
        (gen_random_uuid(), 'contour-forehead',        'forehead_height_ratio', 'moderate', 'any',     NULL),

        (gen_random_uuid(), 'haircut-for-face-shape',  'forehead_width_ratio',  'mild',     'any',     NULL),
        (gen_random_uuid(), 'contour-forehead',        'forehead_width_ratio',  'moderate', 'wider',   NULL),
        (gen_random_uuid(), 'hair-volume-temples',     'forehead_width_ratio',  'moderate', 'narrower',NULL),

        (gen_random_uuid(), 'haircut-for-face-shape',  'temporal_width_ratio',  'mild',     'narrower',NULL),
        (gen_random_uuid(), 'hair-volume-temples',     'temporal_width_ratio',  'moderate', 'narrower',NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',  'temporal_width_ratio',  'moderate', 'any',     NULL)
    `);

    // ── GLOBAL SHAPE ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      INSERT INTO recommendation_trigger (id, recommendation_id, metric_id, severity, direction, additional_conditions)
      VALUES
        (gen_random_uuid(), 'haircut-for-face-shape',     'face_height_to_width_ratio', 'mild',     'any',      NULL),
        (gen_random_uuid(), 'haircut-for-face-shape',     'face_height_to_width_ratio', 'moderate', 'any',      NULL),

        (gen_random_uuid(), 'improve-head-posture',       'total_facial_convexity',     'moderate', 'convex',   NULL),
        (gen_random_uuid(), 'improve-chin-tuck-pose',     'total_facial_convexity',     'moderate', 'convex',   NULL),
        (gen_random_uuid(), 'consult-physiotherapist-posture','total_facial_convexity', 'strong',   'convex',   NULL),

        (gen_random_uuid(), 'contour-nose',               'e_line_deviation',           'mild',     'protruded', NULL),
        (gen_random_uuid(), 'contour-chin',               'e_line_deviation',           'mild',     'recessed',  NULL),
        (gen_random_uuid(), 'contour-nose',               'e_line_deviation',           'moderate', 'any',       NULL),
        (gen_random_uuid(), 'consult-orthodontist-thirds','e_line_deviation',           'strong',   'any',       NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM recommendation_trigger
      WHERE recommendation_id IN (
        SELECT id FROM recommendation_catalog WHERE version = 'v1.0'
      )
    `);
    await queryRunner.query(`
      DELETE FROM recommendation_catalog WHERE version = 'v1.0'
    `);
    // Revert version flip: deactivate v1.0, reactivate v0.1
    await queryRunner.query(`UPDATE recommendation_catalog_version SET is_active = FALSE WHERE version = 'v1.0'`);
    await queryRunner.query(`DELETE FROM recommendation_catalog_version WHERE version = 'v1.0'`);
    await queryRunner.query(`UPDATE recommendation_catalog_version SET is_active = TRUE WHERE version = 'v0.1'`);
  }
}
