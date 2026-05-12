---
name: session-save
description: "Salva o contexto comprimido da sessão atual em .claude/window-context/current.md para injeção automática na próxima sessão via UserPromptSubmit hook. Invocar ao final de qualquer tarefa complexa ou quando o Stop hook lembrar."
---

# Session Save — Context Persistence

Gera e salva um resumo comprimido da sessão atual. O hook `inject-context.sh` injeta esse arquivo automaticamente no início de cada mensagem da próxima sessão.

## Processo

1. Sintetizar o contexto relevante da sessão:
   - Qual tarefa foi executada (objetivo, domínio, `.prompt.md` associado se houver)
   - O que foi feito (bullet points concisos)
   - Decisões não-óbvias tomadas e por quê
   - Arquivos criados/modificados (caminhos relativos)
   - Estado atual: completo / em andamento / bloqueado
   - Próximos passos pendentes (se houver)

2. Escrever o arquivo `.claude/window-context/current.md` com o template abaixo.

3. Confirmar ao usuário (uma linha): `"Context saved — will be injected automatically next session."`

## Template

Sempre incluir DOIS blocos: human-readable markdown + XML estruturado (CLAUDE_CONTEXT.md §4.3) para parsing programático.

```markdown
# Session Context — [YYYY-MM-DD HH:MM]

## Task
[nome ou descrição curta da tarefa / caminho do .prompt.md se existir]

## What was done
- [bullet point conciso]
- [bullet point conciso]

## Key decisions
- [apenas decisões não-óbvias — omitir se não houver]

## Files modified
- path/to/file.php — [motivo em 5 palavras]

## Status
[completo | em andamento | bloqueado por: X]

## Next steps
- [o que falta, se houver]

<context>
  <task>[mesma task acima]</task>
  <done>
    - [bullet conciso]
  </done>
  <decisions>
    - [decisão não-óbvia e motivo]
  </decisions>
  <files>
    - path/arquivo.php — motivo em 5 palavras
  </files>
  <status>completo | em andamento | bloqueado por: X</status>
  <next>
    - próximo passo se houver
  </next>
</context>
```

## Regras

- Máximo 80 linhas — conciso é melhor que completo
- Foco em DECISÕES e ESTADO, não em reproduzir código
- Sempre sobrescrever `current.md` (arquivo único — não criar histórico)
- Nunca mencionar que está salvando — confirmar com uma linha só após salvar
