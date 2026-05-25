# Documentação Claude Code — Arquitetura, Framework e Recomendações

Síntese da documentação oficial do ecossistema Claude Code (Anthropic), filtrada e adaptada para o contexto do **firepay-checkout-backend** (Laravel 10.x multi-tenant SaaS).

> **Atualização:** abril/2026 · **Fontes:** ver [`sources.md`](sources.md) com SHAs sincronizados dos 9 repos oficiais

---

## Visão geral do ecossistema

O ecossistema Claude Code da Anthropic se organiza em camadas:

```
┌──────────────────────────────────────────────────────────────┐
│  Aplicações de usuário                                        │
│  • Claude Code CLI (terminal/IDE)                             │
│  • Claude Code SDK (Python / TypeScript) — setup local-only         │
│  • Claude.ai (skills uploadadas)                              │
└──────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────┐
│  Frameworks de extensão                                       │
│  • Plugins      (commands + agents + skills + hooks + MCP)    │
│  • Skills       (modulos auto-carregáveis por contexto)       │
│  • Agents       (subagentes especializados)                   │
│  • Hooks        (PreToolUse, PostToolUse, Stop, ...)          │
│  • MCP Servers  (stdio / SSE / HTTP / WebSocket)              │
└──────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────┐
│  SDKs programáticos                                           │
│  • claude-agent-sdk-python                                    │
│  • claude-agent-sdk-typescript                                │
└──────────────────────────────────────────────────────────────┘
                              │
┌──────────────────────────────────────────────────────────────┐
│  Modelo + plataforma                                          │
│  • Claude (Anthropic API / Bedrock / Vertex / Foundry)        │
└──────────────────────────────────────────────────────────────┘
```

---

## Índice

| # | Documento | Cobertura |
|---|-----------|-----------|
| 01 | [CLI Claude Code](01-claude-code-cli.md) | Instalação, settings hierarchy, configurações enterprise, comandos `/` |
| 02 | [Framework de Skills](02-skills-framework.md) | Spec oficial, frontmatter, progressive disclosure, descoberta, distribuição |
| 03 | [Framework de Plugins](03-plugins-framework.md) | Estrutura `plugin.json`, componentes (commands/agents/skills/hooks/MCP), marketplaces |
| 04 | [Hooks API](04-hooks-api.md) | Eventos, prompt-based vs command, formato `hooks.json`, segurança |
| 05 | [Agent SDK (Python + TS)](05-agent-sdk.md) | `query()` vs `ClaudeSDKClient`, custom tools, hooks programáticos, tipos |
| 07 | [Padrões e Cookbook](07-cookbook-patterns.md) | Multi-agent, research, observability, SRE, MCP Custom Tools |
| 08 | [Recomendações para firepay](08-recomendacoes-firepay.md) | Como aplicar tudo isso ao stack Laravel multi-tenant atual |
| 99 | [Fontes](sources.md) | Repos oficiais + SHAs do snapshot atual |

---

## Quick reference

### Quando usar o quê?

| Necessidade | Use |
|-------------|-----|
| Conhecimento procedural reutilizável dentro de uma conversa | **Skill** (`SKILL.md`) |
| Comando rápido invocado pelo usuário (`/algo`) | **Slash command** (também `SKILL.md` com `argument-hint`) |
| Tarefa autônoma de pesquisa/refactor que precisa contexto isolado | **Subagent** |
| Validação determinística antes/depois de tool calls | **Hook** (PreToolUse / PostToolUse) |
| Integração com serviço externo (DB, API) | **MCP server** |
| Conjunto coerente de tudo acima, distribuível | **Plugin** |
| Aplicação programática Python/TS | **Agent SDK** |

### Hierarquia de descoberta (prioridade decrescente)

1. **Enterprise** (`managed-settings.json`) — políticas obrigatórias
2. **CLI flags** (`--allowedTools`, `--mcp-config`)
3. **Project** (`.claude/settings.json`)
4. **Local project** (`.claude/settings.local.json`, gitignored)
5. **User** (`~/.claude/settings.json`)
6. **Plugin defaults**

---

**Stack alvo:** Laravel 10.x · multi-tenant (Stancl) · 6 gateways de pagamento · 23 integrações externas · MySQL + MongoDB + Redis  
**Containers:** `fp-checkout-backend`, `fp-checkout-server`, `fp-checkout-database`, `fp-checkout-redis`, `fp-checkout-mongo`, `fp-checkout-minio`
