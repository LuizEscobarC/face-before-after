# CLAUDE_CONTEXT.md
## Arquitetura de Desenvolvimento Claude — Regras de Prompt Engineering + Token Ops

**Projeto:** face-before-after
**Stack:** generic
**Uso:** Cole como contexto inicial em qualquer nova sessão.
**Modelo de referência:** Claude Sonnet 4.6 (padrão) | Haiku 4.5 (triagem) | Opus 4.6 (decisões críticas)
**Gerado por:** context-framework-installer
**Última revisão:** 2026-05

---

## 1. COMPORTAMENTO PADRÃO (sempre ativo)

```
Responda direto. Sem enrolação. Sem frases de preenchimento.
Frases curtas de 3 a 6 palavras quando possível.
Não narre o processo. Não explique mais do que o necessário.
Implemente mudanças em vez de apenas sugerir — a menos que seja pedido explicitamente o contrário.
```

**Por quê:** Claude 4.x segue instruções com precisão maior que versões anteriores. Respostas diretas economizam ~40% de tokens por chamada.

---

## 2. REGRAS DE PROMPT ENGINEERING

### 2.1 Clareza e explicitação

- **Seja explícito.** Não assuma comportamento implícito.
- **Forneça contexto e motivação.** Explique *por que* uma instrução é importante.
- **Prefira exemplos positivos** (como deve ser) a negativos (o que não fazer).
- **Diga o que fazer, não o que não fazer.**

### 2.2 Estrutura com XML tags

```xml
<instructions>Regras e comportamento esperado</instructions>
<context>Informações de fundo da sessão</context>
<examples>
  <example><input>...</input><output>...</output></example>
</examples>
<formatting>Regras de formato da resposta</formatting>
```

### 2.3 Chain of Thought (CoT)

| Nível | Quando usar | Implementação |
|-------|-------------|---------------|
| Básico | Múltiplos passos | "Pense passo a passo" |
| Guiado | Análise complexa | Liste os passos de raciocínio |
| Estruturado | Separar raciocínio do output | `<thinking>...</thinking><answer>...</answer>` |

### 2.4 Encadeamento de prompts

Quebre tarefas complexas em subtarefas sequenciais com **um único objetivo claro** cada.

```
Fluxo padrão: Descoberta → Planejamento → Execução
```

---

## 3. GESTÃO DE CONTEXTO E TOKENS

### 3.1 Thresholds

| % Contexto | Ação |
|-----------|------|
| 0–60% | Normal |
| 60–75% | Monitorar |
| 75–85% | Economizar: respostas curtas, sem exemplos longos |
| 85–90% | Alerta: invocar /session-save |
| >90% | Auto-compactar — hooks salvam contexto automaticamente |

### 3.2 Plano A — Session Persistence com Hooks

Os hooks instalados fazem isso automaticamente:

| Script | Evento | Comportamento |
|---|---|---|
| `save-session-summary.sh` | Stop (todo turno) | Prepend nova sessão no topo de `window-context/current.md`; mantém últimas 10 |
| `save-context-before-compact.sh` | PreCompact | Salva as últimas 6 mensagens antes de compactar |
| `inject-context.sh` | UserPromptSubmit | Injeta `current.md` + `napkin.md` no início de cada turno |

### 3.3 Plano B — iterate.sh (override manual de modelo)

```bash
# .claude/local/scripts/iterate.sh
#!/usr/bin/env bash
# Uso: bash iterate.sh [opus|sonnet|haiku] [prompt-file]
MODEL=${1:-sonnet}
PROMPT_FILE=${2:-}
ARGS="--model $MODEL --print"
[ -n "$PROMPT_FILE" ] && ARGS="$ARGS $(cat $PROMPT_FILE)"
claude $ARGS
```

---

## 4. PADRÃO DE SESSÃO PARA TAREFAS LONGAS

### 4.1 Estrutura de 3 fases

```
Fase 1 — Discovery  (Haiku): ler código, gerar resumo, mapear dependências
Fase 2 — Planning   (Opus):  criar plano detalhado, decisões de arquitetura
Fase 3 — Execution  (Sonnet): implementar, testar, documentar
```

### 4.2 Handoff entre fases

Ao fim de cada fase, salvar em `.claude/local/window-context/current.md`:

```xml
<context>
  <session_phase>Discovery|Planning|Execution</session_phase>
  <task_summary>O que foi feito até aqui</task_summary>
  <next_step>O que fazer na próxima fase</next_step>
  <files_modified>Lista de arquivos tocados</files_modified>
  <decisions_made>Decisões tomadas (com justificativa)</decisions_made>
</context>
```

### 4.3 Chain-of-Session

```
Discovery  -- read code, generate summary
Planning   -- read summary, create task plan
Execution  -- read plan, build
```

---

## 5. CHECKLIST DE SESSÃO

### Início
- [ ] Verificar `window-context/current.md` (hook injeta automaticamente)
- [ ] Identificar fase atual (Discovery / Planning / Execution)
- [ ] Classificar task: simples vs complexa

### Durante
- [ ] Verificar % de contexto a cada ~10 trocas
- [ ] Citar arquivos por caminho + linha, não parafraseando
- [ ] Amostrar dados grandes (≤10 linhas, 100 chars/col)

### Fim
- [ ] /session-save — se trabalho significativo foi feito
- [ ] Atualizar napkin.md — se descobriu algo não-óbvio

---

## 6. HÁBITOS — FAÇA E NÃO FAÇA

### Faça
- Diga o que não sabe — melhor que inventar
- Use `<thinking>` para raciocínio antes de código complexo
- Salve contexto entre sessões com `/session-save`
- Cite código por número de linha, não por paráfrase

### Não faça
- Não reproduza schemas/DDL inteiros — link para arquivo
- Não gere código sem ler o contexto existente primeiro
- Não declare tarefa completa sem testar o comportamento principal
- Não ignore `napkin.md` — contém learnings de sessões anteriores

---

## 7. REFERÊNCIA RÁPIDA DE SNIPPETS

### Session Save (manual)
```bash
/session-save
```

### Verificar contexto
```bash
/context
```

### Trocar modelo
```bash
/model opus    # decisões críticas, arquitetura
/model sonnet  # trabalho padrão (default)
/model haiku   # triagem, renaming, formatação
```

### Pipeline completo (novo projeto)
```bash
/full-auto-pipeline <descrição da task>
# ou manualmente:
/planner <task>
/prompt-initializer
/auto-execute-prompt
```

---

## 8. AUTO MODEL ROUTING (Opção C+B Recomendada)

**Objetivo:** Após Planning → Aprovação → Prompt Gerado, sistema automaticamente escolhe e executa com o modelo correto.

### Critério de roteamento

| Modelo | Casos típicos |
|---|---|
| **opus** | arquitetura, integrações complexas, segurança, lógica de negócio crítica, multi-tenancy, decisões irreversíveis |
| **sonnet** | services, controllers, repositories, testes, endpoints, refactors padrão |
| **haiku** | formatação, rename, docblock, fixes triviais (1-3 linhas), queries simples |

### Workflow C+B

```
1. /planner <task>
   └→ Gera plano com ## Recommended Execution Model

2. Usuário aprova plano

3. /prompt-initializer
   └→ Cria .claude/local/prompts/[domain]/task-[slug]-[date].prompt.md

4. /auto-execute-prompt
   └→ Lê plano + extrai modelo recomendado + executa com modelo correto
```

### Seção obrigatória no plano

```markdown
## Recommended Execution Model
- **Model:** opus | sonnet | haiku
- **Reason:** [por que este modelo é o correto para esta task]
```

---

## 9. TOKEN_OPERATIONS Framework

### Regras de economia (TL;DR)

| Regra | Economia estimada |
|-------|---------|
| Model routing | 70% em tasks triviais |
| Amostrar dados | 5-10x redução |
| Linkar schema | 10-50x por prompt |
| Prompt chaining | 5-8x multi-fase |
| CoT com citações | 5x verbosidade |

### Metas

- **Baseline típico:** ~40k tokens/sessão
- **Target:** ~25k tokens/sessão (38% redução)
- **Custo estimado:** /home/luizescobal/.claude/skills/context-framework-installer/install.sh.12 → /home/luizescobal/.claude/skills/context-framework-installer/install.sh.05/sessão

---

## 10. PIPELINE DE SKILLS ORQUESTRADO (`/full-auto-pipeline`)

**Objetivo:** Encadear `/planner` → `/prompt-initializer` → `/auto-execute-prompt` numa única invocação.

### Fluxo Completo

```
User: /full-auto-pipeline <descrição da task>
        │
        ├─ Step 1: /planner
        │     └→ Decompõe task, mapeia skills, salva plano em
        │         .claude/local/plans/[slug]-[YYYY-MM-DD].md
        │         com seção obrigatória ## Recommended Execution Model
        │     └→ [PAUSA] Apresenta plano, aguarda aprovação
        │
        ├─ Step 2: /prompt-initializer
        │     └→ Gera .claude/local/prompts/[module]/task-[slug]-[date].prompt.md
        │
        └─ Step 3: /auto-execute-prompt
              └→ Localiza plano + prompt, extrai modelo, executa
```

### Quando Usar vs. Alternativas

| Cenário | Skill correta |
|---|---|
| Task nova, fluxo completo | `/full-auto-pipeline` |
| Plano existe, prompt não | `/prompt-initializer` → `/auto-execute-prompt` |
| Plano + prompt existem | `/auto-execute-prompt` |
| Task trivial (1-3 linhas) | `/execute-prompt` direto com `model=haiku` |

