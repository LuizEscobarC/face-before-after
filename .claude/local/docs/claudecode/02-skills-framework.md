# 02 — Framework de Skills

> Spec oficial: <https://agentskills.io/specification>  
> Repo de referência: `anthropics/skills`

---

## O que é uma Skill

> Pasta com instruções, scripts e recursos que o Claude **carrega dinamicamente** baseado em contexto da conversa. Transforma Claude de agente generalista em especialista de um domínio.

Forma mais simples: **uma pasta com um `SKILL.md`** (YAML frontmatter + Markdown).

---

## Anatomia

```
skill-name/
├── SKILL.md            (obrigatório)
│   ├── YAML frontmatter
│   │   ├── name:        (obrigatório)
│   │   ├── description: (obrigatório — gatilho de invocação)
│   │   ├── version:     (opcional)
│   │   ├── license:     (opcional)
│   │   └── allowed-tools, argument-hint, model  (slash-commands)
│   └── Conteúdo Markdown (instruções, exemplos, guidelines)
└── Recursos opcionais
    ├── scripts/        (Python, Bash — código determinístico, executável)
    ├── references/     (docs carregados em contexto sob demanda)
    └── assets/         (templates, fontes, imagens — usados no output)
```

### Frontmatter mínimo

```yaml
---
name: my-skill-name
description: A clear description of what this skill does and when to use it
---
```

### Frontmatter completo (slash-command / user-invoked)

```yaml
---
name: skill-name
description: Short description for /help
argument-hint: <arg1> [optional-arg]
allowed-tools: [Read, Glob, Grep, Bash]
model: haiku        # opcional override
---
```

---

## Progressive Disclosure (princípio central)

Skills usam carregamento em 3 níveis para gerenciar contexto:

| Nível | Conteúdo | Tamanho típico | Quando carrega |
|-------|----------|----------------|----------------|
| 1. Metadata | `name` + `description` | ~100 palavras | **Sempre** em contexto |
| 2. SKILL.md body | Instruções principais | < 5.000 palavras | Quando a skill é triggada |
| 3. Recursos bundled | scripts, references, assets | Ilimitado | Sob demanda do Claude |

> **Regra de ouro:** mantenha o `SKILL.md` enxuto. Mova schemas, exemplos longos e docs detalhados para `references/`. Scripts ficam em `scripts/` (podem ser executados sem ler para contexto).

---

## Escrevendo descrições eficazes

A `description` decide **quando** o Claude invoca. Anti-padrão é descrição genérica.

**Bom:**
```yaml
description: This skill should be used when the user asks to "create a hook",
  "add a PreToolUse hook", "validate tool use", or mentions hook events
  (PreToolUse, PostToolUse, Stop, SubagentStop). Provides comprehensive
  guidance for creating Claude Code plugin hooks.
```

**Ruim:**
```yaml
description: Helps with hooks
```

**Inclua:**
- Frases-gatilho específicas que usuários diriam
- Keywords que indicam relevância
- Áreas de tópico cobertas
- Use **terceira pessoa** ("This skill should be used when…")

---

## Tipos de skill

| Tipo | Invocação | Exemplo |
|------|-----------|---------|
| **Model-invoked** | Claude decide com base no contexto | `frontend-design` (auto-invocada em tarefas de UI) |
| **User-invoked (slash)** | Usuário digita `/skill-name` | `/code-review`, `/feature-dev` |
| **Plugin-bundled** | Empacotada num plugin | Skills de `claude-plugins-official` |

> Layout legacy: `commands/foo.md` é **idêntico** a `skills/foo/SKILL.md`. Ambos são carregados igual; prefira o segundo.

---

## Onde colocar skills

| Escopo | Localização | Distribuição |
|--------|-------------|--------------|
| **User global** | `~/.claude/skills/` | Pessoal |
| **Projeto** | `.claude/skills/` (ou `.claude/local/skills/`) | Versionado com o repo |
| **Plugin** | `<plugin>/skills/` | Via plugin marketplace |
| **Claude.ai** | Upload via UI | Uma conta |

> **Convenção firepay:** `.claude/local/skills/` — escopo de projeto, todas as skills do time.

---

## Distribuição via Plugin Marketplace

```bash
# Adicionar marketplace
/plugin marketplace add anthropics/skills

# Instalar conjunto de skills
/plugin install document-skills@anthropic-agent-skills
/plugin install example-skills@anthropic-agent-skills
```

Skills oficiais da Anthropic (alguns exemplos):
- **Documentos:** `docx`, `pdf`, `pptx`, `xlsx` (criação/edição com fidelidade)
- **Design:** `frontend-design`, `canvas-design`, `algorithmic-art`, `theme-factory`
- **Dev:** `webapp-testing`, `mcp-builder`, `skill-creator`
- **Brand:** `brand-guidelines`, `internal-comms`, `slack-gif-creator`

---

## Recomendações práticas

1. **Uma skill = um domínio.** Não junte payment + checkout numa só.
2. **Description com 3-5 frases-gatilho** que o usuário realmente digitaria (em PT-BR e EN se time for misto).
3. **SKILL.md < 5k palavras.** Mova detalhes para `references/`.
4. **Scripts deterministicos em `scripts/`** quando o mesmo código é reescrito sempre.
5. **Tags consistentes** no frontmatter para filtragem (`tags: [firepay, payment, gateway]`).
6. **Teste o gatilho:** depois de criar, abra um chat novo e digite uma das frases-gatilho — verifique se Claude invoca.
7. **Cross-references:** se a skill chama outra (`invoke X-skill`), garanta que X exista — use `skills-audit` (skill local).
