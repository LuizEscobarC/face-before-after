---
tenant_id: "face-before-after"
project: "face-before-after"
module: "frontend/layout-css"
file_path: ".claude/context/frontend/layout-css.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Última revisão: 2026-05-12 Fonte: frontend/src/styles.css
tags:
  - "context"
  - "frontend"
rag_keywords:
  - "context"
  - "frontend"
  - "layout"
related_modules: []
depends_on: []
used_by: []
---
# Layout e CSS do Sistema de Overlays

**Última revisão:** 2026-05-12  
**Fonte:** `frontend/src/styles.css`

---

## Classes do overlay-stage

```css
/* Contêiner principal: imagem à esquerda, sidebar à direita */
.overlay-stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 280px);
  gap: 16px;
  align-items: flex-start;
}

/* Contêiner da imagem + SVGs sobrepostos */
.overlay-media {
  position: relative;
  min-width: 0;              /* evita overflow no grid */
}

.overlay-media > .overlay-stage-image {
  width: 100%;
  max-width: 100%;
}

/* Coluna de sidebars (pode ter múltiplos empilhados) */
.overlay-sidebars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Mobile: colapsa para coluna única */
@media (max-width: 640px) {
  .overlay-stage          { grid-template-columns: 1fr; }
  .overlay-sidebars       { flex-direction: row; flex-wrap: wrap; }
  .overlay-sidebars > *   { flex: 1 1 220px; }
}
```

**Por que grid e não flex?** `grid-template-columns: minmax(0, 1fr) minmax(220px, 280px)` garante que a coluna da imagem encolhe sem overflow e o sidebar tem largura fixa mínima. Com flex + `flex-wrap`, o sidebar caía abaixo em telas ~780px (laptop comum) — bug corrigido em 2026-05-12.

---

## SVG posicionado sobre a imagem

Os SVGs dos overlays ficam em `position: absolute` sobre a imagem:

```tsx
// OverlayLayer.tsx (padrão replicado em MetricsMapLayer, etc.)
<div style={{ position: "absolute", inset: 0 }}>
  <svg width="100%" height="100%" viewBox={`0 0 ${vbW} ${vbH}`}>
    ...
  </svg>
</div>
```

**Por que `width="100%" height="100%"`?** Se o SVG receber `width={pixels}` fixos, expande o container `.overlay-media` em vez de se ajustar a ele. O `viewBox` em natural pixels garante que o mapeamento de landmarks continua correto independente do tamanho CSS.

---

## CSS Variables (paleta)

Definidas em `:root` — todos os componentes devem usar, nunca hex hardcoded:

```css
--bg:       #0a0a12     /* fundo da página */
--surface:  #13131f     /* cards primários */
--surface2: #1c1c2e     /* cards secundários (sidebar cards) */
--border:   rgba(255,255,255,0.07)
--text:     #e2e8f0     /* texto primário */
--muted:    #94a3b8     /* texto secundário */
--accent:   #6366f1     /* indigo (interativo) */
--accent2:  #22d3ee     /* ciano (tier badges, selected border) */
--radius:   16px
--shadow:   0 8px 40px rgba(0,0,0,0.6)
```

### Padrão de card (OverlaySidebar usa `cardStyle`)

```css
background:    var(--surface2);
border:        1px solid var(--border);
border-radius: 12px;
padding:       16px;
color:         var(--text);
```

---

## Breakpoints

| Breakpoint | Comportamento |
|---|---|
| ≥ 641px | Layout 2 colunas (imagem + sidebar lado a lado) |
| ≤ 640px | Layout 1 coluna; sidebars em row wrap |

Evitar regras de layout overlay dentro de blocos `@media (max-width: 980px)` — esse breakpoint afeta layout geral da página, não o overlay-stage.

---

## Referências

- Paleta canônica: `CLAUDE.md` §Color Palette
- Bug de layout (histórico): `.claude/face-analysis/08-svg-overlays.md` §Bug #8, #9
