# 01 — Claude Code CLI

> Fonte oficial: <https://code.claude.com/docs/en/overview>  
> Repo: `anthropics/claude-code` (apenas plugins/exemplos públicos — o CLI é distribuído via npm/binário)

---

## Instalação

| Plataforma | Comando recomendado |
|------------|---------------------|
| macOS/Linux | `curl -fsSL https://claude.ai/install.sh \| bash` |
| Homebrew | `brew install --cask claude-code` |
| Windows | `irm https://claude.ai/install.ps1 \| iex` |
| WinGet | `winget install Anthropic.ClaudeCode` |
| ~~npm~~ | `npm install -g @anthropic-ai/claude-code` (deprecated) |

Após instalar, navegue até o projeto e execute `claude`.

---

## Hierarquia de configuração (settings)

Settings se aplicam em camadas; valores mais altos têm prioridade:

```
1. Enterprise managed (managed-settings.json)        ← imposto pela org (MDM)
2. CLI flags (--allowedTools, --mcp-config, ...)
3. Project          .claude/settings.json            ← versionado
4. Local project    .claude/settings.local.json      ← gitignored, prefs do dev
5. User             ~/.claude/settings.json          ← prefs globais do usuário
6. Plugin defaults
```

**Propriedades exclusivas de enterprise:**
- `strictKnownMarketplaces` — bloqueia marketplaces não-aprovados
- `allowManagedHooksOnly` — só permite hooks gerenciados
- `allowManagedPermissionRulesOnly` — só permite regras de permissão gerenciadas

### Templates oficiais (de `claude-code/examples/settings/`)

| Arquivo | Caso de uso |
|---------|-------------|
| `settings-lax.json` | Bloqueia `--dangerously-skip-permissions` e marketplaces |
| `settings-strict.json` | Lax + bloqueia hooks/permissões customizadas + Bash com aprovação + bloqueia WebFetch/WebSearch |
| `settings-bash-sandbox.json` | Força Bash a rodar em sandbox bubblewrap |

> ⚠️ A propriedade `sandbox` aplica-se **apenas ao tool Bash** — não cobre Read, Write, WebSearch, WebFetch, MCPs ou hooks.

---

## Comandos `/` built-in importantes

| Comando | Uso |
|---------|-----|
| `/install-github-app` | Instala o GitHub App e seta secrets para a Action |
| `/plugin marketplace add <git-url>` | Adiciona marketplace de plugins |
| `/plugin install <name>@<marketplace>` | Instala plugin |
| `/plugin` | Browser interativo |
| `/bug` | Reporta bug (Anthropic coleta sessão consentida) |
| `/help` | Lista comandos disponíveis (incluindo de plugins) |

---

## Tools disponíveis ao Claude (default)

`Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`, `WebFetch`, `WebSearch`, `Task` (subagent), além de tools MCP carregadas.

**Permission modes:**
- `default` — pergunta antes de Bash/Write/Edit
- `acceptEdits` — auto-aprova edits de arquivo
- `bypassPermissions` — auto-aprova tudo (perigoso)
- `plan` — só planeja, não executa

Allowlist via `allowed_tools` em settings ou `--allowedTools` na CLI.

---

## Deploy enterprise (MDM)

Distribuir `managed-settings.json` via:
- **Jamf / Kandji (Iru) / Intune** (macOS / Windows)
- **Group Policy** (Windows)

Templates em `claude-code/examples/mdm/`.

---

## Recomendações práticas

1. **Sempre versionar `.claude/settings.json`** com o mínimo necessário para o time (allowed tools, MCP servers compartilhados).
2. **Manter `.claude/settings.local.json` no `.gitignore`** (já é por convenção).
3. Em projetos críticos, **iniciar de `settings-strict.json`** e relaxar conforme necessário.
4. Para times grandes: **usar enterprise managed settings** com `allowManagedHooksOnly: true` para impedir bypass.
5. **Testar settings localmente** copiando para `managed-settings.json` antes do rollout.
