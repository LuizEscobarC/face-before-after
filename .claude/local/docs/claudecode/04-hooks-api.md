# 04 — Hooks API

> Doc oficial: <https://docs.claude.com/en/docs/claude-code/hooks>  
> Referência prática: `claude-code/plugins/plugin-dev/skills/hook-development/`

---

## O que são Hooks

Scripts/prompts que rodam **automaticamente em pontos do ciclo de vida** do agente. Não substituem o LLM — adicionam **determinismo** ou **contexto** em momentos chave.

**Casos de uso:**
- Validar tool calls antes da execução (`PreToolUse`)
- Reagir a resultados (`PostToolUse`)
- Forçar passos antes de finalizar (`Stop`, `SubagentStop`)
- Carregar contexto no início (`SessionStart`)
- Bloquear comandos perigosos (Bash com pattern X)
- Auditoria/compliance (logar decisões)

---

## Eventos disponíveis

| Evento | Quando dispara | Pode bloquear? |
|--------|----------------|----------------|
| `PreToolUse` | Antes de cada tool call | ✅ pode `deny` |
| `PostToolUse` | Após cada tool call | ❌ só observa |
| `Stop` | Antes de finalizar resposta | ✅ pode forçar continuar |
| `SubagentStop` | Subagente vai retornar | ✅ pode forçar continuar |
| `SessionStart` | Início da sessão | ❌ injeta contexto |
| `SessionEnd` | Fim da sessão | ❌ cleanup/log |
| `UserPromptSubmit` | Usuário enviou prompt | ✅ pode modificar/bloquear |
| `PreCompact` | Antes de compactação de contexto | ❌ |
| `Notification` | Eventos de UI | ❌ |

---

## Dois tipos de hook

### 1. Prompt-based (recomendado)

LLM decide com base em linguagem natural. Suporta `Stop`, `SubagentStop`, `UserPromptSubmit`, `PreToolUse`.

```json
{
  "type": "prompt",
  "prompt": "Evaluate if this tool use is appropriate: $TOOL_INPUT. Reject if it edits files in /etc.",
  "timeout": 30
}
```

**Vantagens:**
- Decisões contextuais
- Sem bash scripting
- Edge cases melhor cobertos

### 2. Command-based

Bash determinístico — para checks rápidos e estritos.

```json
{
  "type": "command",
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh",
  "timeout": 60
}
```

**Use para:**
- Validações deterministicas (regex, file existence)
- Operações de filesystem
- Integração com tools externas
- Performance crítica

---

## Formato de configuração

### Plugin (`hooks/hooks.json`) — wrapper format

```json
{
  "description": "Validation hooks for code quality",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [
          {
            "type": "command",
            "command": "${CLAUDE_PLUGIN_ROOT}/hooks/validate-write.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Did you run pint --dirty before stopping? If not, do it now."
          }
        ]
      }
    ]
  }
}
```

**Campos:**
- `description` — opcional
- `hooks` — wrapper obrigatório
- `matcher` — string ou regex que filtra qual tool dispara o hook
- `timeout` — segundos

### Settings (`settings.json`) — formato direto (sem wrapper)

```json
{
  "hooks": {
    "PreToolUse": [...]
  }
}
```

---

## Output esperado de hook command

JSON em stdout:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Command contains forbidden pattern: rm -rf"
  }
}
```

Decisões válidas: `allow`, `deny`, `ask`. Sem output → não interfere.

---

## Exemplo Python (Agent SDK)

```python
from claude_agent_sdk import ClaudeAgentOptions, ClaudeSDKClient, HookMatcher

async def check_bash_command(input_data, tool_use_id, context):
    if input_data["tool_name"] != "Bash":
        return {}
    cmd = input_data["tool_input"].get("command", "")
    if "foo.sh" in cmd:
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "foo.sh blocked"
            }
        }
    return {}

options = ClaudeAgentOptions(
    allowed_tools=["Bash"],
    hooks={
        "PreToolUse": [HookMatcher(matcher="Bash", hooks=[check_bash_command])],
    }
)
```

---

## Segurança e patterns

Do plugin oficial `security-guidance`, padrões úteis para PreToolUse:

| Padrão | Risco | Ação típica |
|--------|-------|-------------|
| Command injection (eval, `os.system`) | Alto | warn + ask |
| XSS (`innerHTML`) | Médio | warn |
| `eval()` em JS/Python | Alto | warn |
| Pickle deserialization | Alto | warn |
| Dangerous HTML (`dangerouslySetInnerHTML`) | Médio | warn |
| `rm -rf /` ou paths sensíveis | Crítico | **deny** |

---

## Recomendações práticas

1. **Prefira prompt-based** para decisões contextuais — menor manutenção que bash.
2. **Sempre use `${CLAUDE_PLUGIN_ROOT}`** em paths — nunca paths absolutos.
3. **Timeout curto** (5-30s) — hook lento degrada UX.
4. **Não logue secrets** em PostToolUse — output pode ir para logs públicos.
5. **Teste hooks isoladamente** — `claude-code/plugins/plugin-dev/skills/hook-development/scripts/test-hook.sh`.
6. **Enterprise:** `allowManagedHooksOnly: true` impede projeto/usuário de adicionar hooks que bypassem políticas.
