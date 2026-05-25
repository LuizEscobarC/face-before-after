# 07 — Padrões e Cookbook

> Repos: `anthropics/claude-cookbooks`, `anthropics/claude-quickstarts`, `anthropics/claude-code-security-review`

---

## A "evolução" do Claude Code

> "O que torna o Claude Code especial não é só entender código — é a habilidade de **trabalho agêntico**: quebrar tarefas, usar tools com inteligência, manter contexto longo, recuperar de erros, saber quando perguntar vs assumir."  
> — `claude-cookbooks/claude_agent_sdk/README.md`

Originalmente interno da Anthropic para acelerar dev. Após o release público, virou framework de propósito geral:
- **Research agents** — coleta + síntese
- **Data analysis** — exploração de datasets
- **Workflow automation** — processos repetitivos
- **Monitoring/Observability** — watch + respond
- **Content generation** — criação iterativa

---

## Padrão 1 — One-Liner Research Agent

**Notebook 00.** Foundation pattern: `query()` + WebSearch + Read multimodal.

```python
async for msg in query(
    prompt="Pesquise as últimas mudanças do PIX em 2026 e resuma",
    options=ClaudeAgentOptions(
        system_prompt="Você é um analista de pagamentos.",
        allowed_tools=["WebSearch", "WebFetch", "Read"],
        max_turns=10,
    )
):
    print(msg)
```

**Quando usar:** tarefas one-shot que precisam de busca + síntese.

---

## Padrão 2 — Chief of Staff (Multi-Agent)

**Notebook 01.** Agente orquestrador com subagentes especializados.

**Componentes:**
- **CLAUDE.md persistente** — instruções de longo prazo (governance, compliance)
- **Output styles** — comunicação adaptada por audiência (executivo vs técnico)
- **Plan mode** — strategic planning sem execução
- **Custom slash commands** — atalhos de usuário
- **Hooks** — compliance tracking, audit trails
- **Subagent orchestration** — `recruiter`, `financial-analyst`, etc.
- **Bash tool** — Python scripts pra cálculo procedural

**Estrutura típica:**
```
chief_of_staff_agent/
├── CLAUDE.md                                # contexto persistente
├── .claude/
│   ├── agents/
│   │   ├── recruiter.md
│   │   └── financial-analyst.md
│   ├── output-styles/
│   │   ├── technical.md
│   │   └── executive.md
│   └── commands/
│       ├── strategic-brief.md
│       ├── budget-impact.md
│       └── talent-scan.md
└── output_reports/
```

**Quando usar:** workflows multi-domínio que precisam de expertise especializada por sub-tarefa.

---

## Padrão 3 — Observability Agent

**Notebook 02.** Conecta Claude a sistemas externos via MCP.

- **Git MCP server** — 13+ tools (blame, log, diff)
- **GitHub MCP server** — 100+ tools (issues, PRs, actions, runs)
- **Real-time monitoring** — CI/CD pipeline analysis
- **Intelligent incident response** — root cause automatizado

**Quando usar:** DevOps, monitoramento de pipeline, automação de issue triage.

---

## Padrão 4 — Site Reliability Agent (SRE)

**Notebook 03.** Read-write remediation autônoma.

- **Custom MCP tool server** — 12+ tools via JSON-RPC subprocess
- **Prometheus integration** — PromQL para error rates, latency, DB
- **Read-write remediation** — edita configs, restart Docker, valida fix
- **PreToolUse safety hooks** — valida ranges (pool size), config sanity
- **End-to-end lifecycle** — detection → remediation → post-mortem
- **Optional integrations** — PagerDuty, Confluence

**Quando usar:** incident response automatizado (com guardrails!).

---

## Padrão 5 — Multi-Agent Research (de `claude-cookbooks/patterns/agents/`)

Estrutura de research distribuída:

```
research_lead_agent       (orchestrator)
    ├─→ research_subagent_1   (busca em fonte A)
    ├─→ research_subagent_2   (busca em fonte B)
    └─→ citations_agent       (valida referências)
```

Lead delega, subagents executam em paralelo, citations agent valida.

---

## Padrão 6 — Custom MCP Tools (in-process)

(detalhes em [`05-agent-sdk.md`](05-agent-sdk.md))

```python
@tool("query_db", "Executa query no DB", {"sql": str})
async def query_db(args):
    rows = await db.fetch(args["sql"])
    return {"content": [{"type": "text", "text": json.dumps(rows)}]}

server = create_sdk_mcp_server(name="db", tools=[query_db])
```

**Quando usar:** agentes embutidos em apps Python/Node — sem overhead MCP externo.

---

## Padrão 7 — Security Review (de `claude-code-security-review`)

Repo da Anthropic com **action GitHub específica para security review** + scripts.

- Detecta vulnerabilidades comuns (OWASP-aligned)
- Roda em PRs como check
- Pode ser usado standalone (`docs/`, `examples/`)

**Estrutura:**
```
claude-code-security-review/
├── action.yml             # GitHub Action (não usada neste projeto — setup local-only)
├── claudecode/            # Lib Python
├── docs/
└── examples/
```

**Quando usar:** adicionar gate de segurança em PRs sem escrever a lógica do zero.

---

## Padrão 8 — Quickstarts (use cases prontos)

(de `claude-quickstarts/`)

| Quickstart | Padrão |
|------------|--------|
| `agents/` | Reference impl de agent loop (~300 linhas) — não-SDK, didático |
| `autonomous-coding/` | Setup pra agente codar autonomamente |
| `browser-use-demo` | Browser automation (Anthropic's computer use) |
| `computer-use-demo` | Computer Use API end-to-end |
| `customer-support-agent` | Agente de suporte com RAG |
| `financial-data-analyst` | Análise financeira com tools |

---

## Recomendações práticas

1. **Não comece do zero** — fork um padrão do cookbook que mais se aproxima.
2. **Subagents reduzem context window** — use pra explorações que retornariam muito conteúdo.
3. **Hooks para safety** — qualquer agente que escreve em produção DEVE ter PreToolUse hooks validando.
4. **MCP custom in-process** > MCP externo quando o tool é Python e roda no mesmo serviço.
5. **Output styles** padronizam comunicação — defina pelo menos um pra time (technical) e outro pra stakeholder (executive).
6. **CLAUDE.md** é o "system prompt persistente" — invista tempo nele; é a alavanca de maior ROI.
