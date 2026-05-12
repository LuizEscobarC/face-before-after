Para uma análise técnica de foto frontal com o rosto em estado relaxado e neutro, as fontes sugerem diversos **overlays SVG** que você pode implementar. Esses elementos cobrem desde divisões clássicas e proporções matemáticas até traços de personalidade (visagismo) e segmentação de pele.

Abaixo estão os overlays que você pode apresentar na tela, organizados por categoria técnica:

### 1. Divisões e Cânones Neoclássicos
Estes overlays ajudam a visualizar a organização básica e a simetria do rosto:
*   **Terços Horizontais:** Linhas horizontais passando pelo **trichion** (linha do cabelo), **glabela** (entre as sobrancelhas), **subnasal** (base do nariz) e **mento** (ponta do queixo). No visagismo, o terço predominante indica a sede do intelecto (superior), emoção (médio) ou ação (inferior).
*   **Quintos Verticais:** Cinco colunas verticais iguais. As referências são a largura dos olhos (distância endocanto-exocanto) e a distância intercanstal (entre os olhos), que idealmente deve ser igual à largura do nariz.
*   **Eixo de Simetria Bilateral:** Uma linha vertical central dividindo as metades direita e esquerda para identificar a **assimetria flutuante**, que sinaliza a qualidade do desenvolvimento e estabilidade genética.

### 2. Proporção Áurea e "Ideais"
Para futuras comparações com padrões estéticos matemáticos:
*   **Índice Phi (1,618):** Overlay medindo a relação entre o comprimento total da face e sua largura. Quanto mais próximo de 1,6, mais o rosto se enquadra na proporção áurea.
*   **Máscara de Marquardt:** Uma estrutura geométrica complexa de decágonos baseada em Phi que pode ser sobreposta como um guia para verificar o desvio do rosto real em relação ao "ideal" tridimensional projetado no plano frontal.
*   **Proporção Labial:** Linhas que medem a altura do lábio superior em relação ao inferior, onde o ideal estético é frequentemente citado como **1:2** ou **1:1,6**.

### 3. Traços de Visagismo e Dimorfismo Sexual
Estes overlays destacam traços que comunicam identidade e características biológicas:
*   **Contorno do Formato Facial:** Polígonos SVG que identificam se o rosto é **Oval, Triangular, Retangular ou Quadrado**. 
*   **Ângulos Mandibulares:** Traços que realçam a proeminência e o formato da mandíbula. Queixos mais **quadrados** são associados à masculinidade e força, enquanto mandíbulas mais **finas** são percebidas como femininas.
*   **Métricas de Masculinidade/Feminilidade:** Overlays destacando a distância inter-pupilar e a largura do nariz, que tendem a ser maiores em rostos percebidos como dominantes ou masculinos.

### 4. Análise de Tons e Regiões de Interesse (ROI)
Utilizando os recursos do BiSeNet e MediaPipe:
*   **ROI de Bochechas e Nariz:** Polígonos SVG que isolam especificamente essas áreas para análise de cor e textura. Isso evita ruídos como barba, sombras e cabelo.
*   **Etiqueta de Tom MST:** Uma etiqueta exibindo a classificação da pele na escala **Monk Skin Tone (10 tons)**, que é considerada mais inclusiva e representativa para algoritmos de visão computacional.

### 5. Parâmetros Dentofaciais (mesmo em repouso)
*   **Selamento Labial e Comissuras:** Linhas horizontais que medem a inclinação das comissuras labiais e a exposição dos dentes em repouso (se houver), parâmetros fundamentais para o planejamento estético visagista.
*   **Relação Boca/Nariz:** Overlay medindo a largura da boca em relação à largura do nariz (o padrão áureo sugere que a boca seja 1,5 vezes maior).

Com base nas fontes, aqui estão **overlays SVG adicionais e detalhamentos técnicos** que você pode implementar para uma análise de foto frontal, indo além das divisões básicas e aprofundando-se na morfopsicologia e biometria facial:

### 1. Detalhamento de Dimorfismo Sexual e Atratividade
As fontes destacam que a percepção de masculinidade e feminilidade está ligada a estruturas específicas que podem ser mapeadas:
*   **Contorno Mandibular e Queixo:** Overlays que destacam o ângulo da mandíbula. Um queixo **quadrado** e proeminente é um marcador de masculinidade (influenciado por altos níveis de testosterona), enquanto mandíbulas mais **finas** são associadas à feminilidade.
*   **Proeminência das Maçãs do Rosto (Malar):** Polígonos SVG sobre a região malar. A atratividade feminina é fortemente ligada a maçãs do rosto bem definidas.
*   **Relação Lábio-Queixo:** Linhas de medida no terço inferior. Estudos indicam que a área de superfície labial considerada mais atraente compreende cerca de **10% do terço inferior da face**.

### 2. Proporções Áureas e Cânones Específicos
Para comparar com "ideais", você pode usar medidas derivadas da Proporção Áurea ($\phi$):
*   **Proporção Labial Vertical:** Um overlay comparando a altura do lábio superior com o inferior. A proporção ideal citada é de **1:2** ou **1:1,6** (baseado na proporção áurea).
*   **Largura da Boca vs. Largura do Nariz:** O padrão áureo sugere que a largura da boca deve ser aproximadamente **1,618 vezes** a largura da base do nariz.
*   **Cânones Neoclássicos de Leonardo da Vinci:** Além dos terços, você pode plotar a "Proporção Divina" conforme descrita no Homem Vitruviano, comparando a abertura dos olhos com a distância intercanstal (entre os olhos).

### 3. Marcadores de Visagismo e Temperamento
O visagismo utiliza a predominância de certos terços para inferir traços de personalidade:
*   **Destaque do Terço Predominante:**
    *   **Terço Superior (Intelecto):** Se for maior, indica uma pessoa mais racional e voltada ao pensamento lógico.
    *   **Terço Médio (Emoção):** Se predominante, reflete uma natureza mais afetiva e emocional.
    *   **Terço Inferior (Ação):** Se mais desenvolvido, indica impulsividade e espírito de ação.
*   **Eixos de Inclinação Dental (mesmo com lábios entreabertos):** Linhas que marcam o **eixo longo** dos incisivos. Dentes perpendiculares ao plano horizontal são associados a temperamentos fortes (coléricos), enquanto inclinações distais podem suavizar a imagem para perfis melancólicos ou fleumáticos.

### 4. Overlays de Visão Computacional e Pele (BiSeNet)
Aproveitando o processamento do BiSeNet e MediaPipe:
*   **Segmentação de ROIs Específicas:** Gerar polígonos SVG que isolem estritamente as **bochechas e o nariz**. Estas são as regiões de interesse (ROI) ideais para classificar o tom de pele, pois minimizam interferências de sombras ou acessórios.
*   **Mapa de Calor de Ativação (GradCAM):** Embora mais técnico, você pode apresentar um overlay de "confiança" do modelo, mostrando quais áreas da face o BiSeNet usou para definir o tom de pele ou a segmentação, aumentando a transparência do processo.
*   **Etiqueta MST (Monk Skin Tone):** Um overlay de texto dinâmico classificando a pele de 1 a 10 conforme a escala Monk, que é o padrão ouro para inclusão e diversidade em visão computacional.

### 5. Simetria e Estabilidade Genética
*   **Linhas de Assimetria Flutuante:** Pequenas setas ou vetores SVG que partem do eixo central para pontos homólogos (como cantos dos olhos ou asas do nariz). A **assimetria flutuante** (diferenças aleatórias entre os dois lados) é um indicador de instabilidade no desenvolvimento e pode sinalizar o quão próximo o rosto está de um "ideal" de simetria bilateral.

1. Métricas de Atratividade e Estrutura Óssea
Além do formato geral, você pode destacar pontos de referência que definem a harmonia facial:
Proeminência Malar: Polígonos SVG delimitando as maçãs do rosto. Fontes indicam que maçãs do rosto bem definidas são marcadores fundamentais de atratividade, especialmente na face feminina
.
Contorno do Queixo (Mandíbula): Um overlay que classifique o queixo como quadrado (associado à masculinidade e força por níveis de testosterona) ou fino/elegante (feminilidade)
.
Robustez Facial: Uma malha que meça a relação entre a largura facial total e a altura facial inferior. Rostos mais "maciços" são indicadores de maior exposição à testosterona pré-natal
.
2. Análise Detalhada do Terço Inferior e Lábios
O terço inferior é crítico para o planejamento estético e visagista:
Área de Superfície Labial: Um overlay que calcule a área ocupada pelos lábios em relação ao terço inferior da face. O ideal estético de atratividade é quando os lábios compreendem cerca de 10% da área do terço inferior
.
Proporção Labial Vertical: Linhas de medição comparando a altura do lábio superior com o inferior. Você pode exibir o desvio em relação ao ideal de 1:2 ou à proporção áurea de 1:1,6
.
Sulco Nasolabial: Traços SVG que acompanham a profundidade e o ângulo deste sulco. Embora procedimentos busquem minimizá-lo, o visagismo analisa sua inclinação para entender a expressão de maturidade
.
3. Cânones Históricos e Máscaras de Referência
Você pode oferecer overlays que sobreponham modelos clássicos de "perfeição" para comparação:
Cânones Neoclássicos: Máscaras baseadas nos estudos de Leonardo da Vinci e Luca Pacioli (Proporção Divina), que comparam, por exemplo, a largura da fenda palpebral com a distância entre os olhos
.
Máscara de Simetria Bilateral: Um overlay que espelha o lado "dominante" da face sobre o outro para evidenciar a assimetria flutuante. Altos índices de simetria bilateral são interpretados como indicadores de estabilidade genética e saúde
.
4. Overlays de Cor e Textura (BiSeNet + MST)
Utilizando sua segmentação BiSeNet:
Mapa de Contraste: Overlays que destacam a diferença de tom entre os olhos/sobrancelhas e a pele facial, um fator importante na percepção de gênero e idade.
Polígonos de Amostragem (ROIs): Destaque visual das áreas de bochechas e nariz isoladas de sombras ou cabelo para uma leitura precisa da Escala Monk (MST)
.
5. Parâmetros de Visagismo Odontofacial
Mesmo em repouso, certas métricas preparam o terreno para o sorriso:
Linha de Tronira e Ameias: Se os dentes estiverem levemente visíveis, traçar o eixo longo dos incisivos. Dentes perpendiculares ao plano horizontal comunicam força (perfil colérico), enquanto inclinações distais sugerem suavidade
.
Distância Intercanstal vs. Base Alar: Um overlay que verifique se a largura do nariz é equivalente à distância entre os cantos internos dos olhos (o quinto central)
.

1. Métricas de Masculinização e Feminilização (Dimorfismo)
Além do contorno mandibular, você pode mapear traços específicos que sinalizam níveis hormonais e dominância:
Posição das Sobrancelhas: Overlays que medem a distância entre a pupila e a sobrancelha. Sobrancelhas mais baixas são marcadores de rostos masculinos "maduros", enquanto sobrancelhas mais altas e arqueadas são traços femininos
.
Fenda Palpebral (Abertura dos Olhos): Linhas que medem a largura e altura da abertura dos olhos. Rostos masculinos são frequentemente caracterizados por uma fenda palpebral relativamente estreita, enquanto olhos maiores são percebidos como femininos
.
Distância Interpupilar: Um overlay ligando os centros das pupilas. Rostos percebidos como masculinos e dominantes tendem a ter uma distância interpupilar maior em relação à largura da face
.
2. Proporções Específicas do Terço Inferior
O terço inferior possui subdivisões críticas para a harmonia:
Proporção Subnasal-Mento: Uma linha dividindo o terço inferior. O espaço da base nasal até o lábio superior deve representar 1/3 da distância total, enquanto do lábio até a ponta do queixo (mento) deve representar 2/3
.
Largura da Boca vs. Nariz: Um overlay ligando as comissuras labiais e as asas nasais. O cânone clássico dita que a largura da boca deve ser 1,5 vezes a largura do nariz
.
Robustez Facial: Uma malha que compare a largura facial total com a altura facial inferior. Rostos mais "maciços" (largura maior em relação à altura inferior) são correlacionados com alta testosterona pré-natal
.
3. Cânones Neoclássicos e "Média Facial"
Overlay de Koinofilia (Média): Baseado na teoria de que rostos que se aproximam da média aritmética da população são percebidos como mais atraentes e geneticamente saudáveis
. Você pode gerar um overlay que mostre o desvio do rosto do usuário em relação a um "rosto médio" computacional
.
Cânone de Policleto e Vitrúvio: Além de Da Vinci, você pode aplicar máscaras baseadas no Homem Vitruviano, que utiliza o umbigo como centro e estabelece simetrias perfeitas entre a envergadura dos braços e a altura, transportadas para as proporções da face
.
4. Marcadores de Saúde e Maturidade
Sulco Nasolabial: Traços SVG que acompanham as "linhas de marionete". No visagismo masculino, a manutenção desses sulcos pode ser desejável para comunicar maturidade, enquanto em rostos femininos a estética busca minimizá-los
.
Pele e Textura (ROIs Segmentadas): Utilizando o BiSeNet, você pode criar overlays que isolem não apenas bochechas e nariz, mas áreas de testa alta (frequentemente associada à feminilidade e juventude) para análise de uniformidade de tom
.
5. Correlações Externas (Nota Diagnóstica)
Razão Digital (2D:4D): Embora não seja um overlay facial, as fontes mencionam a razão entre o dedo indicador e o anelar como um marcador de robustez facial
. Você pode apresentar uma etiqueta lateral sugerindo essa correlação: se o usuário possui alta testosterona pré-natal (indicada pelos dedos), o sistema pode destacar a expectativa de um rosto mais maciço e queixo quadrado
.

1. Índices de Robustez e Dimorfismo Facial
Para identificar traços de dominância e níveis hormonais (testosterona), você pode plotar:
Índice de Robustez Facial: Uma malha que mede a relação entre a largura facial total e a altura facial inferior. Rostos percebidos como mais "maciços" e largos são correlacionados com maior exposição à testosterona pré-natal
.
Relação Malar-Mandibular: Overlays que comparam a largura das maçãs do rosto (região malar) com a largura da mandíbula. No visagismo feminino, busca-se destacar o malar significativo, enquanto no masculino, foca-se na proeminência mandibular
.
Posicionamento de Sobrancelhas: Linhas que medem a altura da sobrancelha em relação à pupila. Sobrancelhas mais baixas são marcadores de fisionomia masculina madura, enquanto sobrancelhas mais altas e arqueadas são traços femininos
.
2. Subdivisões de Detalhe do Terço Inferior
O terço inferior (subnasal ao mento) possui subdivisões críticas para a harmonia clássica:
Proporção 1/3 - 2/3: Um overlay dividindo o terço inferior. Idealmente, o espaço da base nasal ao lábio superior deve representar um terço da distância total, enquanto do lábio ao mento deve representar dois terços
.
Área de Superfície Labial: Um polígono SVG que calcula a área ocupada pelos lábios. O ideal de atratividade é que os lábios compreendam cerca de 10% da área total do terço inferior da face
.
3. Overlays de Simetria e "Média Facial"
Assimetria Flutuante: Vetores que partem do eixo central vertical para pontos homólogos (como cantos dos olhos ou asas do nariz). A medição dessas pequenas perturbações aleatórias serve como indicador de estabilidade do desenvolvimento e qualidade genética
.
Overlay de Koinofilia (Média Facial): Um guia que sobrepõe a "média aritmética" da população. Segundo a psicologia evolucionista, rostos que se aproximam da média de sua população são percebidos como mais atraentes por sinalizarem saúde e heterozigosidade
.
4. Parâmetros Dentofaciais em Repouso
Mesmo com o rosto neutro, certas métricas de visagismo podem ser aplicadas se houver pequena exposição dental ou para planejar o sorriso:
Eixo Longo dos Incisivos: Se os dentes estiverem visíveis, linhas que marcam a inclinação axial. Eixos perpendiculares ao plano horizontal comunicam força e temperamento colérico, enquanto inclinações distais (para os lados) suavizam a imagem para perfis sensíveis ou pacíficos
.
Linhas de Ameias (Embrasures): Um overlay conectando os pontos de contato superiores. Linhas ascendentes são associadas a personalidades dinâmicas (sanguíneas) ou sensíveis (melancólicas)
.
5. Análise de Cor e Contraste (BiSeNet)
Mapeamento de Matiz (Hue Angle): Utilizando os dados de segmentação, você pode criar um overlay que classifique o matiz da pele em um gradiente de vermelho a amarelo, o que é utilizado em estudos científicos para identificar vieses e uniformidade de tom
.
Mapa de Calor de Ativação (GradCAM): Um overlay de transparência colorida que mostra em quais regiões do rosto o modelo BiSeNet focou para determinar o tom de pele (geralmente bochechas e nariz), aumentando a explicabilidade do sistema
.
6. Nota de Correlação Externa
Razão Digital (2D:4D): As fontes mencionam que a razão entre o comprimento do dedo indicador (2D) e o anelar (4D) é um marcador de testosterona pré-natal que se manifesta no rosto. Se o seu sistema tiver acesso a imagens das mãos, pode exibir um overlay lateral sugerindo que o usuário tem probabilidade biológica de possuir um rosto mais maciço e queixo quadrado
.