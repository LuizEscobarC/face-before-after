---
name: domain-context-updater
description: "Stack-agnostic: cria ou atualiza documentação técnica em <repo>/.claude/local/context/[subsistema]/ após cada implementação. Grava SEMPRE no repositório onde a skill foi invocada (cwd do git), nunca em path global. Detecta a stack do projeto (Node/PHP/Go/Python/Rust/Java/qualquer) lendo CLAUDE.md, package.json/composer.json/go.mod/pyproject/Cargo.toml/build.gradle, e adapta o vocabulário. Quando houver um parser de frontmatter Obsidian no projeto (ex.: ai-first Fase 7), emite YAML frontmatter ingestionável por GraphRAG. Trigger on: 'update domain context', 'atualizar contexto', 'document the implementation', 'documentar mudanças', 'após implementação', 'after implementation'."
triggers:
  - "update domain context"
  - "atualizar contexto do domínio"
  - "atualizar contexto"
  - "document changes"
  - "documentar mudanças"
  - "after implementation"
  - "após implementação"
  - "update business rules"
  - "atualizar regras de negócio"
  - "update docs"
  - "atualizar documentação"
  - "domain-context-updater"
tags: ["documentation", "context", "post-implementation", "stack-agnostic", "obsidian-optional"]
---

# Domain Context Updater — versão global (stack-agnostic)

Cria ou atualiza documentação técnica de subsistemas do projeto. **Esta é a versão global** instalada em `~/.claude/skills/`. Quando um projeto tem uma versão local (`<repo>/.claude/local/skills/domain-context-updater/SKILL.md`), o **carregamento local prevalece** e esta global é ignorada — não conflitam.

A premissa central: **grave sempre no repositório onde a skill foi invocada**, nunca em path absoluto global. Use o `cwd` resolvido pelo `git rev-parse --show-toplevel`. Todo path nesta skill é **relativo à raiz do repo invocador**.

## Pré-condições — detectar o ambiente

Antes de qualquer escrita, **detecte**:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
test -n "$REPO_ROOT" || abort "Não está dentro de um git repo — a skill exige um repo."
```

Tudo a partir daqui é relativo a `$REPO_ROOT`. Se o usuário invocou a skill em `/home/x/proj-a/sub/`, `$REPO_ROOT` aponta para `/home/x/proj-a` — escreva lá.

### Detectar a stack do projeto

Leia esses arquivos da raiz (na ordem, parando no primeiro que existir):

| Arquivo | Stack inferida | Vocabulário a usar |
|---|---|---|
| `package.json` | Node/TypeScript/JavaScript | "services", "schemas", "routes", "modules" |
| `composer.json` | PHP (Laravel/Symfony/etc.) | "controllers", "services", "repositories", "models", "DTOs" |
| `go.mod` | Go | "packages", "handlers", "services" |
| `pyproject.toml` / `setup.py` / `requirements.txt` | Python (Django/Flask/FastAPI) | "views", "serializers", "services" |
| `Cargo.toml` | Rust | "crates", "modules", "handlers" |
| `build.gradle` / `pom.xml` | Java/Kotlin (Spring) | "controllers", "services", "repositories" |
| `Gemfile` | Ruby/Rails | "controllers", "models", "concerns" |
| `mix.exs` | Elixir | "contexts", "schemas", "controllers" |
| `Package.swift` | Swift | "modules", "protocols" |
| nenhum | Genérico | "modules", "components" |

Também **leia `CLAUDE.md` na raiz se existir** — ele frequentemente declara o stack, convenções, e regras (ex.: "TS strict", "ESM puro", "pint format", "PHPStan level 8"). Respeite essas convenções.

### Detectar suporte Obsidian/GraphRAG

Se existir `<repo>/src/ingest/frontmatterParser.ts` (ai-first) ou outro parser de frontmatter no projeto, **emita YAML frontmatter** em todo doc criado/atualizado — ver §"Frontmatter opcional". Sem esse parser, frontmatter é opcional (mas recomendado).

Heurística:
```bash
test -f "$REPO_ROOT/src/ingest/frontmatterParser.ts" \
  || test -f "$REPO_ROOT/scripts/validate-context-frontmatter.ts" \
  && SUPPORTS_OBSIDIAN=yes || SUPPORTS_OBSIDIAN=no
```

### Determinar `tenant_id` correto (crítico em monorepo)

Em monorepo configurado com `rag-project-setup`, existe `.claude/local/context/rag-map.md` mapeando `cwd → slug`. Usar o slug errado causa `MismatchedTenantError` na ingestão — o chunk não entra no Neo4j.

```bash
TENANT_ID=""
RAG_MAP="$REPO_ROOT/.claude/local/context/rag-map.md"

if [ -f "$RAG_MAP" ]; then
  # Subdir relativo atual (ex: "backend" se cwd for /projeto/backend/sub/)
  REL_SUBDIR="$(realpath --relative-to="$REPO_ROOT" "$(pwd)" | cut -d'/' -f1)"
  # Buscar slug do subdir na tabela do rag-map
  TENANT_ID="$(grep -oP "(?<=\| )[\w-]+(?=\s*\|\s*/${REL_SUBDIR}\b)" "$RAG_MAP" | head -1)"
  # Fallback: slug base (tenant_id do frontmatter do rag-map)
  [ -z "$TENANT_ID" ] && \
    TENANT_ID="$(grep -oP '(?<=tenant_id: )[\w-]+' "$RAG_MAP" | head -1)"
fi
# Fallback final: nome do repo
[ -z "$TENANT_ID" ] && \
  TENANT_ID="$(basename "$REPO_ROOT" | tr '[:upper:]' '[:lower:]' | tr '_.' '-')"
```

Se `rag-map.md` não existe e o projeto tem subpastas com código, advertir: "⚠ Execute `/rag-project-setup` antes de ingestar para gerar o mapa de slugs correto."

## Onde gravar

**Sempre dentro de `$REPO_ROOT`. Nunca em path global.**

Estrutura padrão por subsistema:

```
$REPO_ROOT/.claude/local/context/[subsistema]/
├── 00-index.md
├── 01-architecture.md
├── 02-decisions.md       # ADRs (decisões + razões + alternativas descartadas)
├── 03-flows.md           # sequências end-to-end
├── 04-config.md          # env vars, flags, defaults
├── 05-schemas.md         # contratos de tipos / DTOs / interfaces
├── 06-troubleshooting.md
└── 99-changelog.md       # 1 linha por PR, mais recente primeiro
```

Para domínios **business-heavy** (regras de negócio densas, fórmulas, warning codes — típico em Laravel/Energy/Banking), use a estrutura estendida:

```
$REPO_ROOT/context/[domain]/                # quando o projeto já tem essa raiz
├── 00-index.md
├── 01-architecture.md
├── 03-calculations.md       # fórmulas
├── 04-data-sources.md       # tabelas, colunas, conexões DB
├── 05-warnings.md           # códigos, severidade, quando dispara
├── 06-report-structure.md   # DTOs / JSON output
└── ...
```

**Decisão de qual estrutura usar:**
- Se `$REPO_ROOT/context/` já existe e tem subpastas: estenda esse formato (legacy).
- Se `$REPO_ROOT/.claude/local/context/` já existe: estenda esse.
- Senão: crie `$REPO_ROOT/.claude/local/context/` (default moderno).

E também: cálculos detalhados (proofs, gaps) vão em **`$REPO_ROOT/.claude/local/docs/calcs/[domain]/[sub-domain]/`** quando aplicável.

## `_meta/00-index.md` — Índice mestre (OBRIGATÓRIO)

Toda raiz `.claude/local/context/` (ou `context/`) DEVE ter uma pasta `_meta/` com um `00-index.md` que **lista todos os subsistemas documentados + os ainda não cobertos**. É a porta de entrada que Claude carrega em sessões futuras antes de qualquer subsystem-doc.

**Quando criar:**
- Na primeira invocação da skill em um projeto: criar `_meta/00-index.md` ANTES do primeiro subsistema.
- Em toda invocação subsequente: **atualizar** quando criar/renomear/remover um subsistema, ou bumpar `updated_at` quando mudar status de algum.

**Estrutura mínima:**

```markdown
[frontmatter se SUPPORTS_OBSIDIAN=yes — module: "_meta/index", doc_type: "concept"]

# `.claude/local/context/` — Índice Mestre

Documentação técnica interna do <projeto> organizada por **subsistema**. Cada pasta cobre um componente com seu próprio `00-index.md`. Esta é a fonte de contexto que Claude carrega em sessões futuras (complementar a `CLAUDE.md` que é human-facing).

## Subsistemas

| Subsistema | Pasta | Cobertura | Status |
|---|---|---|---|
| **<nome>** | [[<nome>/index]] | <1 linha do escopo> | <estável \| em evolução \| experimental \| a criar conforme demanda> |
| **<outro>** | _(a criar conforme demanda)_ | <escopo previsto> | — |

## Regra de evolução

Pastas são criadas **on-demand** pela skill `domain-context-updater` ao tocar o subsistema pela primeira vez. Não criar pastas vazias.

## Não confundir

- `.claude/local/context/` — contexto interno para Claude em sessões futuras.
- `docs/` (raiz do repo) — documentação human-facing (deploy, infra, planos).
- `CLAUDE.md` — entrada principal (regras de stack, convenções, hooks).
```

**Regras de manutenção:**
- Listar subsistemas **previstos mas não criados** como `_(a criar conforme demanda)_` — serve de mapa do território.
- Quando criar um subsistema novo: trocar a linha `_(a criar conforme demanda)_` por `[[<nome>/index]]` + status real.
- Bump `version` (semver) quando reorganizar a tabela (adicionar/remover linha), não em cada update de status.
- `updated_at` bumpado em toda invocação que tocou a tabela.

**Anti-pattern:** invocar a skill, criar subsistema novo, e esquecer de registrar no `_meta/00-index.md`. O subsistema vira invisível para Claude em sessões futuras (a menos que o caller leia o filesystem inteiro, o que não é o padrão).

## Frontmatter opcional (quando `SUPPORTS_OBSIDIAN=yes`)

Todo arquivo gerado começa com YAML:

```yaml
---
tenant_id: "<slug do projeto, igual ao INGEST_PROJECT ou nome do repo>"
project: "<mesmo valor>"
module: "[subsistema]/[basename-sem-extensão-e-sem-prefixo-numérico]"
file_path: ".claude/local/context/[subsistema]/[arquivo].md"  # path desde $REPO_ROOT
doc_type: "code | architecture | decision | api | schema | concept"
author: "<git config user.name>"
created_at: "YYYY-MM-DD"
updated_at: "YYYY-MM-DD"
version: "1.0.0"
summary_context: >
  2-3 frases factuais: o que esse doc descreve, qual subsistema cobre, qual
  problema os componentes resolvem.
tags:
  - "[subsistema]"
  - "<categoria>"
rag_keywords:
  - "<sinônimos e jargão que NÃO aparecem literalmente no texto>"
related_modules:
  - "<módulo lateral relacionado — aresta :RELATED_TO>"
depends_on:
  - "<módulo que ESTE componente consome — aresta :DEPENDS_ON>"
used_by:
  - "<módulo que consome ESTE componente — aresta :USED_BY>"
---
```

Quando `SUPPORTS_OBSIDIAN=no`, omita o frontmatter — apenas a estrutura Markdown.

### Escolha do `doc_type`

| `doc_type` | Quando usar | Exemplos típicos |
|---|---|---|
| `architecture` | Visão geral de subsistema, como componentes se encaixam, fluxo principal | `01-architecture.md`, ADR de alto nível |
| `decision` | Decisão técnica específica com alternativas descartadas e razão | `02-decisions.md`, ADRs individuais |
| `api` | Contratos de endpoint (route, method, body, response, auth) | docs de `/api/rag`, `/api/memory/*` |
| `schema` | Tipos, interfaces, Zod schemas, DTOs, enums — sem lógica de negócio | `05-schemas.md`, `ObsidianFrontmatterSchema` |
| `concept` | Explicação de conceito do domínio sem amarrar a componente específico | "O que é RAPTOR", "Como funciona BM25" |
| `code` | Referência direta a implementação — raramente; prefira `architecture` | Apenas quando o doc descreve código linha a linha |

**Regra de desempate:** se o doc menciona componentes reais do código (classes, funções, env vars) → `architecture`. Se é explicação pura de conceito sem amarrar a implementação → `concept`. O `doc_type` é filtro real em `/api/rag` via `MetadataFiltersSchema` — classificar corretamente permite buscas cirúrgicas por tipo.

Cross-refs:
- **Entre docs de `.claude/local/context/`**: use `[[modulo/nome]]` se o projeto tem parser de wikilinks; senão, Markdown links normais (`[texto](path/relativo.md)`).
- **Para código**: sempre Markdown links com path relativo a `$REPO_ROOT` (ex.: `[src/foo.ts](../../../../src/foo.ts)`).

**Profundidade de `../` (erro fácil de cometer):**

| Doc em… | Para `src/foo.ts` | Para outro doc do mesmo subsistema | Para `.claude/local/docs/` |
|---|---|---|---|
| `.claude/local/context/[sub]/01.md` | `../../../../src/foo.ts` (4) | `02.md` (mesma pasta) | `../../docs/...` |
| `.claude/local/context/[sub]/sub2/X.md` | `../../../../../src/foo.ts` (5) | `../01.md` | `../../../docs/...` |
| `context/[sub]/01.md` (legacy raiz) | `../../src/foo.ts` (2) | `02.md` | `../../.claude/local/docs/...` |

Conta os `/` do path do doc até `$REPO_ROOT` — esse é o número de `../`.

## Quando usar

Invocar **ao final de qualquer implementação** que afete:

- Regra de negócio, fórmula de cálculo, ou pipeline de transformação.
- Fonte de dados (nova tabela, query alterada, schema novo).
- Códigos de warning / severity / error mapping.
- DTO / interface / schema de contrato (Zod, Pydantic, GraphQL SDL, Protobuf).
- Endpoint público ou interno (rota Fastify/Express/Symfony/FastAPI/Spring/etc.).
- Algoritmo de retrieval, ingestão, ou inferência.
- Configuração de modelo LLM, fallback chain, kill switches.
- Decisões arquiteturais novas que mudam contrato ou comportamento.

**NÃO invocar para:**
- Correções de typo, rename interno sem mudança de API pública.
- Refactor puro sem mudança de comportamento observável.
- Edits em docs/ existentes que NÃO refletem mudança de código.

## Workflow

### Step 1 — Resolver contexto

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
```

Leia `CLAUDE.md` E `AGENTS.md` (qualquer um que exista — alguns projetos têm os dois) para entender convenções, vocabulário e regras específicas. Detecte a stack pelos arquivos descritos em §"Detectar a stack".

### Step 1.5 — Garantir `_meta/00-index.md`

Antes de tocar qualquer subsistema:

```bash
META_INDEX="$REPO_ROOT/.claude/local/context/_meta/00-index.md"
test -f "$META_INDEX" || CREATE_META=yes
```

Se `CREATE_META=yes`, **crie agora** seguindo o template da §"`_meta/00-index.md` — Índice mestre". Sem essa pasta, subsistemas que você criar viram invisíveis para Claude em sessões futuras. É a porta de entrada.

Se já existe, mantenha aberto — você vai atualizá-lo no Step 3 quando criar/renomear subsistema.

### Step 2 — Descobrir o que mudou e identificar subsistemas tocados

Primeiro descubra **quais arquivos** mudaram. Escolha a fonte de acordo com a invocação:

```bash
TODAY="$(date +%Y-%m-%d)"

# A. Sessão atual / pré-commit (mudanças não commitadas)
git status --porcelain
git diff --name-only

# B. PR / branch vs main (escopo de revisão típico)
git diff --name-only "$(git merge-base HEAD main 2>/dev/null || echo HEAD)" HEAD

# C. Últimos N commits ("documenta o que rolou hoje/essa semana")
git diff --name-only HEAD~5 HEAD

# D. Vazio em A/B/C + pedido genérico ("ajuste/revise todas as docs"): MODO AUDITORIA (Step 2.5).
```

**Como escolher A vs B vs C:** se o usuário invocou logo após terminar uma implementação, A. Se está fechando PR, B. Se pediu "documenta os últimos commits", C.

Depois, mapeie cada arquivo para subsistema, na ordem:

1. **Se o projeto já tem `.claude/local/context/[subsistema]/`**, encaixe ali.
2. **Senão, se CLAUDE.md / AGENTS.md declara subsistemas**, use os declarados.
3. **Senão, derive do path**: `src/services/Foo.ts` → `services`; `app/Modules/Energy/` → `energy`; `internal/billing/` → `billing`.

Um PR pode tocar múltiplos subsistemas — gere updates para cada um, mas mantenha cada doc focado em um só.

### Step 2.5 — Modo AUDITORIA (sem diff)

Acionado quando Step 2 não retorna arquivos E o usuário pediu update genérico ("revise", "ajuste todas as docs", "atualize o contexto"). Workflow diferente: você está procurando **drift** entre docs existentes e o código atual.

1. **Listar subsistemas documentados**: `ls .claude/local/context/*/` (ou `context/*/` se for o legacy).
2. **Para cada subsistema**, abrir `00-index.md` + `01-architecture.md` e extrair toda referência a código (`src/...`, classes, funções, env vars).
3. **Validar cada referência com `grep`**: o arquivo/símbolo ainda existe? Mudou de path? Função foi renomeada?
4. **Listar drift encontrado** antes de editar — apresentar ao usuário um resumo curto ("3 subsistemas OK; `foo/01-architecture.md` cita `OldService` que não existe mais; `bar/04-config.md` lista env var removida"). Edita só os drifted.
5. **Identificar lacunas**: subsistema novo no código (pasta `src/X/` substancial) sem doc correspondente? Listar como "criar conforme demanda" ou criar agora se for material.

Em modo auditoria, **não** force entries de changelog ("revisão de auditoria sem mudança de comportamento" raramente merece linha). Bumpe `updated_at` só nos arquivos que realmente mudou.

### Step 3 — Para cada subsistema tocado

1. **`Read` o arquivo antes de editar.** Sem isso você sobrescreve contexto que já existe. Edits cirúrgicos sempre que possível.
2. **Verifique se a pasta existe**: `[base]/[subsistema]/`. Se não, crie.
3. **Atualize `00-index.md`** (cria se não existir): overview do subsistema + tabela de docs.
4. **Atualize os arquivos relevantes** (01-architecture, 02-decisions, etc.) — não crie sem necessidade. Ver "Onde gravar decisões" abaixo.
5. **Sempre atualize `99-changelog.md`** (exceto modo auditoria sem drift): uma linha datada.
6. **Se `SUPPORTS_OBSIDIAN=yes`**: bump `updated_at` em todo arquivo editado; emita frontmatter em arquivos novos.
7. **Atualize `_meta/00-index.md`**: se subsistema é novo, troque a linha `_(a criar conforme demanda)_` por `[[subsistema/index]]` + status; se já listado, ajuste status se mudou. Sempre bump `updated_at` do meta.

**Onde gravar decisões (01 vs 02):**
- 1 decisão isolada que cabe em 2–4 linhas → seção `## Decisões relevantes` em `01-architecture.md`.
- 3+ decisões OU alternativas descartadas detalhadas OU ADRs por nome (D1, D2, …) → arquivo `02-decisions.md` (1 decisão = 1 `##`).
- Quando uma decisão em 01 cresce além de ~6 linhas, migre para 02 e deixe um stub em 01 com link.

### Step 4 — Migração de docs antigos sem frontmatter (quando Obsidian é suportado)

Quando atualizar um arquivo que **já existe sem frontmatter** num projeto com `SUPPORTS_OBSIDIAN=yes`:

1. Insira o bloco YAML no topo (antes do `# Heading`).
2. Infira `module` a partir do path (`[subsistema]/[basename-sem-prefixo-numérico]`).
3. Preencha `summary_context` lendo o conteúdo real — não inventar.
4. `created_at`: tente `git log --diff-filter=A --format=%aI -- <arquivo> | tail -1 | cut -dT -f1`; fallback = hoje.
5. `tags` + `rag_keywords`: extraídas do conteúdo (auditável); não inventar.
6. Idempotência: se o arquivo já começa com `---`, apenas bumpe `updated_at`.

### Step 5 — Estrutura mínima de um doc novo

```markdown
[YAML frontmatter se SUPPORTS_OBSIDIAN=yes — senão, pular]

# [Subsistema] — [Título]

> **Última atualização:** YYYY-MM-DD por [PR ou tarefa]
> **Status:** estável | em evolução | experimental

## Visão geral

[1-2 parágrafos: o que esse subsistema/componente faz, por que existe]

## Componentes

| Componente | Arquivo | Responsabilidade |
|---|---|---|
| ... | [src/...](../../../src/...) | ... |

## Fluxo principal

[Sequência: input → componentes → output]

## Decisões relevantes

[Por que essa abordagem e não outra — quando aplicável]

## Pontos de extensão

[Onde adicionar novas features sem quebrar o existente]

## Não-objetivos

[O que esse subsistema explicitamente NÃO faz]
```

### Step 6 — `99-changelog.md` (sempre atualizar)

```markdown
# [Subsistema] — Changelog

- **YYYY-MM-DD** — Resumo curto. Ver [link-doc-novo-ou-atualizado] ou PR #NN.
- **YYYY-MM-DD** — ...
```

### Step 7 — Self-check antes de finalizar

- [ ] Todo arquivo está dentro de `$REPO_ROOT` — nenhum path global escrito.
- [ ] (Se Obsidian) Todo arquivo tocado tem frontmatter válido com `tenant_id`, `module`, `doc_type`, `summary_context`.
- [ ] `updated_at` bumpado para hoje em todo arquivo editado.
- [ ] `summary_context` factual (não placeholder).
- [ ] Toda classe/função/env citada existe no código (`grep` para validar).
- [ ] **Strings de `direction` verificadas no fonte** — ler a função `_*_direction()` ou equivalente e confirmar o valor string literal retornado. Não inferir pelo nome da métrica (ex.: `"scleral_show"` ≠ `"visible"`).
- [ ] **Stubs documentados como stubs** — se `compute()` retorna sempre `value=0.0, confidence_raw=0.0, direction="not_computed"`: abrir o `##` com `**STUB — não computado.**` e explicar o motivo técnico. Não descrever fórmula teórica como se estivesse implementada.
- [ ] **Fórmulas com citação de linha** — todo bloco de código/fórmula no doc deve citar `arquivo:linha` da implementação real. Se não for localizável, usar prosa descritiva em vez de pseudo-código inventado.
- [ ] **Audit pass se doc gerado por subagente** — quando o doc foi gerado por LLM/agente (não pelo humano lendo o código diretamente): verificar as 3-5 afirmações mais específicas (dep lm, formulas, ideal values, directions) com `grep` no fonte antes de ingestar.
- [ ] Links Markdown apontam para arquivos existentes (paths relativos a partir do doc).
- [ ] `99-changelog.md` tem uma entrada nova com a data de hoje.
- [ ] `00-index.md` está atualizado se algum arquivo foi criado.
- [ ] `_meta/00-index.md` existe e lista o subsistema (entrada real, não `_(a criar conforme demanda)_` quando a pasta já foi criada).
- [ ] Li (`Read`) cada arquivo antes de editar — não sobrescrevi cegamente.
- [ ] Se existe validator de frontmatter no projeto (`scripts/validate-context-frontmatter.ts`, `npm run validate:context`, `composer ai:validate-docs`, etc.), rodei e passou.
- [ ] Profundidade dos `../` em Markdown links confere com o nível do doc (ver tabela em "Profundidade de `../`").
- [ ] Vocabulário coerente com a stack detectada (ex.: não escrever "Eloquent" em projeto Go).
- [ ] Quality gates do projeto continuam passando (lint, build) — esta skill **não** muda código.
- [ ] `tenant_id` no frontmatter bate com o slug do `rag-map.md` para o subprojeto atual (ou `INGEST_PROJECT` se não há rag-map). Slug errado → `MismatchedTenantError`, chunk não entra no Neo4j.
- [ ] Se projeto parece monorepo e `rag-map.md` não existe: avisar para executar `/rag-project-setup` antes de ingestar.

## Estilo

- **Idioma:** combine com `CLAUDE.md` do projeto. Se o repo escreve em inglês, use inglês. Se em português, use português. Não misture.
- **Conciso:** cada arquivo idealmente 80-200 linhas. Se passar disso, quebre em sub-temas.
- **Caminhos clicáveis:** `[arquivo](path/relativo.ext)` ou `[arquivo:linha](path#L42)`.
- **Tabelas para flags/env vars/decisões** — leitura rápida.
- **Não duplicar** `docs/` técnico — quando `docs/` já cobre, link cruzado.
- **Não inventar identificadores** — toda classe/função/env precisa existir.

## Como escrever para maximizar retrieval (stack-agnostic)

Frontmatter válido **não é suficiente**. A skill emite metadata correta; a **qualidade do retrieval** depende de 7 fatores adicionais. As regras abaixo são genéricas — só aplique as que fazem sentido para o pipeline RAG do projeto.

### 1. Discipline de headings — chunking por heading define a granularidade

A maioria dos pipelines RAG modernos quebra Markdown por `##`/`###` (chunk-by-heading). Um doc de 200 linhas com 1 `##` vira **1 chunk gigante** ruim para reranking. Com 8 `##`, vira 8 chunks coesos.

**Regra prática:**
- Cada `##` deve ser **auto-suficiente** — entendível sem ler outras seções.
- Aim 30-80 linhas por seção `##`. Quando passar de ~100, quebre em `###` ou em outro doc.
- Cabeçalho deve ser **descritivo do conteúdo** (`## Fórmula BM25`, não `## Implementação`).
- Body imediatamente abaixo do heading deve repetir o conceito-chave em prosa (alguns chunkers carregam o heading para o chunk, outros não; redundância barata aqui paga em recall).

**Como saber a estratégia do projeto:** olhe `scripts/ingest-*.ts` (Node), `app/Services/Ingestion/*` (Laravel), `pkg/ingest/*.go` (Go), etc. Procure por `splitByHeading`, `chunkByHeading`, `MarkdownTextSplitter`, `recursive_character_text_splitter`.

### 2. `summary_context` deve ser denso, factual, com nomes próprios

Muitos pipelines RAG usam o `summary_context` (ou campo equivalente: `description`, `abstract`) como **prefixo no embed** de cada chunk (técnica conhecida como Contextual Retrieval, padronizada pela Anthropic em 2024).

**Independente do pipeline, escreva como se essa frase viajasse com cada chunk:**
- Densidade: "X é Y que resolve Z porque W" — específico, não genérico.
- **Ruim:** "Documento sobre arquitetura do módulo X."
- **Bom:** "Módulo X implementa fallback chain de LLMs com cache Redis para evitar repetir chamadas idênticas — resolve duplicação custosa quando users fazem queries similares em sequência."
- 2-3 frases, ~30-50 palavras.
- Use nomes próprios reais (classes, env vars, scripts) — eles ancoram a busca.

### 3. `rag_keywords` é dicionário de jargão, não sinônimos genéricos

Em pipelines com BM25 / sparse retrieval / vocab expansion (ex.: SIRA, Anserini, Elastic), os termos do `rag_keywords` típicamente entram no vetor sparse com **peso reduzido + filtro DF** (descarta termos que aparecem em mais de N% do corpus).

**Termos genéricos são DESCARTADOS pelo filtro DF.** Não desperdice slot.

**Bom (jargão de domínio + traduções + acronyms):**
- `"BM25 Okapi"` — nome próprio do algoritmo
- `"lexical retrieval"` — termo técnico EN
- `"recuperação lexical"` — tradução PT
- `"K1 saturation parameter"` — parâmetro específico
- `"AAA accounting authorization authentication"` — acronym expansion

**Ruim (genérico — será filtrado por DF):**
- `"function"`, `"service"`, `"query"`, `"code"` — aparecem em quase tudo, IDF baixo.

Aim 4-8 termos. Foque em: nomes próprios de algoritmos, acronyms expandidas, traduções inglês↔português, jargão de domínio que NÃO aparece no texto do doc.

### 4. Wikilinks (quando o projeto suporta) — use expansivamente

Se o projeto resolve `[[wikilinks]]` durante ingestão (ex.: criando arestas `:LINKS_TO` em grafo), use-os agressivamente. Cada wikilink vira aresta no grafo, e GraphRAG / GraphRetrieval usa essas arestas para expandir vizinhança.

**Convenções genéricas:**
- Para outros docs do mesmo subsistema: `[[subsistema/conceito]]`
- Para docs de outro subsistema: `[[outro-subsistema/conceito]]`
- Para arquivos de código: **NÃO** use wikilink. Use Markdown link com path relativo: `[src/foo.ts](../../../src/foo.ts)`.

Se o projeto NÃO suporta wikilinks (sem `SUPPORTS_OBSIDIAN`), use Markdown links normais para tudo.

### 5. Política de `:Module` — três campos, três tipos de aresta no grafo

Cada campo cria um tipo diferente de aresta no Neo4j, atravessada pelo GraphRAG. Escolher o campo correto define quais caminhos o grafo pode navegar.

| Campo | Aresta criada | Semântica | Exemplo |
|---|---|---|---|
| `related_modules` | `:RELATED_TO` (simétrica) | "esses módulos são lateralmente relacionados" | doc de `rag` → `related_modules: [retrieval]` |
| `depends_on` | `:DEPENDS_ON` (direcional) | "ESTE módulo consome X" | doc de `AdvancedRetrievalService` → `depends_on: [Neo4jService, RerankerService]` |
| `used_by` | `:USED_BY` (direcional inverso) | "ESTE módulo é consumido por Y" | doc de `EmbeddingService` → `used_by: [Neo4jService, HyDEService]` |

**Regra prática:**
- Se A chama B: doc de A tem `depends_on: [B]`; doc de B tem `used_by: [A]`.
- Não declarar nos dois lados ao mesmo tempo — escolher o lado mais útil para o traversal que quer suportar.
- `related_modules` para relações sem direção clara (dois subsistemas que se referem mutuamente sem hierarquia).

**Para cruzar docs e código no grafo:**
```yaml
related_modules:
  - "subsistema"   # módulo grosso do código → aresta :RELATED_TO
```

Sem essa declaração, doc e código vivem em universos paralelos no grafo. Decisão consciente.

### 6. Arquivos pobres para retrieval — considere excluir do ingest

Nem todo doc agrega ao RAG. Candidatos típicos a exclusão:
- **Changelogs** (`99-changelog.md`, `CHANGELOG.md`): bullets de data, baixa densidade semântica.
- **Docs com >70% tabelas**: chunks viram texto truncado sem contexto narrativo.
- **Index puros** que só listam filhos sem narrativa.

A decisão é por subsistema. Para changelogs que **citam PRs por nome** (Conventional Commits, semantic-release), mantenha — eles dão contexto histórico útil. Para changelogs auto-gerados sem narrativa, pode valer skip.

### 7. Smoke de ingestão é parte da definição de pronto

Validators de YAML (`npm run validate:context`, `composer ai:validate-docs`, etc.) confirmam **estrutura do frontmatter**. **Não confirmam que a ingestão funcionou** contra o vector store real.

Antes de marcar a task como concluída, rode o ingest do subsistema tocado e verifique:
- Quantos chunks foram criados? (Heurística: ~3 chunks por arquivo em docs bem-estruturados.)
- O grafo cresceu? (Se o projeto tem grafo de módulos.)
- Quantos wikilinks foram resolvidos? (Se o projeto tem `:LINKS_TO`.)

**Comando de ingestão (verificar qual existe, nesta ordem de preferência):**

```bash
# 1. Primário — script gerado por /rag-project-setup (se existir)
bash .claude/local/scripts/ingest-project.sh <slug-do-subprojeto>
# O <slug> DEVE bater com o tenant_id do frontmatter dos docs criados
# Slug errado → MismatchedTenantError, chunk não entra no Neo4j

# 2. Alternativa direta (ai-first Node):
INGEST_PROJECT=<slug> npx tsx $AI_FIRST_DIR/scripts/ingest-md.ts <pasta>

# 3. Outros projetos: ver package.json/composer.json/Makefile para o equivalente
```

Verificar saída: "N chunks criados", "M nodes", "K edges resolvidos".

Se o número de chunks for muito menor que `arquivos × 3`, provavelmente os docs estão sem `##` suficientes — volte ao Step 1 (heading discipline).

### 8. Stubs, métricas deferidas e fórmulas — regras de precisão

Estas regras previnem os erros mais comuns em docs de calculadoras/métricas e qualquer código que retorna valores computados.

**Stubs devem ser declarados explicitamente:**

Se uma função `compute()` retorna sempre `value=0.0, confidence_raw=0.0` (ou equivalente) sem calcular nada real, o `##` heading do doc deve abrir com:

> **STUB — não computado.** [razão técnica — ex: requer vista lateral, pixel analysis pendente DEC-10]

Não descrever a fórmula teórica como se estivesse implementada. O leitor deve saber imediatamente que o número retornado é um placeholder, não um resultado real.

**Strings de `direction` — verificar o literal, não inferir:**

Funções de direção retornam strings arbitrárias definidas no código. `"scleral_show"`, `"not_computed"`, `"fox_eye"` são comuns — e diferentes do que você esperaria pelo nome da métrica. Regra:

```bash
# Antes de escrever directions: no arquivo de métricas, grep pela função direction
grep -n "_direction\|direction=" backend/app/services/metrics/foo.py
# Leia os valores string literais retornados — não suponha
```

**Fórmulas precisam de âncora de linha:**

```markdown
# Correto:
# Arquivo: `backend/app/.../foo.py:~167`
value = axis_x + t × (menton_x − tip_x)

# Errado:
deviation = mean(lip_upper_distance_to_e_line, lip_lower_distance_to_e_line)
# (inventado — parece plausível mas não existe no código)
```

Se a fórmula não for localizável por `grep`, use prosa descritiva ("mede o desvio lateral em ICU") em vez de pseudo-código.

**Docs gerados por subagente exigem audit pass:**

Quando o doc foi gerado por LLM/agente (não pelo humano lendo diretamente), executar antes de ingestar:

1. Identificar as 3-5 afirmações mais específicas do doc (dep lm, formulas, ideal values, directions, nomes de constantes).
2. Grep cada uma no fonte: `grep -n "scleral_show\|_IDEAL_SCLERAL\|lm 145" arquivo.py`
3. Corrigir discrepâncias encontradas.

Custo: ~5 min por arquivo. Evita erros factuais persistentes no RAG que contaminam respostas futuras.

## Anti-patterns

| Anti-pattern | Correto |
|---|---|
| Escrever em `/home/<user>/...` ou path global | Sempre `$REPO_ROOT/.claude/local/context/...` ou `$REPO_ROOT/context/...` |
| Usar vocabulário Laravel em projeto Node | Detectar stack primeiro; usar termos da stack |
| Frontmatter obrigatório sem checar parser | Frontmatter só quando `SUPPORTS_OBSIDIAN=yes` |
| Documentar **só o diff** | Documentar o comportamento atual completo do componente tocado |
| "Adicionei X" sem dizer **o que X faz e por quê** | Comportamento + razão |
| Copiar trechos grandes de código | Linkar para `arquivo:linha`; explicar contrato e invariantes |
| Misturar `README.md` da raiz com `.claude/local/context/` | README é externo (humanos); context é interno (sessões de Claude futuras) |
| Criar pastas vazias "para o futuro" | Criar só o que a implementação atual exige |

## Integração com outras skills

Esta skill geralmente roda **depois** de:

- Skills de implementação genéricas (qualquer feature-implementer, bug-diagnostician).
- `math-proof` (quando aplicável) — sincronizar `03-calculations.md` + `.claude/local/docs/calcs/[domain]/[sub-domain]/calcs.md` e `gaps.md`.
- Skills específicas do stack do projeto (Laravel: `laravel-feature-implementer`, `laravel-bug-diagnostician`; Node: `feature-implementer`, etc.).

Pode rodar **antes** de:

- `notebooklm-context-generator` (consume estes docs).
- Commit/PR (docs entram junto da mudança que descrevem).

## Convivência com skill local

Se o projeto tem `$REPO_ROOT/.claude/local/skills/domain-context-updater/SKILL.md`, **essa versão local prevalece**. Esta global serve para:
- Projetos sem skill local (default sensato).
- Bootstrapping um projeto novo — depois pode-se criar uma versão local mais específica.

Quando a versão local existe, **não há conflito**: o carregamento do Claude prefere o local-scoped definido em `.claude/skills/` do repo.
