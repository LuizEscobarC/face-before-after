# Frontend Context — Índice

Documentação técnica do frontend React. Carregue apenas os arquivos relevantes ao assunto da sessão.

| Arquivo | Quando carregar |
|---|---|
| [overlay-system.md](./overlay-system.md) | Qualquer sessão envolvendo overlays SVG, sidebar, cross-highlight, MetricsMap, IdealProportions |
| [data-flow.md](./data-flow.md) | Rastrear como dados do backend chegam a um componente específico; debugging de campos ausentes |
| [layout-css.md](./layout-css.md) | Sessões de layout, responsividade, CSS classes do overlay-stage |

## Arquivos fonte principais

```
frontend/src/
├── pages/PremiumResultPage.tsx   ← orquestrador central (estado, views, monta tudo)
├── components/
│   ├── OverlayLayer.tsx          ← SVGs geométricos sobre a imagem
│   ├── OverlaySidebar.tsx        ← painel textual ao lado dos overlays
│   ├── MetricsMapLayer.tsx       ← SVG de regiões faciais (adherence)
│   ├── IdealProportionsLayer.tsx ← SVG de zonas de proporções ideais
│   └── AsymmetryAnalysisLayer.tsx← SVG de análise de simetria
├── types.ts                      ← tipos TypeScript do AnalysisResult
└── styles.css                    ← CSS variables + classes overlay-stage
```
