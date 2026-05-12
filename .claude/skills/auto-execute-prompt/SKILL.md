---
name: auto-execute-prompt
description: "Auto-routing wrapper que lê o plano mais recente em .claude/plans/, extrai o modelo recomendado (opus|sonnet|haiku) da seção 'Recommended Execution Model', localiza o .prompt.md mais recente e invoca execute-prompt com o modelo correto. Use quando o usuário disser 'auto execute', 'execute com modelo certo', 'rode o plano automaticamente' ou após o ciclo /planner → /prompt-initializer estar concluído. Implementa Opção C+B (Plan + Skill Wrapper) do CLAUDE_CONTEXT.md §8."
---

# Auto Execute Prompt (C+B)

Encadeia plano aprovado → prompt gerado → execução com modelo recomendado, sem o usuário precisar especificar o modelo manualmente.

## Pré-requisitos

1. Existe um plano em `.claude/plans/*.md` (não-CLAUDE_CONTEXT) com a seção:
   ```
   ## Recommended Execution Model
   - **Model:** opus | sonnet | haiku
   - **Reason:** ...
   ```
2. Existe um `.prompt.md` em `.claude/prompts/**/*.prompt.md` (gerado por `prompt-initializer`).

Se qualquer pré-requisito faltar, abortar com mensagem clara apontando o que falta.

## Workflow

### Step 1 — Localizar plano mais recente

```bash
LATEST_PLAN=$(ls -t .claude/plans/*.md 2>/dev/null \
  | grep -v -E '(CLAUDE_CONTEXT|README)' \
  | head -1)
```

Se vazio: abortar com `❌ Nenhum plano encontrado em .claude/plans/. Rode /planner primeiro.`

### Step 2 — Extrair modelo recomendado

```bash
RECOMMENDED_MODEL=$(grep -oP '(?<=\*\*Model:\*\*\s)(opus|sonnet|haiku)' "$LATEST_PLAN" \
  | head -1 \
  | tr -d '[:space:]')
```

Validar contra `^(opus|sonnet|haiku)$`. Se inválido/ausente:
```
❌ Plano $LATEST_PLAN não contém seção '## Recommended Execution Model' válida.
Adicione a seção com '- **Model:** opus|sonnet|haiku' antes de rodar auto-execute-prompt.
```

### Step 3 — Localizar prompt mais recente

```bash
LATEST_PROMPT=$(find .claude/prompts -name '*.prompt.md' -type f -printf '%T@ %p\n' 2>/dev/null \
  | sort -nr \
  | head -1 \
  | cut -d' ' -f2-)
```

Se vazio: abortar com `❌ Nenhum .prompt.md encontrado. Rode /prompt-initializer primeiro.`

### Step 4 — Confirmar e invocar `execute-prompt`

Imprimir resumo:
```
🚀 Auto-executando
   Plano:   <LATEST_PLAN>
   Prompt:  <LATEST_PROMPT>
   Modelo:  <RECOMMENDED_MODEL>
```

Invocar a skill `execute-prompt` passando `prompt_file=$LATEST_PROMPT` e `model=$RECOMMENDED_MODEL`. O agente que invocar esta skill deve abrir um subagent (Agent tool) com `model=$RECOMMENDED_MODEL` e prompt = conteúdo de `$LATEST_PROMPT` + instrução para seguir o workflow `execute-prompt`.

### Step 5 — Pós-execução

Após a execução completar, lembrar o usuário:
```
✅ Implementação concluída.
Próximo: rode /session-save para persistir contexto da sessão.
```

## Critério de roteamento (referência rápida)

| Modelo | Casos típicos |
|---|---|
| **opus** | gateway integrations, subscription/billing, multi-tenancy crítico, segurança, arquitetura |
| **sonnet** | service/controller/repository/tests padrão, refactors, novos endpoints |
| **haiku** | formatação, rename, docblock, fixes triviais (1-3 linhas) |

## Fallback manual

Se preferir override manual:
```
/execute-prompt <path-to-prompt> --model <opus|sonnet|haiku>
```

## Referências

- `.claude/plans/CLAUDE_CONTEXT.md` §8 — Auto Model Routing
- `.claude/skills/planner/SKILL.md` — emite o plano com Recommended Execution Model
- `.claude/skills/execute-prompt/SKILL.md` — workflow de execução
