Visão geral do que será adicionado
Você vai construir quatro camadas novas sobre o pipeline atual:

Um catálogo expandido de métricas atômicas — saindo de poucas medidas para uma biblioteca densa de proporção, simetria, definição estrutural e fotogenia geométrica, cada uma com metadados que tornam a métrica auto-descritiva.
Uma engine de comparação com ideais — que pega cada métrica atômica, compara com faixas de referência, calcula desvio direcional, percentil populacional e produz scores por região e um score global ponderado.
Um catálogo de overlays visuais — cada métrica relevante vira uma camada SVG sobreponível na foto do usuário (linhas, ângulos, máscaras, vetores, heatmaps), com regras de composição e suporte a renderização cliente e exportação server-side.
Uma engine de diagnóstico textual e plano de ação — que traduz métricas e desvios em linguagem natural, prioriza recomendações por impacto percebido e gera o relatório final.

A ordem importa. Não pule para a Fase 3 antes da Fase 1 e 2 estarem maduras, porque overlay sem ideal calibrado é decoração, e diagnóstico sem score por região é texto genérico.

Fase 1 — Catálogo expandido de métricas atômicas
1.1 Princípios que regem toda métrica
Antes de listar as métricas, defina no projeto a "carteira de identidade" obrigatória de cada uma. Isso é o que vai permitir que a Fase 2 (ideais) e a Fase 3 (overlays) funcionem sem acoplamento direto. Toda métrica precisa carregar:

Um metric_id único, em snake_case, estável (não muda mesmo se o cálculo for refatorado).
Uma region semântica (eyes, brows, nose, mouth, jaw, chin, midface, cheeks, forehead, global, symmetry, photo_quality).
Um unit declarado (px, mm normalizado, ratio adimensional, graus, percentual, índice 0–1).
Um value numérico bruto.
Um error estimado de propagação (incerteza vinda da qualidade da foto, da pose, e da estabilidade do landmark).
Um confidence final (entre 0 e 1) já com penalidades regionais aplicadas.
Um direction opcional (neutro, left_dominant, right_dominant, longer, shorter, wider, narrower, etc.) — usado pelo diagnóstico.
Um dependency_set — quais landmarks foram consumidos para calcular essa métrica. Isso permite invalidar métricas automaticamente se um landmark for marcado como não confiável.

A regra de ouro: nenhuma métrica retorna apenas um número. Ela retorna o número e o contexto suficiente para que outro módulo decida se confia nela.
1.2 Normalização obrigatória antes de qualquer cálculo
Toda métrica trabalha sobre landmarks já normalizados. Crie uma etapa fixa de pré-processamento que:

Aplica head pose correction usando os ângulos yaw/pitch/roll já estimados pelo Módulo 0.
Centraliza o rosto pelo centroide facial.
Escala usando uma referência interna estável — recomendado: distância intercanthal (canto interno do olho esquerdo ao canto interno do olho direito), porque ela é menos afetada por expressão do que distâncias de boca ou queixo.
Roda o rosto para alinhar a linha intercanthal com o eixo horizontal (corrige roll residual).

Métricas em pixels viram métricas adimensionais (ratios) ou em "unidades intercanthais". Essa decisão tem que ser documentada e congelada cedo, porque mudar a base de normalização depois invalida todo o histórico longitudinal do usuário.
1.3 Famílias de métricas — o que implementar
Cada subfamília abaixo deve virar um módulo Python isolado dentro de services/metrics/, com testes próprios e um arquivo de schema declarando as métricas que produz. Ordene a implementação por valor percebido — eu sugeri uma ordem ao final desta seção.
Família simetria. Cobre desvio bilateral em cada região. Métricas a calcular: desvio do midline (distância média entre ponto da testa, ponta do nariz, philtrum e queixo em relação à linha vertical ideal); assimetria de altura dos olhos; assimetria de altura das sobrancelhas; canting dos lábios (inclinação da linha que une os cantos da boca em relação à horizontal); assimetria horizontal do queixo; assimetria de largura mandibular; assimetria de altura das maçãs do rosto; índice de assimetria global (média ponderada das anteriores); mapa de assimetria ponto-a-ponto (vetor que pode alimentar heatmap depois).
Família proporções verticais (terços). Divide o rosto em testa, nariz e boca-queixo. Métricas: comprimento absoluto de cada terço, ratio de cada terço sobre o comprimento total, desvio em relação à divisão ideal de 33-33-33, identificação do terço dominante, ratio terço-superior/terço-inferior.
Família proporções horizontais (quintos). Divide o rosto em cinco colunas verticais usando os cantos externos dos olhos como divisores principais. Métricas: largura de cada quinto, desvio em relação ao ideal (cada quinto deve ter aproximadamente a largura de um olho), ratio espaçamento intercanthal sobre largura ocular.
Família olhos. Largura ocular (canto a canto), altura ocular (pálpebra superior à inferior), aperture ratio (altura sobre largura), distância interpupilar, distância intercanthal, canthal tilt aproximado (ângulo da linha que une canto interno e externo em relação à horizontal), tilt absoluto e tilt relativo entre os dois olhos, posição do tear duct, indicador de hooded eyes (cobertura da pálpebra superior sobre o globo).
Família sobrancelhas. Altura média da sobrancelha sobre o olho, posição do pico (peak position) da sobrancelha em fração da largura, inclinação da sobrancelha (ângulo cabeça-cauda), espessura aproximada (precisa de processamento de imagem além de landmark — ver nota abaixo), simetria entre direita e esquerda, distância entre as sobrancelhas (glabela).
Família nariz. Comprimento nasal (raiz à ponta), largura nasal (alar a alar), ratio largura-nasal sobre intercanthal (regra clássica: largura do nariz aproximadamente igual à intercanthal), desvio do eixo nasal em relação ao midline, simetria das narinas visíveis frontalmente, ratio comprimento sobre largura, posição da ponta em relação aos terços.
Família boca e lábios. Largura da boca, largura da boca sobre largura do nariz (ratio harmônico), largura da boca sobre distância entre pupilas (regra: cantos da boca aproximadamente sob as íris), comprimento do philtrum, ratio lábio superior sobre inferior, definição do arco de cupido (curvatura da linha vermelhão superior), simetria dos cantos da boca, smile line aproximada se a foto for sorrindo (mas marcar como degradada).
Família mandíbula e queixo. Largura mandibular bigonial, ratio largura mandibular sobre largura zigomática (jawline-to-cheekbone — métrica forte para definição masculina), ângulo gonial aproximado em 2D (ângulo formado pela linha mandíbula-orelha e mandíbula-queixo), projeção do queixo (estimativa frontal usando a posição relativa da ponta do queixo ao centroide labial — limitada, marcar como aproximação), largura do queixo, simetria mandibular esquerda-direita, definição lateral (curvatura/retidão da linha mandibular).
Família maçãs do rosto. Largura zigomática (ponto mais lateral da bochecha), altura da maçã (posição vertical do ponto zigomático em relação aos olhos), prominência aproximada (limitada em 2D — depende muito de iluminação, marcar com confiança baixa por padrão).
Família testa. Altura da testa (sobrancelha à linha do cabelo — só funciona se o cabelo não cobre, então depende da flag hair_covering do Módulo 0), distância sobrancelha ao olho.
Família global e formato facial. Largura facial sobre altura facial (compactness), classificação do formato facial (oval, redondo, quadrado, retangular, coração, diamante, oblongo) baseada em ratios entre largura zigomática, largura mandibular, largura de testa e altura total, perímetro da silhueta facial, fator de "compactness" (área inscrita sobre área do bounding box).
Família phi/golden ratio (opcional, baixa prioridade). Lista de razões clássicas que historicamente foram associadas ao phi (1.618). Implemente, mas marque essas métricas como presentation_only no metadata — elas servem para overlays vistosos ao usuário, não devem entrar no score global porque a base científica é fraca.
Família fotogenia geométrica. Métricas que avaliam quão "fotogênico" o ângulo está, independente do rosto: alinhamento da câmera, correção de pose residual, presença de sombra forte unilateral (vem do Módulo 0 mas reaproveite). São úteis no diagnóstico para sugerir "tire de novo melhor" antes de dar conselho estético.
1.4 Métricas que dependem de pixel além de landmark
Algumas avaliações citadas nos anexos (acne, olheiras, qualidade de pele, espessura de sobrancelha real, densidade de barba) não são extraíveis só de landmarks. Para a Fase 1, não tente implementá-las. Crie placeholders no schema marcados como requires_pixel_analysis: true e deixe-os retornando null com confidence: 0. Isso reserva o espaço no contrato sem te forçar a entregar agora. Volta nelas só depois da Fase 4, com um módulo dedicado de análise de pele rodando em paralelo no FastAPI.
1.5 Sistema de propagação de confiança
Cada métrica recebe penalidades em cascata:

A quality_context que vem do Módulo 0 traz quality_score global e regional_penalties.
A região da métrica determina qual penalidade aplicar (uma métrica de jaw é multiplicada por regional_penalties.jaw).
A pose do rosto aplica penalidade adicional não-linear: pequenos desvios (até ~5°) quase não penalizam, mas a partir de ~10° a penalidade cresce rápido. Defina uma curva (sugiro sigmóide invertida) e ajuste por região — métricas frontais (terços) sofrem menos com yaw do que métricas que dependem de simetria.
A estabilidade dos landmarks daquela região (variância em uma micro-rajada de capturas, se você fizer captura múltipla) entra como um terceiro fator. Para MVP da Fase 1, capture única basta — deixa o multi-capture na Fase 2.

A confidence final é o produto desses três fatores, clipada em [0, 1]. Métricas com confidence < 0.4 não devem aparecer em diagnóstico nem em overlay; apenas no JSON cru, marcadas como low_confidence: true.
1.6 Ordem de implementação dentro da Fase 1
Não tente implementar tudo de uma vez. A ordem que traz mais valor cedo é: simetria → terços → quintos → olhos → mandíbula → nariz → boca → sobrancelhas → maçãs → testa → globais → phi. As primeiras quatro famílias já permitem montar uma versão funcional do score.

Fase 2 — Engine de comparação com ideais e desvio populacional
2.1 Conceito de "ideal"
A primeira decisão arquitetural aqui é existencial: o que é "ideal"? Você tem três caminhos e precisa escolher um e documentar:

Ideal estatístico populacional. Para cada métrica, você define a média e o desvio-padrão da população humana adulta saudável. Um valor "ideal" é o que está dentro de uma faixa central (por exemplo, ±0.5 desvios). Vantagem: cientificamente defensável. Desvantagem: você precisa de uma tabela de referência por sexo, idade, e idealmente etnia.
Ideal estético/canônico. Você usa proporções clássicas (terços iguais, quintos iguais, intercanthal igual à largura nasal, boca igual a 1.5 narizes). Vantagem: simples, intuitivo, casa bem com overlay visual. Desvantagem: é normativo e culturalmente enviesado — diga isso no produto.
Ideal híbrido. É o que recomendo. Para métricas estruturais (terços, quintos, simetria), use ideal canônico. Para métricas absolutas (largura ocular, projeção de queixo), use referência populacional. Phi/golden marcadas como decoração.

Crie um arquivo declarativo (YAML ou JSON) chamado metric_ideals.yaml no FastAPI, indexado por metric_id, contendo: tipo do ideal, valor central, desvio aceitável (range "verde"), desvio aceitável estendido (range "amarelo"), além disso é "vermelho", direção do desvio (se valor > ideal, classifica como "wider"/"longer"/etc.), unidade, e referência bibliográfica (mesmo que seja só um link interno).
Esse arquivo é a alma da Fase 2. Toda calibração futura passa por ele. Ele NÃO fica em código — fica em config/, versionado, revisável por não-engenheiros.
2.2 Cálculo de desvio
Para cada métrica computada, a engine produz:

deviation_raw: valor atual menos valor ideal, na unidade da métrica.
deviation_normalized: o deviation_raw dividido pela tolerância "verde". Valores entre -1 e 1 estão na faixa boa, entre -2 e 2 na amarela, fora disso vermelho.
percentile: posição estimada do usuário em relação à população (requer tabela populacional; se não tiver, deixa null).
direction_label: rótulo direcional ("queixo retraído", "olhos próximos", "terço inferior dominante") — vem do mapa configurado no metric_ideals.yaml.
severity: enum de ideal | mild | moderate | strong | extreme.

2.3 Score por região
Agrupe métricas por região e produza um score 0–100 por região. Cada métrica contribui com (1 - |deviation_normalized| capado em 1) * confidence. O score regional é a média ponderada dessas contribuições, onde os pesos vêm de outro arquivo declarativo region_metric_weights.yaml.
Você precisa de pesos por região porque algumas métricas pesam mais que outras na percepção daquela região. Exemplo: para "olhos", canthal tilt e altura ocular pesam mais que distância intercanthal. Para "mandíbula", ratio jawline-to-cheekbone pesa mais que largura absoluta. Calibre esses pesos olhando produtos similares e literatura, e deixe-os editáveis.
2.4 Score global ponderado
O score global é a combinação dos scores regionais. Use os pesos sugeridos nos anexos como ponto de partida (35% simetria, 35% proporção, 20% definição estrutural, 10% estabilidade da foto), mas mantenha-os no config/global_weights.yaml. Importante: o score global só é exibido se todos os scores regionais críticos tiverem confiança acima de um threshold (sugiro 0.5). Caso contrário, mostre só os regionais e marque o global como "indisponível por baixa confiança".
2.5 Direção e magnitude — o que alimenta a Fase 3 e 4
Cada métrica avaliada produz um objeto enriquecido que é o input dos overlays e do diagnóstico. Esse objeto contém: a métrica original, o desvio, a severidade, a direção em linguagem humana, e um campo improvement_vector quando aplicável (por exemplo, métricas de projeção têm um vetor 2D que aponta para onde o ideal está em relação ao atual — esse vetor é literalmente desenhado como seta na Fase 3).
2.6 Versionamento dos ideais
Ideais mudam. Quando você ajustar o metric_ideals.yaml, todo score histórico ficaria incomparável se você não versionar. Salve em cada AnalysisReport o ideals_version usado. No frontend, ao mostrar evolução, recompute os scores antigos com a versão atual antes de comparar — ou mostre os scores na versão original, mas com aviso de "calibração mudou".

Fase 3 — Catálogo de overlays visuais e renderização
3.1 Estratégia de renderização: SVG cliente, raster servidor
Tome essa decisão e siga. Recomendo: overlays interativos no cliente em SVG sobreposto à imagem (cada overlay é um componente React separado, ligável/desligável), e exportação final como imagem rasterizada server-side via Puppeteer ou Pillow no FastAPI quando o usuário pedir um PDF/PNG do relatório.
A vantagem do SVG cliente é gigantesca: o usuário pode ligar/desligar camadas, ver animações, hover em métricas, sem nenhum custo de servidor. O servidor só renderiza no momento do export final.
3.2 Catálogo de overlays — quais existir
Cada overlay é uma especificação declarativa, não um componente ad-hoc. Crie um schema de overlay com: overlay_id, name_pt, description_pt, depends_on_metrics (lista de metric_id), category (axis, grid, contour, mask, vector, heatmap, label), default_visible (boolean), z_order (int), color_token, interactive (se aceita hover/click), legend_text.
A lista mínima para a primeira versão:

Linha do midline (axis).
Linha intercanthal e linha mandibular (axis).
Grid dos terços faciais (grid).
Grid dos quintos faciais (grid).
Contorno mandibular (contour) com marcação do ângulo gonial.
Contorno do nariz com marcação de largura e eixo.
Contorno labial com marcação de cantos e eixo.
Marcadores de canthal tilt (axis duplo, um por olho).
Marcadores de espaçamento ocular com legenda comparativa.
Máscara de simetria espelhada — desenha a metade direita refletida sobre a esquerda em opacidade reduzida, para o usuário "ver" a assimetria.
Heatmap de assimetria (sobre o rosto, vermelho onde a diferença esquerda-direita é maior).
Heatmap de aderência ao ideal (verde nas regiões dentro da faixa, amarelo na faixa estendida, vermelho fora).
Vetores de melhoria (setas curtas em regiões com desvio direcional).
Overlay "ideal vs atual" — para cada landmark afetado, desenha o ponto atual e o ponto onde estaria no ideal, ligados por uma linha curta.
Máscara phi/golden (opcional, marcada como decorativa).
Régua de proporção mandíbula-zigomático.
Marcação de altura da maçã do rosto.
Eixo de inclinação labial (canting).

3.3 Coordenadas e ancoragem
Todo overlay opera no espaço dos landmarks normalizados, não no espaço de pixels da imagem original. Mantenha duas matrizes de transformação por sessão: normalized_to_original_pixels e original_pixels_to_display (que a UI ajusta conforme o tamanho de exibição). Os overlays são desenhados em coordenadas normalizadas e a transformação é aplicada na hora de renderizar. Isso evita que mudanças de tamanho de exibição quebrem alinhamento.
3.4 Composição em camadas
Os overlays não são exclusivos. O usuário pode ligar vários ao mesmo tempo. Defina ordem de empilhamento (z_order):

Camada 0: imagem da foto (com brilho levemente reduzido para overlays se destacarem).
Camada 1: heatmaps (mais transparentes, ficam atrás).
Camada 2: máscaras (semi-transparentes).
Camada 3: grids e axes (linhas finas).
Camada 4: contornos.
Camada 5: vetores e setas.
Camada 6: marcadores pontuais.
Camada 7: labels textuais (sempre por cima de tudo).

No frontend, cada camada é um <g> SVG. No backend, ao exportar, mantenha a mesma ordem.
3.5 Tipos de saída exportáveis
A funcionalidade "gerar réplicas com overlays" precisa produzir três outputs distintos:

Imagem anotada única — a foto do usuário com um conjunto pré-selecionado de overlays "essenciais" (midline, terços, contorno mandibular, canthal tilt). Esse é o "preview" que vai em primeira tela.
Galeria por região — uma imagem por região analisada, cada uma com os overlays específicos daquela região (uma para olhos, uma para mandíbula, etc.). Útil para o relatório navegável.
Composição "before/ideal" — duas imagens lado a lado: a foto real e uma versão da foto com landmarks deslocados para as posições ideais, redesenhada via warp (libraries: scikit-image ou OpenCV com remap). Use com cautela e marque visualmente como "simulação aproximada" — não é uma promessa de resultado.

A composição "before/ideal" é tecnicamente mais cara. Implemente ela na Fase 3.5, depois das outras saídas estarem estáveis. Para a primeira entrega, pode substituir por overlay vetorial simples ("ponto atual" → "ponto ideal") sem warp da imagem real.
3.6 Endpoint de renderização server-side
No FastAPI, adicione um endpoint POST /vision/render. Recebe: landmarks, image_base64 (ou referência ao asset salvo), lista de overlay_ids, formato de saída (PNG, JPG, PDF). Retorna o asset renderizado. Isso é o que alimenta o export final e o que o NestJS chama quando precisa gerar o PDF do relatório.
3.7 Heatmaps — como gerar de fato
Heatmaps merecem atenção separada porque são o que parece "IA avançada" para o usuário. Para gerar:

Heatmap de assimetria: para cada ponto do mesh, calcule a distância ao ponto homólogo refletido sobre o midline. Normalize para [0, 1]. Interpole para um campo denso (use scipy.interpolate.griddata com método cúbico). Mapeie para uma rampa de cor (verde-amarelo-vermelho) e renderize com alpha proporcional à intensidade.
Heatmap de aderência ao ideal: idem, mas em vez de assimetria, calcule por região o |deviation_normalized| da métrica regional. Valor por região, não por ponto, então tem visual mais "blocado". Para suavizar, faça interpolação espacial entre regiões adjacentes.

Renderize esses heatmaps server-side no FastAPI usando OpenCV/Pillow e devolva como camada PNG transparente, que o frontend só sobrepõe. Não tente gerar no cliente — é matemática pesada.

Fase 4 — Engine de diagnóstico textual e plano de ação
4.1 Templates por métrica e por desvio
Crie um arquivo diagnostic_templates.yaml indexado por metric_id. Cada métrica tem um conjunto de templates por severidade e direção. Estrutura: metric_id → severity → direction → template. O template é uma string com placeholders para inserir o valor atual, o ideal, e o percentil quando disponível.
Cada template tem três variantes:

short: até 80 caracteres, para a UI compacta ("Terço inferior levemente dominante").
medium: até 200 caracteres, para os cards do relatório ("O seu terço inferior está cerca de 8% acima do ideal canônico, o que é uma diferença leve e dentro da faixa frequente na população").
long: até 600 caracteres, para a visualização expandida com contexto, explicação do que aquela métrica significa e por que ela importa.

4.2 Hierarquia de severidade e priorização
O usuário não quer ler 80 análises. Implemente uma camada de priorização que pega todas as métricas avaliadas e ranqueia por relevância. Critérios de ranqueamento:

Severidade do desvio (extreme > strong > moderate > mild > ideal).
Confiança da métrica (descarte abaixo de 0.5).
Peso da métrica na percepção da região (do region_metric_weights.yaml).
"Acionabilidade" — métricas que têm recomendação executável sobem; métricas estruturais imutáveis (formato ósseo) descem para a categoria informativa.

Output: top 3 a 5 pontos fortes (severidade ideal + alta confiança + peso alto) e top 3 a 5 pontos a observar (severidade moderada-extrema + alta confiança + acionabilidade alta).
4.3 Tipos de recomendação
Toda recomendação tem uma category:

photo — sugestão sobre como tirar foto melhor (mais luz frontal, ângulo, expressão neutra).
posture — postura cervical, posição da cabeça em repouso.
lifestyle — sono, hidratação, redução de inchaço, redução de gordura facial.
styling — barba, corte de cabelo, sobrancelha, ângulo de selfie.
professional_referral — quando o desvio for funcional (não só estético): respiração nasal, oclusão, dor na ATM, postura cervical patológica. Direcione para profissional, não dê conselho.
presentation_only — observação puramente informativa, sem ação.

Crie um arquivo recommendations_catalog.yaml mapeando (metric_id, severity, direction) → lista de recommendation_id. Cada recommendation_id é detalhado em outro arquivo com texto, categoria, e prioridade.
4.4 Tom e disclaimers obrigatórios
Esse é um produto sensível. Estabeleça regras de copywriting que o gerador de texto nunca viola:

Nunca use linguagem médica afirmativa ("você tem assimetria patológica"). Use observação ("foi observada uma assimetria leve no plano frontal da imagem").
Nunca prometa resultado ("faça X e seu rosto vai ficar Y"). Sugira ("essa observação pode ser explorada com X").
Sempre feche o relatório com um disclaimer fixo: análise estética geométrica baseada em uma foto, não substitui avaliação profissional, recomendar acompanhamento médico se houver sintoma funcional.
Nunca compare o usuário com pessoas específicas ou com tipos étnicos.
Nunca emita score abaixo de um piso configurável (sugiro 35) — fala-se em "oportunidades de harmonização" em vez de devolver um número humilhante.

4.5 Geração do relatório final
Junte tudo em um agregado AnalysisReport que contém: scores regionais e global, top observações priorizadas, recomendações priorizadas, lista de overlays sugeridos para visualização, timestamp, ideals_version, photo quality summary, e referência aos assets renderizados (URLs das imagens anotadas).
Esse objeto é o que o NestJS persiste e o frontend consome.

Estrutura de pastas — onde cada coisa mora
No FastAPI (app/), adicione:

app/services/normalization/ — pré-processamento de landmarks (head pose correction, escala intercanthal, midline alignment).
app/services/metrics/ — uma submódulo por família (symmetry.py, thirds.py, fifths.py, eyes.py, nose.py, mouth.py, jaw.py, brows.py, cheekbones.py, forehead.py, global_shape.py, phi.py).
app/services/metric_registry.py — orquestra todas as famílias, aplica metadata, propaga confiança.
app/services/ideals/ — comparator.py (engine de comparação), loader.py (carrega metric_ideals.yaml).
app/services/scoring/ — regional_scorer.py, global_scorer.py.
app/services/diagnosis/ — prioritizer.py, template_renderer.py, recommendation_resolver.py.
app/services/rendering/ — overlay_registry.py, overlay_renderer.py (Pillow/OpenCV), heatmap_generator.py, report_exporter.py (PDF).
app/config/ — metric_ideals.yaml, region_metric_weights.yaml, global_weights.yaml, diagnostic_templates.yaml, recommendations_catalog.yaml, overlay_definitions.yaml.
app/routers/ — analyze.py (POST /vision/analyze: orquestra todo o pipeline novo), render.py (POST /vision/render).
app/schemas/ — adicione metric_evaluation.py, analysis_report.py, overlay_spec.py.

No NestJS, adicione um módulo analysis/:

analysis/application/analysis.orchestrator.ts — chama o FastAPI /vision/analyze, pega o AnalysisReport, persiste, dispara eventos.
analysis/domain/services/ — priority-policy.service.ts (caso queira aplicar políticas extras de UX que não cabem no Python), evolution-comparator.service.ts (compara reports ao longo do tempo).
analysis/domain/value-objects/ — analysis-report.vo.ts, region-score.vo.ts, recommendation.vo.ts.
analysis/infrastructure/repositories/ — persistência de reports.
analysis/dto/ — DTOs espelhando os schemas Python (mantenha em sincronia via geração ou validação cruzada).
vision/vision.client.ts — adicione método analyze(...) e render(...).

No frontend (React/Next):

features/analysis/components/OverlayCanvas.tsx — componente que sobrepõe SVGs sobre a imagem.
features/analysis/components/OverlayLayer/<um por overlay> — um componente declarativo por tipo de overlay, todos consumindo a mesma struct LandmarkContext + OverlaySpec.
features/analysis/components/OverlayToggleBar.tsx — interface de ligar/desligar camadas.
features/analysis/components/RegionScoreCard.tsx, MetricDetailPanel.tsx, RecommendationList.tsx — UI do relatório.
features/analysis/api/analysis.client.ts — chamadas ao NestJS.


Contratos novos — o que cada endpoint expõe
Novo endpoint no FastAPI: POST /vision/analyze. Substitui o /vision/metrics quando o objetivo é o pipeline completo (deixe /vision/metrics vivo para uso interno e debug).

Request: session_id, landmarks, quality_context, user_context opcional (sexo declarado, faixa etária — só se o usuário consentiu, afeta seleção de ideais), ideals_version opcional (default = atual).
Response: o AnalysisReport completo: lista de MetricEvaluation (métrica + ideal + desvio + severidade + confiança), RegionScore por região, GlobalScore, PrioritizedFindings (top observações), RecommendationList (priorizada), SuggestedOverlays (lista de overlay_id sugeridos para o frontend mostrar como padrão), Disclaimers (textos fixos a renderizar).

Novo endpoint: POST /vision/render.

Request: image_reference (URL ou base64), landmarks, lista overlay_ids, formato (png, jpg, pdf), opções de composição (resolução, qualidade, incluir legenda, idioma).
Response: asset_url (se salvou em storage) ou asset_base64, metadata (overlays aplicados, dimensões, tempo de processamento).


Ordem de implementação sugerida (cronograma de marcos)
Pense em quatro marcos, cada um entregando algo demonstrável:
Marco 1 — Núcleo analítico (semanas 1 a 3). Pré-processamento de normalização, famílias simetria + terços + quintos + olhos. Engine de ideais com 20 métricas calibradas. Score por região para essas quatro famílias e um score global parcial. Endpoint /vision/analyze retornando JSON cru sem texto. Sem overlays, sem diagnóstico — apenas confirmar que números saem certos. Crie testes unitários por família com fotos canônicas (rosto sintético perfeito, rosto com assimetria conhecida, rosto com pose torta) para garantir que cálculos são estáveis.
Marco 2 — Famílias restantes e calibração (semanas 4 e 5). Adiciona mandíbula, nariz, boca, sobrancelhas, maçãs, testa, formato global. Sobe o catálogo para 60+ métricas. Calibra todos os ideais com revisão manual de 30-50 fotos. Score global completo. Ainda sem overlay; sem texto.
Marco 3 — Visualização (semanas 6 a 8). Catálogo de overlays SVG no frontend, começando pelos 8 essenciais (midline, terços, quintos, contorno mandibular, canthal tilt, eye spacing, máscara de simetria, vetores de melhoria). Endpoint /vision/render server-side para os mesmos overlays. Heatmaps de assimetria e de aderência ao ideal. Composição "before/ideal" só com vetores (sem warp). Toggle bar funcional no frontend.
Marco 4 — Diagnóstico e plano de ação (semanas 9 a 10). Templates de texto para cada métrica em três tamanhos. Engine de priorização. Recomendações catalogadas. Disclaimers obrigatórios. Geração do PDF do relatório. Revisão de copywriting com alguém não-engenheiro.
Marcos opcionais pós-MVP. Composição before/ideal com warp real da imagem; análise de pixel (acne, olheiras) em módulo separado; multi-captura com mediana de landmarks; comparação longitudinal between reports.

Riscos, armadilhas e o que NÃO fazer
Não trate landmarks ruins como bons. A maior fonte de bug aqui não é cálculo errado — é cálculo certo sobre landmarks instáveis. Sempre cheque a confiança que vem do Módulo 0 antes de qualquer coisa. Métricas com confiança < 0.4 não chegam no usuário.
Não cole pesos no código. Todos os pesos, faixas ideais, templates, recomendações ficam em arquivos de configuração versionados. Mudar um peso não pode exigir deploy de código.
Não venda como diagnóstico médico. Os anexos já reforçam isso — está literalmente no conselho final. O linguajar do produto, dos templates, do disclaimer e do nome das métricas precisa refletir "análise estética geométrica", nunca "diagnóstico". Profissional de saúde lê isso e o produto morre se a posição não estiver clara.
Não tente entregar 80 métricas no Marco 1. A tentação de implementar tudo de uma vez é grande. Aprenda primeiro com 20 métricas calibradas, ajuste o pipeline, depois escale.
Não monte overlays sem ter ideais calibrados. Um overlay que mostra "seu nariz está fora do ideal" quando o ideal foi mal definido é pior do que não mostrar nada. Calibre antes, desenhe depois.
Não esqueça de versionar os ideais. Se você mudar metric_ideals.yaml sem versionar, perde a capacidade de comparação longitudinal — o usuário verá "evolução" que é só recalibração.
Não meça pele com landmarks. Se a especificação pedir métricas que dependem de pixel, separe num módulo distinto e marque na carteira de identidade da métrica. Não enfie cálculo de pele dentro do módulo de simetria.
Não exponha o score global cedo demais. Antes de ter 60+ métricas e calibração razoável, o score global será volátil e enganoso. Mostre só scores regionais até a calibração estar madura.
Não trate "before/ideal" com warp como produto da Fase 3 inicial. Warp facial é tecnicamente delicado, eticamente mais ainda. Implemente como recurso opcional, depois do resto, e sempre marcado como "simulação aproximada".
Não acople o frontend ao schema interno do FastAPI. Toda comunicação passa pelo NestJS. Mudanças de campo no Python não devem quebrar o Next. Use DTOs espelhados e validados nos dois lados.
Não esqueça da consistência longitudinal. Cada AnalysisReport salvo precisa carregar quality_score, consistency_score, ideals_version e o fingerprint da sessão. Sem isso, comparação between reports é ruído (já documentado nos anexos — leve a sério).
