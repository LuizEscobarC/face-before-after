/**
 * Analogias estilo Feynman: explicar como se a pessoa tivesse 5 anos.
 * Fica acima da explicação técnica (que vem do glossário).
 *
 * Chave = nome exato da métrica que sai do backend.
 * Para grupos (skin_uniformity_*), preferir reutilizar texto curto e direto.
 */

export const FEYNMAN_EXPLANATIONS: Record<string, string> = {
  // Estrutura facial
  fwhr:
    "Mostra se seu rosto é mais largo que alto. Imagina dois retângulos: um quase quadrado passa 'imponência' e força; um magrinho passa suavidade. Não é melhor nem pior — é o que cada formato comunica em fotos.",
  bizygomatic_to_bigonial_ratio:
    "Compara a largura do alto do rosto (na altura das maçãs) com a do queixo. Quando as maçãs são mais largas, o rosto parece mais 'esculpido'. Quando o queixo é tão largo quanto, o rosto parece mais sólido.",
  jaw_width_pct_ipd:
    "É o quanto a sua mandíbula é larga em relação à distância dos olhos. Mandíbula mais larga = aparência mais marcada. Mais estreita = mais suave.",
  lower_third_ratio:
    "É o quanto o terço de baixo do rosto (do nariz até o queixo) ocupa do total. Mais alto = queixo mais imponente; mais baixo = boca mais comprimida.",
  thirds_std_dev:
    "Os artistas dividem o rosto em 3 alturas iguais (testa, meio, queixo). Quanto mais parecidas, mais 'harmônico' parece. É a mesma coisa que dividir um pão em 3 fatias iguais — se uma é gorda demais, a gente repara.",
  thirds_upper_ratio:
    "Tamanho da testa em relação ao rosto inteiro. Testa muito alta puxa atenção para cima; muito baixa, para o meio.",
  thirds_middle_ratio:
    "Quanto a região central (olhos até o nariz) ocupa do rosto.",
  thirds_lower_ratio:
    "Quanto a região do nariz até o queixo ocupa. É onde mora a 'presença' do queixo.",
  fifths_std_dev:
    "Os mesmos artistas dividem a largura do rosto em 5 partes iguais (uma para cada olho, três para os espaços entre eles e as têmporas). Quanto mais iguais, mais simétrico parece.",

  // Olhos / mandíbula / olhar
  canthal_tilt_mean_deg:
    "É a inclinação dos seus olhos. Se a ponta de fora do olho está mais alta que a de dentro, o ângulo é positivo — passa energia juvenil. Se está mais baixa, dá cara de cansaço, mesmo se você dormiu bem.",
  canthal_tilt_left_deg:
    "Inclinação só do olho esquerdo. Idealmente os dois lados são parecidos.",
  canthal_tilt_right_deg:
    "Inclinação só do olho direito.",
  intercanthal_to_eyewidth_ratio:
    "Compara o espaço entre os olhos com a largura de cada olho. O 'ideal estético' clássico diz: o espaço entre os olhos deve caber um olho inteiro.",
  eye_aspect_ratio_mean:
    "Mede o quão abertos seus olhos estão na foto. Mais aberto = energia. Mais fechado = pode parecer cansaço, mesmo que seja só seu jeito natural.",
  eye_aspect_ratio_left:
    "Abertura só do olho esquerdo.",
  eye_aspect_ratio_right:
    "Abertura só do olho direito.",
  brow_to_eyelid_mean_pct_ipd:
    "Distância entre a sobrancelha e a pálpebra. Curta = olhar 'pesado'. Longa = olhar 'aberto'. Tudo relativo à sua cabeça (% IPD).",
  brow_tilt_left_deg:
    "Inclinação da sobrancelha esquerda. Sobrancelha mais erguida na ponta = expressão mais 'levantada'.",
  brow_tilt_right_deg:
    "Inclinação da sobrancelha direita.",
  gonial_angle_mean_deg:
    "Ângulo do canto da mandíbula. Quanto menor, mais 'quadrada' a mandíbula parece. Quanto maior, mais arredondada.",
  jawline_definition_score:
    "É o quão nítida e contínua é a linha do seu queixo. Linha bem definida = sombra clara entre rosto e pescoço, parece mais força. Linha menos definida = mais suavidade.",
  chin_projection_pct_ipd:
    "O quanto o queixo se projeta para frente em relação aos lábios. Mais projetado = perfil mais marcado.",

  // Boca e nariz
  mouth_to_ipd_ratio:
    "Quanto a boca é larga em relação ao espaço entre os olhos. Boca proporcional dá 'equilíbrio'; muito pequena ou muito larga puxa atenção sem necessidade.",
  upper_lower_lip_ratio:
    "Compara a espessura do lábio de cima com o de baixo. Lábio inferior um pouco mais cheio é o que costuma ser visto como 'natural'.",
  philtrum_length_pct_ipd:
    "Distância entre o nariz e o lábio superior. Curto = olhar mais juvenil; longo = aspecto mais 'sério'.",
  nasal_to_mouth_width_ratio:
    "Compara a largura das narinas com a largura da boca. Quando a boca é cerca de 1.4× a largura do nariz, o rosto parece equilibrado.",
  alar_intercanthal_alignment_pct:
    "Verifica se a largura das narinas bate com o espaço entre os olhos (referência clássica neoclássica).",

  // Simetria
  overall_asymmetry_score_pct_ipd:
    "Mede o quanto seu rosto NÃO é igual dos dois lados. Todo mundo tem alguma assimetria — a questão é se o olho percebe. Abaixo de 2% é invisível; acima disso o cérebro começa a reparar sem saber por quê.",
  marquardt_deviation_pct_ipd:
    "Pega cada ponto do seu rosto e compara com o ponto espelhado do outro lado. Quanto mais diferentes, maior o desvio. É como dobrar uma foto ao meio e ver onde os contornos não batem.",
  eye_level_difference_pct_ipd:
    "Diferença de altura entre os dois olhos. Geralmente é causada por inclinação da cabeça na hora da foto.",
  eye_horizontal_asymmetry_pct_ipd:
    "Diferença de posição horizontal entre os dois olhos em relação ao centro do rosto.",
  nose_deviation_pct_ipd:
    "O quanto a ponta do nariz desvia da linha central do rosto.",
  nose_wings_asymmetry_pct_ipd:
    "Diferença entre o tamanho/posição das duas asas do nariz.",
  mouth_center_deviation_pct_ipd:
    "Quanto o centro do lábio superior desvia da linha do nariz.",
  mouth_corners_asymmetry_pct_ipd:
    "Diferença de altura entre os dois cantos da boca.",
  chin_deviation_pct_ipd:
    "Quanto o queixo desvia da linha central do rosto.",
  jawline_mean_asymmetry_pct_ipd:
    "Média de quanto o lado esquerdo da mandíbula difere do lado direito espelhado.",

  // Pele / olheiras
  skin_uniformity_std_lab_left:
    "Mede o quanto o tom da sua pele varia naquela bochecha. Pele lisa, bem iluminada = número baixo. Manchas, sombras ou textura forte = número alto.",
  skin_uniformity_std_lab_right:
    "Mesma medida do outro lado.",
  skin_uniformity_std_lab_forehead:
    "Mesma medida, mas na testa. Como tem menos textura natural, costuma ser mais limpa.",
  skin_lighting_delta_e_lr:
    "Diferença de cor/luz entre as duas bochechas. Em luz frontal e simétrica isso é quase zero. Quando uma luz vem só de um lado, a sombra puxa o número para cima.",
  under_eye_darkness_left:
    "Olheira do olho esquerdo: o quanto a região logo abaixo do olho é mais escura que a bochecha. Zero = sem olheira. Acima de 0.2 já aparece visivelmente.",
  under_eye_darkness_right:
    "Mesma medida do lado direito.",

  // Qualidade da foto
  head_pose_yaw_deg:
    "O quanto sua cabeça está virada para o lado. Acima de 7° já vira de perfil e bagunça métricas frontais.",
  head_pose_pitch_deg:
    "O quanto sua cabeça está inclinada para cima ou para baixo. Acima de 7° o nariz some ou ganha sombra estranha.",
  head_pose_roll_deg:
    "O quanto sua cabeça está tombada para o lado (como se fosse encostar a orelha no ombro).",
  sharpness_laplacian_var:
    "Estimador de nitidez. Quanto maior, mais nítida a foto. Abaixo de 50 está borrada e as métricas perdem confiança.",
  focal_distortion_ratio:
    "Selfies muito próximas (< 30cm) deformam o nariz, deixando ele 'maior do que é'. Esse número detecta se isso aconteceu.",
  lighting_asymmetry_delta_e:
    "O quanto a luz da foto bate em um lado mais que no outro. Luz lateral cria sombra e fabrica assimetria que não existe no rosto.",
  face_pixel_width:
    "Quantos pixels de largura sua face ocupa. Abaixo de 200, a foto não tem resolução suficiente para detectar bem os detalhes.",
};

export function feynmanFor(metricKey: string): string | undefined {
  return FEYNMAN_EXPLANATIONS[metricKey];
}
