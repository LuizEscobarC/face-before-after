# 05 — Agent SDK (Python + TypeScript)

> Docs: <https://docs.claude.com/en/api/agent-sdk/overview>  
> Repos: `anthropics/claude-agent-sdk-python`, `anthropics/claude-agent-sdk-typescript`  
> Node 18+ / Python 3.10+

---

## O que é

SDKs programáticos que permitem **construir agentes** usando o mesmo motor do Claude Code CLI. Use para automação de longa duração, integrações server-side, agentes embarcados em aplicações.

> **Migração:** o antigo "Claude Code SDK" foi renomeado para "Claude Agent SDK" (`ClaudeCodeOptions` → `ClaudeAgentOptions`).

---

## Instalação

```bash
# Python
pip install claude-agent-sdk      # CLI bundled — sem instalar Claude Code separado

# TypeScript
npm install @anthropic-ai/claude-agent-sdk
```

---

## Duas APIs principais

### 1. `query()` — one-shot

Função async que retorna `AsyncIterator` de mensagens.

```python
import anyio
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, TextBlock

async def main():
    options = ClaudeAgentOptions(
        system_prompt="You are a helpful assistant",
        max_turns=1,
        allowed_tools=["Read", "Write", "Bash"],
        permission_mode="acceptEdits",
        cwd="/path/to/project",
    )
    async for message in query(prompt="Tell me a joke", options=options):
        if isinstance(message, AssistantMessage):
            for block in message.content:
                if isinstance(block, TextBlock):
                    print(block.text)

anyio.run(main)
```

### 2. `ClaudeSDKClient` — bidirecional/interativo

Suporta conversas multi-turn, **custom tools** e **hooks** programáticos.

```python
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions

async with ClaudeSDKClient(options=options) as client:
    await client.query("Greet Alice")
    async for msg in client.receive_response():
        print(msg)
    
    # Continue na mesma sessão
    await client.query("Now greet Bob")
    async for msg in client.receive_response():
        print(msg)
```

---

## Custom Tools (in-process MCP)

Funções Python decoradas como `@tool` rodam **no mesmo processo** — sem subprocess MCP.

```python
from claude_agent_sdk import tool, create_sdk_mcp_server, ClaudeAgentOptions, ClaudeSDKClient

@tool("greet", "Greet a user", {"name": str})
async def greet_user(args):
    return {"content": [{"type": "text", "text": f"Hello, {args['name']}!"}]}

server = create_sdk_mcp_server(name="my-tools", version="1.0.0", tools=[greet_user])

options = ClaudeAgentOptions(
    mcp_servers={"tools": server},
    allowed_tools=["mcp__tools__greet"]   # auto-aprova
)
```

**Vantagens vs MCP externo:**
- Sem subprocess management
- Sem overhead IPC
- Single deploy
- Type safety (Python type hints)

**Mistura:** pode usar SDK MCP + external MCP no mesmo `mcp_servers`.

---

## Hooks programáticos

(detalhes em [`04-hooks-api.md`](04-hooks-api.md))

```python
from claude_agent_sdk import HookMatcher

options = ClaudeAgentOptions(
    hooks={
        "PreToolUse": [HookMatcher(matcher="Bash", hooks=[my_validator_fn])],
    }
)
```

---

## Tipos importantes

(de `src/claude_agent_sdk/types.py`)

| Tipo | Uso |
|------|-----|
| `ClaudeAgentOptions` | Configuração (tools, MCP, hooks, prompt, cwd, max_turns, permission_mode) |
| `AssistantMessage`, `UserMessage`, `SystemMessage`, `ResultMessage` | Tipos de mensagem |
| `TextBlock`, `ToolUseBlock`, `ToolResultBlock` | Blocos de conteúdo |

## Erros (Python)

| Exception | Causa |
|-----------|-------|
| `ClaudeSDKError` | base |
| `CLINotFoundError` | Claude Code não instalado |
| `CLIConnectionError` | Problemas de conexão |
| `ProcessError` | Subprocesso falhou (`exit_code`) |
| `CLIJSONDecodeError` | JSON parse |

---

## Permissões — ordem de avaliação

1. `allowed_tools` allowlist → auto-aprova listadas
2. `disallowed_tools` denylist → bloqueia listadas
3. `permission_mode` (`default`, `acceptEdits`, `bypassPermissions`, `plan`)
4. `can_use_tool` callback (decisão programática final)

> `allowed_tools` **não remove** tools — apenas pré-aprova. Para remover, use `disallowed_tools`.

---

## Padrões do cookbook

(de `claude-cookbooks/claude_agent_sdk/`)

| Notebook | Padrão demonstrado |
|----------|---------------------|
| 00 — Research Agent | `query()` + WebSearch + Read multimodal + ClaudeSDKClient para contexto |
| 01 — Chief of Staff | CLAUDE.md persistente, output styles, plan mode, slash commands, hooks de compliance, subagent orchestration, Bash + Python para cálculo |
| 02 — Observability Agent | MCP externo (Git 13+ tools, GitHub 100+ tools), CI/CD analysis, root cause |
| 03 — Site Reliability Agent | MCP custom (12+ tools via JSON-RPC subprocess), Prometheus/PromQL, edits + restart Docker, PreToolUse safety hooks, end-to-end incident lifecycle |

---

## Recomendações práticas

1. **`query()` para tarefas one-shot**, `ClaudeSDKClient` para conversas multi-turn ou quando precisar de custom tools/hooks.
2. **In-process SDK MCP** > External MCP sempre que possível — performance e simplicidade.
3. **Sempre setar `cwd`** explicitamente — não dependa do diretório do processo.
4. **`max_turns` defensivo** em automações server-side para limitar custo.
5. **Hooks PreToolUse** para qualquer write em produção — validação determinística antes de qualquer Edit/Write/Bash.
6. **Wheel bundling:** o pacote Python já vem com Claude Code CLI embutido — instale com `pip` em containers e está pronto.
