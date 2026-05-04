# Face Analysis Domain — Índice de Contexto

> Documentação completa das regras de negócio, cálculos, métricas, severidades e
> recomendações do sistema de análise facial do projeto `face-before-after`.

---

## Arquivos neste domínio

| Arquivo | Conteúdo |
|---------|----------|
| [01-architecture.md](./01-architecture.md) | Fluxo de dados, arquivos-chave, entrada/saída do pipeline |
| [02-metrics.md](./02-metrics.md) | Definições de todas as métricas (landmarks, proporções, pele, qualidade) |
| [03-calculations.md](./03-calculations.md) | Fórmulas completas: score, severidade, proporções, IPD, simetria |
| [04-severity-thresholds.md](./04-severity-thresholds.md) | Tabelas de limiares de severidade por métrica |
| [05-report-structure.md](./05-report-structure.md) | Estrutura do JSON de saída e seções do relatorio.html |
| [06-visual-status.md](./06-visual-status.md) | Scores compostos: dominância, atratividade, frescor + percepção social |
| [07-recommendations.md](./07-recommendations.md) | Catálogo completo de ações, trilha de evolução e glossário |

---

## Resumo executivo

O sistema analisa uma foto facial frontal e retorna:

1. **Score de simetria** (0–100) baseado em desvio % IPD dos 68 landmarks dlib
2. **Métricas avançadas** (~25 proporções clínicas normalizadas por IPD)
3. **Qualidade da captura** (pose 3D, nitidez, distorção focal, iluminação)
4. **Pele** (uniformidade Lab, olheiras, ΔE entre hemifaces)
5. **Status visual** (3 scores sociais: dominância, atratividade, frescor)
6. **Recomendações** priorizadas por severidade e acionabilidade
7. **Trilha de evolução** em 3 fases (7 d / 30 d / 90 d)
8. **Simulações visuais** (rosto simetrizado, proporções ideais, grid comparativo)

---

## Constantes globais chave

| Constante | Valor | Arquivo |
|-----------|-------|---------|
| `MAX_ASYMMETRY_REFERENCE` | `15.0` (% IPD) | `mvp_pipeline.py` |
| Score ideal | `0% IPD` → score 100 | `mvp_pipeline.py` |
| Score mínimo | `≥15% IPD` → score 0 | `mvp_pipeline.py` |
| Frontal OK | `|yaw| ≤ 7°` e `|pitch| ≤ 7°` | `face_metrics.py` |
| Sharpness mínima | Laplaciana var ≥ 50 | `face_metrics.py` |
| Resolução mínima | face_pixel_width ≥ 200 px | `face_metrics.py` |
