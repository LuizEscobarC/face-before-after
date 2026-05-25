# RAG Chunks — última recuperação
**Timestamp:** 2026-05-24 06:46:34  |  **Project:** neo-backend  |  **Query:** <task-notification>
<task-id>b84xdn5wt</task-id>
<tool-use-id>toolu_011qVJT17V3Zr2kvCMHjnk8R</tool-use-id>
<output-file>

[1] (score=0.79) (source=edited-file)
ingest() {
  local slug="$1"
  local path="$2"
  echo "→ Ingestando $slug ($path)"
  INGEST_PROJECT="$slug" INGEST_PATH="$path" \
    node "$AI_FIRST_DIR/dist/scripts/ingest-md.js" "$path" \
    || npx --prefix "$AI_FIRST_DIR" tsx "$AI_FIRST_DIR/scripts/ingest-md.ts" "$path"
}

[2] (score=0.79) (source=edited-file)
# Alternativa direta (ai-first Node):
INGEST_PROJECT=<slug> npx tsx $AI_FIRST_DIR/scripts/ingest-md.ts <pasta>
```

[3] (score=0.79) (source=edited-file)
## Ingestão
```bash
bash .claude/local/scripts/ingest-project.sh          # ingesta tudo
bash .claude/local/scripts/ingest-project.sh myapp-backend  # ingesta só backend
```

[4] (score=0.79) (source=edited-file)
# Alternativa direta (ai-first Node):
INGEST_PROJECT=<slug> npx tsx $AI_FIRST_DIR/scripts/ingest-md.ts <pasta>
```

[5] (score=0.79) (source=edited-file)
# 2. Alternativa direta (ai-first Node):
INGEST_PROJECT=<slug> npx tsx $AI_FIRST_DIR/scripts/ingest-md.ts <pasta>

[6] (score=0.79) (source=edited-file)
Criar `.claude/local/scripts/ingest-project.sh`:

[7] (score=0.77) (source=edited-file)
A §"7. Smoke de ingestão" usa `$INGEST_COMMAND` genérico. Agora existe `.claude/local/scripts/ingest-project.sh <slug>` (gerado por `rag-project-setup`) que deve ser referenciado como caminho primário.

[8] (score=0.78) (source=edited-file)
**Caminho:**
```
.claude/local/prompts/[module]/task-[slug]-[date].prompt.md
```

[9] (score=0.78) (source=edited-file)
# 2. Alternativa direta (ai-first Node):
INGEST_PROJECT=<slug> npx tsx $AI_FIRST_DIR/scripts/ingest-md.ts <pasta>

[10] (score=0.78) (source=edited-file)
### Pré-implementação
- [ ] `npm run lint` — baseline: exit 0
- [ ] Ler arquivos afetados identificados acima

[11] (score=0.77) (source=edited-file)
> ✅ Arquivo criado: `.claude/local/prompts/[module]/task-[slug]-[date].prompt.md`
> 🚀 Iniciando execução...

[12] (score=0.78) (source=edited-file)
async function main() {
  const start = Date.now();
  console.log('📄 Ingest .md (chunking por heading + metadata)');

[13] (score=0.78) (source=edited-file)
await closeWriter();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(
    `\n✅ ingest-md concluído em ${elapsed}s — ${written} escritos, ${skipped} pulados, ${removed} removidos`,
  );
  console.log(
    `   grafo: ${graphStats.modules} :Module, ${graphStats.moduleEdges} arestas Module, ${graphStats.wikilinks} arestas LINKS_TO`,
  );
}

[14] (score=0.77) (source=edited-file)
if [ "${#SLUG_MAP[@]}" -eq 0 ]; then
  echo "⚠ SLUG_MAP vazio — edite .claude/local/scripts/ingest-project.sh"
  exit 1
fi

[15] (score=0.78) (source=edited-file)
Se `CLAUDE.md` não existir: parar e pedir ao usuário antes de prosseguir.
