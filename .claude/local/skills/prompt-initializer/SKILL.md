---
name: prompt-initializer
description: "**MANDATORY** high-fidelity context orchestrator: creates .prompt.md file for ANY task arriving in chat. Executes 6-layer Precise Context Injection: Language Server hovering, instance-based sampling, schema pruning, multi-tenant guardrails, ReAct self-reflection. Loads ai_context_master.md, Business_Logic_Map.md, module docs, samples, semantic maps. Enforces dependency mapping + referential integrity before any code is written. Zero hallucinations—every identifier verified in .claude/local/context/ before suggestion. Trigger on: 'cria prompt', 'criar prompt', 'novo prompt', 'task sem prompt', 'inicializar prompt', 'prompt-initializer', 'bug reportado', 'novo feature', 'refatorar', 'investigar', or any task that arrives without a .prompt.md reference. NO CODE WITHOUT CONTEXT CONFIRMATION."
---

# Prompt Initializer — High-Fidelity Context Orchestrator (6-Layer Protocol)

**MANDATORY SKILL** — creates a structured `.prompt.md` file for tasks arriving in chat while executing a **6-layer Precise Context Injection protocol** that eliminates hallucinations, enforces architectural safety, and ensures every task has verified background knowledge from `.claude/local/context/`.

## Protocol: 6-Layer Precise Context Injection

Before generating any prompt, this skill executes a **6-layer context orchestration** with architectural validation at each step:

### Layer 1 — Context Retrieval (Context Loading)

Automatically scan `.claude/local/context/` and load **in parallel**:

| Context | Source | Purpose |
|---|---|---|
| **Application** | `ai_context_master.md` | Eloquent models, tables, DB connections |
| **Business Rules** | `Business_Logic_Map.md` | Service bindings, middleware, ACL rules |
| **Data Topology** | `influx_ai_context.md` | InfluxDB buckets, tags (if applicable) |
| **Module Docs** | `modules/[module]/00-index.md` | Architecture and domain rules |
| **Data Samples** | `modules/[module]/10-instance-samples.md` | Real 10-row samples per table |
| **Semantic Map** | `modules/[module]/11-semantic-map.md` | Enum values, FK dependencies |

**Action:** If any file is missing, note it and continue — some contexts are optional.

### Layer 2 — Hovering Protocol (Language Server Protocol / RATester Technique)

Before inferring any code pattern, **emulate a senior developer with IDE Language Server Hovering**:

- **Unknown identifier?** (method, class, table, service) → Search `.claude/local/context/code/` for definition + documentation before any inference
- **Unsure about return type?** → Check `ai_context_master.md` for model definitions + PHPDoc comments
- **Need to understand enum values?** → Read `modules/[module]/11-semantic-map.md` for actual enum cases + translations
- **Question about FK logic?** → Verify in `Business_Logic_Map.md` service bindings + referential constraints
- **Multi-DB query risk?** → Cross-check connection boundaries in `influx_ai_context.md` (InfluxDB vs MySQL)

**Elimination Rule:** Do NOT suggest method signatures without verifying they exist in:
1. Eloquent model definitions (in `ai_context_master.md`)
2. Repository interfaces (in `Business_Logic_Map.md`)
3. Service contracts (in module docs)

**Action:** Build a complete **Dependency Referential Graph** before suggesting the first line of code. Flag any unresolved identifiers.

### Layer 3 — Schema Pruning via Pure Fine-Tuning (Token Efficiency + Precision)

Do NOT inject the entire `ai_context_master.md`. Instead, apply **Pure Fine-tuning Pruning**:

1. **Parse task description** and identify affected tables/modules
2. **Extract ONLY relevant sections** from `ai_context_master.md` (e.g., if task affects `chamados_geral`, include only its schema + relationships)
3. **Prune unrelated entities** (e.g., task about tickets → exclude `relatorios_assincronos`, `energia_dados_diario`)
4. **Inject pruned schema** with inline comments explaining why each field matters
5. **Document schema boundaries** (which DB? which connection?)

**Pruning Heuristic:**
- If table is NOT mentioned in task AND has no FK to task tables → exclude
- If field is metadata (created_at, updated_at, is_deleted) → include only if explicitly needed
- If relationship is complex (many-to-many) → include full join table schema

**Action:** Reduces context injection by ~60%, increases model focus, preserves all precision needed for task.

### Layer 4 — Instance-Based Sampling (Semantic Understanding)

For ANY task mentioning data, filtering, calculations, or aggregations:

1. **Load 10-15 real data samples** from `modules/[module]/10-instance-samples.md` (mandatory)
2. **Analyze actual value distributions** — enum cardinality, NULL prevalence, date ranges, numeric scales
3. **Inject samples into prompt** with annotations explaining semantic meaning

**Sampling Rules:**
- If task involves filtering: inject examples of what MATCHES and what DOESN'T
- If task involves calculations: include actual numeric ranges + edge cases
- If task involves status/enum fields: show all possible values with translations (PT-BR)
- If task involves dates: show actual date ranges (historical vs. recent)

**Example:**
```
Task: "Filter chamados by status"

Sample Data (from 10-instance-samples.md):
- id=2096394, status='Chamado Criado' (34% of open tickets)
- id=2094551, status='Aguardando Atendimento' (41%)
- id=2093968, status='Retorno à Normalidade' (19%)
- id=2090185, status='Chamado Fechado' (6%, historical)

NOTE: Status '999' (Deleted) appears in 2% of rows but should be filtered out.
```

**Action:** Eliminates guessing at enum cardinality, NULL handling, and data semantics. Model sees actual distributions, not assumptions.

### Layer 5 — Guardrails & Isolation (Security + Correctness)

**Read-Only Default (Strictly Read-Only Mode):** For any extraction, analysis, diagnostic, or reporting script:
- Force `--read-only` mode on ALL database operations
- Restrict scripts to `SELECT` only — NO INSERT/UPDATE/DELETE
- Inject in prompt: **"All database queries in this task MUST be SELECT-only. Any mutation (INSERT/UPDATE/DELETE) requires explicit approval."**
- For `tinker` scripts in production: block via `run_in_app_write()` guardrail

**Multi-Tenant Isolation (SQL Query Rewriting):** If the application is multi-tenant (tenant_id column):
- Automatically append `WHERE tenant_id = ?` to every suggested query
- Document in prompt: "CRITICAL: All SELECT queries must filter by tenant_id to prevent data leaks"
- Example: `SELECT * FROM chamados_geral WHERE id = ? AND tenant_id = ?`

**Multi-DB Isolation:** If affecting both `mysql` (API/models) and `mysql_dados` (time-series):
- Explicitly document the connection boundary in the prompt
- **Warn about cross-DB FK limitations:** "Eloquent CANNOT JOIN across mysql and mysql_dados — load from mysql first, then key into mysql_dados"
- Suggest pattern: "Query mysql for installation.id, then use that ID to fetch mysql_dados climate data"

**Atomic Claims (Race Condition Prevention):** For state transitions or queue operations:
- Inject pattern: **"Always use UPDATE with WHERE guard — verify row state BEFORE modifying"**
- Suggest `SELECT ... FOR UPDATE` to lock rows during transaction
- Inject example: `UPDATE chamados_geral SET status = 'fechado' WHERE id = ? AND status = 'em_andamento'`
- Document: "This guards against concurrent status changes by another worker"

**Action:** Build immunity to race conditions, multi-tenant leaks, and cross-connection bugs at prompt time.

### Layer 6 — ReAct Self-Reflection & Dependency Validation

Before finalizing the `.prompt.md`, the skill **MUST perform a self-reflection cycle** (ReAct: Reason + Act + Reflect):

**Reflection Checklist:**

1. **Dependency Completeness**
   - [ ] All identifiers (methods, tables, services) referenced in the prompt have definitions in `.claude/local/context/`
   - [ ] No "undefined reference" risks (catch typos, class name variations)
   - [ ] All FK relationships documented

2. **Referential Integrity**
   - [ ] If task touches multiple tables, all FKs and relationships are in prompt
   - [ ] If task uses services, their bindings are documented in `Business_Logic_Map.md`
   - [ ] Cross-DB operations: explicitly documented which DB for each table

3. **Business Rule Alignment**
   - [ ] Task doesn't violate global ACL rules (checked in `Business_Logic_Map.md`)
   - [ ] Status transitions follow state machine rules (if applicable)
   - [ ] Multi-tenant isolation enforced (if applicable)

4. **Guardrail Compliance**
   - [ ] Read-only operations: no mutating queries in analysis scripts
   - [ ] Atomic claims: state transitions use WHERE guards
   - [ ] No hardcoded IDs or magic numbers (use named constants)

5. **Code Safety Red Flags**
   - ❌ Method call without verifying signature in context
   - ❌ Cross-DB JOIN without explicit warning
   - ❌ INSERT/UPDATE without explicit permission in analysis task
   - ❌ Status update without checking current state first

**Action:** If any reflection check fails, **STOP** and add clarifying notes to the prompt instead of proceeding with assumptions.

**Example Reflection Output:**
```
⚠️  Dependency Warning: Task mentions EnergyReportBuilder service
    ✓ Found in: .claude/local/context/reports/energy/01-architecture.md
    ✓ Bindings verified: WeatherServiceProvider
    ✓ FK to WeatherMetrics confirmed

⚠️  Guardrail Check: Task asks to "update chamado status"
    ✓ Read-only task: NO (mutation required, explicit approval granted)
    ✓ Atomic claim: UPDATE...WHERE status='em_andamento' (REQUIRED)
    ✓ Multi-tenant: chamados_geral.tenant_id=? (ADDED)

✅ All reflections passed. Prompt validated for generation.
```

---

## When to Invoke (MANDATORY TRIGGERS)

**Invoke IMMEDIATELY and AUTOMATICALLY** whenever the user:

✅ **MUST INVOKE:**
- Reports a bug: "This is broken", "500 error", "not working", "wrong calculation"
- Requests a feature: "Add new endpoint", "create dashboard", "implement authentication"
- Asks to refactor: "clean up this code", "improve performance", "restructure module"
- Mentions investigation: "why is this slow?", "understand this flow", "diagnose this issue"
- Opens a task without a `.prompt.md` reference

✅ **PUSHY TRIGGERS** (always invoke even if implied):
- User selects code in IDE → Invoke with context
- User mentions a module name → Invoke to load module docs
- User pastes an error message → Invoke to map dependencies
- User says "before I code" → Invoke BEFORE any implementation

**Do NOT invoke** if:
- A `.prompt.md` file is already open in the IDE or explicitly referenced ("use prompt X")
- The message is purely informational or a question (not a task):
  - "What's the architecture?" → Use search/read instead
  - "How does X work?" → Point to docs, don't initialize task

**Integridade de Fluxo (CRITICAL):**
> **NO CODE SHALL BE WRITTEN BEFORE THE PROMPT-INITIALIZER HAS CONFIRMED THAT IT HAS:**
> 1. Loaded all context layers (6-layer protocol)
> 2. Mapped all referential dependencies
> 3. Passed the ReAct self-reflection validation
> 4. Created a `.prompt.md` with verified context

If code is suggested without a prompt, **REFUSE** and invoke this skill instead.

---

## Execution Protocol

### Step 1 — Extract Task Metadata

From the user's message, extract:

| Field | Example |
|---|---|
| **module** | `tickets`, `energy`, `shared`, `reports/energy` |
| **type** | `bugfix` \| `feature` \| `endpoint` \| `investigation` \| `refactor` |
| **slug** | `fix-status-filter`, `new-consumption-endpoint`, `refactor-service-layer` (max 5 words, kebab-case) |
| **date** | Today in `YYYY-MM-DD` |

### Step 2 — Load Context Layers (Precise Injection)

Execute in parallel (simulated):
```
for each context in [ai_context, business_logic, influx, module_docs, samples, semantic_map]:
    load from .claude/local/context/
    if missing: note and continue
    extract task-relevant sections only (schema pruning)
```

### Step 3 — Categorize & Analyze

1. **Task Category:**
   - Is this a **bugfix**? (has error symptoms, wrong behavior)
   - Is this a **feature**? (new endpoint, new business logic)
   - Is this a **refactor**? (architecture change, no new feature)
   - Is this an **investigation**? (understand a behavior, no code change)

2. **Dependency Mapping:**
   - List affected models, services, repositories
   - List affected DB connections (`mysql` vs `mysql_dados`)
   - List affected middleware, policies, gates
   - Note any cross-DB FK dependencies

3. **Risk Assessment:**
   - Does this task touch state machines? (need atomic claims)
   - Does this task touch queues? (need transaction isolation)
   - Does it affect shared services? (check for side effects)

### Step 3.5 — Test Coverage Check (OBRIGATÓRIO antes de criar o prompt)

Verificar se existem testes PHPUnit para o endpoint/módulo afetado:

```bash
ls .claude/local/tests/Feature/[Modulo]/ 2>/dev/null
grep "test-phpunit-" .claude/local/justfile | grep -i [feature]
```

**Se NÃO existirem testes:**
- Marcar no prompt (`## Steps / Checks`): `- [ ] Invocar endpoint-architect-analyzer para criar testes baseline`
- A skill `endpoint-architect-analyzer` deve ser invocada **antes** de qualquer implementação
- Os testes gerados precisam passar antes de tocar no código

**Se JÁ existirem testes:**
- Anotar no prompt qual recipe rodar: `just test-phpunit-[feature]`
- Marcar no prompt: `- [ ] Rodar baseline: just test-phpunit-[feature] — anotar X/Y passando`

**Regra para o template do prompt:**
- A seção `## Steps / Checks` DEVE sempre conter:
  ```
  - [ ] Verificar/criar testes: .claude/local/tests/Feature/[Modulo]/
  - [ ] Rodar baseline antes da implementação: just test-phpunit-[feature]
  - [ ] Após implementação: ajustar testes e garantir 100% passando
  ```

### Step 4 — Create `.prompt.md` with Context Injection

File path:
```
.claude/local/prompts/[module]/task-[slug]-[date].prompt.md
```

Examples:
- `.claude/local/prompts/tickets/task-fix-status-filter-2026-04-09.prompt.md`
- `.claude/local/prompts/energy/task-new-consumption-endpoint-2026-04-09.prompt.md`

**Template (use the template below, filling all sections):**

```markdown
# [Task Title in English]

> **Type:** [bugfix | feature | endpoint | investigation | refactor]
> **Module:** [module]
> **Date:** [YYYY-MM-DD]
> **Stack:** Laravel 10.x · PHP 8.1.5 · MySQL · [InfluxDB if applicable]

---

## Context

[Summarize the user's request:
- What is broken / what needs to be built
- Which endpoints / models are affected
- Error messages or symptoms (if bugfix)
- Links to frontend or related code

**Injected Context (from .claude/local/context/):**
- Affected tables: [list from ai_context_master.md]
- DB connections: [mysql | mysql_dados]
- Key services: [from Business_Logic_Map.md]
- Known enum values: [from 11-semantic-map.md]
]

---

## Business Rules

[Extracted from domain context and user message:
- Expected vs actual behavior (bugfix)
- Acceptance criteria (feature)
- Constraints and guardrails

**Isolation Rules:**
- [ ] If multi-tenant: enforce `WHERE tenant_id = ?`
- [ ] If cross-DB: load mysql first, then mysql_dados
- [ ] If state machine: use atomic UPDATE with guarding WHERE clause
- [ ] All extraction scripts: SELECT-only, no writes
]

---

## Dependency Map (Layer 2: LSP Hovering Verification)

[Built from Language Server Protocol hovering — ALL identifiers verified in `.claude/local/context/`:
- Models: [Model1:path, Model2:path] — with signatures verified
- Services: [ServiceA, ServiceB] — bindings confirmed in Business_Logic_Map.md
- Repositories: [RepositoryX] — interfaces and implementations documented
- Middleware: [MiddlewareY] — registered in Kernel or ServiceProvider
- DB connections: mysql | mysql_dados — with boundary warnings if cross-DB
- FKs to watch: [complete list with constraints] — all verified in context
- **⚠️ Unresolved refs:** [NONE — all identifiers verified]
]

**Verification Proof:**
- [ ] Every Model/Service/Repository has a context definition
- [ ] Every FK constraint is documented
- [ ] Every cross-DB operation has explicit warning
- [ ] No "undefined reference" risks


---

## Steps / Checks

### Pré-implementação (testes baseline)
- [ ] Verificar testes existentes: `ls .claude/local/tests/Feature/[Modulo]/`
- [ ] SE NÃO EXISTIREM: invocar `endpoint-architect-analyzer` para criar testes baseline
- [ ] SE JÁ EXISTIREM: rodar baseline `just test-phpunit-[feature]` — anotar resultado: X/Y passando
- [ ] Confirmar que testes baseline passam ANTES de tocar no código

### Contexto
- [ ] Read context: `context/[module]/00-index.md`
- [ ] Load instance samples: `context/modules/[module]/10-instance-samples.md`
- [ ] Load semantic map: `context/modules/[module]/11-semantic-map.md`

### Implementação
- [ ] [Custom step 1 based on task type]
- [ ] [Custom step 2]

### Pós-implementação
- [ ] Run `vendor/bin/pint --dirty` (inside Docker container)
- [ ] Ajustar testes para cobrir comportamento novo/corrigido
- [ ] Rodar testes pós-implementação: `just test-phpunit-[feature]` — meta: 100% passando
- [ ] Run `integration-prober` skill (testspy assertions — obrigatório se endpoint envolvido)
- [ ] Update domain docs: `domain-context-updater`
- [ ] Update Postman: `generate-postman`
- [ ] Append API doc: `api-doc-generator`
- [ ] Run `clean-code-refactor` skill — rename PT→EN variables, extract sub-methods, re-run Pint
- [ ] Mark all checks [x] and edit this prompt with curl commands

---

## Verification

> Fill after implementation.

**Pre-conditions:**
- Authenticated user with permission to the affected module
- [Other prerequisites from context]

**Test cases:**

\`\`\`bash
# [Test case 1]
curl -s -X [METHOD] "[BASE_URL]/[path]" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '[body]'
# Expected: HTTP [status], fields: [field assertions]
\`\`\`

**Known issues & quick solutions:**

| Error | Cause | Fix |
|-------|-------|-----|
| 500 Class not found | Cache stale | `clear-cache` skill |
| 403 | Permission denied | Check user gate/policy |
| 422 | Validation failed | Check Form Request rules |

---

## API Doc

> Fill after running `api-doc-generator`.

[See template in existing prompts]

---

## Commits

> **Before committing:** run `clean-code-refactor` skill to rename PT→EN variables and extract sub-methods. Only commit after clean-code-refactor and Pint pass.

> Suggested commits (do NOT execute — user runs manually):

\`\`\`bash
git add [file1] [file2]
git commit -m ":sparkles: feat: [description]"
\`\`\`
```

### Step 5 — ReAct Self-Reflection (Layer 6 Validation)

Before finalizing, execute the Layer 6 reflection checklist:

**Reflection Output Template:**
```
✅ PROMPT-INITIALIZER VALIDATION REPORT

Layer 1 (Context Retrieval): ✓ ai_context_master.md loaded (X tables)
Layer 2 (LSP Hovering): ✓ 0 unresolved identifiers
Layer 3 (Schema Pruning): ✓ Reduced from 5000 to 1200 tokens
Layer 4 (Instance Sampling): ✓ 12 real data rows injected
Layer 5 (Guardrails): ✓ Read-only enforced, multi-tenant WHERE added
Layer 6 (ReAct Reflection): ✓ ALL dependencies verified

🔒 Integrity Check: PASSED
   ✓ No undefined references
   ✓ All FKs documented
   ✓ Cross-DB operations flagged
   ✓ Guardrails applied
   ✓ Business rules validated

Prompt ready for execution.
```

If any validation fails → STOP and clarify in prompt instead of proceeding.

### Step 6 — Confirm & Proceed to Execution

After validation, show the user:

> ✅ Arquivo criado: `.claude/local/prompts/[module]/task-[slug]-[date].prompt.md`
> 🔒 Contexto validado: 6-layer protocol passed
> 📋 Referential integrity: confirmed
> 🚀 Iniciando execução...

Then invoke the appropriate skill:
- **bugfix/investigation** → `laravel-bug-diagnostician` (full diagnostic protocol)
- **feature/endpoint** → `execute-prompt` (context loading + implementation)
- **refactor** → `execute-prompt` (with architectural review)

**Post-implementation (before commits):**
- After `execute-prompt` finishes → invoke `clean-code-refactor` automatically
- `clean-code-refactor` renames PT→EN variables, extracts sub-methods, re-runs Pint
- Only after `clean-code-refactor` completes → list the Commits section

**CRITICAL:** Do NOT execute implementation until `.prompt.md` is created AND validated by Layer 6.

---

## Validation & Idempotence

**After Skill Execution:**

The skill auto-validates that:
1. **Context files exist** — all layers of `.claude/local/context/` were successfully loaded
2. **Schema pruning worked** — only task-relevant tables are in the prompt
3. **Instance samples injected** — real data is available for semantic understanding
4. **Isolation rules enforced** — atomic claims, read-only guards, tenant isolation in place
5. **Dependency graph complete** — no unknown identifiers without a definition link

**Idempotence Guarantee:**

Running the skill twice on the same task should produce identical prompt files (same context snapshot, same date, same dependency map). If context changes (new migrations, enum changes), skill re-runs with updated snapshots.

---

## Performance Notes

- **Context loading:** Parallel reads from `.claude/local/context/` (5-10 files)
- **Schema pruning:** Reduces context by ~60%
- **Instance sampling:** Add ~5-20 KB per task
- **Total overhead:** +2-5 seconds per skill invocation

---

## Why This 6-Layer Protocol?

Read [`references/why-6-layer-protocol.md`](references/why-6-layer-protocol.md) for the full rationale behind each layer — when you need to explain the design to a new team member, justify the overhead, or troubleshoot why a layer isn't behaving as expected.
```
