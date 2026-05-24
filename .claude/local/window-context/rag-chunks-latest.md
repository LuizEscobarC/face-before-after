# RAG Chunks — última recuperação
**Timestamp:** 2026-05-24 05:58:18  |  **Project:** neo-backend  |  **Query:** leia a skill global de harvest para contexto e planeje uma para o face-berfore-after, lembrando que temos muitos dados n

[1] (score=0.81) (source=edited-file)
- Após migrações de schema
- Após criar/renomear/remover entidades de domínio (Models, Services, Repositories, Handlers, …)
- Após adicionar fontes de dados novas (buckets, índices, coleções)
- Antes de iniciar implementação em área nova — garante contexto fresco para o RAG

[2] (score=0.81) (source=edited-file)
---
name: context-harvester
triggers:
  - "harvest context"
  - "update AI context"
  - "atualizar contexto"
  - "gerar contexto do projeto"
description: "Stack-agnostic harvester de contexto para RAG/LLM. Regenera arquivos de contexto em .claude/local/context/ do projeto atual (cwd-relative), detectando o stack a partir de manifestos. Só roda os passos que fazem sentido para o stack detectado (schema DB, business logic, queries) e sempre em modo read-only. Output path = `$PROJECT_ROOT/.claude/local/context/` (configurável via OUTPUT_PATH)."
tags: ["context", "ai", "rag", "harvest", "read-only"]
---

[3] (score=0.81) (source=edited-file)
Após editar:
```bash
# 1. Sintaxe YAML no frontmatter template — olhar visualmente
# 2. Grep para garantir que os 4 campos estão presentes
grep -n "depends_on\|used_by\|doc_type.*table\|rag-map\|ingest-project" \
  ~/.claude/skills/domain-context-updater/SKILL.md

[4] (score=0.80) (source=edited-file)
```bash
# Genérico — detecta stack e roda só o que se aplica
just harvest-context           # se o projeto tem recipe
# ou diretamente o script orquestrador, se existir
npx tsx scripts/context/harvest-context.ts
```

[5] (score=0.80) (source=edited-file)
Cada repo tem seu próprio `settings.json` com o hook apontando para seu slug. Usar o `context-framework-installer --with-rag --rag-project <slug>` em cada repo individualmente. Esta skill foca em detectar e configurar **um** repo de cada vez.

[6] (score=0.81) (source=edited-file)
- Antes de implementar endpoint que toca regras de negócio existentes
- Para documentar lógica oculta em magic numbers / status enum
- Para gerar contexto RAG específico do módulo
- Após o harvest gerar/atualizar `golden-queries.md`

[7] (score=0.81) (source=code-php, module=energy, class=BasePeriodStrategy, method=postProcessEquipment)
// class BasePeriodStrategy
/**
     * Pós-processa equipamento (implementação padrão)
     *
     * A maioria das estratégias não precisa fazer nada especial
     */

    public function postProcessEquipment(
        mixed $equipment,
        mixed $setup,
        mixed $dataVariation
    ): mixed {
        return $equipment;
    }

    /**
     * Agrupa dados de acordo com atributos binários de forma intercalada
     *
     * Ex: se o atributo 'instalacao_aberta' do primeiro elemento da collection for '0' até mudar para '1' vai armazenar em uma collection,
     * quando mudar para '1' armazena em outra collectio e assim sucessivamente
     */

[8] (score=0.80) (source=edited-file)
Se a task cria estrutura nova:
1. Procurar skill de scaffold no projeto (`*-module-architect`, `register-domain`, etc.)
2. Se existir: invocar e aguardar aprovação do usuário antes de criar arquivos
3. Se não existir: propor estrutura inline e aguardar aprovação

[9] (score=0.80) (source=edited-file)
Se houver skill `search-docs`, `ask-rag` ou MCP de RAG disponível, usar com 2–3 queries antes de escrever código.

[10] (score=0.80) (source=edited-file)
**Onde:** após o bloco YAML do frontmatter (§"Frontmatter opcional"), antes de "Cross-refs".

[11] (score=0.80) (source=edited-file)
Frontmatter válido **não é suficiente**. A skill emite metadata correta; a **qualidade do retrieval** depende de 7 fatores adicionais. As regras abaixo são genéricas — só aplique as que fazem sentido para o pipeline RAG do projeto.

[12] (score=0.81) (source=md-docs)
## Regra de autoria

Toda skill nova que busca dados SQL DEVE usar `mcp__mysql-harvest-api__*` ou
`mcp__mysql-harvest-dados__*` e referenciar este doc.

[13] (score=0.80) (source=md-docs)
## Progressive Disclosure (princípio central)

Skills usam carregamento em 3 níveis para gerenciar contexto:

| Nível | Conteúdo | Tamanho típico | Quando carrega |
|-------|----------|----------------|----------------|
| 1. Metadata | `name` + `description` | ~100 palavras | **Sempre** em contexto |
| 2. SKILL.md body | Instruções principais | < 5.000 palavras | Quando a skill é triggada |
| 3. Recursos bundled | scripts, references, assets | Ilimitado | Sob demanda do Claude |

> **Regra de ouro:** mantenha o `SKILL.md` enxuto. Mova schemas, exemplos longos e docs detalhados para `references/`. Scripts ficam em `scripts/` (podem ser executados sem ler para contexto).

---

[14] (score=0.80) (source=md-docs)
### 2) Fazer backup opcional

```bash
cp -r .claude/local/skills /tmp/skills-backup-$(date +%Y%m%d)
```

[15] (score=0.80) (source=edited-file)
## Integração com outras skills
