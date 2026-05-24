---
tenant_id: "face-before-after-frontend"
project: "face-before-after-frontend"
module: "frontend/index"
file_path: ".claude/local/context/frontend/00-index.md"
doc_type: "architecture"
created_at: "2026-05-24"
updated_at: "2026-05-24"
version: "1.0.0"
summary_context: >
  Frontend é uma SPA Vite + React + TypeScript em frontend/ que consome o NestJS orchestrator,
  faz captura de landmarks client-side via MediaPipe FaceMesh e renderiza relatórios com
  overlays SVG centralizados (servidos pelo backend), toggle bar de landmarks/zonas e
  animação face rig em canvas. Tema dark navy via CSS variables (paleta MVP em CLAUDE.md).
tags:
  - "frontend"
  - "react"
  - "vite"
  - "typescript"
rag_keywords:
  - "Vite React TS SPA"
  - "SVG overlay client rendering"
  - "MediaPipe FaceMesh client-side"
  - "landmark toggle bar"
  - "face rig animation canvas"
  - "MVP design system dark navy"
  - "CSS variables theme"
  - "fluid clamp typography"
related_modules:
  - "nest"
depends_on:
  - "nest"
used_by: []
---

# Frontend — Índice

> **Última atualização:** 2026-05-24
> SPA em `frontend/`, deploy estático via nginx, consome NestJS orchestrator.

## Documentos

| Arquivo | Cobre |
|---|---|
| [README.md](README.md) | Estrutura de pastas, design system, conventions |
| [data-flow.md](data-flow.md) | Fluxo de dados Nest ↔ SPA, hooks, state |
| [layout-css.md](layout-css.md) | CSS variables, tokens, layout, responsivo |
| [overlay-system.md](overlay-system.md) | Pipeline de overlays SVG centralizados |

## Stack

- **Build:** Vite (`frontend/vite.config.ts`)
- **Framework:** React 18 + TypeScript
- **Style:** CSS variables (paleta MVP definida em [CLAUDE.md](../../../../CLAUDE.md))
- **Vision client-side:** MediaPipe FaceMesh para landmarks no browser
- **Deploy:** build estático servido por nginx, multi-stage Dockerfile (ver [infra/01-deployment.md](../infra/01-deployment.md))

## Cross-refs

- API consumida: [nest/00-index.md](../nest/00-index.md)
- Overlay backend que origina os SVGs: [backend/01-architecture.md](../backend/01-architecture.md)
- Tokens de design: seção Color Palette em [CLAUDE.md](../../../../CLAUDE.md)
