# RAG Chunks — última recuperação
**Timestamp:** 2026-05-24 05:37:26  |  **Project:** neo-backend  |  **Query:** agora, com base na sessão, como podemos iriquecer a skill generica de documentação para o rag?

[1] (score=0.80) (source=edited-file)
A skill `domain-context-updater` (~/.claude/skills/domain-context-updater/SKILL.md) é a responsável por gerar documentação técnica ingestável pelo ai-first RAG. Ela já está madura em estrutura de arquivos, frontmatter base e guias de retrieval. Porém, após análise do pipeline real (`frontmatterParser.ts`, `GraphRAGService.ts`, `rag.ts`), foram identificados 4 gaps que deixam valor na mesa:

[2] (score=0.79) (source=edited-file)
Se houver skill `search-docs`, `ask-rag` ou MCP de RAG disponível, usar com 2–3 queries antes de escrever código.

[3] (score=0.80) (source=edited-file)
**Project: ai-first (Node/TS RAG)** — task "Add new metadata filter to /api/rag"
Skills available: `prompt-initializer`, `execute-prompt`, `commit-suggester`, `domain-context-updater`.

[4] (score=0.79) (source=edited-file)
A skill `domain-context-updater` (`~/.claude/skills/domain-context-updater/SKILL.md`) gera documentação técnica ingestável pelo pipeline RAG do ai-first. Após análise do pipeline real (`frontmatterParser.ts`, `GraphRAGService.ts`, `rag.ts`), foram identificados 4 gaps que reduzem a qualidade do RAG gerado pela skill.

[5] (score=0.77) (source=edited-file)
---
name: rag-project-setup
description: "Detecta estrutura do projeto (monorepo vs multi-repo vs microserviços), configura slugs de tenant, gera scripts de ingestão, instala o hook ask-rag-enrich.sh com detecção automática de subprojeto, e conecta tudo ao ai-first. Use quando: 'configura o rag para este projeto', 'setup rag', 'conecta o projeto ao rag', 'prepara ingestão', 'bootstrap rag', 'quero usar o rag neste projeto'."
tags: ["rag", "bootstrap", "ingest", "setup", "multi-repo", "monorepo"]
---

[6] (score=0.78) (source=edited-file)
(`ask-rag-enrich.sh`): injeta chunks RAG + decisions como `additionalContext`; cache 5min; filtros de projeto e keywords | estável (2026-05-23) |
| **services** | _(a criar conforme demanda)_ | Neo4j, Redis cache | — |
| **routes** | _(a criar conforme demanda)_ | Endpoints Fastify | — |
| **mcp** | _(a criar conforme demanda)_ | MCP stdio server | — |

[7] (score=0.78) (source=edited-file)
## Exemplo com RAG

[8] (score=0.77) (source=edited-file)
```
IDE prompt
  └── ask-rag-enrich.sh (UserPromptSubmit)
        ├── filtro: len ≥ 60 + keywords regex
        ├── cache /tmp/ask-rag-cache/<sha256>.txt (TTL 5min)
        ├── deriva PROJECT do git remote do cwd
        ├── POST http://localhost:3099/api/rag
        │     { query, project, top_k: 15, min_score: 0.55 }
        ├── formata chunks[:7] + metadata.decisions[:3]
        └── hookSpecificOutput.additionalContext → IDE
```

[9] (score=0.79) (source=edited-file)
# RAG Project Setup

[10] (score=0.78) (source=edited-file)
env"
  - "config"
  - "rag"
  - "ingest"
  - "ide"
  - "feature-flags"
rag_keywords:
  - "GRAPHRAG_ENABLED /api/rag"
  - "METADATA_FILTERING_ENABLED"
  - "RAPTOR_RETRIEVAL_ENABLED"
  - "chatbot vars removidas"
  - "enrichChunks ANTHROPIC_API_KEY"
  - "embedSparse CPU only"
  - "kill switches IDE"
related_modules:
  - "gpu-worker/config"
  - "sira/config"
depends_on: []
used_by: []
---

[11] (score=0.77) (source=edited-file)
O hook instalado (`ask-rag-enrich.sh`) faz busca semântica a cada prompt técnico
(≥60 chars + keyword técnica), com cache local de 2h. Não instrui Claude a ler
arquivos específicos — o RAG injeta o que é relevante automaticamente.

[12] (score=0.77) (source=edited-file)
## Integração com outras skills

[13] (score=0.78) (source=md, module=reports)
## Skills Inventory

[14] (score=0.77) (source=edited-file)
TEXT_INJECTION_PREFIX}${frontmatter.summary_context}`;
        }
        // Propagate rag_keywords into vocab_expansion so they get mixed into sparse vector.
        if (frontmatter.rag_keywords?.length) {
          base.vocab_expansion = [...(base.vocab_expansion ?? []), ...frontmatter.rag_keywords];
        }
        const links = extractWikilinks(c.text);
        if (links.length) base.wikilinks = links;
      }
      return base;
    });

[15] (score=0.77) (source=edited-file)
## Integração com outras skills
