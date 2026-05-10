# 📖 Referência Completa: Exercícios Faciais com Animation Config (PR-D)

> Consolidação de todos os 63 exercícios faciais seeded com `animation_config` na migration `1746000260000-M44AnimationConfigSeed.ts`.
> Cada exercício inclui: primitives animados, duração, regiões de calor (heat_regions) e captions instrucionais em português.

---

## 📑 Índice de Regiões

1. [👁️ Sobrancelha & Frontal](#-sobrancelha--frontal) (5)
2. [👀 Olho & Órbita](#-olho--órbita) (9)
3. [👄 Boca & Lábios](#-boca--lábios) (11)
4. [👅 Língua & Palato (com raio-X)](#-língua--palato-com-raio-x) (17)
5. [🦴 Mandíbula & Masseter](#-mandíbula--masseter) (14)
6. [🎈 Bochecha](#-bochecha) (4)
7. [🧬 Pescoço & Cervical](#-pescoço--cervical) (2)
8. [🤸 Alongamentos](#-alongamentos) (1)

---

## 👁️ Sobrancelha & Frontal

### 1. exercise-brow-lift-isometric
**Levantamento de Sobrancelha Isométrico**

| Propriedade | Valor |
|---|---|
| **Primitives** | `brow_lift_both` (intensity: 0.9) |
| **Duração** | 1500ms animação, 5000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `frontalis` (pulse: ✅) |
| **Caption PT** | "Eleve as sobrancelhas contra resistência dos dedos — mantenha isométrico." |
| **Descrição** | Posicione os dedos sobre as sobrancelhas e tente elevá-las contra a resistência, mantendo 5 segundos; 10 repetições, 1× ao dia. |

---

### 2. exercise-frontalis-conscious-relaxation
**Relaxamento Consciente do Frontalis**

| Propriedade | Valor |
|---|---|
| **Primitives** | `brow_relax` (intensity: 1) |
| **Duração** | 3000ms |
| **Repetição** | Infinita |
| **Heat Regions** | `frontalis` (pulse: ❌) |
| **Caption PT** | "Solte a testa conscientemente — observe sem corrigir." |
| **Descrição** | Observar ao espelho 1 minuto por dia se a testa está franzida em repouso e relaxá-la conscientemente. |

---

### 3. routine-lt-31-nasalis-transversus-activation
**Ativação de Nasalis Transversus**

| Propriedade | Valor |
|---|---|
| **Primitives** | `brow_furrow` (intensity: 0.7) |
| **Duração** | 1200ms animação, 1000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `corrugator` (pulse: ✅) |
| **Caption PT** | "Enrugue o nariz como se cheirasse algo forte — sinta o nasal transverso." |
| **Descrição** | Contração voluntária do nasalis; 10 repetições por sessão, 2× ao dia. |

---

### 4. routine-lt-35-frontalis-elastic-band
**Frontalis com Fita Elástica**

| Propriedade | Valor |
|---|---|
| **Primitives** | `brow_lift_both` (intensity: 1) |
| **Duração** | 1500ms animação, 6000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `frontalis` (pulse: ✅) |
| **Caption PT** | "Levante as sobrancelhas contra a faixa elástica — sustente." |
| **Descrição** | Levantamento de sobrancelha com resistência de fita; 10 repetições, 1× ao dia. |

---

### 5. routine-lt-36-reverse-squinting
**Squinting Reverso**

| Propriedade | Valor |
|---|---|
| **Primitives** | `eye_wide_open` (intensity: 1) |
| **Duração** | 1200ms animação, 3000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `frontalis` (pulse: ✅) |
| **Caption PT** | "Arregale os olhos focando um ponto fixo — sustente sem piscar." |
| **Descrição** | Abra os olhos contra resistência de contração; 10 repetições, 1× ao dia. |

---

## 👀 Olho & Órbita

### 6. exercise-eye-tracking-pencil-pushups
**Rastreamento de Olho - Pencil Pushups**

| Propriedade | Valor |
|---|---|
| **Primitives** | `eye_track_horizontal` (intensity: 1) |
| **Duração** | 3000ms |
| **Repetição** | Reversa (vai e volta) |
| **Heat Regions** | — |
| **Caption PT** | "Acompanhe a ponta do lápis se aproximando lentamente do nariz." |
| **Descrição** | Mova os olhos em padrão de aproximação seguindo caneta; 5 minutos, 1× ao dia. |

---

### 7. exercise-orbicularis-oculi-isometric
**Isométrico de Orbicularis Oculi**

| Propriedade | Valor |
|---|---|
| **Primitives** | `eye_squeeze_both` (intensity: 0.8) |
| **Duração** | 1500ms animação, 3000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oculi_l`, `orbicularis_oculi_r` (pulse: ✅) |
| **Caption PT** | "Aperte os olhos com força moderada — sustente sem franzir a testa." |
| **Descrição** | Contraia os músculos ao redor dos olhos; 10 repetições, 1-2× ao dia. |

---

### 8. routine-lt-37-saccadic-eye-movements
**Movimentos Sacádicos dos Olhos**

| Propriedade | Valor |
|---|---|
| **Primitives** | `eye_track_horizontal` (intensity: 1) |
| **Duração** | 800ms |
| **Repetição** | Reversa |
| **Heat Regions** | — |
| **Caption PT** | "Movimentos oculares rápidos entre dois pontos — saltos sacádicos." |
| **Descrição** | Movimentos rápidos e discretos dos olhos entre dois pontos. |

---

### 9. routine-lt-38-pendulum-tracking
**Rastreamento de Pêndulo**

| Propriedade | Valor |
|---|---|
| **Primitives** | `eye_track_horizontal` (intensity: 0.8) |
| **Duração** | 4000ms |
| **Repetição** | Reversa |
| **Heat Regions** | — |
| **Caption PT** | "Acompanhe um pêndulo lateralmente — movimento suave e contínuo." |
| **Descrição** | Siga objeto em movimento pendular. |

---

### 10. routine-lt-39-thumb-horizon-shift
**Deslocamento Horizontal do Polegar**

| Propriedade | Valor |
|---|---|
| **Primitives** | `eye_track_horizontal` (intensity: 0.9) |
| **Duração** | 2500ms |
| **Repetição** | Reversa |
| **Heat Regions** | — |
| **Caption PT** | "Foque o polegar perto, depois o horizonte — alterne ritmicamente." |
| **Descrição** | Mova olhos horizontalmente contra referência. |

---

### 11. routine-lt-40-extreme-360-rotation-closed
**Rotação Extrema 360º com Olhos Fechados**

| Propriedade | Valor |
|---|---|
| **Primitives** | `eye_track_figure8` (intensity: 1) |
| **Duração** | 4000ms |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oculi_l`, `orbicularis_oculi_r` (pulse: ❌) |
| **Caption PT** | "Rotação ocular 360° de olhos fechados — amplitude máxima." |
| **Descrição** | Rotação ocular completa em todas as direções com olhos fechados. |

---

### 12. routine-lt-41-lower-eyelid-isometric
**Isométrico da Pálpebra Inferior**

| Propriedade | Valor |
|---|---|
| **Primitives** | `eye_squeeze_lower` (intensity: 0.8) |
| **Duração** | 1500ms animação, 4000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oculi_l`, `orbicularis_oculi_r` (pulse: ✅) |
| **Caption PT** | "Ative só a pálpebra inferior — pálpebra superior parada." |
| **Descrição** | Contraia especificamente a pálpebra inferior; 10 repetições, 1× ao dia. |

---

### 13. routine-lt-42-asymmetric-eyelid-blink
**Piscada Assimétrica de Pálpebra**

| Propriedade | Valor |
|---|---|
| **Primitives** | `eye_blink_asymmetric` (intensity: 1) |
| **Duração** | 3000ms |
| **Repetição** | Infinita |
| **Heat Regions** | — |
| **Caption PT** | "Piscadela super lenta de um olho só — controle a assimetria." |
| **Descrição** | Pisque assimetricamente (um olho de cada vez). |

---

### 14. routine-lt-29-temple-isometric-blink
**Piscada Isométrica de Têmpora**

| Propriedade | Valor |
|---|---|
| **Primitives** | `eye_squeeze_both` (0.6), `brow_furrow` (0.4) |
| **Duração** | 1800ms animação, 2500ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `temporalis` (pulse: ✅) |
| **Caption PT** | "Puxe a pele das têmporas para trás-cima e pisque com força." |
| **Descrição** | Contração isométrica da região temporal; 10 repetições, 1× ao dia. |

---

## 👄 Boca & Lábios

### 15. exercise-cheek-lift-smile-hold
**Levantamento de Bochecha com Sorriso**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_wide_smile` (0.9), `cheek_lift_smile` (0.8) |
| **Duração** | 2000ms animação, 6000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `zygomaticus_l`, `zygomaticus_r` (pulse: ✅) |
| **Caption PT** | "Sorriso fechado sustentado — sinta as maçãs do rosto subirem." |
| **Descrição** | Sorriso sustentado com elevação de bochechas; 10 repetições, 1× ao dia. |
| **Estudo** | Único exercício facial com estudo RCT positivo (Northwestern 2018, Alam et al.) — efeito modesto sobre bochechas em 20 semanas. |

---

### 16. exercise-mouth-corner-symmetry-drill
**Exercício de Simetria de Canto de Boca**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_corner_lift_left` (0.8, delay: 0ms), `lip_corner_lift_right` (0.8, delay: 1000ms) |
| **Duração** | 2000ms animação |
| **Repetição** | Infinita |
| **Heat Regions** | `zygomaticus_l`, `zygomaticus_r` (pulse: ✅) |
| **Caption PT** | "Eleve um canto da boca de cada vez — espelho à frente." |
| **Descrição** | Trabalhe simetria nos cantos da boca; 30 segundos por lado, 2× ao dia. |

---

### 17. exercise-orbicularis-oris-pursing
**Canuleta de Orbicularis Oris**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_pucker` (intensity: 1) |
| **Duração** | 1500ms animação, 5000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oris` (pulse: ✅) |
| **Caption PT** | "Beicinho sustentado — lábios projetados como para um beijo." |
| **Descrição** | Pucker/pinça dos lábios; 10 repetições, 2× ao dia. |

---

### 18. exercise-phoneme-mn-ng-training
**Treinamento de Fonema M/N/NG**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_seal` (intensity: 0.7) |
| **Duração** | 1500ms |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oris` (pulse: ✅) |
| **Caption PT** | "Repita "M-N-NG" alongando cada som — lábios selados em M." |
| **Descrição** | Enuncie fonemas para ativar orbicularis; 2 minutos, 1× ao dia. |

---

### 19. routine-lt-02-horizontal-pencil-lips
**Lápis Horizontal nos Lábios**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_seal` (intensity: 0.8) |
| **Duração** | 2000ms animação, 8000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oris` (pulse: ✅) |
| **Caption PT** | "Segure um lápis horizontal apenas com os lábios — sem dentes." |
| **Descrição** | Segure lápis horizontalmente com lábios; 1-2 minutos, 1× ao dia. |

---

### 20. routine-lt-13-upper-lip-resistance
**Resistência de Lábio Superior**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_resistance_pull` (intensity: 0.9) |
| **Duração** | 1500ms animação, 4000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oris` (pulse: ✅) |
| **Caption PT** | "Puxe o lábio superior para baixo contra resistência manual." |
| **Descrição** | Levante lábio superior contra resistência; 10 repetições, 1× ao dia. |

---

### 21. routine-lt-26-dao-isometric
**DAO Isométrico**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_corner_lift_left` (0.3), `lip_corner_lift_right` (0.3) |
| **Duração** | 1500ms animação, 4000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `mentalis` (pulse: ✅) |
| **Caption PT** | "Force os cantos da boca para baixo — "sorriso triste" isométrico." |
| **Descrição** | Abra boca contra resistência (depressor); 10 repetições, 1× ao dia. |

---

### 22. routine-lt-27-risorius-tension
**Tensão de Risorius**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_wide_smile` (intensity: 1) |
| **Duração** | 1500ms animação, 5000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `zygomaticus_l`, `zygomaticus_r` (pulse: ✅) |
| **Caption PT** | "Sorriso esticado horizontal sem mostrar dentes — tensão no risório." |
| **Descrição** | Puxe cantos de boca para trás (riso); 10 repetições, 1× ao dia. |

---

### 23. routine-lt-30-disgust-lip-elevation
**Elevação de Lábio de Nojo**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_corner_lift_left` (intensity: 0.9) |
| **Duração** | 1500ms animação, 3000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `zygomaticus_l` (pulse: ✅) |
| **Caption PT** | "Levante apenas um lábio superior — face de "nojo" unilateral." |
| **Descrição** | Eleve lábio superior (movimento de nojo); 10 repetições, 1× ao dia. |

---

### 24. routine-lt-66-lip-corner-static-stretch
**Alongamento Estático de Canto de Lábio**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_wide_smile` (intensity: 0.7) |
| **Duração** | 2000ms animação, 7000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oris` (pulse: ❌) |
| **Caption PT** | "Alongue lentamente as comissuras labiais para fora." |
| **Descrição** | Mantenha alongamento nos cantos da boca; 30 segundos, 1× ao dia. |

---

### 25. exercise-water-suction-control
**Controle de Sucção de Água**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_pucker` (intensity: 0.8) |
| **Duração** | 2500ms |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oris` (pulse: ✅) |
| **Caption PT** | "Sucção lenta e controlada com canudo — mantenha lábios firmes." |
| **Descrição** | Sução controlada com água para orbicularis; 10 ciclos, 1× ao dia. |

---

## 👅 Língua & Palato (com raio-X)

### 26. exercise-cave-suction-hold
**Suporte de Sucção de Caverna**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_palate_press` (intensity: 1) |
| **Duração** | 2000ms animação, 8000ms sustentação |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim (pele semitransparente) |
| **Caption PT** | "Vácuo intraoral — toda a língua aderida ao palato, mandíbula relaxada." |
| **Descrição** | Língua preso ao palato por sucção; 5-10 minutos, 1-2× ao dia. |

---

### 27. exercise-swallow-sweep
**Varredura de Deglutição**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_sweep_circular` (intensity: 0.8) |
| **Duração** | 3000ms |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Engula lentamente com a língua varrendo o palato anterior." |
| **Descrição** | Movimento de língua em varredura durante deglutição; 10 ciclos, 2× ao dia. |

---

### 28. exercise-tongue-chewing
**Mastigação de Língua**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_palate_press` (intensity: 0.7) |
| **Duração** | 1500ms |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | ""Mastigue" um chiclete imaginário pressionando a língua no palato." |
| **Descrição** | Mastigue com ponta de língua; 10 minutos, 1× ao dia. |

---

### 29. exercise-tongue-click
**Click de Língua**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_click` (intensity: 1) |
| **Duração** | 1000ms |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Estale a língua contra o palato — som forte e seco." |
| **Descrição** | Clique de língua ao palato; 20 repetições, 1× ao dia. |

---

### 30. exercise-tongue-posture-mewing
**Postura de Língua - Mewing**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_palate_press` (intensity: 0.9) |
| **Duração** | 3000ms animação, 10000ms sustentação |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Toda a língua pressionando o palato — postura sustentada ao longo do dia." |
| **Descrição** | Mantenha língua no palato duro (mewing) durante o dia. |
| **Nota** | Sem RCT em adultos; proposto como influência sobre desenvolvimento maxilar. |

---

### 31. exercise-tongue-roof-press
**Pressão de Teto de Língua**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_palate_press` (intensity: 1) |
| **Duração** | 1500ms animação, 5000ms sustentação |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Pressione a língua no palato com força máxima — isometria." |
| **Descrição** | Pressione língua contra teto da boca; 10 repetições, 2× ao dia. |

---

### 32. exercise-tongue-sweep
**Varredura de Língua**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_sweep_circular` (intensity: 1) |
| **Duração** | 2500ms |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Varra a língua pelo palato em círculos — limpeza completa." |
| **Descrição** | Movimento de varredura de língua intra-oral; 10 ciclos, 1× ao dia. |

---

### 33. routine-lt-01-tongue-segmental-click
**Click Segmental - Palato Duro**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_click` (intensity: 0.9) |
| **Duração** | 1200ms |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Estalo segmentar — ápice, médio, base da língua em sequência." |
| **Descrição** | Cliques de língua em sequência no palato duro; 10 ciclos, 1× ao dia. |

---

### 34. routine-lt-03-pastille-palate-suction
**Pastilha - Palato Duro**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_palate_press` (intensity: 0.8) |
| **Duração** | 3000ms animação, 8000ms sustentação |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Sustente uma pastilha contra o palato — não mastigue." |
| **Descrição** | Mantenha pastilha/doce de língua no palato; 5 minutos, 1× ao dia. |

---

### 35. routine-lt-04-tongue-cheek-resistance
**Resistência de Bochecha com Língua**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_lateral_left` (intensity: 0.9) |
| **Duração** | 1500ms animação, 3000ms sustentação |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Heat Regions** | `buccinator_l` (pulse: ✅) |
| **Caption PT** | "Empurre a língua contra a bochecha — resista por fora com o dedo." |
| **Descrição** | Empurre bochecha com ponta de língua; 10 repetições cada lado, 1× ao dia. |

---

### 36. routine-lt-05-tongue-vestibular-sweep
**Varredura Vestibular**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_sweep_circular` (intensity: 0.8) |
| **Duração** | 4000ms |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Varra os dentes pela face vestibular — 360° lento." |
| **Descrição** | Movimento de língua no vestíbulo labial; 10 ciclos, 2× ao dia. |

---

### 37. routine-lt-06-tongue-extra-oral-stretch
**Alongamento Extra-oral**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_extra_oral_down` (intensity: 1) |
| **Duração** | 2000ms animação, 4000ms sustentação |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Língua para fora e para baixo — alongamento extra-oral máximo." |
| **Descrição** | Estique língua para fora máximo; 10 repetições, 1× ao dia. |

---

### 38. routine-lt-07-horse-click-floor
**Click de Cavalo**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_click` (intensity: 1) |
| **Duração** | 800ms |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Estalo "cavalinho" forte — ative o assoalho da boca." |
| **Descrição** | Som de cavalo com cliques de língua; 1 minuto, 1× ao dia. |

---

### 39. routine-lt-08-tongue-tip-lower-teeth
**Ponta de Língua em Dentes Inferiores**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_palate_press` (intensity: 0.6) |
| **Duração** | 1500ms animação, 4000ms sustentação |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Ápice da língua pressionando dentes inferiores — isometria." |
| **Descrição** | Toque ponta de língua nos dentes inferiores; 10 repetições, 1× ao dia. |

---

### 40. routine-lt-09-tongue-base-elevation
**Elevação de Base de Língua**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_palate_press` (intensity: 0.7) |
| **Duração** | 2000ms animação, 3000ms sustentação |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Boca aberta — eleve a base da língua sem fechar a mandíbula." |
| **Descrição** | Eleve a base da língua (garganta profunda); 10 repetições, 1× ao dia. |

---

### 41. routine-lt-10-fake-smile-swallow-isolation
**Isolamento de Sorriso Falso**

| Propriedade | Valor |
|---|---|
| **Primitives** | `lip_wide_smile` (0.7), `tongue_sweep_circular` (0.6) |
| **Duração** | 3000ms |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Engula com sorriso forçado — isola o trabalho da língua." |
| **Descrição** | Sorriso falso para isolar suprahioideo; 10 repetições, 1× ao dia. |

---

### 42. routine-lt-64-atypical-swallow-inhibition
**Deglutição Atípica (Inibição)**

| Propriedade | Valor |
|---|---|
| **Primitives** | `tongue_palate_press` (intensity: 0.8) |
| **Duração** | 2500ms animação, 2000ms sustentação |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Antes de engolir, posicione a língua no palato — inibe o reflexo atípico." |
| **Descrição** | Padrão de deglutição modificado/atípico; 10 repetições, 2× ao dia. |

---

## 🦴 Mandíbula & Masseter

### 43. exercise-mandibular-decompression
**Descompressão Mandibular**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_open_wide` (intensity: 0.5) |
| **Duração** | 3000ms animação, 5000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l`, `masseter_r` (pulse: ❌) |
| **Caption PT** | "Abertura passiva — deixe a mandíbula cair pelo próprio peso." |
| **Descrição** | Pendulum exercises para mandíbula; 5 minutos, 1× ao dia. |

---

### 44. exercise-mandibular-isometric-resistance
**Isométrico Mandibular com Resistência**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_clench` (intensity: 0.7) |
| **Duração** | 1500ms animação, 5000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l`, `masseter_r` (pulse: ✅) |
| **Caption PT** | "Cerre os dentes contra resistência manual no queixo — isometria." |
| **Descrição** | Contraia mandíbula contra resistência; 10 repetições, 1× ao dia. |

---

### 45. exercise-mandibular-opening-resistance
**Resistência de Abertura Mandibular**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_open_wide` (intensity: 0.7) |
| **Duração** | 1800ms animação, 3000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l`, `masseter_r` (pulse: ✅) |
| **Caption PT** | "Abra a mandíbula contra resistência sob o queixo." |
| **Descrição** | Abra mandíbula contra resistência; 10 repetições, 1× ao dia. |

---

### 46. exercise-masseter-isometric-clench
**Cerramento Isométrico de Masseter**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_clench` (intensity: 0.7) |
| **Duração** | 1500ms animação, 5000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l`, `masseter_r`, `temporalis` (pulse: ✅/❌) |
| **Caption PT** | "Cerre os dentes com firmeza moderada — sinta a lateral da mandíbula tensionar." |
| **Descrição** | Cerre dentes com firmeza moderada; 10 repetições, 1× ao dia. |
| **Cuidado** | Contraindicado em bruxismo ou DTM. |

---

### 47. exercise-jaw-side-symmetrize
**Simetrização Lateral de Mandíbula**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_lateral_left` (intensity: 0.6) |
| **Duração** | 2000ms |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l` (pulse: ✅) |
| **Caption PT** | "Mastigação direcionada ao lado de menor tônus — atenção plena." |
| **Descrição** | Movimentos laterais para simetrizar; 4-6 semanas de prática. |

---

### 48. exercise-hyoid-suprahyoid-strengthening
**Fortalecimento de Hioides/Suprahioideo**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_open_wide` (intensity: 0.8) |
| **Duração** | 2000ms animação, 4000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `mentalis`, `platysma` (pulse: ✅) |
| **Caption PT** | "Boca aberta — empurre a língua contra os dentes inferiores." |
| **Descrição** | Ative músculos suprahioides (sob queixo); 10 repetições, 2× ao dia. |

---

### 49. routine-lt-15-mentalis-tactile-inhibition
**Inibição Tátil do Mentual**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_clench` (intensity: 0.2) |
| **Duração** | 2500ms |
| **Repetição** | Infinita |
| **Heat Regions** | `mentalis` (pulse: ❌) |
| **Caption PT** | "Toque o queixo ao engolir — inibe a contração do mentual." |
| **Descrição** | Dedo firme no queixo durante deglutição; 10 repetições, 1× ao dia. |

---

### 50. routine-lt-16-mandibular-rotation-mirror
**Rotação Mandibular Espelhada**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_infinity` (intensity: 0.8) |
| **Duração** | 4000ms |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l`, `masseter_r` (pulse: ❌) |
| **Caption PT** | "Abertura mandibular em "infinito" — controle ao espelho." |
| **Descrição** | Rotação de mandíbula em espelho; 10 ciclos, 2× ao dia. |

---

### 51. routine-lt-17-mandibular-protrusion-isometric
**Protrusão Mandibular Isométrica**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_protrusion` (intensity: 0.9) |
| **Duração** | 1500ms animação, 5000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l`, `masseter_r` (pulse: ✅) |
| **Caption PT** | "Projete a mandíbula para frente — sustente isométrico." |
| **Descrição** | Saia queixo para frente contra resistência; 10 repetições, 1× ao dia. |

---

### 52. routine-lt-18-mandibular-retrusion-isometric
**Retrusão Mandibular Isométrica**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_retrusion` (intensity: 0.8) |
| **Duração** | 1500ms animação, 5000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l`, `masseter_r` (pulse: ✅) |
| **Caption PT** | "Recue a mandíbula contra a posição de descanso — sustente." |
| **Descrição** | Recue queixo para trás contra resistência; 10 repetições, 1× ao dia. |

---

### 53. routine-lt-19-mandibular-hinge-movement
**Movimento de Dobradiça Mandibular**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_open_wide` (0.6), `tongue_palate_press` (0.9) |
| **Duração** | 2500ms animação, 3000ms sustentação |
| **Repetição** | Infinita |
| **Show XRay** | ✅ Sim |
| **Caption PT** | "Abra a mandíbula mantendo a língua presa no palato — dobradiça pura." |
| **Descrição** | Abertura pura de dobradiça (sem movimento anterior); 10 repetições, 1× ao dia. |

---

### 54. routine-lt-21-mandibular-caudal-traction
**Tração Caudal Mandibular**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_open_wide` (intensity: 0.4) |
| **Duração** | 4000ms animação, 6000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l`, `masseter_r` (pulse: ❌) |
| **Caption PT** | "Tração caudal passiva — peso da mandíbula descomprime a ATM." |
| **Descrição** | Puxe mandíbula para baixo e para trás; 10 repetições, 1× ao dia. |

---

### 55. routine-lt-23-jaw-wood-spatula-stretch
**Alongamento com Espátula de Madeira**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_open_wide` (intensity: 0.7) |
| **Duração** | 3000ms animação, 8000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l`, `masseter_r` (pulse: ❌) |
| **Caption PT** | "Espátulas empilhadas entre os dentes — alongamento progressivo." |
| **Descrição** | Espátulas empilhadas entre dentes; 5 minutos, 1× ao dia. |

---

### 56. routine-lt-69-mandibular-bite-block
**Bloco de Mordida Mandibular**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_lateral_left` (intensity: 0.7) |
| **Duração** | 1800ms animação, 3000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `masseter_l` (pulse: ✅), `masseter_r` (pulse: ❌) |
| **Caption PT** | "Deslize lateral contra bloqueio do dedo — força lateral controlada." |
| **Descrição** | Deslize lateral contra bloqueio do dedo; 10 repetições, 1× ao dia. |

---

## 🎈 Bochecha

### 57. exercise-buccinator-puff
**Insuflação de Buccinador**

| Propriedade | Valor |
|---|---|
| **Primitives** | `cheek_puff_left` (1, delay: 0ms), `cheek_puff_right` (1, delay: 1000ms) |
| **Duração** | 2000ms animação |
| **Repetição** | Infinita |
| **Heat Regions** | `buccinator_l`, `buccinator_r` (pulse: ✅) |
| **Caption PT** | "Insufle uma bochecha de cada vez — alterne ritmicamente." |
| **Descrição** | Insufle bochechas alternadamente; 30 segundos, 2× ao dia. |

---

### 58. routine-lt-11-air-rotation-upper-lip
**Rotação de Ar - Lábio Superior**

| Propriedade | Valor |
|---|---|
| **Primitives** | `cheek_puff_both` (intensity: 0.7) |
| **Duração** | 2500ms |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oris` (pulse: ✅) |
| **Caption PT** | "Gire o ar sob o lábio superior — círculos amplos." |
| **Descrição** | Gire ar sob lábio superior; 30 segundos por lado, 1× ao dia. |

---

### 59. routine-lt-12-air-rotation-lower-lip
**Rotação de Ar - Lábio Inferior**

| Propriedade | Valor |
|---|---|
| **Primitives** | `cheek_puff_both` (intensity: 0.7) |
| **Duração** | 2500ms |
| **Repetição** | Infinita |
| **Heat Regions** | `orbicularis_oris` (pulse: ✅) |
| **Caption PT** | "Gire o ar sob o lábio inferior — círculos amplos." |
| **Descrição** | Gire ar sob lábio inferior; 30 segundos por lado, 1× ao dia. |

---

### 60. routine-lt-14-unilateral-cheek-puff
**Insuflação Unilateral de Bochecha**

| Propriedade | Valor |
|---|---|
| **Primitives** | `cheek_puff_left` (intensity: 1) |
| **Duração** | 2000ms animação, 3000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `buccinator_l` (pulse: ✅) |
| **Caption PT** | "Bochecho de ar unilateral — sustente uma bochecha cheia." |
| **Descrição** | Bochecho de ar unilateral; 30 segundos, 2× ao dia. |

---

## 🧬 Pescoço & Cervical

### 61. exercise-chin-jut-platysma
**Projeção de Queixo - Platisma**

| Propriedade | Valor |
|---|---|
| **Primitives** | `jaw_protrusion` (0.9), `neck_extension` (0.6) |
| **Duração** | 2000ms animação, 4000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `platysma` (pulse: ✅), `mentalis` (pulse: ❌) |
| **Caption PT** | "Projete o queixo para cima e para frente — sinta o platisma alongar." |
| **Descrição** | Projete queixo para cima e para frente; 10 repetições, 1× ao dia. |

---

### 62. routine-lt-48-supine-cervical-retraction
**Retração Cervical Supina**

| Propriedade | Valor |
|---|---|
| **Primitives** | `neck_chin_tuck` (intensity: 1) |
| **Duração** | 2000ms animação, 5000ms sustentação |
| **Repetição** | Infinita |
| **Heat Regions** | `suboccipital` (pulse: ✅), `scm_l`, `scm_r` (pulse: ❌) |
| **Caption PT** | "Em decúbito dorsal — recue o queixo pressionando a nuca no chão." |
| **Descrição** | Em decúbito dorsal, recue queixo no chão; 10 repetições, 1× ao dia. |

---

## 🤸 Alongamentos

### 63. exercise-nasal-breathing-retraining
**Respiração Nasal (Indicador Estático)**

| Propriedade | Valor |
|---|---|
| **Primitives** | `static_breathing_indicator` (intensity: 1) |
| **Duração** | 4000ms |
| **Repetição** | Infinita |
| **Heat Regions** | — |
| **Caption PT** | "Respiração exclusivamente nasal — boca selada o dia todo." |
| **Descrição** | Vedar a respiração bucal durante o dia e ao dormir; prática contínua. |

---

## 📊 Sumário Estatístico

| Categoria | Quantidade | Com Heat Regions | Com XRay |
|---|---|---|---|
| **Sobrancelha/Frontal** | 5 | 5 | — |
| **Olho** | 9 | 5 | — |
| **Boca/Lábios** | 11 | 11 | — |
| **Língua (raio-X)** | 17 | 2 | 17 ✅ |
| **Mandíbula** | 14 | 13 | 1 |
| **Bochecha** | 4 | 4 | — |
| **Pescoço/Cervical** | 2 | 2 | — |
| **Respiração** | 1 | — | — |
| **TOTAL** | **63** | **42** | **18** |

---

## 🎯 Notas Importantes

### Primitives Disponíveis (por categoria)

**Sobrancelha:**
- `brow_lift_both`, `brow_relax`, `brow_furrow`

**Olho:**
- `eye_squeeze_both`, `eye_squeeze_lower`, `eye_track_horizontal`, `eye_track_figure8`, `eye_wide_open`, `eye_blink_asymmetric`

**Boca/Lábios:**
- `lip_pucker`, `lip_seal`, `lip_wide_smile`, `lip_corner_lift_left`, `lip_corner_lift_right`, `lip_resistance_pull`, `cheek_lift_smile`

**Língua:**
- `tongue_palate_press`, `tongue_sweep_circular`, `tongue_click`, `tongue_lateral_left`, `tongue_extra_oral_down`

**Mandíbula:**
- `jaw_clench`, `jaw_open_wide`, `jaw_lateral_left`, `jaw_protrusion`, `jaw_retrusion`, `jaw_infinity`

**Bochecha:**
- `cheek_puff_left`, `cheek_puff_right`, `cheek_puff_both`

**Pescoço:**
- `jaw_protrusion`, `neck_chin_tuck`, `neck_extension`

**Especial:**
- `static_breathing_indicator`

### Heat Regions Mapeadas

| Região | Exercícios | Pulse Típico |
|---|---|---|
| **frontalis** | Sobrancelha | ✅ ativo |
| **corrugator** | Frontal | ✅ ativo |
| **orbicularis_oculi_l/r** | Olho | ✅/❌ varia |
| **temporalis** | Têmpora | ✅ ativo |
| **orbicularis_oris** | Boca/Lábios | ✅ ativo |
| **zygomaticus_l/r** | Boca/Maçã | ✅ ativo |
| **mentalis** | Queixo | ✅/❌ varia |
| **tongue_*** | (show_xray=true) | N/A |
| **masseter_l/r** | Mandíbula | ✅/❌ varia |
| **buccinator_l/r** | Bochecha | ✅ ativo |
| **platysma** | Pescoço | ✅ ativo |
| **scm_l/r** | Pescoço | ❌ passivo |
| **suboccipital** | Pescoço | ✅ ativo |

---

## 🔗 Referências Clínicas

- **Alam M. et al. (2018)** — "Association of facial exercise with the appearance of aging." JAMA Dermatol. ([PubMed](https://pubmed.ncbi.nlm.nih.gov/29299598/)) — Único RCT positivo em face yoga (20 semanas, efeito modesto em bochechas).
- **Felício C.M. et al. (2010)** — "Orofacial myofunctional therapy." J Oral Rehabil. ([PubMed](https://pubmed.ncbi.nlm.nih.gov/20557431/)) — Protocolo mioterapia orofacial.
- **Solow B. & Sandham A. (2002)** — "Cranio-cervical posture." Eur J Orthod. ([PubMed](https://pubmed.ncbi.nlm.nih.gov/12407941/)) — Postura cervical e assimetria facial.
- **Rocabado M. (1983)** — "Biomechanical relationship of cervical spine and mandible." CRANIO. ([PubMed](https://pubmed.ncbi.nlm.nih.gov/6586148/)) — Relação biomecânica cervical-mandibular.

---

**Gerado em:** 2026-05-10  
**Versão:** PR-D (Animation Config v1.0)  
**Total de Exercícios:** 63 com animação + 97 sem animação = 160 total no catálogo
