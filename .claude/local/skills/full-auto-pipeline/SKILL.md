---
name: full-auto-pipeline
description: "End-to-end orchestrator que encadeia /planner → /prompt-initializer → /auto-execute-prompt em uma única invocação. Use quando o usuário disser 'pipeline completo', 'full auto', 'roda tudo', 'plan + prompt + execute', 'do everything', 'orquestra', ou descrever uma task de chat e quiser que tudo (planejar, gerar prompt, executar com modelo correto) aconteça sem intervenção manual entre etapas. Evita ter que invocar as três skills separadamente."
---

# Full Auto Pipeline

Encadeia os três estágios canônicos do fluxo de trabalho numa única passada:

```
/planner  →  /prompt-initializer  →  /auto-execute-prompt
   (1)            (2)                       (3)
```

Cada estágio é pré-requisito do próximo. Esta skill apenas orquestra — toda a lógica vive nas skills filhas.

## Quando usar

- Usuário descreve uma task de chat e quer execução completa sem intervenção manual.
- Triggers: "pipeline completo", "full auto", "roda tudo", "plan + prompt + execute", "orquestra essa task".
- **Não usar** se já existe um `.prompt.md` referenciado (vá direto para `/auto-execute-prompt` ou `/execute-prompt`).
- **Não usar** se a task é trivial (1-3 linhas, rename, format) — vá direto para `execute-prompt` com `model=haiku`.

## Pré-condições

1. Repositório git limpo ou com mudanças intencionais isoladas.
2. Diretórios existem: `.claude/plans/`, `.claude/prompts/`.
3. Skills disponíveis: `planner`, `prompt-initializer`, `auto-execute-prompt`, `execute-prompt`.

Se faltar qualquer uma, abortar com mensagem apontando o que falta.

## Workflow

### Step 1 — Invocar `planner`

Passar a descrição original da task do usuário. O planner vai:
- Decompor a task em passos numerados.
- Mapear skills para cada passo.
- Salvar plano em `.claude/plans/[slug]-[YYYY-MM-DD].md`.
- Emitir seção obrigatória `## Recommended Execution Model` com `opus|sonnet|haiku`.

**Validação após Step 1:**
```bash
LATEST_PLAN=$(ls -t .claude/plans/*.md 2>/dev/null \
  | grep -v -E '(CLAUDE_CONTEXT|README)' \
  | head -1)
test -n "$LATEST_PLAN" || abort "❌ planner não gerou plano em .claude/plans/"
grep -q '## Recommended Execution Model' "$LATEST_PLAN" \
  || abort "❌ plano $LATEST_PLAN sem seção 'Recommended Execution Model'"
```

Apresentar o plano ao usuário e **pedir confirmação** antes de prosseguir, a menos que o usuário tenha dito explicitamente "no confirma" / "vai direto" / "sem perguntar".

### Step 2 — Invocar `prompt-initializer`

Com o plano aprovado, passar a mesma descrição da task + referência ao plano gerado. O initializer vai:
- Extrair `module`, `type`, `slug`, `date`.
- Detectar padrões agênticos (CoT, ToT, ReAct).
- Salvar em `.claude/prompts/[module]/task-[slug]-[date].prompt.md`.

**Validação após Step 2:**
```bash
LATEST_PROMPT=$(find .claude/prompts -name '*.prompt.md' -type f -printf '%T@ %p\n' 2>/dev/null \
  | sort -nr | head -1 | cut -d' ' -f2-)
test -n "$LATEST_PROMPT" || abort "❌ prompt-initializer não gerou .prompt.md"
```

### Step 3 — Invocar `auto-execute-prompt`

A skill `auto-execute-prompt` localiza sozinha o plano + prompt mais recentes, extrai o modelo recomendado e dispara `execute-prompt` com o modelo correto. Não passar argumentos — ela já faz a descoberta.

### Step 4 — Pós-execução

Após `auto-execute-prompt` retornar:

```
✅ Pipeline concluído
   Plano:   <LATEST_PLAN>
   Prompt:  <LATEST_PROMPT>
   Modelo:  <RECOMMENDED_MODEL>

Próximo: /session-save (persistir contexto da sessão).
Pós-implementação: execute os quality gates definidos no CLAUDE.md do projeto.
```

## Modos de operação

| Modo | Como ativar | Comportamento |
|---|---|---|
| **Interativo** (padrão) | `/full-auto-pipeline <task>` | Pausa após Step 1 para aprovação do plano |
| **Não-interativo** | usuário diz "vai direto", "sem confirmar", "no-confirm" | Executa os 3 steps em sequência sem pausa |
| **Resumo após cada step** | usuário diz "verbose" | Imprime resumo curto após cada estágio |

## Tratamento de erro

- **Falha no Step 1:** abortar; reportar erro do planner. Nada foi gravado fora de `.claude/plans/`.
- **Falha no Step 2:** plano fica salvo; usuário pode rerodar só o initializer.
- **Falha no Step 3:** plano + prompt ficam salvos; usuário pode rerodar `/auto-execute-prompt` manualmente após corrigir.

Nunca apagar artefatos de estágios anteriores em caso de falha — eles servem para retomada manual.

## Override manual

Se o usuário quiser pular um estágio:

```
/full-auto-pipeline --skip-planner    # usa último plano existente
/full-auto-pipeline --skip-init       # usa último .prompt.md existente
```

Em ambos os casos, validar que o artefato existe antes de prosseguir.

## Referências

- `.claude/skills/planner/SKILL.md` — Step 1
- `.claude/skills/prompt-initializer/SKILL.md` — Step 2
- `.claude/skills/auto-execute-prompt/SKILL.md` — Step 3
- `.claude/plans/CLAUDE_CONTEXT.md` §8 — Auto Model Routing (Opção C+B)
