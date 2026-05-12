---
name:  execute-prompt
description: "Gateway obrigatório para execução de qualquer arquivo .prompt.md. SEMPRE invocar quando o usuário disser 'execute o prompt', 'rode o prompt', 'siga o prompt' ou referenciar um arquivo .prompt.md. Garante que clear-cache, leitura dos contextos e search-docs rodem ANTES de qualquer implementação."
tags: ["pre-task", "workflow", "prompt", "context", "neo-backend"]
---

# Execute Prompt

Workflow obrigatório antes de executar qualquer `.prompt.md`. Nunca pule etapas — cada uma é bloqueante para a próxima.

## Regra de ativação

Invocar automaticamente quando o usuário:
- Disser "execute o prompt", "rode o prompt", "siga o prompt", "implementa o prompt"
- Referenciar um arquivo `.prompt.md` com intenção de implementar
- Pedir para criar uma branch e executar um prompt

---

## Step 1 — Limpar cache

```bash
bash scripts/clear-cache__clear_cache.sh
```

Confirmar que terminou sem erros. Não avançar se falhar.

---

## Step 1.5 — Cobertura de Testes (OBRIGATÓRIO antes da implementação)

Antes de qualquer código, verificar se existem testes para o endpoint/módulo afetado:

```bash
ls .claude/tests/Feature/[Modulo]/
grep "test-phpunit-" .claude/justfile
```

### SE NÃO EXISTIREM testes:
1. Invocar skill `endpoint-architect-analyzer`
2. A skill mapeia Controller → Service → Repository → DB/InfluxDB e gera testes
3. Rodar os testes gerados e confirmar que passam **antes de tocar no código**
4. Adicionar os steps de teste no `.prompt.md` da task (seção `## Steps / Checks`)

### SE JÁ EXISTIREM testes:
1. Rodar: `just test-phpunit-[feature]` (ou o recipe correspondente)
2. Anotar o baseline (quantos passam/falham) no `.prompt.md`
3. Avançar para a implementação

**Regra:** A implementação só começa após ter testes rodando como baseline. Nunca pular.

---

## Step 2 — Ler o arquivo .prompt.md

Ler o arquivo de prompt referenciado **na íntegra** antes de qualquer outra ação.

Extrair e anotar:
- Objetivo da task
- Módulo afetado (`app/Modules/[Modulo]/`)
- Arquivos e classes mencionados
- Steps TODO listados
- Seção `## Verification` (se existir)

---

## Step 3 — Carregar contexto do projeto

Ler os três arquivos de contexto **em paralelo**:

```
.claude/context/ai_context_master.md    ← modelo Eloquent, tabelas, conexões DB
.claude/context/Business_Logic_Map.md   ← regras de negócio, serviços, middlewares
.claude/context/influx_ai_context.md    ← InfluxDB (ler se a task tocar dados de sensores)
```

---

## Step 4 — Ler docs do módulo

Identificar o módulo da task e ler o `00-index.md` correspondente, depois os sub-arquivos relevantes.

Estrutura de docs:
```
context/
├── lume/              ← módulo Lume
├── shared/            ← módulo Shared
├── water/             ← módulo Water
├── integrations/      ← módulo Integrations
└── reports/           ← módulo Reports
    └── energy/        ← subdomínio: relatório de energia
```

Módulos conhecidos:

| Módulo | Index |
|--------|-------|
| Lume | `context/lume/00-index.md` |
| Shared | `context/shared/00-index.md` |
| Water | `context/water/00-index.md` |
| Integrations | `context/integrations/00-index.md` |
| Reports / Energy | `context/reports/energy/00-index.md` |

Se o módulo não existir, continuar sem bloquear. Após a implementação, invocar a skill `register-domain` para scaffoldar os docs e registrar o módulo nas tabelas de referência.

---

## Step 5 — Buscar documentação relevante

Usar `search-docs` com 2–3 queries cobrindo os principais conceitos da task antes de escrever qualquer código.

---

## Step 6 — Novo módulo?

Se a task criar um módulo novo ou nova slice em módulo existente:
1. Invocar a skill `neo-module-architect`
2. Perguntar ao usuário qual estrutura seguir antes de criar qualquer arquivo
3. Aguardar resposta — não criar nada antes da aprovação

---

## Step 7 — Aplicar convenção de nomenclatura

Antes de criar qualquer arquivo ou classe, verificar a skill `english-naming-convention`:

- Todos os nomes em **inglês**: arquivos, classes, interfaces, métodos, variáveis, enum cases
- **Exceções em português**: nomes de tabelas/colunas DB, propriedades de modelo mapeadas a colunas, campos de request de integração, mensagens de usuário final
- Entidade principal: `chamado` → `ticket`, `instalação` → `installation`

---

## Step 8 — Executar o prompt

Agora sim, implementar seguindo os steps do `.prompt.md` na ordem exata.

---

## Step 9 — Pós-implementação (OBRIGATÓRIO — executar sem ser solicitado)

> **ATENÇÃO:** Estas etapas são TODAS obrigatórias e devem ser executadas automaticamente ao final de TODA implementação, sem exceção e sem aguardar o usuário pedir. Nunca finalizar uma task sem completar todos os itens abaixo.

### 9.1 — Formatação

```bash
docker exec backend-api php vendor/bin/pint --dirty
```

### 9.2 — Testes PHPUnit pós-implementação (OBRIGATÓRIO)

**Ajustar e rodar os testes PHPUnit** para cobrir a nova funcionalidade ou comportamento corrigido:

1. Verificar se algum teste existente precisa de ajuste (novo campo, nova regra, novo caso)
2. Adicionar novos testes para cobrir:
   - O comportamento novo/corrigido (happy path)
   - Os edge cases da mudança
   - Qualquer campo novo na response
3. Rodar a suite completa:
   ```bash
   just test-phpunit-[feature]
   ```
4. **Meta:** 100% dos testes passando antes de declarar concluído
5. Atualizar o recipe no justfile se o arquivo de teste mudou de nome

**Nunca declarar concluído com testes falhando.**

### 9.3 — Testes E2E / integration-prober (OBRIGATÓRIO se houver endpoint)

**Invocar skill `integration-prober` sempre que a task envolver qualquer endpoint de API** — independente de ser fix, feature, integração ou refactor.

Se o `.prompt.md` não tiver seção `## Verification`, construir os curls a partir do contexto da implementação e executar assim mesmo.

**Nunca pular esta etapa quando houver endpoint envolvido.**

### 9.4 — Documentação do módulo

Se o módulo **não** tiver pasta em `context/[modulo]/`: invocar skill `register-domain`.

Se o módulo **já tiver** pasta: invocar skill `domain-context-updater` para atualizar os docs existentes.

**Nunca pular esta etapa.** Os docs são a fonte de verdade para agents futuros.

### 9.5 — Postman collection (OBRIGATÓRIO)

Sempre criar ou atualizar o descriptor em `postman/descriptors/<modulo>.descriptor.json` e rodar:

```bash
bash scripts/generate-postman__generate_postman.sh \
  --descriptor=postman/descriptors/<modulo>.descriptor.json \
  --out-dir=postman
```

Cada request no descriptor **deve ter** `tests` com:
- Assertion de status HTTP correto
- Assertions dos campos obrigatórios na response
- Assertions de valores de regras de negócio relevantes

**Nunca pular esta etapa**, mesmo que o endpoint seja simples.

### 9.6 — API Doc no .prompt.md (OBRIGATÓRIO)

Imediatamente após o generate-postman, invocar skill `api-doc-generator` passando:
- o descriptor usado no 9.4
- o caminho do `.prompt.md` da task atual

**Nunca pular esta etapa.** O `.prompt.md` deve sempre terminar com a seção `## API Doc` preenchida.

### Checklist final

Antes de declarar a task concluída, confirmar:
- [ ] testes PHPUnit existem para o endpoint/módulo afetado (se não → endpoint-architect-analyzer rodou)
- [ ] testes PHPUnit passando 100% após a implementação (`just test-phpunit-[feature]`)
- [ ] pint rodou sem erros
- [ ] integration-prober executado e passou (obrigatório se qualquer endpoint foi tocado)
- [ ] docs do módulo criados/atualizados
- [ ] `postman/<modulo>.postman_collection.json` gerado/atualizado
- [ ] `## API Doc` preenchida no `.prompt.md`
```
