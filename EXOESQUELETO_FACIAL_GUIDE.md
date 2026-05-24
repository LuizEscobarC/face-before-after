---
tenant_id: "face-before-after"
project: "face-before-after"
module: "root/EXOESQUELETO_FACIAL_GUIDE"
file_path: "EXOESQUELETO_FACIAL_GUIDE.md"
doc_type: "concept"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  > Documentação técnica + exemplos práticos para animar e controlar o esqueleto facial 3D/SVG. > Sistema de primitivas faciais mapeadas para grupos musculares reais.
tags:
  - "face-rig"
rag_keywords:
  - "exoesqueleto"
  - "facial"
  - "guide"
related_modules: []
depends_on: []
used_by: []
---
# 🦴 Guia do Exoesqueleto Facial (Face Skeleton Animation System)

> Documentação técnica + exemplos práticos para animar e controlar o esqueleto facial 3D/SVG.
> Sistema de primitivas faciais mapeadas para grupos musculares reais.

---

## 📚 Índice

1. [Conceito Geral](#-conceito-geral)
2. [Estrutura de Dados](#-estrutura-de-dados)
3. [Primitivas Disponíveis](#-primitivas-disponíveis)
4. [Exemplos de Uso](#-exemplos-de-uso)
5. [Heat Regions (Músculos)](#-heat-regions-músculos)
6. [Como Estender](#-como-estender)

---

## 🎯 Conceito Geral

O **Exoesqueleto Facial** é um sistema de animação que mapeia exercícios recomendados para **primitivas faciais** (movimentos elementares) e as visualiza em um **SVG interativo** com:

### Componentes:
- **Primitives**: Unidades mínimas de movimento facial (brow_lift, lip_pucker, eye_squeeze, etc.)
- **Heat Regions**: Grupos musculares que "iluminam" durante a animação (orbicularis_oris, masseter_l, etc.)
- **Duration**: Tempo de animação + sustentação
- **Intensity**: Força do movimento (0.0 - 1.0)
- **Show XRay**: Modo semi-transparente para visualizar estrutura intra-oral (língua, palato)

### Fluxo:
```
Exercício (ex: "exercise-brow-lift-isometric")
    ↓
AnimationConfig (primitives + heat_regions)
    ↓
SVG Renderer (anima as paths do rosto)
    ↓
Heat Map Overlay (ilumina músculos em ativação)
```

---

## 🗂️ Estrutura de Dados

### Tipo: `AnimationConfig`

```typescript
interface AnimationConfig {
  schema_version: 1;                    // Versão do schema (futura compatibilidade)
  primitives: Primitive[];              // Array de primitivas a animar
  duration_ms?: number;                 // Duração total em ms (default: 2000)
  hold_ms?: number;                     // Tempo de sustentação em ms
  repeat?: 'infinite' | 'reverse' | 'once';  // Comportamento de repetição
  heat_regions?: HeatRegion[];          // Grupos musculares a destacar
  show_xray?: boolean;                  // Mostrar estrutura intra-oral (raio-x)
  caption_pt: string;                   // Instrução do exercício em português
}

interface Primitive {
  id: string;                           // ID da primitiva (ex: "brow_lift_both")
  intensity: number;                    // Força 0.0-1.0 (0=nenhum, 1=máximo)
  delay_ms?: number;                    // Delay antes de iniciar (default: 0)
}

interface HeatRegion {
  region: string;                       // Nome do músculo (ex: "frontalis")
  pulse?: boolean;                      // Se deve pulsar (animado) ou apenas colorir
}
```

---

## 🎨 Primitivas Disponíveis

### 👁️ Sobrancelha (Brow)

```typescript
// Levantamento bilateral simétrico
{ id: 'brow_lift_both', intensity: 0.9 }

// Relaxamento da testa
{ id: 'brow_relax', intensity: 1.0 }

// Franzimento (corrugação entre sobrancelhas)
{ id: 'brow_furrow', intensity: 0.7 }
```

**SVG Paths Afetados:**
- `path.brow_left` - levanta cima/para cima
- `path.brow_right` - levanta cima/para cima
- `path.corrugator` - contrai para baixo+inward

---

### 👀 Olho (Eye)

```typescript
// Apertar olhos (piscar forte)
{ id: 'eye_squeeze_both', intensity: 0.8 }

// Apertar só pálpebra inferior
{ id: 'eye_squeeze_lower', intensity: 0.6 }

// Rastreamento horizontal (pendulação)
{ id: 'eye_track_horizontal', intensity: 1.0 }

// Rastreamento figura 8 (rotação)
{ id: 'eye_track_figure8', intensity: 1.0 }

// Olhos bem abertos
{ id: 'eye_wide_open', intensity: 1.0 }

// Piscada assimétrica
{ id: 'eye_blink_asymmetric', intensity: 1.0 }
```

**Comportamento:**
- `eye_track_*` são geralmente usados com `repeat: 'reverse'`
- Afetam círculos de `<circle>` dos olhos e pálpebras `<path>`

---

### 👄 Boca & Lábios (Lip/Mouth)

```typescript
// Beicinho (canuleta)
{ id: 'lip_pucker', intensity: 1.0 }

// Selamento labial (lábios juntos)
{ id: 'lip_seal', intensity: 0.8 }

// Sorriso amplo
{ id: 'lip_wide_smile', intensity: 0.9 }

// Levantamento de canto esquerdo
{ id: 'lip_corner_lift_left', intensity: 0.8 }

// Levantamento de canto direito
{ id: 'lip_corner_lift_right', intensity: 0.8 }

// Resistência (puxar contra força)
{ id: 'lip_resistance_pull', intensity: 0.9 }

// Levantamento de maçã com sorriso
{ id: 'cheek_lift_smile', intensity: 0.8 }
```

---

### 👅 Língua (Tongue com XRay)

```typescript
// Pressão da língua no palato (mewing)
{ id: 'tongue_palate_press', intensity: 0.9 }

// Varredura circular (limpeza)
{ id: 'tongue_sweep_circular', intensity: 0.8 }

// Click/estalo
{ id: 'tongue_click', intensity: 1.0 }

// Pressão lateral (esquerda)
{ id: 'tongue_lateral_left', intensity: 0.9 }

// Alongamento para fora+baixo
{ id: 'tongue_extra_oral_down', intensity: 1.0 }
```

**Nota:** Usadas com `show_xray: true` para renderizar estrutura intra-oral em modo semi-transparente.

---

### 🦴 Mandíbula (Jaw)

```typescript
// Cerramento/aperto
{ id: 'jaw_clench', intensity: 0.7 }

// Abertura ampla
{ id: 'jaw_open_wide', intensity: 0.7 }

// Movimento lateral (esquerda)
{ id: 'jaw_lateral_left', intensity: 0.6 }

// Protrusão (saia para frente)
{ id: 'jaw_protrusion', intensity: 0.9 }

// Retrusão (recue para trás)
{ id: 'jaw_retrusion', intensity: 0.8 }

// Movimento em infinito
{ id: 'jaw_infinity', intensity: 0.8 }
```

---

### 🎈 Bochecha (Cheek)

```typescript
// Bochecho inflado (esquerda)
{ id: 'cheek_puff_left', intensity: 1.0 }

// Bochecho inflado (direita)
{ id: 'cheek_puff_right', intensity: 1.0 }

// Bochecho bilateral
{ id: 'cheek_puff_both', intensity: 0.7 }
```

---

### 🧬 Pescoço (Neck)

```typescript
// Retração de queixo (chin tuck)
{ id: 'neck_chin_tuck', intensity: 1.0 }

// Extensão de pescoço
{ id: 'neck_extension', intensity: 0.6 }
```

---

### 🌬️ Respiração (Breathing - Estático)

```typescript
// Indicador estático de respiração nasal
{ id: 'static_breathing_indicator', intensity: 1.0 }
```

---

## 📋 Exemplos de Uso

### Exemplo 1: Exercício Simples (Levantamento de Sobrancelha)

```typescript
// Banco de dados migration
{
  id: 'exercise-brow-lift-isometric',
  cfg: {
    schema_version: 1,
    primitives: [
      { id: 'brow_lift_both', intensity: 0.9 }
    ],
    duration_ms: 1500,
    hold_ms: 5000,
    repeat: 'infinite',
    heat_regions: [
      { region: 'frontalis', pulse: true }  // Músculos da testa pulsam
    ],
    caption_pt: 'Eleve as sobrancelhas contra resistência dos dedos — mantenha isométrico.'
  }
}
```

**O que Acontece no SVG:**
1. **Duração**: 1500ms → anima a primitiva `brow_lift_both` suavemente
2. **Hold**: 5000ms → sustenta a posição no topo
3. **Heat Overlay**: Região `frontalis` fica colorida + pulsação
4. **Loop**: Reinicia infinitamente

**JSON de Ativação (Frontend):**
```json
{
  "exerciseId": "exercise-brow-lift-isometric",
  "userIntensity": 0.7,  // Intensidade ajustada pelo usuário (override)
  "userDuration": 1800,   // Duração personalizada (override)
  "muted": false          // Som ligado para caption
}
```

---

### Exemplo 2: Exercício Complexo (Deglutição com Raio-X)

```typescript
{
  id: 'routine-lt-10-fake-smile-swallow-isolation',
  cfg: {
    schema_version: 1,
    primitives: [
      { id: 'lip_wide_smile', intensity: 0.7, delay_ms: 0 },
      { id: 'tongue_sweep_circular', intensity: 0.6, delay_ms: 200 }
    ],
    duration_ms: 3000,
    repeat: 'infinite',
    show_xray: true,  // ← Ativa modo semi-transparente
    heat_regions: [
      { region: 'orbicularis_oris', pulse: true },
      { region: 'tongue_base', pulse: true }  // Intra-oral
    ],
    caption_pt: 'Engula com sorriso forçado — isola o trabalho da língua.'
  }
}
```

**Comportamento:**
- Frame 0ms: Inicia `lip_wide_smile` (sorriso)
- Frame 200ms: Inicia `tongue_sweep_circular` (deglutição)
- Ambas rodam em paralelo até 3000ms
- Loop infinito
- SVG renderiza com `opacity: 0.6` para mostrar estrutura intra-oral

---

### Exemplo 3: Rastreamento Ocular (Reverso)

```typescript
{
  id: 'exercise-eye-tracking-pencil-pushups',
  cfg: {
    schema_version: 1,
    primitives: [
      { id: 'eye_track_horizontal', intensity: 1.0 }
    ],
    duration_ms: 3000,
    repeat: 'reverse',  // ← Vai para frente, depois volta
    heat_regions: [
      // (sem heat region — focar no tracking visual)
    ],
    caption_pt: 'Acompanhe a ponta do lápis se aproximando lentamente do nariz.'
  }
}
```

**Timeline:**
```
0ms → 3000ms: Olhos convergem (lápis se aproxima)
3000ms → 6000ms: Olhos divergem (lápis se afasta)
6000ms → ...  : Loop
```

---

## 🔥 Heat Regions (Músculos)

Heat regions são **grupos musculares** que iluminam durante exercício:

### Anatomia Mapeada

| Região | Localização | Músculo Real | Exercícios Típicos |
|---|---|---|---|
| `frontalis` | Testa | M. Frontal | Sobrancelha, elevação |
| `corrugator` | Entre sobrancelhas | M. Corrugador | Franzimento, nasalis |
| `orbicularis_oculi_l/r` | Ao redor dos olhos | M. Orbicular do Olho | Piscar, squeeze |
| `temporalis` | Têmporas | M. Temporal | Temple isometric |
| `zygomaticus_l/r` | Maçã do rosto | M. Zigomático | Sorriso, levantamento |
| `orbicularis_oris` | Boca | M. Orbicular da Boca | Beicinho, lip seal |
| `mentalis` | Queixo | M. Mentoniano | DAO, queixo duplo |
| `masseter_l/r` | Mandíbula | M. Masseter | Clench, mastigação |
| `buccinator_l/r` | Bochecha | M. Buccinador | Puffing, insuflação |
| `platysma` | Pescoço | M. Platisma | Chin jut, pescoço |
| `scm_l/r` | Lateral do pescoço | M. Esternocleidomastóideo | Retração cervical |
| `suboccipital` | Base do crânio | M. Suboccipital | Retração, extensão |
| `tongue_base` | Intra-oral | Base da Língua | Mewing, deglutição |

### Renderização

**Com pulse: true** (animado):
```css
.heat-region {
  fill: #ff4444;
  opacity: 1.0;
  animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1.0; }
}
```

**Com pulse: false** (estático):
```css
.heat-region {
  fill: #ff4444;
  opacity: 0.6;  // Colorido mas sem animação
}
```

---

## 🛠️ Como Estender

### Adicionar Primitiva Nova

1. **Defina o ID** (ex: `brow_wink_left`):
```typescript
// Em primitives.ts ou constants.ts
export const FACIAL_PRIMITIVES = {
  brow_wink_left: {
    id: 'brow_wink_left',
    displayName: 'Brow Wink Left',
    svgPaths: ['path.brow_left', 'path.eye_left_upper'],
    keyframes: [
      { frame: 0, transform: 'translateY(0px)' },
      { frame: 50, transform: 'translateY(-8px)' },
      { frame: 100, transform: 'translateY(0px)' }
    ]
  }
}
```

2. **Adicione ao SVG** (`face.svg`):
```xml
<g id="brow-left-group">
  <path class="brow_left" d="M 150 80 Q 160 70 180 80" />
  <path class="eye_left_upper" d="M 165 85 Q 170 90 185 85" />
</g>
```

3. **Use em novo exercício**:
```typescript
{
  id: 'exercise-brow-wink-left',
  cfg: {
    schema_version: 1,
    primitives: [
      { id: 'brow_wink_left', intensity: 0.8 }
    ],
    duration_ms: 1200,
    hold_ms: 2000,
    repeat: 'infinite',
    heat_regions: [
      { region: 'frontalis', pulse: true }
    ],
    caption_pt: 'Pisque a sobrancelha esquerda.'
  }
}
```

---

### Adicionar Heat Region Nova

1. **Defina o mapa muscular**:
```typescript
// Em heat-regions.ts
export const HEAT_REGION_MAP = {
  frontalis: { color: '#ff4444', anatomyName: 'Frontal Muscle', coordinates: [...] },
  masseter_l: { color: '#ff6666', anatomyName: 'Left Masseter', coordinates: [...] },
  // Nova:
  mylohyoid: { color: '#ff8888', anatomyName: 'Mylohyoid', coordinates: [...] }
}
```

2. **Renderize no SVG**:
```typescript
function renderHeatRegion(regionName: string, intensity: number) {
  const region = HEAT_REGION_MAP[regionName];
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  overlay.setAttribute('points', region.coordinates.join(' '));
  overlay.setAttribute('fill', region.color);
  overlay.setAttribute('opacity', String(intensity * 0.7));
  document.querySelector('#face-svg').appendChild(overlay);
}
```

3. **Use em exercício**:
```typescript
heat_regions: [
  { region: 'mylohyoid', pulse: true }
]
```

---

### Criar Sequência de Múltiplas Primitivas

```typescript
{
  id: 'routine-lt-26-dao-isometric',
  cfg: {
    schema_version: 1,
    primitives: [
      // Fase 1: Levanta canto esquerdo (delay 0ms)
      { id: 'lip_corner_lift_left', intensity: 0.3, delay_ms: 0 },
      // Fase 2: Levanta canto direito (delay 500ms — estafetado)
      { id: 'lip_corner_lift_right', intensity: 0.3, delay_ms: 500 },
      // Fase 3: Força na mandíbula (delay 1000ms)
      { id: 'jaw_lateral_left', intensity: 0.2, delay_ms: 1000 }
    ],
    duration_ms: 1500,  // Cada primitiva dura 1500ms
    hold_ms: 4000,       // Sustenta final por 4s
    repeat: 'infinite',
    heat_regions: [
      { region: 'mentalis', pulse: true },
      { region: 'masseter_l', pulse: true }
    ],
    caption_pt: 'Force os cantos da boca para baixo — "sorriso triste" isométrico.'
  }
}
```

**Timeline Visual:**
```
0ms:       Canto esquerdo começa
500ms:     Canto direito começa (esquerdo continua)
1000ms:    Mandíbula começa (ambos continuam)
1500ms:    Todas primitivas atingem máximo
1500-5500ms: Hold (sustentação)
5500ms:    Reset e loop
```

---

## 📊 Exemplo de Dados Completo (API Response)

```json
{
  "exerciseId": "exercise-cheek-lift-smile-hold",
  "displayName": "Levantamento de Bochecha com Sorriso",
  "category": "exercise",
  "priority": 2,
  "effort": "low",
  "animationConfig": {
    "schema_version": 1,
    "primitives": [
      {
        "id": "lip_wide_smile",
        "intensity": 0.9,
        "delay_ms": 0
      },
      {
        "id": "cheek_lift_smile",
        "intensity": 0.8,
        "delay_ms": 100
      }
    ],
    "duration_ms": 2000,
    "hold_ms": 6000,
    "repeat": "infinite",
    "heat_regions": [
      {
        "region": "zygomaticus_l",
        "pulse": true
      },
      {
        "region": "zygomaticus_r",
        "pulse": true
      }
    ],
    "show_xray": false,
    "caption_pt": "Sorriso fechado sustentado — sinta as maçãs do rosto subirem."
  },
  "description": "Único exercício facial com estudo RCT positivo (Northwestern 2018) — efeito modesto sobre bochechas em 20 semanas.",
  "instructions": {
    "duration": "10 seg per ciclo",
    "frequency": "1× ao dia",
    "difficulty": "Fácil",
    "cautions": "Sem contraindicações relatadas"
  },
  "studyReference": {
    "citation": "Alam M. et al. (2018) JAMA Dermatol.",
    "url": "https://pubmed.ncbi.nlm.nih.gov/29299598/",
    "evidence_level": "strong"
  }
}
```

---

## 🎬 Fluxo de Renderização (Frontend)

```
1. User taps "exercise-brow-lift-isometric"
   ↓
2. Frontend fetch AnimationConfig from DB
   ↓
3. Parse primitives + heat_regions
   ↓
4. Initialize SVG renderer with:
   - Base face SVG
   - Overlay layers for heat regions
   - Timeline scheduler
   ↓
5. For each frame (16.6ms @ 60fps):
   a) Calculate primitive state (0.0-1.0)
   b) Update SVG transforms for primitives
   c) Update heat region opacities
   d) Check if in hold phase
   e) Check if loop again
   ↓
6. Render frame to canvas
   ↓
7. On complete or user stops → cleanup
```

---

## 🔗 Referências

- **Migration File**: `nest/src/database/migrations/1746000260000-M44AnimationConfigSeed.ts`
- **Animation Config Type**: `nest/src/modules/diagnosis/domain/types/recommendation.types.ts`
- **Frontend Component**: `frontend/src/components/SvgFaceInstructor.tsx` (42 primitives mapeadas)
- **Catálogo Completo**: `ANIMATION_CONFIG_REFERENCE.md`

---

**Versão**: PR-D (Animation Config v1.0)  
**Última Atualização**: 2026-05-11  
**Status**: 63/160 exercícios com animação



MVP esoesqueleto:

<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Face Mesh + Mão Anatômica Real</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://unpkg.com/framer-motion@10.16.4/dist/framer-motion.js"></script>
  <style>
    body { margin:0; display:flex; justify-content:center; align-items:center; min-height:100vh; font-family:-apple-system,sans-serif; transition:background 0.5s; overflow:hidden; }
    .container { display:flex; gap:40px; align-items:flex-start; }
    .menu { display:flex; flex-direction:column; gap:20px; width:250px; }
    .btn-group { display:flex; flex-direction:column; gap:8px; }
    h4 { margin:0 0 5px 0; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#888; }
    button { padding:12px 15px; border-radius:8px; cursor:pointer; text-align:left; font-size:13px; font-weight:bold; transition:all 0.2s; border:1px solid transparent; outline:none; }
  </style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
  const { useState, useMemo, useEffect } = React;
  const { motion } = window.Motion;

  // =========================================================================
  // ESTILOS UI
  // =========================================================================
  const UI_STYLES = [
    {
      id:'mesh', name:'1. Scanner HUD',
      bg:'#050508', panelBg:'#0a0a10', text:'#00ffcc',
      faceStroke:'#00ffcc', faceFill:'rgba(0,255,204,0.02)', faceWidth:1.2,
      shadow:'drop-shadow(0 0 4px rgba(0,255,204,0.6))',
      heatColor:'#ff0055', arrowColor:'#ffcc00', handColor:'#00e5ff',
      handFill:'rgba(0,229,255,0.07)', handStroke:'1.2',
      btnBg:'#0a0a10', btnActive:'rgba(0,255,204,0.15)', btnBorder:'#00ffcc'
    },
    {
      id:'scifi', name:'2. Premium Sci-Fi',
      bg:'linear-gradient(135deg,#1c1c28,#0a0a0f)', panelBg:'rgba(255,255,255,0.03)', text:'#fff',
      faceStroke:'rgba(255,255,255,0.75)', faceFill:'rgba(255,255,255,0.02)', faceWidth:1.2,
      shadow:'drop-shadow(0 10px 15px rgba(0,0,0,0.5))',
      heatColor:'#ff9f0a', arrowColor:'#32ade6', handColor:'#32ade6',
      handFill:'rgba(50,173,230,0.08)', handStroke:'1.1',
      btnBg:'rgba(255,255,255,0.05)', btnActive:'rgba(255,255,255,0.15)', btnBorder:'#fff'
    }
  ];

  // =========================================================================
  // MÃO ANATÔMICA REAL
  // Coordenadas derivadas de ilustração médica dorsal (dorso da mão)
  // Origem (0,0) = ponta do dedo indicador = ponto de contato
  // Palma e pulso estendem-se no eixo Y+ (para baixo no SVG)
  // =========================================================================
  const AnatomicalHand = ({ x, y, angle=0, scale=1, flip=false, action='press', spread=0.3, color, handFill }) => {
    const s = Math.max(0, Math.min(1, spread));
    // sep = separação extra entre dedos conforme "spread" (0 a 5px)
    const sep = s * 5;
    // Offsets horizontais de cada dedo a partir do indicador
    const mOff = 12 + sep;           // médio
    const rOff = mOff + 11 + sep;    // anelar
    const pOff = rOff + 10 + sep;    // mínimo

    // ── Helper: cria o path de um dedo com volume real ──
    // cx   = centro X do dedo
    // tipY = Y da ponta (negativo = acima da origem = mais comprido)
    // baseY= Y da base (onde conecta à palma, ~y52)
    // w    = largura total do dedo
    const fingerPath = (cx, tipY, baseY, w) => {
      const h = w / 2;
      // Phalange distal (topo) — levemente afilada
      const tw = h * 0.85;
      return [
        // lateral esquerda sobe
        `M ${cx - h} ${baseY}`,
        `C ${cx - h} ${baseY - 10} ${cx - h} ${tipY + 14} ${cx - tw} ${tipY + 6}`,
        // topo arredondado (ponta do dedo)
        `Q ${cx} ${tipY - 2} ${cx + tw} ${tipY + 6}`,
        // lateral direita desce
        `C ${cx + h} ${tipY + 14} ${cx + h} ${baseY - 10} ${cx + h} ${baseY}`,
        `Z`
      ].join(' ');
    };

    // ── Helper: valley (vale entre dedos) ──
    // Cria um recorte em V entre dois dedos
    const valleyY = 44; // profundidade do vale (acima da linha de nós, baseY=52)

    // ── PALMA: shape orgânica ──
    // Vai do topo (linha dos nós dos dedos, y=52) até o pulso (y=98)
    // Largura da palma = da esquerda do indicador até direita do mínimo
    const palmL = -5;
    const palmR = pOff + 5;
    const palmMid = (palmL + palmR) / 2;

    const palmPath = [
      `M ${palmL} 52`,
      // lado esquerdo da palma (montículo do polegar)
      `C ${palmL - 4} 62 ${palmL - 8} 72 ${palmL - 6} 82`,
      `C ${palmL - 4} 90 ${palmMid - 10} 96 ${palmMid} 98`,
      // pulso base
      `C ${palmMid + 10} 100 ${palmR + 4} 94 ${palmR + 2} 84`,
      // lado direito
      `C ${palmR + 2} 74 ${palmR - 2} 62 ${palmR} 52`,
      `Z`
    ].join(' ');

    // ── POLEGAR: posição anatômica real ──
    // Emerge do lado esquerdo da palma em ângulo ~45°
    const thumbPath = [
      `M -4 62`,                            // base do polegar (na palma)
      `C -10 58 -18 50 -22 40`,             // lateral esquerda
      `C -26 32 -28 24 -24 18`,             // sobe à ponta
      `Q -20 12 -15 16`,                    // ponta arredondada
      `Q -10 20 -10 28`,                    // lateral direita ponta
      `C -8 36 -6 48 -4 54`,               // desce de volta
      `Z`
    ].join(' ');

    // ── LINHA DE DOBRA DA PALMA (sulco de vida / coração) ──
    const creaseHeart = `M ${palmL} 66 Q ${palmMid - 5} 62 ${palmMid + 8} 65`;
    const creaseHead  = `M ${palmL + 2} 74 Q ${palmMid} 70 ${palmR - 2} 74`;

    // ── PULSO: duas linhas paralelas estilizadas ──
    const wristY1 = 90;
    const wristY2 = 95;

    // ── TRANSFORMAÇÃO GLOBAL ──
    const tf = `translate(${x}px,${y}px) rotate(${angle}deg) scale(${flip ? -scale : scale},${scale})`;

    // ── ANIMAÇÃO por tipo de ação ──
    let anim = {};
    if (action === 'press')   anim = { scale:[1,0.9,1],       y:[0,-5,0] };
    if (action === 'pull')    anim = { y:[0,10,0] };
    if (action === 'massage') anim = { x:[0,5,0,-5,0],         y:[0,5,0,-5,0] };

    // Posições dos nós anatômicos (MCP = nós dos dedos, PIP = articulação média)
    const joints = [
      // [cx, knuckleY (MCP), pipY, tipY, nailRx, nailRy]
      { cx:0,      mcp:52, pip:27, tip:-6,  nr:3,   nt:3.5 },  // indicador
      { cx:mOff,   mcp:50, pip:20, tip:-14, nr:3.2, nt:3.8 },  // médio (mais comprido)
      { cx:rOff,   mcp:51, pip:24, tip:-10, nr:3,   nt:3.5 },  // anelar
      { cx:pOff,   mcp:53, pip:34, tip:4,   nr:2.5, nt:2.8 },  // mínimo
    ];

    return (
      <g style={{ transform:tf, transformOrigin:'0px 0px' }}>
        <motion.g animate={anim} transition={{ duration:1.5, repeat:Infinity, ease:'easeInOut' }}>

          {/* ── HALO DE CONTATO na ponta do indicador ── */}
          <circle cx="0" cy="0" r="9"  fill={color} opacity="0.2" filter="blur(4px)" />
          <circle cx="0" cy="0" r="14" fill="transparent" stroke={color}
            strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5" />

          {/* ── PALMA ── */}
          <path d={palmPath} fill={handFill} stroke={color} strokeWidth="1.1"
            strokeLinejoin="round" />

          {/* ── POLEGAR ── */}
          <path d={thumbPath} fill={handFill} stroke={color} strokeWidth="1"
            strokeLinejoin="round" />
          {/* Nó da articulação IP do polegar */}
          <ellipse cx="-16" cy="24" rx="3" ry="2"
            fill={color} opacity="0.5" transform="rotate(-20,-16,24)" />
          {/* Unha do polegar */}
          <ellipse cx="-18" cy="16" rx="2.8" ry="3.2"
            fill="none" stroke={color} strokeWidth="0.6" opacity="0.45"
            transform="rotate(-15,-18,16)" />

          {/* ── DEDO INDICADOR (path base, índice) ── */}
          <path d={fingerPath(0, -6, 52, 8)} fill={handFill} stroke={color} strokeWidth="1.1" />

          {/* ── DEDO MÉDIO ── */}
          <path d={fingerPath(mOff, -14, 52, 9)} fill={handFill} stroke={color} strokeWidth="1.1" />

          {/* ── DEDO ANELAR ── */}
          <path d={fingerPath(rOff, -10, 52, 8)} fill={handFill} stroke={color} strokeWidth="1.1" />

          {/* ── DEDO MÍNIMO ── */}
          <path d={fingerPath(pOff, 4, 52, 6.5)} fill={handFill} stroke={color} strokeWidth="1" />

          {/* ── VALES ENTRE DEDOS (triângulos de pele) ── */}
          {[
            { x1: 5, x2: mOff-4 },    // entre índice e médio
            { x1: mOff+5, x2: rOff-4 }, // entre médio e anelar
            { x1: rOff+5, x2: pOff-4 }, // entre anelar e mínimo
          ].map((v,i) => (
            <polygon key={i}
              points={`${v.x1},${valleyY} ${(v.x1+v.x2)/2},52 ${v.x2},${valleyY}`}
              fill={handFill} stroke={color} strokeWidth="0.5" opacity="0.7" />
          ))}

          {/* ── NÓS DOS DEDOS (MCP joints — linha dos nós) ── */}
          {joints.map((j,i) => (
            <ellipse key={`mcp-${i}`}
              cx={j.cx} cy={j.mcp} rx={i===1?4:3.5} ry="2.2"
              fill={color} opacity="0.6" />
          ))}

          {/* ── ARTICULAÇÕES MÉDIAS (PIP joints) ── */}
          {joints.map((j,i) => (
            <ellipse key={`pip-${i}`}
              cx={j.cx} cy={j.pip} rx={i===1?3:2.5} ry="2"
              fill={color} opacity="0.45" />
          ))}

          {/* ── LINHAS TRANSVERSAIS das articulações (dobras da pele) ── */}
          {joints.map((j,i) => (
            <g key={`crease-${i}`} opacity="0.3">
              <line x1={j.cx-3} y1={j.pip+2} x2={j.cx+3} y2={j.pip+2}
                stroke={color} strokeWidth="0.5" />
              <line x1={j.cx-2.5} y1={j.pip+4} x2={j.cx+2.5} y2={j.pip+4}
                stroke={color} strokeWidth="0.4" />
            </g>
          ))}

          {/* ── UNHAS (elipses próximas às pontas) ── */}
          {joints.map((j,i) => (
            <ellipse key={`nail-${i}`}
              cx={j.cx} cy={j.tip + 3}
              rx={j.nr} ry={j.nt}
              fill={`${color}20`} stroke={color} strokeWidth="0.6" opacity="0.55" />
          ))}

          {/* ── SULCOS DA PALMA ── */}
          <path d={creaseHeart} fill="none" stroke={color}
            strokeWidth="0.7" opacity="0.35" strokeLinecap="round" />
          <path d={creaseHead} fill="none" stroke={color}
            strokeWidth="0.6" opacity="0.25" strokeLinecap="round"
            strokeDasharray="2 2" />

          {/* ── LINHAS DO PULSO ── */}
          <path d={`M ${palmL+2} ${wristY1} Q ${palmMid} ${wristY1-3} ${palmR-2} ${wristY1}`}
            fill="none" stroke={color} strokeWidth="0.6" opacity="0.35" />
          <path d={`M ${palmL+4} ${wristY2} Q ${palmMid} ${wristY2-3} ${palmR-4} ${wristY2}`}
            fill="none" stroke={color} strokeWidth="0.5" opacity="0.25" strokeDasharray="2 3" />

          {/* ── NÓ DO PULSO (ponto de origem HUD) ── */}
          <circle cx={palmMid} cy="98" r="3.5"
            fill="transparent" stroke={color} strokeWidth="1.1" opacity="0.45" />
          <circle cx={palmMid} cy="98" r="1.3"
            fill={color} opacity="0.8" />

        </motion.g>
      </g>
    );
  };

  // =========================================================================
  // SETA DE FORÇA
  // =========================================================================
  const ForceArrow = ({ x1, y1, x2, y2, color, isMuscle }) => {
    const ang = Math.atan2(y2-y1, x2-x1) * 180 / Math.PI - 90;
    return (
      <motion.g
        animate={{ opacity:[0,1,0], x:[0,(x2-x1)*0.2,0], y:[0,(y2-y1)*0.2,0] }}
        transition={{ duration:1.5, repeat:Infinity }}>
        <line x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={color} strokeWidth={isMuscle?"2":"1.5"}
          strokeDasharray={isMuscle?"none":"3 3"} />
        <polygon
          points={`${x2},${y2} ${x2-3},${y2-6} ${x2+3},${y2-6}`}
          fill={color}
          style={{ transformOrigin:`${x2}px ${y2}px`, transform:`rotate(${ang}deg)` }} />
      </motion.g>
    );
  };

  // =========================================================================
  // ANATOMIA HUMANA E HEATMAPS
  // =========================================================================
  const HUMAN = {
    base: {
      skull:    "M 15 50 C 10 20, 25 5, 50 5 C 75 5, 90 20, 85 50",
      jaw:      "M 15 50 C 15 75, 25 95, 50 100 C 75 95, 85 75, 85 50",
      eyeL:     "M 25 42 Q 35 37 42 43 Q 35 46 25 42",
      eyeR:     "M 58 43 Q 65 37 75 42 Q 65 46 58 43",
      browL:    "M 20 32 Q 30 25 45 32",
      browR:    "M 55 32 Q 70 25 80 32",
      upperLip: "M 32 75 Q 50 72 68 75",
      lowerLip: "M 32 75 Q 50 85 68 75",
      nose:     "M 50 35 L 45 62 L 55 62 Z"
    },
    anim: {
      jaw_open:   "M 15 50 C 20 85, 30 110, 50 115 C 70 110, 80 85, 85 50",
      lip_openL:  "M 35 78 Q 50 100 65 78",
      brow_liftL: "M 20 25 Q 30 15 45 25",
      brow_liftR: "M 55 25 Q 70 15 80 25",
      puckerU:    "M 40 75 Q 50 70 60 75",
      puckerL:    "M 40 75 Q 50 85 60 75"
    }
  };

  const HEAT_MAP = {
    frontalis:        { cx:50, cy:22, r:18 },
    orbicularis_oris: { cx:50, cy:75, r:14 },
    masseter_l:       { cx:20, cy:78, r:12 },
    masseter_r:       { cx:80, cy:78, r:12 }
  };

  // =========================================================================
  // CATÁLOGO DE EXERCÍCIOS
  // =========================================================================
  const CATALOG = [
    {
      id:'jaw-massage', title:'1. Massagem ATM (Maxilar)',
      primitives:['jaw_rotate_open'],
      duration_ms:2000, hold_ms:2000,
      heat_regions:[{ name:'masseter_l', pulse:true }, { name:'masseter_r', pulse:true }],
      action_vectors:[
        // Mão esquerda no masseter: dedos abertos (spread alto), massagem circular
        { type:'hand', x:14, y:78, angle:75, spread:0.9, scale:0.48, action:'massage' },
        // Mão direita (espelhada)
        { type:'hand', x:86, y:78, angle:-75, spread:0.9, scale:0.48, flip:true, action:'massage' },
        { type:'arrow', x1:50, y1:97, x2:50, y2:115 }
      ],
      caption:'Mãos espalmadas nos masseteres. Movimentos circulares profundos enquanto a mandíbula abre lentamente.'
    },
    {
      id:'brow-lift', title:'2. Isometria Frontal',
      primitives:['brow_lift_both'],
      duration_ms:1500, hold_ms:3000,
      heat_regions:[{ name:'frontalis', pulse:true }],
      action_vectors:[
        // Dedos pressionando a testa de cima para baixo
        { type:'hand', x:26, y:28, angle:172, spread:0.4, scale:0.48, action:'press' },
        { type:'hand', x:74, y:28, angle:-172, spread:0.4, scale:0.48, flip:true, action:'press' },
        // Seta vermelha: força do músculo frontal para cima
        { type:'arrow_muscle', x1:50, y1:20, x2:50, y2:5 }
      ],
      caption:'Pressione a testa para baixo com os dedos. Force as sobrancelhas para cima (isometria pura).'
    },
    {
      id:'lip-pull', title:'3. Tração do Lábio Superior',
      primitives:['lip_pucker'],
      duration_ms:1500, hold_ms:3000,
      heat_regions:[{ name:'orbicularis_oris', pulse:true }],
      action_vectors:[
        // Dedos juntos (spread mínimo) puxando o lábio para baixo
        { type:'hand', x:37, y:72, angle:184, spread:0.08, scale:0.44, action:'pull' },
        { type:'hand', x:63, y:72, angle:-184, spread:0.08, scale:0.44, flip:true, action:'pull' },
        { type:'arrow', x1:37, y1:75, x2:37, y2:92 },
        { type:'arrow', x1:63, y1:75, x2:63, y2:92 }
      ],
      caption:'Dedos juntos no lábio superior puxando para baixo. Force os lábios para frente (bico) contra a resistência.'
    }
  ];

  // =========================================================================
  // ENGINE DE RENDERIZAÇÃO
  // =========================================================================
  function Simulator({ config, style }) {
    const [phase, setPhase] = useState('idle');

    useEffect(() => {
      let alive = true;
      (async () => {
        while (alive) {
          setPhase('active');
          await new Promise(r => setTimeout(r, config.duration_ms + config.hold_ms));
          setPhase('idle');
          await new Promise(r => setTimeout(r, config.duration_ms));
        }
      })();
      return () => { alive = false; };
    }, [config]);

    const cur = useMemo(() => {
      const c = { ...HUMAN.base };
      if (phase === 'active') {
        if (config.primitives.includes('jaw_rotate_open')) {
          c.jaw = HUMAN.anim.jaw_open;
          c.lowerLip = HUMAN.anim.lip_openL;
        }
        if (config.primitives.includes('brow_lift_both')) {
          c.browL = HUMAN.anim.brow_liftL;
          c.browR = HUMAN.anim.brow_liftR;
        }
        if (config.primitives.includes('lip_pucker')) {
          c.upperLip = HUMAN.anim.puckerU;
          c.lowerLip = HUMAN.anim.puckerL;
        }
      }
      return c;
    }, [config, phase]);

    const t = { duration: config.duration_ms / 1000, ease: 'easeInOut' };

    return (
      <div style={{
        width:'330px', height:'490px',
        backgroundColor: style.panelBg,
        borderRadius:'24px',
        display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center',
        border: style.id==='scifi' ? '1px solid rgba(255,255,255,0.06)' : 'none',
        backdropFilter: style.id==='scifi' ? 'blur(20px)' : 'none',
        padding:'20px', boxSizing:'border-box'
      }}>

        <svg viewBox="0 0 100 120" width="100%" height="290"
          style={{ filter:style.shadow, overflow:'visible' }}>

          {/* ── ROSTO ESTÁTICO ── */}
          <path d={cur.skull}   stroke={style.faceStroke} strokeWidth={style.faceWidth} fill={style.faceFill} />
          <path d={cur.eyeL}    stroke={style.faceStroke} strokeWidth={style.faceWidth} fill="transparent" />
          <path d={cur.eyeR}    stroke={style.faceStroke} strokeWidth={style.faceWidth} fill="transparent" />
          <path d={cur.nose}    stroke={style.faceStroke} strokeWidth={style.faceWidth} fill="transparent" />

          {/* ── PARTES MÓVEIS ── */}
          <motion.path d={cur.jaw}      stroke={style.faceStroke} strokeWidth={style.faceWidth} fill={style.faceFill}    animate={{d:cur.jaw}}      transition={t} />
          <motion.path d={cur.upperLip} stroke={style.faceStroke} strokeWidth={style.faceWidth} fill="transparent"       animate={{d:cur.upperLip}} transition={t} />
          <motion.path d={cur.lowerLip} stroke={style.faceStroke} strokeWidth={style.faceWidth} fill="transparent"       animate={{d:cur.lowerLip}} transition={t} />
          <motion.path d={cur.browL}    stroke={style.faceStroke} strokeWidth={style.faceWidth} fill="transparent" strokeLinecap="round" animate={{d:cur.browL}} transition={t} />
          <motion.path d={cur.browR}    stroke={style.faceStroke} strokeWidth={style.faceWidth} fill="transparent" strokeLinecap="round" animate={{d:cur.browR}} transition={t} />

          {/* ── HEATMAPS MUSCULARES ── */}
          {config.heat_regions.map((h,i) => {
            const p = HEAT_MAP[h.name];
            return p && (
              <motion.circle key={i}
                cx={p.cx} cy={p.cy} r={p.r}
                fill={style.heatColor} filter="blur(7px)"
                animate={{ opacity: phase==='active' ? (h.pulse ? [0.1,0.9,0.1] : 0.6) : 0 }}
                transition={ h.pulse ? { duration:0.9, repeat:Infinity } : t }
              />
            );
          })}

          {/* ── MÃOS E SETAS (só na fase ativa) ── */}
          {phase === 'active' && config.action_vectors?.map((v,i) => {
            if (v.type === 'hand')
              return <AnatomicalHand key={i} {...v} color={style.handColor} handFill={style.handFill} />;
            if (v.type === 'arrow' || v.type === 'arrow_muscle')
              return <ForceArrow key={i}
                x1={v.x1} y1={v.y1} x2={v.x2} y2={v.y2}
                color={v.type==='arrow_muscle' ? style.heatColor : style.arrowColor}
                isMuscle={v.type==='arrow_muscle'} />;
            return null;
          })}
        </svg>

        <p style={{
          color:style.text, fontSize:'13px', textAlign:'center',
          lineHeight:'1.6', marginTop:'22px', opacity:0.8, padding:'0 10px'
        }}>
          {config.caption}
        </p>

      </div>
    );
  }

  // =========================================================================
  // APP
  // =========================================================================
  function App() {
    const [styleIdx, setStyleIdx] = useState(0);
    const [exIdx,    setExIdx]    = useState(0);
    const style = UI_STYLES[styleIdx];

    useEffect(() => { document.body.style.background = style.bg; }, [style.bg]);

    return (
      <div className="container" style={{ color:style.text }}>
        <div className="menu">
          <div className="btn-group">
            <h4>1. Exercício</h4>
            {CATALOG.map((e,i) => (
              <button key={e.id} onClick={() => setExIdx(i)} style={{
                backgroundColor: exIdx===i ? style.btnActive : 'transparent',
                color: style.text,
                border: exIdx===i ? `1px solid ${style.btnBorder}` : '1px solid #333'
              }}>{e.title}</button>
            ))}
          </div>
          <div className="btn-group" style={{ marginTop:'24px' }}>
            <h4>2. Estética UI</h4>
            {UI_STYLES.map((s,i) => (
              <button key={s.id} onClick={() => setStyleIdx(i)} style={{
                backgroundColor: styleIdx===i ? style.btnActive : 'transparent',
                color: style.text,
                border: styleIdx===i ? `1px solid ${style.btnBorder}` : '1px solid #333'
              }}>{s.name}</button>
            ))}
          </div>
        </div>

        <Simulator key={`${styleIdx}-${exIdx}`} config={CATALOG[exIdx]} style={style} />
      </div>
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(<App />);
</script>
</body>
</html>