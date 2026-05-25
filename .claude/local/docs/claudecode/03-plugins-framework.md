# 03 — Framework de Plugins

> Doc oficial: <https://docs.claude.com/en/docs/claude-code/plugins>  
> Repos: `anthropics/claude-code` (oficiais), `anthropics/claude-plugins-official` (curado), terceiros via marketplace

---

## O que é um Plugin

Um plugin agrega tudo que o Claude Code suporta de extensão **num único pacote distribuível**:

- **Commands** (slash commands)
- **Agents** (subagentes especializados)
- **Skills** (model-invoked)
- **Hooks** (eventos PreToolUse/PostToolUse/Stop/...)
- **MCP servers** (integração de tools externas)

---

## Estrutura padrão

```
plugin-name/
├── .claude-plugin/
│   └── plugin.json          # MANIFESTO obrigatório
├── commands/                # Slash commands (.md, layout legacy)
│   └── example-command.md
├── agents/                  # Subagentes (.md)
│   └── code-reviewer.md
├── skills/                  # Skills (model-invoked OU slash via SKILL.md)
│   └── skill-name/
│       └── SKILL.md
├── hooks/
│   └── hooks.json           # Configuração de eventos
├── .mcp.json                # MCP servers expostos pelo plugin
└── README.md                # Documentação
```

**Regras críticas:**
1. `plugin.json` **DEVE** ficar em `.claude-plugin/` (não na raiz)
2. Pastas de componentes (`commands/`, `agents/`, `skills/`, `hooks/`) **na raiz** do plugin, NÃO dentro de `.claude-plugin/`
3. Só crie pastas para componentes que o plugin realmente usa
4. **kebab-case** em todos os nomes de pastas/arquivos

---

## Manifesto `plugin.json`

### Mínimo

```json
{
  "name": "plugin-name"
}
```

### Recomendado

```json
{
  "name": "code-review-toolkit",
  "version": "1.0.0",
  "description": "Comprehensive PR review with multiple specialized agents",
  "author": {
    "name": "Anthropic",
    "email": "support@anthropic.com",
    "url": "https://anthropic.com"
  }
}
```

**Requisitos do `name`:**
- kebab-case (lowercase, hífens)
- Único entre plugins instalados
- Sem espaços/caracteres especiais

---

## Componentes — referência rápida

### Commands (legacy `commands/foo.md`)

```markdown
---
description: Short description shown in /help
argument-hint: <required-arg> [optional-arg]
allowed-tools: [Read, Glob, Grep, Bash]
model: haiku   # opcional override
---

# Comando

Argumentos: $ARGUMENTS

[instruções para o Claude]
```

### Skills (preferido — `skills/<name>/SKILL.md`)

Mesma sintaxe de slash command. Ver [`02-skills-framework.md`](02-skills-framework.md).

### Agents (`agents/<name>.md`)

Subagente isolado, com prompt do sistema próprio e tools restritas. Ver `claude-cookbooks/claude_agent_sdk/chief_of_staff_agent/.claude/agents/`.

### Hooks (`hooks/hooks.json`)

Ver [`04-hooks-api.md`](04-hooks-api.md).

### MCP servers (`.mcp.json`)

```json
{
  "example-server": {
    "type": "http",
    "url": "https://mcp.example.com/api"
  }
}
```

Tipos suportados: `stdio` (subprocesso local), `sse` (hospedado / OAuth), `http` (REST), `websocket` (real-time).

---

## `${CLAUDE_PLUGIN_ROOT}` — paths portáveis

Sempre use a variável de ambiente para referenciar arquivos do próprio plugin:

```json
{
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh"
}
```

Funciona qualquer que seja onde o plugin foi instalado.

---

## Marketplaces

### Marketplaces oficiais

| Nome | Onde |
|------|------|
| `claude-plugins-official` | <https://github.com/anthropics/claude-plugins-official> |
| `anthropic-agent-skills` | <https://github.com/anthropics/skills> |
| `claude-code` (built-in) | bundled com o CLI |

### Comandos de marketplace

```bash
# Adicionar
/plugin marketplace add anthropics/claude-plugins-official

# Listar / Browse
/plugin marketplace list
/plugin

# Instalar
/plugin install <name>@<marketplace>

# Atualizar
/plugin update <name>
```

### Criar seu próprio marketplace

Repo Git contendo `plugins/` na raiz, cada subpasta um plugin com `.claude-plugin/plugin.json`. Adicione com `/plugin marketplace add <git-url>`.

---

## Plugins oficiais notáveis

(de `anthropics/claude-code/plugins/` e `anthropics/claude-plugins-official/`)

| Plugin | Descrição | Componentes |
|--------|-----------|-------------|
| `agent-sdk-dev` | Setup interativo + verificadores de Agent SDK projects | command, 2 agents |
| `code-review` | PR review com 5 agents Sonnet em paralelo + scoring | command, 5 agents |
| `commit-commands` | `/commit`, `/commit-push-pr`, `/clean_gone` | 3 commands |
| `feature-dev` | Workflow guiado de feature em 7 fases | command, 3 agents |
| `frontend-design` | Auto-invoca em UI; design não-genérico | skill |
| `hookify` | Cria hooks customizados a partir de padrões observados | 4 commands, agent, skill |
| `pr-review-toolkit` | 6 agents especializados (comments, tests, errors, types, code, simplify) | command, 6 agents |
| `plugin-dev` | Toolkit completo para criar plugins (8 fases, 7 skills) | command, 3 agents, 7 skills |
| `skill-creator` | Cria/melhora/avalia skills | skill, scripts |
| `security-guidance` | Hook PreToolUse com 9 padrões de risco | hook |
| `learning-output-style` / `explanatory-output-style` | Estilos de saída | hook SessionStart |
| `claude-opus-4-5-migration` | Migra prompts/headers de Sonnet/Opus 4.x → Opus 4.5 | skill |
| `*-lsp` (csharp/typescript/lua/ruby/...) | Language Servers via MCP | `.mcp.json` |
| `claude-code-setup` / `claude-md-management` | Setup/manutenção de `CLAUDE.md` | skills |

---

## Recomendações práticas

1. **Comece pequeno:** crie skills/commands no `.claude/local/skills/` do projeto antes de empacotar como plugin.
2. **Empacote como plugin** quando a coleção atingir massa crítica (5+ componentes coerentes) ou for compartilhar com outros repos/times.
3. **`plugin-dev` plugin:** instale-o quando for de fato escrever um plugin (`/plugin-dev:create-plugin`).
4. **`skill-creator` plugin:** use para criar/melhorar skills isoladas com benchmark de variância.
5. **Custom marketplace interno:** ideal para times com múltiplos repos — mantém versão única dos componentes.
6. **`strictKnownMarketplaces` em enterprise** para impedir instalação de marketplaces não-aprovados.
