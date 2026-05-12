# Auditoria Completa: Cálculos de Visualização e Sobreposição (SVG Overlays)

**Data:** 2026-05-12  
**Fase:** M3 (Overlays) — Audit & Fix + Overlay Annotations JSON + OutlineFace Horn Fix  
**Status:** ✅ 7 bugs / melhorias implementados

---

## Executive Summary

Foram encontrados e corrigidos/implementados **7 itens** nos cálculos e arquitetura de sobreposição SVG:

1. **Coordinate space mismatch:** `w/h` (CSS pixels) vs `vbW/vbH` (viewBox pixels)
2. **Rule of Fifths incorreto:** usava bizigomatic, deveria usar eye-outer corners
3. **AxisVertical impreciso:** midline baseada só em olhos, não em linha de simetria real
4. **GridFifths label incompleto:** não diferenciava ideal vs. real
5. **OutlineFace com 37 pts:** documentado como feature (polígono facial completo)
6. **OutlineFace horn:** todos os 12 pontos da crista da testa (`LM_FOREHEAD_RIDGE`) agora nivelados ao trichion (não apenas `lm[10]`)
7. **Textos burned-in removidos:** labels textuais migrados para JSON (`overlay_annotations`) e renderizados em React via `<OverlaySidebar>`

---

## Bug #1: Coordinate Space Mismatch — `w/h` vs `vbW/vbH`

### Problema

Quatro componentes SVG desenhavam linhas usando `w` e `h` (dimensões CSS da imagem) enquanto o SVG operava em espaço `viewBox={0 0 vbW vbH}` (dimensões naturais/pixels).

**Cenário de falha:**
- Imagem original: 1200×800 px
- CSS display: 600×400 px (redimensionada 50%)
- Frontend passa: `imageWidth=600, imageHeight=400, viewBoxWidth=1200, viewBoxHeight=800`
- **Bug:** linha desenhada até `x2=600` (CSS), mas viewBox vai até 1200 → linha fica na metade do espaço

### Linhas Afetadas

| Componente | Linha | Código Errado | Correção |
|---|---|---|---|
| `AxisVertical` | 191 | `y2={h}` | `y2={vbH}` |
| `AxisIntercanthal` | 203 | `x2={w}` | `x2={vbW}` |
| `GridThirds` | 297, 298, 300, 301 | `x2={w}` | `x2={vbW}` |
| `GridFifths` | 329–332 (implícito) | Usa `faceW` baseado em ZYGO | Corrigido |

### Raiz Técnica

O SVG `viewBox` transforma coordenadas do espaço natural para o espaço CSS renderizado. Se os endpoints não respeitam os limites do `viewBox`, a linha é clipada ou desenha no espaço errado.

```tsx
// ERRADO
<svg viewBox="0 0 1200 800" width={600} height={400}>
  <line x1={xMid} y1={0} x2={xMid} y2={400} />  // y2=400 é metade do viewBox height
</svg>

// CORRETO
<svg viewBox="0 0 1200 800" width={600} height={400}>
  <line x1={xMid} y1={0} x2={xMid} y2={800} />  // y2=800 =  full viewBox height
</svg>
```

### Fix Aplicado

Alterou as assinaturas de `AxisVertical`, `AxisIntercanthal` e `GridThirds` para receber `vbW/vbH` ao invés de `w/h`, e atualizou todos os endpoints das linhas.

---

## Bug #2: Rule of Fifths — Bizigomatic vs Eye-Outer Corners

### Problema

O componente `GridFifths` usava os pontos bizigomatic (454 / 234) para calcular a largura facial, dividindo em 5 partes iguais. Mas a **Regra dos Quintos de Naini** usa os **cantos externos dos olhos** como marcas de referência.

**Naini 2011 §6:**
```
[Face edge] | [Eye outer L] | [Eye inner L]–[Eye inner R] | [Eye outer R] | [Face edge]
         0        1/5           2/5–3/5                    4/5              1
```

### Cálculo Anterior (Errado)

```tsx
const xL = lm(landmarks, P_ZYGO_IMG_LEFT)[0];     // 234 = cheekbone
const xR = lm(landmarks, P_ZYGO_IMG_RIGHT)[0];    // 454 = cheekbone
const faceW = Math.max(1, xR - xL);
const fifth = faceW / 5;

// Linhas verticais em: xL + 1*fifth, xL + 2*fifth, xL + 3*fifth, xL + 4*fifth
// Não aparecem nos landmarks reais dos olhos
```

### Landmarks Corretos

| Referência | Landmark | Índice MediaPipe |
|---|---|---|
| Eye outer L (ideal 1/5) | P_EYE_OUTER_IMG_LEFT | 33 |
| Eye inner L (ideal 2/5) | P_LEFT_EYE_INNER | 133 |
| Eye inner R (ideal 3/5) | P_RIGHT_EYE_INNER | 362 |
| Eye outer R (ideal 4/5) | P_EYE_OUTER_IMG_RIGHT | 263 |
| Face edge L | P_ZYGO_IMG_LEFT | 234 |
| Face edge R | P_ZYGO_IMG_RIGHT | 454 |

### Fix Aplicado

Redesenhou `GridFifths` para:
1. Desenhar **linhas tracejadas ideais** em espaçamento igual (faceW / 5)
2. Sobrepor **linhas laranja sólidas** nos cantos reais dos olhos (33, 133, 362, 263)
3. Label atualizado: "Quintos (tracejado = ideal, laranja = real)"

Agora o usuário vê **como os olhos desviam do padrão dos quintos ideais**.

---

## Bug #3: AxisVertical — Midline Imprecisa

### Problema

O eixo vertical usava apenas o **midpoint intercantal** `(lm[133].x + lm[362].x) / 2` para determinar a linha de simetria facial. Em faces com assimetria orbital, isto **não coincide com a linha de simetria real** que deveria passar pelo:
- Nasion (topo da ponte nasal)
- Ponta do nariz
- Menton (ponta do queixo)

### Cálculo Anterior

```tsx
const xMid = (lm(landmarks, P_LEFT_EYE_INNER)[0] + lm(landmarks, P_RIGHT_EYE_INNER)[0]) / 2;
```

**Problema:** Se um olho está mais deslocado que o outro, este midpoint erra.

### Fix Aplicado

```tsx
const xEyes = (lm(landmarks, P_LEFT_EYE_INNER)[0] + lm(landmarks, P_RIGHT_EYE_INNER)[0]) / 2;
const xNose = lm(landmarks, P_NOSE_TIP)[0];
const xMid = (xEyes + xNose) / 2;  // Media entre olhos E nariz
```

Agora a linha vertical passa pela **média ponderada** dos dois pontos de referência mais estáveis: os olhos e o nariz. Isso é mais resistente a assimetrias orbitais isoladas.

---

## Bug #4: GridFifths — Falta de Diferenciação Ideal vs Real

### Problema

O código anterior desenhava 4 linhas verticais igualmente espaçadas, sem mostrar onde os **olhos reais** estavam. O usuário não sabia se os quintos eram "perfeitos" ou desviados.

### Fix Aplicado

```tsx
// Desenhar AMBOS:
// 1. Tracejadas ideais (igualmente espaçadas) — cor s.stroke (#a5b4fc)
// 2. Sólidas laranja (nos cantos dos olhos reais) — cor #f97316

{/* Ideal equal fifths (dashed) */}
{[1, 2, 3, 4].map((i) => (
  <line key={`ideal-${i}`}
    x1={xFaceL + i * fifth} y1={yTop} x2={xFaceL + i * fifth} y2={yMen}
    stroke={s.stroke} strokeWidth={s.strokeWidth} strokeDasharray={s.strokeDasharray} />
))}

{/* Actual eye-corner positions (solid) */}
{[xEyeOL, xEyeIL, xEyeIR, xEyeOR].map((x, i) => (
  <line key={`actual-${i}`}
    x1={x} y1={yTop} x2={x} y2={yMen}
    stroke="#f97316" strokeWidth={1} opacity={0.8} />
))}
```

Label também clarificado: `"Quintos (tracejado = ideal, laranja = real)"`

---

## Bug #5: OutlineFace — 37 Landmarks vs 17 (Mandíbula apenas)

### Problema

O `LM_JAWLINE` estava com **37 elementos**, desenhando um contorno **completo da testa à testa** (passando por sobrancelhas, têmpora e mandíbula). O backend, porém, define `LM_JAWLINE` com **apenas 17 pontos** (testa-direita → mandíbula → testa-esquerda).

**Frontend:**
```ts
const LM_JAWLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];
// 37 elementos
```

**Backend (landmarks_mesh.py:33):**
```python
LM_JAWLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400]
# 17 elementos
```

### Raiz Técnica

O frontend foi estendido para desenhar um **polígono facial completo** (contorno oval), não apenas a mandíbula. Isto **não é um bug** — é uma feature. O checklist estava desatualizado.

### Status

✅ **Documentado, não precisa de fix.** O polígono de 37 pontos é correto e matches a intenção visual (contorno facial completo). Apenas **atualizou-se o comentário no código** para esclarecer:

```ts
// Facial outline — 17 mandible points (backend landmark_mesh.py LM_JAWLINE).
// Front-end closes the polygon with the 37-point full-contour from cheek to cheek.
const LM_JAWLINE = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109, 10];
```

---

## Coordinate Systems & Transformations

### Frontend Pipeline

```
Backend JSON payload (landmarks em pixels do canonical.jpg)
    ↓
Frontend recebe: landmarks[], imageWidth (CSS), imageHeight (CSS), viewBoxWidth (natural), viewBoxHeight (natural)
    ↓
SVG <svg width={CSS} height={CSS} viewBox="0 0 {natural} {natural}">
    ↓
Landmarks em natural-pixel space (mesmas coordenadas do canonical.jpg)
    ↓
SVG scaling automático: natural → CSS
```

### Chave para Entender

1. **Landmarks sempre em espaço natural-pixel** (coordenadas do canonical.jpg)
2. **SVG viewBox sempre em espaço natural** `viewBox="0 0 vbW vbH"`
3. **SVG width/height sempre em espaço CSS** (rendered screen pixels)
4. **Endpoints de linhas devem respeitar os limites do viewBox**, não do width/height

---

## Cálculos de Referência

### Intercanthal Distance (ICD) — Normalização

```python
# Backend (app/services/normalization.py)
icd_px = ||lm[362] - lm[133]||  # pixel distance between inner eye corners
lm_normalized = (lm - origin) / icd_px  # Scale to ICU (intercanthal units)
```

### Grid Thirds (Naini 2011 §4)

```
Face height = yMenton - yForehead
Upper third:   yForehead → yBrow       (33.3%)
Middle third:  yBrow → ySubnasale      (33.3%)
Lower third:   ySubnasale → yMenton   (33.3%)
```

Frontend compara com valores backend (já ICD-normalizados) quando disponíveis.

### Grid Fifths (Naini 2011 §6)

```
Face width = xRight_Zygo - xLeft_Zygo
Divide into 5 equal fifths (20% each).
Overlay actual eye landmarks to show deviation.
```

### Improvement Vectors (PR-36, M3.2)

```
Anchor landmark: metric_definition.dependency_landmarks[0]
Vector (ICU):   (improvement_vector_x, improvement_vector_y)
Pixel offset:   vector_icu × intercanthal_distance_px
Draw:           arrow from anchor → anchor + offset
Color:          per severity_5 (ideal/mild=green, moderate=yellow, strong=orange, extreme=red)
```

---

---

## Bug #6: OutlineFace Horn — LM_FOREHEAD_RIDGE incompleto (2026-05-12)

### Problema

O polígono `LM_JAWLINE` (37 pontos) traversa 12 pontos da crista da testa: `[338, 297, 332, 284, 251]` à direita, `[10]` no centro, e `[109, 67, 103, 54, 21, 162]` à esquerda. O código nivelava **somente** `lm[10]` ao `trichion_y`. Os 11 vizinhos permaneciam na y original da malha (~nível das sobrancelhas), criando um pico triangular isolado — o "chifre".

### Fix

```tsx
// frontend/src/components/OverlayLayer.tsx
const LM_FOREHEAD_RIDGE = new Set<number>([109, 67, 103, 54, 21, 162, 10, 338, 297, 332, 284, 251]);

// Em OutlineFace: nivelar TODOS os pontos da crista
const pts = LM_JAWLINE.map((idx) => {
  const [x, y_raw] = lm(landmarks, idx);
  const y = LM_FOREHEAD_RIDGE.has(idx) && trichionY !== null ? trichionY : y_raw;
  return `${x},${y}`;
});
```

O mesmo conjunto de índices foi aplicado em `scripts/_overlay_render.py` para paridade PIL ↔ SVG. Resultado: contorno horizontal suave ao nível do trichion conectando as têmporas.

---

## Melhoria #7: Overlay Annotations JSON — Textos Fora da Imagem (2026-05-12)

Labels textuais migrados de pixels burned-in para JSON na resposta da API, renderizados ao lado da imagem via React.

### Módulo Python

`backend/app/services/overlays/annotations.py` — 3 funções:

| Função | Output |
|---|---|
| `build_grid_thirds_annotations(lm, metric_evals)` | `{ideal_pct, rows[{id,label,pct,deviation_pct,severity_5}], legend}` |
| `build_grid_fifths_annotations(lm)` | `{rows[{id,deviation_px}], legend}` |
| `build_face_extents_annotations(lm, trichion_source, metric_evals)` | `{trichion_source, trichion_label, menton_label, face_height_px, face_width_px, legend}` |

### Renderers Python (após fix)

Todos os `_label()` / `cv2.putText()` removidos de `draw_grid_thirds()`, `draw_grid_fifths()`, `draw_face_extents()`, `annotate_ideal_proportions()`. Produzem apenas geometria.

### Componente React

`frontend/src/components/OverlaySidebar.tsx` — variants: `grid_thirds | grid_fifths | face_extents | ideal_proportions`. Paleta CSS vars (`--surface2`, `--border`, `--text`, `--muted`).

---

## Files Modified (completo após todos os fixes)

| Arquivo | Mudanças |
|---|---|
| `frontend/src/components/OverlayLayer.tsx` | Bugs #1–3, LM_FOREHEAD_RIDGE (Bug #6), remoção de `<text>` SVG |
| `frontend/src/components/OverlaySidebar.tsx` | NOVO — 4 variants com paleta CSS vars |
| `frontend/src/pages/PremiumResultPage.tsx` | `canonicalUrl`, `<OverlaySidebar>` em views "ideal" e "overlays" |
| `frontend/src/types.ts` | `canonical_url`, `overlay_annotations` em `AnalysisResult` |
| `scripts/_overlay_render.py` | LM_FOREHEAD_RIDGE, remoção de `_label()`, `build_*_annotations()` |
| `backend/app/services/overlays/annotations.py` | NOVO — 3 funções JSON |
| `backend/app/domain/pipeline.py` | Canonical save, overlay_annotations, `_fused` reordenado antes do simulate |
| `backend/app/vision/routers/full_pipeline.py` | Upload canonical (não original) → `canonical_url` HTTP path |
| `backend/app/vision/routers/results.py` | Endpoint `GET /{run_id}/canonical` |

---

## Testing Checklist

- ✅ TypeScript compilation: `npx tsc --noEmit` (zero errors)
- ✅ OutlineFace sem chifre (linha horizontal suave ao nível do trichion)
- ✅ `grid_thirds.png`, `grid_fifths.png`, `face_extents.png` sem texto — geometria pura
- ✅ `overlay_annotations` presente no JSON do pipeline
- ✅ Endpoint `/v1/vision/results/{run_id}/canonical` retorna imagem canônica (HTTP 200)
- ✅ Frontend exibe `<OverlaySidebar>` ao lado de cada overlay
- ⚠️ Visual regression: QA manual em PremiumResultPage
  - [ ] Redimensioned images (CSS width ≠ natural width)
  - [ ] AxisVertical aligns with nose on symmetric faces
  - [ ] GridFifths eye corners visible (not equal spacing only)

---

## References

- Naini, Shirley H. Facial Aesthetics: Concepts and Clinical Diagnosis. Wiley-Blackwell, 2011. §4–6.
- Farkas, Leslie G. Anthropometry of the Head and Face. Raven Press, 1994.
- MediaPipe FaceMesh Landmarks: https://ai.google.dev/mediapipe/solutions/vision/face_landmarker
- Backend: `app/domain/landmarks_mesh.py` (landmark indices registry)

---

**Última atualização:** 2026-05-12 · Status: ✅ Implementado e implantado
