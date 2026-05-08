
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



onde consigo essa tabela ?

Você NÃO vai encontrar uma “tabela perfeita pronta”.
Todo produto sério nessa área monta uma base híbrida própria.

O que você consegue hoje é combinar:

---

# 1. Literatura antropométrica facial

Aqui estão as melhores fontes reais.

## Base científica clássica

### [Farkas Anthropometry of the Head and Face](https://www.amazon.com/Anthropometry-Head-Face-Leslie-Farkas/dp/0781724057?utm_source=chatgpt.com)

Esse é basicamente:

* a bíblia da antropometria facial

Tem:

* médias
* desvios
* sexo
* idade
* etnias
* centenas de medidas faciais

Inclui:

* nariz
* olhos
* boca
* mandíbula
* thirds
* proporções

---

# 2. Dataset facial com landmarks

Você pode gerar SUA tabela.

---

## Melhor dataset gratuito:

### [Chicago Face Database](https://www.chicagofaces.org?utm_source=chatgpt.com)

Tem:

* milhares de rostos
* sexo
* idade
* etnia
* ratings de atratividade
* ratings sociais

Você pode:

1. rodar MediaPipe em tudo
2. extrair métricas
3. calcular:

   * média
   * desvio padrão
   * percentis
4. criar seu metric_ideals.yaml

Isso é provavelmente o MELHOR caminho.

---

# 3. Dataset específico de atratividade

## [SCUT-FBP5500](https://github.com/HCIILAB/SCUT-FBP5500-Database-Release?utm_source=chatgpt.com)

Muito usado em papers.

Tem:

* 5500 rostos
* score de atratividade humana
* landmarks

Excelente para:

* calibrar pesos
* descobrir quais métricas correlacionam com beleza

---

# 4. Papers de proporções estéticas

Você pode extrair ranges de papers.

Pesquise:

* facial attractiveness ratios
* neoclassical canons
* facial harmony study
* facial anthropometric norms

---

# 5. O jeito PROFISSIONAL de fazer

Você cria 3 camadas:

---

# Camada A — regras canônicas

Exemplo:

```yaml id="u1lj7s"
facial_thirds:
  ideal: 1.0
  green_range: 0.1
  yellow_range: 0.2
```

---

# Camada B — distribuição populacional

Exemplo:

```yaml id="m3qicv"
interpupillary_ratio:
  male:
    mean: 0.47
    std: 0.03
```

---

# Camada C — distribuição atrativa

Você pega:

* top 20% atratividade do dataset
  e calcula:
* média
* ranges

Agora você tem:

* população normal
* população atrativa

Isso é MUITO poderoso.

---

# Melhor arquitetura possível

## Você terá:

### metric_population_norms.yaml

```yaml id="3ms5bi"
jaw_width_ratio:
  male:
    mean: 0.82
    std: 0.06
```

---

### metric_aesthetic_ideals.yaml

```yaml id="8ol9m5"
facial_thirds:
  ideal: equal
```

---

### metric_attractive_cluster.yaml

```yaml id="tbgjlwm"
canthal_tilt:
  attractive_male_mean: 7.2
```

---

# O que apps famosos fazem

Apps tipo:

* Umax
* QOVES
* Looksmax AI

fazem exatamente isso:

* regras heurísticas
* datasets
* clusters atrativos
* médias populacionais

Não existe:
“a tabela universal da beleza”.

---

# Melhor caminho para você AGORA

## Fase 1 — sem dataset

Use:

* cânones faciais clássicos
* ranges manuais

Você consegue lançar rápido.

---

## Fase 2 — semi-estatística

Rode MediaPipe em:

* Chicago Face Database
* SCUT

e gere:

* mean
* std
* percentis

automaticamente.

---

# Estrutura ideal do YAML

Exemplo:

```yaml id="bzn9lt"
canthal_tilt:
  unit: degrees

  ideal_type: hybrid

  canonical:
    ideal: 7
    green: [4, 10]
    yellow: [1, 13]

  population:
    male:
      mean: 5.2
      std: 3.1

  attractive_cluster:
    male:
      mean: 7.4
      std: 2.0

  direction_labels:
    low: negative_tilt
    high: excessive_tilt
```

---

# O que você NÃO deve fazer

## NÃO:

* inventar números arbitrários
* usar golden ratio para tudo
* fazer score mágico sem base

Porque:
depois fica impossível calibrar.

---

# Melhor estratégia de produto

## Você não diz:

“isso é feio”

## Você diz:

* “fora da média populacional”
* “mais comum em rostos considerados atrativos”
* “ligeiramente abaixo da faixa harmônica”

Isso evita:

* claims problemáticos
* pseudo-ciência agressiva

---

# Minha recomendação real

## Faça assim:

### Agora:

* regras canônicas
* thresholds manuais

### Depois:

* extração automática do Chicago Face Database
* clustering dos rostos mais bem avaliados

Porque aí você terá:

* distribuição real
* percentis reais
* ranges reais
* score muito mais defensável.


Você NÃO vai encontrar uma “tabela perfeita pronta”.
Todo produto sério nessa área monta uma base híbrida própria.

O que você consegue hoje é combinar:

---

# 1. Literatura antropométrica facial

Aqui estão as melhores fontes reais.

## Base científica clássica

### [Farkas Anthropometry of the Head and Face](https://www.amazon.com/Anthropometry-Head-Face-Leslie-Farkas/dp/0781724057?utm_source=chatgpt.com)

Esse é basicamente:

* a bíblia da antropometria facial

Tem:

* médias
* desvios
* sexo
* idade
* etnias
* centenas de medidas faciais

Inclui:

* nariz
* olhos
* boca
* mandíbula
* thirds
* proporções

---

# 2. Dataset facial com landmarks

Você pode gerar SUA tabela.

---

## Melhor dataset gratuito:

### [Chicago Face Database](https://www.chicagofaces.org?utm_source=chatgpt.com)

Tem:

* milhares de rostos
* sexo
* idade
* etnia
* ratings de atratividade
* ratings sociais

Você pode:

1. rodar MediaPipe em tudo
2. extrair métricas
3. calcular:

   * média
   * desvio padrão
   * percentis
4. criar seu metric_ideals.yaml

Isso é provavelmente o MELHOR caminho.

---

# 3. Dataset específico de atratividade

## [SCUT-FBP5500](https://github.com/HCIILAB/SCUT-FBP5500-Database-Release?utm_source=chatgpt.com)

Muito usado em papers.

Tem:

* 5500 rostos
* score de atratividade humana
* landmarks

Excelente para:

* calibrar pesos
* descobrir quais métricas correlacionam com beleza

---

# 4. Papers de proporções estéticas

Você pode extrair ranges de papers.

Pesquise:

* facial attractiveness ratios
* neoclassical canons
* facial harmony study
* facial anthropometric norms

---

# 5. O jeito PROFISSIONAL de fazer

Você cria 3 camadas:

---

# Camada A — regras canônicas

Exemplo:

```yaml id="u1lj7s"
facial_thirds:
  ideal: 1.0
  green_range: 0.1
  yellow_range: 0.2
```

---

# Camada B — distribuição populacional

Exemplo:

```yaml id="m3qicv"
interpupillary_ratio:
  male:
    mean: 0.47
    std: 0.03
```

---

# Camada C — distribuição atrativa

Você pega:

* top 20% atratividade do dataset
  e calcula:
* média
* ranges

Agora você tem:

* população normal
* população atrativa

Isso é MUITO poderoso.

---

# Melhor arquitetura possível

## Você terá:

### metric_population_norms.yaml

```yaml id="3ms5bi"
jaw_width_ratio:
  male:
    mean: 0.82
    std: 0.06
```

---

### metric_aesthetic_ideals.yaml

```yaml id="8ol9m5"
facial_thirds:
  ideal: equal
```

---

### metric_attractive_cluster.yaml

```yaml id="tbgjlwm"
canthal_tilt:
  attractive_male_mean: 7.2
```

---

# O que apps famosos fazem

Apps tipo:

* Umax
* QOVES
* Looksmax AI

fazem exatamente isso:

* regras heurísticas
* datasets
* clusters atrativos
* médias populacionais

Não existe:
“a tabela universal da beleza”.

---

# Melhor caminho para você AGORA

## Fase 1 — sem dataset

Use:

* cânones faciais clássicos
* ranges manuais

Você consegue lançar rápido.

---

## Fase 2 — semi-estatística

Rode MediaPipe em:

* Chicago Face Database
* SCUT

e gere:

* mean
* std
* percentis

automaticamente.

---

# Estrutura ideal do YAML

Exemplo:

```yaml id="bzn9lt"
canthal_tilt:
  unit: degrees

  ideal_type: hybrid

  canonical:
    ideal: 7
    green: [4, 10]
    yellow: [1, 13]

  population:
    male:
      mean: 5.2
      std: 3.1

  attractive_cluster:
    male:
      mean: 7.4
      std: 2.0

  direction_labels:
    low: negative_tilt
    high: excessive_tilt
```

---

# O que você NÃO deve fazer

## NÃO:

* inventar números arbitrários
* usar golden ratio para tudo
* fazer score mágico sem base

Porque:
depois fica impossível calibrar.

---

# Melhor estratégia de produto

## Você não diz:

“isso é feio”

## Você diz:

* “fora da média populacional”
* “mais comum em rostos considerados atrativos”
* “ligeiramente abaixo da faixa harmônica”

Isso evita:

* claims problemáticos
* pseudo-ciência agressiva

---

# Minha recomendação real

## Faça assim:

### Agora:

* regras canônicas
* thresholds manuais

### Depois:

* extração automática do Chicago Face Database
* clustering dos rostos mais bem avaliados

Porque aí você terá:

* distribuição real
* percentis reais
* ranges reais
* score muito mais defensável.
