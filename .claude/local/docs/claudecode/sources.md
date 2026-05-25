# Fontes — snapshot sincronizado

Repos oficiais da Anthropic clonados em `/home/luizescobal/et/claudecode/`. Todos sincronizados via `git pull --ff-only` antes da extração.

**Data do snapshot:** 25 de abril de 2026

| Repo | Remote | Commit (curto) |
|------|--------|----------------|
| `claude-code` | <https://github.com/anthropics/claude-code> | `7e93645` |
| `claude-code-security-review` | <https://github.com/anthropics/claude-code-security-review> | `0c6a49f` |
| `claude-agent-sdk-python` | <https://github.com/anthropics/claude-agent-sdk-python> | `8348d1f` |
| `claude-agent-sdk-typescript` | <https://github.com/anthropics/claude-agent-sdk-typescript> | `2b1ffcc` |
| `claude-cookbooks` | <https://github.com/anthropics/claude-cookbooks> | `753ddfe` |
| `claude-plugins-official` | <https://github.com/anthropics/claude-plugins-official> | `020446a` |
| `claude-quickstarts` | <https://github.com/anthropics/claude-quickstarts> | `4b2549e` |
| `skills` | <https://github.com/anthropics/skills> | `5128e18` |

---

## Re-sincronizar

```bash
cd /home/luizescobal/et/claudecode
for d in */; do (cd "$d" && git pull --ff-only); done
```

Após sync, atualizar a tabela de SHAs acima e revisar os arquivos `01-` a `08-` se houver mudanças relevantes nos READMEs/docs.

---

## Documentação oficial online

| Tópico | URL |
|--------|-----|
| Claude Code overview | <https://code.claude.com/docs/en/overview> |
| Settings reference | <https://code.claude.com/docs/en/settings> |
| Plugins | <https://docs.claude.com/en/docs/claude-code/plugins> |
| Hooks | <https://docs.claude.com/en/docs/claude-code/hooks> |
| Agent SDK | <https://docs.claude.com/en/api/agent-sdk/overview> |
| Agent SDK Python | <https://platform.claude.com/docs/en/agent-sdk/python> |
| Skills spec | <https://agentskills.io/specification> |
| Building effective agents | <https://www.anthropic.com/engineering/building-effective-agents> |
| Equipping agents with Skills | <https://anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills> |

---

## Arquivos-fonte específicos consultados

- `claude-code/README.md`, `claude-code/plugins/README.md`, `claude-code/examples/settings/README.md`
- `claude-code/plugins/plugin-dev/skills/{hook-development,skill-development,plugin-structure}/SKILL.md`
- `skills/README.md`, `skills/template/SKILL.md`, `skills/spec/agent-skills-spec.md`
- `claude-plugins-official/README.md`, `claude-plugins-official/plugins/example-plugin/{README.md,plugin.json,*.mcp.json,commands/,skills/}`
- `claude-agent-sdk-python/README.md`, `claude-agent-sdk-python/CLAUDE.md`
- `claude-agent-sdk-typescript/README.md`
- `claude-cookbooks/claude_agent_sdk/README.md`
- `claude-quickstarts/agents/README.md`
