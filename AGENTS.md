# AGENTS

Este arquivo documenta agentes e skills disponíveis no projeto.

## Context-loading policy (MANDATÓRIA, todas as sessões)

Antes de implementar ou diagnosticar **qualquer** coisa em face-analysis:

1. **Ler primeiro** [.claude/face-analysis/00-index.md](.claude/face-analysis/00-index.md) — índice canônico do domínio.
2. **Carregar SÓ os arquivos relevantes ao assunto da sessão**, usando o mapa abaixo. Nunca puxe todos os 8 arquivos do domínio "para garantir" — janela de contexto é finita e ruído derruba precisão. Se a sessão tocar um assunto não-listado, carregue apenas `00-index.md` + o arquivo que o índice apontar.

| Assunto da sessão | Arquivos a carregar |
|---|---|
| Adicionar/renomear métrica, fórmula de cálculo, ICD, confidence | `00-index.md` + `02-metrics.md` + `03-calculations.md` |
| Recalibrar ideais, severidade, thresholds, falso-positivo de severity | `00-index.md` + `04-severity-thresholds.md` + `CALIBRATION_AUDIT_2026-05-12.md` |
| Score regional/global, `deviation_normalized`, `IdealComparator`, `RegionalScorer` | `00-index.md` + `04-severity-thresholds.md` + `CALIBRATION_AUDIT_2026-05-12.md` §D |
| Schema DB (`metric_definition`, `metric_ideal`, `region_metric_weight`, migrations Nest) | `00-index.md` + `05-report-structure.md` |
| `visual_status` (Dominância, Atratividade, Vitalidade), `fwhr`, `jawline_definition`, `marquardt` | `00-index.md` + `06-visual-status.md` + `CALIBRATION_AUDIT_2026-05-12.md` §D |
| Recomendações, ranking, trilha de evolução, `top_leverage` | `00-index.md` + `07-recommendations.md` |
| Bug em landmark (índice MediaPipe-478, pose, ICD, zygomatic, alar, lip) | `00-index.md` + `01-architecture.md` + `CALIBRATION_AUDIT_2026-05-12.md` §A |
| Pipeline NestJS, endpoints, orchestrator, narrative service | `00-index.md` + `01-architecture.md` + `05-report-structure.md` |

3. **Poda explícita.** Antes de abrir um arquivo do domínio, justifique em **uma linha** por que ele é relevante para a sessão. Se não der para justificar, não abra. Se durante a execução o assunto mudar, releia `00-index.md` e ajuste — não acumule arquivos do escopo anterior.
4. **Não duplique conteúdo.** Bugs/fixes já documentados em `CALIBRATION_AUDIT_2026-05-12.md` são fonte canônica — referenciar, não repetir.


## Skills Disponíveis

<!-- skills-index-start -->
| Skill | Descrição |
|-------|-----------|
| auto-execute-prompt | Auto-routing wrapper que lê o plano mais recente em .claude/plans/, extrai o modelo recomendado (opus|sonnet|ha... |
| execute-prompt | Gateway obrigatório para execução de qualquer arquivo .prompt.md. SEMPRE invocar quando o usuário disser 'execute o p... |
| full-auto-pipeline | End-to-end orchestrator que encadeia /planner → /prompt-initializer → /auto-execute-prompt em uma única invocação. Us... |
| planner | Decomposes a task into steps, selects the right skills, and orchestrates execution order. Use when the user says 'pla... |
| prompt-initializer | **MANDATORY** high-fidelity context orchestrator: creates .prompt.md file for ANY task arriving in chat. Executes 6-l... |
| session-save | Salva o contexto comprimido da sessão atual em .claude/window-context/current.md para injeção automática na pró... |
<!-- skills-index-end -->


```
**Para deploys futuros, use:**
```bash
just frontend-deploy
```
(Roda `npm run build` + rebuild imagem + restart em um só comando)