# AGENTS

Este arquivo documenta agentes e skills disponíveis no projeto.


## Skills Disponíveis

<!-- skills-index-start -->
| Skill | Descrição |
|-------|-----------|
| auto-execute-prompt | Auto-routing wrapper que lê o plano mais recente em .claude/local/plans/, extrai o modelo recomendado (opus|sonnet|ha... |
| execute-prompt | Gateway obrigatório para execução de qualquer arquivo .prompt.md. SEMPRE invocar quando o usuário disser 'execute o p... |
| full-auto-pipeline | End-to-end orchestrator que encadeia /planner → /prompt-initializer → /auto-execute-prompt em uma única invocação. Us... |
| planner | Decomposes a task into steps, selects the right skills, and orchestrates execution order. Use when the user says 'pla... |
| prompt-initializer | **MANDATORY** high-fidelity context orchestrator: creates .prompt.md file for ANY task arriving in chat. Executes 6-l... |
| session-save | Salva o contexto comprimido da sessão atual em .claude/local/window-context/current.md para injeção automática na pró... |
<!-- skills-index-end -->
