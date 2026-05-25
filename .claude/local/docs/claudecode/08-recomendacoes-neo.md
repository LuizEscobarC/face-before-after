# 08 — Recomendações para o neo-backend

Aplicação prática do framework Claude Code ao stack atual: Laravel 10.x · PHP 8.1.5 · Docker `backend-api` · MySQL (estech77_api + estech77_dados) · InfluxDB · Octane + Swoole.

---

## Estado atual no repo

Já existem:

```
.claude/local/
├── skills/                  # 54+ skills (auditadas e portadas)
├── prompts/[domain]/        # Templates de tarefas .prompt.md
├── hooks/scripts/           # block-dangerous-bash.sh (PreToolUse)
├── context/                 # Documentação de domínio (gerada/mantida)
│   ├── ai_context_master.md
│   ├── Business_Logic_Map.md
│   ├── influx_ai_context.md
│   ├── lume/, water/, shared/, integrations/, reports/energy/
└── testspy/                 # Integration tests (Python)
```

E os arquivos de governança:
- `CLAUDE.md` + `CLAUDE.local.md` — sistema persistente do projeto
- `AGENTS.md` — guia de skills/prompts/comandos
- `.clauderules` — constitution (auto-loaded)

---

## Recomendações por camada

### A. CLI / Settings

| Recomendação | Estado |
|--------------|--------|
| `.claude/settings.json` versionado com allowed_tools mínimos | ✅ criado |
| `.claude/settings.local.json` no `.gitignore` | ✅ confirmado |
| Hooks `PreToolUse` Bash safety | ✅ `block-dangerous-bash.sh` registrado |
| `Stop` hook para lembrar `pint --dirty` | ✅ prompt-based registrado |
| `permissions.allow` limpo (sem tokens hardcoded) | ✅ limpo |
| MCP servers documentados | ⚠️ Boost MCP via mecanismo externo — verificar se precisa `.mcp.json` |

### B. Skills (`.claude/local/skills/`)

| Recomendação | Estado |
|--------------|--------|
| 54 skills auditadas — sem contaminação real | ✅ |
| Progressive disclosure: SKILL.md < 800 linhas | ✅ todas passaram |
| `description` com gatilhos PT-BR | ✅ maioria tem |
| Skills determinísticas com `scripts/` | ✅ vários (php-diag, generate-postman, etc.) |
| AGENTS.md listando skills atuais | ✅ seção adicionada |
| Plugin interno `neo-toolkit` | 📋 médio prazo |

### C. Hooks

| Hook | Estado |
|------|--------|
| `PreToolUse Bash` — bloqueia rm -rf, DROP TABLE, force push, volume rm | ✅ |
| `Stop` — lembra pint --dirty | ✅ |
| `SessionStart` — carrega contexto | 📋 futuro |

### D. Plugins oficiais (roadmap)

| Plugin | Prioridade | Status |
|--------|------------|--------|
| `security-guidance` | Alta | 📋 avaliar |
| `php-lsp` | Média | 📋 avaliar |
| `code-review` | Média | 📋 avaliar |
| `neo-toolkit` (interno) | Baixa | 📋 longo prazo |

### E. MCP Servers

O Boost MCP (`tinker`, `database-query`, `search-docs`, `get-absolute-url`, `list-artisan-commands`) é injetado automaticamente pelo Laravel Boost — não requer `.mcp.json` manual. Outros servidores MCP úteis:

| Servidor | Uso | Estado |
|----------|-----|--------|
| MySQL read-only MCP | Queries diretas sem tinker | 📋 avaliar |
| GitHub MCP | PR/issue management | 📋 avaliar |
| Sequential Thinking | Tarefas complexas de raciocínio | 📋 avaliar |

---

## Container neo-backend

| Componente | Container |
|------------|-----------|
| Laravel API | `backend-api` (Octane + Swoole) |
| HTTP proxy | `et-nginx` |
| Cache | `et-redis` |
| Queue workers | `et-supervisor` |
| DB principal | `et-mysql` (estech77_api) |
| DB dados | `et-mysql` (estech77_dados) |

---

## Checklist de auditoria periódica (mensal)

- [ ] Limpar `permissions.allow` de tokens/comandos hardcoded de sessões antigas
- [ ] Rodar `skills-audit` → `skills-cleanup` para detectar drift
- [ ] Verificar AGENTS.md vs `ls .claude/local/skills/` para skill drift
- [ ] Atualizar esta doc com novos itens implementados
- [ ] Rodar `claude-structure-auditor` para gap analysis completo
