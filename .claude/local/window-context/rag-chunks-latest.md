# RAG Chunks — última recuperação
**Timestamp:** 2026-05-24 03:03:09  |  **Project:** neo-backend  |  **Query:** revise o plano e seja crítico: Plano salvo em: /home/luizescobal/.claude/plans/crystalline-growing-sundae.md

[1] (score=0.84) (source=edited-file)
**Arquivo alvo (único):** `/home/luizescobal/.claude/skills/domain-context-updater/SKILL.md`

[2] (score=0.82) (source=edited-file)
`/home/luizescobal/.claude/skills/domain-context-updater/SKILL.md`

[3] (score=0.81) (source=edited-file)
O arquivo vive em `~/.claude/hooks/` (global do usuário, fora do repo).
Registrado em `~/.claude/settings.json` como handler de `UserPromptSubmit`.

[4] (score=0.80) (source=edited-file)
const CONTEXT_DIR =
  process.env.CONTEXT_DIR ||
  '/home/luizescobal/et/neo-backend/.claude/local/context';

[5] (score=0.80) (source=edited-file)
**Caminho:**
```
.claude/local/prompts/[module]/task-[slug]-[date].prompt.md
```

[6] (score=0.80) (source=edited-file)
> ✅ Arquivo criado: `.claude/local/prompts/[module]/task-[slug]-[date].prompt.md`
> 🚀 Iniciando execução...

[7] (score=0.80) (source=edited-file)
Path: `$PROJECT_ROOT/.claude/local/context/modules/<module>/golden-queries.md`

[8] (score=0.80) (source=md-docs)
### 4) Verificar

```bash
ls -la .claude/skills
readlink -f .claude/skills
```

O destino resolvido deve apontar para `neo-backend/.claude/skills`.

---

[9] (score=0.80) (source=md-docs)
## Re-sincronizar

```bash
cd /home/luizescobal/et/claudecode
for d in */; do (cd "$d" && git pull --ff-only); done
```

Após sync, atualizar a tabela de SHAs acima e revisar os arquivos `01-` a `08-` se houver mudanças relevantes nos READMEs/docs.

---

[10] (score=0.80) (source=md-docs)
### 2) Fazer backup opcional

```bash
cp -r .claude/local/skills /tmp/skills-backup-$(date +%Y%m%d)
```

[11] (score=0.80) (source=md-docs)
## `${CLAUDE_PLUGIN_ROOT}` — paths portáveis

Sempre use a variável de ambiente para referenciar arquivos do próprio plugin:

```json
{
  "command": "${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh"
}
```

Funciona qualquer que seja onde o plugin foi instalado.

---

[12] (score=0.80) (source=md, module=reports)
### Passo 8 — Documentar
Criar `.claude/local/context/water/0X-background-pressao-pipeline.md` seguindo o mesmo template deste documento.

[13] (score=0.80) (source=md-docs)
### Agents (`agents/<name>.md`)

Subagente isolado, com prompt do sistema próprio e tools restritas. Ver `claude-cookbooks/claude_agent_sdk/chief_of_staff_agent/.claude/agents/`.

[14] (score=0.79) (source=md, module=reports)
### Passo 9 — Documentar
Criar `.claude/local/context/<modulo>/0X-background-annual-pipeline.md` seguindo este template.

[15] (score=0.79) (source=md-docs)
## Layout alvo

```text
neo-backend/.claude/local/skills/   <- fonte da verdade
                ^
                | symlink
                |
.claude/local/skills/               <- ponteiro usado em runtime
```

---
