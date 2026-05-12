# Claude Development Rules & Guidelines

## Context loading (MANDATÓRIO antes de qualquer task de face-analysis)

Sempre que a sessão tocar qualquer parte do domínio de análise facial (métricas, scores, ideais, recomendações, landmarks, severidade, narrative, scorer):

1. **Comece lendo [.claude/face-analysis/00-index.md](.claude/face-analysis/00-index.md).** Este é o índice canônico do domínio e aponta para o conteúdo certo.
2. **Carregue SOMENTE os arquivos relevantes ao assunto da sessão.** A regra de mapeamento (assunto → arquivos) está em [AGENTS.md → Context-loading policy](./AGENTS.md). Nunca puxe todos os 8 arquivos do domínio — janela de contexto é finita e ruído derruba precisão.
3. **Justifique antes de abrir.** Para cada arquivo do domínio que for ler, declare numa linha **por que ele importa para a sessão**. Se não der para justificar, não abra.
4. **Poda quando o assunto mudar.** Se o foco da sessão pivotar (ex: começou em recomendações e virou bug de landmark), releia `00-index.md` e ajuste o conjunto — não acumule arquivos do escopo anterior.
5. **Fonte canônica de bugs/fixes:** [`.claude/face-analysis/CALIBRATION_AUDIT_2026-05-12.md`](./.claude/face-analysis/CALIBRATION_AUDIT_2026-05-12.md). Referenciar; não duplicar.

A mesma política vale para a documentação fora de `face-analysis/` (skills, hooks, plans): leia o índice/README do diretório primeiro e puxe só o que justifica o assunto.

## Color Palette — MVP Design System

A paleta de cores foi extraída do `relatorio_mvp.html` e deve ser usada consistentemente em todos os componentes React e telas de interface.

### CSS Variables (Root)

```css
:root {
  --bg:           #0a0a12;        /* Deep navy background */
  --surface:      #13131f;        /* Primary surface */
  --surface2:     #1c1c2e;        /* Secondary surface (cards) */
  --border:       rgba(255,255,255,0.07);  /* Subtle borders */
  --text:         #e2e8f0;        /* Primary text */
  --muted:        #94a3b8;        /* Secondary text */
  --accent:       #6366f1;        /* Primary accent (indigo) */
  --accent2:      #22d3ee;        /* Secondary accent (cyan) */
  --radius:       16px;           /* Border radius standard */
  --shadow:       0 8px 40px rgba(0,0,0,0.6);  /* Base shadow */
}
```

### Color Swatches (Hex Reference)

| Variable    | Hex / RGBA                            | Usage                                    |
|-------------|---------------------------------------|------------------------------------------|
| `--bg`      | `#0a0a12`                            | Page background, body                    |
| `--surface` | `#13131f`                            | Main cards, sections, containers         |
| `--surface2`| `#1c1c2e`                            | Secondary cards, nested elements         |
| `--border`  | `rgba(255,255,255,0.07)`             | Borders, dividers                        |
| `--text`    | `#e2e8f0` (Slate 200)                | Primary text, headings                   |
| `--muted`   | `#94a3b8` (Slate 400)                | Secondary text, captions, metadata       |
| `--accent`  | `#6366f1` (Indigo 500)               | Interactive elements, badges, highlights |
| `--accent2` | `#22d3ee` (Cyan 400)                 | Tier badges, alternative highlights      |

### Additional Colors (from HTML)

- **Indigo gradients**: `rgba(99,102,241,0.18)` / `#a5b4fc` (lighter indigo accent)
- **Cyan highlights**: `#67e8f9` (bright cyan), `rgba(34,211,238,0.12)` (dim cyan bg)
- **Violet gradient**: `#a78bfa` (violet for text gradients)
- **Hero gradient**: Linear from `#0f0f2a` → `#1a0a2e` → `#0a1a2e`

---

## React Component Rules

### 1. Theme Integration

All React components must use CSS variables. Create a theme context or style module:

```tsx
// Example: src/styles/theme.ts
export const colors = {
  bg: 'var(--bg)',
  surface: 'var(--surface)',
  surface2: 'var(--surface2)',
  text: 'var(--text)',
  muted: 'var(--muted)',
  accent: 'var(--accent)',
  accent2: 'var(--accent2)',
  border: 'var(--border)',
  radius: 'var(--radius)',
};

// Example usage in components:
<div style={{ backgroundColor: colors.surface, color: colors.text }} />
```

### 2. Component Styling Patterns

**Card/Section** (Primary Surface):
```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: var(--radius);
box-shadow: var(--shadow);
```

**Nested Card** (Secondary Surface):
```css
background: var(--surface2);
border: 1px solid var(--border);
border-radius: 12px;
```

**Badge/Pill**:
```css
background: rgba([accent-color], 0.12);
border: 1px solid rgba([accent-color], 0.3);
color: [accent-color-light];
border-radius: 99px;
```

**Hero/Gradient Text**:
```css
background: linear-gradient(135deg, [color1] 30%, [color2] 100%);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-clip: text;
```

### 3. Naming Convention

- Use `--` prefix for all CSS variables
- Use kebab-case: `--primary-bg`, `--secondary-text`
- Use semantic names, not color names: `--error-bg` not `--red-bg`

### 4. Responsive Typography

Use `clamp()` for fluid sizing:
```css
font-size: clamp(22px, 5vw, 34px);  /* min, preferred, max */
```

### 5. Spacing & Rhythm

- Gap/margin base unit: `8px`
- Standard paddings: `12px`, `16px`, `20px`, `24px`, `28px`
- Section spacing: `20px` (top margin)

### 6. Border & Shadow

- Standard border: `1px solid var(--border)`
- Border radius: `var(--radius)` (16px default) or `12px` for cards/nested
- Shadows: Use `var(--shadow)` for depth; never black (use dark navy with opacity)

---

## Implementation Checklist

Before committing any React component:

- [ ] All colors use CSS variables, not hardcoded hex
- [ ] Contrast ratio ≥ 4.5:1 for text (WCAG AA)
- [ ] Border radius consistent with design (12px or 16px)
- [ ] Shadows use dark navy + opacity, not pure black
- [ ] Responsive: tested at mobile (360px), tablet (768px), desktop (1440px)
- [ ] No inline styles unless props-driven; prefer styled-components or CSS modules
- [ ] Font sizes use `clamp()` for fluidity
- [ ] Accessible: semantic HTML, proper `alt` tags, ARIA labels where needed

---

## Files to Reference

- **Color source**: `relatorio_mvp.html` (lines 1–100, `:root` CSS variables)
- **Styles directory**: `frontend/src/styles.css` (current theme)
- **Design tokens**: All stored in `:root` CSS variables for easy override

```
**Para deploys futuros, use:**
```bash
just frontend-deploy
```
(Roda `npm run build` + rebuild imagem + restart em um só comando)